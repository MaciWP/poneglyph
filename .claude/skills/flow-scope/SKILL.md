---
name: flow-scope
description: |
  Define el alcance a nivel de producto ANTES de cualquier trabajo técnico (Fase 1 del workflow `/flow-lifecycle`). Genera spec.md mediante un cuestionario Q&A intensivo + drillme-clarify de 5 preguntas (problema raíz, severidad, stakeholders, MVP, out-of-scope). En modo full puede lanzar 3 perspectivas de producto en paralelo. Cierra con el hard gate 1→2 que requiere aprobación humana.
  Úsala cuando: petición vaga, feature nuevo, alcance indefinido, "necesito X", "quiero hacer Y", "el problema es Z", antes de planificar o implementar, falta el qué/por qué antes del cómo.
metadata:
  keywords: >
    Keywords - scope, idea, problema, alcance, quiero, necesito, define, product,
    requirements, success criteria, what-why, before-implementing, fase-1, phase-1
disable-model-invocation: false
argument-hint: "<brief or question>"
when_to_use: |
  "necesito X", "quiero hacer Y", "el problema es Z", "define el alcance", "new feature", "define scope", "what/why before building"
---

# Scope (Phase 1)

Defines the **product-level scope** before any technical decision. The deliverable is a `spec.md` that survives a 5-question Socratic drillme-clarify and locks in: root problem, expected outcomes, success criteria (Given/When/Then), explicit out-of-scope, constraints, stakeholders. **No technology choices here** — those belong to Phase 2 (`flow-plan` skill).

## Underlying principle

> "Perfect code of the wrong thing is worthless." (Commandment I)

Until the root problem and out-of-scope are explicit, no technical work proceeds; hard gate 1->2 is non-negotiable (Commandment IV). Rationale: `references/01-history.md`.

## When to use

| Trigger | Example |
|---|---|
| Vague request, no clear scope | "Necesito mejorar el dashboard" |
| New feature with unclear boundaries | "Quiero añadir notificaciones" |
| Symptom described, root unclear | "El sistema va lento, hay que arreglarlo" |
| Multiple possible interpretations | "Hay que refactorizar X" — which part, why now? |
| Stakeholder pressure without spec | "El CEO quiere Y" — what does Y resolve? |

## When to skip

| Anti-trigger | Why |
|---|---|
| Trivial mechanical change (rename, typo, formatting) | Triaje minimal: skip Phase 1, jump to Phase 3 |
| Bug fix with reproducible repro | The "what" is the failing test; no scope to define |
| Brief already includes problem + outcomes + AC + out-of-scope | Cuestionario reducido — pasa al drillme-clarify directo |
| Continuation of existing approved `spec.md` (same feature) | Resume from current phase, don't re-run scope |

## Initial detection

Before opening the questionnaire:

0. **Plans-dir git policy (once per project)** — `git check-ignore -q .claude/plans` exits 0 → company policy set, nothing to do. Else `git check-ignore -q .claude/plans/_archive` exits 0 → personal policy set. Else `AskUserQuestion` (company / personal) and write it: company → append `.claude/plans/` to `$(git rev-parse --git-path info/exclude)` (never a hardcoded `.git/info/exclude`: in a linked worktree `.git` is a file); personal → `.claude/plans/.gitignore` with `_archive/`. Never write silently. Rule: `plans/README.md` §Other projects.
1. `Glob .claude/plans/*-*/spec.md` — ¿hay specs activas (`status: draft|approved|implementing`)?
2. Si hay una `implementing` reciente → preguntar al usuario: "¿Continúas con `<slug>` o es feature nuevo?"
3. Si no hay nada → calcular `NNN` siguiente disponible + derivar `slug` (kebab-case, ≤30 chars) del prompt.

Anti-hallucination: el slug se propone al usuario antes de crear el directorio. Nunca asumir.

## Workflow

### Step 1 — Intensive questionnaire

3-8 preguntas vía `AskUserQuestion` (puede ser batch o secuencial según UX). Plantillas, adaptadas a la petición:

