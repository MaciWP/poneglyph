---
parent: meta-harness
name: doctrine-sweep
description: "Protocol for propagating a canonical-decision change across every site that states the old doctrine: grep inventory, re-scope each site, re-grep to zero stale, record in decision history."
---

# Doctrine sweep: when a canonical decision changes

When a feature changes a CANONICAL decision (a default, a rule, a dispatch target, a threshold, anything other components cite as doctrine), editing the owning file is half the job. Every site that states the old doctrine becomes a lie the moment the change lands (Commandment IX, the system doesn't rot). This protocol is the other half.

**Evidence**: the only major findings of one feature review were stale-doc debt ("component → its docs, same HU"); the protocol, run for the panel→fresh-reviewer demotion, covered 11 sites in 4 files with nothing stale at verify; a later census found the one place it missed: a dead `skill-advisor` section surviving in always-loaded CLAUDE.md.

## Trigger

Any edit that changes what OTHER files assert: defaults (review form, spawn rules), thresholds, dispatch targets, component existence (create/cut/rename), policy levels. If only the owning file knows the fact, no sweep needed.

## Protocol

1. **Inventory BEFORE editing**: `grep -rn "<term/concept>" .claude/ CLAUDE.md --include="*.md" --include="*.ts" --include="*.js" --include="*.json" --include="*.toml" --include="*.yaml"`. List every hit: file:line + whether it states the doctrine (must change), cites it historically (legitimate, plans/, decision histories), or is unrelated.
2. **Size the blast radius into the plan**: >5 files of doctrine sites → split propagation into its own HU/step (lesson 019: US1 owner-file + US2 propagation).
3. **Edit each doctrine site**: re-scope, don't delete blindly: a demoted pattern usually remains valid in a narrower scope (e.g. panels stayed valid for decision review).
4. **Re-grep until zero stale**: every remaining hit must be historical/decision-history context. A live file asserting the old doctrine = not done.
5. **Record the decision**: state the evidence and what changed in the commit message or the plan's `retro.md`; git holds the history, no history file is kept.
6. **Verify**: tests green; if the change touches behavioral meta-config, run the golden-prompt regression (`bun .claude/evals/run.ts`, in the poneglyph repo; evals/ is not synced).

## Smells

- ⚠️ Always-loaded layers (CLAUDE.md, rules/) are the highest-cost place for a stale reference: check them FIRST, not last.
- ⚠️ "I'll update the docs in a follow-up" → that follow-up is how truth-debt accrues. Same HU, same commit.
- ⚠️ Sweep finds >2 sites the plan didn't anticipate → blast radius was under-counted; update the plan/HU before continuing, don't silently expand.
