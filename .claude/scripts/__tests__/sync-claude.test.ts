import { describe, it, expect } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "path";
import {
  LINK_FOLDERS,
  classifyGrokTwin,
  cliUnavailableValidation,
  expandFolderLinks,
  formatGrokTwinLine,
  formatSettingsValidationLine,
  mergeHookEvents,
  statusExitCode,
  formatSpTwinStatusLine,
  generateSettings,
  generateSpTwin,
  mergeHookEvents,
  parseDoctorInvalidSettings,
  problemsForFile,
  timeoutValidation,
} from "../sync-claude.ts";

const SRC = path.join("/repo", ".claude", "rules");
const DEST = path.join("/home", ".claude", "rules");
const PROJECT_ONLY = new Set(["test-policy.md"]);

describe("expandFolderLinks", () => {
  it("links top-level rule files individually as file links", () => {
    const out = expandFolderLinks(
      SRC,
      DEST,
      [{ name: "error-recovery.md", isDirectory: false }],
      PROJECT_ONLY,
    );
    expect(out).toEqual([
      {
        source: path.join(SRC, "error-recovery.md"),
        dest: path.join(DEST, "error-recovery.md"),
        type: "file",
      },
    ]);
  });

  it("excludes project-only rules from the global set", () => {
    const out = expandFolderLinks(
      SRC,
      DEST,
      [{ name: "test-policy.md", isDirectory: false }],
      PROJECT_ONLY,
    );
    expect(out).toEqual([]);
  });

  it("links subdirectories as directory links", () => {
    const out = expandFolderLinks(
      SRC,
      DEST,
      [{ name: "paths", isDirectory: true }],
      PROJECT_ONLY,
    );
    expect(out).toEqual([
      {
        source: path.join(SRC, "paths"),
        dest: path.join(DEST, "paths"),
        type: "directory",
      },
    ]);
  });

  it("skips dotfiles like .DS_Store", () => {
    const out = expandFolderLinks(
      SRC,
      DEST,
      [{ name: ".DS_Store", isDirectory: false }],
      PROJECT_ONLY,
    );
    expect(out).toEqual([]);
  });

  it("handles the real poneglyph rules layout: error-recovery + paths/ in, test-policy out", () => {
    const out = expandFolderLinks(
      SRC,
      DEST,
      [
        { name: "error-recovery.md", isDirectory: false },
        { name: "test-policy.md", isDirectory: false },
        { name: "paths", isDirectory: true },
      ],
      PROJECT_ONLY,
    );
    expect(out.map((l) => path.basename(l.dest)).sort()).toEqual([
      "error-recovery.md",
      "paths",
    ]);
    expect(out.find((l) => l.dest.endsWith("paths"))!.type).toBe("directory");
    expect(out.every((l) => !l.dest.endsWith("test-policy.md"))).toBe(true);
  });

  it("excludes a project-only DIRECTORY, not just files (regression: the directory branch used to skip the projectOnly check entirely)", () => {
    const out = expandFolderLinks(
      SRC,
      DEST,
      [{ name: "local-model", isDirectory: true }],
      new Set(["local-model"]),
    );
    expect(out).toEqual([]);
  });

  it("handles the real poneglyph docs layout: local-model stays out of the global layer", () => {
    const out = expandFolderLinks(
      path.join("/repo", ".claude", "docs"),
      path.join("/home", ".claude", "docs"),
      [
        { name: "system-inventory.md", isDirectory: false },
        { name: "local-model", isDirectory: true },
      ],
      new Set(["local-model"]),
    );
    expect(out.map((l) => path.basename(l.dest))).toEqual([
      "system-inventory.md",
    ]);
  });
});

