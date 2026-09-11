---
us: US4
title: Evals routing create/modify/delete/consult to meta-harness
wave: W3
depends_on: [US1, US3]
tdd_mode: forced
estimate: S
status: closed
absorbs_decision: D28 AC27
approved: 2026-09-10
closed: 2026-09-10
---

# US4 — Evals AC27

## Execution prompt (Phase 3 input)

**Task**: Add ≥1 es-ES eval case each for create, modify, delete, and consult that routes to `meta-harness`. Do not wait for T2–T15 packs.
**Context**: `.claude/evals/cases.jsonl` has zero cases for `meta-create` or cookbook. Runner: `bun .claude/evals/run.ts`. Grader `skillTriggerParse` + `expected` skill name. US1 already set the description; US3 proves the T1 path exists.
**Constraints**: Cases are routing, not pack completeness. Do not call Fable/`claude -p` in CI. Follow existing jsonl shape (`id`, `prompt`, `type`, `grader`, `expected`, `source`).
**Deliverable**: four (or more) jsonl rows; `expected: "meta-harness"`.
**Verify**: `bun .claude/evals/run.ts` on those ids (or the file parse + unit grader tests if live evals are opt-in).
**Ask first**: nothing — D28 locked.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W3 |
| **Depends on** | US1, US3 |
| **Blocks** | none |
| **Files touched** | `.claude/evals/cases.jsonl` (+ tests if the eval harness has them) |
| **TDD-mode** | forced |
| **Estimate** | S |
| **Cómo arrancar** | Copy an existing skill-trigger row; write four es-ES prompts |
| **Decisión absorbida** | D28 AC27 |

## User story

- **As a**: future Lead
- **I want**: the new description to lose to `create-skill` or the cookbook stub
- **So that**: AC1 is measurable, not hoped

## Acceptance criteria

- **AC1**: Given prompts in es-ES for crear / modificar / borrar / consultar config nativa, when the trigger grader runs, then `expected` is `meta-harness` (spec AC27).
- **AC2**: Given stubs, when the same prompts run, then they do not expect `meta-create` or `meta-settings-cookbook`.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/evals/cases.jsonl` | ≥4 skill-trigger rows |

## Workflow detallado

1. Read grader + one working skill-trigger case.
2. Add four cases. Run the eval path this repo uses for jsonl (parse tests first; live `claude -p` only if already wired and cheap-tier).

## Verificación post-implementación

- jsonl valid; grader tests green.
- Live eval optional; if skipped, say so — do not claim behavioral pass.
