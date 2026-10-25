#!/usr/bin/env bun
// log-pose eval v3 scorer (plans/044-effort-advisor-mod/eval-v3.md).
//
// bun .claude/evals/log-pose-v3-score.ts [--split test|tune|all] [--judge opus] [--runs 1,2,3] [--json out.json]
//   Scores every arm in private/v3/arms/ on the five decisions against the hindsight judge,
//   checks the judge against the user's labels (Cohen's kappa), and reports paired deltas with
//   bootstrap 95 % intervals and McNemar p-values. Latency and cost come from the first run (sequential).
//   Dictation counts only fixes whose term is in the glossary (the only ones the router may emit);
//   the dictation judge's accepted pairs (private/v3/dictation-sonnet.jsonl) extend the gold.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MATRIX, soundsLike } from "../../plugins/log-pose/hooks/core";
import { foldText } from "../hooks/skill-activation";
import { glossaryFiles, loadCatalog, loadGlossary, parseRouterOutput } from "../hooks/prompt-router";
import { ARMS, V3_DIR } from "./log-pose-v3";

type Diff = "easy" | "normal" | "hard";
type Unc = "clear" | "some-doubt" | "unclear";
type Labels = { difficulty: Diff; uncertainty: Unc; continuity: "same" | "new" };
type Fix = { heard: string; meant: string };
type Pred = { parallel?: number; skills: Set<string>; fixes: Fix[]; labels: Labels | null; effortHigh: boolean | null; ms: number; outcome: string; cost: number | null; output: number | null; effort?: string };
type Gold = Labels & { skills: Set<string>; fixes: Fix[]; changedCourse: boolean };

const PRICES: Record<string, { in: number; read: number; out: number }> = { haiku: { in: 0.1, read: 0.01, out: 0.5 }, sonnet: { in: 2, read: 0.1, out: 10 } };
const LIVE_TIMEOUTS = [8_000, 10_000];
const B = 2000;

const argv = process.argv.slice(2);
const arg = (n: string, f: string) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] ?? f : f);
const jsonl = <T>(f: string): T[] => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T) : []);

// --- Inputs ---

const sample = jsonl<{ id: string; text: string; split: string }>(join(V3_DIR, "sample.jsonl"));
const split = arg("--split", "test");
const ids = sample.filter((s) => split === "all" || s.split === split).map((s) => s.id);
const textOf = new Map(sample.map((s) => [s.id, s.text.slice(0, 3000)]));

const RUNS = arg("--runs", "1,2,3").split(",").map(Number);
// Disputed fixes the dictation judge accepted, blind to the arm that proposed them.
const accepted = jsonl<Fix & { id: string; ok: boolean }>(join(V3_DIR, "dictation-sonnet.jsonl")).filter((d) => d.ok);
const judge = new Map(jsonl<any>(join(V3_DIR, `judge-${arg("--judge", "opus")}.jsonl`)).map((j) => [j.id, {
  difficulty: j.difficulty, uncertainty: j.uncertainty, continuity: j.continuity, changedCourse: j.changedCourse,
  skills: new Set<string>([...j.skills, ...j.process]), fixes: [...j.fixes, ...accepted.filter((d) => d.id === j.id)],
} as Gold]));
const user = new Map(jsonl<any>(join(V3_DIR, "labels.jsonl")).map((u) => [u.id, u])); // last write wins

const cwd = join(import.meta.dir, "..", "..");
const catalog = loadCatalog(cwd);
const glossary = loadGlossary(glossaryFiles(cwd));
const variantsOf = new Map(Object.entries(glossary).map(([t, v]) => [foldText(t), v]));
// The mod arms kept the fixes their filter of the day let through; today's filter applies to all.
const sounds = (f: Fix) => variantsOf.has(foldText(f.meant)) && soundsLike(f.heard, f.meant, variantsOf.get(foldText(f.meant))!);

