---
spec: 025-flow-backhalf-gate
tasks: tasks/index.md
phase: 2.5
validation_mode: validation
test_policy: auxiliary
---

# Validations — 025-flow-backhalf-gate

Clasificación: US3 validation-mode (modifica solo `.md` — flow.md + retro/SKILL.md).

## US3 — docs: schema state.json (D4) + retro ownership

### Pre
- `flow-state.ts` ya escribe `us_history` (líneas 17-24, 60-72) y `current_phase:"closed"` (línea 108) — verificado en Fase D. El schema en flow.md (Step 4, ~94-114) NO los documenta.
- `retro/SKILL.md` menciona `retro_status` (267, 270, 340) pero sin ownership/ratificación explícita.

### Post
- flow.md Step 4 documenta el schema completo incl. `us_history` y `current_phase` (number | "closed").
- retro/SKILL.md tiene una nota explícita: quién/cuándo ratifica la retro y que un plan con `retro_status: pending` cuenta como incompleto.

### Structural assertions
- En flow.md, el bloque del schema canónico incluye una entrada `us_history` (con su forma: array de `{us, completed_at, tests_passed, files_touched, execution, askuserquestion_count}`).
- En flow.md, `current_phase` se documenta como `number | "closed"` (no solo `1`).
- En retro/SKILL.md, existe una frase que define el estado de ratificación (owner + cierre).

### Smoke
- `Grep "us_history" .claude/commands/flow.md` → ≥1 match en la sección del schema.
- `Grep -E "closed|number .* string" .claude/commands/flow.md` en el bloque current_phase.
- `Grep -iE "ratif|owner|pending" .claude/skills/retro/SKILL.md` → la nueva nota de ownership.

### Cross-validations
- El schema documentado en flow.md cuadra **1:1** con los campos que `flow-state.ts` realmente escribe (comparar la interfaz `FlowState` + lo que añaden closeUs/closeFeature). Cero campos inventados, cero omitidos.
- La nota de retro es coherente con `closeFeature` de flow-state.ts (que pone `retro_status:"approved"` + `feature_closed:true`) — la doc no debe contradecir el código.

---

## Drillme — Phase 2.5

1. `[failure]` **Happy + edge?** US1: T1.1/T1.2 happy + T1.3 edge + T1.4 anti-regresión ✅. US2: T2.1 happy + T2.2/T2.3 edge ✅. US3: 5 categorías de validación ✅.
2. `[approach]` **Untestable HU?** Ninguna: US1/US2 tienen oracle ejecutable; US3 tiene oracle declarativo (Grep + cuadre 1:1). 0% untestable.
3. `[approach]` **Property-based fit?** `findOpenPlans` tiene un invariante leve (filtrado = subconjunto de los abiertos) pero el espacio es pequeño; ejemplos cubren mejor que generar. No property-based (evita ceremonia).
