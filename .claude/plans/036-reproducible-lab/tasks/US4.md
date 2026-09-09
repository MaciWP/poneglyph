---
us: US4
title: Independent oracle and three baseline scenarios
depends_on: [US1]
tdd: forced
status: closed
approved: 2026-09-08
closed: 2026-09-08
---
# Execution prompt

Task: Implement independent oracle and three baseline scenarios.
Context: Approved spec and tests.md; existing historical implementation was read before reuse.
Constraints: Work inline. Use temporary fixtures. Do not start model workers or change native configuration during development.
Deliverable: .claude/lab/{catalog.ts,oracle.ts,worker.ts}, associated tests and documentation.
Verify: References pass; known mutants and invented check output fail. Run focused tests before implementation and after changes. Run the final project gates on the assembled change.
Ask first: Native model execution needs explicit model and budget; other choices follow the approved design.

## Acceptance criteria
References pass; known mutants and invented check output fail.
