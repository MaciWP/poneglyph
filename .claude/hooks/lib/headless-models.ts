// Single owner of "which model tiers are expensive" for headless runs (plan 033).
// Imported by the PreToolUse hook (runs from ~/.claude/hooks, junction of this dir)
// and by scripts/lib/headless.ts (runs from the repo). Names are host capabilities:
// keep the regex on the FAMILY, not on dated IDs, so a new Fable/Opus build is still
// caught without an edit.
export const EXPENSIVE_MODEL_RE = /fable|opus/i;

export const CHEAP_TIER = "claude-haiku-4-5-20251001"; // prose graders, smoke (`READY`)
export const MID_TIER = "claude-sonnet-5"; // skill-trigger cases, activation probes

export function isExpensiveModel(model: string): boolean {
  return EXPENSIVE_MODEL_RE.test(model);
}
