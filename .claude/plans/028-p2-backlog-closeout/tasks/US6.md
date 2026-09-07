---
us: US6
title: Flecos — SK-07 content-map, D6 complete-phase en flow-state, RI-3 defaults ultracode-audit
wave: W1
depends_on: []
tdd_mode: optional
estimate: S-M
status: closed
closed: 2026-07-08
---

# US6 — Flecos menores (cierre honesto del backlog)

## Execution prompt (Phase 3 input)

**Task**: Tres cierres: (a) **SK-07**: añadir fila de content-map en `orchestrator-protocol/SKILL.md` para `references/09-loops-analysis-source.md` ("021 loops analysis source — evidence basis; read only when questioning the playbook's decisions") — re-confirmado en discovery: NO está citado (la degradación a dudoso en la auditoría fue un mis-check del Lead); (b) **D6**: subcomando `complete-phase <n>` en `scripts/flow-state.ts` (marca `phases_completed += n` + `current_phase` siguiente; valida n ∈ {1,2,2.5,3,4,5}) + test — cierra la resumabilidad parcial si una sesión muere en 2.5; documentarlo en la línea de helper de flow.md; (c) **RI-3**: refrescar defaults stale de `workflows/ultracode-audit.js` (corpus `agent-memory/**` :175 → layout vivo; `decisionPlans` default 008 :409 y `auditSlug` 011 :412 → defaults vivos o vacíos con nota).
**Context**: Los tres verificados en discovery con file:line. flow-state tiene suite (`scripts/__tests__/flow-state.test.ts`) y patrón de subcomandos claro (runCommand switch).
**Constraints**: D6 con red→green (sub-ítem forced); SK-07/RI-3 texto. RI-3: no re-diseñar el workflow — solo defaults/corpus.
**Deliverable**: fila content-map; subcomando + test + mención en flow.md; defaults refrescados.
**Verify**: suites verdes; smoke `complete-phase 2.5` sobre fixture; grep de agent-memory en ultracode-audit → 0.
**Ask first**: nada.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Wave / Deps** | W1 / none |
| **Files** | orchestrator-protocol/SKILL.md, scripts/flow-state.ts + test, commands/flow.md (1 línea), workflows/ultracode-audit.js |
| **TDD** | optional; D6 sub-ítem **forced** |

## Acceptance criteria

- **AC1**: Given el content-map, then 09-loops-analysis-source citado con guía de cuándo leerlo.
- **AC2**: Given `complete-phase 2.5` sobre fixture, then state.json refleja fase completada + updated_at; inválidos → error típado (red→green).
- **AC3**: Given ultracode-audit.js, then 0 referencias a layout muerto (spec AC6).