function readArm(name: string, run: number): Map<string, Pred> | null {
  const file = join(V3_DIR, "arms", `${name}-${run}.jsonl`);
  if (!existsSync(file)) return null;
  const arm = ARMS[name]!;
  const out = new Map<string, Pred>();
  for (const r of jsonl<any>(file)) {
    if (arm === "hook") {
      const res = r.outcome === "ok" ? parseRouterOutput(r.stdout, textOf.get(r.id) ?? "", catalog, { glossary }) : null;
      out.set(r.id, { skills: new Set(res?.skills.map((s) => s.name) ?? []), fixes: res?.fixes ?? [], labels: null, effortHigh: res ? Boolean(res.effort) : null, parallel: r.parallel, ms: r.ms, outcome: res ? r.outcome : r.outcome === "ok" ? "bad-output" : r.outcome, cost: r.cost, output: r.output });
    } else {
      const p = PRICES[arm.model]!;
      const cost = r.output == null ? null : ((r.input - r.read) * p.in + r.read * p.read + r.output * p.out) / 1e6;
      out.set(r.id, { skills: new Set((r.skills ?? []).map((s: { name: string }) => s.name)), fixes: (r.fixes ?? []).filter(sounds), labels: r.labels, effortHigh: null, ms: r.ms, outcome: r.outcome, cost, output: r.output });
    }
  }
  return out;
}

// --- Statistics ---

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? NaN; };

// A metric is a function of per-case rows; the bootstrap resamples cases, paired across arms.
function bootstrap<T>(rows: T[], metric: (rs: T[]) => number, seed = 1): [number, number] {
  const rand = rng(seed);
  const vals: number[] = [];
  for (let b = 0; b < B; b++) {
    const v = metric(rows.map(() => rows[Math.floor(rand() * rows.length)]!));
    if (!Number.isNaN(v)) vals.push(v); // a resample with no case for this metric
  }
  return [quantile(vals, 0.025), quantile(vals, 0.975)];
}

// Exact two-sided McNemar on discordant pairs.
function mcnemar(b: number, c: number): number {
  const n = b + c;
  if (!n) return 1;
  let p = 0;
  const k = Math.min(b, c);
  let comb = 1;
  for (let i = 0; i <= k; i++) { if (i) comb = (comb * (n - i + 1)) / i; p += comb; }
  return Math.min(1, (2 * p) / 2 ** n);
}

