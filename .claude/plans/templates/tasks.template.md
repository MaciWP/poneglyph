---
us: US{N}
title: <título descriptivo ≤80 chars>
wave: W{N}
depends_on: [US{ids}]
tdd_mode: forced|optional|skip
estimate: S|M|L
status: draft
approved: <ISO-date cuando el hard gate 2→3 se cierra; omitir mientras draft>
absorbs_decision: <nombre>   # opcional — solo si la HU absorbe una decisión cross-cutting
---

# US{N} — <título>

## Execution prompt (Phase 3 input)

> The US is consumed by `build` (the Lead executes it inline). Write this block as a self-contained, high-quality prompt — Commandment VIII applies to the plan itself.

**Task**: <one imperative sentence — the exact change>
**Context**: <files, prior state, evidence the executor needs — paths verified>
**Constraints**: <locked decisions, what NOT to touch, language/style rules>
**Deliverable**: <exact artifacts/edits expected>
**Verify**: <mechanical checks that prove done>
**Ask first**: <AskUserQuestion moments, or "nothing — decisions locked">

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft / 🟢 approved / 🔵 implementing / ✅ closed / 🔴 blocked |
| **Wave** | W{N} |
| **Depends on** | [US{ids}] o `none` |
| **Blocks** | [US{ids}] (qué HUs me están esperando) |
| **Files touched** | <resumen 1 línea — paths exactos> |
| **TDD-mode** | forced \| optional \| skip:<reason> |
| **Estimate** | S \| M \| L |
| **Cómo arrancar** | <1-2 líneas literales del paso 1 del workflow> |
| **Decisión absorbida** | <si aplica, ej. "decide CUT planner-protocol"> o `—` |

## User story

- **As a**: <role>
- **I want**: <action>
- **So that**: <benefit>

## Acceptance criteria

- **AC1**: Given <state>, when <action>, then <outcome>.
- **AC2**: Given <state>, when <action>, then <outcome>.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `<path>` | <descripción breve> |

## Workflow detallado

1. <Paso 1>
2. <Paso 2>
3. <Paso 3>

## Drillme (Socratic check)

> Solo si la HU requiere razonamiento socrático antes de cerrar (decisiones no triviales, edge cases sutiles, multi-criterio). Omitir si el AC ya cierra la duda.
>
> Alinear las preguntas con las **4 categorías canónicas** del Socratic Prompt Method (Jaseci Labs 2026): cubrir idealmente al menos una por categoría. Etiqueta cada pregunta con su categoría entre corchetes.

| Categoría | Propósito |
|---|---|
| `[location]` | Challenge location — ¿es el sitio correcto para esto? |
| `[approach]` | Challenge approach — ¿por qué este patrón y no otro? |
| `[context]` | Introduce context — ¿cómo interactúa con X? ¿qué dependencias tiene? |
| `[failure]` | Probe failure modes — ¿qué pasa si <edge case>? |

1. `[location]` <pregunta sobre dónde / en qué archivo o componente>
2. `[approach]` <pregunta sobre por qué este patrón y no la alternativa>
3. `[context]` <pregunta sobre dependencias o interacciones>
4. `[failure]` <pregunta sobre edge case o modo de fallo>

## SIEMPRE rules implementadas

> Solo si la HU es una skill. Omitir en caso contrario.

- <Regla invariante que la skill siempre ejecuta>

## Commandments cubiertos

| # | Cómo |
|---|---|
| <N> | <cómo este trabajo lo honra> |

## Reutiliza

> Solo si hay skills/agents/scripts existentes reutilizados. Omitir en caso contrario.

- `<skill-name>` — <para qué>

## Adaptación intra-fase

> Solo si hay señales que modifican el flujo. Omitir en caso contrario.

| Señal | Adaptación |
|---|---|
| <condición detectada> | <qué se hace diferente> |

## Casos edge

> Solo si hay edge cases conocidos. Omitir en caso contrario.

- Edge 1: <descripción>

## Smell signals

- ⚠️ <cuándo esta HU se vuelve no-atómica>

## Verificación post-implementación

- Smoke: <verificación ejecutable>
- `bun test ./.claude/hooks/` sigue green (si aplica).

## Open questions (a resolver en implementación)

- <gap o duda — puede estar vacío>
