---
parent: flow
name: review
description: Phase 4 — validate end-to-end that the assembled HUs solve spec.md, produce review.md with findings and a supported verdict.
---

# Phase 4 — Review

Validate **end-to-end** that the problem in `spec.md` was solved, not only that each HU's
tests pass. Produce `review.md` with the 5-section checklist, findings with severity and a
verdict the assessment supports. Run this phase at `/effort xhigh`.

Disambiguation: reviewing a PR or branch against its ticket is `pr-review` (diff-level,
ticket-anchored). This phase is feature-level and `spec.md`-anchored, after every HU closed.

Precondition: `current_phase: 4` and `us_pending == []`. Pending HUs → STOP; an incomplete
review wastes effort.

## Definition of Done

- Trace agreed ACs through the assembled change to actual check results and deliver review.md with the supported verdict.
- Record the assessment through the existing contract. A blocked or negative verdict completes the assessment, not the feature.

## How You're Graded

- Favor accurate coverage and consequential, evidence-backed findings. Zero findings is valid; never invent issues or approve missing checks.

## Step 1 — Read inputs

`spec.md` (problem, ACs, out-of-scope), `tasks/index.md` and every `tasks/US{N}.md`,
`tests.md` / `validations.md`, `state.json`, `review.template.md` (project templates, then
global; both missing → `review-fallback.md`), `rules/test-policy.md`. Resolve the approved
starting revision and inspect committed **and** working-tree changes against it.

## Step 2 — Prerequisites

| Check | If it fails |
|---|---|
| Every HU closed with a verification record | STOP; escalate |
| Suite passes on the assembled branch | Continue; `Correctness` goes RED |
| `spec.md` still describes what was delivered | Continue; flag spec drift (Step 8) |
| Diff is empty since approval | STOP; ask whether phase 3 ran |

## Step 3 — Review level

| Level | When | Scope |
|---|---|---|
| **light** | 1-2 HUs, no security or performance surface | Base checks + the single most relevant drillme gap; no fresh reviewer, `code-quality` or `security-audit` |
| **standard** (default) | 3-N HUs, no critical area | Full checklist, `code-quality` quality mode, ONE fresh-context reviewer, phase bank sweep |
| **full** | Architectural, or the diff touches auth / payments / secrets / crypto / session | Standard + `security-audit` + `code-quality` both modes; the reviewer prompt carries the critical-area focus |

Override with `--light` / `--standard` / `--full`. Declare `review_level` and its reason in
the `review.md` frontmatter. Doc-only features skip Performance and Security.

## Step 4 — Base checks (one parallel batch)

Project tests, type check, lint, `git diff <approved-base> --stat`. Capture exit codes and
output; each becomes a row in Correctness or Quality. Claude Code's native `/code-review`
complements this batch when the user runs it; its findings enter like any other check, and
after `/code-review --fix` the critic still reviews the resulting diff before the verdict.
It never replaces Step 7. `/ultrareview` is a billed cloud review: user-triggered only, the
Lead never launches it.

## Step 5 — Five-section checklist (findings cite `file:line`)

**Correctness.** Each `spec.md` AC → responsible HU, executed check, observed result in
`review.md`; a closed HU or a code location alone proves nothing. Happy path end-to-end:
`Skill(changes-verify)` drives the affected flow when a runtime exists; manual walkthrough
only where nothing can be driven. Edge cases from the oracle covered.

**Quality.** Coverage per `rules/test-policy.md`. Style matches surrounding files (sample
2-3 touched files). No duplication introduced (Grep the new symbols). Diff scope matches
the ACs (no over-engineering).

**Security.** No hardcoded secrets (`Grep "password|secret|api_key|token"`). Inputs
validated at boundaries. No OWASP Top 10 vector introduced. Critical area touched →
`security-audit` is a mandatory gate (Cmd VI), not advisory.

**Performance.** No O(n²) where O(n) is reachable; no I/O in loops (N+1); independent
async work batched; large buffers stream.

**Maintainability.** Comments only for a non-obvious "why". No TODO without an issue link.
New abstractions justified by ≥2 callers. Naming consistent. **Lessons pass**:
`Skill(lessons-learned)` — a violated lesson is a finding quoted with its rule; G6 forbids
APPROVED while a merge gate is red.

## Step 6 — `code-quality` catalog

Refactoring, SOLID/DRY, complexity → Read
`../../code-quality/references/01-mode-quality.md` + `quality/`. Loops with I/O, async,
memory, hot paths → `../../code-quality/references/02-mode-performance.md` + `performance/`.
Both when both. The catalog
is the checklist; this phase orchestrates it (AC8 KEEP, see `07-history.md`).

## Step 7 — Independent review and conditional gates

