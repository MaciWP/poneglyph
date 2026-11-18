#!/usr/bin/env bun
// bun .claude/scripts/critic-report.ts [--days N]
//
// What the `critic` agent and its gate did, from the transcripts and critic-gate.log files:
// reviews per mode and verdict, findings per severity and perspective, how the Lead answered them, gate
// decisions, the turns the Stop gate would block (a replay of `judgeStop`), tokens and an estimated
// cost per review, tool calls per review, and any advisor call the critic made (its prompt forbids one).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { CRITIC_AGENT, CRITIC_MODEL_RE, criticReviews, MAX_TURNS_RE, type Event, gateOptedOut, isWorkingNote, parseEvents, type Review, turnStarts, withPlanRows } from "../hooks/lib/critic-events";
import { judgeStop } from "../hooks/critic-gate";
import { claudeConfigDir, learnedLog } from "../hooks/lib/paths";
import { windowStart } from "./skill-usage";
import { collectTranscripts, percentile } from "./usage-profile";

export interface CriticReport {
  reviews: number;
  byMode: Record<string, number>;
  byVerdict: Record<string, number>;
  bySeverity: Record<string, number>;
  /** Findings by the first word of their perspective tag (`reuse`, `correctness`, …). */
  byPerspective: Record<string, number>;
  /** Reviews with no blocker or major: the figure that survives a change in what `REVISE` means. */
  noBlockerOrMajor: number;
  /** A minor the Lead declined is `minorsDeclined`, never `disputed`: only those go to the user. */
  answers: { accepted: number; disputed: number; minorsDeclined: number; unanswered: number };
  offModel: number;
  /** Critic runs stopped at `maxTurns`: no verdict, so no review. */
  cut: number;
}

const bump = (o: Record<string, number>, k: string, n = 1) => { o[k] = (o[k] ?? 0) + n; };

/**
 * The session's reviews with a plan review's answers read as the gate reads them: the rows in the
 * plan of the last ExitPlanMode before the next review count too (`withPlanRows`).
 */
function answeredReviews(events: Event[]): Review[] {
  const reviews = criticReviews(events);
  return reviews.map((r, i) => {
    const end = reviews[i + 1]?.spawnIdx ?? Infinity;
    const exit = r.mode === "plan" ? events.filter((e) => e.kind === "tool" && e.name === "ExitPlanMode" && e.idx > r.resultIdx && e.idx < end).at(-1) : undefined;
    return exit?.kind === "tool" && typeof exit.input.plan === "string" ? withPlanRows(r, exit.input.plan, events) : r;
  });
}

/** Pure. Aggregates the critic reviews of the given main transcripts' events. */
export function summarizeReviews(sessions: Event[][]): CriticReport {
  const r: CriticReport = { reviews: 0, byMode: {}, byVerdict: {}, bySeverity: {}, byPerspective: {}, noBlockerOrMajor: 0, answers: { accepted: 0, disputed: 0, minorsDeclined: 0, unanswered: 0 }, offModel: 0, cut: 0 };
  for (const events of sessions) {
    const critics = new Set(events.filter((e) => e.kind === "spawn" && e.type === CRITIC_AGENT).map((e) => (e as { id: string }).id));
    r.cut += events.filter((e) => e.kind === "result" && critics.has(e.id) && MAX_TURNS_RE.test(e.text) && !/^VERDICT:/m.test(e.text)).length;
    for (const rev of answeredReviews(events)) {
      r.reviews++;
      bump(r.byMode, rev.mode ?? "unknown");
      bump(r.byVerdict, rev.verdict);
      if (!CRITIC_MODEL_RE.test(rev.resolvedModel ?? "")) r.offModel++;
      const severe = (h: string) => rev.tags[h].severity === "blocker" || rev.tags[h].severity === "major";
      if (!rev.findings.some(severe)) r.noBlockerOrMajor++;
      for (const [h, a] of rev.answers) {
        const { severity, perspective } = rev.tags[h];
        if (severity) bump(r.bySeverity, severity);
        if (perspective) bump(r.byPerspective, perspective);
        if (a === null) r.answers.unanswered++;
        else if (a === "accepted") r.answers.accepted++;
        else if (severity === "minor") r.answers.minorsDeclined++;
        else r.answers.disputed++;
      }
    }
  }
  return r;
}

export interface CriticRun { advisorCalls: number; toolCalls: number; fresh: number; cacheWrite: number; cacheRead: number; output: number }

