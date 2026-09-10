# Auxiliary skills matrix (canon — referenced by each phase SKILL.md)

> Source of truth for which auxiliary skills each phase skill invokes, **and** (since 2026-09-03, plan 032/WP4) for the per-phase "when + manual fallback" rows that used to sit in each phase SKILL.md (§Fallbacks per phase below). Phase SKILL.md files keep a two-line pointer; critic and retro wire their auxiliaries in their own references; drillme's row is behavioral-only. Relocated here from `001-poneglyph-5phase-workflow/tasks/index.md` when that plan was archived (2026-06-24); the matrix is live canon, the plan is history.

## Catálogo de auxiliaries

| Auxiliary skill | Propósito | Disable-model-invocation |
|---|---|---|
| `anti-hallucination` | Verificar premisas factuales (Glob/Grep antes de afirmar) | false (auto) |
| `drillme` | Socratic check (4 categorías canónicas + complementarios) | false (auto) |
| `decide` (heavy tier) | 5-12 perspectives en paralelo + cross-debate + synthesis + vote | false |
| `diagnostic-patterns` | Debug, retry, recovery, 5-whys, circuit breaker, saga | false |
| `review-patterns` | Quality (SOLID/DRY/complexity) + Performance (N+1/leaks/async) modes | false |
| `prompt-engineer` | Prompt quality (refinar / generar / review delegation / audit) | false |
| `explain-changes` | Educational walkthrough de cambios para entender / aprender | false |
| `meta-create` | Crear extensiones Claude Code (skills/commands/hooks/rules/MCP/plugin) | false |
| `meta-settings-cookbook` | Reference rápido para CLAUDE.md/settings.json/output styles/permissions | true (manual) |
| `security-review` (native built-in — NOT our skill; ours is `security-audit`) | Security review del branch pendiente | (native) |
| `simplify` (plugin) | Review code for reuse/quality/efficiency + fix | (plugin) |

## Cruce: qué phase skill invoca a qué auxiliary

| Phase skill | anti-hallucination | drillme | decide (heavy tier) | diagnostic-patterns | review-patterns | prompt-engineer | explain-changes | meta-create | meta-settings-cookbook | security-audit | simplify |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **scope** (F1) | ✅ premisas factuales del brief | ✅ cierre fase | ⚠️ modo full (perspectives producto) | — | — | ✅ brief vago → refinar | — | — | — | — | — |
| **tech-plan** (F2) | ✅ archivos/funciones/patrones del proyecto | ✅ cierre fase | ✅ modo full (2+ alternativas técnicas) | — | — | ✅ review delegation prompts | — | ✅ si plan crea skills/hooks/rules | ✅ si plan toca CLAUDE.md/settings | — | — |
| **tdd-design** (F2.5) | ✅ funciones/módulos referenciados | ✅ cierre fase | — | — | — | — | — | — | — | — | — |
| **build** (F3) | ✅ cada Edit/Write previa verificación | ✅ intra-HU | — | ✅ tests fallan → 5-whys | ⚠️ opcional — quality durante escritura | — | — | ✅ si HU = crear extensión | ✅ si HU toca config | — | — |
| **critic** (F4) | ✅ findings antes de reportar | ✅ cierre fase | ⚠️ si revela decisión arquitectónica | ✅ tests fallan en ejecución | ✅ modo quality/performance según contenido | — | ⚠️ si reviewer humano necesita walkthrough | — | — | ✅ auth/payments/secrets/credentials | ⚠️ refactor opcional |
| **retro** (F5) | ✅ promociones — paths existen | ✅ cierre feature | — | — | — | — | ⚠️ si retro produce doc educativo | ⚠️ si retro propone nueva skill/rule | ⚠️ si retro propone setting | — | — |
| **drillme** (transversal) | ✅ premisas en respuestas factuales | — | ✅ escalación cuando alcanza techo | — | — | — | — | — | — | — | — |

Leyenda: ✅ = invocación canónica esperada · ⚠️ = condicional según contexto · — = no aplica

## Pointer block in each phase SKILL.md (since 2026-09-03, plan 032/WP4)

Phase skills no longer carry their own "Auxiliary skills invoked" table — the per-phase rows with the **when** and the **manual fallback** live here (§Fallbacks per phase). Each SKILL.md keeps a two-line pointer:

```markdown
## Auxiliary skills

Wiring and manual fallbacks for this phase: `.claude/docs/auxiliary-skills-matrix.md` §Fallbacks per phase. Skill-to-skill invocation is probabilistic (issue #59968) — when an auxiliary does not fire, apply its fallback row.
```

## Fallbacks per phase

