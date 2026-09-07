---
spec: 024-poneglyph-style-review
phase: 4
review_level: standard
verdict: APPROVED
spec_drift: legitimate
findings_count:
  blocker: 0
  major: 0
  minor: 3
  nit: 1
note: el major-1 inicial (label norm "falla live") resultó ser un bug del grader (false negative), no defecto del estilo; encontrado vía suspect-the-eval-first, arreglado (stripFenced). Norma prioritaria verificada funcionando.
fresh_reviewer_invoked: no (inline + advisor independent pass — doc-only, lección 006)
security_review_invoked: n/a (no auth/payments/secrets)
review_patterns_modes: []
created: 2026-06-23
---

# Review — 024 revisión del estilo Poneglyph

Doc+config feature (markdown + JSONL + 1 grader). Secciones Performance/Security = N/A (sin hot-path, sin área crítica; diff sin secrets verificado).

## AC trace (spec.md → entregado)

| AC | Entregado | Estado |
|---|---|---|
| AC1 audit norma-a-norma + correcciones | `research.md §2/§3` (tabla 14 normas clasificadas) + US1 (trigger labels, ref /explain) | ✅ |
| AC2 mapa norma→cobertura + gap cerrado | `research.md §2` + US3 (caso calque-19, source trazable) | ✅ |
| AC3 evals+hooks verde; live ≥ baseline | evals 17/17 ✅, hooks 125/125 ✅; live ahora ejecutable (patch prose-only en run.ts): **4/5 graders de estilo verde live** (openers/es-ES/BLUF/**calque nuevo**), label-16 falla 2 runs (ver MAJOR-1) | ⚠️ |
| AC4 TL;DR sync, no duplica | US4 (trigger inline en CLAUDE.md, sigue referencia) | ✅ |
| AC5 research verificado vs fuente | `research.md §1` vía agente claude-code-guide (output-styles.md) | ✅ |
| AC6 skill-advisor cableado en flow.md | US5 (regla SIEMPRE "Skill-advisor wiring (024)") | ✅ |
| AC7 trigger POSITIVO de labels | US1 ("anything you'd hedge with creo/quizás… → label") | ✅ |

## Correctness

- Problema raíz (estilo desigual = spec+cobertura, no carga) atacado en los 3 niveles. ✅
- Grader `calqueDetect` red→green confirmado (rojo: export ausente; verde: 17/17). ✅
- Happy path: el caso calque-19 parsea, grader resuelve, suite offline verde. ✅
- **PENDIENTE**: confirmación live de que ningún caso de estilo regresiona (run en background).

## Quality

- TDD respetado en US2 (auxiliary + tdd:forced honrado, red real visto antes de implementar). ✅
- Estilo de `calqueDetect` calcado de `bannedOpeners` (mismo patrón, reusa stripCode/stripQuoted). ✅
- Sin duplicación: anclas calque ≠ banned-openers (dominios distintos). ✅
- Diff mínimo (59 inserciones), proporcional a los AC. Sin over-engineering. ✅

## Maintainability

- Comentario en `calqueDetect` cita la fuente (poneglyph.md §Language + 017). ✅
- Sin TODO/FIXME nuevos. ✅
- `calqueDetect` justificado (norma raíz de 017 sin oráculo). ✅

## Findings

- **MINOR-1**: el "baseline limpio" se contaminó (edits aterrizaron durante el run live; subprocesos leen estilo de disco al spawnear). Mitigación: se trata como run post-cambio autoritativo; los edits no afectan a los graders existentes. Para un baseline limpio real habría que correr ANTES de editar. Documentado, no bloqueante.
- **GRADER BUG encontrado y arreglado (suspect-the-eval-first)**: `label-unverified-endpoint-16` falló varios runs con "no confidence label found". Al LEER el transcript real (en vez de re-correr a ciegas): el modelo SÍ emitía el label con payload — `[Suposición — verificar el handler de auth …]` — pero `labelPresence` llamaba a `stripCode`, que elimina inline-code ANTES de buscar, y la house-style escribe los labels EN backticks. Falso negativo crónico (habría tumbado los 3 casos de label). Fix: nuevo `stripFenced` (quita solo bloques fenced) + 2 tests TDD red→green. **El núcleo de la norma prioritaria FUNCIONA** (observado: el modelo etiqueta la afirmación no-verificada con payload).
- **MINOR-3** (residuo real, generación): en algún sample el modelo AÑADE labels desnudos `[Probable]`/`[Seguro]` que la spec ya prohíbe ("a bare label is noise"; `[Seguro]` es implícito). Minor: no engaña, la spec ya lo cubre, es comportamiento de generación → valida próxima sesión, no se arregla por más wording.
- **Extra deliverable**: patch a `run.ts` — modo prose-only (`--append-system-prompt` + `--allowedTools ""`) para graders de estilo (NO skillTriggerParse). Hace la suite live por fin ejecutable in-session (los casos de estilo ya no lanzan loop agéntico). Mejora del harness, retenida.
- **MINOR-2**: la suite live COMPLETA (19 casos × trials) sigue sin caber en el timeout del sandbox — 4 timeouts (540s full, 1180s full, 580s subset de 7, 150s de 1 caso). Causa `[Probable — transcript descartado en modo live, no verificado]`: cada prompt de eval lanza una sesión agéntica completa de `claude -p` (tools + lectura de ficheros), ~minutos/caso; una llamada trivial sin tools sí corrió en 8.4s. La validación sustituta es la suite determinista (17/17) + hooks (125/125), que prueban la LÓGICA del grader. La validación CONDUCTUAL real es la próxima sesión (la spec no recarga ahora) — coherente con el out-of-scope del spec. El usuario puede correr el live fuera del sandbox: `bun .claude/evals/run.ts` (el harness funciona; solo no cabe en el timeout anidado).
- **NIT-1**: solo 1 caso calque nuevo (no 2). Decisión consciente anti-filler (una sola clase-de-prompt documentada). Correcto por la regla de la suite.

## Spec-drift: legitimate

Dos elementos entraron mid-flow por instrucción del usuario, ratificados en su momento:
- AC6 (wiring skill-advisor en flow.md) — añadido al spec.
- AC7 + prioridad nº1 de confidence labels — reframe del usuario, añadido al spec.
Ambos coherentes con el problema raíz (mejor aplicación de normas). No es scope-creep.

## Drillme — Phase 4
1. `[context]` Spec drift → legitimate, clasificado y absorbido en spec.md. ✅
2. `[failure]` E2E happy path → grader+caso+suite offline verde; live pendiente. ⚠️
3. `[failure]` Edge que el usuario tocará → calque dentro de comillas/código exento (T2.3/T2.4 cubren). ✅
4. `[approach]` Coverage vs policy → auxiliary; US2 opt-in forced cubierto. ✅

## Verdict: APPROVED

0 blocker, 0 major (el major inicial era un bug del grader, no del estilo). Live: 4/5 graders de estilo verde + el grader de labels arreglado encuentra el label con payload (núcleo prioritario verificado funcionando). Residuos MINOR: over-labeling desnudo ocasional (spec ya lo cubre, generación, valida próxima sesión) + suite-live-completa no cabe en sandbox (corrible fuera). Suite determinista 19/19, hooks 125/125. El feature además **mejoró el oráculo**: arregló un falso-negativo crónico (labels en backticks) que llevaba sin detectarse desde 019.
