---
us: US5
title: cablear skill-advisor en fronteras de fase de /flow
wave: 1
depends_on: []
tdd_mode: optional
estimate: S
status: draft
---

## Quick reference

| Campo | Valor |
|---|---|
| Files | `.claude/commands/flow.md` |
| Tipo | edit markdown (command) |
| AC spec | AC6 |
| Origen | instrucción usuario 2026-06-23 |

## Execution prompt (Phase 3 input)

**Task**: Modificar `.claude/commands/flow.md` para que, además del `drillme` ya cableado, invoque (al menos) `skill-advisor` en las fronteras de fase. Espejar el patrón de la regla SIEMPRE de drillme (línea ~255 "Drillme wiring (020)").

**Context**: Hoy /flow cablea drillme en 3 puntos (Phase 1, gates 1→2 y 2→3) pero NO skill-advisor; resultado: la auto-activación de skills infra-dispara en fronteras de fase (es donde es más débil, research 2026-06-09) y el Lead arranca fases sin considerar las skills. La propia skill `skill-advisor` declara: "run at a /flow phase boundary". El usuario lo pidió explícito tras observar que yo salté skill-advisor en este mismo feature.

**Constraints**: Mínimo intrusivo: añadir una regla SIEMPRE espejo de la de drillme, no reescribir el flow. Mantener el principio de skill-advisor: PROPONE→ratifica vía AskUserQuestion, NO auto-activa (Commandment I). "Al menos" = como mínimo en las fronteras de fase (1→2, 2→3, y entrada a build/critic/retro); no forzar en cada turno trivial (ceremonia). Honrar que skill-to-skill es probabilístico → incluir el fallback manual `/skill-advisor "<contexto>"` como ya hace drillme.

**Deliverable**: Una nueva viñeta en §SIEMPRE rules tipo "**Skill-advisor wiring (024)**: en cada frontera de fase (1→2, 2→3, entrada a Phase 3/4/5), además del drillme, el Lead invoca `skill-advisor` para proponer→ratificar el shortlist de skills de la fase entrante. Propone, no auto-activa; si no auto-dispara, el Lead invoca `/skill-advisor` manualmente. 0 propuestas si ninguna skill aplica (sin ceremonia)." Opcional: una mención en el mermaid o en la tabla de adaptación por modo si encaja sin recargar.

**Verify**: `grep -n "skill-advisor" .claude/commands/flow.md` → hit en §SIEMPRE rules. `bun test ./.claude/hooks/` verde (markdown, sin impacto). Coherencia: no contradice la doctrina de skill routing de CLAUDE.md ni la memoria `goal-routes-skills-via-hook` (skill-advisor PROPONE, no inyecta).

**Ask-first**: Si encaja añadir skill-advisor también al mermaid del workflow (no solo a las reglas SIEMPRE) — confirmar para no recargar el diagrama.

## Acceptance criteria

- **AC6.1**: Given flow.md, when se lee §SIEMPRE rules, then skill-advisor está cableado en las fronteras de fase junto al drillme.
- **AC6.2**: Given el wiring, when se inspecciona, then mantiene propone→ratifica (no auto-activa) + fallback manual.
- **AC6.3**: Given el repo, when `bun test ./.claude/hooks/`, then verde.

## Commandments cubiertos
I (propone→ratifica), IX (backstop al undertrigger), X (espeja patrón existente, no inventa estructura).
