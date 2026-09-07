---
spec: 026-opus48-fable-uplift
tasks: tasks/index.md
phase: 2.5
validation_mode: validation
test_policy: auxiliary
---

# Validations — 026-opus48-fable-uplift

Clasificación: US1/US2/US4 = markdown, US3 = config JSON → **4/4 validation-mode**; `tests.md` omitido (TDD sobre markdown = ceremonia). 0 HUs untestables.

## US1 — Playbook `docs/model-uplift-playbook.md`

### Pre
- No existe `.claude/docs/model-uplift-playbook.md` (verificado en discovery — anti-duplicado).
- Corpus de evidencia accesible: auditorías 06-30 y 07-02, MEMORY.md, changelog en sesión.

### Post
- El fichero existe en `.claude/docs/` con las 5 secciones del Deliverable.

### Structural assertions
- Secciones presentes: Honest expectations · Behavioral deltas · Known failure modes · Harness levers per model · Load & verify.
- Cada patrón de §Behavioral deltas lleva: cuándo aplica + evidencia concreta citada + anti-fallo que previene (spec AC3).
- Tabla dual Opus 4.8 / Sonnet 5 en §Harness levers.

### Smoke
- `Glob .claude/docs/model-uplift-playbook.md` → 1 hit.
- `grep -c "evidence\|Evidencia\|Evidence" <playbook>` ≥ nº de patrones (proxy de trazabilidad; el juicio fino es lectura humana del gate).

### Cross-validations
- Ningún patrón duplica una exigencia literal de CLAUDE.md/output-style (filtro solo-deltas — revisión de lectura).
- El playbook NO se cita a sí mismo como always-loaded (la carga garantizada es de US2).

## US2 — Rule núcleo `rules/model-uplift.md`

### Pre
- US1 cerrada (el núcleo cita anclas del playbook).
- `~/.claude/rules/` existe con links per-entry (test-policy.md excluida — 021).

### Post
- Rule escrita y symlink global creado tras re-sync.

### Structural assertions
- Contenido ≤ ~25 líneas; pointer explícito a `docs/model-uplift-playbook.md`.
- Sin frontmatter `paths:` (aplica siempre); directivas en forma delta + ejecutable-en-generación (anchors/ejemplos, no umbrales de conteo).

### Smoke
- `wc -l .claude/rules/model-uplift.md` ≤ ~28 (25 contenido + margen frontmatter/título).
- `ls -la ~/.claude/rules/model-uplift.md` → symlink al repo.
- `bun .claude/evals/run.ts` (parte offline) → 0 regresiones (spec AC1); si el modo live no cabe en sandbox, declararlo (memoria `live-evals-impractical-in-session`).
- `bun test ./.claude/hooks/ ./.claude/scripts/ ./.claude/commands/ ./.claude/evals/` verde.

### Cross-validations
- El núcleo no repite líneas del playbook verbatim (condensación, no copia).
- spec AC2 (aparición en `instructions-loaded.log`) queda DIFERIDA a la próxima sesión — anotar en retro, no banquear (memoria `behavioral-ac-next-session`).

## US3 — Harness `settings.json`

### Pre
- `settings.json:5` = `["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]` (stale, CG-11).
- IDs de la generación actual verificados ANTES de editar (entorno/claude-api — open question 1).

### Post
- `fallbackModel` lidera con ID verificado de la generación actual.

### Structural assertions
- Edición mínima: diff toca solo las claves justificadas.
- Declaración `sensitive:` emitida antes del edit (Cmd VI).

### Smoke
- `bun -e 'JSON.parse(require("fs").readFileSync(".claude/settings.json","utf8")); console.log("ok")'` → ok.
- Suites verdes.

### Cross-validations
- La guía de elección de modelo/effort vive en el playbook (US1 §4), NO duplicada en settings (settings = mecánica, playbook = criterio).
- El sync de US2 regenera el settings global DESPUÉS de este cambio (orden W1→W2 lo garantiza).

## US4 — Delta doctrina

### Pre
- `CLAUDE.md:117` contiene "Explore\` (Haiku built-in)" (verificado en discovery).

### Post
- La afirmación corregida (Explore hereda el modelo de sesión, CC 2.1.198); sweep completado.

### Structural assertions
- Cambio quirúrgico: el diff de CLAUDE.md toca solo la celda afectada.
- Menciones históricas (audits/retros/memorias) intactas.

### Smoke
- `grep -rn "Haiku built-in" CLAUDE.md .claude/skills .claude/commands .claude/docs .claude/rules` → 0 hits vivos.
- Suites verdes.

### Cross-validations
- Reporte del sweep en el cierre de la HU: cada hit corregido o justificado como histórico (AC2 de la HU).
