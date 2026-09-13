---
name: retro
description: |
  Retrospectiva post-feature (Fase 5 del workflow `/flow`). Captura lecciones técnicas, saca a la luz la fricción de proceso, propone promotions a uno de tres scopes (global ~/.claude/ vs proyecto .claude/ vs memoria), cierra el living-spec loop consumiendo el spec_drift clasificado por critic, y audita el cumplimiento de los 10 Commandments. NO auto-edita spec.md: produce un diff para aprobación humana. Cierra el lifecycle del feature.
  Úsala cuando: review.md APPROVED o APPROVED_WITH_WARNINGS, feature completo, antes de declarar el lifecycle cerrado, tras /critic, "retro", "retrospectiva", "qué hemos aprendido", "promover".
metadata:
  keywords: >
    Keywords - retro, retrospectiva, aprender, learn, lecciones, lessons, promover,
    promotion, promote, living-spec, delta, commandments, closure, fase-5, phase-5
disable-model-invocation: false
argument-hint: ""
when_to_use: |
  "retrospectiva", "qué hemos aprendido", "promueve aprendizajes", "retro", "lessons learned", "what to promote"
---

# Retro (Phase 5)

Last phase of the 5-phase workflow. Captures what worked, what didn't, proposes promotions, closes the living-spec loop. **Honesty is non-negotiable** (Commandment III) — a retro without friction or without a proposed lesson is review theater.

## Underlying principle

> "Without retro, every cycle starts from the same baseline." (Commandment VII — observability and self-improvement; Commandment IX — meta-system maintainability)

Phase 5 measures the **process** that produced the deliverable and turns it into structural improvements. Rationale: `references/03-history.md`.

## When to use

| Trigger | Example |
|---|---|
| `review.md` exists with verdict APPROVED or APPROVED_WITH_WARNINGS | After `/critic` closes Phase 4 |
| User invokes `/retro` explicitly | Direct invocation |
| `critic` skill closes Phase 4 and triggers Phase 5 invocation | Auto-chain from Phase 4 |

## When to skip

| Anti-trigger | Why |
|---|---|
| `review.md` verdict is NEEDS_CHANGES or BLOCKED | Phase 3/4 first — retro on incomplete work captures wrong lessons |
| Trivial mode (no `tasks/` directory) | Brief verbal recap to user — Phase 5 ceremony adds nothing |
| Two consecutive retros on the same feature without code change between them | Diminishing returns; skip and proceed |

> **Skip discipline (029/US12, user decision)**: skipping retro is the LEAD's call, taken only when there is genuinely nothing to learn (no lessons, no promotions, no spec drift) — announced BEFORE skipping, with explicit justification, and recorded: `bun $HOME/.claude/scripts/flow-state.ts retro-status "skipped — <justificación ≥10 chars>"`. `close-feature` refuses a null/pending retro, so a silent skip is mechanically impossible.

## Workflow

### Step 1 — Read inputs

In parallel:

1. `Glob .claude/plans/*-*/spec.md` — find active feature with status `approved` and `review.md` present.
2. Read `spec.md` (original problem + AC + out-of-scope).
3. Read `tasks/index.md` + `tasks/US{N}.md` (decomposition + DAG).
4. Read `tests.md` and/or `validations.md` (oracle).
5. Read `review.md` — particularly `frontmatter.verdict` + `frontmatter.spec_drift` + findings count.
6. Read `state.json` — confirm `current_phase: 5` (flow-contract.md).
7. Read `.claude/plans/templates/retro.template.md` (project-local first, then `~/.claude/plans/templates/retro.template.md` — outside poneglyph only the global copy exists) + `CLAUDE.md` §"The 10 Commandments" (for Step 9 audit).
8. Read `.claude/learned/inbox.md` if present — legacy auto-captured candidates (the `learning-inbox` Stop hook was cut 2026-08-05/030; the file no longer grows), input for Step 8.

### Step 2 — Confirm prerequisites

