---
name: verify
description: |
  Gate pre-done: hace que "hecho" signifique verificado. Protocolo de 4 pasos
  tras implementar — checks del proyecto, barrido de impacto (qué más usa lo
  tocado), ejercer el flujo real end-to-end cuando hay superficie de runtime
  (ejecutar, no predecir), y reporte de riesgo residual con status por claim.
  Es el ejecutor de la etapa REVIEW del dev loop (CLAUDE.md §The dev loop).
  Úsala cuando: acabas de implementar y vas a reportar "hecho" o a commitear,
  "¿estás 100% seguro?", "¿no hemos roto nada?", "haz una prueba manual",
  "verifica el cambio", "¿funciona de verdad?", "barrido de impacto".
metadata:
  keywords: >
    Keywords - verifica el cambio, estás seguro, estas seguro, no hemos roto, prueba manual,
    funciona de verdad, riesgo residual, antes de commitear, pre-done, barrido de impacto,
    impact sweep, end-to-end manual, smoke manual
disable-model-invocation: false
when_to_use: |
  "¿estás 100% seguro?", "¿no hemos roto nada?", "haz una prueba manual tú mismo",
  "verifica antes de commitear", "¿qué más usa esto?", tras cerrar cualquier
  implementación con superficie de runtime
---

# verify — the pre-done gate

Makes "done" mean verified. This skill is the executor of the dev loop's REVIEW
stage (CLAUDE.md §The dev loop); `critic` invokes it for the happy-path E2E row.
Born from measured friction: 20+ "¿estás 100% seguro?" turns across 18 sessions,
plus CI/tsc breaking AFTER a reported "done" (029 analysis, 2026-08-05).

For authorized publication, read [the publication protocol](references/publication.md)
in KNOW. It coordinates local checks, candidate CI, and verified integration.

## Anti-trigger (proportionality)

Doc/markdown-only diffs and test-only diffs with no runtime surface do NOT get
the full protocol — the project suite alone suffices. The gain is on code with
runtime surface (product code, hooks, CLIs, UI).

## The 4-step protocol

### 1. Project checks

Run the project's check command — from the project CLAUDE.md §Commands/Verification
(this repo: `bun test ./.claude/`; a Vite/React repo: `tsc && vitest`; a Django
repo: `pytest`). Types and lint included when the stack has them.
Failure → `diagnostic-patterns`, fix the root cause, rerun. NEVER manipulate a
check to make it pass (Cmd IV). Run the checks over the **whole** changed set, not
only the files you remember touching, and never trust a delegated agent's "clean"
report (`Skill(lessons)` G2/G6 — a merge gate red is never a nit).

### 2. Impact sweep

For every touched symbol/component, enumerate what ELSE uses it — LSP references
first, Grep fallback — and name the affected files/screens/flows. This is the
"¿dónde más se usan estos badges?" question, asked proactively instead of by the
user. A shared symbol changed without its usages checked is not verified.

### 3. Drive the real flow (runtime surface only)

Execute the affected flow end-to-end and OBSERVE the output — run, don't predict;
a green suite is a hypothesis about the flow, not the flow:

| Surface | How to drive it |
|---|---|
| CLI/script | Run the real command with a realistic input |
| Hook | Feed it a real stdin payload; check stdout/exit code |
| API endpoint | Real request (curl/httpie) against the dev server |
| UI | The affected screen — user screenshots when the browser connector is unavailable |

### 4. Residual risk report

Close with per-claim status — never a bare "hecho":

```
Verify: <check command + result> · impact: <symbols → usages checked> ·
flow: <driven + observed | n/a (no runtime surface)> · residual: <what was
deliberately NOT tested and why | none known>
```

Claims are labeled: verified (observed first-hand) / probable (inferred — say
from what) / not verified (say why). Deferred checks stay visible, never banked.

## SIEMPRE rules

- Never report "completed" with a failing check — no exceptions (Cmd IV).
- Run, don't predict: an executable claim gets executed, not reasoned about (Cmd II).
- Cost scales with blast radius: trivial diff → step 1 only; shared-symbol or
  runtime change → all four steps.

## Commandments cubiertos

| # | Cómo |
|---|---|
| IV | Es el gate: checks reales + flujo real antes de "done"; prohibido manipular tests |
| II | Ejecutar y observar > predecir; claims con status explícito |
| I | El barrido de impacto entiende el blast radius antes de declarar cerrado |
