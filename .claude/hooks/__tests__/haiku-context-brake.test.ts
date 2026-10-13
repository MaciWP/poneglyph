import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ignoreLearned } from "./learned-fixture";
import { agentTranscript, lastRequest, narrowNote, narrowRead, pendingTokens, readEstimate, readReason } from "../haiku-context-brake";

const HOOK = join(import.meta.dir, "..", "haiku-context-brake.ts");

const request = (model: string, read: number) => JSON.stringify({ type: "assistant", message: { model, usage: { input_tokens: 10, cache_read_input_tokens: read, cache_creation_input_tokens: 990 } } });

// A project dir with a main transcript and one subagent transcript in the Claude Code layout.
function fixture(lines: string[]) {
  const root = mkdtempSync(join(tmpdir(), "haiku-brake-"));
  const sessionDir = join(root, "projects", "p", "sess-1234567890", "subagents");
  mkdirSync(sessionDir, { recursive: true });
  const main = join(root, "projects", "p", "sess-1234567890.jsonl");
  writeFileSync(main, "");
  writeFileSync(join(sessionDir, "agent-abc.jsonl"), lines.join("\n") + "\n");
  const project = ignoreLearned(join(root, "project"));
  const run = (payload: Record<string, unknown>) =>
    spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ session_id: "sess-1234567890", transcript_path: main, tool_name: "Read", ...payload }), env: { ...process.env, CLAUDE_PROJECT_DIR: project, CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS: "" }, encoding: "utf8" }).stdout;
  return { run, main, log: join(project, ".claude", "learned", "haiku-brake.log") };
}

