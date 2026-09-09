---
status: approved
approved: 2026-09-08
---

# Supervised Orca workflows

Oriol needs coordinated specialists that share one worktree per workflow, use
explicit responsibilities and file reservations, and preserve decisions across
interruptions. Reuse Orca transport and Poneglyph quality gates.

## Acceptance criteria

- AC1: A discoverable `orca-workflow` skill supports new work and Run resumption
  across projects, with one shared worktree and one terminal per collaborator.
- AC2: The coordinator owns the DAG, cooperative reservations and acceptance.
  Workers have explicit DoD, bounded write scope and direct traced communication.
- AC3: One recorded team approval covers its tasks, models, concurrency,
  communication, worktree creation and writes. Changed limits need approval.
  No implicit commit, publication, nested delegation or destructive cleanup.
- AC4: Recovery preserves uncertain writers, pending questions and delivered
  results. Final verification uses a stable shared diff. Orca completion alone
  never closes a HU or releases dependent work for execution.
- AC5: `flow`, `build` and active delegation references support this opt-in while
  preserving default inline work and the existing flow-state contract.
- AC6: Existing adapters can distribute the skill. Claude and Codex require a
  live pilot; Grok is conditional on equivalent lifecycle evidence.
- AC7: The pilot exercises parallel writes, contention, dependency acceptance,
  peer communication, recovery and final verification. Record observed cost and
  supervision; do not claim an unmeasured speedup.

## Decisions

Approved plan and execution request: conversation, 2026-09-08, "Implement the plan."
The preceding clarification selected a shared worktree, coordinator reservations,
DAG + DoD, direct traced messages, no commits, and resumable team authorization.
Claude and Codex are primary; Grok is desirable when supported. These are design
decisions. The approved 2026-09-09 publication plan supplies the concrete pilot
roster and authorizes commit, push and PR verification. It excludes PR merge and
global installation. Publication includes sanitized planning evidence.

No new scheduler, lock service, MCP server, global profile replacement or remote
worker deployment. Native permissions remain authoritative. Reservations are
cooperative, not filesystem access control.

Research: Orca 1.4.197 live guide and help; existing flow-build shared-checkout
partition; primary Cursor, MCP Agent Mail, Gas Town and LangGraph Swarm sources
linked from the skill's pilot reference. Observed runtime results and remaining
limits are recorded in implementation.md; installation is a separate claim.
