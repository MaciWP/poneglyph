---
us: US4
title: security-gate emite hookSpecificOutput.additionalContext — el aviso llega al modelo
wave: W1
depends_on: []
tdd_mode: forced
estimate: S
status: closed
closed: 2026-07-08
---

# US4 — CG-05: aviso in-turn del security-gate

## Execution prompt (Phase 3 input)

**Task**: Al detectar secreto sospechoso, `hooks/security-gate.ts` (Stop) debe emitir además `hookSpecificOutput.additionalContext` con instrucción accionable ("verify/redact the suspected secret at <locus> before continuing") para que el MODELO lo vea y actúe en el turno.
**Context**: Hoy emite `systemMessage` warn-only que el modelo nunca ve (CG-05). Stop hooks soportan `additionalContext` desde CC ≥2.1.163 — ya documentado como camino en `rules/paths/hooks.md` §Stop/SubagentStop feedback. Gate de versión (US2) lo cubre. Suite existente: `security-gate.test.ts` + `security-gate-functions.test.ts`.
**Constraints**: `tdd: forced`. Mantener el `systemMessage` (el usuario también debe verlo). No convertir el gate en bloqueante (sigue warn — el diseño warn-only es deliberado); `additionalContext` informa, no bloquea. Guard `stop_hook_active` intacto.
**Deliverable**: hook emitiendo ambos canales + test del payload JSON.
**Verify**: red→green; suite completa; actualizar la fila Stop de `rules/paths/hooks.md` (docs-sync: ya no es "warn-only systemMessage").
**Ask first**: nada.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Wave / Deps** | W1 / none |
| **Files** | hooks/security-gate.ts, hooks/__tests__/security-gate.test.ts, rules/paths/hooks.md |
| **TDD** | **forced** |

## Acceptance criteria

- **AC1**: Given un hallazgo de secreto, when el hook responde, then el JSON lleva `hookSpecificOutput.additionalContext` accionable Y `systemMessage` (spec AC4).
- **AC2**: Given 0 hallazgos, then sin additionalContext (silencio limpio).