describe("classifyGrokTwin (check, not install)", () => {
  const expected = "/repo/.claude/system-prompts/poneglyph-sp.md";

  it("ok when the symlink resolves to the generated twin", () => {
    expect(
      classifyGrokTwin({
        exists: true,
        isSymlink: true,
        resolvedTarget: expected,
        expected,
      }),
    ).toBe("ok");
  });

  it("missing when the dest is absent", () => {
    expect(
      classifyGrokTwin({
        exists: false,
        isSymlink: false,
        resolvedTarget: null,
        expected,
      }),
    ).toBe("missing");
  });

  it("not-symlink when a regular file occupies the path", () => {
    expect(
      classifyGrokTwin({
        exists: true,
        isSymlink: false,
        resolvedTarget: null,
        expected,
      }),
    ).toBe("not-symlink");
  });

  it("wrong-target when the symlink points elsewhere", () => {
    expect(
      classifyGrokTwin({
        exists: true,
        isSymlink: true,
        resolvedTarget: "/other/poneglyph-style.md",
        expected,
      }),
    ).toBe("wrong-target");
  });

  it("ok-copy when a regular file is content-equal to the twin (Windows install)", () => {
    expect(
      classifyGrokTwin({
        exists: true,
        isSymlink: false,
        resolvedTarget: null,
        expected,
        contentMatches: true,
      }),
    ).toBe("ok-copy");
  });

  it("stale-copy when a regular file diverges from the twin", () => {
    expect(
      classifyGrokTwin({
        exists: true,
        isSymlink: false,
        resolvedTarget: null,
        expected,
        contentMatches: false,
      }),
    ).toBe("stale-copy");
  });

  it("status copy never claims to install", () => {
    const kinds = ["ok", "ok-copy", "stale-copy", "missing", "not-symlink", "wrong-target"] as const;
    for (const kind of kinds) {
      if (kind === "ok") {
        expect(formatGrokTwinLine(kind)).toContain("check, not install");
      } else {
        expect(formatGrokTwinLine(kind, "/x")).toMatch(/ln -sfn|check, not install/);
      }
    }
  });
});

describe("generateSpTwin (style SSOT → body-only twin)", () => {
  const style = [
    "---",
    "name: Poneglyph",
    "description: test",
    "keep-coding-instructions: true",
    "---",
    "",
    "# Poneglyph",
    "",
    "Law body here.",
    "",
  ].join("\n");

  function makeRoot(): string {
    const root = mkdtempSync(path.join(tmpdir(), "sp-twin-"));
    mkdirSync(path.join(root, ".claude", "output-styles"), { recursive: true });
    mkdirSync(path.join(root, ".claude", "system-prompts"), { recursive: true });
    writeFileSync(path.join(root, ".claude", "output-styles", "poneglyph.md"), style);
    return root;
  }

  it("previews when the twin is missing, writes on execute, then reports up-to-date", () => {
    const root = makeRoot();
    expect(generateSpTwin(root, false).status).toBe("preview");
    expect(generateSpTwin(root, true).status).toBe("written");
    const twin = readFileSync(
      path.join(root, ".claude", "system-prompts", "poneglyph-sp.md"),
      "utf-8",
    );
    expect(twin).toStartWith("# Poneglyph");
    expect(twin).not.toContain("keep-coding-instructions");
    expect(generateSpTwin(root, false).status).toBe("up-to-date");
  });

  it("read-only status flags a stale twin after the style SSOT changes (never writes)", () => {
    const root = makeRoot();
    generateSpTwin(root, true);
    writeFileSync(
      path.join(root, ".claude", "output-styles", "poneglyph.md"),
      style.replace("Law body here.", "Law body v2."),
    );
    const twinPath = path.join(root, ".claude", "system-prompts", "poneglyph-sp.md");
    const before = readFileSync(twinPath, "utf-8");
    expect(generateSpTwin(root, false).status).toBe("preview");
    expect(readFileSync(twinPath, "utf-8")).toBe(before);
  });

  it("errors when the style SSOT is missing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "sp-twin-"));
    expect(generateSpTwin(root, false).status).toBe("error");
  });

  it("status lines: stale names STALE + --execute, up-to-date is green, error carries the message", () => {
    expect(formatSpTwinStatusLine("preview", "")).toContain("STALE");
    expect(formatSpTwinStatusLine("preview", "")).toContain("--execute");
    expect(formatSpTwinStatusLine("up-to-date", "")).toStartWith("🟢");
    expect(formatSpTwinStatusLine("error", "boom")).toContain("boom");
  });
});

