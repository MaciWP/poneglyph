---
us: US4
title: sync TL;DR estilo en CLAUDE.md ↔ canon
wave: 2
depends_on: [US1]
tdd_mode: optional
estimate: S
status: draft
---

## Quick reference

| Campo | Valor |
|---|---|
| Files | `CLAUDE.md` (~línea 70, §Communication & Honesty Protocol) |
| Tipo | edit markdown (always-loaded global) |
| AC spec | AC4 |
| Dep | US1 (el canon debe estar final antes de sincronizar el puntero) |

## Execution prompt (Phase 3 input)

**Task**: Verificar que el TL;DR de estilo en `CLAUDE.md` §Communication & Honesty Protocol (línea ~70) está en sync con el canon `poneglyph.md` tras US1, y corregir cualquier drift. NO duplicar la spec: mantener referencia + TL;DR conciso.

**Context**: Research verificó que output-style (system prompt) y CLAUDE.md (user message) son capas ortogonales — el TL;DR NO compite, es un puntero de contexto de proyecto. El riesgo es drift de contenido, no de precedencia. El TL;DR actual ya nombra: es-ES, BLUF, no sycophancy, confidence labels con payload, structured disagreement, multi-round questioning, don't over-compress. Tras reforzar el trigger de labels en US1, comprobar que el TL;DR sigue siendo fiel (probablemente no necesita cambio, o solo una mención al trigger).

**Constraints**: NO copiar la spec completa (anti-duplicación, Commandment X). Edit mínimo o cero si ya está en sync. CLAUDE.md es global always-loaded — cada línea cuesta cada turno; no engordar.

**Deliverable**: O bien "verificado en sync, sin cambios" (documentado), o un edit mínimo que refleje el trigger de labels sin duplicar. La referencia a `output-styles/poneglyph.md` como canon se mantiene.

**Verify**: Contraste manual TL;DR ↔ §Confidence labels de poneglyph.md: ningún punto del TL;DR contradice el canon. `grep -c` de que sigue siendo referencia, no copia (no aparece la kill-list entera ni las tablas).

**Ask-first**: Si el sync exige >2 líneas nuevas en CLAUDE.md, parar y confirmar (coste always-loaded).

## Acceptance criteria

- **AC4.1**: Given TL;DR vs canon, when se contrasta, then o está en sync o el drift se corrigió.
- **AC4.2**: Given CLAUDE.md, when se inspecciona, then sigue siendo referencia+TL;DR, no duplica la spec.

## Commandments cubiertos
X (no duplicar, no rot), II (verificar antes de afirmar sync).