function kappa(pairs: [string, string][], weights?: string[]): number {
  if (!pairs.length) return NaN;
  const cats = weights ?? [...new Set(pairs.flat())];
  const w = (a: string, b: string) => (weights ? 1 - ((cats.indexOf(a) - cats.indexOf(b)) / (cats.length - 1)) ** 2 : a === b ? 1 : 0);
  const n = pairs.length;
  const po = pairs.reduce((s, [a, b]) => s + w(a, b), 0) / n;
  const pa = (c: string) => pairs.filter(([a]) => a === c).length / n;
  const pb = (c: string) => pairs.filter(([, b]) => b === c).length / n;
  let pe = 0;
  for (const a of cats) for (const b of cats) pe += pa(a) * pb(b) * w(a, b);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

// --- Per-case scoring ---

const fold = (s: string) => foldText(s).replace(/[^a-z0-9]+/g, " ").trim();
const DIFF: Diff[] = ["easy", "normal", "hard"];
const UNC: Unc[] = ["clear", "some-doubt", "unclear"];
const effortOf = (l: Labels) => MATRIX[l.difficulty][l.uncertainty].effort;
const gaugeOf = (l: Labels) => MATRIX[l.difficulty][l.uncertainty].gauge;
const high = (e: string) => e === "high" || e === "xhigh";

type Row = {
  id: string; tp: number; fp: number; fn: number; goldEmpty: boolean; anyPick: boolean; hit: boolean | null;
  fixTp: number; fixFp: number; fixFn: number;
  diffOk: boolean | null; swap: boolean | null; uncOk: boolean | null; contOk: boolean | null; effortOk: boolean | null; under: boolean | null;
  highOk: boolean | null; gaugeHit: boolean | null; changed: boolean; labelled: boolean; jump: boolean | null; pe: string | null;
  pd?: Diff; gd: Diff; pu?: Unc; gu: Unc;
};

function rowOf(id: string, p: Pred | undefined, g: Gold): Row {
  const picks = p?.skills ?? new Set<string>();
  const tp = [...picks].filter((s) => g.skills.has(s)).length;
  const inGlossary = (f: Fix) => variantsOf.has(foldText(f.meant));
  const gf = new Set(g.fixes.filter(inGlossary).map((f) => fold(f.heard)));
  const pf = new Set((p?.fixes ?? []).filter(inGlossary).map((f) => fold(f.heard)));
  const fixTp = [...pf].filter((h) => gf.has(h)).length;
  const l = p?.labels ?? null;
  const ge = effortOf(g);
  // A fixed level (the always-medium row) or the arm's labels through the matrix.
  const pe = p?.effort ?? (l ? effortOf(l) : null);
  const lv = (e: string) => ["low", "medium", "high", "xhigh"].indexOf(e);
  return {
    id, tp, fp: picks.size - tp, fn: g.skills.size - tp, goldEmpty: g.skills.size === 0, anyPick: picks.size > 0,
    hit: g.skills.size ? tp > 0 : null,
    fixTp, fixFp: pf.size - fixTp, fixFn: gf.size - fixTp,
    diffOk: l ? l.difficulty === g.difficulty : null,
    swap: l ? Math.abs(DIFF.indexOf(l.difficulty) - DIFF.indexOf(g.difficulty)) === 2 : null,
    uncOk: l ? l.uncertainty === g.uncertainty : null,
    contOk: l ? l.continuity === g.continuity : null,
    effortOk: pe ? pe === ge : null,
    under: pe ? lv(pe) < lv(ge) : null,
    jump: pe ? Math.abs(lv(pe) - lv(ge)) >= 2 : null, pe,
    // The one effort signal the hook gives: high or not.
    highOk: pe ? high(pe) === high(ge) : p?.effortHigh != null ? p.effortHigh === high(ge) : null,
    gaugeHit: l && g.changedCourse ? gaugeOf(l) >= 2 : null,
    changed: g.changedCourse, labelled: Boolean(l), pd: l?.difficulty, gd: g.difficulty, pu: l?.uncertainty, gu: g.uncertainty,
  };
}

const sum = (rs: Row[], k: keyof Row) => rs.reduce((s, r) => s + (Number(r[k]) || 0), 0);
const rate = (rs: Row[], k: keyof Row) => { const xs = rs.filter((r) => r[k] !== null); return xs.length ? xs.filter((r) => r[k]).length / xs.length : NaN; };
const METRICS: Record<string, (rs: Row[]) => number> = {
  "skills P": (rs) => sum(rs, "tp") / Math.max(1, sum(rs, "tp") + sum(rs, "fp")),
  "skills R": (rs) => sum(rs, "tp") / Math.max(1, sum(rs, "tp") + sum(rs, "fn")),
  "skills F1": (rs) => { const tp = sum(rs, "tp"); return (2 * tp) / Math.max(1, 2 * tp + sum(rs, "fp") + sum(rs, "fn")); },
  "hit@3": (rs) => rate(rs, "hit"),
  "FP on empty": (rs) => { const e = rs.filter((r) => r.goldEmpty); return e.length ? e.filter((r) => r.anyPick).length / e.length : NaN; },
  "fix P": (rs) => sum(rs, "fixTp") / Math.max(1, sum(rs, "fixTp") + sum(rs, "fixFp")),
  "fix R": (rs) => sum(rs, "fixTp") / Math.max(1, sum(rs, "fixTp") + sum(rs, "fixFn")),
  difficulty: (rs) => rate(rs, "diffOk"),
  "diff macro-F1": (rs) => {
    const xs = rs.filter((r) => r.pd);
    if (!xs.length) return NaN;
    return DIFF.reduce((s, c) => {
      const tp = xs.filter((r) => r.pd === c && r.gd === c).length, fp = xs.filter((r) => r.pd === c && r.gd !== c).length, fn = xs.filter((r) => r.pd !== c && r.gd === c).length;
      return s + (2 * tp) / Math.max(1, 2 * tp + fp + fn);
    }, 0) / DIFF.length;
  },
  "easy↔hard": (rs) => rate(rs, "swap"),
  uncertainty: (rs) => rate(rs, "uncOk"),
  continuity: (rs) => rate(rs, "contOk"),
  effort: (rs) => rate(rs, "effortOk"),
  "under-effort": (rs) => rate(rs, "under"),
  "2-level jumps": (rs) => rate(rs, "jump"),
  ...Object.fromEntries(["low", "medium", "high", "xhigh"].map((e) => [`${e} share`, (rs: Row[]) => { const xs = rs.filter((r) => r.pe); return xs.length ? xs.filter((r) => r.pe === e).length / xs.length : NaN; }])),
  "high y/n": (rs) => rate(rs, "highOk"),
  "gauge≥2 | changed": (rs) => rate(rs, "gaugeHit"),
};
// Paired binary outcome per metric for McNemar, where one exists.
const BINARY: Record<string, keyof Row> = { "hit@3": "hit", difficulty: "diffOk", uncertainty: "uncOk", continuity: "contOk", effort: "effortOk", "high y/n": "highOk" };

// --- Report ---

const report: any = { split, n: ids.length, judged: ids.filter((i) => judge.has(i)).length, kappa: {}, arms: {} };

// Judge vs user, per decision.
const both = [...user.keys()].filter((i) => judge.has(i));
report.kappa = {
  n: both.length,
  difficulty: kappa(both.map((i) => [user.get(i).difficulty, judge.get(i)!.difficulty])),
  "difficulty (weighted)": kappa(both.map((i) => [user.get(i).difficulty, judge.get(i)!.difficulty]), DIFF),
  uncertainty: kappa(both.map((i) => [user.get(i).uncertainty, judge.get(i)!.uncertainty])),
  "uncertainty (weighted)": kappa(both.map((i) => [user.get(i).uncertainty, judge.get(i)!.uncertainty]), UNC),
  continuity: kappa(both.map((i) => [user.get(i).continuity, judge.get(i)!.continuity])),
  changedCourse: kappa(both.map((i) => [user.get(i).changedCourse, judge.get(i)!.changedCourse ? "yes" : "no"])),
};

// Second judge (another model, same prompt): inter-judge agreement stands in for user labels.
const judge2 = new Map(jsonl<any>(join(V3_DIR, `judge-${arg("--judge2", "sonnet")}.jsonl`)).map((j) => [j.id, j]));
const two = ids.filter((i) => judge.has(i) && judge2.has(i));
const jac = (a: Set<string>, b: Set<string>) => (a.size + b.size ? [...a].filter((x) => b.has(x)).length / new Set([...a, ...b]).size : 1);
report.judges = {
  n: two.length,
  difficulty: kappa(two.map((i) => [judge.get(i)!.difficulty, judge2.get(i).difficulty])),
  "difficulty (weighted)": kappa(two.map((i) => [judge.get(i)!.difficulty, judge2.get(i).difficulty]), DIFF),
  uncertainty: kappa(two.map((i) => [judge.get(i)!.uncertainty, judge2.get(i).uncertainty])),
  "uncertainty (weighted)": kappa(two.map((i) => [judge.get(i)!.uncertainty, judge2.get(i).uncertainty]), UNC),
  continuity: kappa(two.map((i) => [judge.get(i)!.continuity, judge2.get(i).continuity])),
  changedCourse: kappa(two.map((i) => [String(judge.get(i)!.changedCourse), String(judge2.get(i).changedCourse)])),
  effort: kappa(two.map((i) => [effortOf(judge.get(i)!), effortOf(judge2.get(i))]), ["low", "medium", "high", "xhigh"]),
  "skills Jaccard": two.reduce((s, i) => s + jac(judge.get(i)!.skills, new Set([...judge2.get(i).skills, ...judge2.get(i).process])), 0) / Math.max(1, two.length),
};
// Cases the two judges read far apart: the short list to settle together.
report.disputes = two.filter((i) => {
  const a = judge.get(i)!, b = judge2.get(i);
  return Math.abs(DIFF.indexOf(a.difficulty) - DIFF.indexOf(b.difficulty)) === 2 || a.changedCourse !== b.changedCourse || high(effortOf(a)) !== high(effortOf(b));
}).map((i) => ({ id: i, text: (textOf.get(i) ?? "").slice(0, 160), opus: `${judge.get(i)!.difficulty}/${judge.get(i)!.uncertainty}/${judge.get(i)!.changedCourse}`, sonnet: `${judge2.get(i).difficulty}/${judge2.get(i).uncertainty}/${judge2.get(i).changedCourse}` }));

// Does the judge's difficulty track what the turn cost? Medians per class, Spearman on tool calls.
const facts = new Map(sample.map((s: any) => [s.id, s.facts]));
const toolsOf = (i: string) => Object.values<number>(facts.get(i)?.tools ?? {}).reduce((a, b) => a + b, 0);
const ranks = (xs: number[]) => { const o = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]); const r = new Array(xs.length); o.forEach(([, i], k) => (r[i] = k)); return r as number[]; };
const spearman = (a: number[], b: number[]) => { const ra = ranks(a), rb = ranks(b), n = a.length, m = (n - 1) / 2; let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (ra[i]! - m) * (rb[i]! - m); da += (ra[i]! - m) ** 2; db += (rb[i]! - m) ** 2; } return num / Math.sqrt(da * db); };
const jIds = ids.filter((i) => judge.has(i));
report.proxies = {
  byDifficulty: Object.fromEntries(DIFF.map((d) => { const xs = jIds.filter((i) => judge.get(i)!.difficulty === d); return [d, { n: xs.length, tools: quantile(xs.map(toolsOf), 0.5), files: quantile(xs.map((i) => facts.get(i)?.filesEdited ?? 0), 0.5), minutes: quantile(xs.map((i) => (facts.get(i)?.durationMs ?? 0) / 60000), 0.5) }]; })),
  "spearman difficulty~tools": spearman(jIds.map((i) => DIFF.indexOf(judge.get(i)!.difficulty)), jIds.map(toolsOf)),
  "changed: tool errors>0": rate(jIds.filter((i) => judge.get(i)!.changedCourse).map((i) => ({ x: (facts.get(i)?.toolErrors ?? 0) > 0 }) as any), "x" as any),
  "not changed: tool errors>0": rate(jIds.filter((i) => !judge.get(i)!.changedCourse).map((i) => ({ x: (facts.get(i)?.toolErrors ?? 0) > 0 }) as any), "x" as any),
};

