import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { instructionName } from "../instructions-loaded";
import { outcomeOf, runContext, runLogDir } from "../lib/run-log";

const HOOKS = join(import.meta.dir, "..");
const dir = mkdtempSync(join(tmpdir(), "poneglyph-run-log-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Runs a hook as the host does and returns the lines it logged into its own folder.
function run(script: string[], payload: unknown, env: Record<string, string> = {}) {
  const logs = mkdtempSync(join(dir, "logs-"));
  const result = Bun.spawnSync([process.execPath, ...script], {
    stdin: Buffer.from(JSON.stringify(payload)),
    stdout: "pipe",
    env: { ...process.env, PONEGLYPH_RUN_LOG_DIR: logs, CLAUDE_PROJECT_DIR: dir, ...env },
  });
  const lines = readdirSync(logs).flatMap((f) => readFileSync(join(logs, f), "utf8").trim().split("\n").map((l) => JSON.parse(l)));
  return { result, lines };
}

describe("hook run log", () => {
  test("a hook run writes exactly one line: who, what, how long, how it ended, how much it said", () => {
    const { result, lines } = run([join(HOOKS, "headless-model-gate.ts")], {
      session_id: "s-1",
      cwd: dir,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls /secret/project/path" },
    });
    expect(result.exitCode).toBe(0);
    expect(lines).toHaveLength(1);
    const [line] = lines;
    expect(line).toMatchObject({ host: "claude", session: "s-1", hook: "headless-model-gate.ts", event: "PreToolUse", tool: "Bash", exit: 0, outcome: "ok", out: 0 });
    expect(line.ms).toBeGreaterThan(0);
    // Never the command, the cwd or any path.
    expect(JSON.stringify(line)).not.toContain("/secret");
    expect(JSON.stringify(line)).not.toContain(dir);
  });

  test("a native host's run names the host and event from the argv, and a JSON deny is a block", () => {
    const { lines } = run([join(HOOKS, "native-hook.ts"), "--host", "grok", "--event", "PreToolUse"], {
      sessionId: "g-1",
      toolName: "run_terminal_command",
      toolInput: { command: "claude -p --model opus 'x'" },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ host: "grok", session: "g-1", hook: "native-hook.ts", event: "PreToolUse", tool: "run_terminal_command", exit: 0, outcome: "block" });
    expect(lines[0].out).toBeGreaterThan(0);
  });

  test("an instruction file logs its name inside .claude and its size, not its path", () => {
    const file = join(dir, "CLAUDE.md");
    writeFileSync(file, "x".repeat(321));
    const { lines } = run([join(HOOKS, "instructions-loaded.ts")], { session_id: "s-2", cwd: dir, file_path: file, memory_type: "Project", load_reason: "session_start", hook_event_name: "InstructionsLoaded" });
    expect(lines[0]).toMatchObject({ event: "InstructionsLoaded", file: "CLAUDE.md", type: "Project", bytes: 321 });
    expect(instructionName("/Users/x/work/app/.claude/rules/paths/hooks.md")).toBe("rules/paths/hooks.md");
    expect(instructionName("C:\\Users\\x\\.claude\\CLAUDE.md")).toBe("CLAUDE.md");
  });

  test("under bun test with no folder named, nothing is written", () => {
    expect(runLogDir({ NODE_ENV: "test" })).toBeNull();
    expect(runLogDir({ NODE_ENV: "test", PONEGLYPH_RUN_LOG_DIR: "/x" })).toBe("/x");
    expect(runLogDir({ CLAUDE_CONFIG_DIR: "/c" })).toBe(join("/c", "learned", "hook-runs"));
    const { lines } = run([join(HOOKS, "headless-model-gate.ts")], { session_id: "s-3", hook_event_name: "PreToolUse", tool_name: "Read" }, { PONEGLYPH_RUN_LOG_DIR: "" });
    expect(lines).toHaveLength(0);
    expect(existsSync(join(dir, "learned"))).toBe(false);
  });
});

describe("a log that cannot be written", () => {
  test("leaves the hook's exit and output as they were", () => {
    const payload = { sessionId: "g-2", toolName: "run_terminal_command", toolInput: { command: "claude -p --model opus 'x'" } };
    const args = [join(HOOKS, "native-hook.ts"), "--host", "grok", "--event", "PreToolUse"];
    const spawn = (env: Record<string, string>) =>
      Bun.spawnSync([process.execPath, ...args], { stdin: Buffer.from(JSON.stringify(payload)), stdout: "pipe", env: { ...process.env, ...env } });
    // A file where the folder should be: mkdir fails on exit.
    const blocked = join(dir, "not-a-folder");
    writeFileSync(blocked, "");
    const broken = spawn({ PONEGLYPH_RUN_LOG_DIR: join(blocked, "logs") });
    const off = spawn({ PONEGLYPH_RUN_LOG_DIR: "" });
    expect(broken.exitCode).toBe(off.exitCode);
    expect(broken.stdout.toString()).toBe(off.stdout.toString());
    expect(broken.stdout.toString()).toContain('"decision":"deny"');
  });
});

describe("outcome and context", () => {
  test("exit 2 or a deny is a block; any other non-zero exit an error", () => {
    expect(outcomeOf(0, "")).toBe("ok");
    expect(outcomeOf(2, "")).toBe("block");
    expect(outcomeOf(0, '{"hookSpecificOutput":{"permissionDecision":"deny"}}')).toBe("block");
    expect(outcomeOf(0, '{"decision": "block","reason":"r"}')).toBe("block");
    expect(outcomeOf(1, "")).toBe("error");
  });

  test("the context comes from the payload's head only: a key inside a tool's output does not count", () => {
    const raw = JSON.stringify({ session_id: "s", hook_event_name: "PostToolUse", tool_name: "Read", tool_response: "x".repeat(4000) + '"session_id":"other"' });
    expect(runContext(raw, ["bun", "/h/turn-nudges.ts"])).toEqual({ host: "claude", session: "s", hook: "turn-nudges.ts", event: "PostToolUse", tool: "Read" });
    expect(runContext("{}", ["bun", "/h/x.ts"]).session).toBeUndefined();
  });
});
