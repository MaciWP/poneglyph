---
parent: dev
name: on-request-lenses
description: The two on-request procedures of the dev skill — the over-engineering diff review lens and the ponytail debt harvest.
---

# On-request lenses

Relocated verbatim from `SKILL.md` (Stage 4 and Stage 5 sub-bullets) on 2026-09-03 (plan 032/WP4).

## Diff review lens (Stage 4, on request — "revisa este diff por sobreingeniería")

One line per finding, tagged `delete:` (shouldn't exist) · `stdlib:` · `native:` ·
`yagni:` (premature) · `shrink:` (same behavior, less code). Scope strictly
over-engineering — correctness/security belong to `critic`/`review-patterns`.

## Debt harvest (Stage 5, on request — "cosecha la deuda")

`grep -rn "ponytail:"` over the repo → ledger of cuts with ceiling/trigger; flag any
marker missing its upgrade trigger. A `ponytail:` comment without an upgrade trigger
is not a cut, just a bug you documented — add the trigger or treat it as a bug.
