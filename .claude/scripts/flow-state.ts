#!/usr/bin/env bun
// flow-state — typed mutations for .claude/plans/{NNN}-{slug}/state.json
// (canonical schema: commands/flow.md Step 4) + the matching tasks/US{n}.md
// frontmatter flip. Replaces the hand-rolled python/sed one-liners that every
// /flow run re-invented (provenance: 2026-06-11 polish plan; 019 ran 6 of them).
//
// Usage:
//   bun .claude/scripts/flow-state.ts close-us US3 --verification <report.json> [--files "a.md,b.ts"] [--note "..."] [--tests-passed true|false] [--plan <dir>]
//   bun .claude/scripts/flow-state.ts approve-gate 1-2|2-3 --approval <decision-ref> [--plan <dir>]
//   bun .claude/scripts/flow-state.ts verdict <VERDICT> --review <assessment.json>
//   bun .claude/scripts/flow-state.ts reopen-us US3 --note <reason> [--approval <decision-ref>]
//   bun .claude/scripts/flow-state.ts sync-artifacts [--plan <dir>]
//   bun .claude/scripts/flow-state.ts retro-status "approved|pending|skipped — <justificación ≥10 chars>"
//   bun .claude/scripts/flow-state.ts boundary-check 1|2|2.5|3|4|5 "<item>"  [--plan <dir>]
//   bun .claude/scripts/flow-state.ts close-feature                   [--plan <dir>]
//   bun .claude/scripts/flow-state.ts complete-phase 1|2|2.5|3|4|5      [--plan <dir>]
//   bun .claude/scripts/flow-state.ts status                          [--plan <plans-root>]
// Without --plan, auto-detects the single open plan (feature_closed: false) under .claude/plans/.
// `status` instead scans the whole plans root and lists every incomplete lifecycle.

