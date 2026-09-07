---
us: US1
title: Hook SessionStart open-plans — visibilidad de lifecycles abiertos en cada arranque de sesión
wave: W1
depends_on: []
tdd_mode: forced
estimate: S-M
status: closed
closed: 2026-07-07
---

# US1 — Hook SessionStart open-plans

## Execution prompt (Phase 3 input)

**Task**: Crear `.claude/hooks/session-start-plans.ts` (SessionStart) que emita el recordatorio de planes abiertos al arranque de CADA sesión, y registrarlo en `settings.json`.
**Context**: `post-compact.ts:10` exporta `openPlansReminder(plansRoot=".claude/plans")` (scan inline, best-effort, null si no hay dir) y `:61` `buildOutput()`. El hook nuevo IMPORTA de `./post-compact` — mismo dir sincado, sin sync-trap (memoria `feedback-sync-trap-hook-script` no aplica intra-hooks/). Verificar primero el guard `import.meta.main` en post-compact.ts (open question 1); si falta, añadirlo. settings.json hooks tiene 6 eventos, sin SessionStart. Tests de referencia: `.claude/hooks/__tests__/post-compact.test.ts`.
**Constraints**: `tdd: forced` — test rojo antes de implementar (red→green). Silencioso cuando 0 planes abiertos (exit 0, sin stdout). Best-effort: nunca bloquear el arranque (try/catch, exit 0 siempre). `sensitive: settings.json registra hooks globales` al editarlo. SessionStart también dispara en `--resume`/`/clear` — el output debe ser idempotente y corto (≤5 líneas).
**Deliverable**: hook + entrada SessionStart en settings.json + `__tests__/session-start-plans.test.ts` (casos: planes abiertos → recordatorio; 0 abiertos → silencio; dir ausente → silencio; state ilegible → aparece como unreadable).
**Verify**: test nuevo rojo→verde; `bun test ./.claude/hooks/` completo verde; smoke manual `echo '{}' | bun .claude/hooks/session-start-plans.ts` en repo con plan abierto de fixture.
**Ask first**: nada — diseño ratificado (025 follow-up + gate).

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W1 |
| **Depends on** | none |
| **Blocks** | [US3] |
| **Files touched** | `hooks/session-start-plans.ts` (nuevo), `settings.json`, `hooks/__tests__/session-start-plans.test.ts` (nuevo), `hooks/post-compact.ts` (solo si falta guard) |
| **TDD-mode** | forced |
| **Estimate** | S-M |
| **Cómo arrancar** | Verificar guard import.meta.main en post-compact → escribir test rojo |
| **Decisión absorbida** | reuso del export existente (ni lib nueva ni duplicación) |

## User story

- **As a**: Oriol arrancando cualquier sesión en cualquier repo
- **I want**: ver los lifecycles abiertos sin esperar a una compactación
- **So that**: la mitad trasera del flujo (critic/retro/ratificaciones pending) no se abandone por invisibilidad

## Acceptance criteria

- **AC1**: Given un plans root con `feature_closed:false`, when el hook corre, then stdout contiene el recordatorio con slug y fase (spec AC1).
- **AC2**: Given 0 planes abiertos o dir ausente, when corre, then stdout vacío y exit 0.
- **AC3**: Given state.json ilegible, when corre, then el plan aparece como unreadable (no se oculta).

## Files a crear / a modificar

| Path | Cambio |
|---|---|
| `.claude/hooks/session-start-plans.ts` | Nuevo — main fino sobre import de post-compact |
| `.claude/hooks/__tests__/session-start-plans.test.ts` | Nuevo — 4 casos |
| `.claude/settings.json` | Entrada SessionStart (sensitive) |

## Smell signals

- ⚠️ Si el hook necesita lógica propia de scan → mal camino; debe ser un main fino sobre el export.

## Verificación post-implementación

- Red→green documentado; suite completa verde; smoke con fixture.

## Commandments cubiertos

| # | Cómo |
|---|---|
| IV | tdd forced; el hook es un gate de visibilidad |
| VII | Reuso del scan existente; coste por sesión ~0 cuando no hay abiertos |
