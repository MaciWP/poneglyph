# Auxiliary skills matrix (canon — referenced by the `flow` skill)

> Source of truth for which auxiliary skills each `flow` phase invokes, **and** (since 2026-09-03, plan 032/WP4) for the per-phase "when + manual fallback" rows (§Fallbacks per phase below). `skills/flow/SKILL.md` keeps a one-line pointer; since the 2026-09-17 merge the review and retro rows live here too; drillme-clarify's row is behavioral-only. Relocated here from `001-poneglyph-5phase-workflow/tasks/index.md` when that plan was archived (2026-06-24); the matrix is live canon, the plan is history.

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

| `flow` phase | drillme-clarify | decide (heavy tier) | troubleshooting | code-quality | prompt-design | changes-explain | harness-config | security-audit | simplify |
|---|---|---|---|---|---|---|---|---|---|
| **scope** (phase 1) | ✅ cierre fase | — | — | — | ✅ brief vago → refinar | — | — | — | — |
| **plan** (phase 2) | ✅ cierre fase | ✅ modo full (2+ alternativas técnicas) | — | — | ✅ review delegation prompts | — | ✅ si plan crea o toca config nativa | — | — |
| **test-plan** (phase 2.5) | ✅ cierre fase | — | — | — | — | — | — | — | — |
| **build** (phase 3) | ✅ intra-HU | — | ✅ tests fallan → 5-whys | ⚠️ opcional — quality durante escritura | — | — | ✅ si HU crea o toca config nativa | — | — |
| **review** (phase 4) | ✅ cierre fase | ⚠️ si revela decisión arquitectónica | ✅ tests fallan en ejecución | ✅ modo quality/performance según contenido | — | ⚠️ si reviewer humano necesita walkthrough | — | ✅ auth/payments/secrets/credentials | ⚠️ refactor opcional |
| **retro** (phase 5) | ✅ cierre feature | — | — | — | — | ⚠️ si retro produce doc educativo | ⚠️ si retro propone skill/config nativa | — | — |
| **drillme-clarify** (transversal) | — | ✅ escalación cuando alcanza techo | — | — | — | — | — | — | — |

Leyenda: ✅ = invocación canónica esperada · ⚠️ = condicional según contexto · — = no aplica

## Pointer in `skills/flow/SKILL.md` (since 2026-09-03, plan 032/WP4)