import { readdirSync, existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, rmSync, lstatSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { classifyReview, validateVerification, type VerificationRecord, type ReviewAssessment } from "./lib/flow-contract";
import { join } from "node:path";
import { frontmatter } from "./lib/skill-metadata";

export interface UsHistoryEntry {
  us: string;
  completed_at: string;
  /** true/false = MEASURED. null = nobody measured it — never assume green. */
  tests_passed: boolean | null;
  verification?: VerificationRecord;
  files_touched?: string[];
  execution?: string;
  askuserquestion_count?: number;
}

export interface FlowState {
  spec_slug: string;
  mode: string;
  current_phase: number | string;
  phases_completed: number[];
  gates_approved: { "1->2": boolean; "2->3": boolean };
  gate_history?: Array<{ gate: "1->2" | "2->3"; at: string; reference: string; artifacts?: string[] }>;
  review_assessment?: ReviewAssessment;
  reopen_history?: Array<{ us: string; reason: string; at: string; approval?: string }>;
  us_completed: string[];
  us_pending: string[];
  us_history?: UsHistoryEntry[];
  boundary_checks?: BoundaryCheck[];
  feature_closed: boolean;
  review_verdict: string | null;
  retro_status: string | null;
  started_at: string;
  updated_at: string;
}

export interface BoundaryCheck {
  phase: string;
  item: string;
  at: string;
}

const VERDICTS = ["APPROVED", "APPROVED_WITH_WARNINGS", "NEEDS_CHANGES", "BLOCKED"];

function assertState(s: unknown): FlowState {
  const st = s as FlowState;
  if (!st || typeof st !== "object" || !st.spec_slug || !st.gates_approved) {
    throw new Error("state.json does not match the canonical flow schema (missing spec_slug/gates_approved)");
  }
  if (!Array.isArray(st.us_pending) || !Array.isArray(st.us_completed) ||
      !Array.isArray(st.phases_completed) || typeof st.feature_closed !== "boolean" ||
      typeof st.gates_approved["1->2"] !== "boolean" || typeof st.gates_approved["2->3"] !== "boolean" ||
      [...st.us_pending, ...st.us_completed].some(id => typeof id !== "string" || !/^US[1-9]\d*$/.test(id)) ||
      new Set([...st.us_pending, ...st.us_completed]).size !== st.us_pending.length + st.us_completed.length) {
    throw new Error("state.json has invalid lifecycle fields or duplicate US ids");
  }
  return st;
}

function requireOpen(state: FlowState, reopening = false): void {
  if (state.feature_closed) throw new Error("feature is closed; start an explicitly scoped follow-up");
  if (state.review_verdict === "BLOCKED" && !reopening) throw new Error("BLOCKED lifecycle requires reopen-us with an approval reference");
}

function requireBuildGate(state: FlowState): void {
  if (!state.gates_approved["1->2"] || !state.gates_approved["2->3"]) {
    throw new Error("build requires recorded approval of gates 1->2 and 2->3");
  }
  if (![1, 2, 2.5].every(phase => state.phases_completed.includes(phase))) throw new Error("build requires prepared scope, task and oracle phases");
}

function requireVerifiedCompletion(state: FlowState): void {
  requireBuildGate(state);
  if (state.us_pending.length) throw new Error("pending USs prevent completion");
  if (!state.us_completed.length) throw new Error("no verified USs: an empty lifecycle cannot complete");
  for (const us of state.us_completed) {
    const entry = state.us_history?.filter(e => e.us === us).at(-1);
    validateVerification(entry?.verification, us);
  }
}


export function closeUs(
  state: FlowState,
  usId: string,
  opts: { date: string; files?: string[]; note?: string; testsPassed?: boolean; verification?: VerificationRecord },
): FlowState {
  requireOpen(state);
  requireBuildGate(state);
  if (!state.us_pending.includes(usId)) {
    throw new Error(`${usId} is not pending (pending: [${state.us_pending.join(", ")}])`);
  }
  const verification = validateVerification(opts.verification, usId);
  if (opts.testsPassed !== undefined && opts.testsPassed !== verification.tests_passed) {
    throw new Error("--tests-passed contradicts verification; use the report's measured value");
  }
  const entry: UsHistoryEntry = {
    us: usId,
    completed_at: opts.date,
    tests_passed: verification.tests_passed,
    verification: structuredClone(verification),
    files_touched: opts.files ?? [],
    execution: opts.note ?? "inline",
    askuserquestion_count: 0,
  };
  return {
    ...state,
    us_completed: [...state.us_completed, usId],
    us_pending: state.us_pending.filter((u) => u !== usId),
    us_history: [...(state.us_history ?? []), entry],
    review_verdict: null,
    review_assessment: undefined,
    retro_status: null,
    phases_completed: state.phases_completed.filter(p => p < 3),
    current_phase: state.us_pending.length === 1 ? 4 : 3,
    updated_at: opts.date,
  };
}

// Marks a phase as completed mid-flight (028/US6-D6 — closes the resumability
// gap when a session dies in 2.5: nothing else records phases between gates).
const PHASES = [1, 2, 2.5, 3, 4, 5];

export function completePhase(state: FlowState, phase: number): FlowState {
  requireOpen(state);
  if (!PHASES.includes(phase)) {
    throw new Error(`invalid phase "${phase}" — one of ${PHASES.join(" | ")} (e.g. 2.5)`);
  }
  if (state.phases_completed.includes(phase)) return state;
  if (phase === 2 && (!state.gates_approved["1->2"] || !state.phases_completed.includes(1))) throw new Error("phase 2 requires approved scope");
  if (phase === 2.5 && !state.phases_completed.includes(2)) throw new Error("phase 2.5 requires draft tasks (phase 2 complete)");
  if (phase >= 3) requireVerifiedCompletion(state);
  if (phase >= 4 && !state.review_verdict) throw new Error("phase 4 requires a recorded review verdict");
  if (phase === 5 && state.review_verdict !== "APPROVED" && state.review_verdict !== "APPROVED_WITH_WARNINGS") throw new Error("phase 5 requires an approving review");
  if (phase === 5 && state.retro_status !== "approved" && !RETRO_SKIP_RE.test(state.retro_status ?? "")) throw new Error("phase 5 requires resolved retro");
  const phases = new Set(state.phases_completed);
  phases.add(phase);
  return {
    ...state,
    phases_completed: [...phases].sort((a, b) => a - b),
    current_phase: phase === 2 ? 2.5 : phase === 3 ? 4 : state.current_phase,
  };
}

export function approveGate(state: FlowState, gate: "1->2" | "2->3", approval: { date: string; reference: string }): FlowState {
  requireOpen(state);
  if (gate !== "1->2" && gate !== "2->3") throw new Error(`unknown gate "${gate}" — use 1->2 or 2->3`);
  if (!approval?.reference?.trim()) throw new Error("gate approval requires a reference to the user's actual decision");
  if (!state.phases_completed.includes(1)) throw new Error("approve-gate requires completed scope");
  if (gate === "2->3" && (!state.gates_approved["1->2"] || ![2, 2.5].every(p => state.phases_completed.includes(p)))) {
    throw new Error("gate 2->3 requires tasks and oracle prepared; draft is allowed during phase 2.5");
  }
  if (state.gates_approved[gate]) return state; // no phase rewind on retry
  return {
    ...state,
    gates_approved: { ...state.gates_approved, [gate]: true },
    gate_history: [...(state.gate_history ?? []), { gate, at: approval.date, reference: approval.reference.trim() }],
    current_phase: gate === "1->2" ? 2 : 3,
  };
}

export function setVerdict(state: FlowState, verdict: string, assessment: ReviewAssessment): FlowState {
  requireOpen(state);
  if (!VERDICTS.includes(verdict)) throw new Error(`invalid verdict "${verdict}"`);
  const expected = classifyReview(assessment);
  if (verdict !== expected) throw new Error(`verdict contradicts assessment: expected ${expected}`);
  const advance = verdict === "APPROVED" || verdict === "APPROVED_WITH_WARNINGS";
  if (advance) requireVerifiedCompletion(state);
  const phases = new Set(state.phases_completed);
  if (advance) [3, 4].forEach(p => phases.add(p));
  else [3, 4, 5].forEach(p => phases.delete(p));
  return {
    ...state, review_verdict: verdict, review_assessment: structuredClone(assessment),
    retro_status: null, current_phase: advance ? 5 : verdict === "NEEDS_CHANGES" ? 3 : 4,
    phases_completed: [...phases].sort((a, b) => a - b),
  };
}

export function reopenUs(state: FlowState, us: string, note: string, date: string, approval?: string): FlowState {
  requireOpen(state, true);
  if (state.review_verdict === "BLOCKED" && !approval?.trim()) throw new Error("reopening BLOCKED requires an approval reference");
  if (!note?.trim()) throw new Error("reopen-us requires a reason (--note)");
  if (!state.us_completed.includes(us) && !(state.review_verdict === "BLOCKED" && state.us_pending.includes(us))) throw new Error(`${us} is not completed or blocked pending work`);
  return {
    ...state, us_completed: state.us_completed.filter(id => id !== us),
    us_pending: state.us_pending.includes(us) ? [...state.us_pending] : [...state.us_pending, us], current_phase: 3,
    reopen_history: [...(state.reopen_history ?? []), { us, reason: note.trim(), at: date, approval }],
    phases_completed: state.phases_completed.filter(p => p < 3),
    review_verdict: null, review_assessment: undefined, retro_status: null,
  };
}

// retro_status contract (029/US12, user decision 2026-08-05: no modes — always
// full; a phase that doesn't apply is SKIPPED by the Lead WITH justification and
// prior notice): "approved" | "pending" | "skipped — <justification ≥10 chars>".
const RETRO_SKIP_RE = /^skipped — (.{10,})$/;

export function setRetroStatus(state: FlowState, value: string): FlowState {
  requireOpen(state);
  const valid = value === "approved" || value === "pending" || RETRO_SKIP_RE.test(value);
  if (!valid) {
    throw new Error(
      `invalid retro_status ${JSON.stringify(value)} — "approved" | "pending" | ` +
        `"skipped — <justificación ≥10 chars>" (skip without justification is the anti-pattern this guards against)`,
    );
  }
  return { ...state, retro_status: value };
}

// Boundary checklist entry (029/US17): each phase boundary ticks its ≤5 items
// into state — compliance becomes measurable instead of aspirational.
const BOUNDARY_PHASES = ["1", "2", "2.5", "3", "4", "5"];

export function addBoundaryCheck(
  state: FlowState,
  phase: string,
  item: string,
  opts: { date: string },
): FlowState {
  requireOpen(state);
  if (!BOUNDARY_PHASES.includes(phase)) {
    throw new Error(`invalid phase "${phase}" — one of ${BOUNDARY_PHASES.join("|")}`);
  }
  if (!item.trim()) throw new Error("boundary-check item must be non-empty");
  return {
    ...state,
    boundary_checks: [...(state.boundary_checks ?? []), { phase, item: item.trim(), at: opts.date }],
  };
}

export function closeFeature(state: FlowState, opts: { date: string }): FlowState {
  requireOpen(state);
  if (state.us_pending.length > 0) {
    throw new Error(`cannot close feature with pending USs: [${state.us_pending.join(", ")}]`);
  }
  if (state.review_verdict !== "APPROVED" && state.review_verdict !== "APPROVED_WITH_WARNINGS") {
    throw new Error(
      `cannot close feature with review_verdict ${JSON.stringify(state.review_verdict)} — Phase 4 must end APPROVED or APPROVED_WITH_WARNINGS first (Cmd IV)`,
    );
  }
  // 029/US12: never stamp a retro that didn't happen — retro must be approved
  // or explicitly skipped-with-justification BEFORE closing.
  if (state.retro_status !== "approved" && !RETRO_SKIP_RE.test(state.retro_status ?? "")) {
    throw new Error(
      `cannot close feature with retro_status ${JSON.stringify(state.retro_status)} — run retro (retro-status approved) ` +
        `or record a justified skip (retro-status "skipped — <justificación>") first (029/US12)`,
    );
  }
  requireVerifiedCompletion(state);
  if (!state.review_assessment || classifyReview(state.review_assessment) !== state.review_verdict) throw new Error("review evidence is missing or inconsistent");
  if (![1, 2, 2.5, 3, 4].every(p => state.phases_completed.includes(p))) throw new Error("cannot invent completed phases at feature closure");
  const phases = new Set(state.phases_completed);
  phases.add(5);
  return {
    ...state,
    phases_completed: [...phases].sort((a, b) => a - b),
    current_phase: "closed",
    feature_closed: true,
    updated_at: opts.date,
  };
}

// --- status report (US1, plan 025) ---
// Surfaces incomplete lifecycles so the back-half (build->critic->retro) doesn't
// get silently abandoned (audit 2026-06-30; flow.md smell signal line ~281).

export interface PlanScan {
  dir: string;
  slug: string;
  state: FlowState | null; // null = state.json present but unreadable (illegible)
}

// Scans a plans ROOT and returns the OPEN plans (feature_closed === false) plus
// any plan whose state.json is present-but-malformed (surfaced as illegible).
// Best-effort: a missing root or a dir without state.json never throws.
export function findOpenPlans(plansRoot: string): PlanScan[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(plansRoot, { withFileTypes: true });
  } catch {
    return []; // root absent / unreadable → no open plans
  }
  const out: PlanScan[] = [];
  for (const d of entries) {
    if (!d.isDirectory() || !/^\d{3}-/.test(d.name)) continue;
    const dir = join(plansRoot, d.name);
    const sp = join(dir, "state.json");
    if (!existsSync(sp)) continue; // not a flow-managed plan
    try {
      const st = assertState(JSON.parse(readFileSync(sp, "utf8")));
      if (st.feature_closed === false) out.push({ dir, slug: d.name, state: st });
    } catch {
      out.push({ dir, slug: d.name, state: null }); // illegible — surfaced, not dropped
    }
  }
  return out;
}

