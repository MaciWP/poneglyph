---
us: US3
title: Recoverable configuration transaction
depends_on: [US2]
tdd: forced
status: closed
approved: 2026-09-08
closed: 2026-09-08
---
# Execution prompt

Task: Implement recoverable configuration transaction.
Context: Approved spec and tests.md; existing historical implementation was read before reuse.
Constraints: Work inline. Use temporary fixtures. Do not start model workers or change native configuration during development.
Deliverable: .claude/lab/{transaction.ts}, associated tests and documentation.
Verify: Interrupted transitions restore bytes, links and absent paths; conflicts preserve originals. Run focused tests before implementation and after changes. Run the final project gates on the assembled change.
Ask first: Native model execution needs explicit model and budget; other choices follow the approved design.

## Acceptance criteria
Interrupted transitions restore bytes, links and absent paths; conflicts preserve originals.
