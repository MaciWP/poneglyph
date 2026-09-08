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
 * Precision-first by design (audit 2026-08-07: honor-rate 2/54 under the old
 * length-based rule — injection noise costs more than a missed hint):
 *   - a keyword qualifies a skill alone ONLY if it is multi-word ("revisa la pr")
 *   - single-word keywords need ≥2 DISTINCT hits for the same skill, after
 *     containment collapse ("prompt"+"prompts" from one physical word = 1 hit)
 *   - non-human payloads (task notifications, system reminders) are skipped
 *   - top 2 skills max; SILENT by default (031): no match, no shape → zero
 *     output; the always-loaded rules/skill-routing.md covers general routing
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

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
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

export function loadSkills(dirs: string[]): SkillEntry[] {
  const byName = new Map<string, SkillEntry>();
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
      if (byName.has(entry) || !existsSync(skillFile)) continue;
      try {
        const { fields } = frontmatter(readFileSync(skillFile, "utf8"));
        const keywords = skillKeywords(fields);
        if (keywords.length > 0) byName.set(entry, { name: entry, keywords });
      } catch {
        // Unreadable skill or invalid YAML — skip.
      }
    }
  }
  return [...byName.values()];
}

const MAX_SKILLS = 2;

// Payloads that reach UserPromptSubmit but are NOT typed by the human:
// background-task notifications, system reminders, local-command caveats.
// Matching their content produced hints about the system's own plumbing
// (audit 2026-08-07: a task-notification triggered prompt-engineer/orchestrator).
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

// Precision rule (audit 2026-08-07 — replaces the length-≥5 "strong" tier that
// caused "revisa"→critic, "prompt"→prompt-engineer, "agent"→orchestrator):
//   strong  = a matched keyword containing a space (multi-word phrase)
//   or else = ≥2 DISTINCT single-word hits for the same skill, where distinct
//             means not a substring of another matched keyword of that skill
//             ("prompt"+"prompts" collapse to one hit — one physical word).
// Carries the first matched keyword as a human-readable reason.
export function matchWithReasons(
  prompt: string,
  skills: SkillEntry[],
): { name: string; reason: string }[] {
  const p = prompt.toLowerCase();
  if (!p.trim()) return [];
  const scored: { name: string; hits: number; reason: string }[] = [];
  for (const skill of skills) {
    const matched = [...new Set(skill.keywords)].filter((kw) => p.includes(kw));
    if (matched.length === 0) continue;
    const distinct = matched.filter(
      (kw) => !matched.some((other) => other !== kw && other.includes(kw)),
    );
    const strong = distinct.some((kw) => kw.includes(" "));
    if (strong || distinct.length >= 2) {
      scored.push({
        name: skill.name,
        hits: distinct.length,
        reason: distinct.find((kw) => kw.includes(" ")) ?? distinct[0],
      });
    }
  }
  return scored
    .sort((a, b) => b.hits - a.hits)
    .slice(0, MAX_SKILLS)
    .map((s) => ({ name: s.name, reason: s.reason }));
}

// Shortlist-with-reasons only (031: no unconditional advisor line — silent when empty).
export function buildShortlistInjection(matched: { name: string; reason: string }[]): string {
  const lines = matched.map(
    (m) => `Skill(${m.name}) — relevant (matched "${m.reason}"); consider invoking.`,
  );
  if (lines.length === 0) return "";
  return ["<skill-activation-hint>", ...lines, "</skill-activation-hint>"].join("\n");
}

// Feature-shape detection (029/US13): multi-word conservative patterns — a
// feature-shaped ad-hoc prompt gets a /flow line, because the hook only
// discovers SKILLS from disk and /flow is a command it would never propose.
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

const FLOW_HINT_LINE =
  "Feature-shaped task → consider /flow — the full lifecycle (scope→tech-plan→tdd-design→build→critic→retro).";

// Model/effort routing by task shape (029/US7 — closes the 027 deployment gap:
// the advisor only fired at /flow boundaries, while 60+ manual /model+/effort
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

const ROUTING_LINES: Record<"bulk" | "quick", string> = {
  bulk: "Bulk/mechanical shape → consider a cheaper tier via `/model` + `/effort low` (shape-only suggestion, session state unknown — playbook §4).",
  quick: "Quick-lookup shape → consider `/effort low` (shape-only suggestion, session state unknown — playbook §4).",
};

export interface HintAnalysis {
  injection: string;
  skills: string[];
  reasons: string[]; // same order/length as skills — honor-rate re-measurement
  flowHint: boolean;
  routingHint: boolean;
}

// Full pure pipeline: raw stdin → injection + emitted-hint metadata (for the
// honor-rate log). `/goal <task>` is processed (its arg is real work); other
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

// Emit-side log for honor-rate measurement (029/US13): one JSON line per
// emitted hint under <cwd>/.claude/learned/skill-hints.log. The load side is
// instructions-loaded.log — honor-rate = loads following emissions. `reasons`
// (added post-audit 2026-08-07) records WHICH keyword fired, so precision can
// be re-measured per keyword. Fail-silent by contract: a logging failure must
// never block the prompt.
export function appendHintLog(
  baseDir: string,
  entry: { ts: string; skills: string[]; reasons: string[]; flow: boolean },
): boolean {
  try {
    const dir = join(baseDir, ".claude", "learned");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "skill-hints.log"), JSON.stringify(entry) + "\n");
    return true;
  } catch {
    return false;
  }
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
      loadSkills([join(cwd, ".claude", "skills"), join(homedir(), ".claude", "skills")]),
    );
    if (analysis.injection) {
      process.stdout.write(analysis.injection + "\n");
      appendHintLog(cwd, {
        ts: new Date().toISOString(),
        skills: analysis.skills,
        reasons: analysis.reasons,
        flow: analysis.flowHint,
      });
    }
  } catch {
    // best-effort — never block the prompt
  }
  process.exit(0);
}
