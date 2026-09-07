---
us: US2
title: Recordatorio pasivo de planes abiertos en post-compact.ts
wave: W1
depends_on: []
tdd_mode: optional
estimate: S
status: closed
---

# US2 — recordatorio de planes abiertos en post-compact.ts

## Execution prompt (Phase 3 input)

- **Task**: Añadir a `.claude/hooks/post-compact.ts` una sección opcional que, si hay planes con `feature_closed:false` bajo `.claude/plans/`, los mencione de forma no intrusiva en el output re-inyectado tras compactación.
- **Context**: `post-compact.ts` compone secciones (LEAD_REMINDER, ANTI_HALLUCINATION, getSessionMode) en `buildOutput()` (líneas 27-36). Es un hook **synced** (symlink a `~/.claude/`); `flow-state.ts` NO se sincroniza → **NO importar de flow-state.ts** (rompería en ~/.claude/). Reimplementar un scan mínimo inline (~8 líneas: readdir `.claude/plans`, leer state.json, filtrar feature_closed:false). Best-effort: si no hay `.claude/plans` o falla la lectura, devolver null y NO añadir sección (jamás romper el hook).
- **Constraints**: Solo informa, nunca bloquea (sin enforcement). Si 0 planes abiertos → sin sección (silencio). Hook debe seguir saliendo exit 0 siempre.
- **Deliverable**: `post-compact.ts` con `openPlansReminder(): string | null` integrado en buildOutput + caso de test en su `__tests__`.
- **Verify**: test del hook cubre "con planes abiertos → menciona" y "sin planes/error → null"; `bun test ./.claude/hooks/` green.
- **Ask-first**: nada — diseño cerrado.

## Quick reference

| Campo | Valor |
|---|---|
| Ficheros | `.claude/hooks/post-compact.ts` (mod), su test en `__tests__` (mod) |
| Función nueva | `openPlansReminder()` (scan inline, sin import externo) |
| TDD | optional (test post-impl) |
| Riesgo | bajo — sección best-effort, exit 0 garantizado |
| Verificación | hooks suite |

## User story

Como Oriol, quiero que tras una compactación el sistema me recuerde si dejé planes a medias, para no perderlos de vista sin que me bloquee.

## Acceptance criteria

- **AC1**: Given ≥1 plan con `feature_closed:false`, when corre post-compact, then el output incluye una sección que los lista (slug + fase).
- **AC2**: Given 0 planes abiertos o `.claude/plans` ausente, when corre, then NO añade sección y el hook sale exit 0 sin error.
- **AC3**: Given cualquier fallo de lectura, when corre, then degrada a null (best-effort) — nunca rompe la compactación.

## Files

| Fichero | Acción |
|---|---|
| `.claude/hooks/post-compact.ts` | Modificar: + openPlansReminder + integrar en buildOutput |
| `.claude/hooks/__tests__/post-compact*.test.ts` | Modificar/crear: casos abierto/vacío/error |

## Verificación post-implementación

- `bun test ./.claude/hooks/` → green incluyendo los nuevos casos.
- Smoke: con 025 abierto, `bun .claude/hooks/post-compact.ts` menciona el plan.

## Commandments cubiertos

| # | Cómo |
|---|---|
| III | Scan inline duplicado (8 líneas) > acoplar synced↔non-synced |
| VI | Best-effort, exit 0 siempre; nunca bloquea |
| IX | Recordatorio pasivo que reactiva la mitad trasera del lifecycle |
