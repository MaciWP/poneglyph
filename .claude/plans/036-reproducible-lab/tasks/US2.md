---
us: US2
title: Configuration inventory and frozen profiles
depends_on: [US1]
tdd: forced
status: closed
approved: 2026-09-08
closed: 2026-09-08
---
# Execution prompt

Task: Implement configuration inventory and frozen profiles.
Context: Approved spec and tests.md; existing historical implementation was read before reuse.
Constraints: Work inline. Use temporary fixtures. Do not start model workers or change native configuration during development.
Deliverable: .claude/lab/{profiles.ts}, associated tests and documentation.
Verify: Sources changing after capture cannot change saved profiles; uncontrolled references fail preflight. Run focused tests before implementation and after changes. Run the final project gates on the assembled change.
Ask first: Native model execution needs explicit model and budget; other choices follow the approved design.

## Acceptance criteria
Sources changing after capture cannot change saved profiles; uncontrolled references fail preflight.
