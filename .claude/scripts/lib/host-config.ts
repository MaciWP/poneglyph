// One context-ceiling and effort policy for every host (measured 2026-09-09).
//
// Measured on this machine (14 days of ~/.claude/projects JSONL): 48.7 % of the assistant
// messages ran with >200k tokens of context and carried 80.7 % of all context tokens; two
// sessions (890k and 654k max context) were 71 % of the spend. The same shape sat in Codex
// (`model_auto_compact_token_limit = 800000`, xhigh) and Grok (xhigh). The policy is tiered:
// compact at 300k by default, raise to 400k per session when a task needs it, effort `high`
// with the stronger tier one command away. `high` was the hosts' own default until Opus 5.5,
// which defaults to `medium` (Claude Code 2.1.280); the policy pins `high` there explicitly.
// The default was 200k until 2026-10-02: below it Opus 5.5 showed no measurable rise in latency
// or tool errors, while 137 compactions in 8 days cost ~19 min/day; the Claude Code team places
// context rot at ~300-400k on the 1M model, so 300k sits at the lower edge of that band.
//
//   Claude  settings.global.json → autoCompactWindow 300000 · effortLevel "high"
//           · modelSettings["claude-opus-5-5"].effortLevel (claudeOpusEffort): in USER settings Opus 5.5
//           and later models ignore the top-level key (settings-reference, 2026-09-22).
//           The settings key is validated as an INTEGER (100k-1M) with `.catch(undefined)`:
//           the string "200k" written until 2026-09-18 was dropped silently and every
//           session ran at the model default (~967k on [1m] models). Only the command and
//           the CLI flag accept a suffix.
//           raise:  /autocompact 400k   ·   /effort xhigh
//   Codex   $CODEX_HOME/config.toml (sync-codex) and the project .codex/config.toml
//           raise:  codex -c model_auto_compact_token_limit=400000 -c model_reasoning_effort=xhigh
//   Grok    ~/.grok/config.toml (sync-grok): percent of the model window (grok-4.6 = 500k)
//           raise:  GROK_CONFIG='{"session":{"auto_compact_threshold_percent":80}}' grok --effort xhigh
import { parse, stringify } from "smol-toml";

export const CONTEXT_POLICY = {
  defaultTokens: 300_000,
  largeTokens: 400_000,
  effort: "high",
  /** Codex plan mode keeps the stronger tier: planning is where the extra reasoning pays. */
  codexPlanEffort: "xhigh",
  /** grok-4.6 context window; Grok's threshold is a percent of it. [Probable, vendor pages, 2026-09-09] */
  grokContextWindow: 500_000,
  /** Codex skill catalog budget. The prompt router is the discovery channel, so the catalog
   *  only needs the names. Measured with 35 skills: 800 keeps every name with ~25 description
   *  characters; 400 drops 12 skills, because Codex cuts descriptions first and then skills.
   *  Names alone take ~15 tokens each, so 800 holds about 50 skills; raise it before that. */
  codexSkillTokens: 800,
  /** Opus 5.5 main-session effort: `medium` (its own default) is a one-week cost experiment
   *  started 2026-10-10, after Opus main sessions took 1277 of 1328 $ API-equivalent in a week
   *  that ended at 99 % of the plan. Compare the weekly plan % on 2026-10-17; back to `high`
   *  if quality drops. */
  claudeOpusEffort: "medium",
  /** Haiku bills a prompt above 100k at 5x. A 120k window compacts Haiku sessions and subagents
   *  near 87k (window minus the output reserve and buffer; a 100k window compacted at ~65k), so
   *  the compaction request itself stays under 100k. Oversized Reads are narrowed by
   *  hooks/haiku-context-brake.ts so one Read cannot jump past it. */
  claudeHaikuTokens: 120_000,
  /** Sonnet has no price step, but every step re-reads the whole context from cache. A 130k window
   *  compacts near 95k (same reserve as Haiku), so each step stays cheap; agents on Sonnet get a
   *  budget line from hooks/lib/haiku-budget.ts to keep that context clean. */
  claudeSonnetTokens: 130_000,
} as const;