| Check | Action if fails |
|---|---|
| `review.md.verdict` ∈ {APPROVED, APPROVED_WITH_WARNINGS} | STOP — escalate; do not produce retro on broken work |
| All HUs in `state.json.us_completed` | STOP — escalate |
| `retro.template.md` exists (project-local or `~/.claude/plans/templates/`) | If both missing → use the embedded checklist (Read `references/02-embedded-fallback.md`) |

### Step 3 — Determine retro level (adaptation)

| Signal | Level | Scope |
|---|---|---|
| Feature trivial (1-2 HUs, light review in Phase 4, no decisions made) | **light** | Summary + 1-2 lessons + 0-1 promotion candidates; skip Commandments audit + living-spec loop |
| Feature standard (3-N HUs, no architectural decision absorbed) | **standard** | Full template: Summary, Lessons, Process, Drillme, Promotions, Living-spec, Commandments, Action items |
| Feature with absorbed decisions / architectural / spec-drift detected | **full** | Standard + dedicated section per absorbed decision + Commandments forensics if any violation flagged |

CLI override: `/retro --light` / `--standard` / `--full`. Default = auto-detect from `review.md.review_level` + `state.json.us_history.length` + presence of absorbed decisions.

Declare level in `retro.md` frontmatter (`retro_level: <light|standard|full>` + reason).

### Step 4 — Executive summary

1-2 paragraphs in `retro.md`:

- What was the original problem (1 sentence quoting spec.md)?
- What was delivered (1 sentence on the actual scope of the diff)?
- Verdict (1 sentence: smooth / friction / pivoted mid-way / etc.).

### Step 5 — Technical lessons (✅ worked / ❌ didn't work)

Two lists, honest:

```markdown
### ✅ Patterns that worked
- <pattern>: <why it worked + where to reuse>

### ❌ Patterns that didn't work
- <pattern>: <why it failed + how to avoid next time>
```

Anti-pattern: empty `❌` list. If genuinely zero failures → smell signal (Step 12). Usually at least one friction point exists; surfacing it is the value of the retro.

### Step 6 — Process audit

For each of the 5 phases the feature passed through (scope → tech-plan → tdd-design → build → critic):

| Phase | Effort (S/M/L/XL) | Friction observed | Improvement candidate |
|---|---|---|---|
| Phase 1 (scope) | ... | ... | ... |
| Phase 2 (tech-plan) | ... | ... | ... |
| Phase 2.5 (tdd-design) | ... | ... | ... |
| Phase 3 (build) | ... | ... | ... |
| Phase 4 (critic) | ... | ... | ... |

Identify the heaviest phase + diagnose why. Often the heaviest phase reveals a missing tool or a poorly-tuned skill.

### Step 7 — Drillme Phase 5

Use the canonical Phase 5 bank in
`../drillme/references/03-phase-questions.md`. Sweep its relevant categories and
any new gap; ask only questions whose answers could change the decision.
Report actual coverage and unresolved gaps. Do not infer coverage from a fixed
question count or from work performed in an earlier phase.

> Skill-to-skill invocation is **probabilistic**. If `drillme` does not auto-fire, the Lead invokes `/drillme "Phase 5 retro of <NNN-slug>"` manually before closing the feature.

### Step 8 — Promotion candidates

For each reusable pattern surfaced in Step 5/7 — plus each entry in `.claude/learned/inbox.md` (auto-captured; weigh by its confidence score, discard noise honestly) — produce a row:

| Candidate | Scope | Type | Why | Concrete proposal (path + sketch) |
|---|---|---|---|---|
| `<name>` | global / local / memory | skill / rule / hook / command / agent / mcp / plugin | <1 sentence reason rooted in evidence from this feature> | `<exact path>` + brief diff/content sketch |

**Scope decision matrix**:

