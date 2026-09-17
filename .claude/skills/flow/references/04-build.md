---
parent: flow
name: build
description: Phase 3 — implement ONE approved HU from its task and oracle, verify it, and record its closure; includes the supervised Orca worker branch.
---

# Phase 3 — Build

Implement **one HU** per run from approved `tasks/` and the phase 2.5 oracle. The inline
path closes that HU before selecting another. An authorized Orca coordinator may assign
independent HUs to separate workers; only the coordinator records closures.

Precondition: `state.json.current_phase == 3` (gate 2→3 recorded) and a pending HU whose
dependencies are complete. Draft tasks, a missing oracle or all HUs closed → STOP and route
(phase 2.5 or phase 4).

## Supervised Orca worker

When the current prompt carries a live Orca Dispatch under an approved `orca-team` team,
read its worker contract (`../../orca-team/references/coordination.md`). Execute only the
assigned HU in the shared worktree. Follow Steps 1-8 below, ask the coordinator about gaps,
and reserve resources before edits or checks. Run scoped checks on stable inputs; ask the
coordinator to schedule shared checks that conflict with another writer. Return actual
evidence and remaining checks; never invent a pass. **Do not run Step 9 or the next-HU
actions of Step 10**: only the coordinator closes state and approval frontmatter. Send the
result through the current Orca lifecycle, then stop writing. The inline-only guidance
below describes the default executor; it does not override this authorized branch.

## Step 1 — Read inputs

`tasks/index.md`, the pending `tasks/US{N}.md`, `tests.md` and/or `validations.md`,
`state.json`, `rules/test-policy.md`. Several plans at phase 3 → ask.

## Step 2 — Identify the HU

| Invocation | Selection |
|---|---|
| `flow build US{id}` | That HU. Already closed → ask (re-run? abort?) |
| `flow build` | First pending HU whose `depends_on` are all closed. None → surface the blocked HU and escalate |

Read the chosen `tasks/US{N}.md` fully with its `T{N}.X` tests or validation block. Its
"Execution prompt (Phase 3 input)" block is the primary instruction; the rest elaborates it.

## Step 3 — Execute inline

The HU is one unit of work in the main session. One agent for "context isolation" is
forbidden (`agent-routing` P1/P2); `/clear` between HUs if context grows. Fan-out is a
wave-level, user opt-in decision at ≥4 independent HUs with disjoint files (`Workflow`), or
an authorized Orca team. A sensitive path (`.env`, `*.lock`, `package.json`,
`.claude/settings*.json`, `secrets/`) gets an inline `sensitive: <reason ≥8 chars>` before
the edit. A new skill, hook, rule, MCP or plugin → consult `harness-config` first.

## Step 4 — Style anchors

Before any Edit/Write: Glob for outputs of the same kind, Read 1-3 close examples, Grep the
functions and patterns the HU will use. When the HU writes tests, Glob the test
infrastructure and load the project's test-conventions skill; reuse fixtures by name and
add a new one only at the shared level the oracle flagged. **Lessons pass**:
`Skill(lessons-learned)` — cross-repo guards plus the `references/<stack>-*.md` file of the
HU's stack; mandatory when the HU touches code recovered from a stash or an old branch.

## Step 5 — Honor the TDD mode of the HU

Read `tdd_policy` in `tests.md` plus the per-node override (`tdd: forced` /
`tdd-skip: <reason>`); `rules/test-policy.md` §Override in plan owns the escalation.

| Mode | Loop |
|---|---|
| Forced | Write the test from `T{N}.X` → run it → confirm it fails with the predicted error (a pass before impl is a smell: STOP and confirm) → minimal implementation → run green → new edge cases become tests in the same HU |
| `tdd-skip` | Implement → run the existing suite as verification → a skip reason that looks wrong on inspection goes to Issues; the reason is binding meanwhile |
| Optional | Implement → run the suite → unrelated breakage → `troubleshooting` |
| Validation HU | Implement the document change → verify the five categories of `validations.md` → run the project smoke suite → a failed structural assertion is fixed before closure |

## Step 6 — Ask on concrete doubts, never improvise

Ambiguous interface, a decision the spec left open (path, name, default), an edge case the
ACs and oracle do not cover, a conflict between AC and project style → `AskUserQuestion`.
Never guess, never add features beyond the ACs. Two or more questions in one HU means the
HU was poorly defined: flag it for the retro.

## Step 7 — Drillme intra-HU

Sweep the Phase 3 bank of `../../drillme-clarify/references/03-phase-questions.md` (single
source) and any new gap; ask only what would change the decision. Report coverage and
unresolved gaps; never infer coverage from a fixed count or from an earlier phase. If
`drillme-clarify` does not fire and a real doubt blocks, invoke
`/drillme-clarify "<doubt — HU US{N}>"` before closing.

## Step 8 — Verify (blocking gate per HU)

Run `changes-verify` on the final diff before touching state: tests on touched files, the
project's required gate (baseline vs introduced failures distinguished), type check and lint
when configured, component documentation updated in the same HU. A failure →
`troubleshooting` within the `error-recovery.md` budget; after 2 retries → escalate. **A
failed or unexecuted required check leaves the HU pending.** Document-only work may record
`tests_passed: null`; never invent a suite run.

## Step 9 — Persist the verified closure

Write `verification-US{N}.json` per `docs/flow-contract.md` §Verification record: US id,
checked revision fingerprint, measured test result, every required check with observed
evidence (`not_run` for a skipped required check, never `not_applicable`). Then:

```bash
bun .claude/scripts/flow-state.ts close-us US{N} --verification <report.json> --files "a.md,b.ts"
```

The helper rejects absent or failed verification, stores it in `us_history` and projects the
closure into the HU frontmatter. After an interrupted projection use `sync-artifacts`. After
a review requests changes, `reopen-us US{N} --note <finding>` precedes new implementation.
Missing state is recovered from recorded decisions, never invented.

## Step 10 — Report

```text
🟢 HU US{N} closed.
- Files: <list>
- Tests: <pass>/<total>; red→green honored | tdd-skip: <reason> | validation closure
- Execution: inline | Orca worker (coordinator records closure)
- AskUserQuestion fired: <count>
- verification-US{N}.json recorded; state.json updated

Next: flow build US{M} (depends_on satisfied) | flow review when every HU is closed
```

When the last HU closes the helper sets `current_phase: 4`; report "Phase 3 complete —
review pending".

## SIEMPRE rules

- One HU at a time; never two open in parallel in one session.
- Read before Edit; Glob before Write; style anchors before writing.
- Only files in the HU's `files` field; extra files needed → reopen the plan's scope, do not
  edit "while there".
- Tests pass before "closed"; the closure carries its verification record.

## Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Improvised decision | Code decides something the AC left open, no question asked | Revert the ambiguous part, ask, redo |
| Skipped red | Forced TDD but the implementation landed before the test ran red | Revert temporarily, confirm red was reachable, document in Issues |
| Beyond the AC | New abstraction, hook or fallback nobody asked for | Remove; the simplest version that meets the AC |
| Closed without verification | HU marked done with no Step 8 record | Reopen, verify, then close |
| One agent for isolation | `Agent()` for a single HU | Forbidden; inline, `/clear` if needed |
| Drive-by edits | Diff touches files outside `files` | Revert them; flag the pattern for the retro |
