#!/usr/bin/env bun
// bun .claude/evals/router-heldout.ts --build [--days 30]
// bun .claude/evals/router-heldout.ts --judge
// bun .claude/evals/router-heldout.ts --score [--half odd|even] [--limit N] [--agent file] [--desc chars] [--memory]
//     [--catalog rewrites.json] [--picks out.jsonl] [--cases other.jsonl]
//
// Held-out check for the prompt router: would it have proposed the skill the user had
// to name? Cases come from this machine's transcripts:
//   - positive "typed": the user named a skill (`/x`, or `/x` as a slash command); the
//     whole invocation clause is stripped ("usa la skill /x", "con /x"), or recall is
//     inflated by leakage
//   - positive "autonomous": the main model called a skill on its own
//   - negative: no skill named or called, no mention of "skill"
// The cases hold real ticket text, so they live in `.claude/evals/private/` (gitignored);
// only this code is tracked. Output is counts and rates, never case text.
// Scoring runs the Haiku router (live `claude -p` calls; run it outside the Bash sandbox).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { collectTranscripts, percentile } from "../scripts/usage-profile";
import { loadSkillTurns, windowStart } from "../scripts/skill-usage";
import { foldText } from "../hooks/skill-activation";
import { buildSystemPrompt, glossaryFiles, loadCatalog, loadGlossary, loadRouterAgent, parseRouterOutput, ROUTER_AGENT_FILE, runRouter } from "../hooks/prompt-router";
import { caseFromTurn, formatPast, MEMORY_DAYS, MEMORY_MAX_AGE_MS, memoryFromTurns, type RouterCase, similarPast } from "../hooks/router/memory";
import { MID_TIER } from "../hooks/lib/headless-models";
import { claudeConfigDir } from "../hooks/lib/paths";

export { caseFromTurn, stripInvocation, type RouterCase } from "../hooks/router/memory";

const NEGATIVES = 60;

// Deterministic sample: the same transcripts give the same negatives.
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

function buildCases(turns: { text?: string; at?: number; named: string[]; called: string[] }[], catalog: Set<string>): RouterCase[] {
  const seen = new Set<string>();
  const cases: RouterCase[] = [];
  for (const t of turns) {
    if (!t.text) continue;
    const c = caseFromTurn(t.text, t.named, t.called, catalog);
    if (!c) continue;
    const key = foldText(c.prompt).slice(0, 300);
    if (seen.has(key)) continue;
    seen.add(key);
    cases.push(t.at ? { ...c, at: t.at } : c);
  }
  const negatives = cases.filter((c) => c.source === "negative").sort((a, b) => hash(a.prompt) - hash(b.prompt)).slice(0, NEGATIVES);
  return [...cases.filter((c) => c.source !== "negative"), ...negatives];
}

export interface Score { cases: number; hit: number; labels: number; found: number; picks: number; correct: number; negatives: number; falsePositives: number }

// hit: a positive case where at least one expected skill was picked. found/labels:
// recall per label. correct/picks: precision on positives, a floor (an extra pick may
// also fit). falsePositives: negatives with any pick.
export function score(rows: { c: RouterCase; picks: string[] }[]): Score {
  const s: Score = { cases: 0, hit: 0, labels: 0, found: 0, picks: 0, correct: 0, negatives: 0, falsePositives: 0 };
  for (const { c, picks } of rows) {
    if (c.source === "negative") { s.negatives++; if (picks.length) s.falsePositives++; continue; }
    s.cases++;
    s.labels += c.expected.length;
    s.found += c.expected.filter((e) => picks.includes(e)).length;
    s.picks += picks.length;
    s.correct += picks.filter((p) => c.expected.includes(p)).length;
    if (c.expected.some((e) => picks.includes(e))) s.hit++;
  }
  return s;
}

// "Not named" is not "no skill fits": a mid-tier judge labels every case blind to the
// router, and the gold set is the user's label plus the judge's. A case with an empty
// gold set is the only true negative.
const JUDGE_PROMPT = `You label a dataset. Read the user's prompt to a coding assistant inside <prompt> and list the skills from the catalog that a careful senior engineer would load to do this request well. Most follow-up replies, approvals, opinions and chit-chat need none. At most 3. Return ONLY {"skills": [{"name": string, "why": string}]}.

Catalog (name: description):
{{catalog}}`;

function withJudge(c: RouterCase, judge: string[] | undefined): RouterCase {
  const gold = [...new Set([...c.expected, ...(judge ?? [])])];
  return { ...c, expected: gold, source: gold.length ? (c.source === "negative" ? "autonomous" : c.source) : "negative" };
}

// Judge labels align by line with router-cases.jsonl; another cases file (--cases) gets none.
export function loadCases(casesFile: string, judgedFile: string | null): RouterCase[] {
  const lines = (f: string) => readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const judged: (string[] | null)[] = judgedFile && existsSync(judgedFile) ? lines(judgedFile) : [];
  const cases = lines(casesFile) as RouterCase[];
  // A stale judged file (cases rebuilt since) would silently label the wrong prompts.
  if (judged.length && judged.length !== cases.length) throw new Error(`${judgedFile} has ${judged.length} labels for ${cases.length} cases; rerun --judge after --build`);
  return cases.map((c, i) => (judged.length ? withJudge(c, judged[i] ?? undefined) : c));
}

const rate = (n: number, d: number) => (d ? (n / d).toFixed(2) : "—");

