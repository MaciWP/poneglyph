#!/usr/bin/env bun
// bun run skill-usage [--days N]
//
// Whether skills get used without supervision. Per skill: how often the prompt router
// proposed it and how often that was followed, how often the model called it on its own,
// and how often the user had to name it (`/name`). Sí/No count the Lead's `Router:` line,
// its answer to each candidate (CLAUDE.md §Agents and skills). Hinted/Followed count Log
// Pose's phase hints and, in windows before them, the removed keyword hint. The transcripts already record
// every hook note and every Skill call, so this reads
// them instead of keeping a log of its own. The skills the user names most are where
// a description needs work.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { claudeConfigDir } from "../hooks/lib/paths";
import { queuedPromptOf, routerNoteOf } from "../hooks/lib/transcript";
import { isNonHumanPayload } from "../hooks/skill-activation";
import { collectTranscripts } from "./usage-profile";
import type { Status } from "./doctor";

export interface SkillTurn {
  named: string[]; // `/x` tokens in the prompt, lowercased; filtered against known skills later
  hinted: string[]; // Log Pose phase hints (older windows: the removed keyword hint)
  routed?: string[]; // skills the prompt router proposed (async hook note or prompt-router subagent)
  answers?: RouterAnswer[]; // the Lead's `Router: <skill> sí|no (<why>)` line
  called: string[];
  late?: string[]; // called only after the turn's first edit: a later phase than the prompt asked for
  at?: number; // epoch ms of the human prompt, when the record carries a timestamp
  text?: string; // the prompt itself, only with `withText` (eval builders)
}