> Skill-to-skill invocation is **probabilistic** per docs Anthropic + [issue #59968](https://github.com/anthropics/claude-code/issues/59968). Each row's fallback documents the Lead's manual recovery path.

### scope (Phase 1)

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `anti-hallucination` | Before asserting any premise the user mentions (file/function/path/library exists) | Lead applies Glob/Grep manually before including the premise in `spec.md` |
| `drillme` | Before closing Phase 1 (hard gate 1->2) — applies 5 phase questions + canonical 4 Socratic categories | Lead invokes `/drillme "Phase 1 closing for <NNN-slug>"` manually before approving |
| `prompt-engineer` | When the user's initial brief is too vague (multiple interpretations, missing success criteria) and refinement is warranted before the questionnaire | Lead applies the 5-criteria rubric inline; refines manually |
| `decide` (heavy-tier catalog) | Mode `full` only — reuses Outsider/Product/User perspective templates from `decide/references/heavy/01-perspectives.md` (NOT invoking the full stress-test pipeline, only the prompt catalog) | Lead spawns the 3 perspectives directly with `Agent(subagent_type=general-purpose, model=<mid tier, explicit>, prompt=<adapted from catalog>)`; results arrive as task notifications |

The downstream `tech-plan` skill (Phase 2) is NOT invoked by scope — it waits on the human hard gate 1->2.

### tech-plan (Phase 2)

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `anti-hallucination` | Before asserting any file/function/path/library exists in the project (Glob/Grep verify required for every claim in HUs) | Lead applies Glob/Grep manually before the HU is finalized |
| `drillme` | Before closing Phase 2 (hard gate 2->3) — applies 6 phase questions + canonical 4 Socratic categories | Lead invokes `/drillme "Phase 2 plan closing for <NNN-slug>"` manually before approving |
| `decide` (heavy tier) | Full mode + 2+ technically reasonable alternatives surfaced — stress-test before committing | Lead invokes `/decide "<the choice>"` manually (its classifier lands on the heavy tier); downgrade plan confidence one tier if skipped |
| `prompt-engineer` | When reviewing delegation prompts that the plan will hand off to `build` skill in Phase 3 (Arch H compliance) | Lead applies 5-criteria rubric inline to the delegation prompts |
| `meta-create` | When any HU plans to create a Claude Code extension (skill/command/hook/rule/MCP/plugin/agent) | Lead reads `meta-create` references manually to validate canon before HU is finalized |
| `meta-settings-cookbook` | When any HU plans to touch CLAUDE.md / settings.json / output-styles / env-vars / permissions | Lead reads relevant `meta-settings-cookbook` reference manually |
| `tdd-design` (downstream) | Step 13 — invoke explicitly after producing tasks/ to generate tests.md/validations.md | Lead invokes `/tdd-design` manually; the human hard gate 2->3 requires both tasks/ AND tests/validations |

`tdd-design` invocation in Step 13 is critical — Lead MUST verify post-skill that tests.md/validations.md was produced; re-invoke manually if missing.

### tdd-design (Phase 2.5)

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `anti-hallucination` | Before referencing any function/module/path in a test or validation — must exist or be in the HU's planned `files` | Lead applies Glob/Grep manually before the test/validation is finalized |
| `drillme` | Before closing Phase 2.5 — applies 3 phase-specific questions + canonical Socratic catalog | Lead invokes `/drillme "Phase 2.5 oracle design for <NNN-slug>"` manually before approving hard gate 2->3 |
| Project test-conventions skill (e.g. a `<stack>-testing-patterns` skill) | TDD-mode Step 1.7 — load it to inherit the project's fixture philosophy, factory usage, and anti-duplication rules; its specifics override this generic skill | Lead Globs `**/conftest.py`/`**/factory*.py` and reads the existing test suite manually to mirror its conventions |

Phase 2.5 is the most focused phase — only 2 auxiliaries truly apply. Other auxiliaries (e.g., `decide` (heavy tier)) belong to other phases and would be ceremony here.

### build (Phase 3)

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `anti-hallucination` | Before every Edit/Write — verify target file/function/path exists or is in the HU's planned `files` | Lead runs Glob/Grep manually before the operation |
| `drillme` | Intra-HU before declaring done (Step 7 — 4 `[approach]` questions) | Lead invokes `/drillme "Phase 3 HU US{N}"` manually before closing the HU |
| `diagnostic-patterns` | When tests fail in Step 8 verification (5-whys, retry budget, stack-trace analysis) | Lead reads error output manually + applies error-recovery.md retry policy |
| `review-patterns` | ⚠️ Optional — during impl if quality concern emerges (SOLID violation suspected, performance bottleneck) | Lead invokes `/critic` review-patterns mode in Phase 4 anyway; intra-impl invocation is opportunistic |
| `meta-create` | When HU's `files` field includes new `.claude/skills/`, `.claude/hooks/`, `.claude/rules/`, `.claude/plugins/`, `.mcp.json` | Lead reads `meta-create/SKILL.md` manually before designing the extension (Commandment IX — meta-system maintainability) |
| `meta-settings-cookbook` | When HU touches `CLAUDE.md`, `.claude/settings.json`, output styles, permissions, env vars | Lead reads `meta-settings-cookbook/SKILL.md` references manually |

For Phase 3, the canonical auxiliaries (anti-hallucination, drillme, diagnostic-patterns) MUST fire on every HU — the fallback column documents the Lead's manual recovery if auto-fire misses. `review-patterns` is opportunistic (⚠️); `meta-create`/`meta-settings-cookbook` are conditional on HU content.

### critic (Phase 4) and retro (Phase 5)

Wired in their own references: `critic/references/01-decisions-and-auxiliaries.md`, `retro/references/01-auxiliaries-and-guards.md`.