describe("haiku context brake", () => {
  test("the last real request decides, skipping synthetic and non-assistant lines", () => {
    const text = ["{cut", request("claude-haiku-5-5", 50_000), request("claude-haiku-5-5", 95_000), JSON.stringify({ type: "user", message: { usage: {} } }), request("<synthetic>", 0)].join("\n");
    expect(lastRequest(text)).toEqual({ model: "claude-haiku-5-5", context: 96_000 });
    expect(lastRequest("")).toBeNull();
  });

  test("the subagent transcript sits under the main transcript stem, whatever the session_id, with or without the agent- prefix", () => {
    const { main } = fixture([]);
    const expected = join(main.replace(/\.jsonl$/, ""), "subagents", "agent-abc.jsonl");
    expect(agentTranscript({ session_id: "sess-1234567890", transcript_path: main, agent_id: "abc" })).toBe(expected);
    expect(agentTranscript({ session_id: "continued-session", transcript_path: main, agent_id: "agent-abc" })).toBe(expected);
    expect(agentTranscript({ session_id: "sess-1234567890", transcript_path: main })).toBeNull();
  });

  test("no hard stop: only Read is checked, so other tools run at any context", () => {
    const { run, log } = fixture([request("claude-haiku-5-5", 150_000)]);
    expect(run({ agent_id: "abc", tool_name: "Bash", tool_input: { command: "ls" } })).toBe("");
    expect(run({ agent_id: "abc", tool_name: "Grep", tool_input: { pattern: "x" } })).toBe("");
    expect(existsSync(log)).toBe(false);
  });

  test("below the brake, another model, the main session or a broken payload all let the tool run", () => {
    expect(fixture([request("claude-sonnet-5-5", 150_000)]).run({ agent_id: "abc" })).toBe("");
    expect(fixture([request("claude-haiku-5-5", 150_000)]).run({})).toBe("");
    const r = spawnSync(process.execPath, [HOOK], { input: "{not json", encoding: "utf8" });
    expect([r.status, r.stdout]).toEqual([0, ""]);
  });

  test("below the brake, a Read that would cross 90k is narrowed to the lines that fit, with a note on where to continue", () => {
    const { run, log, main } = fixture([request("claude-haiku-5-5", 69_000)]);
    const big = join(main, "..", "big.md");
    writeFileSync(big, ("y".repeat(99) + "\n").repeat(800));
    expect(readEstimate({ file_path: big })).toBe(40_000);
    expect(Math.abs(readEstimate({ file_path: big, limit: 400 }) - 20_000)).toBeLessThan(50);
    expect(readEstimate({ file_path: join(main, "..", "shot.png") })).toBe(0);
    expect(readEstimate({ file_path: "/nonexistent" })).toBe(0);
    const out = JSON.parse(run({ agent_id: "abc", agent_type: "Explore", tool_name: "Read", tool_input: { file_path: big, offset: 1 } })).hookSpecificOutput;
    // 20k of room at 50 tokens a line: 400 lines, and the Read then lands at 90k at most.
    expect(out).toEqual({ hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { file_path: big, offset: 1, limit: 400 }, additionalContext: narrowNote(400) });
    expect(70_000 + readEstimate({ file_path: big, limit: 400 })).toBeLessThanOrEqual(90_000);
    expect(readFileSync(log, "utf8")).toMatch(/ sess-123 Explore narrow claude-haiku-5-5 70000\+40000 limit=400\n$/);
    expect(run({ agent_id: "abc", tool_name: "Read", tool_input: { file_path: big, limit: 300 } })).toBe("");
    expect(run({ agent_id: "abc", tool_name: "Grep", tool_input: { file_path: big } })).toBe("");
  });

  test("tool results written after the last request count, since the current request may not be in the transcript yet", () => {
    const result = JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", content: "z".repeat(19_996) }] }, toolUseResult: { file: "z".repeat(19_996) } });
    const text = [request("claude-haiku-5-5", 50_000), result].join("\n");
    // Only message.content counts (toolUseResult repeats it): ~20 KB is ~10k tokens.
    expect(Math.abs(pendingTokens(text) - 10_000)).toBeLessThan(100);
    expect(pendingTokens([result, request("claude-haiku-5-5", 50_000)].join("\n"))).toBe(0);
    const { run, log } = fixture([request("claude-haiku-5-5", 69_000), result]);
    const big = join(log, "..", "..", "..", "big.md");
    mkdirSync(join(big, ".."), { recursive: true });
    writeFileSync(big, ("y".repeat(99) + "\n").repeat(800));
    // 70k + ~10k pending leaves ~10k of room: about 200 lines, not the 400 that 70k alone allows.
    const limit = JSON.parse(run({ agent_id: "abc", tool_name: "Read", tool_input: { file_path: big } })).hookSpecificOutput.updatedInput.limit;
    expect(limit).toBeGreaterThan(190);
    expect(limit).toBeLessThan(205);
  });

  test("the narrowed limit is measured on the lines the Read returns, from its offset", () => {
    const { main } = fixture([]);
    const mixed = join(main, "..", "mixed.md");
    // 500 short lines, then 500 lines ten times denser.
    writeFileSync(mixed, ("s".repeat(19) + "\n").repeat(500) + ("d".repeat(199) + "\n").repeat(500));
    expect(narrowRead({ file_path: mixed, offset: 501 }, 5_000)!.limit).toBe(50);
    expect(narrowRead({ file_path: mixed }, 5_000)!.limit).toBe(500);
    expect(readEstimate({ file_path: mixed, offset: 501, limit: 100 })).toBe(10_000);
  });

  test("a narrowed Read also fits the host's Read cap, and a Read over the cap is narrowed far from 90k", () => {
    const { run, main } = fixture([request("claude-haiku-5-5", 9_000)]);
    const big = join(main, "..", "big.md");
    writeFileSync(big, ("y".repeat(99) + "\n").repeat(1200));
    const out = JSON.parse(run({ agent_id: "abc", tool_name: "Read", tool_input: { file_path: big }, }));
    // 10k + 60k stays under 90k, but 60k is over 0.9 x the 25k default cap = 22.5k: 450 lines at 50 tokens a line.
    expect(out.hookSpecificOutput.updatedInput.limit).toBe(450);
  });

  test("a Read without limit on a file over 256 KB is narrowed even when its tail is small", () => {
    const { run, main } = fixture([request("claude-haiku-5-5", 9_000)]);
    const big = join(main, "..", "big.md");
    writeFileSync(big, ("y".repeat(99) + "\n").repeat(3000));
    // From line 2901: 100 lines, ~5k tokens, far from 90k and the token cap; the host still refuses it without a limit.
    const out = JSON.parse(run({ agent_id: "abc", tool_name: "Read", tool_input: { file_path: big, offset: 2901 } }));
    expect(out.hookSpecificOutput.updatedInput).toEqual({ file_path: big, offset: 2901, limit: 100 });
    expect(run({ agent_id: "abc", tool_name: "Read", tool_input: { file_path: big, offset: 2901, limit: 100 } })).toBe("");
    // Past the end (probe: a scout asked for the line after the last one): limit 1, never a deny.
    expect(JSON.parse(run({ agent_id: "abc", tool_name: "Read", tool_input: { file_path: big, offset: 3001 } })).hookSpecificOutput.updatedInput.limit).toBe(1);
    expect(JSON.parse(run({ agent_id: "abc", tool_name: "Read", tool_input: { file_path: big, offset: 2996 } })).hookSpecificOutput.updatedInput.limit).toBe(5);
  });

  test("when fewer than 20 lines fit, the Read is denied with a narrower-range reason", () => {
    const { run, log, main } = fixture([request("claude-haiku-5-5", 88_500)]);
    const big = join(main, "..", "big.md");
    writeFileSync(big, ("y".repeat(99) + "\n").repeat(800));
    const out = JSON.parse(run({ agent_id: "abc", agent_type: "Explore", tool_name: "Read", tool_input: { file_path: big } }));
    expect(out.hookSpecificOutput.permissionDecisionReason).toBe(readReason(89_500, 40_000));
    expect(readFileSync(log, "utf8")).toMatch(/ sess-123 Explore read claude-haiku-5-5 89500\+40000\n$/);
  });

  test("a subagent without a transcript is logged as a miss and passes", () => {
    const { run, log } = fixture([]);
    expect(run({ agent_id: "zzz", agent_type: "Explore" })).toBe("");
    expect(readFileSync(log, "utf8")).toMatch(/ sess-123 Explore miss - -\n$/);
  });
});