| Scope | Use when | Path |
|---|---|---|
| **global** (~/.claude/) | Pattern applies across multiple projects; reusable across stacks; meta-system improvement | `~/.claude/{skills,rules,hooks,agents,commands}/` |
| **local** (project) | Pattern is project-specific (this codebase's conventions); useful here, ceremony elsewhere | `.claude/{skills,rules,hooks,agents,commands}/` |
| **memory** (only) | Single fact / one-off learning; doesn't deserve a file | `MEMORY.md` entry via auto-memory |
| **lessons** | A mistake with real evidence that would repeat in another repo (process, review hygiene, delivery) | Row appended to `~/.claude/skills/lessons/SKILL.md`; stack-specific → `lessons/references/<stack>-*.md` instead. Never a per-repo lessons layer |

**Strict rules**:

- Do NOT auto-promote — produce candidates only; the user approves.
- Each candidate MUST cite the concrete evidence from this feature that motivated it (a finding, a recurring drillme question, a lesson).
- Verify the proposed path does NOT collide with an existing file. If collision → propose rename or merge.
- If `meta-harness` auxiliary is invoked → the proposal sketch follows the official frontmatter spec for that extension type.
- **Failure → eval case**: for each REAL documented failure surfaced in §Lessons ❌, also propose its golden-prompt case for `.claude/evals/cases.jsonl` (growth rule in `.claude/evals/README.md`: one new case per new real failure, deterministic grader, `source` cites this retro). The failure becomes a permanent regression check (Cmd VII).

If zero promotion candidates emerge → declare honestly: "Zero promotions this cycle. Reasons: <list>." If this happens in 3+ consecutive retros → smell signal (Step 12).

### Step 9 — Living-spec loop (consume `spec_drift` from review.md)

Read `review.md.frontmatter.spec_drift`:

| `spec_drift` | Action |
|---|---|
| `none` | No living-spec entry; declare in retro.md: "Spec drift: none — delivered matches spec.md exactly." |
| `legitimate` | Propose a diff to `spec.md` in `retro.md` §Living-spec deltas. **NEVER auto-edit spec.md.** User approves the diff → then the patch is applied with a note "v2 — delta from retro {NNN}-{slug} (reason: <X>)" |
| `scope_creep` | Log in §Lessons ❌ as "scope creep — feature extended beyond spec.md without ratification". Do NOT propose spec update; either revert the extra scope or re-open Phase 1 to ratify properly |
| `skipped_ac` | Log in §Lessons ❌ as "AC X in spec.md not delivered — <reason>". Either schedule follow-up or update spec.md to remove the AC (with explicit "downscoped" annotation) |

**Criterio "delta legítimo"** (formalized — addresses open question of US7):

A delta is legitimate IF AND ONLY IF all three hold:

1. **Real edge case**: the delta resolves an edge case discovered during Phase 3 (build) or Phase 4 (critic), not a change-of-mind without trigger.
2. **No contradiction**: the delta does NOT contradict the original spec.md intent (verify against the problem statement, not just the AC).
3. **Documented why**: the rationale is captured in retro.md §Living-spec deltas with the specific finding that motivated it.

If any of the three fails → not legitimate; route to `scope_creep` instead.

### Step 10 — Commandments audit

For each of the 10 Commandments, mark compliance during this feature:

| # | Commandment | Cumplido? | Evidencia / Violación |
|---|---|---|---|
| I | Understand before acting | ✅/⚠️/❌ | <concrete evidence from the diff or process> |
| II | Factual truth — explicit data | ✅/⚠️/❌ | ... |
| III | Radical honesty | ✅/⚠️/❌ | ... |
| IV | Quality gates — real tests | ✅/⚠️/❌ | ... |
| V | Delivered code quality — reuse first, simple & maintainable | ✅/⚠️/❌ | ... |
| VI | Security without ambiguity | ✅/⚠️/❌ | ... |
| VII | Observability | ✅/⚠️/❌ | ... |
| VIII | Internal prompting quality | ✅/⚠️/❌ | ... |
| IX | Poneglyph maintainability | ✅/⚠️/❌ | ... |
| X | Efficiency — right model, right worker | ✅/⚠️/❌ | ... |

If ANY commandment is ⚠️ or ❌ → dedicated subsection "Commandment violations forensics" with:

- Which moment in the feature it occurred.
- What was the alternative path.
- Action item to prevent recurrence.

This section is mandatory in `retro_level: full`; optional in `standard`; skipped in `light`.

### Step 11 — Action items

A list of follow-ups, each with an owner:

| Action | Owner | Trigger | Due |
|---|---|---|---|
| <action> | <user / Lead / next-session / new-HU> | <event that gates it> | <concrete date or "next sprint" or "before next feature"> |

Action items typically include: applying approved promotions, ratifying living-spec deltas, addressing commandment violations, splitting an over-large skill that emerged.

### Step 12 — Produce `retro.md`

Write `.claude/plans/{NNN}-{slug}/retro.md` from `templates/retro.template.md`. Frontmatter:

```yaml
---
spec: {NNN}-{slug}
phase: 5
retro_level: <light|standard|full>
verdict_phase4: <APPROVED|APPROVED_WITH_WARNINGS>
spec_drift: <none|legitimate|scope_creep|skipped_ac>
promotions_proposed: N
promotions_approved: 0  # updated after user approval
commandment_violations: N  # count of ⚠️ + ❌ rows
living_spec_delta: <yes|no>
action_items: N
created: YYYY-MM-DD
status: open  # flips to "approved" after user reviews
---
```

Body: 8 sections (Summary, Lessons ✅/❌, Process, Drillme, Promotions, Living-spec, Commandments, Action items).

### Step 13 — Close feature lifecycle (verification gate)

After producing retro.md AND user has reviewed (light/standard) or explicitly closed (full):

**13a. Verify recorded closure**

Read `state.json` and the per-HU verification history. Pending HUs, missing evidence or an unapproved review keep the feature open. Do not mark a draft/approved HU closed merely because retro has begun. For a completed and verified HU with stale frontmatter, run `flow-state.ts sync-artifacts`; investigate the interrupted projection. Missing state requires recovery of actual decisions, not inference from artifact existence. See [flow contract](../../docs/flow-contract.md).

**13b. Apply approved promotions and living-spec deltas**:

- Approved promotions → Lead writes the target file inline (default-allow gate covers non-sensitive paths).
- Approved living-spec diff → patch `spec.md` with note "v2 — delta from retro {NNN}-{slug}".

**13c. Update counters + clear the inbox**:

- After actual ratification, run `flow-state.ts retro-status approved`, then `flow-state.ts close-feature`. Only after success project feature closure into spec/tasks index frontmatter; never set terminal state directly.
- `retro.md.promotions_approved` counter += N (per actually-applied); clear `.claude/learned/inbox.md` (entries became candidates or were honestly discarded — record the discard count in retro.md).

**13d. Archive the working set (authorized move, only after `close-feature` succeeded)**:

- Ask the user before moving anything. With their authorization: create `.claude/plans/_archive/{NNN}-{slug}/`, move everything except `spec.md` and `retro.md` there (`tasks/`, `tests.md`, `validations.md`, `state.json`, `review.md`, evidence files); a file that a tracked script or skill still reads stays and is named in the README row. Then run `git rm --cached -r` on the moved paths (files stay on disk; `_archive/` is gitignored) and, when the project keeps a plans README (this repo does), add the plan's row to its §Closed features table.
- Without authorization: record the action item "archive working set" — never move silently.
- Under a company plans policy (`.claude/plans/` excluded from git) nothing is tracked; report where the durable outcome went (ticket, wiki). Rule and rationale: `plans/README.md` §Closed features.

**Closure:** unresolved ratification keeps retro pending. A user-approved deferral is an explicit action item, not an applied promotion. Producing retro.md alone never closes the feature.

**Ratification ownership (plan 025 — back-half gate)**: `retro_status` is a two-state field with a named owner.

| `retro_status` | Meaning | Owner of the transition |
|---|---|---|
| `"pending"` | retro.md produced, awaiting human ratification of promotions/living-spec deltas. **The lifecycle is INCOMPLETE** — `feature_closed` stays `false` and the plan still surfaces in `flow-state.ts status` | **The user** ratifies (AskUserQuestion in Step 14); the Lead never self-approves |
| `"approved"` | User ratified; promotions/deltas applied; `feature_closed = true` set via `flow-state.ts close-feature` | Lead applies AFTER the user's explicit ratification |

A retro left at `pending` is the documented back-half abandonment failure mode (audit 2026-06-30): it is not "done", it is *awaiting you*. The `status` report exists to make that visible instead of silent.

### Step 14 — Report + approval request

Report using the block in §Output format reminder (end of this skill) — same content, single source — and request approval for promotions / living-spec diff / violation actions.

## SIEMPRE rules

- Radical honesty (Commandment III): never produce a retro with zero ❌ lessons unless genuinely zero friction occurred.
- NEVER auto-edit `spec.md` — living-spec deltas are proposals for human approval only.
- NEVER auto-apply promotions — produce candidates; user approves before any file is written.
- Cite concrete evidence per lesson, per promotion, per commandment violation. No abstract claims.
- Close lifecycle only after retro.md is reviewed; promotions may remain as carried action items.
- Before promoting: verify the target path does not collide with an existing file/skill/rule (Glob/Read, never assume).

## Adaptation intra-phase (Principio 2 — "no siempre más es más")

| Signal | Adaptation |
|---|---|
| `review.md.review_level: light` (trivial Phase 4 verdict) | Retro level light: Summary + 1-2 lessons + 0-1 promotion + skip Commandments audit + skip Living-spec section |
| `review.md.spec_drift: none` AND verdict APPROVED | Skip §Living-spec section entirely |
| Zero promotion candidates emerge honestly | Declare: "Zero promotions this cycle" + reasons; do not pad with synthetic candidates |
| Commandment violation flagged in Phase 4 critic | Mandatory Commandments forensics subsection in this retro |
| Feature with absorbed decisions (e.g., US3/US5/US6/US8) | Dedicated subsection per absorbed decision: what was decided, evidence-driven verdict, ratification status |
| 3+ consecutive retros without promotions | Smell — escalate: either the system is genuinely stable (rare) or the retro is not honest enough |

## Deep references (Read on demand)

| Topic | File | Contents |
|---|---|---|
| Auxiliary skills + edge cases + smells + anti-patterns | `references/01-auxiliaries-and-guards.md` | The auxiliary-skills invocation matrix with fallbacks, 6 edge cases, 6 smell signals, 6 anti-patterns, and post-implementation verification. Read when an edge/failure situation appears (BLOCKED verdict, missing spec.md, promotion collision) or before invoking conditional auxiliaries. |
| Embedded fallback template | `references/02-embedded-fallback.md` | The full retro.md 8-section template. Read ONLY if `.claude/plans/templates/retro.template.md` is missing (Step 2 fallback). |

## Commandments cubiertos

| # | Cómo |
|---|---|
| III | Honest about failures, friction, and commandment violations — no softening |
| II | Each promotion cites concrete evidence; every path is verified to exist |
| V | Promotions for genuinely reusable patterns only; no premature abstraction |
| IV | retro.md is the closure gate; lifecycle closes only after retro produced |
| I | Read ALL inputs (spec/tasks/tests/review/state) BEFORE producing retro |
| VIII | Promotion candidates that involve extensions go through `meta-harness` for spec-compliant scaffolding |
| VII | Process audit + commandments audit feed self-improvement (the loop's whole purpose) |
| IX | Promotions to global ~/.claude/ keep poneglyph healthy; never duplicate or contradict existing |

## Output format reminder

```
✅ Retro produced for {NNN}-{slug}.

- retro.md: .claude/plans/{NNN}-{slug}/retro.md
- retro_level: <light|standard|full> (<reason>)
- Lessons: <✅ count> + / <❌ count> −
- Process heaviest phase: <PhaseN> (<reason>)
- Promotion candidates: <N>
  - global: <list>
  - local: <list>
  - memory: <list>
- Spec drift action: <none | propose-diff | log-creep | log-skipped>
- Commandment status: <X/10 ✅, Y ⚠️, Z ❌>
- Action items: <N>
- drillme: <categories examined, evidence and unresolved gaps>

Pending your approval:
  ⚪ Promotions to apply
  ⚪ Living-spec diff (if any)
  ⚪ Commandment violation actions

When approved → reply ratifying which subset to apply.
Feature lifecycle closure: <pending|done>.
```
