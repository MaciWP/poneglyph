---
spec: 026-opus48-fable-uplift
phase: 5
retro_level: full
verdict_phase4: APPROVED_WITH_WARNINGS
spec_drift: legitimate
promotions_proposed: 2
promotions_approved: 1
commandment_violations: 1
living_spec_delta: no
action_items: 4
created: 2026-07-07
status: approved
---

# Retro — 026-opus48-fable-uplift

## Summary

Problema (spec): "Mañana se retira Fable 5 […] sin capturar HOY sus disciplinas, la pérdida conductual es irreversible." Entregado: playbook de destilación (8 deltas con evidencia + anti-fallos + guía dual de harness), rule núcleo de 14 líneas always-loaded (symlink global creado), `fallbackModel` → Sonnet 5, y barrido de refs stale a modelos (8 ficheros). Ciclo completo (5 fases, 2 hard gates, fresh reviewer) en una sola sesión, contra deadline real. Verdicto del proceso: fluido, con UNA captura valiosa — el fresh reviewer atrapó al autor citándose mal a sí mismo.

## Lessons

### ✅ Patterns that worked
- **Fresh reviewer sobre un autorretrato**: el único MAJOR del ciclo (evidencia de §2.6 mal citada) era invisible para el autor por construcción — Fable evaluando texto sobre Fable. La excepción P1 demostró su valor exactamente donde la doctrina lo predice (memoria `independent-reviewer-when-self-assessing`). Reusar: siempre que el artefacto describa el comportamiento del propio autor.
- **Híbrido core→playbook**: el cap de 25 líneas forzó una condensación que ADEMÁS reveló solapes con doctrina (findings 4/5/6) que un fichero único habría ocultado.
- **Fix-la-clase en el sweep (US4)**: corregir la frase en los 8 ficheros de una pasada en vez de re-planificar por superar el estimado — con desviación declarada, no silenciosa.
- **Deadline como forzador honesto**: la restricción "la introspección caduca mañana" mantuvo el triage en Standard y las fases sin ceremonia sobrante.

### ❌ Patterns that didn't work
- **Auto-cita deriva (Cmd II ⚠️)**: al escribir el playbook, dos evidencias de nivel-transcript se citaron como si fueran artefactos de repo/memoria (§2.6 contra una memoria que documenta un incidente DISTINTO; §2.7 contra el documento de auditoría que no lo contiene). Causa: al destilar la propia sesión, la frontera "lo que hice" vs "lo que está registrado y dónde" se difumina. Evitar: etiquetar la evidencia de sesión como `[session-transcript evidence]` EN EL MOMENTO de escribirla, no en review.
- **AC redactado sin comprobar el runner**: AC1 ("run.ts … 0 regresiones") nunca fue ejecutable en sandbox tal como se escribió — el modo offline exige transcripts almacenados que no existen; no hay baseline. La deferral era honesta, pero el AC debió redactarse contra los modos reales del runner (leerlo en Fase 2.5, no en build).
- **Estimación del sweep**: "≤4 ficheros" se fijó antes de ejecutar el grep amplio; salieron 8. Estimar límites de sweeps DESPUÉS de un grep de conteo, no antes.

## Process audit

| Phase | Effort | Friction | Improvement candidate |
|---|---|---|---|
| 1 scope | S | ninguna (3 preguntas, drillme saturado a 0) | — |
| 2 tech-plan | S | ninguna | — |
| 2.5 tdd-design | S | AC1 vs modos del runner (❌ arriba) | tdd-design: leer el runner citado en el AC |
| 3 build | **M-L (la más pesada)** | esperada — US1 ES el deliverable intelectual | — |
| 4 critic | M | reviewer 306K tokens — caro pero justificado aquí | reservar fresh reviewer full a blast-radius alto |

## Drillme — Phase 5

