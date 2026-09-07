---
spec: 028-p2-backlog-closeout
phase: 4
review_level: standard (6 HUs acotadas; hooks = blast alto pero cada cambio con red→green + pinned preservado)
verdict: APPROVED_WITH_WARNINGS
spec_drift: none
findings_count:
  blocker: 0
  major: 0
  minor: 2
  nit: 1
fresh_reviewer_invoked: no (inline + declared bias — proporcionalidad post-026/027; cada AC con check mecánico ejecutado; el riesgo residual real se lista como warning conductual)
security_review_invoked: no (el diff toca el NOMBRE del skill de seguridad, no lógica de auth/secretos; secrets-grep limpio)
review_patterns_modes: []
created: 2026-07-08
---

# Review — 028-p2-backlog-closeout

## Correctness

- ACs: **AC1** ✅ mecánica (grep 0 refs vivas al nombre viejo salvo la fila native-built-in etiquetada; `~/.claude/skills/security-audit` simlinkado, viejo ausente) — la mitad model-facing YA se observó en esta sesión (el listado del harness muestra al critic diciendo "dispara security-audit"); **AC2** ✅ (2.1.198 en repo Y en global regenerado; anotación con fuente); **AC3** ✅ red→green (3 clases de ruido filtradas + pinned T3.4 verde + gitignore en onboard + split documentado); **AC4** ✅ red→green (dual-channel, docs-sync en hooks.md); **AC5** ✅ (grep en ambos ficheros con anti-trigger); **AC6** ✅ (SK-07 fila, complete-phase red→green + CLI docs, RI-3 grep limpio).
- Suites: ✅ 188/188 en rama ensamblada. Sync re-ejecutado: 13/13 folders.

## Quality / Security / Maintainability

- Estilo consistente (subcomando calcado al patrón del switch; filtros con comentarios de porqué + provenance). Secrets-grep del diff: limpio. Docs-sync misma-HU cumplida (hooks.md, inventory, flow.md).

## Findings

| # | Sev | Detalle | Estado |
|---|---|---|---|
| 1 | MINOR | **Riesgo de sobre-filtrado en learning-inbox** (el inverso de D7): tres filtros nuevos apilados (floor + RAW_TRANSCRIPT + REVIEW_PROSE) podrían descartar learnings legítimas; el pinned solo cubre user-correction. No verificable offline | ⚠️ standing — validación conductual: vigilar inbox.md en próximas sesiones reales |
| 2 | MINOR | Sobre-rename detectado y corregido EN build: la fila "(plugin)" de aux-matrix refería al `security-review` NATIVO y el sweep la renombró; revertida con etiqueta explícita | ✅ fixed in-cycle |
| 3 | NIT | El sed inicial del sweep falló entero por semántica zsh (`$VAR` sin word-split) — detectado por la verificación inmediata (name: sin cambiar), 0 daño | ✅ resuelto; lección a retro |

## Spec drift

`none` — entregado = spec (trials fuera, como se pactó en gate 1→2).

## Drillme — Phase 4

1. Drift → none. 2. E2E → sync + global gate + symlink + prueba model-facing en vivo del rename. 3. Edge real → finding 1 (sobre-filtrado), capturado como warning con dueño. 4. Coverage → auxiliary con forced honrado (3 red→green documentados).

## Verdict — APPROVED_WITH_WARNINGS

0 blockers/majors; warning vigente único: sobre-filtrado potencial de learning-inbox (conductual, no medible offline — se valida con uso real).
