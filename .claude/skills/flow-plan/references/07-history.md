---
parent: tech-plan
name: history
description: Rationale, legacy migration (planner-protocol → tech-plan) and post-implementation verification — history, not runtime procedure.
---

# tech-plan — rationale, legacy migration, post-implementation verification

Relocated verbatim from `SKILL.md` on 2026-09-03 (plan 032/WP4 — progressive disclosure).

## Underlying principle (rationale)

> "Anti-duplicate verification. Anti-obsolescence checking. Anti-hallucination on every claim." — adapted from planner-protocol §1

Most planning pain comes from: (a) reinventing wheels that already exist in the project, (b) building on stale/imagined APIs, (c) creating non-atomic HUs that can't be executed in one session. This skill enforces three obligatory verifications BEFORE writing any HU: project context (Glob/Grep), external doc (Context7), and atomicity check (drillme).

## Legacy migration (planner-protocol)

This skill implements decision **MIGRAR-Y-CUT** on the legacy `planner-protocol` skill (per US3 AC7):

**Migrated as references** (preserved, adapted frontmatter `parent: tech-plan`):
- `01-discovery.md` — anti-duplicate verification
- `02-research.md` — anti-obsolescence (Context7, WebFetch)
- `03-gap-analysis.md` — ground truth per change type
- `04-classification-waves.md` — 🔵🟡🔴 + Parallel Efficiency Score (canon for DAG construction)
- `05-team-mode.md` — cross-validation + Four-Eyes (Full mode, was 07)
- `06-quality-gates.md` — Poka-Yoke + TDD + final checklist (was 08)

**Cut** (obsolete or solapan):
- Legacy `05-workflow-phases.md` — workflow procedural now inline in this SKILL.md
- Legacy `06-output-format.md` — old format; new format = `tasks/index.md` + `tasks/US{N}.md` per `templates/`
- Legacy `planner-protocol/SKILL.md` — entire skill cut (this replaces it)
- Legacy `commands/planner.md` wrapper — cut (skills are invoked as `/<skill-name>` directly per docs Anthropic 2026)

References updated across the repo (orchestrator-protocol §Delegation doctrine + references, agents/builder|reviewer|scout, rules/error-recovery+test-policy, hooks/post-compact.ts) — see commit message.

## Verification (post-implementation of this skill)

- `bun test ./.claude/hooks/` sigue green (this skill is markdown — no test impact).
- Skill registered by harness — system-reminder shows `tech-plan` con `name: tech-plan` y description con "Use when:" + "Keywords -".
- `Glob .claude/skills/planner-protocol*` → vacío (cut completed).
- `Glob .claude/commands/planner.md` → vacío (wrapper cut).
- `Grep -r "planner-protocol" .claude/` → solo refs históricas en plan files del meta-feature (legítimas como contexto) y memorias.
- Smoke: invocar `/tech-plan` con un `spec.md` aprobado → produce `tasks/index.md` + N archivos US{N}.md + invoca `tdd-design`.

## Auxiliary skills — fallbacks

Moved to `.claude/docs/auxiliary-skills-matrix.md` §Fallbacks per phase (single owner of the phase↔auxiliary wiring).
