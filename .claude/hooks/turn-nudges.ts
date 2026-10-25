#!/usr/bin/env bun

// PostToolUse + UserPromptSubmit, non-blocking reminders for duties the doctrine states and
// turns skip mid-work. Fourteen days of real transcripts: the `Router:` answer 39 % (36 of 60
// misses had already read the note), es-ES progress notes 80 %, `harness-config` loaded before a
// config edit 62 %, decisions asked through the question tool ~20 %.
//
// A Stop block would force a full extra model turn, so nothing here blocks:
//   PostToolUse (mid-turn, rides the next request): router note unanswered · last visible note in
//     English · Poneglyph config edited without `harness-config` loaded.
//   UserPromptSubmit (next turn): the previous turn closed on a decision asked as plain text.
// Each reminder fires once per turn (config: once per session). One line per reminder in
// `<project>/.claude/learned/turn-nudges.log` is both the log and the marker. Claude only:
// Codex and Grok carry the same duties in the doctrine.
import { readFileSync } from "node:fs";
import { queuedPromptOf, readTranscriptTail, routerNoteOf, userPromptOf } from "./lib/transcript";
import { stopwordCounts } from "./lib/language";
import { appendLog } from "./instructions-loaded";
import { learnedLog } from "./lib/paths";
import { readHookStdin } from "./lib/hook-stdin";

export type NudgeKind = "router" | "english" | "config" | "question";

export interface TurnState {
  key: string; // prompt timestamp, the per-turn marker
  prompt: string;
  routerNote: boolean;
  routerAnswered: boolean;
  lastText: string | null;
  asks: number;
}

export interface TailState {
  current: TurnState | null;
  previous: TurnState | null;
  skills: Set<string>; // skills loaded anywhere in the tail
}

const words = (s: string) => s.replace(/\s+/g, " ").trim().split(" ");
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** A router note belongs to the turn whose prompt holds its `re=` words; a late note does not.
 *  Contained, not leading: the transcript stores a pasted block ahead of the typed text. */
export function noteMatches(note: string, prompt: string): boolean {
  const re = note.match(/<prompt-router re="([^"]*)">/)?.[1];
  if (re === undefined) return false;
  return words(prompt).join(" ").includes(words(unescape(re).replace(/\s*…$/, "")).join(" "));
}

export function readTail(jsonl: string): TailState {
  const turns: TurnState[] = [];
  const skills = new Set<string>();
  for (const line of jsonl.split("\n")) {
    let e: any;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e?.isSidechain) continue;
    const prompt = userPromptOf(e) ?? queuedPromptOf(e);
    if (prompt !== null && !/^\s*<task-notification>/.test(prompt)) {
      turns.push({ key: String(e.timestamp ?? turns.length), prompt, routerNote: false, routerAnswered: false, lastText: null, asks: 0 });
      continue;
    }
    const turn = turns.at(-1);
    const note = routerNoteOf(e);
    if (note !== null) {
      if (turn && note.includes("Candidate skills") && noteMatches(note, turn.prompt)) turn.routerNote = true;
      continue;
    }
    if (e?.type !== "assistant" || !Array.isArray(e.message?.content)) continue;
    for (const b of e.message.content) {
      if (b?.type === "tool_use" && b.name === "Skill" && typeof b.input?.skill === "string") skills.add(b.input.skill);
      if (!turn) continue;
      if (b?.type === "tool_use" && b.name === "AskUserQuestion") turn.asks++;
      if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
        turn.lastText = b.text;
        if (b.text.includes("Router:")) turn.routerAnswered = true; // as skill-usage.ts reads it, bold included
      }
    }
  }
  return { current: turns.at(-1) ?? null, previous: turns.at(-2) ?? null, skills };
}

