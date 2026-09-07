import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { handleNativeHook } from "../native-hook";

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
