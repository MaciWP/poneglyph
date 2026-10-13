import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bashFamily, collectTranscripts, contextRow, parseTranscript, percentile, summarizeContext, summarizeTools } from "../usage-profile";

const asst = (ctx: number, out = 100, model = "claude-fable-5-1", content: unknown[] = []) =>
  JSON.stringify({ type: "assistant", message: { model, usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: ctx - 10, output_tokens: out }, content } });
const toolUse = (id: string, name: string, input: Record<string, unknown>) => ({ type: "tool_use", id, name, input });
const result = (id: string, text: string) => JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: text }] } });

describe("usage-profile, parseTranscript", () => {
  it("reads assistant usage and attributes tool_result chars to the tool and Bash family that produced them", () => {
    const t = parseTranscript([
      asst(50_000, 20, "claude-opus-5", [toolUse("a", "Bash", { command: 'cd "/x" && cat plan.md' }), toolUse("b", "Read", { file_path: "f" })]),
      result("a", "x".repeat(300)),
      result("b", "y".repeat(50)),
      "not json",
      JSON.stringify({ type: "summary", summary: "ignored" }),
      asst(60_000),
    ]);
    expect(t.messages).toEqual([{ model: "claude-opus-5", ctx: 50_000, out: 20 }, { model: "claude-fable-5-1", ctx: 60_000, out: 100 }]);
    expect(t.tools).toEqual([{ tool: "Bash", family: "cat", chars: 300 }, { tool: "Read", family: "", chars: 50 }]);
  });

  it("counts one API response once although the transcript writes one line per content block", () => {
    const block = (content: unknown[]) => asst(80_000, 30, "claude-opus-5", content).replace('"message":{', '"message":{"id":"msg_1",');
    const t = parseTranscript([block([{ type: "thinking" }]), block([toolUse("a", "Read", {})]), result("a", "z".repeat(40))]);
    expect(t.messages).toEqual([{ model: "claude-opus-5", ctx: 80_000, out: 30 }]);
    expect(t.tools).toEqual([{ tool: "Read", family: "", chars: 40 }]);
  });

  it("does not count base64 image data as tool output chars", () => {
    const img = JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: [{ type: "image", source: { type: "base64", data: "A".repeat(90_000) } }, { type: "text", text: "caption" }] }] } });
    const t = parseTranscript([asst(1000, 1, "m", [toolUse("a", "Read", {})]), img]);
    expect(t.tools[0].chars).toBeLessThan(200);
  });
});

describe("usage-profile, bashFamily", () => {
  it("strips a leading cd, keeps git/gh/bun subcommands and names echo-composites by their first word", () => {
    expect(bashFamily('cd "D:/x" && git status --short')).toBe("git status");
    expect(bashFamily("cat .claude/plan.md")).toBe("cat");
    expect(bashFamily('echo "=== a ===" && git diff')).toBe("echo");
    expect(bashFamily("bun test ./.claude/")).toBe("bun test");
    expect(bashFamily("git -C x log")).toBe("git");
    expect(bashFamily('P="/c/Users/x/pi" && ls "$P"')).toBe("ls");
    expect(bashFamily("FOO=1 bun test ./x")).toBe("bun test");
  });
});

