# Error Recovery: Procedural Reference

On-demand detail behind CLAUDE.md §How to work (failure line). Load this when actually recovering from a failure.

## Retry Budget

The Lead diagnoses failures inline with `troubleshooting` when needed, then retries, replans or escalates. Retry only proven failures within the allowance.

| Error Type | Max Retries | Then |
|------------|-------------|------|
| Inline build: test failure | 2 | Lead diagnoses with `troubleshooting` → fix inline |
| Inline build: Edit conflict | 1 | Re-read file, re-issue the edit |
| Team/agent unit failure | 1 | Lead diagnoses → re-run the unit (or fold inline) |
| Team/agent unit timeout | 1 | Double timeout → escalate to user |
| Critic BLOCKED | 0 | Re-plan with `flow` (plan phase) |
| Critic NEEDS_CHANGES | 2 | Apply feedback → escalate to user |
| Worktree / Team failure | 1 | Re-run unit or fold the domain back inline |

**Identical-error override**: the counts assume each attempt yields a different or progressing error. A retry that reproduces the exact same error stops at once (Stuck Detection).

## Stuck Detection

| Condition | Action |
|-----------|--------|
| 3+ retries on the same task | STOP → AskUserQuestion |
| 2+ diagnoses without a working fix | STOP → AskUserQuestion |
| Same exact error 2 times | STOP → AskUserQuestion |

**Escalation rung**: before STOP, run `Skill(troubleshooting)` §Stuck for ONE change-of-technique pass that attacks the class with a method not yet tried. Still failing → STOP and ask about (1) missing context, (2) an approach change, (3) a task split. Hook reliability (which events are safe to gate on): `harness-config` references/t05-hook.md.

## SendMessage Recovery (Team / live agents only)

`SendMessage({to: agentId})` continues a still-running **Team or background agent**, preserves context, saves ~2K-5K tokens vs re-spawn. It does NOT apply to inline work (1-3 units): there is no agent to message, the Lead simply re-runs the step in its own session.

| Situation | Method | Reason |
|-----------|--------|--------|
| Inline build failed a test | Re-run inline | The Lead already holds the code context, no agent to message |
| Live unit failed a test | SendMessage to that unit | The unit already has its code context |
| Live unit failed on a stale edit | SendMessage | Re-read and retry in the same context |
| Lead diagnosed a fix for a live unit | SendMessage to that unit | Avoids re-exploring the codebase |
| Unit's one retry also failed | Fold inline or escalate | Retry budget spent (§Retry Budget); its context may be contaminated |
| Error in a different agent | New unit / inline | SendMessage does not cross agents |
| Haiku scout answer opens with `INCOMPLETE: context budget reached.` (a Read denied near 90k by `haiku-context-brake.ts`) | New scout on its "Left unchecked:" list only, seeded with what it found; 1-2 items inline | SendMessage resumes the same near-full context |

```
SendMessage({
  to: "unit-a3f8c2",
  message: "Test failed: TypeError at auth.ts:23. Diagnosis: null check missing on user object. Fix: add guard clause before user.id access. Do NOT remove existing tests."
})
```

> SendMessage auto-resumes agents stopped in background. Team mode recovery: see `references/03-complexity-routing.md` §Team Mode Execution §Fallback to Subagents.

## Diagnosis Workflow (Lead-driven)

When a build step or an agent unit fails, the Lead:

1. Read the error from the failure report (full message + stack).
2. Invoke `Skill('troubleshooting')` if the error type is non-obvious (reproduce, locate the frame, 5 Whys).
3. Apply a recovery strategy from the skill (reproduce, stack-frame location, 5 Whys) using `Read`/`Grep` directly, no separate diagnosis subagent.
4. Decide: fix inline, SendMessage to the live unit with the fix, re-run with full diagnosis, or escalate to user.

## Recovery Prompt Template

When re-running an agent unit, ALWAYS include:

| Field | Content |
|-------|---------|
| **Original error** | Full error message |
| **Diagnosis** | Root cause identified by the Lead (cite line + reasoning) |
| **Do NOT repeat** | Specific action that caused the failure |
| **Changed constraints** | New limits or additional context |

## Worktree Cleanup on Failure

| Condition | Action |
|-----------|--------|
| Agent unit in worktree fails | Preserve worktree, Lead diagnoses |
| Lead identifies a fix | Re-run the unit in the SAME worktree via SendMessage |
| Retry fails | Preserve worktree and branch; escalate with the observed failure. Removal requires explicit authorization |
| Merge conflict in worktree | Lead resolves inline (or re-run the unit) |
| Unit fails on merge | Preserve worktree, escalate to user with diff |
