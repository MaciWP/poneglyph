---
spec: 035-flow-coherence
created: 2026-09-08
approved: 2026-09-08
mode: full
phase: 2
status: closed
total_us: 3
dag_complete: true
closed: 2026-09-12
---

# Implementation order

| HU | Result | Depends on | Oracle |
|---|---|---|---|
| US1 | Verified lifecycle transitions and recoverable artifact projection | None | Lifecycle regression tests |
| US2 | Compact guide and coherent phase instructions/templates | US1 | Contract and source validations |
| US3 | Workflow conformance and assembled end-to-end verification | US1, US2 | Workflow tests and project gates |

The sequential order is intentional: documentation must describe the final helper, and assembled checks must exercise all consumers.

## Research

Reviewed the current main, upstream PRs 1/2/4, existing state helpers, shared YAML parser, workflows and source gate. The upstream PR's BLOCKED bypass and draft-approval gap were reproduced in memory. Current tests passed 45/45 before implementation but did not cover those defects.
