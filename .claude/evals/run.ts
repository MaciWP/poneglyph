#!/usr/bin/env bun
// Golden-prompt harness runner (019/US3).
// Live mode: executes each case via `claude -p --output-format stream-json`
// (session auth — the published pattern, W2 D1) and grades the transcript.
// Offline mode (--offline <dir>): grades stored transcripts (<dir>/<case-id>.txt
// or .jsonl) — used by tests and for re-grading without model cost.
// Graders are pure (graders.ts); only this runner touches processes/files.

import { graders, type CaseSpec, type GradeResult } from "./graders";
import { resolveHeadlessModel, stripHeadlessFlags } from "../scripts/lib/headless";

export interface CaseResult {
  id: string;
  grader: string;
  trials: number;
  pass: boolean;
  errored?: boolean; // session never produced behaviour (quota/auth/API) — not a FAIL
  model?: string; // the tier the case actually ran on (plan 033)
  detail: string;
}

export interface Report {
  results: CaseResult[];
  passed: number;
  failed: number;
  errored: number;
  ok: boolean;
}

export function parseCases(jsonl: string): CaseSpec[] {
  const cases: CaseSpec[] = [];
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    const c = JSON.parse(trimmed) as CaseSpec;
    if (!c.id || !c.grader) throw new Error(`case missing id/grader: ${trimmed.slice(0, 80)}`);
    if (!graders[c.grader]) throw new Error(`case ${c.id}: unknown grader "${c.grader}"`);
    cases.push(c);
  }
  return cases;
}

// A transcript with no assistant turn, or whose `result` event reports an error, is not
// behaviour — it is a session that never ran (quota exhausted, auth, API outage). Grading
// it as FAIL hides the cause: on 2026-09-03 the claude.ai usage limit hit mid-run and
// 4/4 skill cases "failed" twice in a row for that reason (plan 032). Pure, unit-tested.
export function transcriptHealth(transcript: string): { ok: true } | { ok: false; reason: string } {
  if (!transcript.trim()) return { ok: false, reason: "empty transcript (quota/auth/API?)" };
  let events = 0;
  let assistantTurns = 0;
  for (const line of transcript.split("\n")) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const e = event as { type?: string; subtype?: string; is_error?: boolean; result?: unknown };
    if (typeof e?.type !== "string") continue;
    events++;
    if (e.type === "assistant") assistantTurns++;
    if (e.type === "result" && (e.is_error === true || (typeof e.subtype === "string" && e.subtype.startsWith("error")))) {
      const msg = typeof e.result === "string" ? e.result.slice(0, 120) : e.subtype ?? "error";
      return { ok: false, reason: `session error: ${msg}` };
    }
  }
  // Plain-text transcripts (offline .txt fixtures) carry no events — nothing to judge.
  if (events === 0) return { ok: true };
  if (assistantTurns === 0) return { ok: false, reason: "no assistant turn in transcript (quota/auth/API?)" };
  return { ok: true };
}

function gradeTranscripts(c: CaseSpec, transcripts: string[]): CaseResult {
  const sick = transcripts.map(transcriptHealth).find((h) => !h.ok) as { ok: false; reason: string } | undefined;
  if (sick) {
    return { id: c.id!, grader: c.grader!, trials: transcripts.length, pass: false, errored: true, detail: `ERROR — ${sick.reason}; rerun, this is not a behaviour failure` };
  }
  // pass^k: every trial must pass for consistency-critical behaviors (W2 D1).
  const results: GradeResult[] = transcripts.map((t) => graders[c.grader!](t, c));
  const failed = results.find((r) => !r.pass);
  return {
    id: c.id!,
    grader: c.grader!,
    trials: transcripts.length,
    pass: !failed,
    detail: failed ? failed.detail : results[0]?.detail ?? "no transcript",
  };
}