/** US$ per million tokens. [Suposición: the transcript carries no price; update when Anthropic's list changes.] */
export const OPUS_PRICE = { fresh: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 };
export const runCost = (r: CriticRun) => (r.fresh * OPUS_PRICE.fresh + r.cacheWrite * OPUS_PRICE.cacheWrite + r.cacheRead * OPUS_PRICE.cacheRead + r.output * OPUS_PRICE.output) / 1e6;

/**
 * Pure. Replays the Stop gate at the end of every turn from `fromIdx` on that made a reviewable
 * edit, with the gate's own turn boundaries. `blocked` holds the start idx of each blocked turn.
 * A session that opted out is skipped, as the live gate skips it.
 */
export function replayStops(events: Event[], fromIdx = 0): { turns: number; blocks: number; blocked: number[]; sizes: number[] } {
  const starts = turnStarts(events);
  let turns = 0;
  const blocked: number[] = [];
  const sizes: number[] = [];
  if (gateOptedOut(events)) return { turns, blocks: 0, blocked, sizes };
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? Infinity;
    if (start < fromIdx || !events.some((e) => e.kind === "edit" && e.idx > start && e.idx < end && !isWorkingNote(e.path))) return;
    turns++;
    if (judgeStop(events.filter((e) => e.idx < end), false).allow) return;
    blocked.push(start);
    sizes.push(events.reduce((n, e) => (e.kind === "edit" && e.idx > start && e.idx < end && !isWorkingNote(e.path) ? n + e.lines : n), 0));
  });
  return { turns, blocks: blocked.length, blocked, sizes };
}

/** The gate is off in headless runs (`claude -p`, SDK); their records say `"entrypoint":"sdk-…"`. */
export const isHeadlessTranscript = (lines: string[]) => lines.some((x) => x.includes('"entrypoint":"sdk-'));

/** The 1-based idx of the first record at or after `since`, or Infinity when none is: then no turn of it is replayed. */
export function firstIdxSince(lines: string[], since: number): number {
  const i = lines.findIndex((x) => Date.parse(x.match(/"timestamp":"([^"]+)"/)?.[1] ?? "") >= since);
  return i < 0 ? Infinity : i + 1;
}

/** Pure. One critic subagent transcript: its advisor calls and its tokens, each message counted once. */
export function criticRun(lines: Iterable<string>): CriticRun {
  const run: CriticRun = { advisorCalls: 0, toolCalls: 0, fresh: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  // One API message spans several records, one content block each, all repeating its usage.
  const seen = new Set<string>();
  const blocks = new Set<string>();
  for (const line of lines) {
    let rec: any;
    try { rec = JSON.parse(line); } catch { continue; }
    const msg = rec?.message;
    if (rec?.type !== "assistant" || !msg?.id) continue;
    for (const b of msg.content ?? []) {
      if (b?.type !== "server_tool_use" && b?.type !== "tool_use") continue;
      if (blocks.has(b.id ?? line)) continue;
      blocks.add(b.id ?? line);
      if (b.type === "tool_use") run.toolCalls++;
      else if (b.name === "advisor") run.advisorCalls++;
    }
    if (seen.has(msg.id)) continue;
    seen.add(msg.id);
    const u = msg.usage ?? {};
    run.fresh += u.input_tokens ?? 0;
    run.cacheWrite += u.cache_creation_input_tokens ?? 0;
    run.cacheRead += u.cache_read_input_tokens ?? 0;
    run.output += u.output_tokens ?? 0;
  }
  return run;
}

/** Pure. Gate decisions per kind (`plan`, `feature`, `close`) and outcome from critic-gate.log lines. */
export function summarizeGateLog(lines: Iterable<string>, since = 0): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of lines) {
    const [at, , kind, outcome] = line.split(" ");
    if (!kind || !outcome || Date.parse(at) < since) continue;
    bump(out, `${kind.split(":")[0]} ${outcome}`);
  }
  return out;
}

function gateLogs(): string[] {
  const root = join(claudeConfigDir(), "learned");
  let dirs: string[] = [];
  try { dirs = readdirSync(root).map((d) => join(root, d, "critic-gate.log")); } catch { /* no learned dir */ }
  return [...new Set([learnedLog(process.cwd(), "critic-gate.log"), ...dirs])].filter((f) => existsSync(f));
}

