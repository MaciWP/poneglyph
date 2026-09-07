---
us: US3
title: Docs — schema canónico state.json (finding D4) + ownership de retro
wave: W1
depends_on: []
tdd_mode: optional
estimate: S
status: closed
---

# US3 — docs: schema D4 + retro ownership (validation-mode)

## Execution prompt (Phase 3 input)

- **Task**: Cerrar el finding D4 de la auditoría: documentar en el schema canónico de `state.json` (`.claude/commands/flow.md` Step 4, líneas ~94-114) los campos que `flow-state.ts` escribe pero no están documentados: `us_history` (array de UsHistoryEntry) y `current_phase: "closed"` (string, no solo number). Además, en `.claude/skills/retro/SKILL.md`, hacer explícito el ownership/estado de ratificación de la retro (que `retro_status: pending` no quede flotante: documentar quién/cuándo se ratifica y que un plan con retro pending es "incompleto" hasta ratificarse).
- **Context**: flow-state.ts `UsHistoryEntry` (líneas 17-24) y `closeFeature` ponen `current_phase:"closed"` (línea 108). flow.md schema (94-114) lista 12 campos sin estos. retro/SKILL.md ya menciona retro_status (líneas 267, 270, 340).
- **Constraints**: Solo docs (validation-mode, sin código). El schema documentado debe casar 1:1 con lo que flow-state.ts escribe (verificado en Fase D). No inventar campos.
- **Deliverable**: flow.md Step 4 con `us_history` + `current_phase` actualizado; retro/SKILL.md con nota de ownership/ratificación.
- **Verify**: lectura — el schema en flow.md incluye los 2 campos; cuadra con flow-state.ts; retro deja claro el cierre de ratificación.
- **Ask-first**: nada.

## Quick reference

| Campo | Valor |
|---|---|
| Ficheros | `.claude/commands/flow.md` (mod), `.claude/skills/retro/SKILL.md` (mod) |
| TDD | validation-mode (sin código → validations.md, no tests.md) |
| Riesgo | nulo — solo docs |
| Verificación | lectura + cuadre con flow-state.ts |

## User story

Como mantenedor de poneglyph, quiero que el schema documentado de state.json no mienta (incluya us_history y current_phase:"closed") y que la ratificación de retro tenga dueño, para que no vuelva a divergir ni quedar pending flotante.

## Acceptance criteria

- **AC1**: Given flow.md Step 4, when lo leo, then el schema incluye `us_history` (con su forma) y documenta `current_phase` puede ser number o `"closed"`.
- **AC2**: Given el schema documentado, when lo comparo con flow-state.ts, then cuadra 1:1 (sin campos inventados ni omitidos).
- **AC3**: Given retro/SKILL.md, when lo leo, then la ratificación de retro tiene ownership/estado explícito y un plan con retro pending se considera incompleto.

## Files

| Fichero | Acción |
|---|---|
| `.claude/commands/flow.md` | Modificar: Step 4 schema + us_history + current_phase "closed" |
| `.claude/skills/retro/SKILL.md` | Modificar: nota de ownership/ratificación |

## Verificación post-implementación

- Lectura: schema en flow.md cuadra con flow-state.ts.
- `bun test ./.claude/hooks/` → green (solo docs, sin impacto).

## Commandments cubiertos

| # | Cómo |
|---|---|
| II | El schema documentado deja de mentir (cuadra con el código real) |
| X | Cierra D4: el mapa no diverge del territorio |
