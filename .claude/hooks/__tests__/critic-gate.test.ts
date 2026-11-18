import { afterAll, describe, expect, it, setDefaultTimeout } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criticReviews, parseEvents } from "../lib/critic-events";
import { decide, gateEnabled, gateRun, judgePlanExit, judgeStop } from "../critic-gate";
import { SPAWN_TEST_TIMEOUT_MS } from "./spawn-timeout";

setDefaultTimeout(SPAWN_TEST_TIMEOUT_MS);

// Record shapes copied from real Claude Code 2.1.319-2.1.322 transcripts, content trimmed.
const J = (o: unknown) => JSON.stringify(o);
let n = 0;
const spawn = (id: string, type = "critic") =>
  J({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Agent", input: { subagent_type: type, prompt: "brief" } }] } });
const launch = (id: string, model = "claude-opus-5-5") =>
  J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: "launched" }] }, toolUseResult: { status: "async_launched", agentId: `a-${id}`, resolvedModel: model } });
const deliver = (id: string, report: string, status = "completed") =>
  J({ type: "attachment", attachment: { type: "queued_command", commandMode: "task-notification", prompt: `<task-notification>\n<tool-use-id>${id}</tool-use-id>\n<status>${status}</status>\n<result>${report}</result>\n</task-notification>` } });
const report = (mode: string, findings = 1, verdict = "REVISE") =>
  `REVIEW-ID: ${mode}-abc1234\nVERDICT: ${verdict}\n${Array.from({ length: findings }, (_, i) => `H${i + 1} [minor] [Design] x`).join("\n")}\nQUESTIONS: none`;
const answer = (findings = 1) => J({ type: "assistant", message: { content: [{ type: "text", text: Array.from({ length: findings }, (_, i) => `| H${i + 1} | ✅ aceptado | hecho |`).join("\n") }] } });
const edit = (path: string, lines = 1) =>
  J({ type: "assistant", message: { content: [{ type: "tool_use", id: `e${++n}`, name: "Edit", input: { file_path: path, old_string: "x", new_string: Array(lines).fill("y").join("\n") } }] } });
const progress = (id: string, update: object, ok = true) => [
  J({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "mcp__workboard__progress", input: { update } }] } }),
  J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: !ok, content: ok ? "{}" : "denied" }] } }),
];
const prompt = (text = "sigue") => J({ type: "user", message: { role: "user", content: text } });
const mode = (m: string) => J({ type: "permission-mode", permissionMode: m });
const review = (id: string, m = "feature", findings = 1, model = "claude-opus-5-5") => [spawn(id), launch(id, model), deliver(id, report(m, findings)), answer(findings)];
const blocked = (id: string, m = "feature") => [spawn(id), launch(id), deliver(id, report(m, 1, "BLOCK")), answer(1)];
const ev = (...lines: Array<string | string[]>) => parseEvents(lines.flat());

const PLAN = Array(40).fill("line").join("\n");
const PLAN_FILE = "/Users/x/.claude/plans/p.md";
const CODE = "/r/src/a.ts";
const board = (...ids: string[]) => progress(`b${++n}`, { replace: true, tasks: ids.flatMap((f) => [{ id: f, title: f, state: "pending" }, { id: `${f}-1`, title: "s", parent: f, state: "pending" }]) });