1. ¿Fase pesada de más? — No: la pesada (build/US1) es donde vivía el valor. 2. ¿Fricción evitable? — La doble corrección de citas (evitable etiquetando al escribir). 3. ¿Patrón reusable? — El etiquetado de evidencia de sesión; el fresh-reviewer-en-autorretratos ya está en memoria. 4. ¿Scope? — memoria (hecho puntual, no merece fichero). 5. ¿Commandment violado en silencio? — Sí, II, y NO fue en silencio: lo atrapó el gate (abajo).

## Promotion candidates

| Candidate | Scope | Type | Why | Proposal |
|---|---|---|---|---|
| `feedback-session-evidence-labeling` | memory | memoria | Finding 1 del review: auto-citas derivan al destilar la propia sesión; etiquetar `[session-transcript evidence]` al escribir, y citar la CLASE de la memoria sin fusionarla con la instancia | Fichero de memoria + línea en MEMORY.md |
| Baseline de evals en el primer golden-run | — (action item, no promotion) | — | Finding 3: "0 regresiones" no es medible sin baseline | Al correr `run.ts` live fuera de sandbox, guardar transcripts como baseline offline |

Failure→eval: la deriva de auto-cita NO es convertible en golden-case determinista (es un juicio de trazabilidad de citas, no gradeable por regex) — declarado honesto, sin caso sintético.

## Living-spec

`spec_drift: legitimate` sin patch a spec.md: la desviación (US4 tocó 8 ficheros, no ≤4) vive a nivel de tasks, y el outcome del spec ("doctrina existente sin referencias rotas") se cumplió tal cual. Los 3 criterios de delta legítimo se cumplen (edge real descubierto en build; sin contradicción con el intent; documentado en el cierre de US4 y en review.md).

## Commandments audit

| # | Cumplido | Evidencia |
|---|---|---|
| I | ✅ | Deferrals visibles (AC1/AC2/AC5); findings del reviewer aceptados sin defensa |
| II | ⚠️ | **Forensics**: momento = redacción de US1 (§2.6/§2.7); dos citas de evidencia no sostenidas por el artefacto citado. Alternativa: etiquetar evidencia de sesión al escribirla. Detectado y corregido por el gate de Fase 4 (el sistema funcionó); acción = promotion `feedback-session-evidence-labeling` |
| III | ✅ | Núcleo 14/25 líneas; solapes con doctrina recortados en review |
| IV | ✅ | 2 hard gates humanos + 173 tests en cada cierre + verdict gate del helper (guard de 025 activo) |
| V | ✅ | Discovery + grounding antes de plan; runner leído (tarde — ver ❌, pero leído antes de afirmar) |
| VI | ✅ | `sensitive:` declarado en settings y en el sync |
| VII | ✅ | 1 solo agente en todo el ciclo (la excepción sancionada); resto inline |
| VIII | ✅ | Execution prompts con rúbrica en las 4 HUs; prompt del reviewer con contexto/constraints/deliverable |
| IX | ✅ | Este retro + AC5 diferido con dueño y trigger |
| X | ✅ | Lifecycle del playbook documentado (§5: qué podar cuando cambie la era) |

## Action items

| Action | Owner | Trigger | Due |
|---|---|---|---|
| Validar AC2 (rule en `instructions-loaded.log`) + AC5 (comportamiento) y refinar el set | user + Lead post-Fable | primera sesión con Opus 4.8/Sonnet 5 | mañana |
| Grabar baseline de evals (transcripts) en el primer golden-run fuera de sandbox | user | primer run live | esta semana |
| **Commit de TODO el working tree** (025 + auditorías + P1 + 026) — el riesgo PA-5 sigue creciendo | user (o Lead con OK) | ratificación | HOY, antes de que retiren Fable no aplica al commit, pero el árbol lleva 7 días divergiendo |
| CG-02: bump `minimumVersion` ≥2.1.198 (nota del finding 10) | Lead | ratificación P2 (auditoría v2) | próxima sesión |
