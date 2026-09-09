---
name: tech-plan
description: |
  Plan técnico a partir de un spec.md aprobado (Fase 2 del workflow de 5 fases). Descompone el alcance en historias de usuario (HUs) atómicas con un DAG explícito de dependencias, tras investigación obligatoria (Context7 + WebFetch + Grep del proyecto). Produce tasks/index.md + N tasks/US{N}.md. Honra test-policy.md por nodo. Invoca tdd-design (Fase 2.5) al cerrar.
  Úsala cuando: existe spec.md aprobado y hace falta descomposición técnica, "tareas", "roadmap", "descomponer", "HU", "atomizar", "DAG", o /tech-plan. Evita la keyword suelta "plan" (colisiona con el modo plan de Claude Code).
metadata:
  keywords: >
    Keywords - tech-plan, tareas, roadmap, descomponer, HU, atomizar, DAG, dependencies,
    parallel waves, gap analysis, classification, planificar, plan-tecnico, phase-2, fase-2
disable-model-invocation: false
argument-hint: ""
when_to_use: |
  "descompón en tareas", "haz el roadmap", "atomiza en HUs", "plan técnico", "break into tasks", "technical plan", "build the DAG"
---

# Tech-Plan (Phase 2)

Translates an approved `spec.md` (output of Phase 1 `scope` skill) into a Validated Execution Graph: atomic HUs + DAG of real dependencies + research-backed decisions. The deliverable is `tasks/index.md` + N `tasks/US{N}.md` ready for the human hard gate 2->3.

## Underlying principle

> "Anti-duplicate verification. Anti-obsolescence checking. Anti-hallucination on every claim." — adapted from planner-protocol §1

Three obligatory verifications BEFORE writing any HU: project context (Glob/Grep), external doc (Context7), atomicity (drillme). Rationale and legacy migration: `references/07-history.md`.

## When to use

| Trigger | Example |
|---|---|
| Approved `spec.md` in `.claude/plans/{NNN}-{slug}/` ready for technical decomposition | "ya tengo spec.md, descomponer en HUs" |
| Cross-domain change requiring DAG of dependencies | "feature multi-modulo con APIs externas" |
| User invokes `/tech-plan` or mentions "tareas", "roadmap", "descomponer" | direct invocation |
| Phase 2 of the 5-phase workflow | after hard gate 1->2 closed |

## When to skip

| Anti-trigger | Why |
|---|---|
| No approved `spec.md` exists | Phase 1 first — invoke `scope` skill |
| `spec.md` has `status: draft` (not approved) | Hard gate 1->2 not closed — escalate to user |
| Trivial mechanical change (rename, typo, formatting) | Lead acts directly; tech-plan is overhead |
| ~~`mode: minimal`~~ (LEGACY — modes eliminated 029/US12; /flow is always full) | Unreachable; a phase that doesn't apply is skipped with justification instead |
| Mid-implementation bug fix | Phase 3 `build` + `diagnostic-patterns` handle this |

## Initial detection

1. `Glob .claude/plans/*-*/spec.md` — find active spec(s).
2. If multiple → pick the one with `status: approved` and most recent `approved:` date; ask user if ambiguous.
3. Read `spec.md` — verify `status: approved`. If `draft` → STOP, escalate.
4. Read `.claude/plans/templates/tasks.template.md` and `tasks-index.template.md` (project-local first, then `~/.claude/plans/templates/`; US1 outputs — confirm exist via Glob. Outside poneglyph only the global copy exists).

## Workflow

### Step 1 — Level Triage (MANDATORY first line of output)

Declare on the first line of the resulting `tasks/index.md` resumen: `Level: Quick|Standard|Full — <reason>`.

