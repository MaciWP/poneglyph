---
us: US7
title: Despliegue del advisor modelo/effort fuera de /flow (cerrar el gap de 027)
wave: WC
depends_on: []
tdd_mode: forced
estimate: M
status: closed
closed: 2026-08-05
result: Red→green (3 tests, 158/158). Canal elegido — extensión de analyzePayload en skill-activation (opción a de la US, la propuesta locked). detectRoutingShape con patrones conservadores — bulk/mecánico → "/model sonnet + /effort low", consulta rápida → "/effort low" — SIEMPRE marcado "shape-only suggestion, session state unknown" (AC3: sin fake state awareness) y citando playbook §4 (dueño único del criterio, Cmd IX). Cero menciones en prompts normales (AC4 de 027 heredado ✓). Contrato 027 intacto — propone, nunca cambia; el usuario ejecuta /model / /effort.
---

# US7 — Advisor modelo/effort: del pipeline al turno default

## Execution prompt (Phase 3 input)

**Task**: Make the 027 model/effort routing recommendation fire where the friction actually is: ad-hoc turns in work repos, not only /flow phase boundaries.
**Context**: Evidence: 47 manual /model+/effort events in 20 backend sessions + 13 in 7 meta sessions — the highest-frequency friction in the whole analysis. 027 delivered the recommendation inside `skill-advisor` gated to "solo si difiere del estado actual", propose→ratify, wired at /flow phase boundaries (verified in 027 spec/retro). But /flow has 0 uses in work-repo feature sessions → the advisor never fires there. The user himself proposed this ("un drillme para elegir el modelo y el effort… en base a la tarea"). Routing criteria live in model-uplift playbook §4 (do not duplicate — point to it). Candidate channels (open question 3 del index): (a) extend `skill-activation.ts` UserPromptSubmit — inject a routing hint when task-shape keywords match (bulk sweep, quick lookup, deep debug, migración masiva) AND the recommendation differs from session state; (b) SessionStart hint by repo type. 
**Constraints**: Keep 027's contract intact: propose, NEVER auto-switch (impossible for /model anyway); 0 noise when nothing differs (anti-ceremony AC of 027 still holds); the hint must carry the WHY in one line (citing playbook §4 rationale). Hook logic change → tdd forced (red→green). Caveat the heuristic limitation honestly: the hook cannot read session model state — if state is unavailable, the hint degrades to task-shape-only suggestion, marked as such (design this fallback explicitly, don't fake state awareness).
**Deliverable**: `skill-activation.ts` extension (or sibling hook if cleaner — decide against its architecture) + tests; 1-line pointer in skill-advisor SKILL.md noting the new channel (single owner of routing content stays playbook §4).
**Verify**: `bun test ./.claude/hooks/` green with new cases (bulk-sweep prompt → hint; hint absent when no shape matches; no duplicate hints).
**Ask first**: channel choice (a) vs (b) if implementation reveals a blocker; otherwise (a) is the locked proposal.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W1 |
| **Depends on** | none |
| **Blocks** | none |
| **Files touched** | `.claude/hooks/skill-activation.ts` (+ test) · `.claude/skills/skill-advisor/SKILL.md` (1 línea) |
| **TDD-mode** | forced — lógica de hook nueva |
| **Estimate** | M |
| **Cómo arrancar** | Leer skill-activation.ts + el AC4 de 027 (gating "solo si difiere") |

## User story

- **As a**: Oriol
- **I want**: que la recomendación de modelo/effort me llegue en el momento de la tarea, en cualquier repo
- **So that**: dejo de togglear /model y /effort a mano decenas de veces por semana

## Acceptance criteria

- **AC1**: Given a prompt with bulk/mechanical shape ("barre todos los ficheros…"), when the hook fires, then a one-line routing hint appears citing playbook §4 rationale.
- **AC2**: Given a prompt with no distinctive shape, when the hook fires, then zero routing mentions (anti-ceremonia, hereda AC4 de 027).
- **AC3**: Given session state unavailable, when a hint fires, then it is marked as shape-only suggestion (no fake state awareness).
- **AC4**: Red→green tests cover the three cases above.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/hooks/skill-activation.ts` | Extensión routing-hint — `sensitive: hook global UserPromptSubmit` |
| `.claude/hooks/__tests__/skill-activation.test.ts` | Casos red→green |
| `.claude/skills/skill-advisor/SKILL.md` | 1 línea: canal nuevo, contenido sigue en playbook §4 |

## Commandments cubiertos

| # | Cómo |
|---|---|
| X | Routing correcto de modelo/effort = eficiencia directa de tokens/coste |
| IX | No duplica el criterio (playbook §4 único dueño); cierra el gap de despliegue de 027 |

## Smell signals

- ⚠️ Si el hint aparece en >20% de prompts → la heurística de forma está sobre-disparando; recalibrar keywords.

## Verificación post-implementación

- `bun test ./.claude/hooks/` green.
- Smoke: prompt bulk real → hint 1 línea; prompt normal → silencio.
