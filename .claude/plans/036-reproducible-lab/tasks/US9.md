---
us: US9
title: History, repeat and comparison
depends_on: [US1]
tdd: forced
status: closed
approved: 2026-09-08
closed: 2026-09-08
---
# Execution prompt

Task: Implement history, repeat and comparison.
Context: Approved spec and tests.md; existing historical implementation was read before reuse.
Constraints: Work inline. Use temporary fixtures. Do not start model workers or change native configuration during development.
Deliverable: .claude/lab/{report.ts}, associated tests and documentation.
Verify: Repeat preserves frozen definitions; comparisons expose confounders and missing attempts. Run focused tests before implementation and after changes. Run the final project gates on the assembled change.
Ask first: Native model execution needs explicit model and budget; other choices follow the approved design.

## Acceptance criteria
Repeat preserves frozen definitions; comparisons expose confounders and missing attempts.
