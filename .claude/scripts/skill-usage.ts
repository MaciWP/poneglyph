#!/usr/bin/env bun
// bun run skill-usage [--days N]
//
// Whether skills get used without supervision. Per skill: how often the hook hinted
// it, how often that hint was followed, how often the model called it on its own, and
// how often the user had to name it (`/name`). The transcripts already record every
// injected hint (a UserPromptSubmit attachment) and every Skill call, so this reads
// them instead of keeping a log of its own. The skills the user names most are where
// a description needs work.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isNonHumanPayload } from "../hooks/skill-activation";
import { collectTranscripts } from "./usage-profile";
import type { Status } from "./doctor";

export interface SkillTurn {
  named: string[]; // `/x` tokens in the prompt, lowercased; filtered against known skills later
  hinted: string[];
  called: string[];
}

const HINT_TAG = "<skill-activation-hint>";
// A slash token not glued to a path, a word or a closing tag: `/dev-workflow`,
// `<command-name>/x<`, never `src/flow` or `</pasted_content>`.
const NAMED_RE = /(?<![\p{L}\p{N}_./<-])\/([a-z][\w:-]*)/giu;

// The text of a prompt the human typed, or null. Origin is recorded by newer
// versions; older ones only leave the prefix check (task notifications, reminders).
function humanPrompt(o: any): string | null {
  if (o?.type !== "user" || o.isMeta || o.isCompactSummary || o.isSidechain) return null;
  const kind = o.origin?.kind;
  if (kind !== undefined && kind !== "human") return null;
  const c = o.message?.content;
  let text: string | null = null;
  if (typeof c === "string") text = c;
  else if (Array.isArray(c) && !c.some((b) => b?.type === "tool_result")) {
    text = c.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
  }
  if (!text?.trim() || isNonHumanPayload(text) || text.startsWith("This session is being continued")) return null;
  return text;
}

// Pure. One transcript's lines in, one entry per human turn out. A turn runs from a
// human prompt to the next one; hints and Skill calls in between belong to it.
export function parseSkillTurns(lines: Iterable<string>): SkillTurn[] {
  const turns: SkillTurn[] = [];
  let turn: SkillTurn | null = null;
  for (const line of lines) {
    if (!line.includes('"user"') && !line.includes(HINT_TAG) && !line.includes('"Skill"')) continue;
    let o: any;
    try { o = JSON.parse(line); } catch { continue; }
    const prompt = humanPrompt(o);
    if (prompt !== null) {
      turn = { named: [...new Set([...prompt.matchAll(NAMED_RE)].map((m) => m[1].toLowerCase()))], hinted: [], called: [] };
      turns.push(turn);
      continue;
    }
    if (!turn) continue;
    const a = o?.attachment;
    if (o?.type === "attachment" && a?.hookEvent === "UserPromptSubmit" && typeof a.content === "string" && a.content.includes(HINT_TAG)) {
      for (const m of a.content.matchAll(/Skill\(([\w:-]+)\)/g)) if (!turn.hinted.includes(m[1])) turn.hinted.push(m[1]);
    }
    if (o?.type === "assistant" && !o.isSidechain && Array.isArray(o.message?.content)) {
      for (const b of o.message.content) {
        const name = b?.type === "tool_use" && b.name === "Skill" ? b.input?.skill : undefined;
        if (typeof name === "string" && !turn.called.includes(name)) turn.called.push(name);
      }
    }
  }
  return turns;
}

export interface SkillStat { name: string; hinted: number; followed: number; autonomous: number; typed: number }
export interface SkillSummary { prompts: number; hints: number; followed: number; autonomous: number; typed: number; bySkill: SkillStat[] }