const goldIds = ids.filter((i) => judge.has(i));
const rowsByArm = new Map<string, Row[]>();
for (const name of Object.keys(ARMS)) {
  const runs = RUNS.map((r) => readArm(name, r)).filter((m): m is Map<string, Pred> => m !== null);
  if (!runs.length) continue;
  const r1 = runs[0]!;
  const rows = goldIds.map((i) => rowOf(i, r1.get(i), judge.get(i)!));
  rowsByArm.set(name, rows);
  const metrics: Record<string, { v: number; ci: [number, number] }> = {};
  for (const [k, f] of Object.entries(METRICS)) { const v = f(rows); if (!Number.isNaN(v)) metrics[k] = { v, ci: bootstrap(rows, f) }; }
  // Mean over runs, to show run-to-run spread.
  const perRun = runs.map((m) => goldIds.map((i) => rowOf(i, m.get(i), judge.get(i)!)));
  const runSpread = Object.fromEntries(["skills F1", "difficulty", "effort", "high y/n"].map((k) => [k, perRun.map((rs) => METRICS[k]!(rs))]));
  // Flip rate: a case whose answer differs between any two runs.
  const key = (p?: Pred) => (p ? `${[...p.skills].sort().join(",")}|${p.labels ? `${p.labels.difficulty}/${p.labels.uncertainty}/${p.labels.continuity}` : p.effortHigh}` : "∅");
  const flips = runs.length > 1 ? goldIds.filter((i) => new Set(runs.map((m) => key(m.get(i)))).size > 1).length / goldIds.length : NaN;
  const skillFlips = runs.length > 1 ? goldIds.filter((i) => new Set(runs.map((m) => [...(m.get(i)?.skills ?? [])].sort().join(","))).size > 1).length / goldIds.length : NaN;
  // Rows run in parallel (the hook's, to save time) skew latency: only sequential rows count.
  const ms = ids.filter((i) => !r1.get(i)?.parallel).map((i) => r1.get(i)?.ms).filter((x): x is number => typeof x === "number");
  const costs = ids.map((i) => r1.get(i)?.cost).filter((x): x is number => typeof x === "number");
  const outs = ids.map((i) => r1.get(i)?.output).filter((x): x is number => typeof x === "number");
  const invalid = ids.filter((i) => r1.get(i)?.outcome === "bad-output").length;
  report.arms[name] = {
    runs: runs.length, metrics, runSpread, flips, skillFlips,
    latency: { p50: quantile(ms, 0.5), p95: quantile(ms, 0.95), max: Math.max(...ms), ...Object.fromEntries(LIVE_TIMEOUTS.map((t) => [`over ${t / 1000}s`, ms.filter((m) => m > t).length / ms.length])) },
    failures: ids.filter((i) => !["ok", "empty"].includes(r1.get(i)?.outcome ?? "missing")).length,
    labelled: rows.filter((r) => r.labelled).length,
    costPerPrompt: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null,
    outputP50: quantile(outs, 0.5), outputMean: outs.reduce((a, b) => a + b, 0) / Math.max(1, outs.length), invalid,
  };
}
// Today's behaviour without the mod: every prompt at Opus 5.5's default medium.
{
  const rows = goldIds.map((i) => rowOf(i, { skills: new Set(), fixes: [], labels: null, effortHigh: null, ms: 0, outcome: "ok", cost: null, output: null, effort: "medium" }, judge.get(i)!));
  rowsByArm.set("always-medium", rows);
  const metrics: Record<string, { v: number; ci: [number, number] }> = {};
  for (const k of ["effort", "under-effort", "2-level jumps", "high y/n"]) metrics[k] = { v: METRICS[k]!(rows), ci: bootstrap(rows, METRICS[k]!) };
  report.arms["always-medium"] = { runs: 1, metrics, latency: { p50: 0, p95: 0, max: 0 }, failures: 0, flips: NaN, skillFlips: NaN };
}
// Gold effort split, the target the arms' shares are read against.
report.goldShare = Object.fromEntries(["low", "medium", "high", "xhigh"].map((e) => [e, goldIds.filter((i) => effortOf(judge.get(i)!) === e).length / Math.max(1, goldIds.length)]));

