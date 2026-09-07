---
us: US1
title: Skill dev — bucle de desarrollo two-tier (fusión US1+US2+US3, ejecutada)
wave: WB
depends_on: []
tdd_mode: optional
estimate: M
status: closed
closed: 2026-08-05
note: Evolucionada por el usuario de "simplicity-ladder" a "dev" — bucle completo KNOW/PLAN/BUILD/REVIEW/LEARN two-tier (núcleo en CLAUDE.md + skill on-demand). Absorbe US2 (before-implementing → etapa PLAN) y US3 (golden rules → el bloque CLAUDE.md). Decisiones — sin modos v1, tag ponytail:, riesgos+mitigación en PLAN, loop-back con drillme. AC4 original corregido — el hook lee keywords de disco, no hay fila hardcodeada que tocar. Evals ENTREGADOS (2026-08-05 tarde) — grader devLoopStages + casos devloop-nontrivial-20/devloop-trivial-21 + 5 tests unitarios (24/24 offline). Deferred restante por naturaleza — run live fuera de sandbox + validación conductual próxima sesión.
---

# US1 — Skill `simplicity-ladder` (versión propia de ponytail)

## Execution prompt (Phase 3 input)

**Task**: Create the `simplicity-ladder` skill — poneglyph's own adaptation of ponytail (MIT, adaptable): an ordered decision ladder that makes the Lead default to the least code that solves the problem.
**Context**: Source material verified: [ponytail SKILL.md](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md) (read in full by research agent). Evidence: user re-types his quality premise in ~14 sessions; over-engineering pushback in 9 msgs/6 sessions ("me parece super complicado para una primera version", "necesitamos editar 4 archivos?", "El test es totalmente necesario?"). Key mechanism fact: as a self-activating skill ponytail fired 0 times (JetBrains test) — activation must be deterministic. Existing hook: `.claude/hooks/skill-activation.ts` injects `Skill(<name>)` hints on keyword match. `meta-create` skill governs skill canon; feature 023: activation surface (description/when_to_use) in es-ES, body in English.
**Constraints**: Adapt, don't copy verbatim (credit ponytail in a comment). NO new SessionStart hook — the always-on compressed version lands in CLAUDE.md via US3; this skill carries the full mechanics on demand. Keep it ≤150 lines: ladder + safety floor + debt convention + review lens. Drop from the original: intensity modes ultra/gain scoreboard/multi-agent payloads (ceremony for a personal layer). Body in English, activation surface in es-ES with `Keywords -` line parseable by skill-activation.ts.
**Deliverable**: `.claude/skills/simplicity-ladder/SKILL.md` + keyword row added to skill-activation hook config so it fires on: "simplifica", "over-engineering", "demasiado complejo", "mínimas líneas", "minimal", "YAGNI".
**Verify**: `bun test ./.claude/hooks/` green (hook keyword row tested); skill appears in harness system-reminder next session; smoke: a prompt containing "simplifica esto" triggers the hint.
**Ask first**: final skill name (simplicity-ladder is a proposal).

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W1 |
| **Depends on** | none |
| **Blocks** | [US3] |
| **Files touched** | `.claude/skills/simplicity-ladder/SKILL.md` · `.claude/hooks/skill-activation.ts` (+ test) |
| **TDD-mode** | optional (hook edit carries test) |
| **Estimate** | M |
| **Cómo arrancar** | Read ponytail SKILL.md source (URL in prompt) + meta-create references; draft the 7-rung ladder adapted |

## User story

- **As a**: Oriol
- **I want**: que el sistema aplique por defecto la solución con menos código que aguante, sin que yo re-tecleé mi premisa cada sesión
- **So that**: desaparecen las rondas de pushback por over-engineering y la premisa deja de ser un paste manual

## Acceptance criteria

- **AC1**: Given the skill file, when read, then it contains the ordered ladder (stop at first rung): (1) does it need to exist? (2) already in this codebase? — search similar examples/functions/classes first, (3) stdlib?, (4) native platform feature?, (5) already-installed dependency?, (6) one line?, (7) minimum code that works — explicitly sequenced AFTER full comprehension of the problem ("read fully, then be lazy").
- **AC2**: Given the skill, when read, then it contains a non-negotiable safety floor: never simplify away trust-boundary validation, error handling, security, accessibility, or anything explicitly requested; bug fix = root cause, never symptom patch ("Pero esto no es la raiz de la verdad lo estas tapando" — evidencia backend).
- **AC3**: Given a deliberate corner-cut, when code is written, then it carries a `debt: <ceiling>, <upgrade trigger>` comment convention documented in the skill.
- **AC4**: Given skill-activation.ts, when a prompt matches the new keywords, then the `Skill(simplicity-ladder)` hint is injected (test in `__tests__`).
- **AC5**: Activation surface es-ES + `Keywords -` literal; body English (feature 023 conformance, checked by meta-create canon).

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/skills/simplicity-ladder/SKILL.md` | Skill nueva: ladder + floor + debt + review lens (`delete:/stdlib:/native:/yagni:/shrink:` tags para diffs) |
| `.claude/hooks/skill-activation.ts` | Fila de keywords nueva — `sensitive: hook global de activación, doble test` |
| `.claude/hooks/__tests__/skill-activation.test.ts` | Caso de test para la fila nueva |

## Workflow detallado

1. `Skill(meta-create)` — canon de skills (template, frontmatter, es-ES surface).
2. Draft ladder adaptando ponytail; fold rung 2 con el paso "estudiar ejemplos similares de la app" (golden rule #1 del usuario — un solo dueño).
3. Añadir keyword row + test; `bun test ./.claude/hooks/`.
4. Registrar en la tabla de skills si aplica (system-inventory).

## Commandments cubiertos

| # | Cómo |
|---|---|
| V | Es el mecanismo de enforcement de "simple by default" — hoy es prosa, esto lo hace operativo |
| IX | Funde la golden rule de reuso del usuario con la escalera — un solo dueño del ground |

## Smell signals

- ⚠️ Si la skill supera ~150 líneas o re-crea modos de intensidad/scoreboards → está copiando ceremonia de ponytail que no necesitamos.

## Verificación post-implementación

- Smoke: prompt "simplifica esto, demasiado complejo" → hint `Skill(simplicity-ladder)` inyectado.
- `bun test ./.claude/hooks/` green.

## Open questions (a resolver en implementación)

- ¿Incluir el modo `lite` (nombra la alternativa más vaga sin imponerla) como único dial, o sin modos? Propuesta: sin modos en v1.