describe("usage-profile, summaries", () => {
  it("percentile is nearest-rank on a sorted list", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(percentile([1, 2, 3, 4], 0.9)).toBe(3);
    expect(percentile([], 0.5)).toBe(0);
  });

  it("summarizeContext: shares above the cap, top-session share and the first-turn floor", () => {
    const big = parseTranscript([asst(50_000), asst(250_000), asst(450_000), asst(650_000)]); // 1.4M ctx
    const small = parseTranscript([asst(40_000), asst(60_000), asst(80_000)]);
    const s = summarizeContext([big, small], 200_000);
    expect(s.sessions).toBe(2);
    expect(s.messages).toBe(7);
    expect(s.overCap).toBe(3);
    expect(s.overCapShare).toBeCloseTo(3 / 7, 5);
    expect(s.overCapTokenShare).toBeCloseTo(1_350_000 / 1_580_000, 5);
    expect(s.floorP50).toBe(40_000); // floors 40k, 50k → nearest-rank p50 on two values is the lower one
    expect(s.topSessionShare).toBeGreaterThan(0.8);
  });

  it("classifies mid-session cache rewrites by compaction, pause beyond the cache TTL, or neither", () => {
    const at = (min: number, cc: number, cr: number, id: string) => JSON.stringify({ type: "assistant", timestamp: new Date(min * 60_000).toISOString(), message: { id, model: "m", usage: { input_tokens: 1, cache_creation_input_tokens: cc, cache_read_input_tokens: cr, output_tokens: 1, cache_creation: { ephemeral_1h_input_tokens: cc } } } });
    const t = parseTranscript([
      at(0, 60_000, 0, "a"), // first turn: building the cache is not a rewrite
      at(1, 1_000, 60_000, "b"),
      JSON.stringify({ type: "system", subtype: "compact_boundary" }),
      at(2, 40_000, 20_000, "c"),
      at(90, 70_000, 20_000, "d"),
      at(91, 80_000, 20_000, "e"),
    ]);
    expect(t.rewrites).toEqual([{ cause: "compact", tokens: 40_000 }, { cause: "pause", tokens: 70_000 }, { cause: "other", tokens: 80_000 }]);
    expect(summarizeContext([t]).rewriteTokens).toEqual({ compact: 40_000, pause: 70_000, other: 80_000 });
  });

  it("summarizeTools orders by chars, Bash families only for Bash", () => {
    const t = parseTranscript([asst(1000, 1, "m", [toolUse("a", "Bash", { command: "cat f" }), toolUse("b", "Bash", { command: "git status" }), toolUse("c", "Read", {})]), result("a", "x".repeat(30)), result("b", "y".repeat(10)), result("c", "z".repeat(20))]);
    const { byTool, byFamily } = summarizeTools([t]);
    expect(byTool).toEqual([["Bash", 40], ["Read", 20]]);
    expect(byFamily).toEqual([["cat", 30], ["git status", 10]]);
  });

  it("contextRow reproduces the 2026-09-09 baseline as a warning and a healthy week as green", () => {
    const baseline = { sessions: 122, messages: 3785, totalTokens: 1e9, p50: 193_735, p90: 584_988, overCap: 1854, overCapShare: 0.487, overCapTokenShare: 0.807, topSessionShare: 0.519, floorP50: 50_804, rewriteTokens: { pause: 18_000_000, compact: 25_000_000, other: 0 } };
    const warn = contextRow(baseline, 200_000); // the baseline was measured against the 200k ceiling
    expect(warn.status).toBe("🟡");
    expect(warn.detail).toContain("49 % of msgs above 200k carry 81 % of context");
    expect(warn.detail).toContain("long sessions are the spend");
    expect(warn.detail).toContain("cache rewrites: pause 18000k");
    const healthy = contextRow({ ...baseline, overCapShare: 0.05, overCapTokenShare: 0.1, topSessionShare: 0.2 });
    expect(healthy.status).toBe("🟢");
    expect(contextRow({ ...baseline, messages: 0 }).detail).toBe("no transcripts in the window");
    expect(contextRow(baseline).detail).toContain("above 300k"); // default cap follows CONTEXT_POLICY
  });
});

describe("usage-profile, collectTranscripts", () => {
  it("returns only .jsonl files modified inside the window, recursively", () => {
    const root = mkdtempSync(join(tmpdir(), "usage-"));
    mkdirSync(join(root, "proj"), { recursive: true });
    writeFileSync(join(root, "proj", "fresh.jsonl"), "");
    writeFileSync(join(root, "proj", "old.jsonl"), "");
    writeFileSync(join(root, "proj", "notes.txt"), "");
    const old = new Date(Date.now() - 30 * 86_400_000);
    utimesSync(join(root, "proj", "old.jsonl"), old, old);
    expect(collectTranscripts(root, 7).map((p) => p.split(/[\\/]/).pop())).toEqual(["fresh.jsonl"]);
  });
});
