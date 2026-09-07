---
us: US3
title: Golden rules OBLIGATORIAS — secuencia en CLAUDE.md + rule MUST con bloque de evidencia
wave: WA
depends_on: [US2, US5]
tdd_mode: optional
estimate: M
status: closed
closed: 2026-08-05
note: ABSORBIDA por la fusión US-dev (2026-08-05) — las golden rules ordenadas y MANDATORY viven como el bloque "The dev loop" en CLAUDE.md §Golden Rule (bullets antiguos mapeados a etapas, trazabilidad en el reporte de cierre). PENDIENTE heredado y visible — los 2 casos de eval golden-prompt (AC5) y la validación conductual en próxima sesión.
---

# US3 — Golden rules ordenadas y OBLIGATORIAS

## Execution prompt (Phase 3 input)

**Task**: Rewrite CLAUDE.md §Golden Rule as ONE ordered mandatory sequence and back it with a strict rule whose compliance is VISIBLE in the response (evidence block), per the user's directive "las nuevas golden rules serán totalmente obligatorias".
**Context**: The user's 6 rules mapped (verified ownership): (1) study similar examples/existing functions → ladder rung 2 (US1, pointer added when it lands) + reuse-scan block; (2) simplest maintainable code, (4) minimal lines, (5) respect style → ladder + floor; (3) best strategy among analyzed options → before-implementing plan block (US2); (6) research docs/reputable experts/quality projects when it pays → contract investigate-first + tech-plan research. Strictness mechanism chosen with meta-create canon: behavioral MUST language alone under-delivers (undertrigger evidence) → the rule REQUIRES a visible evidence block in the response for any non-trivial code change: `Reuse-scan: <qué busqué, qué existe, qué reutilizo>` before implementing and `Verify: <comando + resultado + impacto>` before reporting done. Skipping the block = skipping the step, detectable a ojo y por evals.
**Constraints**: CLAUDE.md hosts the compressed numbered sequence (~10 lines, not longer than current section +20% — always-loaded budget); the rule (`.claude/rules/golden-sequence.md` or folded INTO before-implementing rule from US2 if two rules would overlap — decide in implementation, Cmd IX un-solo-dueño) carries the MUST + evidence-block spec. Proportionality preserved: trivial changes (typo/rename/<20 lines obvious) exempt from blocks — obligatorias no significa burocracia en lo trivial (Cmd V; el usuario ratificó proporcionalidad en su propio protocolo). English body. Every old Golden Rule bullet maps to a step or explicit relocation (traceability in commit body). Behavioral change → golden-prompt evals mandatory after; add 1-2 eval cases asserting the evidence blocks appear (grader: block presence on a non-trivial fixture, absence on a trivial one).
**Deliverable**: CLAUDE.md §Golden Rule rewrite — `sensitive: fichero always-loaded central` · rule file (o fusión con US2's) · 2 eval cases · sync-claude run.
**Verify**: evals green (incl. nuevos casos); traceability table completa; behavioral AC próxima sesión (memoria: no banquear win sin medir).
**Ask first**: confirmar el orden propuesto: entender → reuse-scan → investigar-si-paga → estrategia más simple → mínimo código con estilo → verify.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | WA (cierra la wave) |
| **Depends on** | [US2, US5] — referencia sus artefactos por nombre |
| **Files touched** | `CLAUDE.md` · `.claude/rules/golden-sequence.md` (o fusión con before-implementing) · `.claude/evals/*` (2 casos) |
| **TDD-mode** | optional (markdown + evals como oracle) |
| **Estimate** | M |
| **Cómo arrancar** | Leer §Golden Rule actual + rule de US2 entregada; decidir 1-rule-vs-2 (Cmd IX) |

## User story

- **As a**: Oriol
- **I want**: mis golden rules como secuencia obligatoria cuyo cumplimiento se VE en cada respuesta (no como principios que se ignoran en silencio)
- **So that**: "estudiar ejemplos antes", "mínimo código" y "verificar antes de done" pasan de deseo a comportamiento comprobable

## Acceptance criteria

- **AC1**: Given CLAUDE.md, when read, then §Golden Rule es una secuencia numerada de 6 pasos con dueño por paso (skill/rule/fase) y lenguaje MUST.
- **AC2**: Given un cambio de código no trivial, when se implementa, then la respuesta contiene el bloque `Reuse-scan:` ANTES del primer edit y el bloque `Verify:` antes de reportar done (evals lo comprueban con fixture).
- **AC3**: Given un cambio trivial (typo/<20 líneas forma obvia), when se implementa, then CERO bloques (proporcionalidad — eval de ausencia).
- **AC4**: Given los bullets antiguos de §Golden Rule, when se diffea, then cada uno mapea a un paso o relocación explícita (tabla en commit body); la sección no crece >20%.
- **AC5**: `bun .claude/evals/run.ts` green con los 2 casos nuevos.

## Commandments cubiertos

| # | Cómo |
|---|---|
| V+IV | La secuencia hace ejecutable "simple by default" y el bloque de evidencia lo convierte en gate visible |
| IX | Consolida premisa re-tecleada + escalera + verify bajo un dueño por paso |

## Smell signals

- ⚠️ Bloques de evidencia apareciendo en diffs triviales → proporcionalidad rota, recalibrar.
- ⚠️ Sección CLAUDE.md creciendo → estamos apilando prosa, no ordenando.

## Verificación post-implementación

- Evals green; próxima sesión real: bloque Reuse-scan visible en primera tarea no trivial.
