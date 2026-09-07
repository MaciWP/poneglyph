<!-- Last verified: 2026-06-22 (021 — split: behavioral triggers stay always-loaded here; procedural reference (SendMessage, diagnosis steps, recovery template, worktree cleanup) moved to orchestrator-protocol/references/07-error-recovery.md; hook-reliability table folded into rules/paths/hooks.md) -->

# Error Recovery

When a build step fails (inline, 1-3 units) or a `Workflow` unit fails (≥4 fan-out), the Lead diagnoses inline (loading `diagnostic-patterns` if needed) and decides: retry, re-plan, or escalate. No dedicated diagnosis agent — the Lead handles it.

## Retry Budget

| Error Type | Max Retries | Then |
|------------|-------------|------|
| Inline build — test failure | 2 | Lead diagnoses with `diagnostic-patterns` → fix inline |
| Inline build — Edit conflict | 1 | Re-read file, re-issue the edit |
| Workflow unit failure | 1 | Lead diagnoses → re-run the unit (or fold inline) |
| Workflow unit timeout | 1 | Double timeout → escalate to user |
| Critic BLOCKED | 0 | Re-plan with `tech-plan` |
| Critic NEEDS_CHANGES | 2 | Apply feedback → escalate to user |
| Worktree / Team failure | 1 | Re-run unit or fold the domain back inline |

> **Identical-error override**: the counts above assume each attempt yields a *different* or *progressing* error. If a retry reproduces the **exact same error**, stop immediately (see Stuck Detection) — do not spend the remaining budget on a non-progressing failure.

## Stuck Detection

| Condition | Action |
|-----------|--------|
| 3+ retries on the same task | STOP → AskUserQuestion |
| 2+ diagnoses without a working fix | STOP → AskUserQuestion |
| Same exact error 2 times | STOP → AskUserQuestion |

> **Escalation rung**: before STOP→AskUserQuestion, invoke the `unstuck` skill (`effort: xhigh`) for ONE deep change-of-technique pass — attack the *class* with a method not yet tried (`diagnostic-patterns`/`drillme`). If it still fails, then STOP→AskUserQuestion. Do not repeat the same attack louder.

When blocked, ask: (1) missing context, (2) approach change, (3) task split.

> **Procedural detail on demand** — SendMessage recovery (Workflow/Team agents), the Lead-driven diagnosis steps, the recovery-prompt template, and worktree cleanup live in `.claude/skills/orchestrator-protocol/references/07-error-recovery.md`. Hook reliability (which events are safe to gate on) lives in `.claude/rules/paths/hooks.md`.
