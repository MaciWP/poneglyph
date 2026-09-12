---
spec: 035-flow-coherence
phase: 5
status: draft
retro_level: light
verdict_phase4: APPROVED_WITH_WARNINGS
spec_drift: none
promotions_proposed: 0
promotions_approved: 0
created: 2026-09-08
---

# Implementation retrospective

## Outcome

Flow now checks reported verification before closure, records joint approval,
recovers document projections and uses a compact six-step guide. TDD and
requirement-based critique are explicit. Scope matches the approved plan.

## Lessons

- The upstream lifecycle fixture started with approved tasks. Starting from real draft documents exposed the missing approval projection.
- Applying verification requirements to every historical document prevented progressive migration. Unknown sibling evidence must remain untouched until that HU is reverified.
- A matching status is insufficient recovery evidence: completion dates can still be stale.
- Section edits with large exact-context patches caused avoidable retries; bounded replacements with explicit anchors resolved the documentation edits.

## Decisions

No promotions, scope deltas or additional repository changes are proposed. Keep
global synchronization and live behavioral evaluation outside this task, as agreed.
Retro ratification remains pending; producing this document does not approve it.