describe("judgePlanExit", () => {
  it("denies with no plan review", () => {
    const v = judgePlanExit(ev(mode("plan"), edit(PLAN_FILE, 40)));
    expect(v.allow).toBe(false);
    if (!v.allow) expect(v.reason).toMatch(/no completed `plan-` review/);
  });

  it("allows after an answered plan review, and after later fixes in the same turn", () => {
    expect(judgePlanExit(ev(edit(PLAN_FILE, 40), review("c1", "plan"))).allow).toBe(true);
    expect(judgePlanExit(ev(edit(PLAN_FILE, 40), review("c1", "plan"), edit(PLAN_FILE, 12))).allow).toBe(true);
  });

  it("re-arms only after a BLOCK, and at most twice per turn", () => {
    expect(judgePlanExit(ev(edit(PLAN_FILE, 40), review("c1", "plan"), edit(PLAN_FILE, 40))).allow).toBe(true);
    expect(judgePlanExit(ev(edit(PLAN_FILE, 40), blocked("c1", "plan"), edit(PLAN_FILE, 1))).allow).toBe(false);
    expect(judgePlanExit(ev(prompt(), edit(PLAN_FILE, 40), blocked("c1", "plan"), edit(PLAN_FILE, 5), blocked("c2", "plan"), edit(PLAN_FILE, 5))).allow).toBe(true);
  });

  it("a plan written in a later turn needs its own review, the cap resets each turn, and the cap warns", () => {
    expect(judgePlanExit(ev(prompt(), edit(PLAN_FILE, 40), review("c1", "plan"), prompt(), edit(PLAN_FILE, 40))).allow).toBe(false);
    expect(judgeStop(ev(prompt(), edit(CODE, 10), blocked("c1"), edit(CODE, 5), blocked("c2"), prompt(), edit(CODE, 5), blocked("c3"), edit(CODE, 1)), false).allow).toBe(false);
    expect(judgePlanExit(ev(prompt(), edit(PLAN_FILE, 40), blocked("c1", "plan"), edit(PLAN_FILE, 5), blocked("c2", "plan"), prompt(), edit(PLAN_FILE, 5), blocked("c3", "plan"), edit(PLAN_FILE, 1))).allow).toBe(false);
    const capped = judgeStop(ev(prompt(), edit(CODE, 10), blocked("c1"), edit(CODE, 5), blocked("c2"), edit(CODE, 5)), false);
    expect(capped).toMatchObject({ allow: true, note: expect.stringMatching(/Tope de revisiones/) });
  });

  it("reads answer rows in the plan ExitPlanMode submits, written by any tool after the delivery", () => {
    const call = (id: string, name: string, input: object) => [
      J({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } }),
      J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] } }),
    ];
    const ROWS = "## Critic answers\n| H1 | ✅ aceptado | hecho |";
    const PLAN_TEXT = `# Plan\nstep one\n${ROWS}`;
    const plan = (id: string) => [spawn(id), launch(id), deliver(id, report("plan"))];
    const script = (id: string) => call(id, "Bash", { command: `python3 - <<'EOF'\nopen('${PLAN_FILE}','a').write("""${ROWS}""")\nEOF` });
    // Written by a script the gate cannot parse: the submitted plan carries the rows.
    expect(judgePlanExit(ev(edit(PLAN_FILE, 40), plan("c1"), script("s1")), PLAN_TEXT).allow).toBe(true);
    // No plan text and no visible rows: still denied.
    expect(judgePlanExit(ev(edit(PLAN_FILE, 40), plan("c1"), script("s2"))).allow).toBe(false);
    // Rows already written before the delivery are an earlier review's.
    expect(judgePlanExit(ev(edit(PLAN_FILE, 40), script("s3"), plan("c1")), PLAN_TEXT).allow).toBe(false);
    // An earlier exit carried these rows: the next review needs its own.
    expect(judgePlanExit(ev(prompt(), edit(PLAN_FILE, 40), plan("c1"), call("x1", "ExitPlanMode", { plan: PLAN_TEXT }),
      prompt(), edit(PLAN_FILE, 5), plan("c2")), PLAN_TEXT).allow).toBe(false);
    // Adding only rows in a later turn answers the review; it is not a plan change needing another.
    const rowsEdit = call("e1", "Edit", { file_path: PLAN_FILE, old_string: "step one", new_string: `step one\n${ROWS}` });
    expect(judgePlanExit(ev(prompt(), edit(PLAN_FILE, 40), plan("c1"), prompt(), rowsEdit), PLAN_TEXT).allow).toBe(true);
    // A ❌ in the plan without evidence does not count.
    expect(judgePlanExit(ev(edit(PLAN_FILE, 40), plan("c1")), "| H1 | ❌ en disputa |").allow).toBe(false);
    // A plan row with evidence replaces a visible bare ❌; a literal `\n` in that evidence does not cut it.
    const said = J({ type: "assistant", message: { content: [{ type: "text", text: "| H1 | ❌ en disputa |" }] } });
    expect(judgePlanExit(ev(edit(PLAN_FILE, 40), plan("c1"), said), '| H1 | ❌ en disputa | rowLines splits on "\\n" at a.ts:3 |').allow).toBe(true);
    // The deny says why a row the Lead can see in the plan does not count.
    const repeated = judgePlanExit(ev(edit(PLAN_FILE, 40), script("s4"), plan("c1")), PLAN_TEXT);
    expect(!repeated.allow && repeated.reason).toContain("rows for H1 repeat rows written before this review");
    // The hook reads the plan from the payload: without it the same session is denied.
    const events = ev(edit(PLAN_FILE, 40), plan("c1"), script("s5"));
    const exit = (tool_input: Record<string, unknown>) => decide({ hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input }, events);
    expect(exit({ plan: PLAN_TEXT })).toEqual({ out: "", log: "plan:rows1 allow" });
    expect(exit({}).log).toStartWith("plan:rows0 deny");
  });

  it("a feature or doubt review does not open the plan gate", () => {
    expect(judgePlanExit(ev(review("c1", "feature"))).allow).toBe(false);
    expect(judgePlanExit(ev(review("c1", "doubt"))).allow).toBe(false);
  });

  it("denies on unanswered findings and names them", () => {
    const v = judgePlanExit(ev(spawn("c1"), launch("c1"), deliver("c1", report("plan", 2)), answer(1)));
    expect(v.allow).toBe(false);
    if (!v.allow) expect(v.reason).toMatch(/H2 have no answer row/);
  });

  it("tells the Lead, on every plan deny but not at Stop, where rows are seen", () => {
    const order = /Write the rows into the plan file/;
    const relaunch = /Launch the `critic`/;
    const none = judgePlanExit(ev());
    const unanswered = judgePlanExit(ev(spawn("c1"), launch("c1"), deliver("c1", report("plan", 1))));
    const rewritten = judgePlanExit(ev(edit(PLAN_FILE, 40), blocked("c1", "plan"), edit(PLAN_FILE, 13)));
    for (const [v, relaunches] of [[none, true], [unanswered, false], [rewritten, true]] as const) {
      expect(v.allow).toBe(false);
      if (!v.allow) expect(v.reason).toMatch(order);
      // Missing rows ask for the rows; a relaunch there would only add a second review.
      if (!v.allow) expect(relaunch.test(v.reason)).toBe(relaunches);
    }
    const rowsAtStop = judgeStop(ev(prompt(), edit(CODE, 30), spawn("c2"), launch("c2"), deliver("c2", report("feature", 1))), false);
    expect(rowsAtStop.allow).toBe(false);
    if (!rowsAtStop.allow) expect(relaunch.test(rowsAtStop.reason)).toBe(false);
    const stop = judgeStop(ev(prompt(), edit(CODE, 30)), false);
    if (!stop.allow) expect(stop.reason).not.toMatch(order);
    expect(stop.allow).toBe(false);
  });

  it("asks only for rows when rows alone close the gap, never when edits need a new review", () => {
    const relaunch = /Launch the `critic`/;
    const unanswered = [spawn("c1"), launch("c1"), deliver("c1", report("feature", 1))];
    const rowsOnly = judgeStop(ev(prompt(), edit(CODE, 30), ...unanswered), false);
    const laterTurn = judgeStop(ev(prompt(), edit(CODE, 30), ...unanswered, prompt(), edit(CODE, 200)), false);
    const disputed = J({ type: "assistant", message: { content: [{ type: "text", text: "| H1 | ❌ en disputa | |" }] } });
    const noEvidence = judgePlanExit(ev(spawn("c2"), launch("c2"), deliver("c2", report("plan", 1)), disputed));
    const blockFixed = judgeStop(ev(prompt(), edit(CODE, 50), spawn("c4"), launch("c4"), deliver("c4", report("feature", 1, "BLOCK")), edit(CODE, 21)), false);
    const planRewritten = judgePlanExit(ev(edit(PLAN_FILE, 40), spawn("c3"), launch("c3"), deliver("c3", report("plan", 1, "BLOCK")), edit(PLAN_FILE, 13)));
    for (const [v, relaunches] of [[rowsOnly, false], [laterTurn, true], [noEvidence, false], [blockFixed, true], [planRewritten, true]] as const) {
      expect(v.allow).toBe(false);
      if (!v.allow) expect(relaunch.test(v.reason)).toBe(relaunches);
    }
  });

  it("re-reads a plan deny once and logs it when the rows arrived meanwhile", async () => {
    const reviewed = [spawn("r1"), launch("r1"), deliver("r1", report("plan", 1))];
    const reads = [ev(...reviewed), ev(...reviewed, answer(1))];
    const waits: number[] = [];
    const payload = { hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input: { plan: PLAN } };
    const r = await gateRun(payload, () => reads.shift()!, async (ms) => waits.push(ms));
    expect(r).toEqual({ out: "", log: "plan:rows0 allow reread" });
    expect(waits).toEqual([300]);
    const still = await gateRun(payload, () => ev(...reviewed), async () => {});
    expect(still.log).toStartWith("plan:rows0 deny");
    expect(still.log).not.toContain("reread");
    let calls = 0;
    const broken = await gateRun(payload, () => (calls++ ? (() => { throw new Error("gone"); })() : ev(...reviewed)), async () => {});
    expect(broken.log).toStartWith("plan:rows0 deny");
    const stop = await gateRun({ hook_event_name: "Stop" }, () => ev(prompt(), edit(CODE, 30)), async (ms) => waits.push(ms));
    expect(JSON.parse(stop.out).decision).toBe("block");
    expect(waits).toEqual([300]);
  });

  it("denies a review that ran on the wrong model", () => {
    const v = judgePlanExit(ev(review("c1", "plan", 1, "claude-haiku-5-5")));
    if (!v.allow) expect(v.reason).toMatch(/claude-haiku-5-5/);
    if (!v.allow) expect(v.reason).toMatch(/Launch the `critic`/);
    expect(v.allow).toBe(false);
  });

  it("a cancelled critic is not a review", () => {
    expect(judgePlanExit(ev(spawn("c1"), launch("c1"), deliver("c1", report("plan"), "killed"))).allow).toBe(false);
  });
});

