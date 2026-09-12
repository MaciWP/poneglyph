---
name: critic
description: |
  Revisión end-to-end tras completar todas las HUs (Fase 4 del workflow de 5 fases). Valida que el problema original de spec.md se resolvió de verdad. Produce review.md con checklist de 5 secciones (Correctness/Quality/Security/Performance/Maintainability) + findings con severidad + veredicto (APPROVED/WITH_WARNINGS/NEEDS_CHANGES/BLOCKED). Despacha UN reviewer de contexto fresco (read-only) y dispara security-audit en auth/pagos/credenciales.
  Úsala cuando: feature completo, todas las HUs cerradas en state.json, revisión antes de retro, tras /build, "revisa", "critica", "valida", "audita", "veredicto".
metadata:
  keywords: >
    Keywords - critic, phase-4-review, valida, revisa, audita, e2e, happy-path, quality,
    regression, security, performance, verdict, blocker, finding, fase-4, phase-4
disable-model-invocation: false
argument-hint: ""
effort: xhigh
when_to_use: |
  "revisa el feature", "audita esto", "valida end-to-end", "veredicto", "review the feature", "is this correct", "final review"
---

# Critic (Phase 4)

Validates **end-to-end** that the spec.md problem was solved — not just that each HU's tests pass. Produces `review.md` with a 5-section checklist + findings with severity + verdict. The gate before retro (Phase 5).

> Disambiguation (031): reviewing a PR/branch against its TICKET at any point in time is `pr-review` (diff-level, ticket-anchored); critic is feature-level and spec.md-anchored, after all HUs close.

## Underlying principle

> "Tests passing per HU prove the parts; the critic proves the whole." (Commandment IV — blocking gates; Commandment VII — observability and self-improvement)

Phase 4 asks what Phase 3 cannot: **does the assembled set of HUs solve the original problem in spec.md, including the happy path the user actually walks?** The critic is the seam-checker. Rationale: `references/03-history.md`.

## When to use

| Trigger | Example |
|---|---|
| All HUs in `state.json.us_pending` are now in `state.json.us_completed` | After `/build` closes the last HU |
| User invokes `/critic` explicitly | Direct invocation |
| `build` skill closes Phase 3 and triggers Phase 4 invocation | Auto-chain from Phase 3 |

## When to skip

| Anti-trigger | Why |
|---|---|
| HUs still pending in `state.json` | Phase 3 first — incomplete reviews waste effort |
| `tests.md`/`validations.md` not approved | Phase 2.5 first — no oracle to validate against |
| Trivial mode (no `tasks/` directory) | Direct review by Lead — Phase 4 ceremony adds nothing |
| Bug fix in non-poneglyph repo with no spec | Use `/critic` informally; skip the spec.md correctness check |

## Workflow

### Step 1 — Read inputs

In parallel:

1. `Glob .claude/plans/*-*/spec.md` — find active feature with status `approved`.
2. Read `spec.md` (problem statement + acceptance criteria + out-of-scope).
3. Read `tasks/index.md` + all `tasks/US{N}.md`.
4. Read `tests.md` and/or `validations.md`.
5. Read `state.json` — confirm `current_phase: 4` (flow-contract.md) + `us_pending == []`.
6. Read `.claude/plans/templates/review.template.md` (project-local first, then `~/.claude/plans/templates/review.template.md`; the output template).
7. Read `.claude/rules/test-policy.md` (coverage policy).
8. Resolve the approved starting revision. Inspect committed and working-tree
   changes against it; do not assume all implementation is already committed.

### Step 2 — Confirm prerequisites

| Check | Action if fails |
|---|---|
| All HUs in `state.json.us_completed` | STOP — escalate to user; do not generate review.md prematurely |
| Tests pass on the assembled branch (`bun test ./.claude/hooks/` or project equivalent) | Continue but mark `Correctness` section RED in review.md |
| spec.md still describes what was delivered | Continue + flag spec-drift for living-spec loop (Step 8) |
| `review.template.md` exists (project-local or `~/.claude/plans/templates/`) | If both missing → use the embedded checklist (Read `references/02-embedded-fallback.md`) |

### Step 3 — Determine review level (adaptation)

| Signal | Level | Scope |
|---|---|---|
| Feature trivial (1-2 HUs, no security/perf concern, mode minimal) | **light** | Base checks (tests + typecheck) + drillme Q1 only; skip fresh reviewer + review-patterns + security-audit |
| Feature standard (3-N HUs, no critical area) | **standard** | Full 5-section checklist; review-patterns quality mode; ONE fresh-context reviewer; drillme 4/4 |
| Feature architectural / touches auth/payments/secrets / complexity >60 | **full** | Standard + security-audit skill + review-patterns both modes (quality + performance); fresh reviewer prompt additionally carries the critical-area focus |