// Paired deltas against a reference arm: the hook for skills and the high y/n signal, h-med for labels.
function deltas(ref: string) {
  const R = rowsByArm.get(ref);
  if (!R) return {};
  const out: Record<string, Record<string, { d: number; ci: [number, number]; p?: number }>> = {};
  for (const [name, rows] of rowsByArm) {
    if (name === ref) continue;
    out[name] = {};
    for (const [k, f] of Object.entries(METRICS)) {
      const pairs = rows.map((r, i) => [r, R[i]!] as const);
      const d = f(rows) - f(R);
      if (Number.isNaN(d)) continue;
      const ci = bootstrap(pairs, (ps) => f(ps.map((p) => p[0])) - f(ps.map((p) => p[1])));
      const bk = BINARY[k];
      let p: number | undefined;
      if (bk) {
        const ok = pairs.filter(([a, b]) => a[bk] !== null && b[bk] !== null);
        p = mcnemar(ok.filter(([a, b]) => a[bk] && !b[bk]).length, ok.filter(([a, b]) => !a[bk] && b[bk]).length);
      }
      out[name]![k] = { d, ci, p };
    }
  }
  return out;
}
report.vsHook = deltas("hook");
report.vsHMed = deltas("h-med");
report.vsStudy = deltas("s-none");