**ONE fresh-context reviewer** at standard/full on code. Evidence (018 W1 D1/D3, W2 D1):
deliberative panels are the weak form for code review; runnable checks plus one fresh
reviewer is the strong form. Dispatch one read-only `general-purpose` agent (never `fork`:
it inherits the author's context) with the **top-tier model set explicitly**, constrained to
correctness and requirements only: trace each AC to the diff, verify the happy path, flag
gaps. Style, performance and maintainability stay in Steps 5-6. Merge its findings with
attribution; on a correctness conflict the reviewer wins, on style the critic wins,
irreconcilable → the user. In an Orca team the reviewer is the approved review worker. If no
agent can run, review inline and declare residual author bias in `review.md`; never skip the
independence concern silently. Panels (≥4 perspectives) belong to decision review via
`compare-and-decide`, never to code.

`security-audit`: mandatory when the diff touches `auth/`, `payments/`, `secrets/`,
`credentials/`, `*.env*`, `crypto/`, `session/`, `cookie/`, JWT code.
`troubleshooting`: when Step 4 fails (root cause, retry budget per `error-recovery.md`).

## Step 8 — Spec drift (living-spec loop)

| Observation | `spec_drift` | Action |
|---|---|---|
| Delivered matches `spec.md` | `none` | — |
| Divergence looks intentional and reasonable | `legitimate` | Propose a `spec.md` patch for the retro to ratify |
| Scope creep or an AC skipped | `scope_creep` / `skipped_ac` | Verdict NEEDS_CHANGES; never auto-update the spec |
| `spec.md` edited after approval | flag | Review against the latest approved version; note it |

The retro decides the spec update. This phase classifies.

## Step 9 — Drillme, phase 4

Sweep the Phase 4 bank of `../../drillme-clarify/references/03-phase-questions.md` (single
source) and any new gap. If `drillme-clarify` does not fire, invoke
`/drillme-clarify "Phase 4 review of <NNN-slug>"` before the verdict.

## Step 10 — Write `review.md`

From `review.template.md`. Frontmatter: `spec`, `phase: 4`, `review_level`, `verdict`,
`spec_drift`, `findings_count` (blocker / major / minor / nit), `fresh_reviewer_invoked`
(`yes` | `no (inline + declared bias)` | `n/a (light)`), `security_review_invoked`,
`review_patterns_modes`, `created`. Body: five sections, requirement→evidence table,
findings, verdict, spec drift. Required outcomes without evidence are unmet;
`coverageMet` includes them.

## Step 11 — Verdict and report

| Verdict | Condition, in order |
|---|---|
| **BLOCKED** | A blocker, or a required check could not run |
| **NEEDS_CHANGES** | A MAJOR, a failed required check, or coverage below policy |
| **APPROVED_WITH_WARNINGS** | Checks and requirements pass; only MINOR/NIT remain |
| **APPROVED** | Checks and requirements pass; no findings |

Persist counts, check status and coverage in `review-assessment.json`, then
`bun .claude/scripts/flow-state.ts verdict <VERDICT> --review <file>`. The helper computes
the decision and rejects contradictions (`docs/flow-contract.md`). An in-scope defect reopens
the implicated HUs (`reopen-us`), phase 3 repairs within scope, and verification and review
repeat without a new scope approval. Changed scope, an unresolved question or BLOCKED need
the user.

```text
{🟢|🟡|🔴|⛔} Critic verdict: <VERDICT>
- review.md: .claude/plans/{NNN}-{slug}/review.md · review_level: <light|standard|full>
- Findings: <blocker>/<major>/<minor>/<nit> · spec_drift: <none|legitimate|scope_creep|skipped_ac>
- fresh reviewer invoked: <yes | no (inline + declared bias) | n/a>
- code-quality modes: [<quality?>, <performance?>] · security-audit invoked: <yes|no>
- drillme-clarify: <categories covered, gaps>

Next: flow retro (approving verdict) | flow build US{N} (NEEDS_CHANGES) | STOP and escalate (BLOCKED)
```

## SIEMPRE rules

- Findings without softening; a blocker means BLOCKED, no exceptions (Cmd III).
- Every AC traces to a closed HU **and** an observed check; an AC without both is a
  Correctness finding.
- Suite green on the assembled branch before any APPROVED (Cmd IV).
- Spec drift is classified, never absorbed (Cmd VII).
- Research or evidence deliverables: numeric claims quote-anchored or marked
  `[Probable]`/UNVERIFIED; sampled citations target claims not already refuter-verified.
  Method: `docs/research-rigor.md`.

## Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Vague finding | No `file:line` | Open the file; locate it or drop it |
| Severity inflation | Everything BLOCKER | BLOCKER = data loss, security, breaking change, secret, fundamental design flaw |
| Drift absorbed | Diff diverges, `review.md` silent | Add the spec-drift classification |
| Security skipped on auth | Critical area touched, no `security-audit` | Re-run with the gate |
| Panel for code | ≥4 perspectives launched on a diff | ONE fresh reviewer; panels only for decisions |
| Green verdict on red checks | Step 4 failed, verdict APPROVED | NEEDS_CHANGES at minimum |
| Review theater | Always APPROVED with zero findings | Re-apply Step 5 with the checklist open |