| Pregunta canónica | Cuándo |
|---|---|
| "¿Cuál es el problema concreto que quieres resolver, no la solución?" | Siempre — la respuesta abre el resto del cuestionario |
| "¿Quién sufre hoy y cómo se manifiesta?" | Si hay ambigüedad sobre los stakeholders |
| "¿Qué resultado mínimo te haría feliz?" | Define el MVP — clave para Phase 2 atomizar |
| "¿Hay constraints técnicos/temporales que respetar?" | Tiempo, stack, compatibilidad, freeze |
| "¿Alternativas que ya descartaste y por qué?" | Evita reinventar; descubre contexto |
| "¿Cómo medirás el éxito en 2 semanas?" | Force outcomes medibles, no aspiracionales |

**Rules**:
- Mínimo 3 preguntas. Máximo 8.
- Si una respuesta es vaga ("depende", "más o menos") → follow-up hasta concreción.
- Si el usuario contradice respuesta previa → reabrir la sección, no cerrar inconsistencias.
- Si el brief inicial ya cubre N preguntas con concreción → saltar esas N. Declarar "Cuestionario reducido por brief detallado: skipped N/8".

### Step 2 — Drillme (Phase 1)

Las 5 preguntas obligatorias **en orden** antes de cerrar la fase. Si alguna queda vacía o evasiva → iterar; no cerrar Phase 1 con drillme-clarify abierto.

```markdown
## Drillme — Phase 1

1. **Root problem?** — `[approach]` What is the root cause, not the symptom? Apply 5-whys if needed.
2. **What if we don't?** — `[failure]` Severity test: what happens if we skip this work entirely?
3. **Who suffers today?** — `[context]` Implicit stakeholders — who feels the problem now?
4. **MVP outcome?** — `[approach]` What's the minimum viable result that resolves the core pain?
5. **Out of scope?** — `[location]` Close doors explicitly. What is NOT included.
```

