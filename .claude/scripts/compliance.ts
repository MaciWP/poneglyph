#!/usr/bin/env bun
// bun run compliance [--days N]
//
// How often the doctrine (CLAUDE.md) and the house style are followed in real interactive
// turns, measured from the transcripts. Only rules a deterministic check judges reliably are
// here; judgement rules (method stages, scope, each fact said once) need a sampled LLM judge.
// The router answer is skill-usage.ts's job. Fable turns are left out: it is known to ignore
// the output style. ponytail: model families are a regex, update it when a family is added.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bannedOpeners, cardSeparators, esEsDetect, stripCode, stripFenced } from "../evals/graders";
import { humanPrompt, windowStart } from "./skill-usage";
import { collectTranscripts } from "./usage-profile";
import type { Status } from "./doctor";
import { claudeConfigDir } from "../hooks/lib/paths";

export interface ComplianceTurn {
  at?: number;
  model: string;
  stop?: string;
  texts: string[]; // visible assistant texts in order; the last one is the final answer
  bash: string[];
  edits: string[];
  errors: string[];
  asks: { questions?: unknown[] }[];
  spawns: { model?: string; type?: string }[];
  reviewed: boolean | null; // a check command ran after the last code edit; null without code edits
  sessionSkills: Set<string>; // skills loaded so far in the session, this turn included
}

const MODELS = /claude-(opus|sonnet|haiku)/;
const CODE = /\.(ts|tsx|js|jsx|py|go|rs|java|rb|astro|vue|svelte|css|scss|sql)$/;
const CHECK = /\b(test|pytest|vitest|jest|tsc|typecheck|lint|ruff|mypy|eslint|biome|check|doctor|build)\b/;
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

