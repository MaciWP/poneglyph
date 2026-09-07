---
us: US3
title: casos eval calque en cases.jsonl
wave: 2
depends_on: [US2]
tdd_mode: optional
estimate: S
status: draft
---

## Quick reference

| Campo | Valor |
|---|---|
| Files | `.claude/evals/cases.jsonl` |
| Tipo | append JSONL (casos de eval) |
| AC spec | AC2 |
| Dep | US2 (el grader `calqueDetect` debe existir) |

## Execution prompt (Phase 3 input)

**Task**: Añadir 1-2 casos `type:"register"` con `grader:"calqueDetect"` a `.claude/evals/cases.jsonl`, cada uno con `source` trazable a un fallo real documentado.

**Context**: La suite vigila por regresión (README: un caso por fallo real, sin filler, cap ≤50). El fallo documentado: 017 retro "translated-English style debt" + `poneglyph.md §Language` lista los calques. Schema de caso: `{"id","prompt","type","grader","expected?","trials?","source"}`. El prompt debe ser uno que históricamente arrastraba a calque (p.ej. prompt en inglés o muy técnico).

**Constraints**: `source` OBLIGATORIO y real (no sintético). NO duplicar near-misses. `trials:2` (estilo estocástico). Mantener la suite ≤50 (estamos en 18 → 19-20, ok). Un caso por cluster, sin relleno.

**Deliverable**: 1 caso mínimo, p.ej.:
`{"id":"calque-eng-prompt-19","prompt":"Explain why the output-style doesn't reload mid-session and rewrite the fix","type":"register","grader":"calqueDetect","trials":2,"source":"017 retro (translated-English debt) + output-styles/poneglyph.md §Language calques (voy a proceder a / hace sentido / déjame verificar were the documented calque reflexes on English/technical prompts)"}`
Opcionalmente un 2º si hay un segundo prompt-clase distinto documentado; si no, NO añadir filler.

**Verify**: `bun .claude/evals/run.ts cases.jsonl --offline <dir>` parsea sin error; `parseCases` no lanza (grader existe). En el baseline live post-cambio, el caso pasa (o si falla, es señal real → documentar).

**Ask-first**: Si solo hay un prompt-clase documentado, confirmar que NO se añade un segundo por simetría (anti-filler).

## Acceptance criteria

- **AC3.1**: Given el caso nuevo, when `parseCases`, then no lanza (id+grader presentes, grader conocido).
- **AC3.2**: Given el caso, when se inspecciona, then `source` cita un fallo real y trazable.

## Commandments cubiertos
II (trazabilidad), IV (regresión), III (sin filler, respeta cap).
