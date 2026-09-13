# Auxiliary skills matrix (canon — referenced by each phase SKILL.md)

> Source of truth for which auxiliary skills each phase skill invokes, **and** (since 2026-09-03, plan 032/WP4) for the per-phase "when + manual fallback" rows that used to sit in each phase SKILL.md (§Fallbacks per phase below). Phase SKILL.md files keep a two-line pointer; critic and retro wire their auxiliaries in their own references; drillme-clarify's row is behavioral-only. Relocated here from `001-poneglyph-5phase-workflow/tasks/index.md` when that plan was archived (2026-06-24); the matrix is live canon, the plan is history.

## Catálogo de auxiliaries

| Auxiliary skill | Propósito | Disable-model-invocation |
|---|---|---|
| `drillme-clarify` | Socratic check (4 categorías canónicas + complementarios) | false (auto) |
| `compare-and-decide` (heavy tier) | 5-12 perspectives en paralelo + cross-debate + synthesis + vote | false |
| `troubleshooting` | Debug, retry, recovery, 5-whys, circuit breaker, saga | false |
| `code-quality` | Quality (SOLID/DRY/complexity) + Performance (N+1/leaks/async) modes | false |
| `prompt-design` | Prompt quality (refinar / generar / review delegation / audit) | false |
| `changes-explain` | Educational walkthrough de cambios para entender / aprender | false |
| `harness-config` | Configuración nativa de los tres arneses (consultar, crear, modificar, desactivar, borrar) | false |
| `security-review` (native built-in — NOT our skill; ours is `security-audit`) | Security review del branch pendiente | (native) |
| `simplify` (plugin) | Review code for reuse/quality/efficiency + fix | (plugin) |

## Cruce: qué phase skill invoca a qué auxiliary

| Phase skill | drillme-clarify | decide (heavy tier) | troubleshooting | code-quality | prompt-design | changes-explain | harness-config | security-audit | simplify |
|---|---|---|---|---|---|---|---|---|---|
| **scope** (F1) | ✅ cierre fase | ⚠️ modo full (perspectives producto) | — | — | ✅ brief vago → refinar | — | — | — | — |
| **flow-plan** (F2) | ✅ cierre fase | ✅ modo full (2+ alternativas técnicas) | — | — | ✅ review delegation prompts | — | ✅ si plan crea o toca config nativa | — | — |
| **flow-test-plan** (F2.5) | ✅ cierre fase | — | — | — | — | — | — | — | — |
| **build** (F3) | ✅ intra-HU | — | ✅ tests fallan → 5-whys | ⚠️ opcional — quality durante escritura | — | — | ✅ si HU crea o toca config nativa | — | — |
| **critic** (F4) | ✅ cierre fase | ⚠️ si revela decisión arquitectónica | ✅ tests fallan en ejecución | ✅ modo quality/performance según contenido | — | ⚠️ si reviewer humano necesita walkthrough | — | ✅ auth/payments/secrets/credentials | ⚠️ refactor opcional |
| **retro** (F5) | ✅ cierre feature | — | — | — | — | ⚠️ si retro produce doc educativo | ⚠️ si retro propone skill/config nativa | — | — |
| **drillme-clarify** (transversal) | — | ✅ escalación cuando alcanza techo | — | — | — | — | — | — | — |

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
| `drillme-clarify` | Before closing Phase 1 (hard gate 1->2) — applies 5 phase questions + canonical 4 Socratic categories | Lead invokes `/drillme-clarify "Phase 1 closing for <NNN-slug>"` manually before approving |
| `prompt-design` | When the user's initial brief is too vague (multiple interpretations, missing success criteria) and refinement is warranted before the questionnaire | Lead applies the 5-criteria rubric inline; refines manually |
| `compare-and-decide` (heavy-tier catalog) | Mode `full` only — reuses Outsider/Product/User perspective templates from `decide/references/heavy/01-perspectives.md` (NOT invoking the full stress-test pipeline, only the prompt catalog) | Lead spawns the 3 perspectives directly with `Agent(subagent_type=general-purpose, model=<mid tier, explicit>, prompt=<adapted from catalog>)`; results arrive as task notifications |

