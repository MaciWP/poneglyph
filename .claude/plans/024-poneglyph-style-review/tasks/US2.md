---
us: US2
title: grader calqueDetect + registro (red→green)
wave: 1
depends_on: []
tdd_mode: forced
estimate: S
status: draft
---

## Quick reference

| Campo | Valor |
|---|---|
| Files | `.claude/evals/graders.ts`, `.claude/evals/__tests__/graders.test.ts` |
| Tipo | función pura nueva + unit tests |
| AC spec | AC2, AC3 |
| TDD | forced — red→green (grader nuevo con lógica) |

## Execution prompt (Phase 3 input)

**Task**: Añadir un grader determinista `calqueDetect` a `.claude/evals/graders.ts` que falle si la prosa contiene calques del inglés (lista de anclas multi-palabra de los propios ejemplos de `poneglyph.md`). Registrarlo en el objeto `graders`. TDD: escribir primero los tests en `__tests__/graders.test.ts` (rojo), luego implementar (verde).

**Context**: La norma "no calques" es el motivo raíz de 017 (translated-English debt) y NO tiene oráculo. `esEsDetect` no la pilla (un calque sigue siendo español). El patrón de los graders existentes: función pura `(transcript, caseSpec?) => {pass, detail}`, usa `stripCode`/`stripQuoted` para no penalizar código/citas literales. Los calques canónicos del spec (líneas 17-20): "voy a proceder a", "hace sentido"/"haría sentido", "déjame verificar/comprobar", "es debido a que".

**Constraints**: Determinista, puro, sin I/O ni LLM (W2 D4 — judges prohibidos). Anclas MULTI-PALABRA para FP bajo (NO "déjame" suelto). Reusar `stripCode`+`stripQuoted` (las citas literales y el código quedan exentos — un ejemplo de calque dentro de comillas NO debe fallar). Seguir el estilo exacto de `bannedOpeners`.

**Deliverable**: `export const calqueDetect: Grader` con const `CALQUES = ["voy a proceder a", "hace sentido", "haría sentido", "déjame verificar", "déjame comprobar", "es debido a que"]`; comentario citando `poneglyph.md §Language calques`. Añadido a `graders: Record<string, Grader>`. Tests: ≥1 caso que pasa (prosa limpia), ≥1 que falla (calque presente), ≥1 que NO falla por calque dentro de comillas (exención).

**Verify**: `bun test ./.claude/evals/` → verde (incluye los nuevos). Confirmar que primero estuvo rojo (commitear/mostrar el rojo→verde, o al menos verificar el rojo antes de implementar).

**Ask-first**: Si alguna ancla candidata genera dudas de FP en prosa técnica normal — descartarla, mejor menos anclas y cero FP.

## Acceptance criteria

- **AC2.1**: Given prosa con "hace sentido", when `calqueDetect`, then `pass:false` con detail nombrando el calque.
- **AC2.2**: Given prosa limpia es-ES, when `calqueDetect`, then `pass:true`.
- **AC2.3**: Given un calque DENTRO de comillas dobles, when `calqueDetect`, then `pass:true` (exención de cita literal).
- **AC2.4**: Given la suite de graders, when `bun test ./.claude/evals/`, then verde.

## Commandments cubiertos
II (oráculo factual), IV (red→green, tests gate), III (función mínima, reusa helpers).
