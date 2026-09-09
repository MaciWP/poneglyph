---
us: US1
title: Versioned contracts and experiment storage
depends_on: []
tdd: forced
status: closed
approved: 2026-09-08
closed: 2026-09-08
---
# Execution prompt

Task: Implement versioned contracts and experiment storage.
Context: Approved spec and tests.md; existing historical implementation was read before reuse.
Constraints: Work inline. Use temporary fixtures. Do not start model workers or change native configuration during development.
Deliverable: .claude/lab/store.ts (contracts and storage), associated tests and documentation.
Verify: Immutable prompts and experiments; invalid references and unsafe paths fail. Run focused tests before implementation and after changes. Run the final project gates on the assembled change.
Ask first: Native model execution needs explicit model and budget; other choices follow the approved design.

## Acceptance criteria
Immutable prompts and experiments; invalid references and unsafe paths fail.
