# Retro — auxiliary skills matrix + edge cases + smells + anti-patterns

Extracted verbatim from `SKILL.md` (017/US9 — mechanical move, no content redesign).

## Contents

- [Auxiliary skills invoked](#auxiliary-skills-invoked)
- [Casos edge](#casos-edge)
- [Smell signals](#smell-signals)
- [Anti-patterns](#anti-patterns)
- [Verification (post-implementation of this skill)](#verification-post-implementation-of-this-skill)

## Auxiliary skills invoked

> Canonical matrix in `.claude/docs/auxiliary-skills-matrix.md`. Row below is the literal subset that applies to this Phase 5 skill.

| Auxiliary skill | When this skill invokes it | Fallback if skill->skill fails |
|---|---|---|
| `anti-hallucination` | Before proposing any promotion — verify the target path does not collide with an existing file/skill/rule | Lead Globs/Reads the target path manually before the promotion is listed |
| `drillme` | Step 7 — applies 5 retro-specific questions covering `[approach]`/`[context]`/`[failure]` | Lead invokes `/drillme "Phase 5 retro of <NNN-slug>"` manually before declaring the feature closed |
| `explain-changes` | ⚠️ Conditional — if the retro produces an educational walkthrough as a candidate promotion (e.g., a doc.md to onboard newcomers to this area) | Lead invokes `/explain-changes` manually if the candidate is a learning artefact |
| `meta-create` | ⚠️ Conditional — if a promotion candidate is a new skill/rule/hook/agent/command/MCP/plugin and the sketch needs the official frontmatter spec | Lead Reads `.claude/skills/meta-create/SKILL.md` references manually before sketching the candidate |
| `meta-settings-cookbook` | ⚠️ Conditional — if a promotion candidate touches CLAUDE.md, settings.json, output styles, or permissions | Lead Reads `.claude/skills/meta-settings-cookbook/SKILL.md` references manually |

> Skill-to-skill invocation is **probabilistic** per docs Anthropic + [issue #59968](https://github.com/anthropics/claude-code/issues/59968). Phase 5 is focused on synthesis — `anti-hallucination` and `drillme` are the canonical auxiliaries; `explain-changes`/`meta-create`/`meta-settings-cookbook` are conditional based on what the promotion candidates are. Honest 2 ✅ + 3 ⚠️.

## Casos edge

- **Edge 1** — `review.md.verdict: BLOCKED` → STOP; do not produce retro; route back to Phase 3/4 first.
- **Edge 2** — `spec.md` original no longer exists (deleted or branch reset) → produce retro on what was delivered + flag "spec.md missing — retro based on tasks/ and review.md only" in retro.md.
- **Edge 3** — Promotion candidate name collides with existing file in target scope → propose rename ("candidate-name-2") OR propose merge (diff against existing) — never overwrite silently.
- **Edge 4** — `spec_drift: legitimate` AND user rejects the proposed diff → record rejection reason in retro.md; either revert the delta in code (action item) OR escalate to re-scope.
- **Edge 5** — User approves a promotion mid-session → Lead writes the target file inline (Lead default-allow gate covers non-sensitive paths); update retro.md.promotions_approved counter.
- **Edge 6** — Retro proposes a promotion that turns out to be a near-duplicate of an existing skill — flag in §Lessons ❌ ("missed existing skill X during scope/plan") + redirect promotion to "improve existing X" instead of "create new".

## Smell signals

- ⚠️ Retro with empty ❌ lessons list → smell of review theater; force the question "what slowed us down?" — there's always something.
- ⚠️ 3+ consecutive retros with zero promotions → system is "perfect" (improbable) OR retro isn't honest enough; audit retro process itself.
- ⚠️ Living-spec deltas in >50% of retros → Phase 1 (scope) is too superficial; reopen `scope` skill criteria.
- ⚠️ Commandment violations recorded in 3+ consecutive retros without corrective action items applied → action items aren't being followed up; escalate to dedicated meta-retro.
- ⚠️ Promotion approved but never materialized (file not written in 2+ sessions) → either the candidate was wrong or follow-through is broken; remove the candidate.
- ⚠️ Retro produced AFTER the user has already moved on to a new feature → retro lost its window; capture lightweight insights in MEMORY.md and skip the formal retro.md.

## Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Synthetic promotion to fill the table | Promotion without concrete evidence from this feature | Remove; declare "zero promotions" honestly |
| Auto-editing spec.md | `spec.md` modified in the same session as the retro without explicit user approval | Revert + propose as living-spec diff for approval |
| Commandment audit all ✅ without evidence | All 10 rows green with one-word evidence ("yes", "ok") | Re-audit with concrete file:line or commit refs |
| Promotion scope wrong | Project-specific pattern promoted to `~/.claude/` global | Re-classify to local; global is reserved for cross-project patterns |
| Lifecycle closed with promotions still pending | spec.md `status: closed` while `promotions_approved < promotions_proposed` | Reopen or carry promotions explicitly as action items |
| Living-spec delta routed wrong | `scope_creep` proposed as `legitimate` | Re-check the 3 criteria (real edge case / no contradiction / documented why); demote to scope_creep |

## Verification (post-implementation of this skill)

- Smoke: invoke `/retro` on a feature with `review.md: APPROVED` → produces `retro.md` with 8 sections + promotion candidates.
- Verify `retro.md` frontmatter declares `retro_level` + `spec_drift` consistent with `review.md`.
- Verify NO auto-edit of `spec.md` (the file mtime should NOT change during retro; only retro.md is written).
- Verify `status: closed` is applied to `spec.md` + `tasks/index.md` only after user approval (or at end of full retro level).
- `bun test ./.claude/hooks/` → green (this skill is markdown — no hook test impact).
