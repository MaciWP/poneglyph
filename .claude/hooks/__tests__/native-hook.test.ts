import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { handleNativeHook, patchPaths } from "../native-hook";
import { routerNoteFile } from "../prompt-router";
import { analyzePayload } from "../skill-activation";

describe("native hook contracts", () => {
  it("applies one command decision through Codex and Grok payloads", async () => {
    const codex = await handleNativeHook("codex", "PreToolUse", {
      tool_name: "Bash", tool_input: { command: "claude -p test" },
    });
    const grok = await handleNativeHook("grok", "PreToolUse", {
      toolName: "run_terminal_command", toolInput: { command: "claude -p test" },
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
    const hint = await handleNativeHook("codex", "UserPromptSubmit", { prompt: "quiero una nueva funcionalidad de informes" });
    expect(hint?.hookSpecificOutput?.hookEventName).toBe("UserPromptSubmit");
    expect(hint?.hookSpecificOutput?.additionalContext).toContain("$flow-lifecycle");
    // Skill discovery is the prompt router's job; the shared hint names no skill.
    expect(hint?.hookSpecificOutput?.additionalContext).not.toContain("Skill(");
    expect(await handleNativeHook("codex", "UserPromptSubmit", { prompt: "$flow-lifecycle una nueva funcionalidad" })).toBeNull();
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

  it("hands the router note to the first tool call that runs, once", async () => {
    const session = `test-${process.pid}-${Date.now()}`;
    mkdirSync(join(tmpdir(), "poneglyph-router"), { recursive: true });
    writeFileSync(routerNoteFile(session), "<prompt-router>note</prompt-router>");
    // A denied call never runs, so the note waits for the next one.
    const denied = await handleNativeHook("grok", "PreToolUse", {
      sessionId: session, toolName: "run_terminal_command", toolInput: { command: "claude -p test" },
    });
    expect(denied?.decision).toBe("deny");
    const grok = await handleNativeHook("grok", "PreToolUse", {
      sessionId: session, toolName: "read_file", toolInput: { path: "a.ts" },
    });
    expect(grok?.hookSpecificOutput?.additionalContext).toBe("<prompt-router>note</prompt-router>");
    expect(await handleNativeHook("grok", "PreToolUse", {
      sessionId: session, toolName: "read_file", toolInput: { path: "a.ts" },
    })).toBeNull();
    writeFileSync(routerNoteFile(session), "<prompt-router>again</prompt-router>");
    const codex = await handleNativeHook("codex", "PreToolUse", {
      session_id: session, tool_name: "Bash", tool_input: { command: "git status" },
    });
    expect(codex?.hookSpecificOutput).toEqual({ hookEventName: "PreToolUse", additionalContext: "<prompt-router>again</prompt-router>" });
  });

  it("a new prompt drops the note left for the previous one", async () => {
    const session = `test-new-${process.pid}-${Date.now()}`;
    mkdirSync(join(tmpdir(), "poneglyph-router"), { recursive: true });
    writeFileSync(routerNoteFile(session), "stale");
    // Two words: below the router gate, so nothing is spawned.
    await handleNativeHook("grok", "UserPromptSubmit", { sessionId: session, prompt: "sigue así" });
    expect(existsSync(routerNoteFile(session))).toBe(false);
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

// The shared hint text names Claude built-ins
// (`/autocompact`, `/effort`) and the Claude command prefix (`/flow-lifecycle`); Codex
// reads the same text through this adapter. Self-maintaining: the expected tokens are
// read from the Claude-bound injection, not hardcoded, so a reworded hint stays covered.
describe("native hook host-neutral hints", () => {
  // A slash command: not a path segment (`docs/x`), not the wrapper's closing tag (`</…>`).
  const SLASH = /(?<![\w/<])\/[a-z][\w-]*/g;
  const PROMPTS = [
    "quiero llevar esta funcionalidad de principio a fin",
    "haz un barrido mecanico sobre el repo entero",
    "pregunta rapida sobre este flag",
  ];

  it("leaves no Claude-only command in the Codex context", async () => {
    for (const prompt of PROMPTS) {
      const claude = analyzePayload(JSON.stringify({ prompt })).injection;
      const tokens = [...new Set(claude.match(SLASH) ?? [])];
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
    expect(hint).not.toContain("not an in-session command");
  });
});

// The design-file note on a Codex apply_patch; Grok stays silent.
describe("native hook design-file note", () => {
  const fresh = () => mkdtempSync(join(tmpdir(), "native-design-"));
  const patch = (...lines: string[]) => ["*** Begin Patch", ...lines, "*** End Patch", ""].join("\n");
  const logOf = (dir: string) => join(dir, ".claude", "learned", "design-file-hints.log");

  it("T5.1 a Codex patch on a UI file returns the note without a decision", async () => {
    const out = await handleNativeHook("codex", "PreToolUse", {
      session_id: "c-1", cwd: fresh(), tool_name: "apply_patch",
      tool_input: { command: patch("*** Update File: web/index.html", "@@", "-a", "+b") },
    });
    expect(out).not.toBeNull();
    expect(out?.hookSpecificOutput?.hookEventName).toBe("PreToolUse");
    expect(out?.hookSpecificOutput?.additionalContext).toContain("DESIGN_SYSTEM.md");
    expect(out?.hookSpecificOutput).not.toHaveProperty("permissionDecision");
  });

  it("T5.2 parses Add/Update paths; non-UI patches and a noted session stay silent", async () => {
    expect(patchPaths("*** Begin Patch\n*** Add File: a.ts\n*** Update File: b/C.vue\n*** End Patch\n")).toEqual(["a.ts", "b/C.vue"]);
    const dir = fresh();
    const call = (session: string, ...lines: string[]) => handleNativeHook("codex", "PreToolUse", {
      session_id: session, cwd: dir, tool_name: "apply_patch", tool_input: { command: patch(...lines) },
    });
    expect(await call("c-2", "*** Add File: src/util.ts", "+x")).toBeNull();
    expect(await call("c-3", "*** Add File: src/util.ts", "+x", "*** Add File: src/Button.vue", "+y")).not.toBeNull();
    expect(await call("c-3", "*** Add File: src/Button.vue", "+y")).toBeNull();
  });

  it("T5.4 a router note waiting for the session joins the design note in one context", async () => {
    const session = `c-combo-${process.pid}-${Date.now()}`;
    mkdirSync(join(tmpdir(), "poneglyph-router"), { recursive: true });
    writeFileSync(routerNoteFile(session), "<prompt-router>n</prompt-router>");
    const out = await handleNativeHook("codex", "PreToolUse", {
      session_id: session, cwd: fresh(), tool_name: "apply_patch",
      tool_input: { command: patch("*** Update File: web/index.html", "@@", "-a", "+b") },
    });
    const context = out?.hookSpecificOutput?.additionalContext ?? "";
    expect(context).toContain("DESIGN_SYSTEM.md");
    expect(context).toEndWith("\n\n<prompt-router>n</prompt-router>");
  });

  it("T5.3 Grok gets nothing for the same payload", async () => {
    const dir = fresh();
    expect(await handleNativeHook("grok", "PreToolUse", {
      sessionId: "g-1", cwd: dir, toolName: "apply_patch", toolInput: { command: "*** Update File: index.html\n" },
    })).toBeNull();
    expect(existsSync(logOf(dir))).toBe(false);
  });
});
