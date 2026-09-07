---
us: US2
title: scripts/ sincado (mata clase RI-1) + calificar las 3 instrucciones de evals (RI-10)
wave: W1
depends_on: []
tdd_mode: optional
estimate: S
status: closed
closed: 2026-07-07
---

# US2 — Sync de scripts/ + quals de evals

## Execution prompt (Phase 3 input)

**Task**: Añadir `"scripts"` a `LINK_FOLDERS` en `commands/sync-claude.ts:14-21`, re-ejecutar el sync, y calificar con "(in the poneglyph repo)" las 3 instrucciones `bun .claude/evals/run.ts` halladas por grep.
**Context**: LINK_FOLDERS actual = [skills, commands, docs, hooks, workflows, output-styles] (verificado). Sitios evals: `meta-settings-cookbook/SKILL.md:48`, `meta-create/SKILL.md:92`, `meta-create/references/doctrine-sweep.md:24`. evals/ queda deliberadamente NO sincado (tracked-not-synced; el harness solo tiene sentido en el repo).
**Constraints**: Cambio mínimo en sync-claude.ts (una entrada en el array). Las instrucciones de flow-state (`bun .claude/scripts/flow-state.ts`) NO se tocan — pasan a funcionar por el sync. `sensitive: el sync regenera ~/.claude/settings.json` al re-ejecutarlo.
**Deliverable**: array actualizado; `~/.claude/scripts` symlink existente; 3 quals aplicadas.
**Verify**: `ls -la ~/.claude/scripts` → symlink al repo; `cd /tmp && bun ~/.claude/scripts/flow-state.ts status --plan /tmp/nope` → error típado (no ENOENT de módulo); tests de commands verdes; grep confirma las 3 quals.
**Ask first**: nada.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W1 |
| **Depends on** | none |
| **Blocks** | [US3] |
| **Files touched** | `commands/sync-claude.ts`, `meta-settings-cookbook/SKILL.md`, `meta-create/SKILL.md`, `meta-create/references/doctrine-sweep.md` |
| **TDD-mode** | optional |
| **Estimate** | S |
| **Cómo arrancar** | Añadir "scripts" al array → sync → verificar symlink |
| **Decisión absorbida** | — |

## User story

- **As a**: el Lead en cualquier repo
- **I want**: que las instrucciones sincadas que citan scripts/ funcionen
- **So that**: la clase sync-trap RI-1 muera en vez de parchear instrucción a instrucción

## Acceptance criteria

- **AC1**: Given el sync ejecutado, when `ls ~/.claude/scripts`, then symlink válido (spec AC2).
- **AC2**: Given las 3 instrucciones evals, when se leen, then llevan el qualifier de repo.

## Files a crear / a modificar

| Path | Cambio |
|---|---|
| `.claude/commands/sync-claude.ts` | +1 entrada LINK_FOLDERS |
| 3 ficheros de skills (arriba) | qualifier "(in the poneglyph repo)" |

## Verificación post-implementación

- Symlink ✓, smoke cross-cwd ✓, suites verdes, grep de quals ✓.

## Commandments cubiertos

| # | Cómo |
|---|---|
| X | Muere una clase de rotura-en-clone, no una instancia |
