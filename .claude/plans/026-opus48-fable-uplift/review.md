---
spec: 026-opus48-fable-uplift
phase: 4
review_level: full (adaptado a doc/config — Performance N/A; Security = secrets-check del diff)
verdict: APPROVED_WITH_WARNINGS
spec_drift: legitimate
findings_count:
  blocker: 0
  major: 1
  minor: 5
  nit: 4
fresh_reviewer_invoked: yes (read-only, correctness/requirements — P1 exception; self-assessment bias era máximo)
security_review_invoked: no (no toca auth/pagos/secretos; secrets-grep del diff limpio)
review_patterns_modes: []
created: 2026-07-07
---

# Review — 026-opus48-fable-uplift

## Correctness

- Problema del spec ↔ entregado: ✅ set híbrido (playbook + rule ≤25 líneas) + harness + delta doctrina, dual Opus 4.8/Sonnet 5.
- Suites: ✅ 173/173 en rama ensamblada (hooks/scripts/commands/evals), re-verificado tras los fixes de review.
- Trazado de ACs (por el fresh reviewer, adversarial):
  - AC1 **PARTIAL**: graders deterministas verdes (en la suite); el golden-run live (19 casos) diferido fuera de sandbox — deferral honesto y pre-autorizado (validations.md, memoria `live-evals-impractical-in-session`). ⚠️ Standing: **no existe baseline offline** contra el que medir "0 regresiones" (finding 3) — al correr el live fuera de sandbox, guardar transcripts como baseline.
  - AC2 **DEFERRED-honesto**: symlink en su sitio; prueba por `instructions-loaded.log` en la próxima sesión.
  - AC3 **PARTIAL→fixed**: 6/8 evidencias sobrevivieron el spot-check adversarial; §2.6 (MAJOR) y §2.7 (MINOR) tenían citas defectuosas — **corregidas durante la review** (evidencia re-citada a nivel de transcript de sesión, marcada como no-reproducible-desde-repo; la contradicción con la memoria del incidente silencioso explicada como dos síntomas de la misma clase).
  - AC4 **SATISFIED**: diff mínimo, JSON válido, IDs verificados contra el catálogo (`claude-sonnet-5`, `claude-haiku-4-5-20251001`), sensitive declarado en build.
  - AC5 **DEFERRED-honesto** por diseño.

## Quality

- Estilo consistente con docs/rules del repo; sin duplicación introducida — los solapes del núcleo con doctrina que detectó el reviewer (findings 4/5/6) **corregidos**: item 8 reducido a su mitad-delta, item 6 enlaza la escalera de `error-recovery.md`, item 5 puentea las dos taxonomías de etiquetado.
- Rule: 14 líneas ≤ cap 25 ✓; sin umbrales conteo-antes-de-generar ✓.

## Security

- Secrets-grep del diff: limpio. `security-review` no disparado (sin superficie auth/pagos/credenciales).

## Performance

- N/A (markdown + 1 clave de settings).

## Maintainability

- Lifecycle explícito en playbook §5 (qué actualizar cuando cambie la era de modelos). Sin TODOs huérfanos.

## Findings (fresh reviewer, con resolución)

| # | Sev | Estado | Resumen |
|---|---|---|---|
| 1 | MAJOR | ✅ fixed | Playbook §2.6: evidencia no verificable desde repo y mal citada contra la memoria (incidente silencioso ≠ crash de esta sesión) → re-citada a transcript-level con marca de no-reproducibilidad |
| 2 | MINOR | ✅ fixed | §2.7 citaba el documento de auditoría en vez de la acción de sesión |
| 3 | MINOR | ⚠️ standing | AC1 sin baseline offline: "0 regresiones" no medible hasta grabar baseline live fuera de sandbox |
| 4 | MINOR | ✅ fixed | Rule item 8 + watchpoint duplicaban CLAUDE.md §Post-implementation |
| 5 | MINOR | ✅ fixed | Rule item 6 "rethink" divergía de la escalera de escalado de error-recovery.md |
| 6 | MINOR | ✅ fixed | Doble taxonomía de labels sin puente (status-column vs `[Seguro]/[Probable]/[Suposición]`) |
| 7 | NIT | ✅ fixed | "rate limit" → "session usage limit" |
| 8 | NIT | ✅ fixed | Celda de contexto Opus 4.8 podía enseñar que no tiene 1M (lo tiene a nivel API) |
| 9 | NIT | ✅ fixed | Cita de versión no verificable para `ultrathink` → eliminada |
| 10 | NIT | ⚠️ standing | `minimumVersion` 2.1.166 < 2.1.198 citado en CLAUDE.md:117 — ya en backlog P2 como CG-02 (auditoría v2); moot en esta máquina (CC 2.1.202) |

## Spec drift

`legitimate`: US4 tocó 8 ficheros (plan decía ≤4) — misma corrección atómica repetida (fix-la-clase), declarada en el cierre de la HU. Propuesta para retro: ratificar como delta del living-spec (el sweep real era más ancho que el estimado).

## Drillme — Phase 4

1. Spec drift → clasificado legitimate (arriba). 2. Happy path E2E → symlink ✓ + settings global regenerado ✓; la carga real se prueba mañana (AC2, mecánica lista). 3. Edge que el usuario tocará → finding 3 (baseline) es exactamente ese; documentado como standing con acción concreta. 4. Coverage vs policy → `auxiliary` ✓ (validation-mode, suites verdes).

## Verdict — APPROVED_WITH_WARNINGS

0 blockers; el único MAJOR (cita de evidencia del autorretrato) fue atrapado por el fresh reviewer —la razón exacta de su existencia— y corregido en la propia review. Warnings vigentes: AC1-baseline (acción: grabar baseline en el primer golden-run fuera de sandbox) y CG-02 (bump `minimumVersion`, ya en backlog P2).