// Pure. `known` holds the skill names, so `/clear` or `/model` never count as typed.
// A call in a turn where the user named the skill was asked for: it counts as typed,
// never as a followed hint or an autonomous call. Totals are per skill and turn.
export function summarizeSkills(turns: SkillTurn[], known: Set<string>): SkillSummary {
  const by = new Map<string, SkillStat>();
  const stat = (name: string) => by.get(name) ?? by.set(name, { name, hinted: 0, followed: 0, autonomous: 0, typed: 0 }).get(name)!;
  const s: SkillSummary = { prompts: turns.length, hints: 0, followed: 0, autonomous: 0, typed: 0, bySkill: [] };
  for (const t of turns) {
    const named = t.named.filter((n) => known.has(n) || t.called.includes(n));
    for (const n of named) { stat(n).typed++; s.typed++; }
    for (const h of t.hinted) {
      stat(h).hinted++; s.hints++;
      if (t.called.includes(h) && !named.includes(h)) { stat(h).followed++; s.followed++; }
    }
    for (const c of t.called) if (!named.includes(c) && !t.hinted.includes(c)) { stat(c).autonomous++; s.autonomous++; }
  }
  s.bySkill = [...by.values()].sort((a, b) => b.typed + b.hinted + b.autonomous - (a.typed + a.hinted + a.autonomous) || a.name.localeCompare(b.name));
  return s;
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "—");
const mostTyped = (s: SkillSummary, n: number) => s.bySkill.filter((x) => x.typed > 0).sort((a, b) => b.typed - a.typed).slice(0, n);

export function renderSkills(s: SkillSummary, days: number): string {
  const lines = [
    `## Skill use — transcripts touched in the last ${days} days (${s.prompts} prompts)`,
    "",
    `Hints: ${s.hints}, followed ${s.followed} (${pct(s.followed, s.hints)}) · autonomous calls: ${s.autonomous} · skills named by the user: ${s.typed}`,
    "", "| Skill | Hinted | Followed | Autonomous | Typed by user |", "|---|---|---|---|---|",
    ...s.bySkill.map((x) => `| ${x.name} | ${x.hinted} | ${x.followed} | ${x.autonomous} | ${x.typed} |`),
  ];
  const top = mostTyped(s, 3);
  if (top.length) lines.push("", `Named most by the user: ${top.map((x) => `${x.name} (${x.typed})`).join(", ")} — their descriptions do not trigger on their own.`);
  return lines.join("\n");
}

// Ignored hints are noise injected into every matching prompt: flag them once they
// are frequent enough to judge.
const HINT_SAMPLE = 10;
const FOLLOW_WARN = 0.2;

export function skillsRow(s: SkillSummary): { status: Status; detail: string } {
  if (!s.prompts) return { status: "🟢", detail: "no prompts in the window" };
  const top = mostTyped(s, 1)[0];
  const detail = `${s.prompts} prompts · hints ${s.hints}, followed ${s.followed} (${pct(s.followed, s.hints)}) · ${s.autonomous} autonomous calls${top ? ` · named most: ${top.name} ${top.typed}` : ""}`;
  return s.hints >= HINT_SAMPLE && s.followed / s.hints < FOLLOW_WARN
    ? { status: "🟡", detail: `${detail} — hints mostly ignored: tighten the keywords in skill-activation` }
    : { status: "🟢", detail };
}

// --- IO ---------------------------------------------------------------------------

export function knownSkills(dirs: string[]): Set<string> {
  const out = new Set<string>();
  for (const d of dirs) {
    try { for (const e of readdirSync(d)) if (existsSync(join(d, e, "SKILL.md"))) out.add(e.toLowerCase()); } catch { /* missing dir */ }
  }
  return out;
}

// Eval sandboxes under the session scratchpad replay synthetic prompts.
export function loadSkillTurns(files: string[]): SkillTurn[] {
  return files.filter((f) => !f.includes("scratchpad")).flatMap((f) => {
    try { return parseSkillTurns(readFileSync(f, "utf8").split("\n")); } catch { return []; }
  });
}

export function defaultSkillDirs(cwd = process.cwd()): string[] {
  return [join(cwd, ".claude", "skills"), join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "skills")];
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--days");
  const days = i >= 0 ? Number(argv[i + 1]) || 14 : 14;
  const turns = loadSkillTurns(collectTranscripts(join(homedir(), ".claude", "projects"), days));
  const summary = summarizeSkills(turns, knownSkills(defaultSkillDirs()));
  console.log(renderSkills(summary, days));
  const row = skillsRow(summary);
  console.log(`\n${row.status} ${row.detail}`);
}