describe("judgeStop coverage", () => {
  const stop = (...lines: Array<string | string[]>) => judgeStop(ev(prompt(), ...lines), false).allow;

  it("allows after an answered feature review and later fixes after a REVISE", () => {
    expect(stop(edit(CODE, 50), review("c1"), edit(CODE, 15))).toBe(true);
  });

  it("blocks when the feature review is unanswered or of another mode", () => {
    expect(stop(edit(CODE, 50), spawn("c1"), launch("c1"), deliver("c1", report("feature", 2)), answer(1))).toBe(false);
    expect(stop(edit(CODE, 50), review("c1", "doubt"))).toBe(false);
  });

  it("covers fixes of any size after PROCEED or REVISE, and asks for one more review after a BLOCK", () => {
    expect(stop(edit(CODE, 50), review("c1"), edit(CODE, 200))).toBe(true);
    expect(stop(edit(CODE, 50), blocked("c1"), edit(CODE, 1))).toBe(false);
  });

  it("caps reviews at two per turn: a second BLOCK does not ask for a third", () => {
    expect(judgeStop(ev(prompt(), edit(CODE, 10), blocked("c1"), edit(CODE, 5), blocked("c2"), edit(CODE, 5)), false).allow).toBe(true);
  });

  it("plan, memory and scratch edits need no review", () => {
    expect(stop(edit(PLAN_FILE, 10), edit("/Users/x/.claude/projects/p/memory/m.md", 5), edit("/private/tmp/claude-501/x/scratchpad/a.ts", 9))).toBe(true);
  });
});

