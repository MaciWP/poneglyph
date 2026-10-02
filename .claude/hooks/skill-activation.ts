#!/usr/bin/env bun

/**
 * Skill Activation Hook (UserPromptSubmit)
 *
 * Deterministic skill-routing layer: matches the submitted prompt
 * against skill keywords read FROM DISK (no hardcoded list that rots) and,
 * on match, prints an explicit `Skill(<name>)` instruction to stdout —
 * UserPromptSubmit stdout is injected as context Claude can act on.
 * Community-proven: explicit tool-call instructions fire; vague hints don't.
 *
 * Precision-first by design. Over 2026-09-14 → 10-02 the old rule (a multi-word
 * phrase, or ≥2 single words) emitted 124 hints and 3 were followed; the noise was
 * single words (`flow`, `error`, `retry`). So:
 *   - only a multi-word keyword qualifies a skill ("revisa la pr")
 *   - it must match whole words, case- and accent-insensitive ("respecto" never
 *     hits "spec", "estas seguro" hits "estás seguro")
 *   - a skill the prompt already names as `/name` gets no hint
 *   - non-human payloads (task notifications, system reminders) are skipped
 *   - top 2 skills max; SILENT by default (031): no match, no shape → zero
 *     output; the always-loaded rules/skill-routing.md covers general routing
 *
 * Whether hints are followed is measured from the transcripts, which record every
 * injected hint and every Skill call: `bun .claude/scripts/skill-usage.ts`.
 *
 * Slash commands are skipped (they self-route) EXCEPT `/goal <task>`: its
 * argument is real work, so it gets the same hint treatment as a plain prompt
 * (processed since 023, asserted by tests T2.2/T2.2b). The hint is a
 * best-effort accelerator for plain prompts, not a capability gate.
 *
 * Known caveat: UserPromptSubmit has a reliability gap early-session /
 * post-compaction (issue #17277) — best-effort layer, never a sole gate.
 * Exits 0 always; silent (no stdout) when nothing matches.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readHookStdin } from "./lib/hook-stdin";
import { frontmatter, skillKeywords } from "../scripts/lib/skill-metadata";

export interface SkillEntry {
  name: string;
  keywords: string[];
}

interface PromptPayload {
  prompt?: string;
  cwd?: string;
  [key: string]: unknown;
}

export function loadSkills(dirs: string[], host: "claude" | "codex" | "grok" = "claude", overrides: Record<string, unknown> = {}): SkillEntry[] {
  const byName = new Map<string, SkillEntry>();
  const reserved = new Set<string>();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const skillFile = join(dir, entry, "SKILL.md");
      if (reserved.has(entry) || !existsSync(skillFile)) continue;
      try {
        const { fields } = frontmatter(readFileSync(skillFile, "utf8"));
        if (typeof fields.name !== "string" || !fields.name.trim() || typeof fields.description !== "string" || !fields.description.trim()) continue;
        reserved.add(entry);
        // A valid empty/manual project skill still shadows its core definition.
        // Codex ignores Claude frontmatter extensions; do not export that restriction.
        const mode = overrides[entry];
        if (host !== "codex" && (fields["disable-model-invocation"] === true ||
          (host === "claude" && (mode === "off" || mode === "user-invocable-only")))) continue;
        const keywords = skillKeywords(fields);
        if (keywords.length > 0) byName.set(entry, { name: entry, keywords });
      } catch {
        // Unreadable skill or invalid YAML — skip.
      }
    }
  }
  return [...byName.values()];
}

/** Read settings in increasing precedence. Invalid files provide no routing hints. */
export function skillOverrides(cwd: string, config = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude")): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const file of [join(config, "settings.json"), join(cwd, ".claude", "settings.json"), join(cwd, ".claude", "settings.local.json")]) {
    try {
      const value = JSON.parse(readFileSync(file, "utf8")).skillOverrides;
      if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(result, value);
    } catch { /* Missing or invalid settings cannot authorize an extra hint. */ }
  }
  return result;
}

const MAX_SKILLS = 2;