// 032/WP1 — the generated settings.json is ACCEPTED by Claude Code, not merely written.
// Sample = real `claude doctor` output captured 2026-09-03 (2.1.259) for the audit-010
// regression (attribution booleans); doctor exits 0 even then, so only the text counts.
const DOCTOR_OUTPUT = [
  "Claude Code doctor",
  "",
  "Running: native (2.1.259)",
  "Search: OK (bundled)",
  "Managed settings (remote): checking… (fetch in progress; re-run in a moment)",
  "",
  "Invalid settings",
  "- C:\\Users\\Oriol\\.claude\\settings.json › attribution.commit: Expected string, but received boolean",
  "- C:\\Users\\Oriol\\.claude\\settings.json › attribution.pr: Expected string, but received boolean",
  "",
  "Remote Control",
  "Remote Control is disabled by your organization's policy.",
  "",
  "No installation issues found.",
].join("\n");

describe("parseDoctorInvalidSettings", () => {
  it("returns the problem lines under the heading, without the bullet, stopping at the blank line", () => {
    const problems = parseDoctorInvalidSettings(DOCTOR_OUTPUT);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toBe(
      "C:\\Users\\Oriol\\.claude\\settings.json › attribution.commit: Expected string, but received boolean",
    );
    expect(problems.some((p) => p.includes("Remote Control"))).toBe(false);
  });

  it("returns [] when the section is absent (a clean doctor run)", () => {
    const clean = DOCTOR_OUTPUT.split("\n").filter((l) => !/Invalid settings|Expected string/.test(l)).join("\n");
    expect(parseDoctorInvalidSettings(clean)).toEqual([]);
    expect(parseDoctorInvalidSettings("")).toEqual([]);
  });

  it("accepts CRLF output", () => {
    expect(parseDoctorInvalidSettings(DOCTOR_OUTPUT.replace(/\n/g, "\r\n"))).toHaveLength(2);
  });
});

describe("problemsForFile", () => {
  const problems = parseDoctorInvalidSettings(DOCTOR_OUTPUT);

  it("matches the generated file case-insensitively and across path separators", () => {
    expect(problemsForFile(problems, "c:/users/oriol/.claude/settings.json")).toHaveLength(2);
    expect(problemsForFile(problems, "C:\\Users\\Oriol\\.claude\\settings.json")).toHaveLength(2);
  });

  it("ignores problems that belong to other settings files", () => {
    expect(problemsForFile(problems, "D:\\repo\\.claude\\settings.json")).toEqual([]);
  });
});

describe("formatSettingsValidationLine", () => {
  it("is 🟢 when accepted, 🔴 with the problems when rejected, 🟡 when the check could not run", () => {
    expect(formatSettingsValidationLine({ ok: true, problems: [] })).toStartWith("🟢");
    const red = formatSettingsValidationLine({ ok: false, problems: ["x › y: Expected string"] });
    expect(red).toStartWith("🔴");
    expect(red).toContain("   - x › y: Expected string");
    expect(formatSettingsValidationLine({ ok: true, problems: [], skipped: "claude CLI not runnable" })).toStartWith("🟡");
  });
});

// Plan 038 — the machine overlay used to REPLACE a whole hooks.<event> array, masking every
// base handler for that event (bash-output-shaper vanished on 2026-09-09). Now: union per
// event, base groups first, handlers de-duplicated by `command` (first occurrence wins).
const handler = (command: string, timeout = 10) => ({ type: "command", command, timeout });
const GATE = "bun $HOME/.claude/hooks/headless-model-gate.ts";
const SHAPER = "bun $HOME/.claude/hooks/bash-output-shaper.ts";
const ORCA = "powershell -File C:/orca/hook.ps1";
const BASE_HOOKS = {
  PreToolUse: [{ matcher: "Bash", hooks: [handler(GATE, 5), handler(SHAPER, 5)] }],
  InstructionsLoaded: [{ hooks: [{ ...handler("bun $HOME/.claude/hooks/instructions-loaded.ts"), async: true }] }],
};
const OVERLAY_HOOKS = {
  PreToolUse: [
    { matcher: "Bash", hooks: [handler(GATE)] },
    { matcher: "*", hooks: [handler(ORCA)] },
  ],
  SubagentStart: [{ hooks: [handler(ORCA)] }],
};
const commands = (groups: unknown) =>
  (groups as Array<{ hooks: Array<{ command: string }> }>).flatMap((g) => g.hooks.map((h) => h.command));

