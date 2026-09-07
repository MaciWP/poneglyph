---
us: US4
title: skill-advisor propone modelo/effort desde playbook §4 (propose→ratify, gated "solo si difiere")
wave: W1
depends_on: []
tdd_mode: optional
estimate: S
status: closed
closed: 2026-07-07
---

# US4 — Extensión skill-advisor: recomendación modelo/effort

## Execution prompt (Phase 3 input)

**Task**: Extender `.claude/skills/skill-advisor/SKILL.md` (§Workflow) con un paso de recomendación modelo/effort, y añadir una frase a la línea de wiring de skill-advisor en `commands/flow.md`.
**Context**: skill-advisor ya corre en fronteras de fase de /flow y propone vía AskUserQuestion. Fuente única de criterio: `.claude/docs/model-uplift-playbook.md` §4 (tabla task→model/effort). El Lead NO puede cambiar el modelo (`/model` es del usuario) ni el effort de sesión (`/effort`): la recomendación es siempre propose→ratify.
**Constraints**: Gated anti-ceremonia: la recomendación solo aparece cuando difiere del estado actual de la sesión (modelo activo/effort visible al Lead por contexto de sesión); si coincide, CERO menciones. No duplicar la tabla §4 en la skill — referenciarla (Read on demand). Superficie de activación es-ES si se toca frontmatter; cuerpo inglés. Sin tocar el contrato existente (propone, nunca fuerza).
**Deliverable**: paso nuevo en §Workflow (≤10 líneas) + nota en SIEMPRE rules de la skill + 1 frase en flow.md (wiring 024) mencionando que la propuesta puede incluir modelo/effort.
**Verify**: lectura contra AC4 del spec (recomendación citando §4 cuando difiere; 0 cuando no); `bun test` verde (markdown); grep de que la tabla §4 NO está duplicada.
**Ask first**: nada — diseño ratificado en gate.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W1 |
| **Depends on** | none |
| **Blocks** | none |
| **Files touched** | `skills/skill-advisor/SKILL.md`, `commands/flow.md` |
| **TDD-mode** | optional |
| **Estimate** | S |
| **Cómo arrancar** | Leer §Workflow de skill-advisor → insertar paso gated |
| **Decisión absorbida** | extender skill-advisor, no skill/drillme nuevo (Cmd X) |

## User story

- **As a**: Oriol decidiendo con qué modelo/effort atacar una tarea
- **I want**: que el criterio del playbook §4 se me proponga en el momento de decidir
- **So that**: el routing deje de ser letra muerta y el coste se calibre por tarea

## Acceptance criteria

- **AC1**: Given una tarea cuyo routing §4 difiere del estado de sesión, when skill-advisor corre, then la propuesta incluye modelo/effort con cita a §4 (spec AC4).
- **AC2**: Given que coincide, then 0 menciones (anti-ceremonia).
- **AC3**: Given la skill extendida, then la tabla §4 no está duplicada (referencia, no copia).

## Files a crear / a modificar

| Path | Cambio |
|---|---|
| `.claude/skills/skill-advisor/SKILL.md` | Paso modelo/effort gated en §Workflow |
| `.claude/commands/flow.md` | 1 frase en el wiring de skill-advisor |

## Verificación post-implementación

- Lectura AC1-3; suites verdes; sin duplicación de tabla.

## Commandments cubiertos

| # | Cómo |
|---|---|
| I | Propone, el humano ratifica — nunca auto-switch |
| VII | El routing barato deja de depender de memoria del Lead |
| X | Un solo dueño del criterio (playbook §4) |