describe("judgeStop", () => {
  it("allows a turn with no edits", () => {
    expect(judgeStop(ev(prompt("hola")), false).allow).toBe(true);
  });

  it("blocks a turn that edited code with no review", () => {
    expect(judgeStop(ev(prompt(), edit(CODE, 30)), false).allow).toBe(false);
  });

  it("lets the turn end on the retry, with a note for the user", () => {
    const v = judgeStop(ev(prompt(), edit(CODE, 30)), true);
    expect(v).toMatchObject({ allow: true, note: expect.stringMatching(/Cierre sin revisar/) });
  });

  it("never blocks in plan mode or while an agent is still running", () => {
    expect(judgeStop(ev(mode("plan"), edit(CODE, 30)), false).allow).toBe(true);
    expect(judgeStop(ev(edit(CODE, 30), spawn("c1"), launch("c1")), false).allow).toBe(true);
  });

  it("gates a turn while a workboard feature is still open", () => {
    expect(judgeStop(ev(board("f1"), prompt(), edit(CODE, 30)), false).allow).toBe(false);
  });

  it("does not treat a feature close as covering the edits before it", () => {
    const e = ev(board("f1"), prompt(), edit(CODE, 300), progress("p1", { tasks: [{ id: "f1", state: "completed" }] }), edit(CODE, 30));
    expect(judgeStop(e, false).allow).toBe(false);
  });

  it("skips the close for 20 unreviewed lines or fewer, counted since the last review", () => {
    expect(judgeStop(ev(prompt(), edit(CODE, 20)), false)).toEqual({ allow: true, small: true });
    expect(judgeStop(ev(prompt(), edit(CODE, 21)), false).allow).toBe(false);
    // A run of small turns adds up: the second one is gated.
    expect(judgeStop(ev(prompt(), edit(CODE, 15), prompt(), edit(CODE, 15)), false).allow).toBe(false);
    // After an answered review the count restarts.
    expect(judgeStop(ev(prompt(), edit(CODE, 50), review("c1"), prompt(), edit(CODE, 15)), false)).toEqual({ allow: true, small: true });
    expect(judgeStop(ev(prompt(), edit(CODE, 50), review("c1"), edit(CODE, 10), prompt(), edit(CODE, 15)), false).allow).toBe(false);
    // Never past unanswered findings or a BLOCK waiting for its fix review.
    const unanswered = [spawn("c1"), launch("c1"), deliver("c1", report("feature", 1))];
    expect(judgeStop(ev(prompt(), edit(CODE, 5), ...unanswered), false).allow).toBe(false);
    expect(judgeStop(ev(prompt(), edit(CODE, 50), ...unanswered, prompt(), edit(CODE, 5)), false).allow).toBe(false);
    expect(judgeStop(ev(prompt(), edit(CODE, 50), blocked("c1"), prompt(), edit(CODE, 5)), false).allow).toBe(false);
    // A shell write's size is an estimate: it is never small.
    const sed = J({ type: "assistant", message: { content: [{ type: "tool_use", id: "s9", name: "Bash", input: { command: "sed -i '' s/requireAuth/noop/g /r/src/a.ts" } }] } });
    expect(judgeStop(ev(prompt(), sed), false).allow).toBe(false);
    // The plan gate has no size exemption.
    expect(judgePlanExit(ev(mode("plan"), edit(PLAN_FILE, 5))).allow).toBe(false);
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 5)))).toEqual({ out: "", log: "close skip-small" });
  });

  it("allows once the review is answered", () => {
    expect(judgeStop(ev(prompt(), edit(CODE, 30), review("c1")), false).allow).toBe(true);
  });
});

