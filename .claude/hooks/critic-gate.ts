#!/usr/bin/env bun

// Critic gates (CLAUDE.md §Agents and skills; brief in dev-workflow references/03-critic-loop.md).
// Two moments need a completed, answered review by the `critic` subagent on claude-opus-5-5:
// - PreToolUse `ExitPlanMode`: deny until a `plan-` review counts.
// - Stop: block the end of a turn that edited files with no `feature-` review, unless an agent is
//   still running or the session is in plan mode. Workboard feature closes are not gated: a
//   settings PreToolUse hook never fired for the mod's `mcp__workboard__progress` tool.
//
// A review stays valid for its fixes until a new turn opens (a human prompt, or a plugin or peer
// message delivered while idle); only a BLOCK asks for one more review of the fix (see `recheck`).
//
// Off when PONEGLYPH_CRITIC_GATE=0, in headless runs unless PONEGLYPH_CRITIC_GATE=1, and in a
// session whose first prompt (an orchestrator's brief) carries `[critic-gate: off]`.
// Each decision is one line (an opted-out session logs `optout`) in `<project>/.claude/learned/critic-gate.log`.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { type CriticMode, criticUnavailable, criticReviews, type Event, gateOptedOut, is, isWorkingNote, lastMode, parseEvents, pendingAgents, PLAN_PATH, type Review, reviewMismatch, rowsProblem, turnStarts } from "./lib/critic-events";
import { readHookStdin } from "./lib/hook-stdin";
import { learnedLog } from "./lib/paths";
import { isHeadlessSession } from "./lib/session-kind";

const ROW = "one row `| H1 | ✅ aceptado / ❌ en disputa | fix or evidence |`.";
const HOW = `Launch the \`critic\` agent (Agent tool, subagent_type \`critic\`, no \`model\` parameter) with the brief from dev-workflow references/03-critic-loop.md, wait for its result, then answer every finding with ${ROW}`;

// Observed, not proven: in 14 days, 3 of 3 plan exits whose only rows shared the calling message
// were denied, and PreToolUse has no `last_assistant_message`; `main` re-reads once to cover it.
// 28 of the 30 exits denied for missing rows in 8 days had no visible rows (thinking or a summary).
const PLAN_ROWS = "Write the rows into the plan file (a `## Critic answers` section, with Edit or Write), then call ExitPlanMode: rows in thinking or in a summary sentence are not seen.";
// The probe saw a visible text block reach the transcript 13 ms after its tool call started.
const REREAD_MS = 300;

export type Verdict = { allow: true; note?: string } | { allow: false; reason: string };

const reviewable = (e: Of<"edit">) => !isWorkingNote(e.path);
type Of<K extends Event["kind"]> = Extract<Event, { kind: K }>;

const sum = (edits: Of<"edit">[]) => edits.reduce((n, e) => n + e.lines, 0);

const MAX_ROUNDS = 2;

/**
 * Whether the fixes after review `r` need one more review: only after a BLOCK, and never past
 * MAX_ROUNDS reviews of that mode in the turn. Fixes after PROCEED or REVISE are covered at any
 * size: the 30 % allowance it replaces made answering findings well trigger the next round (36 of
 * 41 plan reviews in a week repeated). "capped" is a BLOCK fix the cap leaves unreviewed.
 */
function recheck(events: Event[], reviews: Review[], r: Review): "yes" | "capped" | "no" {
  if (r.verdict !== "BLOCK") return "no";
  const turnStart = turnStarts(events).filter((i) => i < r.spawnIdx).at(-1) ?? -1;
  return reviews.filter((x) => x.spawnIdx > turnStart).length < MAX_ROUNDS ? "yes" : "capped";
}

type Gap = { why: string; rows?: true; capped?: true };

/**
 * Whether the session's `target` edits are covered by its last `mode` review.
 * Returns null when covered, else the reason; `rows` when answer rows alone would cover them,
 * so missing rows are checked last and never hide a gap a new review must close; `capped` when
 * only the review cap lets the edits pass, which the caller allows with a visible note.
 */
function coverage(events: Event[], mode: CriticMode, target: (e: Of<"edit">) => boolean): Gap | null {
  const edits = events.filter(is("edit")).filter(target);
  const reviews = criticReviews(events).filter((r) => r.mode === mode);
  const r = reviews.at(-1);
  if (!r && mode === "plan") return { why: "no completed `plan-` review in this session" };
  if (!r) return edits.length ? { why: `${edits.length} edits (${sum(edits)} lines) have no critic review` } : null;
  const mismatch = reviewMismatch(r, mode);
  if (mismatch) return { why: `the last critic review does not count: ${mismatch}` };
  const nextPrompt = turnStarts(events).find((i) => i > r.resultIdx) ?? Infinity;
  const after = edits.filter((e) => e.idx > r.spawnIdx);
  const late = after.filter((e) => e.idx > nextPrompt);
  if (late.length) return { why: `${late.length} edits came in a later turn than the last review` };
  const again = after.length ? recheck(events, reviews, r) : "no";
  if (again === "yes") return { why: `the last review was BLOCK and ${sum(after)} lines changed after it; the fix needs one more review` };
  const rows = rowsProblem(r);
  if (rows) return { why: `the last critic review does not count: ${rows}`, rows: true };
  return again === "capped" ? { why: `the fix of a second BLOCK went unreviewed: ${MAX_ROUNDS} reviews is the cap per turn`, capped: true } : null;
}

