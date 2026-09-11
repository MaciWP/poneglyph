/**
 * skill-advisor ranking — pure, deterministic pre-filter.
 *
 * NOT a re-implementation of the model's semantic matching (keywords have ~0
 * measured effect on native activation — see _research-skill-activation). This
 * is a cheap lexical pre-filter that produces a SHORTLIST the human ratifies.
 * The skill body (SKILL.md) reasons over the in-context listing on top of this.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { frontmatter, skillKeywords } from "../../../scripts/lib/skill-metadata";

export interface SkillMeta {
  name: string;
  description: string;
  keywords: string[];
}

export interface RankedSkill extends SkillMeta {
  score: number;
}

export const SHORTLIST_MAX = 5;

/**
 * Census-derived usage tiers (031): 2 = high (≥5 launches), 1 = some use,
 * 0 (absent) = zero recorded launches. Used ONLY as a tie-breaker — lexical
 * score always dominates. Static by design (no I/O per invocation); refresh
 * this map from MEASURED invocations, not from a hand-kept census. Source: the Claude Code
 * Stats tab (the former /skill-doctor), which reports uses and last-used per skill.
 * Snapshot: 2026-09-11. A skill with no recorded invocation is simply absent.
 */
export const USAGE_TIER: Record<string, number> = {
  // Tier 2 — invoked five or more times in the last seven days.
  dev: 2, drillme: 2, scope: 2, "tech-plan": 2, lessons: 2,
  critic: 2, "tdd-design": 2, "prompt-engineer": 2,
  // Tier 1 — invoked at least once.
  build: 1, retro: 1, consult: 1, "pr-review": 1, "orchestrator-protocol": 1,
  "deep-research": 1, "pr-conventional-comments": 1, "skill-advisor": 1,
  // Skills with no recorded invocation carry no boost; absence is the default.
};
const STOP = new Set([
  "the", "and", "for", "with", "que", "los", "las", "una", "del", "por", "con",
  "este", "esta", "para", "como", "the", "a", "de", "el", "la", "en", "un",
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-záéíóúñ0-9]+/gi) ?? [])
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/**
 * Pure: given a task and a list of skill metadata, return a deduped shortlist
 * (≤ SHORTLIST_MAX) ranked by lexical overlap. Empty when nothing matches —
 * never invents candidates.
 */
export function rank(task: string, skills: SkillMeta[]): RankedSkill[] {
  const taskTokens = new Set(tokenize(task));
  if (taskTokens.size === 0) return [];

  const byName = new Map<string, RankedSkill>();
  for (const skill of skills) {
    if (byName.has(skill.name)) continue; // dedupe across dirs by name
    const hay = new Set([
      ...tokenize(skill.name),
      ...tokenize(skill.description),
      ...skill.keywords.flatMap((k) => tokenize(k)),
    ]);
    let score = 0;
    for (const t of taskTokens) if (hay.has(t)) score++;
    if (score > 0) byName.set(skill.name, { ...skill, score });
  }

  return [...byName.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        (USAGE_TIER[b.name] ?? 0) - (USAGE_TIER[a.name] ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, SHORTLIST_MAX);
}

/** Reads complete YAML frontmatter; the first readable entry per name wins. */
export function loadSkillsFromDisk(dirs: string[]): SkillMeta[] {
  const byName = new Map<string, SkillMeta>();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const file = join(dir, entry, "SKILL.md");
      if (byName.has(entry) || !existsSync(file)) continue;
      try {
        const { fields } = frontmatter(readFileSync(file, "utf8"));
        byName.set(entry, {
          name: entry,
          description: typeof fields.description === "string" ? fields.description : "",
          keywords: skillKeywords(fields),
        });
      } catch {
        // Unreadable skill or invalid YAML — skip.
      }
    }
  }
  return [...byName.values()];
}
