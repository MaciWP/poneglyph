---
parent: scope
name: history
description: Rationale and post-implementation verification of the scope skill — history, not runtime procedure.
---

# scope — rationale and post-implementation verification

Relocated verbatim from `SKILL.md` on 2026-09-03 (plan 032/WP4 — progressive disclosure).

## Underlying principle (rationale)

> "Perfect code of the wrong thing is worthless." (Commandment I)

Most engineering pain comes from skipping the what/why and jumping into the how. This skill enforces the discipline: until the root problem and out-of-scope are explicit, no technical work proceeds. The hard gate 1->2 is non-negotiable (Commandment IV).

## Verification (post-implementation of this skill)

- Smoke: invocar `/scope "necesito hacer X"` → arranca cuestionario.
- Smoke: invocar `/scope` sin args → pedir brief al usuario, NO fallar silenciosamente.
- Auto-activación: en prompt sin `/scope` pero con "necesito hacer X" → la skill se auto-activa via description match.
- Verificar que `spec.md` resultante valida contra `templates/spec.template.md` (frontmatter + secciones obligatorias presentes).
- `bun test ./.claude/hooks/` sigue green (no toca código).

## Auxiliary skills — fallbacks

Moved to `.claude/docs/auxiliary-skills-matrix.md` §Fallbacks per phase (single owner of the phase↔auxiliary wiring).
