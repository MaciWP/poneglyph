---
us: US4
title: Delta de doctrina — referencias stale a modelos en CLAUDE.md y sweep de skills/commands
wave: W1
depends_on: []
tdd_mode: optional
estimate: S
status: closed
closed: 2026-07-07
---

# US4 — Delta de doctrina (refs a modelos)

## Execution prompt (Phase 3 input)

**Task**: Corregir las referencias de la doctrina que asumen la era de modelos anterior. Confirmada: `CLAUDE.md:117` — "`Explore` (Haiku built-in) for bulk read-only exploration" (Explore hereda el modelo de sesión, capped at opus, desde CC 2.1.198). Barrer además `.claude/skills/**/SKILL.md`, `.claude/commands/*.md` y `.claude/docs/*.md` por menciones stale a modelos concretos (Haiku-as-Explore, sonnet-4-x como actual, capacidades "solo Opus").
**Context**: grep inicial sobre CLAUDE.md/output-style/rules/system-inventory solo halló la línea 117; el sweep de skills/commands queda pendiente de ejecutar en build (declarado honesto, no asumido limpio).
**Constraints**: Delta mínimo — corregir la afirmación stale, no reescribir secciones; CLAUDE.md es sensitive-adjacent (config global): cambio quirúrgico. No tocar menciones históricas legítimas (auditorías, retros, memorias — son registro).
**Deliverable**: CLAUDE.md:117 corregido (Explore hereda el modelo de la sesión); cada hallazgo del sweep corregido o justificado como histórico.
**Verify**: `grep -rn "Haiku built-in"` → 0 en capa viva; `bun test ./.claude/...` verde; lista de hallazgos del sweep reportada en el cierre de la HU.
**Ask first**: nada — criterio "vivo vs histórico" definido arriba.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W1 |
| **Depends on** | none |
| **Blocks** | none |
| **Files touched** | `CLAUDE.md` + los que revele el sweep (≤4) |
| **TDD-mode** | optional |
| **Estimate** | S |
| **Cómo arrancar** | Fix CLAUDE.md:117 → sweep grep por modelos en skills/commands/docs |
| **Decisión absorbida** | — |

## User story

- **As a**: el Lead post-Fable
- **I want**: doctrina sin afirmaciones falsas sobre qué modelo hace qué
- **So that**: no tomar decisiones de delegación/modelo basadas en un mapa que miente (Cmd II/X)

## Acceptance criteria

- **AC1**: Given la capa viva, when `grep "Haiku built-in"`, then 0 hits.
- **AC2**: Given el sweep, when termina, then cada hit está corregido o justificado como histórico en el reporte.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `CLAUDE.md` | Línea 117: Explore hereda modelo de sesión (CC 2.1.198) |
| (sweep) | Los que aparezcan, ≤4 |

## Workflow detallado

1. Fix CLAUDE.md:117. 2. Sweep grep (`-i "haiku\|sonnet-4\|opus 4\.[0-7]\|fable"`) sobre capa viva. 3. Corregir/justificar cada hit. 4. Reporte.

## Smell signals

- ⚠️ El sweep revela >4 ficheros vivos a tocar → parar y re-plan (HU no atómica).

## Verificación post-implementación

- Greps de AC + tests verdes.

## Commandments cubiertos

| # | Cómo |
|---|---|
| II/X | El mapa no miente; sweep verificado, no asumido |