// One-line summary of a plan's lifecycle position (slug, phase, gates, US counts).
export function summarizeState(state: FlowState): string {
  const g = state.gates_approved;
  const gates = `1→2:${g["1->2"] ? "✓" : "·"} 2→3:${g["2->3"] ? "✓" : "·"}`;
  const done = state.us_completed.length ? state.us_completed.join(",") : "—";
  const pend = state.us_pending.length ? state.us_pending.join(",") : "—";
  return `${state.spec_slug} — phase ${state.current_phase} | gates ${gates} | done(${state.us_completed.length}): ${done} | pending(${state.us_pending.length}): ${pend}`;
}

function setStatus(content: string, status: "approved" | "closed", date: string): string {
  const { fields } = frontmatter(content);
  if (!["draft", "approved", "closed"].includes(String(fields.status))) throw new Error("invalid artifact frontmatter status");
  const field = status === "closed" ? "closed" : "approved";
  if (fields.status === status && fields[field] === date) return content;
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)!;
  const nl = content.includes("\r\n") ? "\r\n" : "\n";
  // Change only lifecycle fields. Preserve the body, unrelated YAML and line endings.
  let header = match[1].replace(/\r\n/g, "\n");
  if (!/^status:[^\n]*$/m.test(header)) throw new Error("frontmatter requires a top-level status field");
  header = header.replace(/^status:[^\n]*$/m, `status: ${status}`).replace(/^closed:[^\n]*(?:\n|$)/gm, "");
  const line = new RegExp(`^${field}:[^\\n]*$`, "m");
  header = line.test(header) ? header.replace(line, `${field}: ${date}`) : `${header.trimEnd()}\n${field}: ${date}`;
  return content.replace(match[0], `---${nl}${header.replace(/\n/g, nl)}${nl}---`);
}

