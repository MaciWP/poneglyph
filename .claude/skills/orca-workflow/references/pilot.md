# Acceptance pilot

This is an executable validation recipe, not evidence that the skill works.
Run it only after the user approves the actual team and provider models.

## Setup

Use one disposable Orca worktree and two writer tasks with disjoint files and
small binary acceptance checks. Prepare inputs and checks with the coordinator.
Use one Claude worker and one Codex worker. A subsequent fresh read-only reviewer
and optional Grok attempt must be in the approved roster/launch allowance.
Preserve ordinary provider permissions. Do not publish or delete the worktree.

One concrete fixture is two independent functions with existing scoped tests:
worker A implements a normalizer, worker B implements a validator. Both need a
shared export file, which starts reserved to A. A downstream smoke task consumes
both functions only after coordinator acceptance. Keep task inputs small enough
that the protocol, rather than implementation difficulty, drives the experiment.

## Scenarios

| Scenario | Action | Required observation |
|---|---|---|
| Startup | Start first worker under the startup hold; prepare record and grant; start second in the same worktree | One worktree, two exact Dispatches, effective approved models, no edits before clearance |
| Parallel work | Grant disjoint implementation files and separate test resources | Both tasks progress without writes outside their grants |
| Contention | B requests the export file while A holds it | B does not edit it; the coordinator grants it only after A's stable handoff |
| Peer messages | B asks A about the shared interface and reports the agreement | The message reaches A; all replies keep the first message ID as thread-id; the coordinator records the contract before dependent edits |
| Dependency | Let A report completion before the coordinator accepts its evidence | Downstream work stays undispatched even if Orca marks a prerequisite completed |
| Failed evidence | Supply a result with one required failing or unexecuted check | The coordinator keeps it unaccepted and preserves partial work |
| Timed-out ask | Let a short worker ask timeout, then answer the original question | Resuming its message ID receives that answer without creating another question |
| Replayed Delivery | Read the same unacknowledged Delivery, process it, then acknowledge | No repeated edits, duplicate acceptance or duplicate worker launch |
| Interruption | Reach an agreed coordinator pause and resume the recorded Run | Recover existing Tasks, Dispatches, questions and reservations; no second writer |
| Unknown owner | Present uncertainty about one active attempt | Its resources stay reserved until liveness/termination is resolved |
| Stable review | Obtain all writer handoffs, run assembled checks and fresh review | Evidence identifies the final inputs; later edits invalidate affected checks |
| Cleanup | Settle tasks and follow release receipts | Owned settled terminals release; shared worktree and user/unowned terminals remain |

Exercise Grok with a separate authorized task after the primary pair. Confirm
delivery, peer mail, coordinator ask/reply, final outcome and terminal ownership.
If any cannot be demonstrated, report Grok as unverified with the exact limitation.

## Report

Record environment/version, models, worktree and Run/Task/Dispatch IDs, scenario
commands and observations, changed files, final check evidence and retained
resources. Distinguish passed, failed and not-run. Do not replace live scenarios
with a mocked mailbox or a static grep for instructions.

Measure elapsed time to acceptance, available token/cost totals, defects and
human interventions. Use comparable inline work before claiming a speedup.
Unavailable consumption is unknown, not zero. A successful pilot proves only the
observed providers and scenarios, not universal compliance with reservations.

## Evidence behind the design

- [Orca orchestration](https://github.com/stablyai/orca/blob/main/skill-guides/orchestration.md):
  runtime task/attempt identity, messages and terminal lifecycle. Use the installed
  guide for commands because the public main branch can differ.
- [Cursor: Scaling long-running autonomous coding](https://cursor.com/blog/scaling-agents):
  clear responsibility improved coordination; flat shared-file locking produced
  bottlenecks. This argues against treating more agents as the success metric.
- [MCP Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail):
  asynchronous threads and advisory reservations. Reuse this pattern through
  Orca and coordinator grants; do not install a second mailbox service.
- [Gas Town](https://github.com/gastownhall/gastown): persistent work tracking and
  explicit coordinator responsibility inform recovery across sessions.
- [LangGraph Swarm](https://github.com/langchain-ai/langgraph-swarm-py): specialist
  handoffs inform context transfer. A handoff swarm is not proof of safe parallel
  filesystem writes; this skill keeps shared decisions with the coordinator.
