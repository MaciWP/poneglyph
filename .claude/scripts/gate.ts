#!/usr/bin/env bun
// gate — deterministic validation of what an agent CLAIMS it did.
//
// Provenance: ported from disler's super-simple-software-factory (adws/adw_modules/gates.py),
// with three changes that its version does not have:
//   1. diff_matches_claims compares a DELTA against a baseline snapshot, not absolute
//      state. sssf only does Path.exists(), so a pre-existing file passes even when the
//      agent never touched it, and files touched but NOT declared are invisible to it.
//      This repo carries ~119 modified + ~24 untracked files at rest — absolute state
//      would be permanently red, and a permanently red gate gets ignored.
//   2. protected_files is DERIVED from the effective user/project settings
//      (permissions.deny + autoMode.soft_deny) instead of being a fourth
//      hand-maintained list.
//   3. self_integrity: an agent that can edit its own grader invalidates every other
//      gate, so a build phase that touches this file fails immediately.
//
// The workflow script that consumes this CANNOT import it (Workflow scripts have no
// filesystem), so the only consumer of this module is its own CLI plus the tests.
//
// Usage:
//   bun .claude/scripts/gate.ts baseline --out <path>
//   bun .claude/scripts/gate.ts check --phase plan|build|review|document \
//       --envelope <path> [--baseline <path>] [--check-command "bun test"]
//
// Emits ONE line of JSON on stdout and exits 0 (passed) or 1 (failed), so the caller
// decides from the exit code and never has to interpret prose.

import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Check {
  name: string;
  passed: boolean;
  note: string;
}

export interface GateReport {
  phase: string;
  passed: boolean;
  checks: Check[];
  violations: string[];
}

/** What an agent hands back. Every field is a CLAIM until a gate verifies it. */
export interface Envelope {
  artifacts?: string[];
  files_touched?: string[];
  /** review envelopes */
  approved?: boolean;
  blocking?: string[];
  findings?: { requirement: string; met: boolean }[];
  /** build envelopes */
  status?: string;
  tests_passed?: boolean;
}

/**
 * path -> "<git porcelain status code>:<content digest>", e.g. " M:a3f1c2".
 *
 * The digest is load-bearing, not decoration. The status code alone describes STATE, not
 * content: a file already listed as "??" that an agent edits further is still "??", so a
 * code-only snapshot shows no delta and the gate reports the change as never made. That
 * is precisely the dirty-tree case the baseline exists for.
 */
export type Snapshot = Record<string, string>;

/** Files this repo's own machinery must survive; a build touching them is a red flag. */
export const SELF_PATHS = [
  ".claude/scripts/gate.ts",
  ".claude/workflows/sssf.js",
  // The tests belong here too: an agent that guts the assertions turns the suite green
  // without touching the graders themselves — the same failure this check exists to stop.
  ".claude/scripts/__tests__/gate.test.ts",
  ".claude/workflows/__tests__/sssf.test.ts",
];

/**
 * Write allowlist per phase — the genuinely new contribution over sssf's roster-wide
 * `writes:`. null means unrestricted (still subject to protected_files).
 * An empty array means read-only: a reviewer that cannot fix cannot quietly fix.
 */
export const PHASE_WRITES: Record<string, string[] | null> = {
  plan: ["specs/**", "**/*.md"],
  build: null,
  review: [],
  document: ["**/*.md", "app_docs/**", "docs/**"],
};

// ---------------------------------------------------------------------------
// Pure functions — the testable core. No I/O beyond fs stat where stated.
// ---------------------------------------------------------------------------

/**
 * A review's verdict must agree with the findings it just wrote down.
 * Nothing here judges the code: it checks the envelope against itself, which the
 * harness can refute without reading a line of the diff.
 *
 * Extended past sssf: an `approved` that ships a red suite, and a `done` that
 * touched nothing, are the same class of self-contradiction and cost nothing to catch.
 */
