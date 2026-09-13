---
parent: drillme-clarify
name: principle-and-evidence
description: Why drillme-clarify exists — the Tenth Man principle, the doctrine it operationalizes and the research backing selective clarification.
---

# Underlying principle

Relocated verbatim from `SKILL.md` on 2026-09-03 (plan 032/WP4 — progressive disclosure).

> "If everyone is thinking alike, then somebody isn't thinking." — Tenth Man Rule

Most engineering pain comes from deciding with hidden gaps — assumptions nobody surfaced, edge cases nobody named, requirements left to chance. The doctrine (`output-styles/poneglyph.md` §Truth — ask in rounds while doubt would change the outcome) is explicit: *ask in rounds — including lateral/improvement questions — until no remaining question would change the decision.* Drillme is the catalog that operationalizes it. Exhaustive does **not** mean "many questions on everything" — it means **cover the whole space of ambiguity without redundancy**: every question must carry information gain (the anti-padding guard). Research backing: clarifying selectively (not always/never) and stopping at information-gain saturation reduces both errors and wasted questions ([Active Task Disambiguation, arXiv 2502.04485](https://arxiv.org/pdf/2502.04485); [SAGE-Agent EVPI, arXiv 2511.08798](https://arxiv.org/html/2511.08798v1)).

## Why "always active" and "no over-engineering" do not conflict

A typo surfaces no gaps, so drillme-clarify runs and closes with zero questions; an ambiguous feature surfaces many, so it asks until they are gone. The gate is binary and generation-executable; there is no graduated calibration ("N questions for trivial, M for architectural").

## Rounds: from a floor to a gap-driven close (031 → 032)

Rule 031 imposed a minimum of two funnel rounds whenever the gap gate returned Yes, after a real failure (closing in one round with gaps still open). Plan 032 (decision D7, 2026-09-03) replaced the floor with a gap-driven rule: open the next round while a gap that would change the decision remains; a one-round close is legitimate only when the answers verifiably closed every gap, and the closure must say so. The failure the floor guarded against is now named as the anti-pattern "Premature close".