describe("mergeHookEvents (plan 038)", () => {
  const merged = mergeHookEvents(BASE_HOOKS, OVERLAY_HOOKS) as Record<string, unknown>;

  it("a. keeps both sides' groups for a shared event, base group first", () => {
    expect(commands(merged.PreToolUse)).toEqual([GATE, SHAPER, ORCA]);
    expect((merged.PreToolUse as Array<{ matcher: string }>).map((g) => g.matcher)).toEqual(["Bash", "*"]);
  });

  it("b. drops an overlay handler whose command the base already has (base copy wins) and the group it emptied", () => {
    const pre = merged.PreToolUse as Array<{ hooks: Array<{ command: string; timeout: number }> }>;
    expect(pre).toHaveLength(2);
    expect(pre[0].hooks.find((h) => h.command === GATE)!.timeout).toBe(5);
  });

  it("c. preserves an overlay-only event unchanged", () => {
    expect(merged.SubagentStart).toEqual(OVERLAY_HOOKS.SubagentStart);
  });

  it("d. preserves a base-only event unchanged", () => {
    expect(merged.InstructionsLoaded).toEqual(BASE_HOOKS.InstructionsLoaded);
  });

  it("f. returns the other side unchanged when hooks is missing on one side", () => {
    expect(mergeHookEvents(BASE_HOOKS, undefined)).toEqual(BASE_HOOKS);
    expect(mergeHookEvents(undefined, OVERLAY_HOOKS)).toEqual(OVERLAY_HOOKS);
    expect(mergeHookEvents(undefined, undefined)).toBeUndefined();
  });

  it("does not mutate its inputs", () => {
    expect(BASE_HOOKS.PreToolUse).toHaveLength(1);
    expect(OVERLAY_HOOKS.PreToolUse).toHaveLength(2);
  });
});

describe("generateSettings — hooks union is wired, other arrays still replaced", () => {
  it("e. unions hooks.PreToolUse but lets permissions.allow be replaced by the overlay", () => {
    const root = mkdtempSync(path.join(tmpdir(), "settings-hooks-"));
    const repo = path.join(root, "repo");
    const profile = path.join(root, "profile");
    mkdirSync(path.join(repo, ".claude"), { recursive: true });
    writeFileSync(
      path.join(repo, ".claude", "settings.global.json"),
      JSON.stringify({ permissions: { allow: ["Read", "Grep"] }, hooks: BASE_HOOKS }),
    );
    writeFileSync(
      path.join(repo, ".claude", "settings.machine.json"),
      JSON.stringify({ permissions: { allow: ["Bash(bun *)"] }, hooks: OVERLAY_HOOKS }),
    );
    expect(generateSettings(repo, profile, { execute: true, backup: false }).status).toBe("written");
    const out = JSON.parse(readFileSync(path.join(profile, ".claude", "settings.json"), "utf-8"));
    expect(out.permissions.allow).toEqual(["Bash(bun *)"]);
    expect(commands(out.hooks.PreToolUse)).toEqual([GATE, SHAPER, ORCA]);
    expect(Object.keys(out.hooks).sort()).toEqual(["InstructionsLoaded", "PreToolUse", "SubagentStart"]);
  });

  it("copies the base hooks untouched when the overlay has no hooks key", () => {
    const root = mkdtempSync(path.join(tmpdir(), "settings-hooks-"));
    const repo = path.join(root, "repo");
    const profile = path.join(root, "profile");
    mkdirSync(path.join(repo, ".claude"), { recursive: true });
    writeFileSync(path.join(repo, ".claude", "settings.global.json"), JSON.stringify({ hooks: BASE_HOOKS }));
    writeFileSync(path.join(repo, ".claude", "settings.machine.json"), JSON.stringify({ model: "opus" }));
    generateSettings(repo, profile, { execute: true, backup: false });
    const out = JSON.parse(readFileSync(path.join(profile, ".claude", "settings.json"), "utf-8"));
    expect(out.hooks).toEqual(BASE_HOOKS);
    expect(out.model).toBe("opus");
  });
});