The downstream `flow-plan` skill (Phase 2) is NOT invoked by scope — it waits on the human hard gate 1->2.

### flow-plan (Phase 2)

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `drillme-clarify` | Before closing Phase 2 (hard gate 2->3) — applies 6 phase questions + canonical 4 Socratic categories | Lead invokes `/drillme-clarify "Phase 2 plan closing for <NNN-slug>"` manually before approving |
| `compare-and-decide` (heavy tier) | Full mode + 2+ technically reasonable alternatives surfaced — stress-test before committing | Lead invokes `/compare-and-decide "<the choice>"` manually (its classifier lands on the heavy tier); downgrade plan confidence one tier if skipped |
| `prompt-design` | When reviewing delegation prompts that the plan will hand off to `flow-build` skill in Phase 3 (Arch H compliance) | Lead applies 5-criteria rubric inline to the delegation prompts |
| `harness-config` | When any HU plans to create or touch native harness config (skill/command/hook/rule/MCP/plugin/agent/settings/permissions) | Lead reads `harness-config` and the matching type pack (when present) before the HU is finalized |
| `flow-test-plan` (downstream) | Step 13 — invoke explicitly after producing tasks/ to generate tests.md/validations.md | Lead invokes `/flow-test-plan` manually; the human hard gate 2->3 requires both tasks/ AND tests/validations |

`flow-test-plan` invocation in Step 13 is critical — Lead MUST verify post-skill that tests.md/validations.md was produced; re-invoke manually if missing.

### flow-test-plan (Phase 2.5)

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `drillme-clarify` | Before closing Phase 2.5 — applies 3 phase-specific questions + canonical Socratic catalog | Lead invokes `/drillme-clarify "Phase 2.5 oracle design for <NNN-slug>"` manually before approving hard gate 2->3 |
| Project test-conventions skill (e.g. a `<stack>-testing-patterns` skill) | TDD-mode Step 1.7 — load it to inherit the project's fixture philosophy, factory usage, and anti-duplication rules; its specifics override this generic skill | Lead Globs `**/conftest.py`/`**/factory*.py` and reads the existing test suite manually to mirror its conventions |

Phase 2.5 is the most focused phase — only 2 auxiliaries truly apply. Other auxiliaries (e.g., `compare-and-decide` (heavy tier)) belong to other phases and would be ceremony here.

### build (Phase 3)

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `drillme-clarify` | Intra-HU before declaring done (Step 7 — 4 `[approach]` questions) | Lead invokes `/drillme-clarify "Phase 3 HU US{N}"` manually before closing the HU |
| `troubleshooting` | When tests fail in Step 8 verification (5-whys, retry budget, stack-trace analysis) | Lead reads error output manually + applies error-recovery.md retry policy |
| `code-quality` | ⚠️ Optional — during impl if quality concern emerges (SOLID violation suspected, performance bottleneck) | Lead invokes `/flow-review` code-quality mode in Phase 4 anyway; intra-impl invocation is opportunistic |
| `harness-config` | When HU's `files` field includes new `.claude/skills/`, `.claude/hooks/`, `.claude/rules/`, `.claude/plugins/`, `.mcp.json`, or touches `CLAUDE.md` / settings / output styles / permissions / env | Lead reads `harness-config/SKILL.md` (and the matching type pack when present) before designing the change (Commandment IX — meta-system maintainability) |

For Phase 3, the canonical auxiliaries (drillme-clarify, troubleshooting) MUST fire on every HU — the fallback column documents the Lead's manual recovery if auto-fire misses. `code-quality` is opportunistic (⚠️); `harness-config` is conditional on HU content.

### critic (Phase 4) and retro (Phase 5)

Wired in their own references: `critic/references/01-decisions-and-auxiliaries.md`, `retro/references/01-auxiliaries-and-guards.md`.
