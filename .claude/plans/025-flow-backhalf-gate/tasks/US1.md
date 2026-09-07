---
us: US1
title: Subcomando `status` en flow-state.ts (report de planes abiertos)
wave: W1
depends_on: []
tdd_mode: forced
estimate: M
status: closed
---

# US1 — `status` report en flow-state.ts

## Execution prompt (Phase 3 input)

- **Task**: Añadir un subcomando `status` a `.claude/scripts/flow-state.ts` que liste los planes incompletos (`feature_closed:false`) bajo `.claude/plans/` con su fase, gates y HUs.
- **Context**: `flow-state.ts` ya tiene `detectPlanDir()` (líneas 159-175) que itera `readdirSync` y filtra `feature_closed:false`. Reutiliza ese patrón. La interfaz `FlowState` ya existe (líneas 26-40). Subcomandos actuales: close-us/approve-gate/verdict/close-feature (switch líneas 129-154).
- **Constraints**: Extiende, NO reescribe. Funciones puras exportadas (`findOpenPlans(plansRoot): {dir,state}[]`, `summarizeState(state): string`) para testear sin I/O. No rompe los 4 subcomandos existentes. `status` NO requiere exactamente-1-plan (a diferencia de detectPlanDir): lista todos. Tolera state.json malformado/ausente sin abortar (AC2).
- **Deliverable**: `flow-state.ts` con `status` + funciones puras; un test (`.claude/scripts/__tests__/flow-state.test.ts` o junto a evals) que cubra findOpenPlans/summarizeState.
- **Verify**: `bun .claude/scripts/flow-state.ts status` lista los planes incompletos (debería mostrar 025 ahora mismo si corre antes de cerrarse); test en verde; `bun test ./.claude/hooks/` sigue green.
- **Ask-first**: si el formato de salida es ambiguo, elige líneas legibles (no JSON crudo) — no preguntes por algo trivial.

## Quick reference

| Campo | Valor |
|---|---|
| Ficheros | `.claude/scripts/flow-state.ts` (mod), `.claude/scripts/__tests__/flow-state.test.ts` (nuevo) |
| Funciones nuevas | `findOpenPlans()`, `summarizeState()`, case `"status"` |
| TDD | forced (red→green sobre las puras) |
| Riesgo | bajo — extensión aislada |
| Verificación | comando + test + hooks suite |

## User story

Como Oriol, quiero ver de un vistazo qué planes quedaron a medias y en qué fase, para cerrarlos en vez de abandonarlos en silencio.

## Acceptance criteria

- **AC1**: Given planes con `feature_closed:false`, when `flow-state.ts status`, then lista cada uno con slug, `current_phase`, gates aprobados y `us_completed`/`us_pending`.
- **AC2**: Given un `state.json` malformado o ausente en un dir de plan, when `status`, then lo marca como ilegible y continúa (no aborta).
- **AC3**: Given las funciones puras, when corre su test, then verde + `bun test ./.claude/hooks/` sin regresión.

## Files

| Fichero | Acción |
|---|---|
| `.claude/scripts/flow-state.ts` | Modificar: + findOpenPlans + summarizeState + case "status" |
| `.claude/scripts/__tests__/flow-state.test.ts` | Crear: tests de las puras (o ubicar donde el runner los recoja) |

## Verificación post-implementación

- `bun .claude/scripts/flow-state.ts status` produce el listado esperado.
- `bun test` sobre el nuevo fichero → verde.
- `bun test ./.claude/hooks/` → green (no regresión).

## Commandments cubiertos

| # | Cómo |
|---|---|
| III | Extiende con funciones puras; no reescribe; sin abstracción de más |
| IV | tdd: forced — red→green sobre la lógica de scan |
| IX | El report ES el mecanismo de visibilidad que alimenta la auto-mejora |
