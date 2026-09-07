---
parent: meta-create
name: doctrine-sweep
description: Protocol for propagating a canonical-decision change across every site that states the old doctrine — grep inventory, re-scope each site, re-grep to zero stale, record in decision history.
---

# Doctrine sweep — when a canonical decision changes

When a feature changes a CANONICAL decision (a default, a rule, a dispatch target, a threshold — anything other components cite as doctrine), editing the owning file is half the job. Every site that states the old doctrine becomes a lie the moment the change lands (Commandment IX — the system doesn't rot). This protocol is the other half.

**Provenance**: feature 017's only Phase 4 MAJORs were stale-doc debt ("component → its docs, same HU"); feature 019/US2 ran this exact protocol for the panel→fresh-reviewer demotion (11 sites, 4 files, zero stale at verify); the 2026-06-11 census found the one place 019 missed it — a dead `skill-advisor` section surviving in always-loaded CLAUDE.md.

## Trigger

Any edit that changes what OTHER files assert: defaults (review form, spawn rules), thresholds, dispatch targets, component existence (create/cut/rename), policy levels. If only the owning file knows the fact, no sweep needed.

## Protocol

1. **Inventory BEFORE editing**: `grep -rn "<term/concept>" .claude/ CLAUDE.md --include="*.md" --include="*.ts"` (exclude `plans/_archive`). List every hit: file:line + whether it states the doctrine (must change), cites it historically (legitimate — plans/, decision histories), or is unrelated.
2. **Size the blast radius into the plan**: >5 files of doctrine sites → split propagation into its own HU/step (lesson 019: US1 owner-file + US2 propagation).
3. **Edit each doctrine site** — re-scope, don't delete blindly: a demoted pattern usually remains valid in a narrower scope (e.g. panels stayed valid for decision review).
4. **Re-grep until zero stale**: every remaining hit must be historical/decision-history context. A live file asserting the old doctrine = not done.
5. **Record the decision**: add a dated row to the owning skill's decision history (e.g. `critic/references/01-decisions-and-auxiliaries.md`) citing the evidence and what changed.
6. **Verify**: tests green; if the change touches behavioral meta-config, run the golden-prompt regression (`bun .claude/evals/run.ts` — in the poneglyph repo; evals/ is not synced).

## Smells

- ⚠️ Always-loaded layers (CLAUDE.md, rules/) are the highest-cost place for a stale reference — check them FIRST, not last.
- ⚠️ "I'll update the docs in a follow-up" → that follow-up is the truth-debt 017 paid interest on. Same HU, same commit.
- ⚠️ Sweep finds >2 sites the plan didn't anticipate → blast radius was under-counted; update the plan/HU before continuing, don't silently expand.