const table = (o: Record<string, number>) => Object.entries(o).sort().map(([k, v]) => `${k} ${v}`).join(" · ") || "none";

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--days");
  const days = i >= 0 ? Number(argv[i + 1]) || 14 : 14;
  const since = windowStart(days);
  const files = collectTranscripts(join(claudeConfigDir(), "projects"), days).filter((f) => !f.includes("scratchpad"));
  const read = (f: string) => { try { return readFileSync(f, "utf8").split("\n"); } catch { return []; } };
  const mains = files.filter((f) => basename(dirname(f)) !== "subagents");
  const lines = mains.map(read);
  const headless = lines.map(isHeadlessTranscript);
  const sessions = lines.map((l) => parseEvents(l));
  const report = summarizeReviews(sessions);
  // Long sessions reach back before the window, so their turns start inside it.
  const stops = { turns: 0, blocks: 0 };
  const sizes: number[] = [];
  const blockedBySession: Record<string, number> = {};
  const blockedByDay: Record<string, number> = {};
  sessions.forEach((ev, i) => {
    if (headless[i]) return;
    const r = replayStops(ev, firstIdxSince(lines[i], since));
    sizes.push(...r.sizes);
    stops.turns += r.turns;
    stops.blocks += r.blocks;
    for (const idx of r.blocked) {
      bump(blockedBySession, basename(mains[i]).slice(0, 8));
      bump(blockedByDay, lines[i][idx - 1]?.match(/"timestamp":"(\d{4}-\d\d-\d\d)/)?.[1] ?? "unknown");
    }
  });
  const topSessions = Object.entries(blockedBySession).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(" · ") || "none";
  const runs = files.filter((f) => basename(dirname(f)) === "subagents").filter((f) => {
    try { return JSON.parse(readFileSync(f.replace(/\.jsonl$/, ".meta.json"), "utf8")).agentType === CRITIC_AGENT; } catch { return false; }
  }).map((f) => criticRun(read(f)));
  const gate = summarizeGateLog(gateLogs().flatMap(read), since);
  const sum = (k: keyof CriticRun) => runs.reduce((n, r) => n + r[k], 0);
  const cost = runs.reduce((n, r) => n + runCost(r), 0);
  const calls = runs.map((r) => r.toolCalls).sort((a, b) => a - b);
  const severe = (report.bySeverity.blocker ?? 0) + (report.bySeverity.major ?? 0);
  console.log([
    `Critic over the last ${days} days`,
    "",
    "| Metric | Value |",
    "|---|---|",
    `| Reviews | ${report.reviews} (${table(report.byMode)}) |`,
    `| Verdicts | ${table(report.byVerdict)} |`,
    `| Findings | ${table(report.bySeverity)} |`,
    `| Findings by perspective | ${table(report.byPerspective)} |`,
    `| Reviews with no blocker or major | ${report.noBlockerOrMajor} of ${report.reviews} |`,
    `| Blockers and majors per review | ${report.reviews ? (severe / report.reviews).toFixed(2) : "0"} |`,
    `| Answers | accepted ${report.answers.accepted} · disputed ${report.answers.disputed} · minors declined ${report.answers.minorsDeclined} · unanswered ${report.answers.unanswered} |`,
    `| Off-model reviews | ${report.offModel} |`,
    `| Runs cut at maxTurns | ${report.cut} |`,
    `| Gate | ${table(gate)} |`,
    `| Turns the Stop gate would block | ${stops.blocks} of ${stops.turns} turns with edits; median ${sizes.sort((a, b) => a - b)[sizes.length >> 1] ?? 0} lines, ${sizes.filter((n) => n <= 20).length} of 20 lines or fewer |`,
    `| Blocked turns by day | ${table(blockedByDay)} |`,
    `| Sessions with most blocked turns | ${topSessions} |`,
    `| Critic runs | ${runs.length}; tokens fresh ${sum("fresh")} · cache write ${sum("cacheWrite")} · cache read ${sum("cacheRead")} · out ${sum("output")} |`,
    `| Tool calls per critic run | p50 ${percentile(calls, 0.5)} · p75 ${percentile(calls, 0.75)} · p90 ${percentile(calls, 0.9)} · p95 ${percentile(calls, 0.95)} · max ${calls.at(-1) ?? 0} |`,
    `| US$ per review [Suposición: list prices] | ${runs.length ? (cost / runs.length).toFixed(2) : "0"} (total ${cost.toFixed(2)}) |`,
    `| Advisor calls by the critic | ${sum("advisorCalls")} |`,
  ].join("\n"));
}