// Missing rows need the rows, not a new review: a relaunch for them cost 9c840d3a a second review.
const ANSWER = `Answer every finding with ${ROW}`;
const CAPPED = (why: string): Verdict => ({ allow: true, note: `Tope de revisiones: ${why}. Consulta al usuario con AskUserQuestion.` });
const isPlanEdit = (e: Of<"edit">) => PLAN_PATH.test(e.path);

export function judgePlanExit(events: Event[]): Verdict {
  const gap = coverage(events, "plan", isPlanEdit);
  if (!gap) return { allow: true };
  if (gap.capped) return CAPPED(gap.why);
  return { allow: false, reason: `Critic gate (plan): ${gap.why}. ${gap.rows ? ANSWER : HOW} ${PLAN_ROWS}` };
}

export function judgeStop(events: Event[], stopHookActive: boolean): Verdict {
  if (lastMode(events) === "plan" || pendingAgents(events).length) return { allow: true };
  // Only a turn that edited something is gated; a question after a warned close is not.
  // A courier message opens a turn too: without this, every message re-blocks old edits.
  const turnStart = turnStarts(events).at(-1) ?? -1;
  if (!events.some((e) => e.kind === "edit" && e.idx > turnStart && reviewable(e))) return { allow: true };
  const gap = coverage(events, "feature", reviewable);
  if (!gap) return { allow: true };
  if (gap.capped) return CAPPED(gap.why);
  // One retry only: a second block would trap the user in a loop they did not ask for.
  if (stopHookActive) return { allow: true, note: gap.rows ? `Cierre con hallazgos sin responder (${gap.why}).` : `Cierre sin revisar: el crítico no revisó los cambios de este turno (${gap.why}).` };
  return { allow: false, reason: `Critic gate (close): ${gap.why}. ${gap.rows ? ANSWER : HOW}` };
}

export function gateEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.PONEGLYPH_CRITIC_GATE === "0") return false;
  if (env.PONEGLYPH_CRITIC_GATE === "1") return true;
  return !isHeadlessSession(env);
}

interface Payload {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  transcript_path?: string;
  stop_hook_active?: boolean;
  agent_id?: string;
  session_id?: string;
  cwd?: string;
  last_assistant_message?: string;
}

/** The hook's stdout ("" to stay silent) and its log line (null when nothing was gated). */
export function decide(payload: Payload, events: Event[]): { out: string; log: string | null } {
  const event = payload.hook_event_name;
  // An orchestrator that reserves review for a person opts its worker out in the prompt.
  if (gateOptedOut(events)) return { out: "", log: event === "Stop" || payload.tool_name === "ExitPlanMode" ? "optout allow" : null };
  let v: Verdict = { allow: true };
  let kind: string | null = null;
  if (event === "PreToolUse" && payload.tool_name === "ExitPlanMode") {
    kind = "plan";
    v = judgePlanExit(events);
  } else if (event === "Stop") {
    // The final answer, which carries the answer rows, is often not in the transcript yet at Stop.
    const last = payload.last_assistant_message;
    const seen = events.filter((e) => e.kind === "text").at(-1);
    if (last && !(seen?.kind === "text" && seen.text === last)) events = [...events, { kind: "text", idx: events.length ? events.at(-1)!.idx + 1 : 0, text: last }];
    v = judgeStop(events, payload.stop_hook_active === true);
    if (!v.allow || v.note) kind = "close";
  }
  // Fails open with a warning: a gate the session cannot satisfy would trap it.
  const unavailable = v.allow ? null : criticUnavailable(events);
  if (unavailable) v = { allow: true, note: `Crítico no disponible, paso sin revisar: ${unavailable}.` };
  const log = kind && `${kind} ${v.allow ? (v.note ? "warn" : "allow") : `deny ${v.reason.split(". ")[0]}`}`;
  if (v.allow) return { out: v.note ? JSON.stringify({ systemMessage: v.note }) : "", log };
  if (event === "Stop") return { out: JSON.stringify({ decision: "block", reason: v.reason }), log };
  return { out: JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: v.reason } }), log };
}

const denied = (out: string) => out.includes('"permissionDecision":"deny"');

/** `decide` on a fresh read; a plan deny is re-read once, since rows in the calling message may land just after the hook starts. */
export async function gateRun(payload: Payload, read: () => Event[], sleep: (ms: number) => Promise<unknown>) {
  const first = decide(payload, read());
  if (payload.tool_name !== "ExitPlanMode" || !denied(first.out)) return first;
  await sleep(REREAD_MS);
  try {
    const again = decide(payload, read());
    return denied(again.out) ? again : { ...again, log: `${again.log} reread` };
  } catch {
    return first;
  }
}

if (import.meta.main) {
  let payload: Payload = {};
  try {
    payload = JSON.parse(await readHookStdin()) as Payload;
  } catch {
    process.exit(0);
  }
  // Subagents have their own transcript and never close the Lead's plan, feature or turn.
  if (payload.agent_id || !gateEnabled() || !payload.transcript_path) process.exit(0);
  let run: { out: string; log: string | null };
  try {
    run = await gateRun(payload, () => parseEvents(readFileSync(payload.transcript_path!, "utf8").split("\n")), Bun.sleep);
  } catch {
    process.exit(0);
  }
  const { out, log } = run;
  if (out) process.stdout.write(out + "\n");
  if (log) {
    try {
      const file = learnedLog(payload.cwd, "critic-gate.log");
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, `${new Date().toISOString()} ${(payload.session_id ?? "-").slice(0, 8)} ${log}\n`);
    } catch {
      // the log never blocks a gate
    }
  }
  process.exit(0);
}