// Payloads that reach UserPromptSubmit but are NOT typed by the human:
// background-task notifications, system reminders, local-command caveats.
// Matching their content produced hints about the system's own plumbing
// (audit 2026-08-07: a task-notification triggered prompt-design/orchestrator).
export const NON_PROMPT_PREFIXES = [
  "[SYSTEM NOTIFICATION",
  "<task-notification>",
  "<system-reminder>",
  "Caveat:",
] as const;

export function isNonHumanPayload(prompt: string): boolean {
  const p = prompt.trimStart();
  return NON_PROMPT_PREFIXES.some((prefix) => p.startsWith(prefix));
}

// Case- and accent-insensitive form of a prompt or keyword: the user often types
// without accents ("estas seguro"), and keywords are written with them.
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Whole-word containment: a keyword never matches inside a longer word or a
// hyphenated identifier ("flow" in "workflow", "spec" in "respecto").
function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${escaped}(?![\\p{L}\\p{N}_-])`, "u").test(text);
}

// A skill qualifies through a multi-word keyword only; single words were the
// measured noise. Skills the prompt names as `/name` are skipped: the user chose.
// Carries the first matched phrase as a human-readable reason.
export function matchWithReasons(
  prompt: string,
  skills: SkillEntry[],
): { name: string; reason: string }[] {
  const p = foldText(prompt);
  if (!p.trim()) return [];
  const scored: { name: string; hits: number; reason: string }[] = [];
  for (const skill of skills) {
    if (containsWord(p, `/${foldText(skill.name)}`)) continue;
    const matched = [...new Set(skill.keywords)].filter((kw) => kw.includes(" ") && containsWord(p, foldText(kw)));
    if (matched.length > 0) scored.push({ name: skill.name, hits: matched.length, reason: matched[0] });
  }
  return scored
    .sort((a, b) => b.hits - a.hits)
    .slice(0, MAX_SKILLS)
    .map((s) => ({ name: s.name, reason: s.reason }));
}

// Shortlist-with-reasons only (031: no unconditional advisor line — silent when empty).
export function buildShortlistInjection(matched: { name: string; reason: string }[]): string {
  const lines = matched.map(
    (m) => `Skill(${m.name}) — possibly relevant (matched "${m.reason}"); load it only if it applies.`,
  );
  if (lines.length === 0) return "";
  return ["<skill-activation-hint>", ...lines, "</skill-activation-hint>"].join("\n");
}

// Feature-shape detection (029/US13): multi-word conservative patterns — a
// feature-shaped ad-hoc prompt gets a /flow-lifecycle line, because the hook only
// discovers SKILLS from disk and /flow-lifecycle is a command it would never propose.
const FEATURE_SHAPE_RES = [
  /\b(?:una?|la)\s+nueva\s+(?:feature|funcionalidad)\b/i,
  /\bnueva\s+(?:feature|funcionalidad)\b/i,
  /\bfeature\s+(?:nueva|completa)\b/i,
  /\bdesarrollar?\s+(?:una?|la)\s+(?:nueva\s+)?(?:feature|funcionalidad)\b/i,
  /\bde\s+principio\s+a\s+fin\b/i,
  /\btodo\s+el\s+ciclo\b/i,
];

export function detectFeatureShape(prompt: string): boolean {
  return FEATURE_SHAPE_RES.some((re) => re.test(prompt));
}

// The second sentence is the tiered context ceiling (plan 037): 300k by default, 400k when a
// task spans many files. The hook cannot run slash commands; the Lead proposes, Oriol decides.
export const FLOW_HINT_LINE =
  "Feature-shaped task → consider /flow-lifecycle — the full lifecycle (Skill flow: scope→plan→test-plan→build→review→retro). Wide scope → propose `/autocompact 400k` for this session (default ceiling 300k).";

// Model/effort routing by task shape (029/US7 — closes the 027 deployment gap:
// the advisor only fired at /flow-lifecycle boundaries, while 60+ manual /model+/effort
// toggles happened in ad-hoc turns). The hook cannot see session model state →
// suggestions are explicitly SHAPE-ONLY; the user executes /model / /effort.
const BULK_SHAPE_RE =
  /\b(?:barre|barrido|en masa|masivo|todos los ficheros|repo entero|inventaria|renombra todo|sweep mec[aá]nico)\b/i;
const QUICK_SHAPE_RE = /\b(?:pregunta|duda|consulta)\s+r[aá]pida\b|\bsolo dime\b/i;

export function detectRoutingShape(prompt: string): "bulk" | "quick" | null {
  if (BULK_SHAPE_RE.test(prompt)) return "bulk";
  if (QUICK_SHAPE_RE.test(prompt)) return "quick";
  return null;
}

// Exported so a host adapter can swap a Claude-only command for its own (H43).
export const ROUTING_LINES: Record<"bulk" | "quick", string> = {
  bulk: "Bulk/mechanical shape → consider a cheaper tier via `/model` + `/effort low` (shape-only suggestion, session state unknown — playbook §4).",
  quick: "Quick-lookup shape → consider `/effort low` (shape-only suggestion, session state unknown — playbook §4).",
};

export interface HintAnalysis {
  injection: string;
  skills: string[];
  reasons: string[]; // same order/length as skills — the keyword that fired
  flowHint: boolean;
  routingHint: boolean;
}

// Full pure pipeline: raw stdin → injection + emitted-hint metadata.
// `/goal <task>` is processed (its arg is real work); other
// slash commands are skipped (they self-route). SILENT unless a keyword or
// shape matched (031). Accepts a lazy skills getter so the pre-gates
// (empty/non-human/slash/malformed) never pay the skills-dir disk scan.
export function analyzePayload(
  raw: string,
  skillsOrGetter: SkillEntry[] | (() => SkillEntry[]),
): HintAnalysis {
  const none: HintAnalysis = {
    injection: "",
    skills: [],
    reasons: [],
    flowHint: false,
    routingHint: false,
  };
  if (!raw.trim()) return none;
  let payload: PromptPayload;
  try {
    payload = JSON.parse(raw) as PromptPayload;
  } catch {
    return none;
  }
  const rawPrompt = typeof payload.prompt === "string" ? payload.prompt : "";
  if (!rawPrompt.trim()) return none;
  if (isNonHumanPayload(rawPrompt)) return none;
  const goalMatch = rawPrompt.trimStart().match(/^\/goal\s+(.+)/is);
  const prompt = goalMatch ? goalMatch[1] : rawPrompt;
  if (!goalMatch && prompt.trimStart().startsWith("/")) return none;
  // Disk touched only past the pre-gates.
  const skills = typeof skillsOrGetter === "function" ? skillsOrGetter() : skillsOrGetter;
  const matched = matchWithReasons(prompt, skills);
  const flowHint = detectFeatureShape(prompt);
  const routingShape = detectRoutingShape(prompt);
  let injection = buildShortlistInjection(matched);
  const extraLines = [
    ...(flowHint ? [FLOW_HINT_LINE] : []),
    ...(routingShape ? [ROUTING_LINES[routingShape]] : []),
  ];
  if (extraLines.length > 0) {
    injection = injection
      ? injection.replace("</skill-activation-hint>", `${extraLines.join("\n")}\n</skill-activation-hint>`)
      : ["<skill-activation-hint>", ...extraLines, "</skill-activation-hint>"].join("\n");
  }
  return {
    injection,
    skills: matched.map((m) => m.name),
    reasons: matched.map((m) => m.reason),
    flowHint,
    routingHint: routingShape !== null,
  };
}

if (import.meta.main) {
  try {
    const raw = await readHookStdin();
    let cwd = process.cwd();
    try {
      const parsed = JSON.parse(raw) as PromptPayload;
      if (typeof parsed.cwd === "string") cwd = parsed.cwd;
    } catch {
      // fall through — analyzePayload handles malformed input
    }
    // Lazy: the skills-dir scan (~2 readdir + ~30 file reads) only runs when
    // the prompt survives the pre-gates (031) — slash/empty prompts cost 0 I/O.
    // ponytail: plugin skills (~/.claude/plugins/cache/**) are not scanned, so
    // company plugins get no hook hint; upgrade trigger = a missed plugin-skill
    // activation in real use (032/WP2).
    const analysis = analyzePayload(raw, () =>
      loadSkills([join(cwd, ".claude", "skills"), join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "skills")], "claude", skillOverrides(cwd)),
    );
    if (analysis.injection) process.stdout.write(analysis.injection + "\n");
  } catch {
    // best-effort — never block the prompt
  }
  process.exit(0);
}
