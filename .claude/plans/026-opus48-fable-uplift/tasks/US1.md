---
us: US1
title: Playbook model-uplift — destilación Fable con evidencia + anti-fallos + guía dual Opus 4.8/Sonnet 5
wave: W1
depends_on: []
tdd_mode: optional
estimate: M
status: closed
closed: 2026-07-07
---

# US1 — Playbook `docs/model-uplift-playbook.md`

## Execution prompt (Phase 3 input)

**Task**: Escribir `.claude/docs/model-uplift-playbook.md` — la destilación completa del comportamiento Fable 5 que Opus 4.8/Sonnet 5 deben ejecutar por instrucción.
**Context**: Corpus de evidencia: auditorías `.claude/audits/2026-06-30-*.md` y `2026-07-02-*.md` (refuters adversariales, reproducción en vivo del guard `close-feature`, degradación honesta de SK-07 a dudoso, verificación contra changelog, spot-checks de números); memoria persistente (anti-fallos ya documentados: confidence labels, calques, sobre-compresión, agreement bias, fix-la-clase); changelog CC en sesión (Explore hereda modelo 2.1.198, Sonnet 5 1M default 2.1.197, effort xhigh, fast mode). El autor ES Fable hoy: introspección de primera mano, irrepetible mañana.
**Constraints**: Inglés (cuerpo de doc del repo). SOLO deltas — nada que CLAUDE.md/output-style/skills ya exijan (filtro spec-AC3: cada patrón cita qué hace Fable nativo que la doctrina NO pide explícitamente). Cada patrón lleva evidencia concreta (sesión/auditoría/ejemplo), no genérica. Reglas ejecutables en generación (ejemplos/anchors, no umbrales de conteo — memoria `rules-must-be-generation-executable`). Abrir con expectativas honestas: esto recupera disciplina, no capacidad bruta.
**Deliverable**: Un solo fichero con secciones: (1) Honest expectations; (2) Behavioral deltas — catálogo patrón/cuándo/evidencia/anti-fallo-que-previene; (3) Known failure modes of smaller models (desde memoria + experiencia); (4) Harness levers per model — tabla Opus 4.8 vs Sonnet 5 (effort, thinking, fast mode, 1M contexto, cuándo elegir cada uno); (5) Load & verify — cómo comprobar la carga (`instructions-loaded.log`).
**Verify**: Lectura humana en gate (cada patrón con evidencia trazable — spec AC3); `bun test ./.claude/hooks/` verde (no toca código); el fichero queda en docs/ (capa synced).
**Ask first**: nada — decisiones bloqueadas en spec/plan.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W1 |
| **Depends on** | none |
| **Blocks** | [US2] |
| **Files touched** | `.claude/docs/model-uplift-playbook.md` (nuevo) |
| **TDD-mode** | optional |
| **Estimate** | M |
| **Cómo arrancar** | Redactar §Honest expectations y el catálogo de deltas desde la evidencia citada en Context |
| **Decisión absorbida** | — |

## User story

- **As a**: Oriol trabajando con Opus 4.8/Sonnet 5 desde mañana
- **I want**: el catálogo profundo de disciplinas Fable con su evidencia y las palancas por modelo
- **So that**: el Lead post-Fable pueda consultarlo on-demand y comportarse lo más cerca posible de Fable

## Acceptance criteria

- **AC1**: Given el playbook, when se lee cualquier patrón, then incluye cuándo aplica + evidencia concreta (auditoría/sesión/memoria) + qué fallo de modelo menor previene (spec AC3).
- **AC2**: Given la doctrina existente, when se compara patrón a patrón, then ninguno duplica una exigencia ya escrita en CLAUDE.md/output-style (filtro solo-deltas).
- **AC3**: Given la tabla de harness, when se consulta para una tarea (review profunda / bulk edit / contexto masivo), then da elección de modelo + effort + thinking concreta y accionable.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/docs/model-uplift-playbook.md` | Nuevo — destilación completa (5 secciones del Deliverable) |

## Workflow detallado

1. Redactar §1 expectativas honestas (calibración anti-decepción).
2. Introspección + corpus → catálogo de deltas (§2), cada uno con evidencia y anti-fallo.
3. §3 anti-fallos conocidos desde memoria persistente + experiencia de sesiones.
4. §4 tabla harness dual con datos del changelog verificados.
5. §5 verificación de carga.

## Smell signals

- ⚠️ Un patrón sin evidencia concreta → o se encuentra la evidencia o se corta (no aspiracional).
- ⚠️ El playbook repite doctrina existente → viola el filtro solo-deltas; recortar.

## Verificación post-implementación

- Lectura del gate humano contra AC1-AC3.
- `bun test ./.claude/hooks/` sigue verde.

## Commandments cubiertos

| # | Cómo |
|---|---|
| I/II | Cada patrón con evidencia verificable; expectativas sin edulcorar |
| III | Solo deltas — nada redundante con la doctrina viva |
| IX | Captura de aprendizaje en la ventana en que aún existe |
