---
id: {NNN}-{slug}
created: {ISO-date}
approved: <ISO-date cuando el hard gate 1→2 se cierra; omitir mientras draft>
mode: minimal|standard|full
phase: 1
status: draft
---

# Problema

<Una frase clara. ¿Qué duele realmente? Síntoma vs problema raíz — escribe el raíz. ≤3 líneas.>

# Resultado esperado

- <Outcome medible 1 — qué cambia para el usuario / sistema>
- <Outcome medible 2>
- <Outcome medible 3 — máx 4 bullets; outcomes, no features>

# Success criteria (medibles, Given/When/Then)

- **AC1**: Given <state>, when <action>, then <outcome verificable>.
- **AC2**: Given <state>, when <action>, then <outcome verificable>.
- **AC3**: Given <state>, when <action>, then <outcome verificable>.

> Mínimo 3 ACs en modo standard/full. Cada AC debe ser verificable mecánicamente o por lectura humana, no aspiracional.

# Out of scope (explícito)

- <Lo que NO se implementa en este feature — cierra la puerta a scope creep>
- <Decisión diferida o entregable de otro sprint>

# Constraints

> Omitir sección si no aplica. Incluir si hay restricciones reales del stack, tiempo, compatibilidad, o regresión.

- <Técnico>: <ej. "Bun + TypeScript; no toca runtime code">
- <Temporal>: <ej. "antes del freeze del 2026-06-15">
- <Compatibilidad>: <ej. "bun test ./.claude/hooks/ debe seguir green">

# Stakeholders

> Omitir sección si solo hay un stakeholder obvio. Incluir cuando hay >1 perspectiva o el dueño de la decisión no es el ejecutor.

- **<rol>** — <sufre el problema / decide el gate / valida el outcome>

# Open questions

> Mantener sección incluso vacía: visibiliza los gaps en lugar de ocultarlos. Cerrar gaps con decisiones explícitas antes del hard gate 1→2.

- <Gap 1 — preferible documentarlo a inventar respuesta>
- <Gap 2>

# Modelo conceptual / Detalle técnico

> Sección opcional. Incluir en modo `full` cuando el feature requiere un modelo conceptual antes de descomponer en HUs (Fase 2). Ejemplo: principios transversales, glosario, decisiones arquitectónicas pre-tasks.