| Level | When | Refs loaded | Cost |
|---|---|---|---|
| **Quick** | complexity <30 OR clear scope (1-2 files, no external research) OR `--quick` | ≤2 (`01-discovery` + `04-classification-waves`) | ~3-5 min |
| **Standard** (default) | complexity 30-60 OR ambiguity about dependencies OR `--standard` | 3-5 (+ `02-research`, `03-gap-analysis`) | ~10 min |
| **Full** | complexity >60 OR multi-domain OR architectural risk OR `--full` | 6 (all references) + decide (heavy tier) if 2+ alternatives | ~20-30 min |

Escalation: start at Quick; escalate to Standard if Quick uncovers uncertainty; escalate to Full if Standard reveals multi-domain coupling or security-critical paths. Do not splice levels — restart at higher level.

### Step 2 — TDD Applicability Check (MANDATORY)

Read `.claude/rules/test-policy.md`. Declare resolved mode on the line after `Level:`:

`TDD-mode: <forced|adaptive|optional> — <reason from test-policy.md>`

| Project policy | TDD-mode resolved | Per-node behavior |
|---|---|---|
| `business-critical` | `forced` | Every code-impl node has paired test node BEFORE it in DAG |
| `mixed` | `adaptive` | Per-node decision; planner declares rationale per node |
| `auxiliary` OR `test-policy.md` absent | `optional` | Tests run post-impl as verification; TDD-first not enforced |

A node may carry `tdd-skip: <reason >=10 chars>` to opt out under forced/adaptive. Concrete reason required (anti-pattern: skip without reason).

For `flow`, set `tdd: forced` on behavior-changing HUs, including auxiliary code.
Design their oracle before implementation. Use validations for document-only HUs;
record any TDD exception before execution. Outside flow, keep project policy.

### Step 3 — Discovery (anti-duplicate verification)

Read `references/01-discovery.md` for the full protocol. Quick checks before writing any HU:

```
Glob('**/X.ts')          # Does it already exist?
Glob('**/X/**')          # Does the directory exist?
Grep('class X', 'src/')  # Is there already an implementation?
```

**If it exists -> modify, do not create.**

### Step 4 — Research (anti-obsolescence)

For Standard+ levels:

- **Context7 MCP**: official docs of each external API mentioned in spec (verify version + breaking changes).
- **WebFetch** (if domain unknown): 1-2 reputable projects as reference.
- **Grep/Glob project**: 5-10 examples of the pattern to use (preserve project style — anti-pattern: invent new conventions).

Document sources in `tasks/index.md` under `## Research`. Full anti-obsolescence checklist in `references/02-research.md`.

### Step 5 — Gap Analysis (Standard+)

For each planned change, verify ground truth before generating the HU. Full per-change-type checklist in `references/03-gap-analysis.md`. Quick smell signals:

- Plan mentions "function X" without verified existence → STOP, Grep.
- Plan references "library Y v3" without Context7 verification → STOP.
- Plan assumes "test file Z exists" without Glob → STOP.

### Step 6 — Closure questionnaire (3-5 questions)

Skip if the brief in `spec.md` already covers these:

- "¿Hay estilo/convenciones del proyecto a preservar (linter, formatter, naming)?"
- "¿APIs externas en juego? ¿Qué versión?"
- "¿Constraints performance/security adicionales no en spec?"
- "¿Algún patrón del proyecto que detecto como mejorable — pregunto antes de actuar?" (proactivity)

### Step 7 — Drillme Phase 2

Apply the 5 phase-specific questions + canonical Socratic catalog via `drillme` skill (auxiliary — see "Auxiliary skills invoked" below).

```markdown
## Drillme — Phase 2

Before closing this phase, validate:

1. `[approach]` **Simpler option?** Is there a simpler solution that meets the spec?
2. `[context]` **Reinventing wheel?** Am I duplicating something already in the project?
3. `[approach]` **Truly atomic?** Each US completable in <=1 session?
4. `[context]` **Real deps?** Are dependencies functional or just cosmetic ordering?
5. `[failure]` **Failure tolerance?** If one US fails mid-implementation, does the DAG survive?
6. `[location]` **Right location?** Do these files live in the directory project conventions dictate?

If any answer is "I don't know" or evasive → iterate plan; do NOT close.
```

