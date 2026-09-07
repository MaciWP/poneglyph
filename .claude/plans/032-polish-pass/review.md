---
spec: 032-polish-pass
tasks_implemented: [WP0, WP1, WP2, WP3, WP4, WP5, WP6, WP7]
oracle_source: none
oracle_substitute: plan.md Verification (historical summary) + validation.md (historical summary)
created: 2026-09-03
phase: 4
status: draft
review_level: full
review_level_reason: >
  Touches the always-loaded doctrine layer (CLAUDE.md, rules, output style), the
  public/private repo split, hooks and generated settings. 8 work packages,
  108 working-tree entries, ~600 insertions + ~4900 deletions.
verdict: NEEDS_CHANGES
verdict_status: "CONFIRMED (validation.md Round 4, 2026-09-03 — re-run this session). F2 closed since Round 3 (activation/ evidence now on disk). Still open: E7/H1 (+3,2% vs HEAD, confirmed not a metric bug) and E9 (no evals figure against post-revert content). Oriol still ratifies V1–V3 + check #6."
spec_drift: skipped_ac
findings_count:
  blocker: 0
  major: 2
  minor: 4
  nit: 2
fresh_reviewer_invoked: pending (spawn gate — CLAUDE.md §Agent spawn, permission + model not yet given)
security_review_invoked: no (diff touches no auth/payments/secrets; the privacy channel is reviewed inline)
review_patterns_modes: [quality]
---

# Plan 032: independent review

Historical public summary, prepared during PR #3 privacy review on 2026-09-07.
The unmodified original is preserved in private Work memory with its Git blob
identity. This file is not active instructions or fresh verification.

The recorded verdict remains NEEDS_CHANGES. The review challenged the claimed
budget reduction and the provenance/freshness of activation and evaluation
evidence. It distinguished retained skill text, effective loading, and measured
behavior instead of treating them as interchangeable.

## Findings retained

F1/E7 concerned incomplete budget accounting. F2 concerned missing evidence that
later became available. F3 exposed a privacy gate that excluded historical
documents. F4/E9 concerned missing fresh evaluations. F5 corrected an unsupported
claim of mechanical authorship enforcement; other findings covered bookkeeping,
sync parsing, and informational CI validation.

The original statement that nothing leaked was not justified. Historical
exceptions did not make company-bearing source private. PR #3 removes those
exceptions and preserves the originals in private memory; public history remains
exposed until separately remediated.

## Next step

Keep budget and behavioral acceptance decisions separate from PR #3's static
contracts. Do not change this historical verdict merely because today's tests
pass. No new reviewer or live evaluation is claimed here.