No phase reference carries its own "Auxiliary skills invoked" table — the per-phase rows with the **when** and the **manual fallback** live here (§Fallbacks per phase). `SKILL.md` §Shared discipline keeps the one-line pointer; skill-to-skill invocation is probabilistic (issue #59968), so on a miss the Lead applies the fallback row.

## Fallbacks per phase

> Skill-to-skill invocation is **probabilistic** per docs Anthropic + [issue #59968](https://github.com/anthropics/claude-code/issues/59968). Each row's fallback documents the Lead's manual recovery path.

### scope (phase 1 — `references/01-scope.md`)

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `drillme-clarify` | Before closing Phase 1 (hard gate 1->2) — applies 5 phase questions + canonical 4 Socratic categories | Lead invokes `/drillme-clarify "Phase 1 closing for <NNN-slug>"` manually before approving |
| `prompt-design` | When the user's initial brief is too vague (multiple interpretations, missing success criteria) and refinement is warranted before the questionnaire | Lead applies the 5-criteria rubric inline; refines manually |

The plan phase is NOT invoked by scope — it waits on the human hard gate 1->2. (The former full-mode product perspectives were cut in the 2026-09-17 merge.)

### plan (phase 2 — `references/02-plan.md`)

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `drillme-clarify` | Before closing Phase 2 (hard gate 2->3) — applies 6 phase questions + canonical 4 Socratic categories | Lead invokes `/drillme-clarify "Phase 2 plan closing for <NNN-slug>"` manually before approving |
| `compare-and-decide` (heavy tier) | Full mode + 2+ technically reasonable alternatives surfaced — stress-test before committing | Lead invokes `/compare-and-decide "<the choice>"` manually (its classifier lands on the heavy tier); downgrade plan confidence one tier if skipped |
| `prompt-design` | When reviewing the Execution prompts the plan hands to the build phase (Arch H compliance) | Lead applies 5-criteria rubric inline to the delegation prompts |
| `harness-config` | When any HU plans to create or touch native harness config (skill/command/hook/rule/MCP/plugin/agent/settings/permissions) | Lead reads `harness-config` and the matching type pack (when present) before the HU is finalized |
| test-plan phase (downstream) | Step 13 — run `references/03-test-plan.md` after producing tasks/ to generate tests.md/validations.md | Lead runs the phase manually; the human hard gate 2->3 requires both tasks/ AND tests/validations |

The Step 13 handover is critical — the Lead verifies that tests.md/validations.md exists; re-run the phase if missing.

### test-plan (phase 2.5 — `references/03-test-plan.md`)

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `drillme-clarify` | Before closing Phase 2.5 — applies 3 phase-specific questions + canonical Socratic catalog | Lead invokes `/drillme-clarify "Phase 2.5 oracle design for <NNN-slug>"` manually before approving hard gate 2->3 |
| Project test-conventions skill (e.g. a `<stack>-testing-patterns` skill) | TDD-mode Step 1.5 — load it to inherit the project's fixture philosophy, factory usage, and anti-duplication rules; its specifics override this generic skill | Lead Globs `**/conftest.py`/`**/factory*.py` and reads the existing test suite manually to mirror its conventions |

Phase 2.5 is the most focused phase — only 2 auxiliaries truly apply. Other auxiliaries (e.g., `compare-and-decide` (heavy tier)) belong to other phases and would be ceremony here.

### build (phase 3 — `references/04-build.md`)

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `drillme-clarify` | Intra-HU before declaring done (Step 7 — 4 `[approach]` questions) | Lead invokes `/drillme-clarify "Phase 3 HU US{N}"` manually before closing the HU |
| `troubleshooting` | When tests fail in Step 8 verification (5-whys, retry budget, stack-trace analysis) | Lead reads error output manually + applies error-recovery.md retry policy |
| `code-quality` | ⚠️ Optional — during impl if quality concern emerges (SOLID violation suspected, performance bottleneck) | The review phase runs the catalog anyway; intra-impl invocation is opportunistic |
| `harness-config` | When HU's `files` field includes new `.claude/skills/`, `.claude/hooks/`, `.claude/rules/`, `.claude/plugins/`, `.mcp.json`, or touches `CLAUDE.md` / settings / output styles / permissions / env | Lead reads `harness-config/SKILL.md` (and the matching type pack when present) before designing the change (Commandment IX — meta-system maintainability) |

For Phase 3, the canonical auxiliaries (drillme-clarify, troubleshooting) MUST fire on every HU — the fallback column documents the Lead's manual recovery if auto-fire misses. `code-quality` is opportunistic (⚠️); `harness-config` is conditional on HU content.

### review (phase 4 — `references/05-review.md`)

| Auxiliary skill | When this phase invokes it | Fallback if skill->skill fails |
|---|---|---|
| verify existence | Before reporting any finding — verify file/line/symbol actually exists in the diff (no invented findings) | Lead Reads/Greps the file before the finding is finalized |
| `drillme-clarify` | Before declaring the verdict (Step 9 — unresolved gaps across `[context]`/`[failure]`/`[approach]`) | Lead invokes `/drillme-clarify "Phase 4 review of <NNN-slug>"` manually before the verdict |
| `troubleshooting` | When Step 4 base checks fail — 5-whys, stack-trace analysis, retry budget per error-recovery.md | Lead reads the error output manually and applies the retry policy |
| `code-quality` | Step 6 — MANDATORY catalog in standard/full (quality or performance mode per diff content) | Lead Reads `references/01-mode-quality.md` or `02-mode-performance.md` manually |
| `security-audit` | Step 7 — MANDATORY dispatch when the diff touches auth/payments/secrets/credentials/crypto (gate, not advisory; Cmd VI) | Lead invokes `/security-audit` manually before the verdict |
| `changes-verify` | Step 5 Correctness — drive the assembled happy path when a runtime exists | Lead walks the flow manually and records what was observed |
| `compare-and-decide` (heavy tier) | ⚠️ Conditional — Step 5 reveals an architectural decision that merits adversarial challenge | Lead invokes it manually if the doubt warrants it |
| `changes-explain` | ⚠️ Conditional — a human needs a walkthrough of the diff | Lead invokes `/changes-explain` on request |
| `simplify` | ⚠️ Conditional — refactor opportunity surfaced, not mandatory | Lead may invoke `/simplify` after the review |

Critical auxiliaries in phase 4 are `code-quality` (catalog) and `security-audit` (gate — dispatched even when auto-fire succeeded).

### retro (phase 5 — `references/06-retro.md`)

| Auxiliary skill | When this phase invokes it | Fallback if skill->skill fails |
|---|---|---|
| verify existence | Before proposing any promotion — verify the target path does not collide with an existing file/skill/rule | Lead Globs/Reads the target path before listing the promotion |
| `drillme-clarify` | Step 6 — the Phase 5 bank over `[approach]`/`[context]`/`[failure]` | Lead invokes `/drillme-clarify "Phase 5 retro of <NNN-slug>"` manually before closing the feature |
| `changes-explain` | ⚠️ Conditional — a candidate promotion is an educational walkthrough | Lead invokes `/changes-explain` if the candidate is a learning artefact |
| `harness-config` | ⚠️ Conditional — a candidate is native harness config (skill/rule/hook/agent/command/MCP/plugin/settings/permissions) | Lead Reads `harness-config/SKILL.md` (and the matching type pack) before sketching the candidate |

Phase 5 is synthesis — `drillme-clarify` is the canonical auxiliary; the other two are conditional on what the candidates are.