// User labels as gold, for the decisions whose judge kappa is low.
report.vsUser = {};
for (const [name, rows] of rowsByArm) {
  const r1 = readArm(name, RUNS[0]!);
  if (!r1) continue;
  const ur = [...user.keys()].filter((i) => r1.has(i)).map((i) => {
    const u = user.get(i);
    return rowOf(i, r1.get(i), { difficulty: u.difficulty, uncertainty: u.uncertainty, continuity: u.continuity, changedCourse: u.changedCourse === "yes", skills: judge.get(i)?.skills ?? new Set(), fixes: [] });
  });
  report.vsUser[name] = Object.fromEntries(["difficulty", "easy↔hard", "uncertainty", "continuity", "effort", "under-effort", "high y/n", "gauge≥2 | changed"].map((k) => [k, { v: METRICS[k]!(ur), n: ur.length }]));
  void rows;
}

const pct = (x: number) => (Number.isNaN(x) ? "—" : `${(x * 100).toFixed(0)}%`);
console.log(`split ${split}: ${report.n} cases, ${report.judged} judged, ${report.kappa.n} user-labelled`);
console.log("kappa Opus vs Sonnet judge:", Object.entries(report.judges).filter(([k]) => k !== "n").map(([k, v]) => `${k} ${(v as number).toFixed(2)}`).join(" · "), `(n ${report.judges.n}, disputes ${report.disputes.length})`);
console.log("proxies:", JSON.stringify(report.proxies));
// Gold fixes whose term is not in the glossary: the router may not emit them, so they sit outside fix P/R.
report.fixesOutside = goldIds.flatMap((i) => judge.get(i)!.fixes.filter((f) => !variantsOf.has(foldText(f.meant))).map((f) => `${f.heard} → ${f.meant}`));
console.log("gold effort share:", Object.entries<number>(report.goldShare).map(([k, v]) => `${k} ${pct(v)}`).join(" · "), `· dictation judge accepted ${accepted.length} · gold fixes outside the glossary ${report.fixesOutside.length}`);
if (report.kappa.n) console.log("kappa judge vs user:", Object.entries(report.kappa).filter(([k]) => k !== "n").map(([k, v]) => `${k} ${(v as number).toFixed(2)}`).join(" · "));
for (const [name, a] of Object.entries<any>(report.arms)) {
  console.log(`\n== ${name} (${a.runs} runs) p50 ${(a.latency.p50 / 1000).toFixed(1)}s p95 ${(a.latency.p95 / 1000).toFixed(1)}s max ${(a.latency.max / 1000).toFixed(1)}s >8s ${pct(a.latency["over 8s"])} fail ${a.failures} invalid ${a.invalid ?? "—"} cost ${a.costPerPrompt?.toFixed(5)} out mean ${a.outputMean?.toFixed(0) ?? "—"} flips ${pct(a.flips)} skillFlips ${pct(a.skillFlips)}`);
  console.log("  " + Object.entries<any>(a.metrics).map(([k, m]) => `${k} ${pct(m.v)} [${pct(m.ci[0])}-${pct(m.ci[1])}]`).join(" · "));
}
if (argv.includes("--json")) writeFileSync(arg("--json", join(V3_DIR, "report.json")), JSON.stringify(report, (_, v) => (v instanceof Set ? [...v] : v), 2));