Coverage: 4/4 canonical Socratic categories (location/approach/context/failure).

> Skill-to-skill invocation is probabilistic. If `drillme` does not auto-fire, the Lead invokes `/drillme "Phase 2 plan closing for <NNN-slug>"` manually before approving hard gate 2->3.

### Step 8 — Stress-test alternatives (Full mode only)

If Full mode AND 2+ technically reasonable alternatives surfaced → invoke `decide` (heavy tier) skill with the alternatives. Wait for verdict before closing the plan. Skip in Quick/Standard.

### Step 9 — Construct DAG

For each planned HU:

| Symbol | Type | Definition | Execution |
|---|---|---|---|
| 🔵 | Independent | No mutual dependencies | PARALLEL — same wave |
| 🟡 | Dependent | Needs prior output | SEQUENTIAL — wait |
| 🔴 | Blocking | Human checkpoint/validation | PAUSE — approve before continuing |

Each HU needs one verifiable outcome, acceptance criteria and justified dependencies.
A sequential DAG is valid. Split complexity by behavior and coupling, not a
parallelism quota. See `references/04-classification-waves.md`.

### Step 10 — Produce artefacts

1. `.claude/plans/{NNN}-{slug}/tasks/index.md` from `templates/tasks-index.template.md`:
   - Frontmatter (`spec`, `phase: 2`, `total_us`, `dag_complete`, `mode`).
   - Resumen ejecutivo (2-3 párrafos).
   - Estimación de esfuerzo (tabla por wave + Critical path).
   - DAG mermaid con subgraphs por wave.
   - Tabla resumen de HUs.
   - Cross-cutting decisions (si aplica).
   - Open questions deferidas a Phase 3.
   - Anti-patterns mitigation (si aplica).
   - Próximo paso.

2. Por cada HU: `tasks/US{N}.md` from `templates/tasks.template.md`:
   - Frontmatter (us, title, wave, depends_on, tdd_mode, estimate, status: draft).
   - **Execution prompt (Phase 3 input)** — MANDATORY block (Task / Context / Constraints / Deliverable / Verify / Ask-first). The Lead executes USs inline, so a US IS a prompt — Arch-H quality criteria apply (Commandment VIII).
   - Quick reference table (obligatoria — 9 campos canónicos).
   - User story (role/action/benefit).
   - Acceptance criteria (Given/When/Then, numerados).
   - Files a crear/modificar (tabla).
   - Workflow detallado.
   - Drillme (si la HU lo justifica).
   - Commandments cubiertos.
   - Verificación post-implementación.

**Anti-hallucination obligatoria** (auxiliary `anti-hallucination`): cada HU referencia archivos/funciones/módulos verificados con Glob/Grep/LSP previo. Nunca inventar.

### Step 11 — Team mode (Full + complexity >60)

For Full level with complexity >60, optionally invoke cross-validation: a second perspective audits the DAG before closing. Full protocol in `references/05-team-mode.md`. Anti-pattern: skip when stakes are high.

### Step 12 — Quality gate

Before reporting close: run the checklist in `references/06-quality-gates.md`. Key checks:
- All HUs have role/action/benefit + AC + depends_on + files + tdd_mode.
- **Execution-prompt rubric pass**: score each US's "Execution prompt (Phase 3 input)" block against `.claude/skills/prompt-engineer/scoring-criteria.md` (do not duplicate the rubric — Read it). A block scoring <70 gets refined BEFORE gate 2→3; the score is a doubt signal, not a hard stop.
- DAG has no cycles (cycle = smell, refactor).
- Every dependency is justified; each HU has a verifiable outcome.
- Anti-hallucination applied (every claim about existing code verified).
- `test-policy.md` honored per node.

### Step 13 — Invoke tdd-design (Phase 2.5)

