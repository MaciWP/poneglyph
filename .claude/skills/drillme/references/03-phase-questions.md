---
parent: drillme
name: phase-questions
description: Phase-specific question banks for the poneglyph 5-phase workflow. Loaded by drillme when auto-detecting a phase from .claude/plans/{NNN}-{slug}/ artefacts.
---

# Phase-specific question banks

## Contents

- [Phase 1 — Scope (scope-definer)](#phase-1-scope-scope-definer)
- [Phase 2 — Plan (tech-planner)](#phase-2-plan-tech-planner)
- [Phase 2.5 — TDD design (tdd-designer)](#phase-25-tdd-design-tdd-designer)
- [Phase 3 — Build (story-executor, intra-HU)](#phase-3-build-story-executor-intra-hu)
- [Phase 4 — Review (critic-reviewer)](#phase-4-review-critic-reviewer)
- [Phase 5 — Retro (retro-learner)](#phase-5-retro-retro-learner)
- [Loading rule for drillme](#loading-rule-for-drillme)
- [Phase auto-detection priority](#phase-auto-detection-priority)
- [When phase questions don't fit the actual context](#when-phase-questions-dont-fit-the-actual-context)

When drillme detects an active 5-phase workflow context (see SKILL.md §The recipe — Step 1), it loads the relevant phase bank **in addition to** the canonical 4 categories. Phase questions are tagged `[phase-N]` in the output so the user sees their origin.

These question banks are the **canonical source**. Phase skills (`scope-definer`, `tech-planner`, `tdd-designer`, `story-executor`, `critic-reviewer`, `retro-learner`) reference them — they do NOT duplicate the content in their own SKILL.md.

## Phase 1 — Scope (scope-definer)

Closing the spec.md before hard gate 1->2.

### Questions

| # | Question | Canonical tag |
|---|---|---|
| 1 | **Root problem?** What is the root cause, not the symptom? Apply 5-whys if needed. | `[approach]` |
| 2 | **What if we don't?** Severity test: what happens if we skip this work entirely? | `[failure]` |
| 3 | **Who suffers today?** Implicit stakeholders — who feels the problem now? | `[context]` |
| 4 | **MVP outcome?** What's the minimum viable result that resolves the core pain? | `[approach]` |
| 5 | **Out of scope?** Close doors explicitly. What is NOT included? | `[location]` |

### Closing rule

If any of the 5 returns "no sé / not sure" without follow-up reason → **do not close Phase 1**. Iterate until concrete answer or marked `[OPEN]` in spec.md with explicit reason.

## Phase 2 — Plan (tech-planner)

Closing tasks/ before hard gate 2->3.

### Questions

| # | Question | Canonical tag |
|---|---|---|
| 1 | **Simpler option?** Is there a simpler solution that meets the spec? | `[approach]` |
| 2 | **Reinventing wheel?** Am I duplicating something already in the project? | `[context]` |
| 3 | **Truly atomic?** Each US completable in ≤1 session? | `[approach]` |
| 4 | **Real deps?** Are dependencies functional or just cosmetic ordering? | `[context]` |
| 5 | **Failure tolerance?** If one US fails mid-implementation, does the DAG survive? | `[failure]` |
| 6 | **Right location?** Do these files live in the directory the project's conventions dictate? | `[location]` |

### Closing rule

If "I don't know" or evasive on any of the 6 → iterate plan; do NOT close. Question 6 closes the `[location]` coverage gap detected in US3 (3/4 → 4/4).

## Phase 2.5 — TDD design (tdd-designer)

Closing tests.md or validations.md.

### Questions

| # | Question | Canonical tag |
|---|---|---|
| 1 | **Happy + edge?** Each HU has ≥1 happy path + ≥1 edge case test? | `[failure]` |
| 2 | **Untestable HU?** If any HU has no natural test → is the HU well-defined or atomic? | `[approach]` |
| 3 | **Property-based fit?** Does any HU have invariants (parsers, pure transforms) that property-based would cover better than examples? | `[approach]` |
| 4 | **Mode honest?** Are TDD-mode HUs really code, and validation-mode HUs really docs/configs? Mixing produces ceremony. | `[approach]` |

### Closing rule

If >30% HUs are "untestable" → the Phase 2 decomposition is wrong; reopen Phase 2 (smell signal).

## Phase 3 — Build (story-executor, intra-HU)

Before marking a single HU as completed.

### Questions

| # | Question | Canonical tag |
|---|---|---|
| 1 | **Pattern ignored?** Is there a pattern in the project I'm ignoring? | `[context]` |
| 2 | **Duplication?** Does my implementation introduce duplication? | `[context]` |
| 3 | **Over-engineering?** Am I adding more than the AC requires? | `[approach]` |
| 4 | **Naming consistent?** Are names consistent with the rest of the codebase? | `[approach]` |
| 5 | **Failure surfaced?** If this breaks at 3am, is there enough signal to debug? | `[failure]` |

### Closing rule

Tests must pass before marking the HU completed. Drillme is in addition to, not instead of, test passing.

## Phase 4 — Review (critic-reviewer)

Before producing the verdict in review.md.

### Questions

| # | Question | Canonical tag |
|---|---|---|
| 1 | **Spec drift?** Does the spec.md still describe what was delivered? If not, mark delta for living-spec loop. | `[approach]` |
| 2 | **E2E happy path?** Does the full happy path work, not just modules? | `[failure]` |
| 3 | **Edge case the user will hit?** Is there an edge case we didn't test that real usage will surface? | `[failure]` |
| 4 | **Coverage matches policy?** Does test coverage match what test-policy.md expects? | `[approach]` |
| 5 | **Implicit dependencies?** Did this touch anything we didn't account for (other features, hooks, docs)? | `[context]` |

### Closing rule

If E2E happy path fails (question 2) → verdict cannot be APPROVED. Drillme failure here is a blocking signal, not just guidance.

## Phase 5 — Retro (retro-learner)

Before closing the feature.

### Questions

| # | Question | Canonical tag |
|---|---|---|
| 1 | **Phase too heavy?** Which phase weighed more than it needed to? | `[approach]` |
| 2 | **Avoidable friction?** Was there friction that didn't add value? | `[failure]` |
| 3 | **Reusable pattern?** Did a pattern emerge that's reusable beyond this task? | `[context]` |
| 4 | **Global vs local?** Is this promotable to `~/.claude/` global or just this project? | `[location]` |
| 5 | **Commandment violated silently?** Did any Commandment get violated without noticing? | `[failure]` |

### Closing rule

If question 5 surfaces a Commandment violation → MUST be reported in retro.md "Commandments check" section (Commandment III — radical honesty, no softening). The feature can still close, but the violation is documented for future sessions.

## Loading rule for drillme

When `$ARGUMENTS` is empty and a phase is auto-detected (see SKILL.md §Workflow Step 1), drillme appends the relevant phase bank to the output **after** the canonical 4-category questions. Coverage report should show both:

```markdown
Coverage: 4/4 canonical categories + 5/5 phase-1 questions.
```

If `$ARGUMENTS` provides an explicit brief, the phase bank is **skipped** (the user has narrowed the context manually). Only the canonical catalog + complementary patterns apply.

## Phase auto-detection priority

When multiple artefacts exist in `.claude/plans/{NNN}-{slug}/`, pick the phase by latest modification:

1. `retro.md` exists & most recent → Phase 5
2. else `review.md` exists & most recent → Phase 4
3. else (`validations.md` or `tests.md`) & most recent → Phase 2.5 closure (after tasks/) OR Phase 3 closure depending on `state.json.current_phase`
4. else `tasks/index.md` exists & most recent → Phase 2
5. else `spec.md` exists & most recent → Phase 1
6. else → no phase detected; ask user for explicit brief

If two artefacts have the same modification timestamp → prefer the later phase (workflow direction is forward).

## When phase questions don't fit the actual context

Smell signal: if drillme loaded a phase bank but the questions feel irrelevant to the user's actual concern → the auto-detection caught a stale artefact. Tell the user:

> "Detected Phase X from `<artefact>` but the questions don't fit your stated concern. Want me to drill on `<their concern>` instead?"

Don't force phase questions where they don't apply. Honesty > coverage.

## Phase banks are a floor, not a ceiling

These banks are the **minimum** sweep per phase, not the maximum. Under the exhaustive model (SKILL.md), drillme also sweeps the lateral / improvement categories from `01-catalog-socratic.md` (partial failures, retries, security surface, migration, observability, cost…) whenever a gap there would change the decision. The phase bank guarantees the phase-critical questions are asked; the lateral sweep catches the gaps the requester didn't mention. Both are gap-gated — no padding.