const CODE_RE = /```[\s\S]*?```|`[^`\n]*`/g;

/** A visible note of 8+ words where English stopwords outnumber Spanish ones. */
export function isEnglishNote(text: string | null): boolean {
  if (!text) return false;
  const { es, en, words: n } = stopwordCounts(text.replace(CODE_RE, " "));
  return n >= 8 && en > es;
}

/** The final answer's last line before `ROBIN:` asks something. */
export function endsWithTextQuestion(text: string | null): boolean {
  if (!text) return false;
  const body = text.replace(CODE_RE, " ").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("ROBIN:"));
  return /\?\**$/.test(body.at(-1) ?? "");
}

const CONFIG_RE = /(^|\/)(\.claude\/(skills|hooks|output-styles|rules|commands|agents)\/|CLAUDE\.md$|AGENTS\.md$|settings\.global\.json$)/;

export function isConfigPath(path: unknown): boolean {
  return typeof path === "string" && CONFIG_RE.test(path) && !/\/\.claude\/projects\//.test(path);
}

// Factual sentences only: Claude Code docs warn that imperative hook text can trip
// prompt-injection defenses.
export const NUDGE_TEXT: Record<NudgeKind, string> = {
  router: "Router note for this prompt is still unanswered: the doctrine expects one `Router:` line with sí or no and the reason for each candidate before going on.",
  english: "The last visible note was written in English; the house style keeps every visible text in es-ES, progress notes included.",
  config: "This edits Poneglyph configuration and `harness-config` is not loaded in this session; the doctrine loads it before any skill, rule, hook, setting or style change.",
  question: "The previous answer ended on a decision asked as plain text; the house style asks decisions through AskUserQuestion with the recommended option first.",
};

function alreadyNudged(log: string, session: string, kind: NudgeKind, key: string): boolean {
  return log.split("\n").some((l) => {
    const [, s, k, t] = l.split(" ");
    return s === session && k === kind && (kind === "config" || t === key);
  });
}

export interface NudgeInput {
  event: "PostToolUse" | "UserPromptSubmit";
  tail: TailState;
  toolName?: string;
  filePath?: unknown;
  prompt?: string;
}

/** The reminders that apply now, before the once-per-turn filter. */
export function dueNudges({ event, tail, toolName, filePath, prompt }: NudgeInput): { kind: NudgeKind; key: string }[] {
  const out: { kind: NudgeKind; key: string }[] = [];
  if (event === "UserPromptSubmit") {
    // The new prompt may already be the last turn in the tail; the one before it is the one to judge.
    const done = tail.current && prompt !== undefined && words(tail.current.prompt).join(" ") === words(prompt).join(" ") ? tail.previous : tail.current;
    if (done && done.asks === 0 && endsWithTextQuestion(done.lastText)) out.push({ kind: "question", key: done.key });
    return out;
  }
  const turn = tail.current;
  if (!turn) return out;
  if (turn.routerNote && !turn.routerAnswered) out.push({ kind: "router", key: turn.key });
  if (isEnglishNote(turn.lastText)) out.push({ kind: "english", key: turn.key });
  if (["Edit", "Write", "MultiEdit"].includes(toolName ?? "") && isConfigPath(filePath) && ![...tail.skills].some((s) => s.endsWith("harness-config"))) {
    out.push({ kind: "config", key: turn.key });
  }
  return out;
}

async function runNudges(payload: Record<string, any>, logPath: string): Promise<string | null> {
  const event = payload.hook_event_name;
  if (event !== "PostToolUse" && event !== "UserPromptSubmit") return null;
  // A subagent's tool calls fire PostToolUse too, often with the main transcript: the reminder
  // would reach the subagent and spend the main thread's once-per-turn marker.
  if (typeof payload.transcript_path !== "string" || payload.agent_id) return null;
  // 1 MB, not the Stop gate's 256 KB: large tool results push a long turn's prompt out of a
  // smaller tail, and the replay lost a third of the router reminders that way.
  const tail = readTail(await readTranscriptTail(payload.transcript_path, 1024 * 1024));
  const due = dueNudges({ event, tail, toolName: payload.tool_name, filePath: payload.tool_input?.file_path, prompt: payload.prompt });
  if (!due.length) return null;
  let log = "";
  try {
    log = readFileSync(logPath, "utf8");
  } catch {
    // no log yet: nothing nudged
  }
  const session = String(payload.session_id ?? "unknown");
  const fresh = due.filter((d) => !alreadyNudged(log, session, d.kind, d.key));
  for (const d of fresh) {
    try {
      appendLog(`${new Date().toISOString()} ${session} ${d.kind} ${d.key}`, logPath);
    } catch {
      // best-effort: the reminder still goes out
    }
  }
  return fresh.length ? fresh.map((d) => NUDGE_TEXT[d.kind]).join("\n") : null;
}

if (import.meta.main) {
  try {
    const payload = JSON.parse(await readHookStdin()) as Record<string, any>;
    const text = await runNudges(payload, learnedLog(payload.cwd, "turn-nudges.log"));
    if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: payload.hook_event_name, additionalContext: text } }) + "\n");
  } catch {
    // best-effort: a reminder never breaks a turn
  }
  process.exit(0);
}
