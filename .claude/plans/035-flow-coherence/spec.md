---
id: 035-flow-coherence
created: 2026-09-08
approved: 2026-09-08
mode: full
phase: 1
status: approved
---

# Reliable, compact flow

The approved conversation plan requires a coherent feature lifecycle in this repository. The historical upstream PR is evidence, not an installation source.

## Acceptance criteria

- AC1: Scope approval precedes planning. Draft tasks and oracle receive one joint approval that registers the tasks and updates their document status.
- AC2: Every new HU closure requires observed verification. Failed, missing, incomplete or mismatched records cannot close a HU.
- AC3: Review decisions are disjoint. BLOCKED cannot be bypassed. Reopening invalidates previous review/retro and requires fresh closure evidence.
- AC4: Writes are serialized and individually atomic. Interrupted document projections are recoverable from recorded state without inventing approvals.
- AC5: The flow guide preserves all six phases in a shorter operational sequence. TDD is the default for behavior changes; validation-only work and justified exceptions remain supported.
- AC6: Functional HUs and real dependencies determine decomposition. No minimum parallelism ratio. Critic checks the assembled result against every requirement and routes in-scope repairs back to build.
- AC7: Phase skills, workflows, templates and command examples agree. Existing host adapters, dev, publication protocol, dependencies and CI stay intact.
- AC8: Tests exercise valid and invalid lifecycle transitions, actual CLI execution, recovery and workflow conformance. Source checks, budget and doctor results remain explicit.

## Decisions and authorization

The user selected flow-only scope, minimum verification records, TDD by default, and automatic in-scope repair after critic. The user then approved implementation with “Implement the plan.” No Git publication, global installation or model workers are authorized.

## Limits

Evidence records validate reported outcomes; they do not authenticate approval or independently execute tests. Historical closed plans remain untouched. Agent quality and speed require later real-use observation.
