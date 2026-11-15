import { describe, expect, it } from "bun:test";
import type { Event } from "../../hooks/lib/critic-events";
import { criticRun, firstIdxSince, isHeadlessTranscript, replayStops, runCost, summarizeGateLog, summarizeReviews } from "../critic-report";

const review = (id: string, idx: number, body: string, model = "claude-opus-5-5"): Event[] => [
  { kind: "spawn", idx, id, type: "critic", async: true, resolvedModel: model },
  { kind: "result", idx: idx + 1, id, status: "completed", text: body },
];

describe("summarizeReviews", () => {
  it("counts modes, verdicts, severities, perspectives and how each finding was answered", () => {
    const events: Event[] = [
      ...review("t1", 0, "REVIEW-ID: plan-abc\nVERDICT: BLOCK\nH1 [blocker] [Path] x\nH2 [minor] [Style and repository rules] y\nH3 [major] [reuse] z\nH4 [major] [reuse] w"),
      { kind: "text", idx: 2, text: "| H1 | ✅ aceptado | fixed |\n| H2 | ❌ rechazado: evidence |\n| H4 | ❌ en disputa | a.ts:3 ya lo cubre |" },
      ...review("t2", 3, "REVIEW-ID: feature-abc\nVERDICT: PROCEED\nH1 [minor] [style] x\nHOLDS: ok", "claude-sonnet-5-5"),
      ...review("t3", 5, "REVIEW-ID: feature-abd\nVERDICT: PROCEED\nHOLDS: ok"),
    ];
    expect(summarizeReviews([events])).toEqual({
      reviews: 3,
      byMode: { plan: 1, feature: 2 },
      byVerdict: { BLOCK: 1, PROCEED: 2 },
      bySeverity: { blocker: 1, minor: 2, major: 2 },
      byPerspective: { path: 1, style: 2, reuse: 2 },
      noBlockerOrMajor: 2,
      answers: { accepted: 1, disputed: 1, minorsDeclined: 1, unanswered: 2 },
      offModel: 1,
    });
  });

  it("ignores other agents and answers given before the delivery", () => {
    const events: Event[] = [
      { kind: "text", idx: 0, text: "| H1 | ✅ aceptado | early |" },
      ...review("t1", 1, "REVIEW-ID: feature-abc\nVERDICT: REVISE\nH1 [minor] [Style] x"),
      { kind: "spawn", idx: 3, id: "t2", type: "general-purpose", async: true },
      { kind: "result", idx: 4, id: "t2", status: "completed", text: "VERDICT: BLOCK\nH1 [blocker] [Path] x" },
    ];
    const r = summarizeReviews([events]);
    expect(r.reviews).toBe(1);
    expect(r.answers).toEqual({ accepted: 0, disputed: 0, minorsDeclined: 0, unanswered: 1 });
  });
});

describe("criticRun", () => {
  it("sums tokens once per message and counts each advisor block once, in any record of it", () => {
    const usage = { input_tokens: 10, cache_creation_input_tokens: 5, cache_read_input_tokens: 100, output_tokens: 7 };
    const lines = [
      JSON.stringify({ type: "attachment", attachment: { type: "advisor_tool", available: true } }),
      JSON.stringify({ type: "assistant", message: { id: "m1", usage, content: [{ type: "text", text: "x" }] } }),
      JSON.stringify({ type: "assistant", message: { id: "m1", usage, content: [{ type: "server_tool_use", id: "s1", name: "advisor" }] } }),
      JSON.stringify({ type: "assistant", message: { id: "m1", usage, content: [{ type: "server_tool_use", id: "s1", name: "advisor" }] } }),
      JSON.stringify({ type: "assistant", message: { id: "m2", usage, content: [{ type: "tool_use", name: "Read" }] } }),
      "not json",
    ];
    expect(criticRun(lines)).toEqual({ advisorCalls: 1, fresh: 20, cacheWrite: 10, cacheRead: 200, output: 14 });
  });

  it("prices each token tier on its own", () => {
    expect(runCost({ advisorCalls: 0, fresh: 1e6, cacheWrite: 1e6, cacheRead: 1e6, output: 1e6 })).toBeCloseTo(36.75);
  });
});

describe("replayStops", () => {
  it("counts turns with edits and the ones the Stop gate blocks", () => {
    const events: Event[] = [
      { kind: "prompt", idx: 0 },
      { kind: "edit", idx: 1, path: "/r/a.ts", lines: 5 },
      ...review("c1", 2, "REVIEW-ID: feature-x\nVERDICT: REVISE\nH1 [minor] [Style] x"),
      { kind: "text", idx: 4, text: "| H1 | ✅ aceptado | hecho |" },
      { kind: "prompt", idx: 5 },
      { kind: "prompt", idx: 6 },
      { kind: "edit", idx: 7, path: "/r/a.ts", lines: 5 },
      // A courier turn is a turn of its own; a turn that only edits working notes is not counted.
      { kind: "wake", idx: 8 },
      { kind: "edit", idx: 9, path: "/r/a.ts", lines: 5 },
      { kind: "prompt", idx: 10 },
      { kind: "edit", idx: 11, path: "/Users/x/.claude/plans/p.md", lines: 5 },
    ];
    expect(replayStops(events)).toEqual({ turns: 3, blocks: 2, blocked: [6, 8], sizes: [5, 5] });
    expect(replayStops([{ kind: "prompt", idx: 0, text: "brief [critic-gate: off]" }, ...events])).toEqual({ turns: 0, blocks: 0, blocked: [], sizes: [] });
  });

  it("starts the window at the first record inside it, 1-based like the event idx, or skips the session", () => {
    const lines = ['{"timestamp":"2026-11-09T10:00:00Z"}', '{"type":"permission-mode"}', '{"timestamp":"2026-11-11T10:00:00Z"}'];
    expect(firstIdxSince(lines, Date.parse("2026-11-10T00:00:00Z"))).toBe(3);
    expect(firstIdxSince(lines, Date.parse("2026-11-12T00:00:00Z"))).toBe(Infinity);
  });

  it("recognises a headless transcript by its entrypoint", () => {
    expect(isHeadlessTranscript(['{"entrypoint":"sdk-cli"}'])).toBe(true);
    expect(isHeadlessTranscript(['{"entrypoint":"cli"}', '{"entrypoint":"claude-desktop"}'])).toBe(false);
  });
});

describe("summarizeGateLog", () => {
  it("groups decisions by kind and outcome inside the window", () => {
    const lines = [
      "2026-11-01T10:00:00.000Z abcd1234 plan deny Critic gate (plan): no review",
      "2026-11-10T10:00:00.000Z abcd1234 plan allow",
      "2026-11-10T10:01:00.000Z abcd1234 feature:f1,f2 deny Critic gate (feature f1, f2): x",
      "2026-11-10T10:02:00.000Z abcd1234 close warn",
      "2026-11-10T10:03:00.000Z abcd1234 optout allow",
      "",
    ];
    expect(summarizeGateLog(lines, Date.parse("2026-11-05T00:00:00Z"))).toEqual({ "plan allow": 1, "feature deny": 1, "close warn": 1, "optout allow": 1 });
  });
});