describe("decide", () => {
  // Shapes from session 98f9663f and e6e1a5c8, 2026-11-10.
  const notFound = (id: string) => J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: true, content: "Agent type 'critic' not found. Available agents: claude, Explore" }] }, toolUseResult: "Error: Agent type 'critic' not found." });

  it("fails open with a warning when the session has no critic agent", () => {
    const { out, log } = decide({ hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input: { plan: PLAN } }, ev(mode("plan"), spawn("c1"), notFound("c1")));
    expect(JSON.parse(out).systemMessage).toMatch(/Crítico no disponible/);
    expect(log).toMatch(/^plan:rows0 warn/);
    expect(decide({ hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input: { plan: PLAN } }, ev(mode("plan"), spawn("c1"), launch("c1"))).out).toMatch(/deny/);
  });

  it("reads the answer rows from last_assistant_message when the transcript lags at Stop", () => {
    const lines = [prompt(), edit(CODE, 30), spawn("c1"), launch("c1"), deliver("c1", report("feature", 2))];
    expect(decide({ hook_event_name: "Stop" }, ev(...lines)).out).toMatch(/block/);
    expect(decide({ hook_event_name: "Stop", last_assistant_message: "| H1 | ✅ aceptado | a |\n| H2: claim | ❌ en disputa | ya lo cubre a.ts:3 |" }, ev(...lines)).out).toBe("");
  });

  it("fails open on a failed or off-model critic run, but not on one the Lead killed", () => {
    const exit = { hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input: { plan: PLAN } };
    const failed = J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "c1", is_error: true, content: "overloaded" }] } });
    expect(JSON.parse(decide(exit, ev(mode("plan"), spawn("c1"), failed)).out).systemMessage).toMatch(/falló/);
    expect(JSON.parse(decide(exit, ev(mode("plan"), spawn("c1"), launch("c1", "claude-sonnet-5-5"), deliver("c1", report("plan", 1)), answer(1))).out).systemMessage).toMatch(/sonnet/);
    expect(decide(exit, ev(mode("plan"), spawn("c1"), launch("c1"), deliver("c1", "partial", "killed"))).out).toMatch(/deny/);
    // A run cut at its maxTurns is no outage: both gates ask for a relaunch. Text from CC 2.1.326 (a completed result); the is_error form is covered in case a version reports it so.
    const LIMIT = "NOTE: this agent stopped at its 80-turn limit before finishing. It was still calling tools and had produced no report.";
    const cut = J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "c1", is_error: true, content: LIMIT }] } });
    expect(decide(exit, ev(mode("plan"), spawn("c1"), launch("c1"), deliver("c1", LIMIT))).out).toMatch(/deny/);
    expect(decide(exit, ev(mode("plan"), spawn("c1"), cut)).out).toMatch(/deny/);
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), spawn("c1"), cut)).out).toMatch(/block/);
  });

  it("does not fail open on a critic spawn a hook denied: the spawn before it is judged", () => {
    // Shape from session f5ad15a1, 2026-11-12: a hook deny is a tool_result with is_error.
    const denied = (id: string) => J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: true, content: "PreToolUse:Agent hook error: Critic brief refused: it needs `MODE:` as `plan`, `feature` or `doubt`" }] }, toolUseResult: "Error: PreToolUse:Agent hook error: Critic brief refused" });
    const exit = { hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input: { plan: PLAN } };
    expect(decide(exit, ev(mode("plan"), spawn("c1"), denied("c1"))).out).toMatch(/deny/);
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), spawn("c1"), denied("c1"))).out).toMatch(/block/);
    expect(JSON.parse(decide(exit, ev(mode("plan"), spawn("c1"), notFound("c1"), spawn("c2"), denied("c2"))).out).systemMessage).toMatch(/Crítico no disponible/);
    // Nor does it close the answers of the review before it.
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), spawn("c1"), launch("c1"), deliver("c1", report("feature", 1)), spawn("c2"), denied("c2"), answer(1))).out).toBe("");
  });

  it("lets a turn opened by a courier message end when it edited nothing", () => {
    // Shapes from a real 2.1.322 transcript: the courier carries a plugin origin, Stop feedback is meta.
    const courier = J({ type: "user", origin: { kind: "plugin", name: "courier" }, message: { role: "user", content: "The courier plugin sent a message:\n[Agentic OS message x from y] US08 cerrada" } });
    const feedback = J({ type: "user", isMeta: true, message: { role: "user", content: "Stop hook feedback:\nCritic gate (close): x" } });
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), courier)).out).toBe("");
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), feedback)).out).toMatch(/block/);
  });

  it("lets a turn with no edits end after an earlier warned close", () => {
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), prompt("¿qué cambiaste?"))).out).toBe("");
  });

  it("finds the feature review behind a later doubt review", () => {
    const doubt = [spawn("d1"), launch("d1"), deliver("d1", report("doubt", 0, "PROCEED"))];
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), ...review("c1"), ...doubt)).out).toBe("");
  });

  it("needs the choice in the answer row", () => {
    const empty = J({ type: "assistant", message: { content: [{ type: "text", text: "| H1 | | |" }] } });
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), spawn("c1"), launch("c1"), deliver("c1", report("feature", 1)), empty)).out).toMatch(/block/);
  });

  it("does not let a row for H10 answer H1", () => {
    const text = J({ type: "assistant", message: { content: [{ type: "text", text: "| H10 | ✅ aceptado | x |" }] } });
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), spawn("c1"), launch("c1"), deliver("c1", report("feature", 1)), text)).out).toMatch(/block/);
  });

  it("accepts a leading id list, but not an id that only appears in the claim", () => {
    const stop = (row: string) => decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), spawn("c1"), launch("c1"), deliver("c1", report("feature", 10)), J({ type: "assistant", message: { content: [{ type: "text", text: `| H1, H2, H3, H4, H5, H6, H7, H8 | ✅ aceptado | x |\n${row}` }] } }))).out;
    expect(stop("| H9, H10: dos huecos | Aceptado | hecho |")).toBe("");
    expect(stop("| H9/H10 | ✅ aceptado | hecho |")).toBe("");
    expect(stop("| H9: duplica lo de H10 | ✅ aceptado | x |")).toMatch(/H10 have no answer row/);
  });

  it("needs evidence behind a dispute, in any cell after the choice", () => {
    const stop = (row: string) => decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), spawn("c1"), launch("c1"), deliver("c1", report("feature", 1)), J({ type: "assistant", message: { content: [{ type: "text", text: row }] } }))).out;
    expect(stop("| H1 | ❌ en disputa | |")).toMatch(/disputa necesita evidencia/);
    expect(stop("| H1 | ❌ en disputa: el guard ya existe en a.ts:12 |")).toBe("");
    expect(stop("| H1 | ❌ en disputa | el guard ya existe en a.ts:12 |")).toBe("");
  });

  it("does not let a later review's rows answer an earlier one", () => {
    const e = ev(prompt(), edit(CODE, 30), spawn("c1"), launch("c1"), deliver("c1", report("feature", 2)), ...review("c2", "doubt", 2));
    expect(criticReviews(e)[0].unanswered).toEqual(["H1", "H2"]);
  });

  it("is off, and logs it, for a session whose first prompt opts out", () => {
    expect(decide({ hook_event_name: "Stop" }, ev(prompt("Tarea US02. [critic-gate: off]"), edit(CODE, 30)))).toEqual({ out: "", log: "optout allow" });
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), J({ type: "assistant", message: { content: [{ type: "text", text: "[critic-gate: off]" }] } }))).out).toMatch(/block/);
    // A brief or these docs pasted into a later prompt do not disarm the gate.
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), prompt("mira esto: [critic-gate: off]"), edit(CODE, 30))).out).toMatch(/block/);
  });

  it("takes the last row with a choice when a finding is restated or answered twice", () => {
    const stop = (text: string) => decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), spawn("c1"), launch("c1"), deliver("c1", report("feature", 1)), J({ type: "assistant", message: { content: [{ type: "text", text } ] } }))).out;
    expect(stop("| H1 | major | el guard falta |\n\n| H1 | ✅ aceptado | hecho |")).toBe("");
    expect(stop("| H1 | ❌ en disputa | |\n| H1 | ✅ aceptado | lo arreglo |")).toBe("");
  });

  it("reads a refusal as a dispute and the choice words as no evidence", () => {
    const stop = (row: string) => decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), spawn("c1"), launch("c1"), deliver("c1", report("feature", 1)), J({ type: "assistant", message: { content: [{ type: "text", text: row }] } }))).out;
    expect(stop("| H1 | ❌ disputed | |")).toMatch(/disputa necesita evidencia/);
    expect(stop("| H1 | ❌ rechazado | |")).toMatch(/disputa necesita evidencia/);
    expect(stop("| H1 | No aceptado | |")).toMatch(/disputa necesita evidencia/);
    expect(stop("| H1 | No aceptado | ya lo cubre a.ts:3 |")).toBe("");
    expect(criticReviews(ev(spawn("c1"), launch("c1"), deliver("c1", report("feature", 1)), J({ type: "assistant", message: { content: [{ type: "text", text: "| H1 | ✅ aceptado (sin disputa) | hecho |" }] } })))[0].answers[0][1]).toBe("accepted");
  });

  it("does not let a message queued mid-turn hide the turn's edits", () => {
    // A peer message that lands mid-turn is a queued attachment, not a new turn.
    const queued = J({ type: "attachment", attachment: { type: "queued_command", origin: { kind: "peer" }, prompt: "informe del worker" } });
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30), queued)).out).toMatch(/block/);
    // Nor does a human message typed while the Lead works; and a fix it asks for stays a fix.
    const typed = J({ type: "attachment", attachment: { type: "queued_command", commandMode: "prompt", prompt: "y revisa también X" } });
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 200), typed)).out).toMatch(/block/);
    expect(decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 100), ...review("c1"), typed, edit(CODE, 2))).out).toBe("");
  });

  it("treats edits in a courier turn after an earlier review as a new turn", () => {
    const courier = J({ type: "user", origin: { kind: "plugin", name: "courier" }, message: { role: "user", content: "US08 cerrada" } });
    const out = decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 100), ...review("c1"), courier, edit(CODE, 25))).out;
    expect(JSON.parse(out).reason).toMatch(/later turn than the last review/);
  });

  it("blocks the real workboard session that had no review (trimmed, anonymised)", () => {
    const lines = readFileSync(join(import.meta.dir, "fixtures", "critic-stop-workboard.jsonl"), "utf8").split("\n");
    const out = decide({ hook_event_name: "Stop" }, parseEvents(lines)).out;
    expect(JSON.parse(out).reason).toMatch(/4 edits \(\d+ lines\) have no critic review/);
  });

  it("emits a PreToolUse deny for ExitPlanMode and logs it", () => {
    const { out, log } = decide({ hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input: { plan: PLAN } }, ev());
    expect(JSON.parse(out).hookSpecificOutput.permissionDecision).toBe("deny");
    expect(log).toMatch(/^plan:rows0 deny/);
  });

  it("emits a Stop block", () => {
    const { out } = decide({ hook_event_name: "Stop" }, ev(prompt(), edit(CODE, 30)));
    expect(JSON.parse(out)).toMatchObject({ decision: "block" });
  });

  it("stays silent and unlogged on a workboard update and an ordinary Stop", () => {
    expect(decide({ hook_event_name: "PreToolUse", tool_name: "mcp__workboard__progress", tool_input: { update: { tasks: [{ id: "f1", state: "completed" }] } } }, ev(prompt(), edit(CODE, 50)))).toEqual({ out: "", log: null });
    expect(decide({ hook_event_name: "Stop" }, ev(prompt()))).toEqual({ out: "", log: null });
  });
});

