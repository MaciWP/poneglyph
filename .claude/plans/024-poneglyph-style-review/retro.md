---
spec: 024-poneglyph-style-review
closed_at: 2026-06-23
mode_used: full
phase: 5
status: approved
verdict_phase4: APPROVED
spec_drift: legitimate
promotions_proposed: 2
commandment_violations: 0
living_spec_delta: yes (AC6+AC7 ya en spec)
---

# Retro — revisión del estilo Poneglyph (024)

## Resumen

Problema: el estilo se aplica desigual. Reframe clave (advisor): no es carga (verificado activo) sino spec+cobertura. Entregado: trigger positivo de confidence labels (prioridad usuario), grader `calqueDetect` red→green cerrando el gap nº1 de cobertura (calques, motivo raíz de 017), caso eval calque-19, sync del TL;DR de CLAUDE.md, y wiring de `skill-advisor` en `/flow`. evals 17/17, hooks 125/125. Validación live: <pendiente>.

## Lecciones técnicas

### ✅ Funcionó
- **Diagnóstico-antes-de-diseñar (advisor)**: evitó construir un "enforcement de prosa" imposible (ningún hook ve mi texto). El lever real = spec + cobertura.
- **Descubrir el oráculo existente (019)**: el feature no era greenfield; había suite de evals. "Pulir > añadir": un grader nuevo, no un sistema.
- **red→green real en US2**: vi el rojo (export ausente) antes de implementar.
- **Anti-filler honrado**: 1 caso calque, no 2; gaps no-cubribles declarados, no inflados con graders frágiles.

### ❌ Fricción / a vigilar
- **Salté skill-advisor al inicio** — el usuario lo corrigió. Memoria `feedback-use-named-tools` aplicaba y no la honré. De ahí nació la HU US5 (cablearlo en /flow).
- **Baseline live contaminado**: lancé el baseline antes de los edits; los subprocesos leen estilo de disco al spawnear → primeros casos viejo, resto nuevo. Lección: en evals live, correr baseline ANTES de cualquier edit, o asumir que es run post.
- **El fix de labels es apuesta, no fix validado**: la causa de la infrautilización podría ser de generación, no de wording. Valida próxima sesión.

## Promociones candidatas

| Candidate | Scope | Tipo | Propuesta |
|---|---|---|---|
| feedback sobre baseline-antes-de-editar en evals live | memory | feedback | "Al validar con evals live, corre el baseline ANTES de tocar ficheros: los subprocesos `claude -p` leen el output-style de disco al spawnear; editar mid-run contamina el baseline" |
| (revisar) reforzar que skill-advisor se invoque en fronteras de fase | ya aplicado | living-spec | US5 lo cableó en flow.md; no requiere memoria adicional |

## Living-spec deltas (legítimo)
- AC6 (wiring skill-advisor) + AC7 (trigger positivo labels) entraron por instrucción del usuario mid-flow, coherentes con el problema raíz. Ya reflejados en spec.md.

## Commandments check
| # | Cumplido | Nota |
|---|---|---|
| I | ✅ | Reframe honesto (no enforcement); admití saltar skill-advisor |
| II | ✅ | Research externo verificado vs fuente; gaps no-cubribles declarados |
| III | ✅ | 1 grader, edits mínimos (59 inserciones); anti-filler |
| IV | ✅ | red→green; hooks 125/125, evals 17/17; live pendiente como gate honesto |
| V | ✅ | Diagnóstico antes de diseñar |
| X | ✅ | TL;DR sin duplicar; espejo del patrón drillme en flow.md |

## Cola siguiente (025) — instrucción usuario
- 025-a: cablear skill-advisor DENTRO de las skills donde corresponda.
- 025-b: auditar que TODAS las skills tengan `description` + `when_to_use` en es-ES (convención 023).

## Validación live — no factible en sandbox
4 timeouts (540/1180/580/150s). Cada prompt de eval = sesión agéntica completa de `claude -p` (~min/caso). Sustituto: suite determinista 17/17 + hooks 125/125. Validación conductual real = próxima sesión + el usuario puede correr `bun .claude/evals/run.ts` fuera del sandbox.

## Norma añadida mid-flow
Instrucción usuario: "acciones consecutivas → lista numerada 1,2,3" → añadida a poneglyph.md §Formatting. Sin caso de eval (instrucción nueva sin fallo documentado, no gradable determinista).

## Action items
- [x] Verdict APPROVED_WITH_WARNINGS (live diferido por límite de entorno, no defecto).
- [ ] Guardar memoria: evals live impracticables in-session (cada caso = sesión agéntica).
- [ ] Confirmar calibración del wiring skill-advisor (every-boundary vs gates+build).
- [ ] Arrancar 025 (skill-advisor en skills + es-ES description/when_to_use en todas).
