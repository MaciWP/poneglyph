import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { handleNativeHook } from "../native-hook";
import { analyzePayload } from "../skill-activation";

describe("native hook contracts", () => {
  it("applies one command decision through Codex and Grok payloads", async () => {
    const codex = await handleNativeHook("codex", "PreToolUse", {
      tool_name: "Bash", tool_input: { command: "claude -p test" },
    });
    const grok = await handleNativeHook("grok", "PreToolUse", {
      toolName: "run_shell_command", toolInput: { command: "claude -p test" },
    });
    expect(codex?.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(grok?.decision).toBe("deny");
    expect(grok?.reason).toBe(codex?.hookSpecificOutput?.permissionDecisionReason);
    expect(await handleNativeHook("codex", "PreToolUse", {
      tool_name: "exec_command", tool_input: { cmd: "git status --short" },
    })).toBeNull();
  });

  it("does not invent passive Grok injection or a Codex transcript contract", async () => {
    expect(await handleNativeHook("grok", "UserPromptSubmit", { prompt: "revisa la pr" })).toBeNull();
    const dir = mkdtempSync(join(tmpdir(), "native-stop-"));
    expect(Bun.spawnSync(["git", "init", "--quiet", dir]).exitCode).toBe(0);
    const transcript = join(dir, "transcript.jsonl");
    writeFileSync(transcript, "this is not a portable transcript interface");
    expect(await handleNativeHook("codex", "Stop", { cwd: dir, transcript_path: transcript })).toBeNull();
    expect(await handleNativeHook("codex", "Stop", { stop_hook_active: true })).toBeNull();
  });

  it("delivers Codex hints as context and leaves explicit skill invocation alone", async () => {
    const hint = await handleNativeHook("codex", "UserPromptSubmit", { prompt: "revisa la pr" });
    expect(hint?.hookSpecificOutput?.hookEventName).toBe("UserPromptSubmit");
    expect(hint?.hookSpecificOutput?.additionalContext).toContain("Skill(");
    expect(await handleNativeHook("codex", "UserPromptSubmit", { prompt: "$flow una nueva funcionalidad" })).toBeNull();
  });

  it("scans the payload project, including an unborn repo and spaced filenames", async () => {
    const dir = mkdtempSync(join(tmpdir(), "native-scan-"));
    expect(Bun.spawnSync(["git", "init", "--quiet", dir]).exitCode).toBe(0);
    writeFileSync(join(dir, "new settings.ts"), 'const password = "' + "synthetic-" + "fixture-value" + '";\n');
    const response = await handleNativeHook("codex", "Stop", { cwd: dir });
    expect(response?.systemMessage).toContain("new settings.ts:1");
    expect(response?.systemMessage).not.toContain("fixture-value");
    expect(response).not.toHaveProperty("decision");
    expect(response).not.toHaveProperty("hookSpecificOutput");
  });

  it("reports malformed CLI payloads as errors instead of silently succeeding", () => {
    const proc = Bun.spawnSync([process.execPath, resolve(import.meta.dir, "../native-hook.ts"), "--host", "grok", "--event", "PreToolUse"], {
      stdin: Buffer.from("{broken"),
    });
    expect(proc.exitCode).toBe(1);
    expect(proc.stderr.toString()).toContain("native-hook failed");
    expect(proc.stderr.toString()).not.toContain("{broken");
  });
});

// Quality review 2026-09-11, finding H21. The Codex adapter listed the core skills dir
// first and `loadSkills` keeps the FIRST directory that defines a name, so a project
// override lost on Codex and won on Claude. Hermetic on purpose: two temp roots, so the
// assertion does not break when a real skill edits its keywords.
function writeSkillFixture(root: string, name: string, keywords: string): void {
  const dir = join(root, ".claude", "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: Routing fixture\nmetadata:\n  keywords: >\n    Keywords - ${keywords}\n---\n\n# ${name}\n`);
}

describe("native hook skill precedence (H21)", () => {
  it("lets the project override a core skill of the same name", async () => {
    const core = mkdtempSync(join(tmpdir(), "native-core-"));
    const project = mkdtempSync(join(tmpdir(), "native-project-"));
    writeSkillFixture(core, "verify", "core only phrase");
    writeSkillFixture(project, "verify", "project only phrase");
    const hint = await handleNativeHook(
      "codex", "UserPromptSubmit",
      { prompt: "aplica la project only phrase ahora", cwd: project },
      core,
    );
    expect(hint?.hookSpecificOutput?.additionalContext).toContain('matched "project only phrase"');
  });

  it("still reads the core skills when the payload carries no project cwd", async () => {
    const core = mkdtempSync(join(tmpdir(), "native-core-only-"));
    writeSkillFixture(core, "verify", "core only phrase");
    const hint = await handleNativeHook(
      "codex", "UserPromptSubmit", { prompt: "usa la core only phrase" }, core,
    );
    expect(hint?.hookSpecificOutput?.additionalContext).toContain('matched "core only phrase"');
  });
});

// Quality review 2026-09-11, finding H43. The shared hint text names Claude built-ins
// (`/autocompact`, `/effort`) and the Claude command prefix (`/flow`); Codex
// reads the same text through this adapter. Self-maintaining: the expected tokens are
// read from the Claude-bound injection, not hardcoded, so a reworded hint stays covered.
// Scope is the shape lines — `Skill(<name>)` lines are host-neutral already and a skill
// keyword may legitimately contain a slash (`consult` carries `/codex:`). The two sides are
// deliberately asymmetric: the Claude side runs with no catalog so only shape lines appear,
// while the Codex side loads the real core skills through the adapter.
describe("native hook host-neutral hints (H43)", () => {
  // A slash command: not a path segment (`docs/x`), not the wrapper's closing tag (`</…>`).
  const SLASH = /(?<![\w/<])\/[a-z][\w-]*/g;
  const PROMPTS = [
    "quiero llevar esta funcionalidad de principio a fin",
    "haz un barrido mecanico sobre el repo entero",
    "pregunta rapida sobre este flag",
  ];

  it("leaves no Claude-only command in the Codex context", async () => {
    for (const prompt of PROMPTS) {
      const claude = analyzePayload(JSON.stringify({ prompt }), []).injection;
      const shapeLines = claude.split("\n").filter((l) => !l.startsWith("Skill("));
      const tokens = [...new Set(shapeLines.join("\n").match(SLASH) ?? [])];
      expect(tokens.length).toBeGreaterThan(0);
      const codex = (await handleNativeHook("codex", "UserPromptSubmit", { prompt }))
        ?.hookSpecificOutput?.additionalContext ?? "";
      expect(codex).not.toBe("");
      for (const token of tokens.filter(token => token !== "/model")) expect(codex).not.toContain(token);
    }
  });
  it("offers the interactive Codex model selector for effort changes", async () => {
    const hint = (await handleNativeHook("codex", "UserPromptSubmit", { prompt: PROMPTS[2] }))?.hookSpecificOutput?.additionalContext;
    expect(hint).toContain("/model");
    expect(hint).toContain("Orca");
    expect(hint).not.toContain("not an in-session command");
  });
});
