---
spec: 024-poneglyph-style-review
tasks: tasks/
phase: 2.5
validation_mode: validation
test_policy: auxiliary
---

# Validations — US1, US3, US4, US5

## US1 — poneglyph.md: trigger labels + fix /explain

### Pre
- `poneglyph.md` 147 líneas, §Confidence labels presente (líneas 69-78), ref `/explain` en línea 138.

### Post
- Existe un disparador positivo de producción de labels (no solo definiciones).
- `/explain` → `/explain-changes` (o "explícame").

### Structural
- §Confidence labels conserva la tabla `[Probable]`/`[Suposición]` con payload.
- Ningún ejemplo borrado.

### Smoke
- `grep -ni "creo/quizás\|predicción\|inferencia\|lectura incompleta" poneglyph.md` → ≥1 hit.
- `grep -n "/explain\b" poneglyph.md` → 0 hits a `/explain` suelto.
- `wc -l poneglyph.md` → ≤153 (≤ +6).

### Cross
- El trigger no contradice §Cut filler (hedges→labels coherente).
- TL;DR de CLAUDE.md (US4) sigue fiel tras el cambio.

## US3 — casos calque en cases.jsonl

### Pre
- `cases.jsonl` 18 casos; `calqueDetect` ya existe (US2).

### Post
- ≥1 caso `grader:"calqueDetect"` con `source` real y trazable.

### Structural
- Caso válido JSON; campos `id`, `prompt`, `type`, `grader`, `source`; `trials:2`.

### Smoke
- `bun .claude/evals/run.ts cases.jsonl --offline <dir>` no lanza en `parseCases`.
- Total casos ≤ 50 (cap).

### Cross
- `source` cita 017 retro + poneglyph.md §Language (origen real).
- Sin near-miss duplicado de un caso existente.

## US4 — sync TL;DR CLAUDE.md

### Pre
- CLAUDE.md §Communication & Honesty Protocol (~línea 70) referencia el canon + TL;DR.

### Post
- TL;DR en sync con `poneglyph.md` tras US1, o drift corregido; documentado si "sin cambios".

### Structural
- Sigue siendo referencia + TL;DR; NO aparece la kill-list entera ni tablas copiadas.

### Smoke
- Contraste manual TL;DR ↔ §Confidence labels: ninguna contradicción.
- `grep -c "output-styles/poneglyph.md" CLAUDE.md` → ≥1 (referencia viva).

### Cross
- Coste always-loaded: crecimiento de CLAUDE.md ≤2 líneas (o 0).

## US5 — wiring skill-advisor en flow.md

### Pre
- `flow.md` §SIEMPRE rules tiene "Drillme wiring (020)" pero NO skill-advisor.

### Post
- Existe regla de skill-advisor en fronteras de fase, espejo del drillme.

### Structural
- Mantiene propone→ratifica (no auto-activa) + fallback manual `/skill-advisor`.

### Smoke
- `grep -n "skill-advisor" .claude/commands/flow.md` → hit en §SIEMPRE rules.
- `bun test ./.claude/hooks/` → verde.

### Cross
- No contradice CLAUDE.md §Skill routing ni memoria `goal-routes-skills-via-hook` (PROPONE, no inyecta).

## Drillme — Phase 2.5
1. `[failure]` Happy+edge: US2 tiene 2 happy + 3 edge; validaciones con 5 categorías. ✅
2. `[approach]` Untestable: 0 HUs sin oráculo (todas con smoke grep-checkable). ✅
3. `[approach]` Property-based: no aplica (phrase-match, no transform). ✅

Untestable rate: 0% (≪30%). Sin smells.