export async function runOffline(casesPath: string, transcriptDir: string): Promise<Report> {
  const cases = parseCases(await Bun.file(casesPath).text());
  const results: CaseResult[] = [];
  for (const c of cases) {
    let transcript: string | null = null;
    for (const ext of [".txt", ".jsonl"]) {
      const f = Bun.file(`${transcriptDir}/${c.id}${ext}`);
      if (await f.exists()) {
        transcript = await f.text();
        break;
      }
    }
    if (transcript === null) {
      results.push({ id: c.id!, grader: c.grader!, trials: 0, pass: false, detail: "transcript not found" });
      continue;
    }
    results.push(gradeTranscripts(c, [transcript]));
  }
  return summarize(results);
}

// `argv` carries the model policy flags (--model / --allow-expensive / --dry-run); the
// model is resolved PER CASE (plan 033): prose graders run on the cheap tier, skill-trigger
// cases on the mid tier, and an expensive tier is refused without --allow-expensive.
export async function runLive(casesPath: string, argv: string[] = []): Promise<Report> {
  const cases = parseCases(await Bun.file(casesPath).text());
  const results: CaseResult[] = [];
  for (const c of cases) {
    const kind = c.grader === "skillTriggerParse" ? "skill-trigger" : "style";
    const { model, dryRun } = resolveHeadlessModel(argv, kind);
    const trials = c.trials && c.trials > 1 ? Math.min(c.trials, 3) : 1;
    const transcripts: string[] = [];
    // Style/honesty/register graders score the PROSE response — they don't need the
    // agentic tool loop, which makes each case a multi-minute session (4 timeouts in 024).
    // Force a single prose turn for them. skillTriggerParse is the exception: it asserts a
    // real Skill() tool_use, so it MUST keep tools enabled.
    const proseOnly = c.grader !== "skillTriggerParse";
    const proseFlags = proseOnly
      ? ["--append-system-prompt", "Responde directamente en prosa. NO uses herramientas ni leas ficheros; responde desde tu conocimiento.", "--allowedTools", ""]
      : [];
    const cmd = ["claude", "-p", c.prompt ?? "", "--output-format", "stream-json", "--verbose", "--model", model, ...proseFlags];
    if (dryRun) {
      console.log(`DRY  ${c.id}  ×${trials}  ${cmd.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
      results.push({ id: c.id!, grader: c.grader!, trials: 0, pass: true, model, detail: "dry-run — not executed" });
      continue;
    }
    for (let i = 0; i < trials; i++) {
      const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
      transcripts.push(await new Response(proc.stdout).text());
      await proc.exited;
    }
    results.push({ ...gradeTranscripts(c, transcripts), model });
  }
  return summarize(results);
}

function summarize(results: CaseResult[]): Report {
  const passed = results.filter((r) => r.pass).length;
  const errored = results.filter((r) => r.errored).length;
  return { results, passed, failed: results.length - passed - errored, errored, ok: passed === results.length };
}

function printReport(report: Report): void {
  for (const r of report.results) {
    const tag = r.pass ? "PASS" : r.errored ? "ERR " : "FAIL";
    console.log(`${tag}  ${r.id}  [${r.grader} ×${r.trials}${r.model ? ` · ${r.model}` : ""}]  ${r.pass ? "" : r.detail}`);
  }
  console.log(`\n${report.passed}/${report.results.length} passed${report.errored ? ` · ${report.errored} errored (sessions that never ran — rerun them, they say nothing about behaviour)` : ""}`);
  if (!report.ok) {
    console.log("Expected ≈100% — SUSPECT THE EVAL FIRST (grading bug), then the config change. See .claude/evals/README.md");
  }
}

if (import.meta.main) {
  const rawArgs = process.argv.slice(2);
  const args = stripHeadlessFlags(rawArgs);
  const offlineIdx = args.indexOf("--offline");
  const casesPath = args.find((a) => a.endsWith(".jsonl") && !a.startsWith("--")) ?? ".claude/evals/cases.jsonl";
  let report: Report;
  try {
    report = offlineIdx !== -1 ? await runOffline(casesPath, args[offlineIdx + 1] ?? ".") : await runLive(casesPath, rawArgs);
  } catch (error) {
    console.error(`✘ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  printReport(report);
  process.exit(report.ok ? 0 : 1);
}