Record phase 2 complete once draft tasks are ready. **Invoke `tdd-design` on these drafts** to produce `tests.md` or `validations.md` BEFORE returning control to user. Skill-to-skill invocation is probabilistic — the Lead verifies post-skill and dispatches manually if `tdd-design` auto-fire failed.

An existing oracle may be reused after checking its coverage; record that result for phase 2.5. A `/flow` task still needs an oracle before build.

### Step 14 — Report and request approval

Output to user:

1. Paths: `tasks/index.md` + N `tasks/US{N}.md` + `tests.md`/`validations.md`.
2. Summary: level, TDD policy, HUs, dependency waves and critical path.
3. Explain consequential decisions and any remaining uncertainty.
4. Explicit prompt: "Hard gate 2->3 — necesito tu aprobación de `tasks/` + `tests.md`/`validations.md` antes de Phase 3."

Present tasks + oracle once at gate 2->3. Record the applicable user decision with `approve-gate 2-3 --approval <decision-ref>`; never infer it from files. Resume an already approved package without requesting the same decision again. See [flow contract](../../docs/flow-contract.md).

## SIEMPRE rules

- Read `spec.md` first; if `status: draft` → STOP.
- Anti-duplicate verification before "create X" (Glob/Grep).
- Anti-obsolescence research before referencing external APIs (Context7).
- Anti-hallucination on every claim (every file/function/import verified).
- Honest reduction when spec is trivial: declare "Quick level — N HUs, no deep research" rather than padding.
- Proactivity on improvements: if the project has a pattern that could be improved, mention + ask — never act without permission.

## Auxiliary skills