// Pure. One transcript's lines in, one entry per human turn that ended normally out.
export function parseComplianceTurns(lines: Iterable<string>): ComplianceTurn[] {
  const turns: ComplianceTurn[] = [];
  const sessionSkills = new Set<string>();
  const seen = new Set<string>(); // streamed records repeat content blocks
  let cur: ComplianceTurn | null = null;
  for (const line of lines) {
    let r: any;
    try { r = JSON.parse(line); } catch { continue; }
    if (r?.isSidechain || (r?.entrypoint && r.entrypoint !== "cli")) continue;
    const prompt = humanPrompt(r);
    if (prompt !== null) {
      if (cur) turns.push(cur);
      cur = { at: r.timestamp ? Date.parse(r.timestamp) : undefined, model: "", texts: [], bash: [], edits: [], errors: [], asks: [], spawns: [], reviewed: null, sessionSkills };
      continue;
    }
    if (!cur) continue;
    if (r.type === "user" && Array.isArray(r.message?.content)) {
      for (const b of r.message.content) if (b?.type === "tool_result" && b.is_error) cur.errors.push(typeof b.content === "string" ? b.content : JSON.stringify(b.content));
    }
    if (r.type !== "assistant" || r.message?.model === "<synthetic>") continue;
    cur.model = r.message?.model ?? cur.model;
    if (r.message?.stop_reason) cur.stop = r.message.stop_reason;
    for (const b of r.message?.content ?? []) {
      const key = `${r.message?.id}:${JSON.stringify(b).slice(0, 200)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (b.type === "text" && b.text?.trim()) cur.texts.push(b.text);
      if (b.type !== "tool_use") continue;
      const i = b.input ?? {};
      if (b.name === "Agent" || b.name === "Task") cur.spawns.push({ model: i.model, type: i.subagent_type });
      if (b.name === "AskUserQuestion") cur.asks.push(i);
      if (b.name === "Skill" && typeof i.skill === "string") sessionSkills.add(i.skill);
      if (b.name === "Bash") {
        cur.bash.push(String(i.command ?? ""));
        if (cur.reviewed === false && CHECK.test(String(i.command ?? ""))) cur.reviewed = true;
      }
      if (EDIT_TOOLS.has(b.name)) {
        cur.edits.push(String(i.file_path ?? ""));
        if (CODE.test(String(i.file_path ?? ""))) cur.reviewed = false;
      }
    }
  }
  if (cur) turns.push(cur);
  return turns.filter((t) => t.texts.length && t.stop === "end_turn" && MODELS.test(t.model));
}

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const final = (t: ComplianceTurn) => t.texts.at(-1)!;
const mids = (t: ComplianceTurn) => t.texts.slice(0, -1);
const CONFIG = /\.claude\/(skills|hooks|output-styles|rules|commands|agents|settings)|CLAUDE\.md|AGENTS\.md/;
const SENSITIVE = /(^|\/)(\.env[^/]*|package\.json|[^/]*\.lock|settings[^/]*\.json)$|\/(secrets|credentials)\//;
const TICS = /\b(cabe destacar|es importante señalar|crucial|fundamental|robust[oa]|potenciar|en resumen|en definitiva|espero que te sirva|vamos a sumergirnos)\b/i;

// null = the rule does not apply to this turn.
export interface Rule { id: string; source: "CLAUDE.md" | "style"; rule: string; check: (t: ComplianceTurn) => boolean | null }

export const RULES: Rule[] = [
  { id: "C-REVIEW", source: "CLAUDE.md", rule: "checks run after the last code edit", check: (t) => t.reviewed },
  { id: "C-RETRY", source: "CLAUDE.md", rule: "no third identical failure", check: (t) => {
    if (t.errors.length < 2) return null;
    const n: Record<string, number> = {};
    for (const e of t.errors) { const k = e.replace(/\d+/g, "#").slice(0, 80); n[k] = (n[k] ?? 0) + 1; }
    return Math.max(...Object.values(n)) < 3;
  } },
  { id: "C-STOP", source: "CLAUDE.md", rule: "no closing offer to continue", check: (t) => !/(¿(sigo|continúo|quieres que|te parece si|lo hago|procedo)|siguiente paso:|si quieres,? (puedo|lo))/i.test(stripCode(final(t))) },
  { id: "C-SENS", source: "CLAUDE.md", rule: "`sensitive:` before a sensitive edit", check: (t) => (t.edits.some((e) => SENSITIVE.test(e)) ? t.texts.some((x) => /sensitive:/i.test(x)) : null) },
  { id: "C-NOAI", source: "CLAUDE.md", rule: "commits carry no AI trailer", check: (t) => {
    const c = t.bash.filter((x) => /git commit/.test(x));
    return c.length ? !c.some((x) => /Co-Authored-By: Claude|Generated with \[?Claude/i.test(x)) : null;
  } },
  { id: "C-MODEL", source: "CLAUDE.md", rule: "model named on every spawn", check: (t) => (t.spawns.length ? t.spawns.every((s) => !!s.model || s.type === "fork") : null) },
  { id: "C-HCONFIG", source: "CLAUDE.md", rule: "harness-config loaded for config edits", check: (t) => (t.edits.some((e) => CONFIG.test(e)) ? [...t.sessionSkills].some((s) => s.endsWith("harness-config")) : null) },
  { id: "S-ESES", source: "style", rule: "final answer in es-ES", check: (t) => esEsDetect(final(t)).pass },
  { id: "S-ESES-MID", source: "style", rule: "progress notes in es-ES", check: (t) => (mids(t).length ? mids(t).every((x) => esEsDetect(x).pass) : null) },
  { id: "S-FICHERO", source: "style", rule: "«fichero», never «archivo»", check: (t) => !/\barchivos?\b/i.test(t.texts.map(stripCode).join(" ")) },
  { id: "S-ASK", source: "style", rule: "decisions through the question tool", check: (t) => {
    const body = lines(final(t)).filter((l) => !l.startsWith("ROBIN:"));
    return /\?\s*\**$/.test(body.at(-1) ?? "") || /Espera tu decisión/.test(final(t)) ? t.asks.length > 0 : null;
  } },
  { id: "S-ASK3", source: "style", rule: "≤3 questions per round", check: (t) => (t.asks.length ? t.asks.every((a) => (a.questions ?? []).length <= 3) : null) },
  { id: "S-HEDGE", source: "style", rule: "«creo que» carries [Suposición]", check: (t) => (/\bcreo que\b/i.test(stripCode(final(t))) ? /\[Suposición/.test(final(t)) : null) },
  { id: "S-BOLD", source: "style", rule: "bold first line", check: (t) => /^\*\*/.test(lines(final(t))[0] ?? "") },
  { id: "S-ROBIN", source: "style", rule: "ROBIN last line", check: (t) => /^ROBIN:/.test(lines(final(t)).at(-1) ?? "") },
  { id: "S-AVISO", source: "style", rule: "one Aviso, right before ROBIN", check: (t) => {
    const L = lines(final(t));
    const i = L.findIndex((l) => l.startsWith("Aviso:"));
    return i < 0 ? null : L.filter((l) => l.startsWith("Aviso:")).length === 1 && L[i + 1]?.startsWith("ROBIN:") === true;
  } },
  { id: "S-HEAD", source: "style", rule: "headings without emoji", check: (t) => !/^#{1,6}\s.*\p{Extended_Pictographic}/mu.test(stripFenced(final(t))) },
  { id: "S-SEP", source: "style", rule: "no separator lines", check: (t) => cardSeparators(final(t)).pass },
  { id: "S-CHECK", source: "style", rule: "✅/❌ never as task state", check: (t) => !/(✅|❌)\s*(hecho|completad|pendiente|en curso|fallid)/i.test(final(t)) },
  { id: "S-SCREEN", source: "style", rule: "fits one screen (≤45 lines)", check: (t) => final(t).split("\n").length <= 45 },
  { id: "S-TICS", source: "style", rule: "no AI tics", check: (t) => bannedOpeners(final(t)).pass && !TICS.test(stripCode(final(t))) },
  { id: "S-DASH", source: "style", rule: "no em dash joint", check: (t) => !/\S\s—\s\S/.test(stripFenced(stripCode(final(t))).replace(/\[[^\]\n]*\]/g, " ")) },
  { id: "S-NARR", source: "style", rule: "notes do not narrate tool use", check: (t) => (mids(t).length ? !mids(t).some((x) => /^(Leo|Voy a leer|Sigo con|Ahora leo|Reviso el fichero|Miro el fichero)\b/i.test(x.trim())) : null) },
];

export interface RuleResult { id: string; source: Rule["source"]; rule: string; pass: number; n: number }

export function summarizeCompliance(turns: ComplianceTurn[], rules = RULES): RuleResult[] {
  return rules.map(({ id, source, rule, check }) => {
    let pass = 0, n = 0;
    for (const t of turns) { const r = check(t); if (r === null) continue; n++; if (r) pass++; }
    return { id, source, rule, pass, n };
  });
}

const pct = (r: RuleResult) => (r.n ? Math.round((100 * r.pass) / r.n) : 100);
// A rule followed less than this often, over enough turns to judge, needs rewording or a hook.
const SAMPLE = 10;
const WARN_BELOW = 60;

export function complianceRow(results: RuleResult[], turns: number): { status: Status; detail: string } {
  const weak = results.filter((r) => r.n >= SAMPLE && pct(r) < WARN_BELOW).sort((a, b) => pct(a) - pct(b));
  if (!turns) return { status: "🟢", detail: "no turns in the window" };
  const head = `${turns} turns, ${results.length} rules`;
  return weak.length
    ? { status: "🟡", detail: `${head} · below ${WARN_BELOW} %: ${weak.map((r) => `${r.id} ${pct(r)} %`).join(", ")} (bun run compliance)` }
    : { status: "🟢", detail: `${head} · all ≥${WARN_BELOW} %` };
}

function renderCompliance(results: RuleResult[], turns: number, days: number): string {
  const rows = results.map((r) => `| ${r.id} | ${r.source} | ${r.rule} | ${r.pass}/${r.n} | ${r.n ? `${pct(r)} %` : "n/a"} |`);
  return [`Compliance over ${turns} interactive turns, last ${days} days`, "", "| Id | Source | Rule | Pass | Rate |", "|---|---|---|---|---|", ...rows].join("\n");
}

export function loadComplianceTurns(files: string[], since = 0): ComplianceTurn[] {
  return files.filter((f) => !f.includes("scratchpad")).flatMap((f) => {
    try { return parseComplianceTurns(readFileSync(f, "utf8").split("\n")); } catch { return []; }
  }).filter((t) => t.at === undefined || t.at >= since);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--days");
  const days = i >= 0 ? Number(argv[i + 1]) || 14 : 14;
  const turns = loadComplianceTurns(collectTranscripts(join(claudeConfigDir(), "projects"), days), windowStart(days));
  const results = summarizeCompliance(turns);
  console.log(renderCompliance(results, turns.length, days));
  const row = complianceRow(results, turns.length);
  console.log(`\n${row.status} ${row.detail}`);
}
