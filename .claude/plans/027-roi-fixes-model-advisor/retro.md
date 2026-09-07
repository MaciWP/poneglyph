---
spec: 027-roi-fixes-model-advisor
phase: 5
retro_level: standard
verdict_phase4: APPROVED
spec_drift: none
promotions_proposed: 1
promotions_approved: 1
commandment_violations: 0
living_spec_delta: no
action_items: 3
created: 2026-07-07
status: approved
---

# Retro — 027-roi-fixes-model-advisor

## Summary

Problema: los 3 fallos mecánicos del análisis del proyecto (visibilidad de planes abiertos, sync-trap RI-1, deriva documental) + el routing modelo/effort como letra muerta. Entregado: hook SessionStart (red→green, registrado y verificado en el settings global), `scripts/` sincado con smoke cross-cwd, inventario convertido a snapshot+puntero, y skill-advisor extendido con la recomendación modelo/effort gated. Proceso fluido: 4 HUs en una sesión, 177 tests, APPROVED con 0 majors.

## Lessons

### ✅ Patterns that worked
- **Discovery que cambia el diseño**: encontrar el export existente de `openPlansReminder` convirtió US1 en un main de 20 líneas sin duplicación — el grep de 2 minutos ahorró una lib entera.
- **Matar la clase, no la instancia** (2ª vez esta semana): `scripts/` en LINK_FOLDERS mata RI-1 completa; números→punteros mata la deriva de conteos como categoría.
- **Proporcionalidad del reviewer**: aplicar la lección del retro 026 (inline + sesgo declarado para blast-radius bajo) ahorró ~300K tokens sin perder rigor — cada AC tenía check mecánico.

### ❌ Patterns that didn't work
- **El oracle contradecía un test existente y nadie lo vio hasta build**: T1.3 (aflorar ilegibles) chocaba con `post-compact.test.ts:51` que fijaba lo contrario ("illegible skipped"). tdd-design diseñó el oracle sin barrer los tests EXISTENTES que pinean el comportamiento del código compartido a tocar. Se resolvió limpio en build (el gate ya había ratificado el oracle), pero el conflicto debió aflorar en 2.5, no en 3.
- **files-field corto en US1**: `rules/paths/hooks.md` (docs-sync) no estaba en la tabla de ficheros y se tocó en build — desviación menor declarada; la regla docs-sync-same-HU debería reflejarse al PLANIFICAR los files, no solo al ejecutar.

## Process audit

| Phase | Effort | Friction | Improvement candidate |
|---|---|---|---|
| 1 scope | S (0 preguntas — ratificado en conversación) | ninguna | — |
| 2 tech-plan | S | files-field corto (❌ 2) | contar docs-sync al listar files |
| 2.5 tdd-design | S | conflicto oracle↔test existente no detectado (❌ 1) | **promotion abajo** |
| 3 build | M (la más pesada — 4 HUs) | ninguna real; el conflicto se absorbió | — |
| 4 critic | S (inline proporcional) | ninguna | — |

## Drillme — Phase 5

1. ¿Fase pesada de más? No — build cargó lo que tocaba. 2. ¿Fricción evitable? El conflicto oracle↔test (evitable con el barrido en 2.5). 3. ¿Patrón reusable? Sí: "oracle sobre comportamiento compartido → grep de tests que lo fijan". 4. ¿Scope? Global — es un edit de 1 línea a la skill tdd-design (aplica a todos los proyectos). 5. ¿Commandment violado en silencio? No — la única desviación (files-field) se declaró en el momento.

## Promotion candidates

| Candidate | Scope | Type | Why | Proposal |
|---|---|---|---|---|
| tdd-design: barrer tests existentes del comportamiento compartido | global | edit de skill (1-2 líneas) | ❌ 1: el oracle T1.3 contradecía un test pineado y solo se vio en build | En `tdd-design/SKILL.md` Step 4, añadir: "If the oracle changes behavior of EXISTING shared code, grep the existing test suite for tests pinning the current behavior — surface the conflict at 2.5, list the tests to update as part of the HU" |

Failure→eval: el conflicto oracle↔test no es gradeable determinista (juicio de diseño, no regex) — sin caso sintético, declarado.

## Living-spec

`spec_drift: none` — sin sección (entregado = spec).

## Commandments audit

10/10 ✅. Nota en I: el skip del fresh reviewer se declaró con motivo y mitigación en review.md (el fallback documentado del critic, no un bypass silencioso). Sin forensics.

## Action items

| Action | Owner | Trigger | Due |
|---|---|---|---|
| Validación conductual conjunta en la primera sesión post-Fable: recordatorio SessionStart visible (027/AC1) + rule model-uplift cargada (026/AC2) + comportamiento vs playbook (026/AC5) | user + Lead | primera sesión con Opus 4.8/Sonnet 5 | mañana |
| Commit del trabajo 027 (el árbol vuelve a tener trabajo sin persistir) | user (o Lead con OK) | ratificación | hoy |
| Aplicar promotion tdd-design si se ratifica | Lead | ratificación de este retro | esta sesión |
