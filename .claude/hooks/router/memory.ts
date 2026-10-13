#!/usr/bin/env bun
// Router memory: what this user did before, so the router can follow their habits.
//   - session: skills already loaded in this session (named `/x` or called) are not
//     suggested again; their text is already in the main model's context.
//   - past prompts: the user's earlier prompts with the skills used for them. The router
//     sees the few most similar ones next to the new prompt.
// Past prompts hold work text, so the index lives in <config>/router-memory.jsonl, outside
// any repository, and is derived from the local transcripts only.
// `bun memory.ts --build <cwd>` rebuilds it; the hook starts that detached when it is stale.
import { readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { claudeConfigDir } from "../lib/paths";
import { foldText } from "../lib/language";

export interface RouterCase { prompt: string; expected: string[]; source: "typed" | "autonomous" | "negative"; at?: number }
export interface MemoryEntry { at: number; prompt: string; skills: string[] }

export const MIN_WORDS = 6;
export const MAX_PROMPT_CHARS = 3000;
const PASTED_RE = /<pasted_content[^>]*>[\s\S]*?<\/pasted_content>/g;
export const MEMORY_MAX_AGE_MS = 6 * 3_600_000;
export const MEMORY_DAYS = 60;
const MEMORY_PROMPT_CHARS = 300;

export const memoryFile = (config = claudeConfigDir()) => join(config, "router-memory.jsonl");

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// Removes `/name` and the words that ask for it: "usa la skill /x", "con /x", "y /x".
export function stripInvocation(text: string, names: string[]): string {
  let out = text;
  for (const name of names) {
    const verb = String.raw`(?:(?<![\p{L}\p{N}])(?:para ello\s+)?(?:usa(?:ndo|r|rno|no)?|utiliza(?:ndo|r)?|aplica(?:ndo|r)?|carga|invoca|tira de|mediante|con|y|o|como)\s+)?`;
    const article = String.raw`(?:(?:la|las|el|los)\s+)?(?:skills?\s+)?(?:de\s+)?`;
    out = out.replace(new RegExp(`${verb}${article}/${escape(name)}(?![\\w:-])`, "giu"), " ");
  }
  return out.replace(/[ \t]+/g, " ").trim();
}

// Pure: one turn (prompt text, named and called skills) → a case or null.
export function caseFromTurn(text: string, named: string[], called: string[], catalog: Set<string>): RouterCase | null {
  if (text.startsWith("Kickoff:")) return null;
  const command = text.match(/<command-name>\/([\w:-]+)<\/command-name>/);
  if (command) {
    if (!catalog.has(command[1])) return null; // a built-in command (/clear, /model)
    const args = text.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1] ?? "";
    const labels = [...new Set([command[1], ...named.filter((n) => catalog.has(n))])];
    const prompt = stripInvocation(args.replace(PASTED_RE, " "), [...catalog]);
    return words(prompt) >= MIN_WORDS ? { prompt, expected: labels, source: "typed" } : null;
  }
  const bare = text.replace(PASTED_RE, " ");
  const labels = named.filter((n) => catalog.has(n) && foldText(bare).includes(`/${n}`));
  if (labels.length) {
    const prompt = stripInvocation(text, [...catalog]);
    return words(prompt.replace(PASTED_RE, " ")) >= MIN_WORDS ? { prompt, expected: labels, source: "typed" } : null;
  }
  if (/\bskills?\b/i.test(bare) || text.trimStart().startsWith("<") || words(bare) < MIN_WORDS) return null;
  const autonomous = called.filter((c) => catalog.has(c));
  if (autonomous.length) return { prompt: text, expected: autonomous, source: "autonomous" };
  return called.length ? null : { prompt: text, expected: [], source: "negative" };
}

// Prompts where the user named a skill or the main model called one; pasted blocks are
// dropped and the text is capped, so an entry costs a line in the router's input. A call
// the router or the keyword hook suggested in that turn does not count: the memory would
// learn from its own picks and repeat them with more weight.
export function memoryFromTurns(turns: { text?: string; at?: number; named: string[]; called: string[]; hinted?: string[]; routed?: string[] }[], catalog: Set<string>): MemoryEntry[] {
  const seen = new Set<string>();
  const out: MemoryEntry[] = [];
  for (const t of turns) {
    if (!t.text || !t.at) continue;
    const called = t.called.filter((n) => !t.routed?.includes(n) && !t.hinted?.includes(n));
    const c = caseFromTurn(t.text, t.named, called, catalog);
    if (!c?.expected.length) continue;
    const prompt = c.prompt.replace(PASTED_RE, " ").replace(/\s+/g, " ").trim().slice(0, MEMORY_PROMPT_CHARS);
    const key = foldText(prompt);
    if (words(prompt) < MIN_WORDS || seen.has(key)) continue;
    seen.add(key);
    out.push({ at: t.at, prompt, skills: c.expected });
  }
  return out;
}