Wiring and manual fallbacks for this phase (anti-hallucination, drillme, decide, lsp-operations, prompt-engineer, meta-create, meta-settings-cookbook, downstream tdd-design): `.claude/docs/auxiliary-skills-matrix.md` §Fallbacks per phase. Skill-to-skill invocation is probabilistic (issue #59968) — when an auxiliary does not fire, apply its fallback row. Step 13's `tdd-design` invocation is critical: verify post-skill that tests.md/validations.md exists; re-invoke manually if missing.

## Adaptation intra-phase (Principio 2 — "no siempre más es más")

| Signal | Adaptation |
|---|---|
| `spec.md` complexity ≤30, 1-2 known files | Quick level; skip Context7/WebFetch; 1-3 simple HUs; skip decide (heavy tier); minimal references loaded |
| `spec.md` mentions non-trivial external APIs | Standard+ obligatory; Context7 mandatory; verify version + breaking changes |
| `spec.md` is multi-domain | Build 2-3 sub-DAGs per domain; identify interfaces between domains; declare in Resumen |
| `spec.md` is architectural (>60) | Full level; stress-test if alternatives; team mode cross-validation |
| `spec.md` modifies critical paths (auth/payments/secrets) | Full level mandatory; mandatory security review preview in HU descriptions |

Declare adaptation in `tasks/index.md`: "Level X — modo Y por motivo Z. Saltado: <subskips honestos>".

## Casos edge

- **Edge 1** — `spec.md` with `status: draft`: STOP, escalate to user; Phase 1 not closed.
- **Edge 2** — `spec.md` with unresolved Open questions: resolve with user before planning; do not assume.
- **Edge 3** — DAG has cycles: smell signal — refactor; cycles in planning indicate ambiguous HU boundaries.
- **Edge 4** — Wave with >10 parallel HUs: review if truly independent; suspect over-granularity.
- **Edge 5** — `tasks/` directory already exists for this `{NNN}-{slug}` (resuming mid-plan): ask user "continue or restart?" before overwriting.
- **Edge 6** — Project lacks `test-policy.md`: treat as `auxiliary` by default + warn user (Step 2).

## Smell signals

- ⚠️ HU requires >5 files → too large, split.
- ⚠️ HU has >5 deps → granularity badly defined, refactor.
- A dependency has no functional reason → inspect coupling before revising the DAG.
- ⚠️ Plan invents AC not traceable to `spec.md` → anti-pattern; every AC must trace.
- ⚠️ Plan mentions technologies not justified by `spec.md` constraints → tech-creep, reopen Phase 1.
- ⚠️ Step 13 (`tdd-design` invocation) never produces tests.md/validations.md → skill-to-skill failed; Lead must invoke manually.

## Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Tech-creep into Phase 2 | Plan mentions library X without it being in `spec.md` Constraints | Verify Phase 1 justified it; if not, reopen scope |
| Synthetic AC | AC in HU not traceable to a `spec.md` AC or Open question | Every AC must trace; if not, remove or surface to user |
| DAG theater | Plan with N HUs but no real DAG (all 🔵 trivially) | Either it's genuinely trivial (Quick) or granularity is wrong (refactor) |
| Skipping research | Standard+ plan produced without Context7 verification of external APIs | STOP, do research; obsolescence will bite in Phase 3 |
| HU "create everything" | One HU with 10+ files in `files` | Split — atomicity requires ≤5 files per HU |
| Drillme bypass | Plan closes without running Phase 2 drillme | Hard gate internal before producing final tasks/ |

## Commandments cubiertos

| # | Cómo |
|---|---|
| II | Context7/Grep/WebFetch + LSP before asserting any technical claim |
| V | Drillme drills 1 + 3 detect over-engineering and non-atomicity |
| I | Obligatory research = understand before planning |
| X | DAG exposes real dependencies and opportunities without forced parallelism |
| VIII | Structured questionnaires + targeted research; delegation prompts reviewed by `prompt-engineer` |

## Content map

| Topic | File | Contents |
|---|---|---|
| Anti-duplicate Discovery (sources + pre-create checks) | `${CLAUDE_SKILL_DIR}/references/01-discovery.md` | Static/dynamic sources + Glob/Grep checks before "create X". Read when about to plan a new module/file/function. |
| Anti-obsolescence Research (Context7 + WebFetch) | `${CLAUDE_SKILL_DIR}/references/02-research.md` | When/how to verify external APIs against docs; anti-stale-knowledge. Read when `spec.md` references external libraries or unfamiliar domains. |
| Gap Analysis per change type | `${CLAUDE_SKILL_DIR}/references/03-gap-analysis.md` | Ground-truth checklists for each change type before generating HUs. Read when verifying that planned changes don't collide with existing code. |
| Task classification and dependency waves | `${CLAUDE_SKILL_DIR}/references/04-classification-waves.md` | Read when dividing work into verifiable HUs and deciding dependencies. |
| Team Mode + cross-validation (Full level) | `${CLAUDE_SKILL_DIR}/references/05-team-mode.md` | Four-Eyes workflow for complexity >60. Read when entering Full mode and architectural risk justifies cross-perspective audit. |
| Quality Gates + Poka-Yoke + TDD checklist | `${CLAUDE_SKILL_DIR}/references/06-quality-gates.md` | Pre-close checklist: every quality bar that must pass before reporting plan close. Read in Step 12 before reporting. |

## Output format reminder

When this skill closes Phase 2:

```
Phase 2 closed for {NNN}-{slug}:
- Level: Quick|Standard|Full — <reason>
- TDD-mode: forced|adaptive|optional — <reason from test-policy.md>
- tasks/index.md: .claude/plans/{NNN}-{slug}/tasks/index.md
- HUs: N atomic stories in M waves
- Dependencies: <reasons for sequential work and independent waves>
- Critical path: ~X sessions
- Research sources: <list>
- Drillme: <covered N/4 Socratic categories>
- tdd-design invoked: yes|no (if no, Lead invokes manually)

⚪ Hard gate 2->3 — pendiente tu aprobación de tasks/ + tests.md/validations.md
   antes de Phase 3 (build). Responde: APPROVE | REFINE | BLOCK.
```
