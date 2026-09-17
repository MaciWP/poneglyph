---
parent: flow
name: history
description: Rationale, decision history and the 2026-09-17 merge of the six phase skills into `flow` — history, not runtime procedure.
---

# flow — history

## 2026-09-17 — six phase skills merged into one

`flow-scope`, `flow-plan`, `flow-test-plan`, `flow-build`, `flow-review` and `flow-retro`
were cut and replaced by this skill: one shared body plus one reference per phase, read on
entry. Measured before the merge: 113 KB across the six `SKILL.md` bodies, 36 KB of it
sections repeated six times (principle, when to use / skip, intra-phase adaptation, edge
cases, smell signals, anti-patterns, commandments, output reminder). Decision reference:
Oriol's drillme answers of 2026-09-17 (shape, content policy, deletion, execution).

Ratified cuts, per phase:

| Cut | Where it lived | Why it went |
|---|---|---|
| "Underlying principle", "When to use", "When to skip" | every phase | `/flow-lifecycle` routes phases; a two-line precondition per reference replaces them |
| "Adaptación intra-fase" tables | every phase | One shared rule: declare the level and what you skipped |
| "Casos edge" and "Smell signals" lists | every phase | The rules they guarded survive as SIEMPRE rows or anti-patterns; the lists themselves were restatements |
| "Commandments cubiertos" per phase | every phase | One table in `SKILL.md` |
| "Output format reminder" | scope, plan, test-plan, retro | The step that produces the report is the single copy (H50 already applied to build and review) |
| "Auxiliary skills" pointer, "Consumer downstream", per-phase content maps | every phase | One pointer in `SKILL.md`; one content map |
| Full-mode product perspectives (3 parallel agents) in scope | scope Step 3 | Spawning needs the per-task gate anyway; `compare-and-decide` covers the decision case |
| The inline copy of the Phase 1 drillme questions | scope | The bank in `drillme-clarify/references/03-phase-questions.md` is the only source |
| Retro's auxiliary matrix and review's auxiliary matrix | their `references/01-*.md` | Rows moved to `docs/auxiliary-skills-matrix.md` §Fallbacks per phase, the canonical owner |
| `effort: xhigh` frontmatter on review | review | Would apply to six phases; the review reference states the effort instead |

Kept verbatim in spirit: every numbered step, the report blocks, the state commands, the
test-anchored invariants (H19, H30, H50, H53, H68) and the supervised Orca worker branch.
`flow-plan/references/01…06` moved to `references/plan/`; the review and retro embedded
fallback templates moved to `references/review-fallback.md` and `retro-fallback.md`.

## Rationale per phase (relocated from the six histories, 2026-09-03 and earlier)

- **Scope** — "Perfect code of the wrong thing is worthless" (Cmd I). Most engineering pain
  comes from skipping the what/why. Until root problem and out-of-scope are explicit, no
  technical work proceeds; gate 1→2 is non-negotiable (Cmd IV).
- **Plan** — anti-duplicate, anti-obsolescence, anti-hallucination on every claim (adapted
  from planner-protocol §1). Planning pain: reinventing what exists, building on stale APIs,
  non-atomic HUs. Migration MIGRAR-Y-CUT of the legacy `planner-protocol` skill (US3 AC7):
  references 01-06 preserved, legacy workflow/output-format files and the `planner` command
  wrapper cut.
- **Test plan** — "each planned function → its test, scaled by test-policy" (Cmd IV). The
  gap between "we agreed on the plan" and "the code is correct" needs a verifiable bridge:
  executable tests for code, declarative validations for documents. Forcing either onto the
  other is ceremony; dual mode is the honest answer.
- **Build** — "each HU closes intra-phase before the next; smallest diff that satisfies the
  AC + drillme" (Cmd V, IV). Phase 3 is the only phase that touches production code.
  Execution model: the `builder` agent (feature 001, invoked for HUs ≥5 files "for context
  isolation") was cut in feature 008 — one agent is forbidden, isolation is not a reason,
  `/clear` resets context. Fan-out only at wave level (≥4 independent HUs, opt-in) or an
  authorized Orca team (036).
- **Review** — "tests per HU prove the parts; the critic proves the whole" (Cmd IV, VII).
  Unit tests can all pass with the feature broken at the seams; the critic is the
  seam-checker. Independent review model: `reviewer` agent (001) → cut in 008 (panel ≥4 via
  Workflow, or inline with declared bias) → panel demoted in 019: evidence 018 W1 D1/D3, W2
  D1 (verifier gap; MAST 23.5 % verification failures; LLM-judge ~80 % false positives vs
  deterministic 0 %; Augment dropped its ensembler). Default since 019: runnable checks +
  ONE fresh-context read-only reviewer (the explicit P1 exception), user-ratified 2026-06-10.
  Panels remain valid only for decision review (`compare-and-decide`). AC8 decision:
  `code-quality` KEPT as catalog (SOLID detail, complexity metrics, anti-pattern catalog,
  extract patterns, N+1 and leak patterns, refactoring safety) — none duplicated in review.
- **Retro** — "without retro, every cycle starts from the same baseline" (Cmd VII, IX). The
  review measures the deliverable; the retro measures the process and upgrades the
  meta-system. Ratification ownership (plan 025): `retro_status` is two-state with a named
  owner; a `pending` retro is the documented back-half abandonment mode (audit 2026-06-30).
  Skip discipline (029/US12): announced, justified, recorded.

## Verification of the phase skills (historical smoke checks)

- Scope: an invocation with a brief starts the questionnaire; without a brief it asks for
  one; the produced `spec.md` validates against `spec.template.md`.
- Plan: with an approved spec it produces `tasks/index.md` + `US{N}.md` and hands over to
  the test plan; `planner-protocol` and `commands/planner.md` are gone.
- Test plan: `tests.md` declares `tdd_policy` matching test-policy; every TDD HU has a red
  annotation; every validation HU has the five categories or honest skips.
- Build: one HU inline, diff + tests pass, `state.json` closure entry, no files outside
  `files`, red before green when forced.
- Review: `review.md` with five sections, `review_level` + reason, `file:line` findings,
  `fresh_reviewer_invoked` consistent with the level.
- Retro: `retro.md` with the eight sections and candidates; `spec.md` mtime unchanged
  during the retro; closure only after ratification.
- All: `bun test ./.claude/` green (markdown-only changes).