CLI override: `/critic --light` / `--standard` / `--full`. Default = auto-detect from `spec.md.mode` + scanned content.

Declare the chosen level in `review.md` frontmatter (`review_level: <light|standard|full>` + reason).

### Step 4 — Execute base checks (parallel)

In a single message (Recipe 1 — Bash batch):

```
Bash(<project test cmd>) + Bash(<project typecheck cmd>) + Bash(<project lint cmd>) + Bash(git diff <approved-base> --stat)
```

Capture exit codes + output. Each becomes a row in the `Correctness` and `Quality` sections of review.md.

**Optional native reviewer (audit 010)**: `/code-review [low|medium|high|xhigh|max]` is Claude Code's own diff reviewer (typed findings, maintained by Anthropic; runs in a background agent at every level since CC 2.1.232). It complements — never replaces — the fresh-context reviewer of Step 7. When Oriol runs it, its findings enter the `Correctness`/`Quality` rows like any other check; `/code-review --fix` applies them to the working tree, and the critic still reviews that diff before the verdict. `/ultrareview` is a billed cloud review — user-triggered only; the Lead never launches it.

### Step 5 — Apply 5-section checklist

For each section, populate `review.md` with findings (file:line + severity + recommendation):

#### Correctness

- Does the spec.md problem statement match what was delivered? (Read spec.md happy path → trace through code.)
- Each AC in spec.md → record the responsible HU, executed check and observed
  result in review.md. A closed HU or a code location alone is not proof.
- Tests pass on the assembled branch (Step 4 output).
- Happy path E2E: simulate the user's actual flow — for diffs with a runtime surface, invoke `Skill(verify)` (drive the affected flow end-to-end and observe behavior); manual walkthrough/smoke only where verify's anti-trigger applies (tests/docs/markdown-only — nothing to drive). (028/US5)
- Known edge cases from `tests.md`/`validations.md` — are they covered?

#### Quality

