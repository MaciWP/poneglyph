---
parent: pr-review
---

# Core criteria (stack-agnostic) + project extension point

Weights: **Critical ×10 · Major ×5 · Minor ×1** — `Score = 100 − Σ(count × weight)`, floor 0.
Verdict: APPROVE (0 critical, ≤2 major) · NEEDS_CHANGES (0 critical, >2 major) · BLOCK (≥1 critical).

## Core criteria (apply in every repo)

| # | Criterion | Typical Critical | Typical Major | Typical Minor |
|---|---|---|---|---|
| 1 | **Correctness** | Logic bug on the happy path; data loss; broken contract consumers depend on | Unhandled edge case real usage will hit; wrong error semantics | Misleading naming that hides intent |
| 2 | **Tests** (requisito 9.1) | Project checks FAIL on the branch; test manipulated to pass (asserts weakened, skipped without reason) | New behavior without any test where the project's test-policy expects one; tests that don't exercise the change | Test naming/placement off-convention |
| 3 | **Security** | Hardcoded secret/credential; injection vector (SQL/XSS/command); authz check removed or bypassed | Input from a trust boundary unvalidated; sensitive data logged | Overly broad permissions defaulted |
| 4 | **Style & conventions** | — (style is never Critical) | Violates a documented project convention (linter rule, naming standard, architectural boundary) | Inconsistent with surrounding code; decorative comments |
| 5 | **Scope** | Unrelated destructive change smuggled in (migration, deletion) | Diff includes changes unrelated to the ticket/purpose | Opportunistic refactor mixed into the diff without mention |

## Project extension point

Before scoring, look for project-specific criteria and LAYER them on top of the core
(they can add rows and re-classify severities, never remove core rows):

1. The repo's own review rules: `.claude/rules/*review*`, `.claude/rules/code-review.md`.
2. The repo's CLAUDE.md conventions sections.
3. Stack signals (e.g. Django → query optimization / migrations / serializers; React →
   hooks rules / state boundaries / i18n) — only when the repo documents them; do not
   import another project's taste.

Declare which extension source was used (or "core only — no project criteria found").
