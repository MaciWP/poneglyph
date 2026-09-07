---
spec: 027-roi-fixes-model-advisor
tasks: tasks/index.md
phase: 2.5
test_mode: tdd
tdd_policy: optional (proyecto auxiliary) — US1 opt-in `tdd: forced`
---

# Tests — 027 (solo US1; el resto en validations.md)

Infra existente reutilizada (Step 1.7): patrón de `hooks/__tests__/post-compact.test.ts` — fixtures con `mkdtempSync` + `writeFileSync` de state.json falsos; sin conftest/factories (Bun test plano). No se necesita fixture nueva compartida: los helpers de fixture viven inline en cada test file por convención del repo.

## US1 — tests (`hooks/__tests__/session-start-plans.test.ts`)

### T1.1 — planes abiertos → recordatorio con slug y fase
- **Type**: unit (función exportada del hook nuevo)
- **Pre-condition**: tmpdir con `plans/031-open/state.json` (`feature_closed:false`, `current_phase:4`) — mismo fixture-shape que post-compact.test.ts
- **Action**: llamar al builder exportado del hook nuevo con ese plansRoot (o `openPlansReminder` re-exportado)
- **Assert**: output contiene `031-open` y la fase; ≤5 líneas
- **Must fail before impl (red)**: `Cannot find module '../session-start-plans'` (el fichero no existe aún)

### T1.2 — 0 abiertos / dir ausente → silencio
- **Type**: unit
- **Pre-condition**: (a) tmpdir con solo planes `feature_closed:true`; (b) plansRoot inexistente
- **Action**: ídem
- **Assert**: output vacío/null en ambos casos (el hook no ensucia sesiones sanas ni repos sin plans)
- **Must fail before impl (red)**: mismo module-not-found

### T1.3 — state.json ilegible → aparece como unreadable
- **Type**: unit
- **Pre-condition**: tmpdir con `plans/033-bad/state.json` = `{not json`
- **Action**: ídem
- **Assert**: output menciona `033-bad` como ilegible (no se oculta — AC3 de la HU)
- **Must fail before impl (red)**: module-not-found

### T1.4 — importar post-compact no ejecuta su main (guard)
- **Type**: unit (regresión del open question 1)
- **Pre-condition**: ninguna
- **Action**: `import { openPlansReminder } from "../post-compact"` dentro del test nuevo
- **Assert**: el import resuelve sin side-effects (no stdout, no exit) — si post-compact carece de guard `import.meta.main`, este import rompería la suite
- **Must fail before impl (red)**: solo falla si el guard falta; si ya existe, pasa desde el inicio — declarado: este caso es verificación de precondición, no red esperado. El red REAL de la HU son T1.1-T1.3.

> Nota anti-pattern "red without failure reason": T1.1-T1.3 comparten el mismo red (module-not-found) porque la HU crea el módulo — es el red honesto de un fichero nuevo, no un pass trivial.

## Drillme — Phase 2.5

1. Happy+edge ✓ (T1.1 + T1.2/T1.3). 2. Untestable: 0 HUs. 3. Property-based: no aplica (sin parsers/transforms — un main fino sobre un scan ya testeado).
