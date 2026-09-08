---
spec: 035-flow-coherence
phase: 2.5
status: approved
test_mode: tdd
tdd_policy: forced
approved: 2026-09-08
---

# Runtime oracle

## US1

Start with draft scope/tasks/oracle. Approve scope, prepare tasks/oracle, approve the package, close verified HUs, review, and close after retro. Assert recorded decisions and matching document status. Reject missing/failed checks, wrong HU, empty packages, dependency cycles, unfinished dependencies and unapproved transitions. Reproduce both BLOCKED bypass routes. Reopen and require new evidence. Repair interrupted projections without changing state. Reject overlapping writers. Exercise CLI report paths with spaces and CRLF.

Red evidence: the new flow-contract suite failed 19/19 on the original helper. This exposed the canonical gate spelling bug, absent verification guards and BLOCKED bypass.

## US3

Pin the disjoint review table. Missing checks/review evidence and an incomplete task subset must not pass. A task with an unselected pending dependency must not run. Run project checks after all consumers are updated.
