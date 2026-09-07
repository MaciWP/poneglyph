---
spec: {NNN}-{slug}
tasks: tasks/
created: {ISO-date}
phase: 2.5
status: draft
test_mode: tdd
tdd_policy: business-critical|mixed|auxiliary
---

# Test specs per HU (TDD-mode)

## ¿Por qué TDD-mode?

<2-3 líneas: hay código ejecutable nuevo (función, hook, validator). Oracle binario natural — cada test falla en rojo antes de implementar y pasa en verde después. Aplicar validation-mode sería ignorar la herramienta más directa de verificación.>

## US{N} — tests

### T{N}.1 — <título corto>

- **Type**: unit | integration | property-based
- **Pre-condition**: <estado del sistema antes del test>
- **Action**: `<llamada concreta — función, endpoint, comando>`
- **Assert**: <outcome esperado — valor, estado, efecto>
- **Must fail before impl (red)**: <error o assertion esperado en estado rojo>

### T{N}.2 — <título corto>

- **Type**: unit | integration | property-based
- **Pre-condition**: <estado>
- **Action**: `<llamada>`
- **Assert**: <outcome>
- **Must fail before impl (red)**: <error esperado>

## Property-based (opt-in)

> Solo si alguna HU se beneficia de invariantes (parsers, transformaciones puras). Omitir en caso contrario.

- **Invariant**: `∀x: <predicate>`
- **Generator**: `<range o tipo de entrada generado>`
