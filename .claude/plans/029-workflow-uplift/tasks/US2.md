---
us: US2
title: Rule before-implementing — protocolo contractor con skill-advisor y drillme cableados
wave: WA
depends_on: []
tdd_mode: optional
estimate: S
status: closed
closed: 2026-08-05
note: ABSORBIDA por la fusión US-dev (2026-08-05) — el protocolo contractor vive como etapa PLAN del bucle dev (CLAUDE.md §The dev loop + skills/dev/SKILL.md Stage 2), con skill-advisor y drillme cableados como pasos. No se crea rule aparte (un solo dueño, Cmd IX).
---

# US2 — Rule `before-implementing` (protocolo contractor + wiring de skills)

## Execution prompt (Phase 3 input)

**Task**: Create `.claude/rules/before-implementing.md` — compressed (~35 lines) always-loaded adaptation of the user's contractor protocol governing every non-trivial implementation turn OUTSIDE /flow — now with deterministic skill wiring (user directives U3/U6).
**Context**: The user supplied the protocol verbatim (2026-08-05). The ad-hoc turn has zero discipline today; /flow already wires drillme (3 points) + skill-advisor (every phase boundary) — verified in flow.md §SIEMPRE — so this rule covers ONLY the non-/flow turn (no duplication, Cmd IX). Census: skill-advisor 2 lanzamientos ever, drillme 8 — the user wants them used more; memoria: cableo determinista > auto-trigger.
**Constraints**: Keep the 4 blocks compressed: (1) investigate-first (discoverable <1 min = research owed, never asked — test framework, lint, layout, existing abstractions listed); (2) produce-and-stop: Goal restatement + 0-3 blocking questions WITH recommended defaults + numbered falsifiable assumptions (only the dimensions the task touches: data/failure/boundaries/state/environment/scope/testing) + plan (files, signatures, order, rejected alternative in one clause); (3) proportionality: typo/rename/<20-lines-obvious → just do it; new module/schema/auth/money/migrations/deletion → full treatment + extra suspicion; (4) mid-implementation: wrong assumption → stop and tell, never quietly improvise. NEW wiring steps inside block 2: **non-trivial task → invoke `skill-advisor`** (shortlist propose→ratify) as part of producing the plan; **a blocking gap that survives the questions → `drillme`** (deep sweep). One boundary line each vs drillme/scope/plan-mode. English body. Evidence-block requirement lives in US3's rule — this rule DEFINES the flow, US3 makes evidence visible; if implementation shows one merged rule is cleaner, merge (decide there, single owner).
**Deliverable**: `.claude/rules/before-implementing.md` + 1 pointer line in CLAUDE.md — `sensitive: always-loaded global` · sync-claude run · golden-prompt evals after.
**Verify**: rule synced; evals green; behavioral AC next session (goal/questions/assumptions/plan block appears on non-trivial ad-hoc task).
**Ask first**: nothing — decisions locked by the user's own text + directives.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | WA |
| **Depends on** | none |
| **Blocks** | [US3] |
| **Files touched** | `.claude/rules/before-implementing.md` · `CLAUDE.md` (1 línea) |
| **TDD-mode** | optional |
| **Estimate** | S |
| **Cómo arrancar** | Comprimir el texto del usuario (sesión 2026-08-05) manteniendo los 4 bloques + añadir los 2 pasos de wiring |

## User story

- **As a**: Oriol
- **I want**: que antes de implementar nada no trivial se investigue, se me devuelva goal + preguntas con default + asunciones falsables + plan (con las skills correctas propuestas), y se espere
- **So that**: el coste del rework por asunción errónea desaparece, y skill-advisor/drillme se usan donde tocan sin que yo lo pida

## Acceptance criteria

- **AC1**: Given the rule, when read, then los 4 bloques + los 2 pasos de wiring (skill-advisor en plan; drillme en gap bloqueante) están presentes y el total es ≤40 líneas.
- **AC2**: Given una pregunta cuya respuesta está en el repo (<1 min), when aplica el protocolo, then la rule prohíbe explícitamente preguntarla.
- **AC3**: Given un cambio trivial, when aplica, then manda ejecutar directamente sin ceremonia.
- **AC4**: Given la rule + drillme + scope, when se leen, then la frontera de cada una está declarada en 1 línea sin solape de ownership.
- **AC5**: Evals green tras el cambio.

## Commandments cubiertos

| # | Cómo |
|---|---|
| III+I | Ask-before-assume barato y entender-antes-de-actuar en el turno default |
| VIII | El plan producido es un prompt de calidad hacia el propio build inline |

## Verificación post-implementación

- Sync ejecutado; evals green; behavioral AC en la siguiente sesión real.
