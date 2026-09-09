// One context-ceiling and effort policy for every host (plan 037, D1/D2 — 2026-09-09).
//
// Measured on this machine (14 days of ~/.claude/projects JSONL): 48.7 % of the assistant
// messages ran with >200k tokens of context and carried 80.7 % of all context tokens; two
// sessions (890k and 654k max context) were 71 % of the spend. The same shape sat in Codex
// (`model_auto_compact_token_limit = 800000`, xhigh) and Grok (xhigh). The policy is tiered:
// compact at 200k by default, raise to 400k per session when a task needs it, effort `high`
// (the hosts' own default) with the stronger tier one command away.
//
//   Claude  settings.global.json → autoCompactWindow "200k" · effortLevel "high"
//           raise:  /autocompact 400k   ·   /effort xhigh
//   Codex   $CODEX_HOME/config.toml (sync-codex) and the project .codex/config.toml
//           raise:  codex -c model_auto_compact_token_limit=400000 -c model_reasoning_effort=xhigh
//   Grok    ~/.grok/config.toml (sync-grok): percent of the model window (grok-4.6 = 500k)
//           raise:  GROK_CONFIG='{"session":{"auto_compact_threshold_percent":80}}' grok --effort xhigh
import { parse, stringify } from "smol-toml";

export const CONTEXT_POLICY = {
  defaultTokens: 200_000,
  largeTokens: 400_000,
  effort: "high",
  /** Codex plan mode keeps the stronger tier: planning is where the extra reasoning pays. */
  codexPlanEffort: "xhigh",
  /** grok-4.6 context window; Grok's threshold is a percent of it. [Probable — vendor pages, 2026-09-09] */
  grokContextWindow: 500_000,
} as const;

/** Claude keys as they must appear in settings.global.json (checked by the suite). */
export const CLAUDE_DESIRED = { autoCompactWindow: "200k", effortLevel: CONTEXT_POLICY.effort } as const;

export function percentOfWindow(tokens: number, window: number): number {
  return Math.max(1, Math.min(100, Math.round((tokens / window) * 100)));
}

export function codexDesired(): Record<string, unknown> {
  return {
    model_reasoning_effort: CONTEXT_POLICY.effort,
    plan_mode_reasoning_effort: CONTEXT_POLICY.codexPlanEffort,
    model_auto_compact_token_limit: CONTEXT_POLICY.defaultTokens,
  };
}

export function grokDesired(): Record<string, unknown> {
  // Grok has no absolute compaction limit, only a PERCENT of the model window. Left implicit,
  // Grok "assumes 200,000 tokens and mis-times auto-compaction" (its config guide), so 40 % would
  // silently mean 80k — the opposite of the ceiling. Pin the window (comment in the guide:
  // "context window size (for auto-compact)") so percent × window is a stated 200k on this machine.
  return {
    compat: { claude: { hooks: false } },
    models: { default_reasoning_effort: CONTEXT_POLICY.effort },
    model: { "grok-4.6": { context_window: CONTEXT_POLICY.grokContextWindow } },
    session: { auto_compact_threshold_percent: percentOfWindow(CONTEXT_POLICY.defaultTokens, CONTEXT_POLICY.grokContextWindow) },
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
 *  comments are not preserved — neither file carries any. */
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
    ? `context policy: effort ${CONTEXT_POLICY.effort} · plan ${CONTEXT_POLICY.codexPlanEffort} · compaction ${CONTEXT_POLICY.defaultTokens / 1000}k`
    : `context policy: Claude hooks off · effort ${CONTEXT_POLICY.effort} · compaction ${pct} % (${CONTEXT_POLICY.defaultTokens / 1000}k of ${CONTEXT_POLICY.grokContextWindow / 1000}k)`;
}
