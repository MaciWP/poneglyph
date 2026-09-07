import { describe, it, expect } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "path";
import {
  classifyGrokTwin,
  expandFolderLinks,
  formatGrokTwinLine,
  formatSettingsValidationLine,
  formatSpTwinStatusLine,
  generateSpTwin,
  parseDoctorInvalidSettings,
  problemsForFile,
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