describe("gateEnabled", () => {
  it("is on by default, off in headless runs, and the variable wins both ways", () => {
    expect(gateEnabled({})).toBe(true);
    expect(gateEnabled({ CLAUDE_CODE_SESSION_ATTENDED: "0" })).toBe(false);
    expect(gateEnabled({ CLAUDE_CODE_ENTRYPOINT: "sdk-ts" })).toBe(false);
    expect(gateEnabled({ PONEGLYPH_CRITIC_GATE: "0" })).toBe(false);
    expect(gateEnabled({ PONEGLYPH_CRITIC_GATE: "1", CLAUDE_CODE_SESSION_ATTENDED: "0" })).toBe(true);
  });
});

describe("stdin contract", () => {
  // A throwaway config dir: the hook's log must never land in the real ~/.claude/learned.
  const home = mkdtempSync(join(tmpdir(), "critic-gate-test-"));
  afterAll(() => rmSync(home, { recursive: true, force: true }));
  const run = async (payload: object, env: Record<string, string> = {}) => {
    const p = Bun.spawn(["bun", `${import.meta.dir}/../critic-gate.ts`], { stdin: new Blob([JSON.stringify({ cwd: home, ...payload })]), stdout: "pipe", env: { ...process.env, PONEGLYPH_CRITIC_GATE: "1", CLAUDE_CONFIG_DIR: home, CLAUDE_PROJECT_DIR: home, ...env } });
    const out = await new Response(p.stdout).text();
    await p.exited;
    return out.trim();
  };
  const transcript = async (lines: string[]) => {
    const path = join(home, `t${++n}.jsonl`);
    await Bun.write(path, lines.join("\n"));
    return path;
  };

  it("denies ExitPlanMode from a real transcript file", async () => {
    const out = await run({ hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input: { plan: PLAN }, transcript_path: await transcript([mode("plan")]) });
    expect(JSON.parse(out).hookSpecificOutput.permissionDecision).toBe("deny");
    const logs = join(home, "learned");
    const log = readdirSync(logs).map((d) => join(logs, d, "critic-gate.log")).find((f) => existsSync(f));
    expect(readFileSync(log!, "utf8")).toContain(" plan:rows0 deny Critic gate (plan)");
  });

  it("is silent inside a subagent, when disabled, and on a missing transcript", async () => {
    const path = await transcript([mode("plan")]);
    const base = { hook_event_name: "PreToolUse", tool_name: "ExitPlanMode", tool_input: { plan: PLAN } };
    expect(await run({ ...base, transcript_path: path, agent_id: "a1" })).toBe("");
    expect(await run({ ...base, transcript_path: path }, { PONEGLYPH_CRITIC_GATE: "0" })).toBe("");
    expect(await run({ ...base, transcript_path: "/nonexistent.jsonl" })).toBe("");
  });
});
