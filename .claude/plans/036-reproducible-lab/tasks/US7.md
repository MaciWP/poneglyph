---
us: US7
title: Grok adapter
depends_on: [US6]
tdd: forced
status: closed
approved: 2026-09-08
closed: 2026-09-08
---
# Execution prompt

Task: Implement grok adapter.
Context: Approved spec and tests.md; existing historical implementation was read before reuse.
Constraints: Work inline. Use temporary fixtures. Do not start model workers or change native configuration during development.
Deliverable: .claude/lab/{adapters.ts}, associated tests and documentation.
Verify: Reject empty JSON and failed sessions; record configuration evidence. Run focused tests before implementation and after changes. Run the final project gates on the assembled change.
Ask first: Native model execution needs explicit model and budget; other choices follow the approved design.

## Acceptance criteria
Reject empty JSON and failed sessions; record configuration evidence.
