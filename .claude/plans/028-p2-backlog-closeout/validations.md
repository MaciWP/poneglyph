---
spec: 028-p2-backlog-closeout
tasks: tasks/index.md
phase: 2.5
validation_mode: validation
test_policy: auxiliary
---

# Validations — 028 (US1, US2, US5, US6-SK07/RI-3; US3/US4/US6-D6 en tests.md)

## US1 — rename security-audit

### Pre
- `.claude/skills/security-audit/` NO existe (verificado); lista de refs vivas en tasks/index §Research.

### Post
- Dir renombrado con `git mv`; frontmatter `name: security-audit`; refs vivas actualizadas.

### Structural assertions
- Superficie es-ES intacta (description/when_to_use/Keywords); solo cambia la identidad.
- `paths:` frontmatter (si existe) conservado.

### Smoke
- `grep -rn "security-review" CLAUDE.md .claude/skills .claude/commands .claude/rules .claude/docs .claude/settings.json | grep -v _archive | grep -v "audits/\|plans/\|examples/"` → 0.
- `bun test` verde (fixture rank.test.ts actualizado).

### Cross-validations
- critic Step 7 despacha `security-audit`; flow.md tabla full; aux-matrix y skill-matching coherentes.
- AC1-conductual (listado model-facing muestra la descripción propia) DIFERIDO a próxima sesión — declarar, no banquear.

## US2 — minimumVersion

### Pre
- `minimumVersion: "2.1.166"`; CC instalado 2.1.202 (≥ gate nuevo — sin lockout).

### Post / Structural
- `"2.1.198"` en settings; anotación en system-inventory con fuente (requiredMinimumVersion = managed, no supersede).

### Smoke
- JSON parse ok; suites verdes.

### Cross-validations
- La nota de CLAUDE.md:117 (Explore hereda modelo desde 2.1.198) queda ahora cubierta por el gate — coherencia cerrada (finding 10 del review 026).

## US5 — Skill(verify) cableado

### Pre
- La skill nativa `verify` existe en el harness (verificado en listado de sesión).

### Post / Structural
- CLAUDE.md §Post-implementation verification + critic Step 5 §Correctness mencionan `Skill(verify)` con su anti-trigger (no en diffs solo-tests/docs/markdown sin superficie de runtime).

### Smoke
- `grep -n "Skill(verify)\|skill .verify" CLAUDE.md .claude/skills/critic/SKILL.md` → ≥1 por fichero.

### Cross-validations
- No contradice la verificación manual existente (complementa, no sustituye — el test-command sigue siendo obligatorio).

## US6 — SK-07 + RI-3 (D6 en tests.md)

### Pre
- SK-07: `09-loops-analysis-source.md` sin fila en el content map (re-confirmado). RI-3: líneas :175/:409/:412 stale.

### Post / Structural
- Content map con fila para analysis-source (guía "read only when questioning the playbook's decisions").
- ultracode-audit.js: corpus sin `agent-memory/**`; defaults `decisionPlans`/`auditSlug` vivos o vacíos con nota.
- flow.md: `complete-phase` añadido a la línea del helper.

### Smoke
- `grep "09-loops-analysis-source" orchestrator-protocol/SKILL.md` → ≥1.
- `grep "agent-memory\|008-agent-spawn\|011-ultracode" workflows/ultracode-audit.js` → 0 (o solo en comentarios históricos justificados).

### Cross-validations
- La fila nueva del content map no contradice la existente del playbook (dos filas, dos propósitos).