function render(name: string, s: Score, ms: number[] = []): string {
  const sorted = [...ms].sort((x, y) => x - y);
  const latency = ms.length ? ` · p50 ${(percentile(sorted, 0.5) / 1000).toFixed(1)} s, p95 ${(percentile(sorted, 0.95) / 1000).toFixed(1)} s` : "";
  return `${name}: hit@3 ${rate(s.hit, s.cases)} (${s.hit}/${s.cases}) · label recall ${rate(s.found, s.labels)} · precision ≥${rate(s.correct, s.picks)} · FP ${rate(s.falsePositives, s.negatives)} (${s.falsePositives}/${s.negatives})${latency}`;
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (flag: string, fallback: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : fallback; };
  const cwd = process.cwd();
  // .gitignore anchors .claude/evals/private/ at the repo root, so private files resolve from
  // this file, never from the cwd: a run elsewhere must not write cases into a tracked path.
  const privateDir = resolve(import.meta.dir, "private");
  const file = join(privateDir, "router-cases.jsonl");
  const judgedFile = join(privateDir, "router-judged.jsonl");
  // --catalog <json> ({name: description}) scores rewritten descriptions without touching SKILL.md.
  const rewrites = argv.includes("--catalog") ? JSON.parse(readFileSync(arg("--catalog", ""), "utf8")) as Record<string, string> : {};
  const catalog = loadCatalog(cwd, undefined, undefined, Number(arg("--desc", "600"))).map((c) => ({ ...c, description: rewrites[c.name] ?? c.description }));
  if (argv.includes("--build")) {
    const days = Number(arg("--days", "30"));
    const turns = loadSkillTurns(collectTranscripts(join(claudeConfigDir(), "projects"), days), windowStart(days), true);
    const cases = buildCases(turns, new Set(catalog.map((c) => c.name)));
    mkdirSync(privateDir, { recursive: true });
    writeFileSync(file, cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
    const by = (s: string) => cases.filter((c) => c.source === s).length;
    console.log(`${cases.length} cases → ${file}: typed ${by("typed")}, autonomous ${by("autonomous")}, negative ${by("negative")}`);
  } else if (argv.includes("--judge")) {
    const all = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as RouterCase);
    const judge = { name: "router-judge", definition: { description: "Labels the skills a prompt needs.", prompt: buildSystemPrompt(JUDGE_PROMPT, catalog, {}), model: MID_TIER } };
    let failed = 0;
    const judged = await pool(all, 4, async (c) => {
      const prompt = c.prompt.slice(0, 3000);
      const run = await runRouter(judge, prompt, null, 60_000);
      const result = run.outcome === "ok" ? parseRouterOutput(run.stdout, prompt, catalog) : null;
      if (!result) failed++;
      return result ? result.skills.map((s) => s.name) : null;
    });
    writeFileSync(judgedFile, judged.map((j) => JSON.stringify(j)).join("\n") + "\n");
    console.log(`judged ${all.length} cases (${failed} failed) → ${judgedFile}`);
  } else if (argv.includes("--score")) {
    // --cases <jsonl> scores another case set (e.g. synthetic) without judge labels.
    const casesFile = arg("--cases", file);
    if (!existsSync(casesFile)) throw new Error(`no cases: run --build first (${casesFile})`);
    const limit = Number(arg("--limit", "0"));
    const withGold = casesFile === file && existsSync(judgedFile);
    if (withGold) console.log("gold = user label + judge label");
    const all = loadCases(casesFile, withGold ? judgedFile : null);
    // --half odd tunes the router prompt, --half even is the untouched test half.
    const half = arg("--half", "");
    const picked = half ? all.filter((_, i) => i % 2 === (half === "odd" ? 1 : 0)) : all;
    const cases = limit ? picked.slice(0, limit) : picked;
    {
      const glossary = loadGlossary(glossaryFiles(cwd));
      // --memory gives each case the past prompts the live hook could have seen: only turns
      // older than the case by at least the index refresh age, so no case sees itself.
      const memory = argv.includes("--memory")
        ? memoryFromTurns(loadSkillTurns(collectTranscripts(join(claudeConfigDir(), "projects"), MEMORY_DAYS + 30), windowStart(MEMORY_DAYS + 30), true), new Set(catalog.map((c) => c.name)))
        : null;
      let withPast = 0;
      // --agent <file> scores a variant of the router agent without touching the live one.
      const agent = loadRouterAgent(arg("--agent", ROUTER_AGENT_FILE), catalog, glossary);
      const ms: number[] = [];
      let failed = 0;
      const rows = await pool(cases, 4, async (c) => {
        const started = Date.now();
        const prompt = c.prompt.slice(0, 3000);
        const pool = memory && c.at ? memory.filter((e) => e.at < c.at! - MEMORY_MAX_AGE_MS) : [];
        const past = similarPast(prompt, pool);
        if (past.length) withPast++;
        const run = await runRouter(agent, prompt, null, undefined, formatPast(past));
        ms.push(Date.now() - started);
        const result = run.outcome === "ok" ? parseRouterOutput(run.stdout, prompt, catalog, { glossary }) : null;
        if (!result) failed++;
        return { c, picks: result?.skills.map((s) => s.name) ?? [] };
      });
      console.log(render("stage 1 (Haiku router)", score(rows), ms) + ` · failed ${failed}` + (memory ? ` · with past ${withPast}/${cases.length}` : ""));
      // Per-case picks for error analysis; private like the cases.
      writeFileSync(arg("--picks", join(privateDir, "router-picks.jsonl")), rows.map((r) => JSON.stringify({ ...r.c, picks: r.picks })).join("\n") + "\n");
    }
  } else {
    console.log("usage: --build [--days 30] | --judge | --score [--half odd|even] [--limit N] [--agent file] [--desc chars] [--memory] [--catalog rewrites.json] [--picks out.jsonl] [--cases other.jsonl]");
  }
}
