---
spec: 028-p2-backlog-closeout
created: 2026-07-08
mode: standard
status: closed
phase: 2
total_us: 6
dag_complete: true
---

# Tasks index — Cierre backlog P2

Level: Standard — 6 frentes acotados, sin APIs externas; 3 con código (hooks/script) y 3 markdown/config.
TDD-mode: optional (policy `auxiliary`) con opt-in `tdd: forced` en US3 y US4 (lógica de hooks con suites existentes) y en el sub-ítem D6 de US6.

## Resumen ejecutivo

6 HUs independientes (W1, inline secuencial). US1 resuelve la colisión del gate de seguridad renombrando el skill a **`security-audit`** (propuesta — dir libre verificado) con barrido completo de dispatchers (~12 ficheros vivos; ejemplos/históricos se juzgan caso a caso). US3 es la sustancia de código: sanear la captura de learning-inbox (truncado mid-word en `slice(0, CONTEXT_MAX)`, suelo de confianza, filtro de ruido JSON) + gitignore vía project-onboard + doc del split con auto-memory. US4 añade `hookSpecificOutput.additionalContext` al security-gate. US2/US5 son config/doctrina mínimas. US6 cierra flecos — incluida la corrección de SK-07, que el discovery re-confirmó como real (la degradación a "dudoso" de la auditoría fue un mis-check del Lead: los 2 hits de grep eran el playbook, no el analysis-source).

## Estimación / DAG

| Wave | HUs | Naturaleza |
|---|---|---|
| W1 | US1..US6 (🔵 todas) | inline secuencial; PES 6/6 = 100% |

Orden de ejecución sugerido: US2 (trivial) → US4 → US3 (la pesada) → US1 (sweep) → US5 → US6.

## Tabla resumen

| # | HU | Estimate | TDD | Files |
|---|---|---|---|---|
| US1 | Rename `security-review`→`security-audit` + sweep dispatchers | M | optional | dir + ~12 md |
| US2 | `minimumVersion` ≥2.1.198 + anotación relación con requiredMinimumVersion | S | optional | settings.json, system-inventory.md |
| US3 | learning-inbox saneado + gitignore onboard + split auto-memory | M | **forced** | hooks/learning-inbox.ts, su test, project-onboard/SKILL.md |
| US4 | security-gate → `additionalContext` al modelo | S | **forced** | hooks/security-gate.ts, su test |
| US5 | Cablear `Skill(verify)` en doctrina + critic | S | optional | CLAUDE.md, critic/SKILL.md |
| US6 | Flecos: SK-07 (content-map row), D6 (`complete-phase` en flow-state + test), RI-3 (defaults ultracode-audit) | S-M | mixto (D6 forced) | orchestrator SKILL.md, scripts/flow-state.ts + test, workflows/ultracode-audit.js |

## Research (discovery ejecutado)

`security-audit` dir libre ✓; refs vivas al nombre viejo: critic (SKILL + 2 refs), flow.md, role.md, aux-matrix, skill-matching, system-inventory, meta-create (3), orchestrator (3), tech-plan/05, decision-stress-test, model-uplift-playbook §4, rank.test.ts fixture — ejemplos puros (html-report sample) se conservan como históricos. learning-inbox: truncado en `slice(0, CONTEXT_MAX)` (:76), confianzas por señal (:84-89), REVIEW_PROSE solo filtra error-resolution (:88). ultracode-audit stale en :175/:409/:412. SK-07: `09-loops-analysis-source.md` NO citado desde SKILL.md (re-confirmado). Stop `additionalContext` soportado CC ≥2.1.163 (rules/paths/hooks.md ya lo documenta como alternativa). `requiredMinimumVersion` = managed setting (changelog 2.1.163) — NO supersede a `minimumVersion` personal; anotar así.

## Drillme — Phase 2 (cerrado)

Simpler ✓ (rename > alias/wrapper; sanear > reescribir). Wheel ✓ (nada duplicado; additionalContext ya documentado como camino en hooks.md). Atomic ✓ (≤5 files salvo US1, sweep declarado). Deps ✓ (ninguna real). Failure tolerance ✓ (independientes). Location ✓.

## Open questions (deferidas a Fase 3)

1. Umbral exacto del suelo de confianza en learning-inbox — decidir leyendo la distribución real de SIGNALS en build (con test).

## Próximo paso

Fase 2.5 → gate 2→3 (ratificar también el nombre `security-audit`).