/** Claude keys as they must appear in settings.global.json (checked by the suite). */
export const CLAUDE_DESIRED = {
  autoCompactWindow: CONTEXT_POLICY.defaultTokens,
  effortLevel: CONTEXT_POLICY.effort,
  modelSettings: {
    "claude-opus-5-5": { effortLevel: CONTEXT_POLICY.claudeOpusEffort },
    "claude-haiku-5-5": { autoCompactWindow: CONTEXT_POLICY.claudeHaikuTokens },
    "claude-sonnet-5-5": { autoCompactWindow: CONTEXT_POLICY.claudeSonnetTokens },
  },
} as const;

export function percentOfWindow(tokens: number, window: number): number {
  return Math.max(1, Math.min(100, Math.round((tokens / window) * 100)));
}

export function codexDesired(): Record<string, unknown> {
  return {
    model_reasoning_effort: CONTEXT_POLICY.effort,
    plan_mode_reasoning_effort: CONTEXT_POLICY.codexPlanEffort,
    model_auto_compact_token_limit: CONTEXT_POLICY.defaultTokens,
    skills: { max_context_tokens: CONTEXT_POLICY.codexSkillTokens },
  };
}

export function grokDesired(): Record<string, unknown> {
  // Grok has no absolute compaction limit, only a PERCENT of the model window. Left implicit,
  // Grok "assumes 200,000 tokens and mis-times auto-compaction" (its config guide), so 40 % would
  // silently mean 80k, the opposite of the ceiling. Pin the window (comment in the guide:
  // "context window size (for auto-compact)") so percent × window is a stated ceiling on this machine (60 % = 300k).
  return {
    compat: { claude: { hooks: false } },
    models: { default_reasoning_effort: CONTEXT_POLICY.effort },
    model: { "grok-4.6": { context_window: CONTEXT_POLICY.grokContextWindow } },
    session: { auto_compact_threshold_percent: percentOfWindow(CONTEXT_POLICY.defaultTokens, CONTEXT_POLICY.grokContextWindow) },
    // Grok lists ~/.claude/agents/prompt-router.md as a user agent, but its memory and answer
    // check come from the Claude hooks (router/agent-hooks.ts), off here: never let Grok launch it.
    subagents: { toggle: { "prompt-router": false } },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

// Deep-merges `desired` into `target`; returns whether anything changed. Keys the policy does
// not name are never touched, so foreign settings (MCP servers, plugins, hooks) survive.
function mergeInto(target: Record<string, any>, desired: Record<string, unknown>): boolean {
  let changed = false;
  for (const [key, value] of Object.entries(desired)) {
    if (isPlainObject(value)) {
      if (!isPlainObject(target[key])) { target[key] = {}; changed = true; }
      if (mergeInto(target[key], value)) changed = true;
    } else if (!Object.is(target[key], value)) {
      target[key] = value;
      changed = true;
    }
  }
  return changed;
}

/** Pure: a TOML document plus the keys it must contain → the same text, or the merged document.
 *  smol-toml round-trips both live configs on this machine value-for-value (verified 2026-09-09);
 *  comments are not preserved, neither file carries any. */
export function tomlPlan(text: string, desired: Record<string, unknown>): { changed: boolean; content: string } {
  const config = (text.trim() ? parse(text) : {}) as Record<string, any>;
  return mergeInto(config, desired) ? { changed: true, content: stringify(config) } : { changed: false, content: text };
}

export function codexConfigPlan(text: string): { changed: boolean; content: string } {
  return tomlPlan(text, codexDesired());
}

export function grokConfigPlan(text: string): { changed: boolean; content: string } {
  return tomlPlan(text, grokDesired());
}

export function describePolicy(host: "codex" | "grok"): string {
  const pct = percentOfWindow(CONTEXT_POLICY.defaultTokens, CONTEXT_POLICY.grokContextWindow);
  return host === "codex"
    ? `context policy: effort ${CONTEXT_POLICY.effort} · plan ${CONTEXT_POLICY.codexPlanEffort} · compaction ${CONTEXT_POLICY.defaultTokens / 1000}k · skill catalog ${CONTEXT_POLICY.codexSkillTokens} tokens`
    : `context policy: Claude hooks off · effort ${CONTEXT_POLICY.effort} · compaction ${pct} % (${CONTEXT_POLICY.defaultTokens / 1000}k of ${CONTEXT_POLICY.grokContextWindow / 1000}k)`;
}
