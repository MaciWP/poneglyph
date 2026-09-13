---
parent: tdd-design
name: history
description: Rationale and post-implementation verification of the tdd-design skill — history, not runtime procedure.
---

# tdd-design — rationale and post-implementation verification

Relocated verbatim from `SKILL.md` on 2026-09-03 (plan 032/WP4 — progressive disclosure).

## Underlying principle (rationale)

> "Each planned function → its test, scaled by `.claude/rules/test-policy.md`." (Commandment IV — blocking quality gates)

Phase 2.5 exists because the gap between "we agreed on the plan" and "the code is correct" needs a verifiable bridge. For code, the bridge is executable tests (red→green). For non-code artefacts (skills, templates, docs, configs), the bridge is declarative validations (Pre/Post/Structural/Smoke/Cross). Forcing TDD onto markdown is ceremony (anti-pattern); forcing executable tests onto config files is ceremony too. The honest answer is dual-mode.

## Verification (post-implementation of this skill)

- Smoke: invoke `/tdd-design` with an active `tasks/` directory → produces `tests.md` and/or `validations.md` per HU classification.
- Verify `tests.md` frontmatter declares `tdd_policy` matching `test-policy.md`.
- Verify `validations.md` frontmatter declares `test_policy` matching `test-policy.md`.
- Each TDD-mode HU has ≥1 T{N}.X with "Must fail before impl (red)" annotation.
- Each validation-mode HU has the 5 categories (or honest skips with reason).
- `bun test ./.claude/hooks/` sigue green (this skill is markdown — no test impact).

## Auxiliary skills — fallbacks

Moved to `.claude/docs/auxiliary-skills-matrix.md` §Fallbacks per phase (single owner of the phase↔auxiliary wiring).
