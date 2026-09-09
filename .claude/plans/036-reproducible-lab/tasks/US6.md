---
us: US6
title: Bounded execution and Claude adapter
depends_on: [US3, US4]
tdd: forced
status: closed
approved: 2026-09-08
closed: 2026-09-08
---
# Execution prompt

Task: Implement bounded execution and claude adapter.
Context: Approved spec and tests.md; existing historical implementation was read before reuse.
Constraints: Work inline. Use temporary fixtures. Do not start model workers or change native configuration during development.
Deliverable: .claude/lab/{process.ts,adapters.ts,runner.ts}, associated tests and documentation.
Verify: Drain both streams, enforce limits, isolate attempts and reject invalid terminal output. Run focused tests before implementation and after changes. Run the final project gates on the assembled change.
Ask first: Native model execution needs explicit model and budget; other choices follow the approved design.

## Acceptance criteria
Drain both streams, enforce limits, isolate attempts and reject invalid terminal output.