const HINT_TAG = "<skill-activation-hint>";
const PHASE_TAG = "Log Pose: Skill(";
const ROUTER_TAG = "<prompt-router ";
const ROUTER_AGENT = "prompt-router";
const ROUTED_NAME_RE = /"name"\s*:\s*"([\w:-]+)"/g;
const ANSWER_TAG = "Router:";
const EDIT_RE = /"name":"(?:Edit|Write|MultiEdit|NotebookEdit)"/;
// One answer: a skill as any host writes it (`x`, `Skill(x)`, `$x`, `/x`), sí or no, then the reason.
const ANSWER_RE = /^[\s`*]*(?:Skill\()?[$/]?([\w:-]+)\)?`?\s+(s[ií]|no)(?![\p{L}\p{N}])[\s,:]*\(?(.*?)\)?[\s.]*$/iu;

export interface RouterAnswer { name: string; yes: boolean; why: string }

// Pure. The answers in one assistant text, first answer per skill.
export function parseRouterAnswers(text: string): RouterAnswer[] {
  const out: RouterAnswer[] = [];
  for (const line of text.split("\n")) {
    const at = line.indexOf(ANSWER_TAG);
    if (at < 0) continue;
    for (const part of line.slice(at + ANSWER_TAG.length).split(";")) {
      const m = part.match(ANSWER_RE);
      if (m && !out.some((a) => a.name === m[1])) out.push({ name: m[1], yes: m[2].toLowerCase() !== "no", why: m[3].trim() });
    }
  }
  return out;
}
// A slash token not glued to a path, a word or a closing tag: `/dev-workflow`,
// `<command-name>/x<`, never `src/flow` or `</pasted_content>`.
const NAMED_RE = /(?<![\p{L}\p{N}_./<-])\/([a-z][\w:-]*)/giu;

// The text of a prompt the human typed, or null. Origin is recorded by newer
// versions; older ones only leave the prefix check (task notifications, reminders).
export function humanPrompt(o: any): string | null {
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
export function parseSkillTurns(lines: Iterable<string>, { withText = false } = {}): SkillTurn[] {
  const turns: SkillTurn[] = [];
  let turn: SkillTurn | null = null;
  let edited = false;
  // A prompt-router subagent launch, by tool_use id, until its answer arrives: a tool_result, or a
  // <task-notification> naming the id when the agent ran in the background (the interactive default).
  const launches = new Map<string, SkillTurn>();
  for (const line of lines) {
    if (!line.includes('"user"') && !line.includes(HINT_TAG) && !line.includes(PHASE_TAG) && !line.includes(ROUTER_TAG) && !line.includes('"Skill"') && !line.includes(ROUTER_AGENT) && !line.includes(ANSWER_TAG) && !line.includes("queued_command") && !EDIT_RE.test(line)) continue;
    let o: any;
    try { o = JSON.parse(line); } catch { continue; }
    const prompt = humanPrompt(o) ?? queuedPromptOf(o);
    if (launches.size && o?.type === "user") {
      for (const [id, launched] of launches) {
        if (!line.includes(id)) continue;
        const c = o.message?.content;
        const answer = typeof c === "string" ? c : JSON.stringify(c ?? "");
        if (typeof c !== "string" && /async_launched|Async agent launched/.test(answer)) continue;
        launched.routed ??= [];
        for (const m of answer.replace(/\\"/g, "\"").matchAll(ROUTED_NAME_RE)) if (!launched.routed.includes(m[1])) launched.routed.push(m[1]);
        launches.delete(id);
      }
    }
    if (prompt !== null) {
      turn = { named: [...new Set([...prompt.matchAll(NAMED_RE)].map((m) => m[1].toLowerCase()))], hinted: [], called: [] };
      edited = false;
      const at = Date.parse(o.timestamp);
      if (!Number.isNaN(at)) turn.at = at;
      if (withText) turn.text = prompt;
      turns.push(turn);
      continue;
    }
    if (!turn) continue;
    const a = o?.attachment;
    if (o?.type === "attachment" && a?.hookEvent === "UserPromptSubmit" && typeof a.content === "string" && a.content.includes(HINT_TAG)) {
      for (const m of a.content.matchAll(/Skill\(([\w:-]+)\)/g)) if (!turn.hinted.includes(m[1])) turn.hinted.push(m[1]);
    }
    // Log Pose's phase hint rides the result of the session's first Agent or Artifact call.
    if (o?.type === "attachment" && a?.type === "hook_additional_context" && Array.isArray(a.content)) {
      for (const c of a.content) {
        const m = typeof c === "string" && c.startsWith(PHASE_TAG) ? c.match(/Skill\(([\w:-]+)\)/) : null;
        if (m && !turn.hinted.includes(m[1])) turn.hinted.push(m[1]);
      }
    }
    // Since 0.3.6 the hint is the refusal of that call instead: an error tool result.
    if (o?.type === "user" && Array.isArray(o.message?.content)) {
      for (const b of o.message.content) {
        if (b?.type !== "tool_result" || !b.is_error) continue;
        const text = typeof b.content === "string" ? b.content : Array.isArray(b.content) ? b.content.map((c: { text?: unknown }) => (typeof c?.text === "string" ? c.text : "")).join("\n") : "";
        const m = text.includes(PHASE_TAG) ? text.slice(text.indexOf(PHASE_TAG)).match(/Skill\(([\w:-]+)\)/) : null;
        if (m && !turn.hinted.includes(m[1])) turn.hinted.push(m[1]);
      }
    }
    // The router note: the hook's lands mid-turn, after the prompt; log-pose's rides the prompt.
    const note = routerNoteOf(o);
    if (note) {
      turn.routed ??= [];
      for (const m of note.matchAll(/Skill\(([\w:-]+)\)/g)) if (!turn.routed.includes(m[1])) turn.routed.push(m[1]);
    }
    if (o?.type === "assistant" && !o.isSidechain && Array.isArray(o.message?.content)) {
      for (const b of o.message.content) {
        if (b?.type === "tool_use" && b.name === "Agent" && b.input?.subagent_type === ROUTER_AGENT && typeof b.id === "string") launches.set(b.id, turn);
        if (b?.type === "text" && typeof b.text === "string" && b.text.includes(ANSWER_TAG)) {
          turn.answers ??= [];
          for (const a of parseRouterAnswers(b.text)) if (!turn.answers.some((x) => x.name === a.name)) turn.answers.push(a);
        }
        if (b?.type === "tool_use" && ["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(b.name)) edited = true;
        const name = b?.type === "tool_use" && b.name === "Skill" ? b.input?.skill : undefined;
        if (typeof name === "string" && !turn.called.includes(name)) {
          turn.called.push(name);
          if (edited) (turn.late ??= []).push(name);
        }
      }
    }
  }
  return turns;
}

export interface SkillStat { name: string; hinted: number; followed: number; routed: number; routedFollowed: number; yes: number; no: number; autonomous: number; typed: number }
export interface SkillSummary {
  prompts: number; hints: number; followed: number; routed: number; routedFollowed: number; yes: number; no: number; autonomous: number; typed: number;
  noReasons: string[]; // `skill: why` for each candidate the Lead turned down, oldest first
  bySkill: SkillStat[];
}

// Pure. `known` holds the skill names, so `/clear` or `/model` never count as typed.
// A call in a turn where the user named the skill was asked for: it counts as typed,
// never as a followed hint or an autonomous call. Totals are per skill and turn.
export function summarizeSkills(turns: SkillTurn[], known: Set<string>): SkillSummary {
  const by = new Map<string, SkillStat>();
  const stat = (name: string) => by.get(name) ?? by.set(name, { name, hinted: 0, followed: 0, routed: 0, routedFollowed: 0, yes: 0, no: 0, autonomous: 0, typed: 0 }).get(name)!;
  const s: SkillSummary = { prompts: turns.length, hints: 0, followed: 0, routed: 0, routedFollowed: 0, yes: 0, no: 0, autonomous: 0, typed: 0, noReasons: [], bySkill: [] };
  for (const t of turns) {
    const named = t.named.filter((n) => known.has(n) || t.called.includes(n));
    for (const n of named) { stat(n).typed++; s.typed++; }
    for (const h of t.hinted) {
      stat(h).hinted++; s.hints++;
      if (t.called.includes(h) && !named.includes(h)) { stat(h).followed++; s.followed++; }
    }
    const routed = t.routed ?? [];
    for (const r of routed) {
      stat(r).routed++; s.routed++;
      if (t.called.includes(r) && !named.includes(r)) { stat(r).routedFollowed++; s.routedFollowed++; }
      const answer = t.answers?.find((a) => a.name === r);
      if (answer?.yes) { stat(r).yes++; s.yes++; }
      else if (answer) { stat(r).no++; s.no++; s.noReasons.push(`${r}: ${answer.why || "(no reason)"}`); }
    }
    for (const c of t.called) if (!named.includes(c) && !t.hinted.includes(c) && !routed.includes(c)) { stat(c).autonomous++; s.autonomous++; }
  }
  s.bySkill = [...by.values()].sort((a, b) => b.typed + b.hinted + b.routed + b.autonomous - (a.typed + a.hinted + a.routed + a.autonomous) || a.name.localeCompare(b.name));
  return s;
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "—");
const mostTyped = (s: SkillSummary, n: number) => s.bySkill.filter((x) => x.typed > 0).sort((a, b) => b.typed - a.typed).slice(0, n);

export function renderSkills(s: SkillSummary, days: number): string {
  const lines = [
    `## Skill use, prompts in the last ${days} days (${s.prompts} prompts)`,
    "",
    `Phase hints: ${s.hints}, followed ${s.followed} (${pct(s.followed, s.hints)}) · router: ${s.routed}, followed ${s.routedFollowed} (${pct(s.routedFollowed, s.routed)}), answered sí ${s.yes} / no ${s.no} / none ${s.routed - s.yes - s.no} · autonomous calls: ${s.autonomous} · skills named by the user: ${s.typed}`,
    "", "| Skill | Hinted | Followed | Routed | Sí | No | Followed (router) | Autonomous | Typed by user |", "|---|---|---|---|---|---|---|---|---|",
    ...s.bySkill.map((x) => `| ${x.name} | ${x.hinted} | ${x.followed} | ${x.routed} | ${x.yes} | ${x.no} | ${x.routedFollowed} | ${x.autonomous} | ${x.typed} |`),
  ];
  const top = mostTyped(s, 3);
  if (s.noReasons.length) lines.push("", "Router candidates turned down (latest 10):", ...s.noReasons.slice(-10).map((r) => `- ${r}`));
  if (top.length) lines.push("", `Named most by the user: ${top.map((x) => `${x.name} (${x.typed})`).join(", ")}, their descriptions do not trigger on their own.`);
  return lines.join("\n");
}

// A reasoned "no" is the contract working; a candidate left unanswered is the failure.
// A phase hint followed less than half the time is plan 044's trigger to block the first
// Agent or Artifact call instead of hinting after it. Flag either once the sample can judge it.
const SAMPLE = 10;
const UNANSWERED_WARN = 0.5;
const HINT_FOLLOW_WARN = 0.5;

export function skillsRow(s: SkillSummary): { status: Status; detail: string } {
  if (!s.prompts) return { status: "🟢", detail: "no prompts in the window" };
  const top = mostTyped(s, 1)[0];
  const hints = s.hints ? ` · phase hints ${s.hints}, followed ${s.followed} (${pct(s.followed, s.hints)})` : "";
  const detail = `${s.prompts} prompts · router ${s.routed}, followed ${s.routedFollowed} (${pct(s.routedFollowed, s.routed)}), unanswered ${s.routed - s.yes - s.no} · ${s.autonomous} autonomous calls${hints}${top ? ` · named most: ${top.name} ${top.typed}` : ""}`;
  const warns = [
    s.routed >= SAMPLE && (s.routed - s.yes - s.no) / s.routed > UNANSWERED_WARN && "router candidates mostly unanswered: check the note wording and CLAUDE.md §Agents and skills",
    s.hints >= SAMPLE && s.followed / s.hints < HINT_FOLLOW_WARN && "phase hints mostly ignored even when the first call is refused: review the hint wording (plan 044)",
  ].filter(Boolean);
  return warns.length ? { status: "🟡", detail: `${detail}, ${warns.join("; ")}` } : { status: "🟢", detail };
}

// --- IO ---------------------------------------------------------------------------

export function knownSkills(dirs: string[]): Set<string> {
  const out = new Set<string>();
  for (const d of dirs) {
    try { for (const e of readdirSync(d)) if (existsSync(join(d, e, "SKILL.md"))) out.add(e.toLowerCase()); } catch { /* missing dir */ }
  }
  return out;
}

// Eval sandboxes under the session scratchpad replay synthetic prompts. The file list
// is chosen by mtime, and a long-lived session carries weeks of turns, so `since`
// keeps only the turns whose prompt falls inside the window.
export function loadSkillTurns(files: string[], since = 0, withText = false): SkillTurn[] {
  return files.filter((f) => !f.includes("scratchpad")).flatMap((f) => {
    try { return parseSkillTurns(readFileSync(f, "utf8").split("\n"), { withText }); } catch { return []; }
  }).filter((t) => t.at === undefined || t.at >= since);
}

export const windowStart = (days: number, now = Date.now()) => now - days * 86_400_000;

export function defaultSkillDirs(cwd = process.cwd()): string[] {
  return [join(cwd, ".claude", "skills"), join(claudeConfigDir(), "skills")];
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--days");
  const days = i >= 0 ? Number(argv[i + 1]) || 14 : 14;
  const turns = loadSkillTurns(collectTranscripts(join(claudeConfigDir(), "projects"), days), windowStart(days));
  const summary = summarizeSkills(turns, knownSkills(defaultSkillDirs()));
  console.log(renderSkills(summary, days));
  const row = skillsRow(summary);
  console.log(`\n${row.status} ${row.detail}`);
}
