---
parent: flow
name: plan
description: Phase 2 — turn an approved spec.md into atomic HUs with a real dependency DAG, research-backed, ready for the joint gate 2→3.
---

# Phase 2 — Plan

Translate an approved `spec.md` into a Validated Execution Graph: atomic HUs, a DAG of real
dependencies, decisions backed by research. Deliverable: `tasks/index.md` + one
`tasks/US{N}.md` per HU. Three verifications precede every HU: project context (Glob/Grep),
external documentation (Context7/WebFetch), atomicity (drillme).

Precondition: `spec.md` with `status: approved` and gate 1→2 recorded. A `draft` spec →
STOP and escalate. Open questions in the spec are resolved with the user before planning.

## Initial detection

1. `Glob .claude/plans/*-*/spec.md`; several approved → the most recent, or ask.
2. Read `spec.md`; confirm `status: approved`.
3. Read `tasks.template.md` and `tasks-index.template.md` (project templates, then global).
4. An existing `tasks/` for this slug → ask "continue or restart?" before overwriting.

## Step 1 — Level triage (first line of the output)

Declare `Level: Quick|Standard|Full — <reason>` as the first line of the `tasks/index.md`
summary.

| Level | When | References loaded |
|---|---|---|
| **Quick** | Clear scope, 1-2 known files, no external research | `plan/01-discovery.md`, `plan/04-classification-waves.md` |
| **Standard** (default) | Dependencies or external APIs carry ambiguity | + `plan/02-research.md`, `plan/03-gap-analysis.md` |
| **Full** | Multi-domain, architectural risk, critical paths (auth/payments/secrets) | all six; `compare-and-decide` when 2+ alternatives exist |

Start at Quick and escalate on uncertainty; never splice levels. Restart at the higher one.

## Step 2 — TDD applicability

Read `rules/test-policy.md`. Declare on the second line:
`TDD-mode: <forced|adaptive|optional> — <reason from test-policy.md>`. That rule owns the
project default and the escalation inside a lifecycle (§Override in plan); resolve it per
node and record the reason. A node may carry `tdd-skip: <reason ≥10 chars>`; a skip
without a concrete reason is rejected.

## Step 3 — Discovery (anti-duplicate)

Full protocol: `plan/01-discovery.md`. Before any "create X": `Glob('**/X.ts')`,
`Glob('**/X/**')`, `Grep('class X', 'src/')`. **If it exists, modify; do not create.**

## Step 4 — Research (anti-obsolescence, Standard+)

Context7 for every external API the spec names (version + breaking changes); WebFetch of
1-2 reputable projects when the domain is unfamiliar; Grep/Glob for 5-10 project examples of
the pattern to preserve style. Record sources under `## Research` in `tasks/index.md`.
Checklist: `plan/02-research.md`.

## Step 5 — Gap analysis (Standard+)

Verify ground truth per planned change with `plan/03-gap-analysis.md`. A plan that names a
function, library version or test file without a Grep/Context7/Glob check STOPs until the
check runs.

## Step 6 — Closure questionnaire (3-5 questions, skip those the spec answers)

Project conventions to preserve (linter, formatter, naming) · external APIs and versions ·
performance/security constraints not in the spec · a project pattern you would improve
(ask before acting).

## Step 7 — Drillme, phase 2

Sweep the Phase 2 bank of `../../drillme-clarify/references/03-phase-questions.md` plus the
canonical categories; the bank is the single source and is not restated here. Any "I don't
know" or evasive answer iterates the plan. If `drillme-clarify` does not fire, invoke
`/drillme-clarify "Phase 2 plan closing for <NNN-slug>"` before requesting the gate.

## Step 8 — Stress-test alternatives (Full only)

Two or more technically reasonable alternatives → `compare-and-decide` (heavy tier) before
closing the plan.

## Step 9 — Construct the DAG

| Symbol | Type | Execution |
|---|---|---|
| 🔵 | Independent | Same wave |
| 🟡 | Dependent | After its inputs |
| 🔴 | Blocking | Human checkpoint before continuing |

