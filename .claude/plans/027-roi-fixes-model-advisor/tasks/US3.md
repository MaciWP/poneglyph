---
us: US3
title: system-inventory sin números caducables — cada conteo pasa a puntero-a-fuente (absorbe US1/US2)
wave: W2
depends_on: [US1, US2]
tdd_mode: optional
estimate: S
status: closed
closed: 2026-07-07
---

# US3 — Inventario sin números caducables

## Execution prompt (Phase 3 input)

**Task**: Pasada sobre `.claude/docs/system-inventory.md` reemplazando afirmaciones contables que caducan solas por punteros a la fuente o comandos de recuento, y absorbiendo los cambios de US1/US2.
**Context**: Caducables detectados (grep en discovery): hooks "**7 registered**" (US1 lo hace 8 — actualizar como puntero: "los registrados en settings.json — cuéntalos ahí"), rules "**2 + paths/**" (YA stale: existe `model-uplift.md` desde ayer), roles "(13 roles)" en History, skills "(24)" y "commands (3 slash…)" en directory map (P1 los corrigió ayer pero siguen siendo caducables — convertir a puntero). El patrón bueno ya existe en el propio doc: la fila de evals ("19 as of 2026-07-02 — recount `cases.jsonl` rather than trusting this number").
**Constraints**: NO borrar información — convertir: el número puede quedarse como snapshot fechado, pero la autoridad es el puntero (`ls .claude/skills | wc -l`, "los que declare settings.json.hooks", etc.). Cambio solo en system-inventory.md. Ejecutar DESPUÉS de US1/US2 (absorbe hooks 8 + scripts sincado en la fila de sync/directory map).
**Deliverable**: inventario donde cada conteo es snapshot-fechado + puntero, y las filas afectadas por US1/US2 reflejan la realidad nueva.
**Verify**: grep de AC3 del spec (0 números caducables sin puntero, sobre la lista de arriba); lectura de coherencia con el estado post-US1/US2.
**Ask first**: nada.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W2 |
| **Depends on** | [US1, US2] |
| **Blocks** | none |
| **Files touched** | `.claude/docs/system-inventory.md` |
| **TDD-mode** | optional |
| **Estimate** | S |
| **Cómo arrancar** | Tras cerrar US1/US2: grep de la lista de caducables → convertir uno a uno |
| **Decisión absorbida** | — |

## User story

- **As a**: cualquier sesión futura que lea el inventario
- **I want**: que el mapa no pueda mentir por el paso del tiempo
- **So that**: la deriva documental (fallo 4) se minimice estructuralmente, no persiguiendo instancias

## Acceptance criteria

- **AC1**: Given la lista de caducables del Context, when grep tras la pasada, then 0 sin puntero-a-fuente (spec AC3).
- **AC2**: Given los cambios de US1/US2, when se lee el inventario, then hooks y sync reflejan la realidad nueva (docs-sync).

## Files a crear / a modificar

| Path | Cambio |
|---|---|
| `.claude/docs/system-inventory.md` | Conversión números→punteros + absorción US1/US2 |

## Verificación post-implementación

- Greps AC1; lectura de coherencia; suites verdes (markdown).

## Commandments cubiertos

| # | Cómo |
|---|---|
| II/X | La autoridad pasa del número al artefacto; el mapa deja de caducar solo |
