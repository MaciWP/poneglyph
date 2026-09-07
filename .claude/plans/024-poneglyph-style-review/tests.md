---
spec: 024-poneglyph-style-review
tasks: tasks/
phase: 2.5
test_mode: tdd
tdd_policy: optional
note: proyecto auxiliary; US2 opta a tdd:forced (grader nuevo con lógica → red→green)
---

# Tests — US2 (grader calqueDetect)

## US2 — tests (en `.claude/evals/__tests__/graders.test.ts`)

### T2.1 — calque presente falla (happy path negativo)
- **Type**: unit
- **Pre-condition**: `calqueDetect` importado de `../graders`.
- **Action**: `calqueDetect("Esto hace sentido porque el hook ya existe.")`
- **Assert**: `result.pass === false` y `result.detail` contiene "hace sentido".
- **Must fail before impl (red)**: `TypeError: calqueDetect is not a function` (no existe aún) o `undefined`.

### T2.2 — prosa limpia pasa
- **Type**: unit
- **Pre-condition**: idem.
- **Action**: `calqueDetect("Tiene lógica porque el hook ya existe. Actualizo la configuración.")`
- **Assert**: `result.pass === true`.
- **Must fail before impl (red)**: función inexistente → throw.

### T2.3 — calque dentro de comillas NO falla (exención de cita literal)
- **Type**: unit (edge)
- **Pre-condition**: idem; reusa `stripQuoted`.
- **Action**: `calqueDetect('El usuario escribió "voy a proceder a borrarlo" pero no lo hizo.')`
- **Assert**: `result.pass === true` (el calque está citado, exento).
- **Must fail before impl (red)**: función inexistente; y aun implementada naïf sin `stripQuoted`, fallaría → fuerza usar el helper.

### T2.4 — calque dentro de bloque de código NO falla
- **Type**: unit (edge)
- **Pre-condition**: idem; reusa `stripCode`.
- **Action**: ``calqueDetect("```\n// es debido a que\n```\nTexto limpio.")``
- **Assert**: `result.pass === true`.
- **Must fail before impl (red)**: función inexistente.

### T2.5 — registrado en el mapa `graders`
- **Type**: unit
- **Pre-condition**: `import { graders } from "../graders"`.
- **Action**: `graders["calqueDetect"]`
- **Assert**: es una función (typeof === "function").
- **Must fail before impl (red)**: `undefined` (no registrado).

> Property-based: NO aplica (es match de phrase-list, no transform con invariante). 2 happy + 3 edge — honesto, sin padding.
