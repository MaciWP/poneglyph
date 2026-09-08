---
spec: {NNN}-{slug}
closed_at: {ISO-date}
mode_used: minimal|standard|full
phase: 5
status: draft
---

# Retro — <feature>

## Resumen

<1-2 párrafos. Qué se hizo, cómo salió, resultado final.>

## Lecciones técnicas

- ✅ **Funcionó**: <patrón> — <por qué funcionó>
- ❌ **No funcionó**: <patrón> — <por qué falló>

## Proceso

- **Fase que pesó más**: <fase> — <razón>
- **Fricción evitable**: <descripción de la fricción y cómo evitarla>
- **Drillme útil**: <fase + en qué momento aportó>

## Drillme — Phase 5 (Socratic check)

Las 5 preguntas obligatorias, etiquetadas con las 4 categorías canónicas del Socratic Prompt Method (Jaseci Labs 2026):

1. `[approach]` ¿Qué fase pesó más de lo necesario? — ¿el enfoque elegido fue el adecuado o sobre-ingeniería?
2. `[failure]` ¿Hubo fricción evitable? — modo de fallo del proceso mismo
3. `[context]` ¿Surgió un patrón reusable más allá de esta tarea? — descubrimiento de contexto generalizable
4. `[location]` ¿Promovible a `~/.claude/` global o solo a este proyecto? — dónde vive el conocimiento
5. `[failure]` ¿Algún Commandment violado en el camino sin que se note? — fallo silencioso de invariantes

## Promociones candidatas

| Candidate | Scope (global/local/memory) | Tipo (skill/rule/hook/command) | Razón | Propuesta concreta (path + diff) |
|---|---|---|---|---|
| <nombre> | global\|local\|memory | skill\|rule\|hook\|command | <por qué aporta> | `<path>` — <diff o descripción> |

## Living-spec deltas (si aplica)

> Solo si la implementación reveló que spec.md debe actualizarse. NO edita spec.md automáticamente — propuesta para aprobación.

- **Sección afectada**: <sección de spec.md>
- **Diff propuesto**: <qué cambiaría>
- **Razón**: <por qué el delta es legítimo>

## Commandments check

| # | Cumplido en esta tarea? | Notas |
|---|---|---|
| III | ✅ / ❌ / N/A | <observación honesta> |
| II | ✅ / ❌ / N/A | <observación honesta> |
| V | ✅ / ❌ / N/A | <observación honesta> |
| IV | ✅ / ❌ / N/A | <observación honesta> |
| I | ✅ / ❌ / N/A | <observación honesta> |
| VI | ✅ / ❌ / N/A | <observación honesta> |
| X | ✅ / ❌ / N/A | <observación honesta> |
| VIII | ✅ / ❌ / N/A | <observación honesta> |
| VII | ✅ / ❌ / N/A | <observación honesta> |
| IX | ✅ / ❌ / N/A | <observación honesta> |

## Action items

- [ ] <item concreto> — Owner: usuario | Lead | sesión futura

## Feature closure gate

- [ ] Every HU has verified closure in state.json; pending HUs keep the feature open
- [ ] The approving review checks the assembled result against every requirement
- [ ] Retro decisions are ratified, or a justified skip is recorded
- [ ] Run retro-status approved and close-feature only after those conditions hold
- [ ] State and document statuses agree; sync-artifacts repairs stale projections
- [ ] Never close unfinished HUs residually or infer permission from a document
- [ ] Publication follows its separate authorization; closure does not request a commit