export function verdictConsistent(env: Envelope): Check[] {
  const checks: Check[] = [];
  const approved = Boolean(env.approved);
  const blocking = env.blocking ?? [];
  const unmet = (env.findings ?? []).filter((f) => !f.met).map((f) => f.requirement);

  // Verdict checks apply only to envelopes that CARRY a verdict. A build envelope has
  // no `approved` field, and reading its absence as "rejected" would fail every build
  // on "rejection names a problem" — caught by the first smoke run against the repo.
  if (env.approved !== undefined) {
    checks.push({
      name: "approved vs blocking",
      passed: !(approved && blocking.length > 0),
      note: blocking.length === 0 ? "no blocking items" : `${blocking.length} blocking item(s)${approved ? " while approved=true" : ", not approved"}`,
    });
    checks.push({
      name: "approved vs findings",
      passed: !(approved && unmet.length > 0),
      note: unmet.length === 0 ? "every requirement met" : `${unmet.length} unmet requirement(s)${approved ? " while approved=true" : ", not approved"}`,
    });
    checks.push({
      name: "rejection names a problem",
      passed: approved || blocking.length > 0 || unmet.length > 0,
      note: approved || blocking.length > 0 || unmet.length > 0 ? "verdict is supported" : "approved=false but no blocking item or unmet requirement was given",
    });

    if (env.tests_passed === false) {
      checks.push({
        name: "approved vs suite",
        passed: !approved,
        note: approved ? "approved=true while the suite is red" : "not approved, suite red — consistent",
      });
    }
  }
  if (env.status === "done") {
    const touched = env.files_touched ?? [];
    checks.push({
      name: "done vs files_touched",
      passed: touched.length > 0,
      note: touched.length > 0 ? `${touched.length} file(s) claimed` : 'status="done" but files_touched is empty',
    });
  }
  return checks;
}

/** Paths whose git status changed between two snapshots — i.e. what actually moved. */
export function diffDelta(before: Snapshot, after: Snapshot): string[] {
  const changed: string[] = [];
  for (const [path, code] of Object.entries(after)) {
    if (before[path] !== code) changed.push(path);
  }
  // A path that disappeared from the porcelain list also moved (e.g. reverted).
  for (const path of Object.keys(before)) {
    if (!(path in after)) changed.push(path);
  }
  return changed.sort();
}

/**
 * Cross the agent's claims against the measured delta. Both directions matter:
 * `missing` catches a file claimed but never touched; `undeclared` catches work the
 * agent did not report — the blind spot sssf's gate has entirely.
 */
export function claimsVsDelta(
  claimed: string[],
  delta: string[],
  ignore: string[] = [],
): { missing: string[]; undeclared: string[] } {
  const isIgnored = (p: string) => ignore.some((prefix) => p.startsWith(prefix));
  const deltaSet = new Set(delta.filter((p) => !isIgnored(p)));
  const claimedSet = new Set(claimed.filter((p) => !isIgnored(p)));
  return {
    missing: [...claimedSet].filter((p) => !deltaSet.has(p)).sort(),
    undeclared: [...deltaSet].filter((p) => !claimedSet.has(p)).sort(),
  };
}

/**
 * Turn one or more settings deny lists into path patterns. Reads permissions.deny and
 * autoMode.soft_deny so the protected set tracks the config instead of drifting
 * from a copy (system-inventory already flags hand-synced lists as known friction).
 */
