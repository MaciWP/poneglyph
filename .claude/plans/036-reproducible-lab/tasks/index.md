---
phase: 2
status: approved
total_us: 10
approved: 2026-09-08
---
# Implementation tasks

Level: Full — native configuration, recovery and measurement boundaries.
TDD-mode: forced — behavior changes under flow.

- US1: Versioned contracts and experiment storage. Dependencies: none.
- US2: Configuration inventory and frozen profiles. Dependencies: US1.
- US3: Recoverable configuration transaction. Dependencies: US2.
- US4: Independent oracle and three baseline scenarios. Dependencies: US1.
- US5: Interrupted import and conditional improvement. Dependencies: US4.
- US6: Bounded execution and Claude adapter. Dependencies: US3, US4.
- US7: Grok adapter. Dependencies: US6.
- US8: Codex adapter. Dependencies: US6.
- US9: History, repeat and comparison. Dependencies: US1.
- US10: CLI, documentation and integration. Dependencies: US5, US7, US8, US9.
