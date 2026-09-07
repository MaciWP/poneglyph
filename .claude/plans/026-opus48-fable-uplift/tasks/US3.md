---
us: US3
title: Harness post-Fable — fallbackModel actualizado + palancas effort/thinking verificadas
wave: W1
depends_on: []
tdd_mode: optional
estimate: S
status: closed
closed: 2026-07-07
---

# US3 — Config del harness (`settings.json`)

## Execution prompt (Phase 3 input)

**Task**: Actualizar `.claude/settings.json` para la era post-Fable: refrescar `fallbackModel` (hoy `["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]`, una generación stale — finding CG-11) y verificar si hay más claves de modelo/effort que ajustar.
**Context**: `settings.json:5` (fallbackModel), `:161` (effortLevel xhigh — comprobar a qué aplica antes de tocar). IDs de modelo actuales según entorno/changelog: `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5-20251001` — VERIFICAR los IDs exactos antes de escribir (Cmd II; open question 1 del index): consultar la skill `claude-api` si hay duda.
**Constraints**: `sensitive: settings.json es config global de permisos/modelos` — declarar antes de editar. Cambio mínimo: no tocar claves no relacionadas. El pin de modelo de sesión NO se hardcodea (el usuario elige con `/model`); la guía de elección vive en el playbook (US1 §4), no en settings.
**Deliverable**: `fallbackModel` actualizado (propuesta: `["claude-sonnet-5", "claude-haiku-4-5-20251001"]` — Sonnet 5 como degradación primaria por su 1M y pricing promo); cualquier otra clave stale corregida con justificación.
**Verify**: JSON válido (`bun -e 'JSON.parse(...)'`); `bun test ./.claude/...` verde; los settings globales se regeneran en el sync de US2 (ordenar US3 antes del sync o re-correrlo).
**Ask first**: nada — el cascade propuesto quedó bloqueado en gate 2→3; si los IDs verificados difieren, usar los verificados y anotarlo.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W1 |
| **Depends on** | none |
| **Blocks** | none (pero ejecutar antes del sync de US2) |
| **Files touched** | `.claude/settings.json` (sensitive) |
| **TDD-mode** | optional |
| **Estimate** | S |
| **Cómo arrancar** | Verificar IDs de modelo → editar fallbackModel |
| **Decisión absorbida** | — |

## User story

- **As a**: Oriol
- **I want**: que la degradación por sobrecarga caiga a los mejores modelos disponibles post-Fable
- **So that**: una saturación de Opus 4.8 no me deje en un modelo dos generaciones atrás

## Acceptance criteria

- **AC1**: Given settings.json, when se lee `fallbackModel`, then el cascade lidera con un ID verificado de la generación actual (spec AC4).
- **AC2**: Given el cambio, when corren las suites, then verdes; y la edición se declaró `sensitive:`.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/settings.json` | `fallbackModel` actualizado; claves stale relacionadas si aparecen |

## Workflow detallado

1. Verificar IDs (entorno/claude-api). 2. Declarar sensitive + editar. 3. Validar JSON + tests.

## Smell signals

- ⚠️ Tentación de tocar más claves "ya que estamos" → cambio mínimo (Cmd III).

## Verificación post-implementación

- JSON parse ✓, tests ✓, cascade con ID verificado.

## Commandments cubiertos

| # | Cómo |
|---|---|
| II | IDs verificados, no asumidos |
| VI | Declaración sensitive en settings |