export function derivePatterns(settings: unknown | unknown[]): string[] {
  const sources = Array.isArray(settings) ? settings : [settings];
  const patterns = new Set<string>();
  for (const source of sources) {
    const s = source as { permissions?: { deny?: string[] }; autoMode?: { soft_deny?: string[]; hard_deny?: string[] } };
    const entries = [...(s?.permissions?.deny ?? []), ...(s?.autoMode?.soft_deny ?? []), ...(s?.autoMode?.hard_deny ?? [])];
    for (const entry of entries) {
      // Only write-shaped rules bound what an agent may leave behind; Bash(...) and
      // Read(...) rules are about running and reading, not about mutating the tree.
      const m = /^(?:Edit|Write)\((.+)\)$/.exec(entry.trim());
      if (m) patterns.add(m[1].replace(/^\.\//, ""));
    }
  }
  return [...patterns].sort();
}

/** Glob match, tolerant of the loose patterns permission rules use (`*secret*`, `.env`). */
export function matchPattern(path: string, pattern: string): boolean {
  const clean = path.replace(/^\.\//, "");
  const base = clean.split("/").pop() ?? clean;
  if (pattern === clean || pattern === base) return true;
  try {
    const glob = new Bun.Glob(pattern);
    if (glob.match(clean) || glob.match(base)) return true;
    // `*.pem` should also catch `dir/foo.pem`: permission patterns are written
    // basename-first but apply anywhere in the tree.
    if (!pattern.includes("/")) return new Bun.Glob(`**/${pattern}`).match(clean);
  } catch {
    return false;
  }
  return false;
}

/** Which of these paths are off-limits, given the derived patterns. */
export function protectedHit(paths: string[], patterns: string[]): string[] {
  return paths.filter((p) => patterns.some((pat) => matchPattern(p, pat))).sort();
}

/** Which paths fall outside a phase's write allowlist. null allowlist = unrestricted. */
export function outsideAllowlist(paths: string[], allow: string[] | null): string[] {
  if (allow === null) return [];
  return paths.filter((p) => !allow.some((pat) => matchPattern(p, pat))).sort();
}

/**
 * Read a suite result. The exit code is the primary signal — bun/jest output formats
 * are not pinned and parsing counts as the source of truth couples us to a format
 * that changes between versions. Counts are advisory. A suite that ran ZERO tests is
 * RED: a suite that did not run is not a green suite.
 */
export function parseSuite(exitCode: number, output: string): { ok: boolean; pass: number; fail: number; ran: number; note: string } {
  const pass = Number(/(\d+)\s+pass/.exec(output)?.[1] ?? 0);
  const fail = Number(/(\d+)\s+fail/.exec(output)?.[1] ?? 0);
  const ran = pass + fail;
  if (ran === 0) {
    return { ok: false, pass, fail, ran, note: "the suite reported 0 tests — a suite that did not run is not a green suite" };
  }
  if (exitCode !== 0) {
    return { ok: false, pass, fail, ran, note: `exit ${exitCode} (${pass} pass / ${fail} fail)` };
  }
  // Exit 0 with parsed failures means the two signals disagree; trust neither.
  if (fail > 0) {
    return { ok: false, pass, fail, ran, note: `exit 0 but output reports ${fail} failure(s) — contradictory signals` };
  }
  return { ok: true, pass, fail, ran, note: `exit 0, ${pass} pass` };
}

/** Fold checks into a report; any failed check fails the gate (fail-closed). */
export function report(phase: string, checks: Check[]): GateReport {
  const violations = checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.note}`);
  return { phase, passed: violations.length === 0, checks, violations };
}

// ---------------------------------------------------------------------------
// I/O — kept thin so the logic above stays testable.
// ---------------------------------------------------------------------------

/** Content fingerprint of one path. Absent/unreadable are distinct states, not errors. */
export async function fileDigest(path: string): Promise<string> {
  try {
    const f = Bun.file(path);
    if (!(await f.exists())) return "absent";
    return Bun.hash(new Uint8Array(await f.arrayBuffer())).toString(16);
  } catch {
    return "unreadable";
  }
}

export async function snapshot(): Promise<Snapshot> {
  const proc = Bun.spawn(["git", "status", "--porcelain=v1", "-uall"], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  const paths: Array<{ path: string; code: string }> = [];
  for (const line of out.split("\n")) {
    if (line.length < 4) continue;
    // Porcelain v1: two status chars, a space, then the path (renames use " -> ").
    const code = line.slice(0, 2);
    const path = (line.slice(3).trim().split(" -> ").pop() ?? "").replace(/^"|"$/g, "");
    if (path) paths.push({ path, code });
  }
  const digests = await Promise.all(paths.map((p) => fileDigest(p.path)));
  const snap: Snapshot = {};
  paths.forEach((p, i) => {
    snap[p.path] = `${p.code}:${digests[i]}`;
  });
  return snap;
}

export async function runSuite(command: string): Promise<{ exitCode: number; output: string }> {
  const proc = Bun.spawn(["sh", "-c", command], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  const exitCode = await proc.exited;
  return { exitCode, output: stdout + stderr };
}

function artifactChecks(env: Envelope): Check[] {
  const checks: Check[] = [];
  for (const a of env.artifacts ?? []) {
    const exists = existsSync(a);
    if (!exists) {
      checks.push({ name: `artifact ${a}`, passed: false, note: "declared artifact does not exist" });
      continue;
    }
    const size = statSync(a).size;
    checks.push({
      name: `artifact ${a}`,
      passed: size > 0,
      note: size > 0 ? `exists, ${size < 1024 ? `${size}B` : `${(size / 1024).toFixed(1)}KB`}` : "declared artifact is empty",
    });
  }
  return checks;
}

export async function check(opts: {
  phase: string;
  envelope: Envelope;
  baseline?: Snapshot;
  checkCommand?: string;
  ignore?: string[];
  settings?: unknown;
}): Promise<GateReport> {
  const checks: Check[] = [...artifactChecks(opts.envelope), ...verdictConsistent(opts.envelope)];

  if (opts.baseline) {
    const after = await snapshot();
    const delta = diffDelta(opts.baseline, after);
    const { missing, undeclared } = claimsVsDelta(opts.envelope.files_touched ?? [], delta, opts.ignore ?? []);
    checks.push({
      name: "diff_matches_claims: declared were touched",
      passed: missing.length === 0,
      note: missing.length === 0 ? `${(opts.envelope.files_touched ?? []).length} claim(s) confirmed in the delta` : `claimed but not changed: ${missing.join(", ")}`,
    });
    checks.push({
      name: "diff_matches_claims: nothing undeclared",
      passed: undeclared.length === 0,
      note: undeclared.length === 0 ? "no undeclared changes" : `changed but not declared: ${undeclared.join(", ")}`,
    });

    const patterns = derivePatterns(opts.settings ?? {});
    const hits = protectedHit(delta, patterns);
    checks.push({
      name: "protected_files",
      passed: hits.length === 0,
      note: hits.length === 0 ? `${patterns.length} pattern(s) checked, no hit` : `protected path(s) modified: ${hits.join(", ")}`,
    });

    const outside = outsideAllowlist(delta, PHASE_WRITES[opts.phase] ?? null);
    checks.push({
      name: `phase allowlist (${opts.phase})`,
      passed: outside.length === 0,
      note: outside.length === 0 ? "every change is inside the phase's write scope" : `outside this phase's scope: ${outside.join(", ")}`,
    });

    const selfHits = delta.filter((p) => SELF_PATHS.includes(p));
    checks.push({
      name: "self_integrity",
      passed: selfHits.length === 0,
      note: selfHits.length === 0 ? "the gate and the workflow are untouched" : `an agent modified its own grader: ${selfHits.join(", ")}`,
    });
  }

  if (opts.checkCommand) {
    const { exitCode, output } = await runSuite(opts.checkCommand);
    const suite = parseSuite(exitCode, output);
    checks.push({ name: `tests_pass (${opts.checkCommand})`, passed: suite.ok, note: suite.note });
  }

  return report(opts.phase, checks);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const command = argv.find((a) => !a.startsWith("--") && !argv[argv.indexOf(a) - 1]?.startsWith("--"));

  try {
    if (command === "baseline") {
      const out = flag("out");
      if (!out) throw new Error("baseline requires --out <path>");
      await Bun.write(out, JSON.stringify(await snapshot(), null, 2) + "\n");
      console.log(JSON.stringify({ ok: true, baseline: out }));
      process.exit(0);
    }

    if (command === "check") {
      const envelopePath = flag("envelope");
      if (!envelopePath) throw new Error("check requires --envelope <path>");
      const envelope: Envelope = await Bun.file(envelopePath).json();
      const baselinePath = flag("baseline");
      const explicitSettings = flag("settings");
      const settingsPaths = explicitSettings
        ? [explicitSettings]
        : [
            join(homedir(), ".claude", "settings.json"),
            ".claude/settings.global.json",
            ".claude/settings.json",
          ];
      const result = await check({
        phase: flag("phase") ?? "build",
        envelope,
        baseline: baselinePath ? await Bun.file(baselinePath).json() : undefined,
        checkCommand: flag("check-command"),
        // The run's own session directory must never count as agent work, or the
        // gate poisons itself: every envelope it writes would be an undeclared change.
        ignore: (flag("ignore") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        settings: await Promise.all(
          settingsPaths
            .filter((settingsPath) => existsSync(settingsPath))
            .map((settingsPath) => Bun.file(settingsPath).json()),
        ),
      });
      console.log(JSON.stringify(result));
      process.exit(result.passed ? 0 : 1);
    }

    throw new Error(`unknown command "${command ?? ""}" — baseline | check`);
  } catch (e) {
    console.log(JSON.stringify({ phase: flag("phase") ?? "?", passed: false, checks: [], violations: [`gate error: ${(e as Error).message}`] }));
    process.exit(1);
  }
}