Each HU: one verifiable outcome, acceptance criteria, ≤5 files, justified dependencies. A
sequential DAG is valid; split by behavior and coupling, never by a parallelism quota.
Cycles and waves of >10 HUs are smells: refactor the boundaries. Rules:
`plan/04-classification-waves.md`.

## Step 10 — Produce the artifacts

1. `tasks/index.md` from its template: frontmatter (`spec`, `phase: 2`, `total_us`,
   `dag_complete`), executive summary, effort per wave + critical path, mermaid DAG by wave,
   HU table, cross-cutting decisions, open questions deferred to phase 3, next step.
2. `tasks/US{N}.md` per HU from its template: frontmatter (`us`, `title`, `wave`,
   `depends_on`, `tdd_mode`, `estimate`, `status: draft`); the mandatory **Execution prompt
   (Phase 3 input)** block (Task / Context / Constraints / Deliverable / Verify / Ask-first;
   Arch H quality, Commandment VIII); quick-reference table; user story; numbered
   Given/When/Then ACs traceable to `spec.md`; files table; workflow; verification.

Every file, function and module an HU names was verified in Steps 3-5. A new library is
allowed when the plan justifies it in the plan itself (need, rejected alternative,
verified version); reopen scope only when the library contradicts a constraint `spec.md`
records.

## Step 11 — Cross-validation (Full, complexity >60)

Optional four-eyes audit of the DAG before closing: `plan/05-team-mode.md`.

## Step 12 — Quality gate

Run `plan/06-quality-gates.md`. Key checks: every HU has role/action/benefit, ACs,
`depends_on`, files and `tdd_mode`; every Execution prompt scores ≥70 against
`../../prompt-design/scoring-criteria.md` (refine below that; the score is a doubt signal,
not a hard stop); no cycles; every claim about existing code verified; test policy honored.

## Step 13 — Hand over to phase 2.5

Record `complete-phase 2`. Then run `references/03-test-plan.md` on the draft tasks and
confirm `tests.md`/`validations.md` exists before returning control; re-run it yourself if
the chain did not fire. An existing oracle may be reused after checking its coverage.

## Step 14 — Report

```text
Phase 2 closed for {NNN}-{slug}:
- Level: Quick|Standard|Full — <reason>
- TDD-mode: forced|adaptive|optional — <reason from test-policy.md>
- tasks/index.md: .claude/plans/{NNN}-{slug}/tasks/index.md
- HUs: N atomic stories in M waves · critical path: ~X sessions
- Dependencies: <why sequential where sequential>
- Research sources: <list>
- Drillme: <categories covered, gaps>
- Oracle (phase 2.5): produced | reused | pending (re-run)
```

Tasks and oracle are presented **together** at gate 2→3 (see phase 2.5). Record the user's
decision with `approve-gate 2-3 --approval <decision-ref>`; never infer it from files.

## SIEMPRE rules

- `spec.md` first; `draft` → STOP.
- Anti-duplicate before "create X"; anti-obsolescence before naming an external API; every
  path, function and import verified before it is written down.
- Honest reduction: "Quick — N HUs, no deep research" beats padding.
- A pattern you would improve → mention and ask; never act unasked.

## Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Tech-creep | A library appears with no justification next to it | Justify it in the plan (need, rejected alternative, version) |
| Synthetic AC | An HU AC with no `spec.md` AC or open question behind it | Trace it or remove it |
| DAG theater | N HUs, every one 🔵, no real dependencies | Either truly trivial (Quick, fewer HUs) or wrong granularity |
| Skipped research | Standard+ plan names an external API with no Context7 check | STOP and research; obsolescence bites in phase 3 |
| "Create everything" HU | >5 files in one HU | Split by behavior |
| Drillme bypass | Plan closed without the phase 2 sweep | Sweep before requesting the gate |

## Content map

| Topic | File |
|---|---|
| Discovery — sources and pre-create checks | `plan/01-discovery.md` |
| Research — Context7 and WebFetch anti-obsolescence | `plan/02-research.md` |
| Gap analysis per change type | `plan/03-gap-analysis.md` |
| HU classification and dependency waves | `plan/04-classification-waves.md` |
| Cross-validation for Full level | `plan/05-team-mode.md` |
| Quality gates, Poka-Yoke and TDD checklist | `plan/06-quality-gates.md` |
