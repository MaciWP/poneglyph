---
name: flow
description: |
  Todas las fases del ciclo `/flow-lifecycle` en una sola skill: scope (spec.md),
  plan (tasks/ con DAG de HUs), test-plan (oracle tests.md/validations.md), build
  (una HU con TDD/validación), review (veredicto end-to-end en review.md) y retro
  (lecciones, promotions, cierre). El cuerpo compartido carga una vez; cada fase
  se lee bajo demanda desde `references/`.
  Úsala cuando: `/flow-lifecycle` entra en una fase, o pides una fase suelta:
  "define el alcance", "descompón en HUs", "diseña los tests / el oracle",
  "implementa la HU", "revisa el feature y dame el veredicto", "haz la retro".
metadata:
  keywords: >
    Keywords - flow, scope, alcance, spec, HU, DAG, tareas, descomponer, roadmap,
    oracle, TDD, tests, validations, test-design, build, implementa, ejecuta,
    siguiente HU, critic, revisa, audita, veredicto, verdict, retro, retrospectiva,
    lecciones, promotions, fase-1, fase-2, fase-2.5, fase-3, fase-4, fase-5
disable-model-invocation: false
argument-hint: "[scope|plan|test-plan|build|review|retro] [US{id} | brief]"
when_to_use: |
  "define el alcance", "descompón en tareas", "atomiza en HUs", "diseña los tests",
  "especifica el oracle", "implementa la HU", "siguiente HU", "revisa el feature",
  "dame el veredicto", "haz la retro", "qué hemos aprendido", inside /flow-lifecycle
---

# flow — the lifecycle phases

One skill, every phase. `/flow-lifecycle` (commands/flow-lifecycle.md) coordinates a
feature across them and owns the human gates; `docs/flow-contract.md` owns state and the
`flow-state.ts` helper; `dev-workflow` owns the development loop inside every phase. This
file holds what every phase shares. Read exactly one phase reference per entry.

| Phase | `current_phase` ready value | Reference | Produces | Closes with |
|---|---|---|---|---|
| 1 Scope | no plan, or `1` | `references/01-scope.md` | `spec.md` | human gate 1→2 |
| 2 Plan | `2` | `references/02-plan.md` | `tasks/index.md` + `tasks/US{N}.md` | `complete-phase 2` |
| 2.5 Test plan | `2.5` | `references/03-test-plan.md` | `tests.md` / `validations.md` | human gate 2→3 (tasks + oracle together) |
| 3 Build | `3` | `references/04-build.md` | one closed HU per run | `close-us` with verification record |
| 4 Review | `4` | `references/05-review.md` | `review.md` + assessment | `verdict` |
| 5 Retro | `5` | `references/06-retro.md` | `retro.md` | `retro-status` + `close-feature` |

## Definition of Done

- Reuse the active spec, task and oracle. Read the selected phase's Definition of Done and How You're Graded before execution.
- Return that phase's deliverable, evidence and actual gate status. A pending human decision or failed required check does not complete the phase.
- Return control to the lifecycle at the phase boundary. On resume, reuse recorded criteria and valid evidence; continue only pending work.

## How You're Graded

- You are graded on traceability from accepted scope to phase output and evidence, with accurate state transitions.
- No credit for extra HUs, invented lessons or replaying completed phases. Phase completion never supplies approval for the next gate.

## Phase selection

1. An explicit argument wins: `Skill(flow, "review")`, `/flow build US3`.
2. Without an argument, read `state.json` of the open plan and map `current_phase` with
   the table above (the contract defines those values; this file repeats none of its own).
3. No open plan → scope. Two open plans → ask which one; never guess.
4. A phase also runs standalone, without a lifecycle (an oracle for one HU, a review of a
   finished branch). Then skip the state commands and say so in the report.

## Shared discipline

- **Inputs first.** Read every artifact the phase lists; verify each path, symbol and claim
  with Glob/Grep/Read. Templates: project `.claude/plans/templates/`, then `~/.claude/plans/templates/`.
- **Depth scales, stages do not.** Declare the level (`light|standard|full`, or the plan's
  `Quick|Standard|Full`) and what you skipped, in the artifact and the report.
- **Drillme per phase.** The canonical bank is
  `../drillme-clarify/references/03-phase-questions.md`; this skill never copies it. Sweep the
  phase bank and any new gap; ask only what would change the decision. Skill-to-skill
  invocation is probabilistic: if `drillme-clarify` does not fire, invoke
  `/drillme-clarify "<phase> of <NNN-slug>"` yourself before closing the phase.
- **Auxiliaries.** Which skill fires in which phase, and its manual fallback:
  `docs/auxiliary-skills-matrix.md` §Fallbacks per phase. On a miss, apply the fallback row.
- **State and gates.** Only `flow-state.ts` mutates `state.json`; commands and record
  formats are in `docs/flow-contract.md`. An artifact's existence never proves approval.
  Gates 1→2 and 2→3 record one actual user decision (`approve-gate … --approval <ref>`).
  A failed or unexecuted required check leaves the HU or phase open.
- **Test policy.** `rules/test-policy.md` owns the project level and the flow escalation.
  Cite it; never restate it.
- **Execution model.** Inline in the main session. A single HU is never a reason to spawn.
  An authorized Orca team uses the supervised-worker branch in `references/04-build.md`;
  only the coordinator records transitions.
- **Effort.** Review (phase 4) runs at `/effort xhigh`; the other phases follow
  `docs/model-uplift-playbook.md` §4. The frontmatter pins no effort.

## SIEMPRE rules

- Restate the phase's goal and acceptance before acting; STOP when its precondition
  (approved spec, approved package, all HUs closed, approving verdict) is missing.
- Every AC, test, finding, lesson and promotion traces to evidence: a user answer, a file
  and line, an executed check. Nothing synthetic.
- Ask on a concrete doubt (`AskUserQuestion`); never improvise a decision the spec left open.
- Honest reduction: "skipped X because Y" in the report. Never a silent skip.
- Human decisions stay human: scope approval, package approval, verdict ratification,
  promotions, `spec.md` edits, archiving. The skill proposes; the user decides.
- Cite canonical files (drillme bank, test policy, flow contract); never copy them. An
  artifact's existence is not a gate decision: read `state.json`, ask if absent.
- A premise that fails mid-phase loops back to the phase that produced it, and says so.

## Commandments cubiertos

| # | Cómo |
|---|---|
| I · II | Every phase reads its inputs and verifies each claim with Glob/Grep/Read before producing |
| III | Honest levels, findings and "nothing to learn"; irreducible gaps stay `[OPEN]` |
| IV · VI | Oracle before build, verification before closure, checks before verdict; `security-audit` gates critical areas |
| V · IX | One shared body, one phase file per entry, canonical files cited; six skills became one |
| X | Inline by default; one fresh reviewer instead of a panel; a phase loads only its reference |

## Content map

The phase table above names the six phase references. Also: `references/plan/01…06-*.md`
(plan deep dives: discovery, research, gap analysis, waves, team mode, quality gates),
`references/review-fallback.md` and `retro-fallback.md` (templates when the plan templates
are missing), `references/07-history.md` (rationale, decisions, the 2026-09-17 merge).
