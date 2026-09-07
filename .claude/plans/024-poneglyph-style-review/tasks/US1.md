---
us: US1
title: poneglyph.md — reforzar trigger confidence labels + fix ref /explain
wave: 1
depends_on: []
tdd_mode: optional
estimate: S
status: draft
---

## Quick reference

| Campo | Valor |
|---|---|
| Files | `.claude/output-styles/poneglyph.md` |
| Tipo | edit markdown (output-style, always-loaded) |
| AC spec | AC1, AC7 |
| Riesgo | always-loaded — no inflar; no cortar ejemplos |

## Execution prompt (Phase 3 input)

**Task**: Editar `.claude/output-styles/poneglyph.md` en dos puntos: (1) reforzar el §Confidence labels con un TRIGGER POSITIVO de cuándo producir un label, no solo qué significa cada estado; (2) corregir la referencia muerta `/explain` (línea 138).

**Context**: El estilo se aplica desigual. La definición de los 3 estados es buena, pero el disparador de producción es débil → infrautilización (el usuario lo marcó como prioridad nº1: buen uso de `[]` = menos tokens, mejor comunicación, más visual). La ref `/explain` (línea 138) apunta a un comando inexistente; la skill real es `explain-changes`. Verificado: `ls .claude/commands/explain*` → vacío; existe `skills/explain-changes`.

**Constraints**: NO cortar ejemplos (son la spec, declaración propia del fichero + `feedback-always-loaded-vs-ondemand-cost`). El trigger debe ser seguible en generación (sin contar/medir antes de generar — `feedback-rules-must-be-generation-executable`): redactar como disparador cualitativo + ejemplos, no thresholds numéricos. Mantener el tono y formato del fichero. Edit mínimo, no reescritura.

**Deliverable**: En §Confidence labels, tras la tabla, una línea de trigger del tipo: "Cuándo producir un label: cualquier afirmación que matizarías con creo/quizás/seguramente, toda predicción, y toda inferencia desde lectura incompleta del código/estado → label con payload (no hedge). Verificado de primera mano → sin label (baseline [Seguro])." Y línea 138: `/explain` → `/explain-changes`.

**Verify**: `grep -n "creo/quizás\|predicción\|lectura incompleta" poneglyph.md` → hit; `grep -n "/explain\b" poneglyph.md` → 0 hits a `/explain` suelto, sí a `/explain-changes`. Longitud final ≤ +6 líneas vs original.

**Ask-first**: Si el wording del trigger amenaza con contradecir §Cut filler (hedges) — coordinar, no duplicar.

## Acceptance criteria

- **AC1.1**: Given §Confidence labels, when se lee, then hay un disparador positivo de producción, cualitativo (no numérico).
- **AC1.2**: Given línea 138, when se lee, then la ref es `/explain-changes` (o "explícame"), no `/explain`.
- **AC1.3**: Given el fichero completo, when se cuenta, then el crecimiento es ≤6 líneas y no se borró ningún ejemplo.

## Commandments cubiertos
I (honestidad: el label ES la señal de confianza), II (factual), III (edit mínimo).
