# Error Recovery — Procedural Reference

On-demand detail behind `.claude/rules/error-recovery.md` (which keeps only the always-loaded behavioral triggers: retry budget, identical-error override, stuck detection, escalation rung). Load this when actually recovering from a failure.

## SendMessage Recovery (Workflow / Team agents only)

`SendMessage({to: agentId})` continues a still-running **Workflow or Team agent** — preserves context, saves ~2K-5K tokens vs re-spawn. It does NOT apply to inline work (1-3 units): there is no agent to message — the Lead simply re-runs the step in its own session.

| Situation | Method | Reason |
|-----------|--------|--------|
| Inline build failed a test | Re-run inline | The Lead already holds the code context — no agent to message |
| Workflow unit failed a test | SendMessage to that unit | The unit already has its code context |
| Workflow unit failed on a stale edit | SendMessage | Re-read and retry in the same context |
| Lead diagnosed a fix for a live unit | SendMessage to that unit | Avoids re-exploring the codebase |
| Unit failed 2+ times | Re-run unit with full diagnosis | Original context may be contaminated |
| Error in a different agent | New unit / inline | SendMessage does not cross agents |

```
SendMessage({
  to: "wf-unit-a3f8c2",
  message: "Test failed: TypeError at auth.ts:23. Diagnosis: null check missing on user object. Fix: add guard clause before user.id access. Do NOT remove existing tests."
})
```

> SendMessage auto-resumes agents stopped in background. Team mode recovery: see `references/03-complexity-routing.md` §Team Mode Execution §Fallback to Subagents.

## Diagnosis Workflow (Lead-driven)

When a build step or Workflow unit fails, the Lead:

1. Read the error from the failure report (full message + stack).
2. Invoke `Skill('diagnostic-patterns')` if the error type is non-obvious (cascading failures, retry storms, timeouts, transient errors).
3. Apply a recovery strategy from the skill (5 Whys, stack-trace analysis, classification) using `Read`/`Grep`/`LSP` directly — no separate diagnosis subagent.
4. Decide: fix inline, SendMessage to the live Workflow unit with the fix, re-run with full diagnosis, or escalate to user.

## Recovery Prompt Template

When re-running a Workflow unit, ALWAYS include:

| Field | Content |
|-------|---------|
| **Original error** | Full error message |
| **Diagnosis** | Root cause identified by the Lead (cite line + reasoning) |
| **Do NOT repeat** | Specific action that caused the failure |
| **Changed constraints** | New limits or additional context |

## Worktree Cleanup on Failure

| Condition | Action |
|-----------|--------|
| Workflow unit in worktree fails | Preserve worktree, Lead diagnoses |
| Lead identifies a fix | Re-run the unit in the SAME worktree via SendMessage |
| Retry fails | Delete worktree + branch, escalate to user |
| Merge conflict in worktree | Lead resolves inline (or re-run the unit) |
| Unit fails on merge | Preserve worktree, escalate to user with diff |
