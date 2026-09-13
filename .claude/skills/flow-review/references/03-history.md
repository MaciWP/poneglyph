---
parent: critic
name: history
description: Rationale of the critic skill (why Phase 4 exists beyond per-HU tests) — history, not runtime procedure.
---

# critic — rationale

Relocated verbatim from `SKILL.md` §Underlying principle on 2026-09-03 (plan 032/WP4 — progressive disclosure).

> "Tests passing per HU prove the parts; the critic proves the whole." (Commandment IV — blocking gates; Commandment VII — observability and self-improvement)

Phase 3 closes HUs atomically — each HU red→green or validation-closed. Phase 4 asks the question Phase 3 cannot: **does the assembled set of HUs solve the original problem in spec.md, including the happy path the user actually walks?** Unit tests can all pass and the feature still be broken at the seams. The critic is the seam-checker.