- Test coverage respects `.claude/rules/test-policy.md` (auxiliary OK with minimal; business-critical requires forced TDD evidence).
- Code style matches surrounding files (sample 2-3 random touched files; Grep for style anchors).
- No introduced duplication (Glob/Grep for the new symbols' patterns elsewhere).
- No over-engineering (compare diff scope vs AC declared scope per HU).

#### Security

- No hardcoded secrets in diff (`Grep "password|secret|api_key|token" <changed-files>`).
- Inputs validated at boundaries (auth, payments, user-facing endpoints).
- No introduced OWASP Top 10 vectors (injection / XSS / IDOR / SSRF / etc.).
- If touches `auth`/`payments`/`secrets`/`credentials` → invoke `security-audit` skill (mandatory dispatch — auxiliary may fire, Lead also dispatches).

#### Performance

- No O(n²) loops introduced where O(n) is reachable.
- No I/O inside loops (DB calls in loops = N+1 candidate).
- Parallelism opportunities flagged (independent async ops should batch).
- Memory: any large array/buffer that should stream instead?

#### Maintainability

- Comments only where "why" is non-obvious (Cmd V — no decorative comments).
- No TODOs without an issue link (`Grep "TODO|FIXME" <changed-files>`).
- New abstractions justified by ≥2 callers (avoid premature abstraction).
- Naming consistent with project (Drillme intra-HU should have caught this; verify here).
- **Lessons pass**: `Skill(lessons)` — cross-repo guards + the `references/<stack>` file matching the diff. A violated lesson is a finding, quoted with its rule; G6 forbids APPROVED while a merge gate is red.

### Step 6 — Invoke `review-patterns` skill catalog (AC8)

Per content of the diff:

| Diff signal | Mode to invoke | Path to Read |
|---|---|---|
| Refactoring / SOLID / DRY concerns / complexity | **quality mode** | `.claude/skills/review-patterns/references/01-mode-quality.md` + subdirs in `quality/` |
| Loops with I/O / async / memory / hot paths | **performance mode** | `.claude/skills/review-patterns/references/02-mode-performance.md` + subdirs in `performance/` |
| Both | both | both reference files |

Apply the catalog's specific checks (cyclomatic complexity / N+1 patterns / leak patterns / extract function opportunities). Findings from the catalog go into the corresponding section of review.md.

**AC8 ratification**: `review-patterns` is KEPT (17+ unique refs not duplicated here). The skill is the catalog; this skill is the orchestrator.

### Step 7 — Independent review + conditional invocations

**ONE fresh-context reviewer (default at standard/full) — replaces the ≥4 panel as code-review form (feature 019)**:

Evidence basis (018): deliberative multi-agent panels are the measurably WEAK form for code review — the verifier gap and MAST's 23.5% verification-failure share (W1 D1/D3, seeds), deterministic checks 0% FP vs LLM-judge ~80% FP (W2 D1). The strong form is **runnable mechanical checks (Step 4) + ONE fresh-context reviewer**. User ratified the complete demotion 2026-06-10 (019 gate-entry).

Trigger: every standard/full review on code (light skips it). The author≠evaluator concern (feature 002 lesson; `independent-reviewer-when-self-assessing` memory) applies to virtually every Phase 4 run — the critic reviews work its own session produced.

**How**: dispatch ONE read-only `Agent` with fresh context (this is the explicit P1 spawn-tree exception — the one agent whose value IS the fresh context) — `general-purpose`, never `fork` (a fork inherits the author's context), with the **model set explicitly to the top tier** (a verify unit; the `CLAUDE_CODE_SUBAGENT_MODEL` default is a cheap tier and would silently degrade it). It runs in the background: wait for its task notification before merging. Its prompt is constrained to **correctness and requirements ONLY**: trace each spec.md AC to the diff, verify the happy path, flag requirement gaps. Style, performance and maintainability are explicitly OUT of its prompt — those stay in the critic's inline checklist (Step 5) + `review-patterns` catalog (Step 6). The reviewer returns findings (file:line + severity); the critic merges them into review.md with attribution.

> If no agent can run (offline, budget), the critic performs the deeper review **inline** and declares residual author-bias honestly in `review.md` — never silently skips the independence concern.

**Deliberative panels (≥4 perspectives)**: reserved for DECISION review — architecture choices, library selection, trade-off challenges — via `decide` (heavy tier) (its evidence niche per 018 W1: cheap-to-grade decision tasks, not code). The critic does NOT launch panels for code.

**`security-audit` skill**:

Invoke when diff touches: `auth/`, `payments/`, `secrets/`, `credentials/`, `*.env*`, `crypto/`, `session/`, `cookie/`, JWT-related code. Mandatory dispatch even if auto-fire fires — security is a gate not advisory (Cmd VI).

**`diagnostic-patterns` skill**:

Invoke if Step 4 base checks failed → root-cause analysis (5-whys, stack trace, retry budget per `error-recovery.md`).

### Step 8 — Detect spec-drift (AC6 — living-spec loop)

Compare spec.md against delivered:

| Detection | Action |
|---|---|
| Delivered exactly matches spec.md | No drift; living-spec loop NOT triggered |
| Delivered diverges in ways that look intentional and reasonable | Mark `spec_drift: legitimate` in review.md + propose `spec.md` patch for retro (Phase 5) to ratify |
| Delivered diverges in ways that look like scope creep or skipped AC | Mark `spec_drift: scope_creep` or `spec_drift: skipped_ac` → verdict NEEDS_CHANGES; do not auto-update spec.md |
| spec.md was edited mid-implementation (timestamp post-approval) | Flag — verify against latest approved version; mention in review.md |

The decision to update spec.md is deferred to Phase 5 (retro) — critic only flags the delta + classifies.

### Step 9 — Drillme Phase 4

Before producing the verdict:

```markdown
## Drillme — Phase 4

1. `[context]` **Spec drift?** Does the spec.md still describe what was delivered? If not, classify (legitimate / scope_creep / skipped_ac).
2. `[failure]` **E2E happy path?** Does the full happy path work, not just modules? Trace by hand.
3. `[failure]` **Edge case the user will hit?** Is there an edge case we did not test that real usage will surface?
4. `[approach]` **Coverage matches policy?** Does test coverage match what `test-policy.md` expects (forced/adaptive/optional)?
```

Coverage: 3/4 canonical Socratic categories (`[location]` covered upstream — code locations were nailed in Phase 2/3). Honest — Phase 4 focuses on E2E + drift + coverage. These are the **floor**, not a cap: drillme is gap-gated, so it sweeps any extra gap the review surfaces and stays proportional (fewer on a clean, unambiguous feature).

> Skill-to-skill invocation is **probabilistic**. If `drillme` does not auto-fire, the Lead invokes `/drillme "Phase 4 review of <NNN-slug>"` manually before declaring the verdict.

### Step 10 — Generate `review.md`

Write `.claude/plans/{NNN}-{slug}/review.md` from `templates/review.template.md`. Frontmatter:

```yaml
---
spec: {NNN}-{slug}
phase: 4
review_level: <light|standard|full>
verdict: <APPROVED | APPROVED_WITH_WARNINGS | NEEDS_CHANGES | BLOCKED>
spec_drift: <none | legitimate | scope_creep | skipped_ac>
findings_count:
  blocker: N
  major: N
  minor: N
  nit: N
fresh_reviewer_invoked: <yes | no (inline + declared bias) | n/a (light)>
security_review_invoked: <yes|no>
review_patterns_modes: [<quality?>, <performance?>]
created: YYYY-MM-DD
---
```

Body: 5 sections + requirement/evidence table + findings + verdict + any spec drift.
Required outcomes without evidence cannot be marked met. Check the assembled
runtime, not only isolated HU tests. `coverageMet` includes those outcomes.

### Step 11 — Verdict + report

| Verdict | When | Next |
|---|---|---|
| **BLOCKED** | ≥1 BLOCKER or a required check could not run | Resolve the blocker; distinguish infrastructure from product defects |
| **NEEDS_CHANGES** | No blocker; ≥1 MAJOR, failed required check, or coverage below policy | Reopen identified HUs with `reopen-us --note <finding>` |
| **APPROVED_WITH_WARNINGS** | Required checks pass, coverage met, 0 BLOCKER/MAJOR, ≥1 MINOR/NIT | Continue to retro |
| **APPROVED** | Required checks pass, coverage met, no findings | Continue to retro |

Persist counts, check status and coverage in `review-assessment.json`, then run `flow-state.ts verdict <VERDICT> --review <file>`. The helper computes the decision and rejects contradictions. Apply [the flow contract](../../docs/flow-contract.md); unknown or unexecuted evidence cannot produce approval.

For an in-scope defect, flow reopens the identified HUs, invokes build, then
repeats verification and critic without another scope approval. Honor the retry
budget; changed scope, unresolved questions and BLOCKED require a user decision.

Report:

```
{🟢|🟡|🔴|⛔} Critic verdict: <VERDICT>
- review.md: .claude/plans/{NNN}-{slug}/review.md
- review_level: <light|standard|full>
- Findings: <blocker>/<major>/<minor>/<nit>
- spec_drift: <none|legitimate|scope_creep|skipped_ac>
- fresh reviewer invoked: <yes | no (inline + declared bias)>
- review-patterns modes: [<quality?>, <performance?>]
- security-audit invoked: <yes|no>
- drillme: covered 3/4 canonical Socratic categories

Next:
  → /retro (if APPROVED or APPROVED_WITH_WARNINGS)
  → /build US{N} (if NEEDS_CHANGES with specific HUs)
  → STOP — escalate (if BLOCKED)
```

## SIEMPRE rules

- Honest findings — no softening (Commandment III). If a BLOCKER exists, the verdict is BLOCKED, no exceptions.
- Trace each spec.md AC to a closed HU; flag any AC without a corresponding closed HU as a Correctness finding.
- `security-audit` mandatory dispatch when critical area touched — gate, not advisory.
- Tests pass on the assembled branch BEFORE declaring APPROVED (Cmd IV).
- Spec-drift is flagged + classified, never silently absorbed (Cmd VII — observability).
- Findings cite `file:line` exactly; no vague "somewhere in the auth module".
- Independent review = ONE fresh-context read-only reviewer (correctness/requirements only — the explicit P1 exception, evidence W1 D1/D3) or inline-with-declared-bias fallback; never a deliberative panel for code (W2 D1: judge ensembles ~80% FP).
- Research/evidence artefacts: numeric claims must be quote-anchored to their source or marked `[Probable]`/UNVERIFIED; citation sampling must target claims NOT already refuter-verified during build (independence). Method: `.claude/docs/research-rigor.md` (promoted from feature 018 — precision inflation was its only audit-failure class).

## Adaptation intra-phase (Principio 2 — "no siempre más es más")

| Signal | Adaptation |
|---|---|
| Mode `light` (trivial feature, 1-2 HUs, no security/perf) | Base checks + drillme Q1 only; skip fresh reviewer + review-patterns + security-audit |
| Mode `standard` (default, 3-N HUs, no critical area) | Full 5-section + review-patterns quality + drillme 4/4 |
| Mode `full` (architectural / auth / payments / complexity >60) | Standard + security-audit + review-patterns both modes; fresh reviewer carries critical-area focus |
| Doc-only feature (markdown changes, no code) | Quality + Maintainability sections only; skip Performance + Security; drillme Q1 |
| Bug fix with reproducible test | Correctness section + drillme Q3 (edge case); skip Performance unless bug was performance-related |

Declare adaptation in `review.md` frontmatter (`review_level` + reason).

## Casos edge

- **Edge 1** — HUs marcadas `completed` pero tests fallan en la rama ensamblada → STOP; escalate; do not generate review.md as APPROVED.
- **Edge 2** — `spec.md` editada después de approved (timestamp post-approval) → revisar contra la versión actual + flag in review.md; the Phase 5 retro decides whether the edit is ratified.
- **Edge 3** — `review-patterns` no existe (cortada por error) → fallback al checklist embebido + flag in Issues; this should never happen (AC8 KEEP).
- **Edge 4** — Fresh reviewer cannot run (no agent available, budget) → critic reviews inline + declares residual author-bias in `review.md.fresh_reviewer_invoked: no (inline + declared bias)`; do not block the verdict on agent availability.
- **Edge 5** — Fresh reviewer's findings conflict with the critic's inline judgment → the reviewer wins on correctness/requirements (its constrained domain — fresh eyes, W1 D3); the critic wins on style/operational concerns; if irreconcilable → escalate to user.
- **Edge 6** — Diff is empty (no commits since spec approved) → STOP; ask if Phase 3 was actually executed.

## Smell signals

- ⚠️ Verdict always APPROVED with zero findings → review theater; the skill is missing rigor. Inspect Step 5 checklist application.
- ⚠️ NEEDS_CHANGES on >3 consecutive critic runs of the same feature → spec.md or HUs are poorly defined; reopen Phase 1/2.
- ⚠️ Findings cite line numbers that don't exist in the file → the line was never opened; redo with verification.
- ⚠️ `spec_drift: legitimate` proposed in >50% of reviews → planning is not capturing emergent requirements; review the planning process in Phase 5.
- ⚠️ A ≥4 deliberative panel launched for code review → doctrine regression (019 demotion, W1 D1/D3); panels belong to decision review via `decide` (heavy tier) only.

## Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Vague findings | Finding without `file:line` reference | Reject; re-locate the issue precisely |
| Severity inflation | All findings tagged BLOCKER | Re-classify by Cmd IV blocking criteria; BLOCKER = data loss/security/breaking change/hardcoded secret/fundamental design flaw |
| Spec drift silently absorbed | `review.md` doesn't mention spec.md delta despite diff diverging | Add Spec-drift section with classification |
| Skipping security on auth code | Diff touches auth but `security-audit` not invoked | Re-run with security-audit dispatched (mandatory gate) |
| Panel launched for code review | Any ≥4-perspective Workflow fired from Phase 4 on a code diff | Replace with ONE fresh-context reviewer (correctness/requirements); panels = decisions only (`decide` (heavy tier)) |
| Verdict APPROVED with failing tests | base checks (Step 4) red but verdict green | Re-verdict to NEEDS_CHANGES at minimum; tests-passing is a precondition |

## Deep references (Read on demand)

| Topic | File | Contents |
|---|---|---|
| Decisions history + auxiliary skills matrix | `references/01-decisions-and-auxiliaries.md` | Review-model evolution (reviewer agent → panel ≥4 → ONE fresh-context reviewer, feature 019), the AC8 review-patterns KEEP rationale, the full auxiliary-skills invocation matrix with fallbacks, and post-implementation verification of this skill. Read when invoking auxiliaries beyond review-patterns/security-audit, or when questioning the review model. |
| Embedded fallback template | `references/02-embedded-fallback.md` | The full review.md checklist template. Read ONLY if `.claude/plans/templates/review.template.md` is missing (Step 2 fallback). |

Critical invariants kept in this body: `review-patterns` is MANDATORY in standard/full (Step 6); `security-audit` is a MANDATORY gate on critical areas (Step 7); skill-to-skill auto-fire is probabilistic — the Lead dispatches manually on miss.

## Commandments cubiertos

| # | Cómo |
|---|---|
| III | Honest findings sin softening; BLOCKED if BLOCKER exists; residual author-bias declared when no fresh reviewer ran |
| II | Every finding opens the line it cites — no invented file:line |
| V | Severity inflation anti-pattern blocked; simple by default |
| IV | APPROVED only if tests pass on assembled branch (blocking gate) |
| I | Read spec.md + tasks/ + tests/validations BEFORE producing review.md |
| VI | `security-audit` mandatory dispatch on auth/payments/secrets — gate, not advisory |
| X | Base checks executed in parallel (Step 4); ONE fresh reviewer replaces the ≥4 panel — same independence, fraction of the cost (W1 D1/D3) |
| VIII | Fresh-reviewer prompt is constrained (AC trace + correctness/requirements only + read-only role — Arch H) |
| VII | Spec-drift detection + classification feeds living-spec loop in Phase 5 (observability) |