export function loadMemory(file = memoryFile()): MemoryEntry[] {
  let text = "";
  try { text = readFileSync(file, "utf8"); } catch { return []; }
  const out: MemoryEntry[] = [];
  for (const line of text.split("\n")) {
    try {
      const e = JSON.parse(line) as MemoryEntry;
      if (typeof e.at === "number" && typeof e.prompt === "string" && Array.isArray(e.skills)) out.push(e);
    } catch { /* blank or invalid */ }
  }
  return out;
}

const STOP = new Set(("que los las del por para con una uno unos unas como pero mas esto esta este estos estas eso esa ese hay hace hacer sea ser son sin sobre todo todos toda todas tambien muy porque cuando donde algo aqui ahi asi solo mismo misma puede puedes podemos quiero creo vale bien entonces luego ahora antes despues tiene tienen tenemos the and for with this that are you your from have has was were not but can will what when which into about there here they them then than just also all any its our out use")
  .split(" "));

const memoryTokens = (text: string): string[] => (foldText(text).match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((t) => !STOP.has(t));

// BM25 over the entries; an entry must share `minShared` distinct words with the prompt,
// so one common word never pulls in an unrelated example.
export function similarPast(prompt: string, memory: MemoryEntry[], k = 3, minShared = 2): MemoryEntry[] {
  const query = [...new Set(memoryTokens(prompt))];
  if (!query.length || !memory.length) return [];
  const docs = memory.map((e) => memoryTokens(e.prompt));
  const avg = docs.reduce((n, d) => n + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const scored = docs.map((d, i) => {
    let score = 0;
    let shared = 0;
    for (const q of query) {
      const tf = d.filter((t) => t === q).length;
      if (!tf) continue;
      shared++;
      const n = df.get(q)!;
      score += Math.log(1 + (docs.length - n + 0.5) / (n + 0.5)) * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * d.length / avg));
    }
    return { e: memory[i], score, shared };
  });
  return scored.filter((s) => s.shared >= minShared).sort((a, b) => b.score - a.score).slice(0, k).map((s) => s.e);
}

// The past prompts the router sees, keeping only skills still in the catalog.
export function pastFor(prompt: string, known: Set<string>, memory = loadMemory()): MemoryEntry[] {
  return similarPast(prompt, memory.map((e) => ({ ...e, skills: e.skills.filter((n) => known.has(n)) })).filter((e) => e.skills.length));
}

export function formatPast(entries: MemoryEntry[]): string {
  if (!entries.length) return "";
  return ["<past>", ...entries.map((e) => `- "${e.prompt.replace(/"/g, "'")}" → ${e.skills.join(", ")}`), "</past>"].join("\n");
}

// Skills already in this session's context: named by the user or called by the model.
export async function sessionSkills(transcript: string | undefined): Promise<Set<string>> {
  if (!transcript) return new Set();
  let text = "";
  try { text = readFileSync(transcript, "utf8"); } catch { return new Set(); }
  const { parseSkillTurns } = await import("../../scripts/skill-usage");
  return new Set(parseSkillTurns(text.split("\n")).flatMap((t) => [...t.named, ...t.called]));
}

export const memoryIsStale = (file = memoryFile(), now = Date.now()) => {
  try { return now - statSync(file).mtimeMs > MEMORY_MAX_AGE_MS; } catch { return true; }
};

async function buildMemory(catalog: Set<string>, file = memoryFile(), days = MEMORY_DAYS): Promise<number> {
  const { collectTranscripts } = await import("../../scripts/usage-profile");
  const { loadSkillTurns, windowStart } = await import("../../scripts/skill-usage");
  const projects = join(claudeConfigDir(), "projects");
  const entries = memoryFromTurns(loadSkillTurns(collectTranscripts(projects, days), windowStart(days), true), catalog);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  renameSync(tmp, file);
  return entries.length;
}

if (import.meta.main && process.argv[2] === "--build") {
  const cwd = process.argv[3] ?? process.cwd();
  const { loadCatalog } = await import("../prompt-router");
  const n = await buildMemory(new Set(loadCatalog(cwd).map((c) => c.name)));
  console.log(`${n} entries → ${memoryFile()}`);
}