describe("LINK_FOLDERS", () => {
  it("links plans/templates for the global template fallback without linking plans/ itself", () => {
    // ~/.claude/plans is Claude Code's plan-mode store: a whole-folder link would replace it.
    expect(LINK_FOLDERS).toContain("plans/templates");
    expect(LINK_FOLDERS).not.toContain("plans");
    expect(path.join("/home", ".claude", "plans/templates")).toBe(path.join("/home", ".claude", "plans", "templates"));
  });
});

// Quality review 2026-09-11 — H32 (hook dedup ignores the matcher) and H63 (--status
// reports a rejected settings.json as success).
describe("hook merge is matcher-aware (H32)", () => {
  const group = (matcher: string, command: string) => ({ matcher, hooks: [{ type: "command", command }] });

  it("keeps the same script registered under two different matchers", () => {
    const merged = mergeHookEvents(
      { PreToolUse: [group("Bash", "bun hook.ts")] },
      { PreToolUse: [group("Write", "bun hook.ts")] },
    ) as Record<string, { matcher: string }[]>;
    expect(merged.PreToolUse.map((g) => g.matcher).sort()).toEqual(["Bash", "Write"]);
  });

  it("still drops a true duplicate: same matcher, same command", () => {
    const merged = mergeHookEvents(
      { PreToolUse: [group("Bash", "bun hook.ts")] },
      { PreToolUse: [group("Bash", "bun hook.ts")] },
    ) as Record<string, { hooks: unknown[] }[]>;
    expect(merged.PreToolUse.flatMap((g) => g.hooks)).toHaveLength(1);
  });
});

describe("--status tells the truth through its exit code (H63)", () => {
  it("fails when claude doctor rejected the generated settings.json", () => {
    expect(statusExitCode({ ok: false, problems: ["settings.json: invalid key"] })).toBe(1);
  });

  it("succeeds when the file was accepted", () => {
    expect(statusExitCode({ ok: true, problems: [] })).toBe(0);
  });

  it("does not fail when validation was skipped, and says so", () => {
    expect(statusExitCode({ ok: true, problems: [], skipped: "claude CLI not runnable" })).toBe(0);
  });
});

// Quality review 2026-09-11 — H36. `validateGeneratedSettings` deliberately ignores
// `claude doctor`'s exit code (sync-claude.ts:620-624: doctor exits 0 even when it
// rejects a settings file, so only the OUTPUT carries the verdict). What was missing
// is a machine-readable reason: a timeout and a missing CLI both surfaced as the same
// `ok: true` with a free-text `skipped`, so no caller could tell them apart.
describe("skipped validations carry a distinct reason (H36)", () => {
  it("labels a timeout as a timeout and keeps the human sentence", () => {
    const v = timeoutValidation(90_000);
    expect(v.reason).toBe("timeout");
    expect(v.skipped).toBe("claude doctor exceeded 90s");
    expect(v.ok).toBe(true); // unknown is not failure: statusExitCode stays 0
    expect(statusExitCode(v)).toBe(0);
  });

  it("labels an unrunnable CLI distinctly from a timeout", () => {
    const v = cliUnavailableValidation("spawn ENOENT");
    expect(v.reason).toBe("cli-unavailable");
    expect(v.skipped).toBe("claude CLI not runnable (spawn ENOENT)");
    expect(statusExitCode(v)).toBe(0);
  });

  it("renders both as the same yellow unknown line", () => {
    expect(formatSettingsValidationLine(timeoutValidation(1_000))).toStartWith("🟡");
    expect(formatSettingsValidationLine(cliUnavailableValidation("missing"))).toStartWith("🟡");
  });
});
