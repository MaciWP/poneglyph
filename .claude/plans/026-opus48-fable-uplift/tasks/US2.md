---
us: US2
title: Rule núcleo always-loaded model-uplift (≤25 líneas) + sync + evals sin regresión
wave: W2
depends_on: [US1]
tdd_mode: optional
estimate: S
status: closed
closed: 2026-07-07
absorbs_decision: híbrido core→playbook
---

# US2 — Rule `rules/model-uplift.md` (núcleo always-loaded)

## Execution prompt (Phase 3 input)

**Task**: Escribir `.claude/rules/model-uplift.md` — el núcleo compacto (≤25 líneas de contenido) que carga en TODAS las sesiones y condensa los deltas de US1 en directivas ejecutables en generación, con pointer al playbook.
**Context**: US1 ya existe (`docs/model-uplift-playbook.md`); las rules se sincronizan per-entry a `~/.claude/rules/` (sync-claude; test-policy.md es la única excluida) — un fichero nuevo requiere re-ejecutar el sync para crear su symlink.
**Constraints**: ≤25 líneas de contenido (lección 25× — memoria `always-loaded-vs-ondemand-cost`); inglés; sin frontmatter `paths:` (aplica siempre, no por ruta); solo directivas delta (no repetir CLAUDE.md/output-style); cada directiva en forma ejecutable-en-generación (anchor/ejemplo, no conteo).
**Deliverable**: (1) la rule nueva; (2) symlink global creado (re-run `bun .claude/commands/sync-claude.ts --execute --force` — declarar `sensitive:` si toca settings; el sync regenera settings.json global); (3) suite evals offline sin regresión.
**Verify**: `wc -l` del contenido ≤~25; `ls -la ~/.claude/rules/model-uplift.md` → symlink existe; `bun .claude/evals/run.ts` (modo offline/graders) sin regresión vs baseline — si el runner live no cabe en sandbox, correr la parte offline y declarar el resto para fuera de sandbox (memoria `live-evals-impractical-in-session`); `bun test ./.claude/...` verde.
**Ask first**: nada — decisiones bloqueadas.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W2 |
| **Depends on** | [US1] |
| **Blocks** | none |
| **Files touched** | `.claude/rules/model-uplift.md` (nuevo) + symlink `~/.claude/rules/` |
| **TDD-mode** | optional |
| **Estimate** | S |
| **Cómo arrancar** | Condensar los deltas de US1 a ≤25 líneas con pointer al playbook |
| **Decisión absorbida** | híbrido core→playbook (spec, capa) |

## User story

- **As a**: el Lead post-Fable en cualquier sesión/proyecto
- **I want**: el núcleo de disciplina Fable cargado siempre, sin depender de invocación
- **So that**: el comportamiento base no dependa del undertrigger de skills

## Acceptance criteria

- **AC1**: Given la rule escrita, when se cuenta su contenido, then ≤~25 líneas y cada directiva es delta + ejecutable en generación.
- **AC2**: Given el sync re-ejecutado, when `ls ~/.claude/rules/`, then `model-uplift.md` existe como symlink (spec AC2 se completa en la próxima sesión vía `instructions-loaded.log`).
- **AC3**: Given la suite de evals offline, when se ejecuta, then 0 regresiones (spec AC1).

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/rules/model-uplift.md` | Nuevo — núcleo ≤25 líneas + pointer al playbook |

## Workflow detallado

1. Condensar US1 → directivas núcleo.
2. Re-run sync (`--execute --force`, con backup si procede) y verificar symlink.
3. Correr evals offline + tests; declarar honesto qué queda para fuera de sandbox.

## Smell signals

- ⚠️ El núcleo crece >25 líneas → mover contenido al playbook, no ampliar el cap.

## Verificación post-implementación

- `ls -la ~/.claude/rules/model-uplift.md` → symlink ✓; evals sin regresión; tests verdes.

## Commandments cubiertos

| # | Cómo |
|---|---|
| IV | Evals + tests como gate de cierre |
| VII | Coste always-loaded acotado por diseño |
| X | Carga garantizada por capa determinista, no por auto-activación |
