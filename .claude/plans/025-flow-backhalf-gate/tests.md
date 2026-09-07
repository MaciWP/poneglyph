---
spec: 025-flow-backhalf-gate
tasks: tasks/index.md
phase: 2.5
test_mode: tdd
tdd_policy: optional
note: "test-policy=auxiliary → optional; US1 opta a forced por frontmatter. Convención: bun test, __tests__/*.test.ts (describe/it/expect)."
---

# Tests — 025-flow-backhalf-gate

Clasificación: US1 TDD-mode (flow-state.ts), US2 TDD-mode (post-compact.ts). US3 → validations.md.

## US1 — tests (flow-state.ts `status`)

### T1.1 — findOpenPlans lista solo planes incompletos (happy)
- **Type**: unit
- **Pre-condition**: dir temporal con 3 subdirs `NNN-*`: dos con `state.json {feature_closed:false}`, uno con `{feature_closed:true}`.
- **Action**: `findOpenPlans(tmpRoot)`
- **Assert**: devuelve exactamente los 2 abiertos, cada uno con `{dir, state}`; excluye el cerrado.
- **Must fail before impl (red)**: `TypeError: findOpenPlans is not a function` (no existe aún).

### T1.2 — summarizeState incluye los campos de AC1 (happy)
- **Type**: unit
- **Pre-condition**: un `FlowState` con current_phase=3, gates {1->2:true,2->3:true}, us_completed=[US1], us_pending=[US2].
- **Action**: `summarizeState(state)`
- **Assert**: el string contiene slug, `3` (fase), estado de gates, y los conteos/listas de us_completed y us_pending.
- **Must fail before impl (red)**: `TypeError: summarizeState is not a function`.

### T1.3 — state.json malformado/ausente no aborta (edge — AC2)
- **Type**: unit
- **Pre-condition**: dir con un subdir cuyo `state.json` es JSON inválido + otro sin `state.json`, junto a uno válido abierto.
- **Action**: `findOpenPlans(tmpRoot)`
- **Assert**: no lanza; devuelve el válido; los rotos se omiten o marcan ilegibles (no rompen el barrido).
- **Must fail before impl (red)**: hoy `detectPlanDir` haría throw/`require` y no hay función `status` tolerante → red.

### T1.4 — subcomandos existentes intactos (edge — no regresión)
- **Type**: unit
- **Pre-condition**: state.json de fixture con us_pending=[US1].
- **Action**: `closeUs`, `approveGate`, `setVerdict`, `closeFeature` (las puras ya existentes).
- **Assert**: comportamiento idéntico al actual (sanity de que la extensión no tocó las firmas).
- **Must fail before impl (red)**: N/A si ya pasan; sirve de guardia anti-regresión post-impl.

## US2 — tests (post-compact.ts recordatorio)

### T2.1 — con planes abiertos, el output los menciona (happy — AC1)
- **Type**: unit
- **Pre-condition**: `openPlansReminder` apuntado a un root temporal con ≥1 plan `feature_closed:false`.
- **Action**: `openPlansReminder(tmpRoot)` (o `buildOutput` con el root inyectable)
- **Assert**: devuelve un string con una cabecera de sección + el slug y la fase del plan abierto.
- **Must fail before impl (red)**: `TypeError: openPlansReminder is not a function`.

### T2.2 — 0 planes o dir ausente → sin sección (edge — AC2)
- **Type**: unit
- **Pre-condition**: root temporal vacío / inexistente.
- **Action**: `openPlansReminder(tmpRoot)`
- **Assert**: devuelve `null`; `buildOutput()` NO incluye la sección; el hook seguiría exit 0.
- **Must fail before impl (red)**: la función no existe → red.

### T2.3 — fallo de lectura degrada a null (edge — AC3 best-effort)
- **Type**: unit
- **Pre-condition**: root que provoca error de lectura (permisos / no-dir).
- **Action**: `openPlansReminder(badRoot)`
- **Assert**: no lanza; devuelve `null` (best-effort).
- **Must fail before impl (red)**: la función no existe → red.

> Nota de infraestructura: reusar el patrón de los tests de hooks existentes (`__tests__/*.test.ts`, `bun:test` describe/it/expect, `tmpdir` para fixtures). `openPlansReminder` debe aceptar el root como parámetro (inyectable) para testear sin tocar el `.claude/plans` real.
