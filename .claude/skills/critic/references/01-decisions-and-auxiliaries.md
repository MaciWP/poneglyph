# Critic — decisions history + auxiliary skills matrix

Extracted verbatim from `SKILL.md` (017/US9 — mechanical move, no content redesign).

## Independent review model: ONE fresh-context reviewer (panel demoted — feature 019)

| Era | Decision |
|---|---|
| Original (feature 001, AC7) | `reviewer` agent (Opus, read-only) KEEP-conditional — 1 agent invoked for complexity >60 OR critical area |
| Feature 008 | `reviewer` agent CUT. 1 agent forbidden (spawn decision tree P1). Robust independent review = panel of ≥4 fresh perspectives (Workflow, opt-in); no opt-in → inline + declared author-bias. |
| **Now (feature 019)** | **Panel ≥4 DEMOTED as code-review form.** Evidence (018 W1 D1/D3, W2 D1): deliberative panels are the measurably weak form for code (verifier gap; MAST 23.5% verification failures; LLM-judge ~80% FP vs deterministic 0%); Augment dropped its ensembler. Default = runnable mechanical checks + **ONE fresh-context read-only reviewer** constrained to correctness/requirements. This is the explicit **P1 exception** — the one agent whose value IS the fresh context (author≠evaluator). Panels remain valid ONLY for decision review (`decide` (heavy tier) — their A/B-supported niche). User ratified the complete demotion (no code `--panel` flag) at the 019 gate-entry questionnaire, 2026-06-10. |

**Effect (008)**: `.claude/agents/reviewer.md` deleted; `agent-memory/reviewer/MEMORY.md` archived under `plans/008-agent-spawn-policy/archive/`.
**Effect (019)**: critic Step 7 dispatches the fresh reviewer at standard/full; `review_panel_invoked` frontmatter field → `fresh_reviewer_invoked`; doctrine propagated to `orchestrator-protocol` (P1/P4), `flow.md`, `system-inventory.md`. The independence lesson (author≠evaluator, feature 002; `independent-reviewer-when-self-assessing` memory) is preserved — now via fresh context instead of lens count.

## AC8 decision: `review-patterns` skill — KEEP

| Aporte único | Cubierto por `critic`? |
|---|---|
| SOLID violations detail (5 principios) | NO — critic checklist is generic |
| Complexity metrics (cyclomatic/cognitive) | NO |
| Anti-patterns catalog | NO |
| Extract function/class patterns | NO |
| N+1 query patterns + variants | NO |
| Memory leak patterns | NO |
| Refactoring safety checklists | NO |

**Verdict**: KEEP `review-patterns`. `critic` invokes it as catalog via `Read .claude/skills/review-patterns/references/<mode>.md` during Step 6. Zero content duplication.

## Auxiliary skills invoked

> Canonical matrix in `.claude/docs/auxiliary-skills-matrix.md`. Row below is the literal subset that applies to this Phase 4 skill.

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `anti-hallucination` | Before reporting any finding — verify file/line/symbol actually exists in the diff (no invented findings) | Lead Reads/Greps the file before the finding is finalized |
| `drillme` | Before declaring verdict (Step 9 — 4 questions across `[context]`/`[failure]`/`[approach]`) | Lead invokes `/drillme "Phase 4 review of <NNN-slug>"` manually before verdict |
| `diagnostic-patterns` | When Step 4 base checks fail — 5-whys, stack-trace analysis, retry budget per error-recovery.md | Lead reads error output manually + applies retry policy |
| `lsp-operations` | During Step 5 Correctness/Quality — `findReferences`/`callHierarchy` to verify blast radius of changed symbols | Lead uses Grep + Read manually as fallback |
| `review-patterns` | Step 6 — MANDATORY catalog invocation in standard/full levels (quality or performance mode per diff content) | Lead Reads `references/01-mode-quality.md` or `02-mode-performance.md` manually |
| `security-audit` | Step 7 — MANDATORY dispatch when diff touches auth/payments/secrets/credentials/crypto (gate, not advisory; Cmd VI) | Lead invokes `/security-audit` manually before declaring verdict if auto-fire missed |
| `decide` (heavy tier) | ⚠️ Conditional — if Step 5 reveals an architectural decision that merits adversarial challenge (e.g., questionable abstraction or library choice) | Lead invokes `/decide (heavy tier)` manually if doubt warrants it |
| `explain-changes` | ⚠️ Conditional — if a human needs a walkthrough of the diff for context | Lead invokes `/explain-changes` manually if requested |
| `simplify` | ⚠️ Conditional — refactor opportunity surfaced but not mandatory | Lead may invoke `/simplify` post-review if findings warrant |

> Skill-to-skill invocation is **probabilistic** per docs Anthropic + [issue #59968](https://github.com/anthropics/claude-code/issues/59968). Critical auxiliaries in Phase 4 are `review-patterns` (catalog) and `security-audit` (gate — MANDATORY DISPATCH even if auto-fire succeeded). Other auxiliaries are best-effort; the fallback column documents manual recovery.

## Verification (post-implementation of this skill)

- Smoke: invoke `/critic` on a feature with all HUs closed → produces `review.md` with 5 sections + verdict.
- Verify `review.md` frontmatter declares `review_level` + reason.
- Verify findings cite `file:line` (no vague references).
- Verify `fresh_reviewer_invoked` flag matches the level decision (yes at standard/full on code; n/a at light).
- `bun test ./.claude/hooks/` → green (this skill is markdown — no hook test impact).