> **For full Socratic check, invoke the `drillme-clarify` skill**. The 5 questions above are also stored canonically in `.claude/skills/drillme-clarify/references/03-phase-questions.md` §Phase 1 — that file is the single source of truth. Drillme additionally provides the canonical 4-category catalog (`01-catalog-socratic.md`) + complementary patterns (`02-complementary-patterns.md`) + quality check protocol (`04-quality-check.md`).
>
> Skill-to-skill invocation is probabilistic (docs Anthropic + issue #59968). If drillme-clarify does not auto-fire and the Lead detects the gap, invoke `/drillme-clarify "Phase 1 closing for <NNN-slug>"` manually before approving hard gate 1->2.

### Step 3 (optional, `full` mode only) — Product perspectives in parallel

Activate when the Lead declares complexity >60 OR the user requests `--full`. Spawn 3 perspectives in **a single message, 3 parallel Agent calls**, using prompts derived from `.claude/skills/compare-and-decide/references/heavy/01-perspectives.md`:

| Perspective | Source | Adaptation for Phase 1 |
|---|---|---|
| **Outsider** | `.claude/skills/compare-and-decide/prompts/outsider-agent.md` | Naive questions about the *problem framing*, not a technical decision. "Why this at all? Why now? Who actually has this problem?" — Input only, no tools. |
| **Product** | inline prompt from `.claude/skills/compare-and-decide/references/heavy/01-perspectives.md` §9 | Value vs cost: roadmap fit, what NOT built because of this, what unlocks measurably. Tools: Read (docs/, roadmap), WebSearch. |
| **User** | inline prompt from `.claude/skills/compare-and-decide/references/heavy/01-perspectives.md` §12 | Public-surface DX/UX implications: predictability, error story, migration path for existing consumers. Tools: Read, Grep. |

Each emits the standard perspective format (Position / Confidence / Pros / Contras with severity / Context needed / Questions). Output goes into the `spec.md` as a dedicated section "Voces externas (modo full)" preserving attribution.

Cost: ~3-5K tokens extra. Default-on only in `full` mode; user can override with `--no-perspectives`.

### Step 4 — Produce `spec.md`

1. `Read .claude/plans/templates/spec.template.md`, falling back to `~/.claude/plans/templates/spec.template.md` (confirm the template exists before reading; outside poneglyph only the global copy does).
2. Create `.claude/plans/{NNN}-{slug}/spec.md` filling required fields:
   - `# Problema` — one sentence, root cause.
   - `# Resultado esperado` — 2-4 measurable outcomes from the questionnaire.
   - `# Success criteria (medibles, Given/When/Then)` — minimum 3 ACs, all verifiable mechanically or by human reading.
   - `# Out of scope (explícito)` — closes doors per drillme-clarify question 5.
   - `# Constraints` — only if real constraints surfaced.
   - `# Stakeholders` — only if >1 stakeholder.
   - `# Open questions` — gaps unresolved by questionnaire (may be empty).
3. Frontmatter: `mode: <minimal|standard|full>`, `phase: 1`, `status: draft`, `created: <ISO-date>`, `id: {NNN}-{slug}`.
4. If `full` mode + perspectives produced findings → append section `# Voces externas` with the 3 attributed perspectives.
5. Set status `draft` initially. `approved` field stays empty until the human gate closes.

**Anti-hallucination rules in this step**:
- Never invent AC — each one comes from the questionnaire or drillme-clarify.
- Never invent stakeholders — only those the user mentioned.
- Never assume constraints — ask if uncertain.

### Step 5 — Report and request approval

Output to the user:

1. Path of the created `spec.md`.
2. 2-3 line summary: "Defined scope: problema X, resultado Y, N AC, modo Z."
3. Explicit prompt: "Hard gate 1->2 — necesito tu aprobación antes de pasar a planificación técnica (Phase 2). ¿Apruebas o refinamos?"
4. If perspectives ran in `full` mode → mention which surfaced non-trivial signal vs which agreed with the framing.

The skill does NOT proceed to Phase 2. Only the user approves.

## SIEMPRE rules

- **Cuestionario intensivo**: minimum 3 questions until scope is unambiguous.
- **Proactivity on gaps**: if you detect improvements to the proposed scope or obvious gaps, mention them BEFORE closing the questionnaire — never silently absorb them.
- **Honest about brief quality**: if the brief is too vague, say so; do not invent intent.
- **No technology in spec.md**: *choosing* a library, framework or pattern is Phase 2 work. One the user imposes (platform, banned dependency, pinned version) is a real constraint — record it under Constraints with its source.

## Adaptación intra-fase (Principio 2 — "no siempre más es más")

| Señal en petición | Adaptación |
|---|---|
| Brief detallado (problem + outcomes + AC + out-of-scope ya redactados) | Cuestionario 1-3 preguntas críticas; drillme-clarify reducido si respuestas auto-evidentes |
| Petición trivial (typo, rename, 1-2 archivos) | Skill probablemente NO se activa (triaje del Lead la salta a Phase 3 directa) |
| Petición arquitectural multi-dominio | Cuestionario 6-8 preguntas + drillme-clarify completo + perspectives en `full` |
| Brief contradictorio o cambiante mid-questionnaire | Reabrir secciones afectadas, no forzar cierre con inconsistencias |
| Research/audit feature (deliverable = report/análisis, no código) | Scope LIGERO: problema + corpus + rúbrica. Perspectives opcionales. Producir sustancia (research) temprano, formalizar incremental. Evita over-engineering pre-sustancia (Commandment V). Lección feature 002. |

Adaptación se declara honestamente en el output (`# Open questions` section o nota): "Drillme reducido por contenido autoexplicativo". Nunca silente.

## Casos edge

- **Edge 1** — Usuario abandona el cuestionario a mitad: el `spec.md` queda `status: draft` con secciones incompletas marcadas; `/flow-scope --resume <slug>` permite reanudar.
- **Edge 2** — Drillme genera "no sé / no aplica" en una pregunta: marcar `[OPEN]` en el spec; NO cerrar la pregunta artificialmente.
- **Edge 3** — Usuario contradice respuesta previa: reabrir esa sección del cuestionario; nunca registrar respuestas inconsistentes.
- **Edge 4** — La petición es ambigua entre dos features distintas: proponer 2 specs separados (`NNN` y `NNN+1`) o pedir al usuario que priorice; nunca mezclar.
- **Edge 5** — Existe `spec.md` con `status: approved` en directorio con mismo slug: pedir confirmación antes de sobrescribir; preferir nuevo `NNN`.

## Smell signals

- ⚠️ Cuestionario excede 8 preguntas → la petición probablemente son 2 features; sugerir split.
- ⚠️ Drillme cierra todas con "no sé" → la petición no es ejecutable aún; pedir más research previa del usuario.
- ⚠️ `spec.md` queda con >5 Open questions → escalar a modo `full` aunque el Lead había estimado standard.
- ⚠️ `# Resultado esperado` menciona tecnologías (librerías, frameworks) → eso es Phase 2; reabrir.
- ⚠️ `# Out of scope` está vacío en una petición no trivial → drillme-clarify question 5 no se cerró honestamente; iterar.

## Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Spec theater | spec.md aprobado en <2 minutos sin preguntas reales | Force cuestionario mínimo 3; honest "demasiado vago" en lugar de inventar |
| Tech sneaking | spec menciona Redis, Postgres, React, etc. | Reescribir en términos de outcome ("almacenamiento persistente compartido"); tech va a Phase 2 |
| Synthetic AC | AC inventados que no salieron del cuestionario | Cada AC trazable a una respuesta del usuario o del drillme-clarify |
| Out-of-scope vacío | "Todo está en alcance" sin reflexión | Drillme question 5 obliga; si genuinamente todo está, declarar "scope deliberadamente maximalista por motivo X" |
| Drillme bypass | Skill cierra Phase 1 sin completar las 5 preguntas | Hard gate interno antes de producir spec.md final |
| Perspectives en modo trivial | Spawn de 3 agents para una petición simple | `full` mode requiere triaje del Lead — auto-downgrade si la petición no lo justifica |

## Commandments cubiertos

| # | Cómo |
|---|---|
| III | Pregunta si no sabe; honesta sobre brief vago; no inventa intent |
| II | Verifica premisas factuales del usuario antes de incluirlas (Glob/Grep si menciona archivos) |
| V | Drillme detecta over-scope; out-of-scope explícito fuerza minimalismo |
| I | La fase entera es "entender antes de actuar" |
| VIII | Cuestionarios estructurados; meta-prompting para perspectives en `full` |

## Auxiliary skills

Wiring and manual fallbacks for this phase (drillme-clarify, prompt-design, decide catalog in `full` mode): `.claude/docs/auxiliary-skills-matrix.md` §Fallbacks per phase. Skill-to-skill invocation is probabilistic (issue #59968) — when an auxiliary does not fire, apply its fallback row. `flow-plan` is NOT invoked here; it waits on the human hard gate 1->2.

## Consumer downstream

| Phase skill | Consumes from this skill |
|---|---|
| `flow-plan` (Phase 2) | The approved `spec.md` (after hard gate 1->2 closed by human). Wait — do not auto-invoke. |

## References

Rationale and post-implementation verification of this skill: `references/01-history.md`.

## Output format (reminder)

When the skill closes Phase 1, the user sees:

```
Phase 1 closed for {NNN}-{slug}:
- spec.md: .claude/plans/{NNN}-{slug}/spec.md (status: draft)
- mode: <minimal|standard|full>
- problema: <one line>
- resultado esperado: <one line>
- success criteria: <N>
- out of scope: <one line>
- voces externas: <N perspectives ran | skipped>
- open questions: <N | none>

⚪ Hard gate 1->2 — pendiente tu aprobación antes de Phase 2 (flow-plan).
   Responde: APPROVE para continuar | REFINE para iterar | BLOCK para detener.
```