export function flipUsFrontmatter(content: string, date: string): string {
  const status = frontmatter(content).fields.status;
  if (status === "closed") return content;
  if (status === "draft") throw new Error("US frontmatter must be approved before closure");
  return setStatus(content, "closed", date);
}

function readArtifact(planDir: string, path: string): string {
  if (!/^(spec\.md|tests\.md|validations\.md|tasks\/(index|US[1-9]\d*)\.md)$/.test(path)) throw new Error("invalid artifact path");
  if (path.startsWith("tasks/") && lstatSync(join(planDir, "tasks")).isSymbolicLink()) throw new Error("linked task directories are not supported");
  const target = join(planDir, path);
  if (!lstatSync(target).isFile() || lstatSync(target).isSymbolicLink()) throw new Error("artifact must be a regular file");
  return readFileSync(target, "utf8");
}

function readTasks(planDir: string): Map<string, string[]> {
  const tasks = new Map<string, string[]>();
  for (const name of readdirSync(join(planDir, "tasks")).filter(n => /^US[1-9]\d*\.md$/.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const id = name.slice(0, -3);
    const { fields } = frontmatter(readArtifact(planDir, `tasks/${name}`));
    if (fields.us !== id || !Array.isArray(fields.depends_on) || fields.depends_on.some(d => typeof d !== "string")) throw new Error(`invalid task/dependencies: ${id}`);
    tasks.set(id, fields.depends_on as string[]);
  }
  if (!tasks.size) throw new Error("tasks package must contain at least one US");
  const visited = new Set<string>(), visiting = new Set<string>();
  function visit(id: string) {
    if (!tasks.has(id)) throw new Error(`unknown dependency: ${id}`);
    if (visiting.has(id)) throw new Error(`cyclic dependency: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of tasks.get(id)!) visit(dep);
    visiting.delete(id); visited.add(id);
  }
  for (const id of tasks.keys()) visit(id);
  return tasks;
}

/** Approval records own the artifact set; repair never discovers new approvals. */
function artifactUpdates(state: FlowState, planDir: string): Map<string, string> {
  const updates = new Map<string, string>();
  const update = (path: string, status: "approved" | "closed", date: string) => {
    const content = setStatus(readArtifact(planDir, path), status, date);
    updates.set(join(planDir, path), content);
  };
  for (const gate of state.gate_history ?? []) {
    if (!state.gates_approved[gate.gate]) continue;
    for (const path of gate.artifacts ?? []) {
      if (state.us_completed.some(us => path === `tasks/${us}.md`)) continue;
      const closed = state.feature_closed && (path === "spec.md" || path === "tasks/index.md");
      update(path, closed ? "closed" : "approved", closed ? state.updated_at : gate.at);
    }
  }
  for (const us of state.us_completed) {
    const entry = state.us_history?.filter(e => e.us === us).at(-1);
    if (!entry?.verification) continue; // legacy evidence stays unknown; completion guards still reject it
    validateVerification(entry?.verification, us);
    update(`tasks/${us}.md`, "closed", entry!.completed_at);
  }
  for (const us of state.us_pending) {
    const reopened = state.reopen_history?.filter(e => e.us === us).at(-1);
    if (reopened) update(`tasks/${us}.md`, "approved", reopened.at);
  }
  return updates;
}

function atomicWrite(path: string, contents: string): void {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, contents, { flag: "wx" });
    renameSync(temp, path);
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
}

/** state.json is authoritative. Frontmatter is a repairable projection, never approval evidence. */
export async function runCommand(
  command: string,
  args: string[],
  opts: { planDir: string; date: string; files?: string[]; note?: string; testsPassed?: boolean;
    verification?: VerificationRecord; assessment?: ReviewAssessment; approval?: string },
): Promise<void> {
  const lock = join(opts.planDir, ".flow-state.lock");
  try { mkdirSync(lock); } catch { throw new Error("plan locked; another writer or an interrupted mutation requires inspection before removing .flow-state.lock"); }
  try {
    writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    const statePath = join(opts.planDir, "state.json");
    let state = assertState(JSON.parse(await Bun.file(statePath).text()));
    const before = JSON.stringify(state);
    if (command !== "sync-artifacts" && command !== "reopen-us") requireOpen(state);
    switch (command) {
      case "close-us": {
        const dependencies = readTasks(opts.planDir).get(args[0]);
        if (!dependencies || dependencies.some(id => !state.us_completed.includes(id))) throw new Error("task has missing or unfinished dependencies");
        state = closeUs(state, args[0], opts);
        break;
      }
      case "reopen-us":
        if (state.review_verdict === "BLOCKED" && !opts.approval?.trim()) throw new Error("reopening BLOCKED requires --approval referencing the user's decision");
        state = reopenUs(state, args[0], opts.note ?? "", opts.date, opts.approval);
        break;
      case "approve-gate": {
        const raw = args[0];
        const gate = raw === "1-2" ? "1->2" : raw === "2-3" ? "2->3" : raw;
        const approved = approveGate(state, gate as "1->2" | "2->3", { date: opts.date, reference: opts.approval ?? "" });
        if (approved !== state) {
          let artifacts = ["spec.md"];
          if (gate === "2->3") {
            const tasks = readTasks(opts.planDir);
            const oracles = ["tests.md", "validations.md"].filter(p => existsSync(join(opts.planDir, p)));
            if (!oracles.length) throw new Error("joint approval requires an oracle");
            if (state.us_completed.length) throw new Error("cannot replace an implemented package through approval");
            approved.us_pending = [...tasks.keys()];
            artifacts = ["tasks/index.md", ...[...tasks.keys()].map(id => `tasks/${id}.md`), ...oracles];
          }
          approved.gate_history!.at(-1)!.artifacts = artifacts;
        }
        state = approved;
        break;
      }
      case "verdict": state = setVerdict(state, args[0] ?? "", opts.assessment!); break;
      case "retro-status": state = setRetroStatus(state, args[0] ?? ""); break;
      case "boundary-check": state = addBoundaryCheck(state, args[0] ?? "", args[1] ?? "", opts); break;
      case "close-feature": state = closeFeature(state, opts); break;
      case "complete-phase": state = completePhase(state, Number(args[0])); break;
      case "sync-artifacts": break;
      default: throw new Error(`unknown command "${command}"`);
    }
    const changed = JSON.stringify(state) !== before;
    if (changed) state = { ...state, updated_at: opts.date };
    const updates = artifactUpdates(state, opts.planDir); // validate every document BEFORE committing state
    if (changed) atomicWrite(statePath, JSON.stringify(state, null, 2) + "\n");
    // If interrupted after this commit, sync-artifacts repairs the projection.
    for (const [path, content] of updates) if (readFileSync(path, "utf8") !== content) atomicWrite(path, content);
  } finally {
    rmSync(lock, { recursive: true });
  }
}

function detectPlanDir(plansRoot: string): string {
  let dirEntries: ReturnType<typeof readdirSync>;
  try {
    dirEntries = readdirSync(plansRoot, { withFileTypes: true });
  } catch {
    throw new Error(`plans root not found at ${plansRoot} — run from the repo root or pass --plan <dir>`);
  }
  const open = dirEntries
    .filter((d) => d.isDirectory() && /^\d{3}-/.test(d.name))
    .map((d) => join(plansRoot, d.name))
    .filter((dir) => {
      try {
        const s = JSON.parse(require("node:fs").readFileSync(join(dir, "state.json"), "utf8"));
        return s.feature_closed === false;
      } catch {
        return false;
      }
    });
  if (open.length !== 1) {
    throw new Error(`expected exactly 1 open plan, found ${open.length} — pass --plan <dir>`);
  }
  return open[0];
}

export function parseTestsPassed(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value !== "true" && value !== "false") throw new Error("--tests-passed must be true or false");
  return value === "true";
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const positional = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  const [command, ...args] = positional;

  // `status` scans the plans ROOT (all plans) — handled before detectPlanDir,
  // which requires exactly one open plan and would throw here.
  if (command === "status") {
    const root = flag("plan") ?? ".claude/plans";
    if (!existsSync(root)) {
      // Distinguish "wrong path" from "all closed" — a missing root must not read as success.
      console.error(`flow-state: plans root not found at ${root} — run from the repo root or pass --plan <plans-root>`);
      process.exit(1);
    }
    const open = findOpenPlans(root);
    if (open.length === 0) {
      console.log("flow: no open plans (all features closed)");
    } else {
      console.log(`flow: ${open.length} open plan(s) under ${root}:`);
      for (const p of open) {
        console.log(p.state ? `  ${summarizeState(p.state)}` : `  ${p.slug} — ⚠️ unreadable state.json`);
      }
    }
    process.exit(0);
  }

  try {
    const planDir = flag("plan") ?? detectPlanDir(".claude/plans");
    await runCommand(command ?? "", args, {
      planDir,
      date: new Date().toISOString().slice(0, 10),
      files: flag("files")?.split(",").map((f) => f.trim()),
      note: flag("note"),
      testsPassed: parseTestsPassed(flag("tests-passed")),
      verification: flag("verification") ? await Bun.file(flag("verification")!).json() : undefined,
      assessment: flag("review") ? await Bun.file(flag("review")!).json() : undefined,
      approval: flag("approval"),
    });
    console.log(`ok — ${command} applied to ${planDir}`);
  } catch (e) {
    console.error(`flow-state: ${(e as Error).message}`);
    process.exit(1);
  }
}
