---
spec: 027-roi-fixes-model-advisor
phase: 4
review_level: standard (4 HUs pequeñas, sin área crítica; Performance N/A en 3 de 4)
verdict: APPROVED
spec_drift: none
findings_count:
  blocker: 0
  major: 0
  minor: 1
  nit: 2
fresh_reviewer_invoked: no (inline + declared bias — lección retro 026: reservar el pase caro a blast-radius alto/autorretratos; diff pequeño, no-autoevaluativo, ACs con check mecánico ejecutado)
security_review_invoked: no (sin superficie auth/secretos; secrets-grep del diff limpio)
review_patterns_modes: []
created: 2026-07-07
---

# Review — 027-roi-fixes-model-advisor

## Correctness

- Problema del spec ↔ entregado ✅: los 3 fallos mecánicos atacados + selector cablequeado.
- Trazado de ACs:
  - **AC1** ✅ mecánica (4 tests red→green + smoke live con fixture emitiendo el recordatorio) — la mitad conductual (sesión real) queda en la próxima sesión, como el propio spec declara (no banqueada).
  - **AC2** ✅ `~/.claude/scripts` symlink + smoke cross-cwd desde `/tmp` resolviendo con error típado; 3 quals aplicadas (grep = 1 por fichero).
  - **AC3** ✅ grep de caducables → 0 sin puntero; filas absorben US1/US2 (hooks 8, scripts synced).
  - **AC4** ✅ estructural: paso gated en skill-advisor citando §4 sin duplicar la tabla; wiring en flow.md; contrato propose→ratify intacto.
  - **AC5** ✅ 177/177 en rama ensamblada, re-verificado tras el último cambio.
- **E2E crítico verificado**: el settings GLOBAL regenerado contiene la entrada SessionStart (el hook vive en la capa que realmente carga mañana).
- Red→green honrado en US1 (RED module-not-found documentado → GREEN 136→177).

## Quality

- Cobertura acorde a policy `auxiliary` con opt-in forced en US1 ✓. Estilo: el hook nuevo replica el patrón de post-compact (best-effort, guard, exports puros testables). Sin duplicación: el scan es compartido, no copiado (drillme Q2).

## Security

- Secrets-grep del diff: limpio. Sin superficie crítica.

## Performance

- N/A salvo el hook: coste por sesión ~1 readdir + N reads de state.json pequeños; silencioso en repos sin plans (early-return).

## Maintainability

- Comentarios solo de porqués (rationale del sync-trap en LINK_FOLDERS, rationale 027 en el hook). Sin TODOs. Docs-sync hecha en la misma HU (rules/paths/hooks.md + inventario).

## Findings

| # | Sev | Dónde | Detalle | Estado |
|---|---|---|---|---|
| 1 | MINOR | comportamiento compartido | `openPlansReminder` ahora aflora ilegibles también en post-compact — cambio mandado por el oracle T1.3 (coherencia con `flow-state status`), test viejo actualizado con comentario; se lista como finding por transparencia del cambio de contrato, no como defecto | aceptado por diseño |
| 2 | NIT | doble-fire en poneglyph | Sesiones DENTRO de este repo verán el recordatorio 2× (hook declarado en ambos niveles — clase double-fire ya documentada en inventario, generalizada a todos los hooks) | conocido, aceptado |
| 3 | NIT | repetición en resume/clear | SessionStart dispara también en resume/`/clear` → recordatorio repetido; aceptable (≤5 líneas, es la función del recordatorio) | aceptado |

## Spec drift

`none` — lo entregado coincide con el spec; la desviación de US1 (illegible-surfacing) era exigencia del oracle ratificado en gate 2→3, declarada en el cierre de la HU.

## Drillme — Phase 4

1. Drift → none. 2. E2E → trazado a mano: settings global ✓ + smoke live del hook ✓ + symlink cross-cwd ✓. 3. Edge que el usuario tocará → findings 2/3 (double-fire y repetición), ambos conocidos y de coste ≤5 líneas. 4. Coverage vs policy ✓.

## Verdict — APPROVED

0 blockers, 0 majors. Sesgo residual declarado por review inline (sin fresh reviewer — proporcionalidad post-026); mitigado porque cada AC se cerró con verificación mecánica ejecutada, no con juicio del autor.
