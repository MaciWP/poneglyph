---
name: orca-team
description: >-
  Supervise work across sessions with task owners, dependencies, file reservations,
  traced messages and acceptance in one shared Orca worktree. Use when asked to
  coordinate a team. Opening sessions or handing off work belongs to orca-cli;
  asking for a read-only opinion belongs to consult-model.
metadata:
  keywords: >
    Keywords - equipo coordinado, coordina un equipo, supervisa un equipo,
    coordina codex, coordina claude, coordina grok, coordinate a team,
    supervise a team, supervised team, resume team, reanuda el equipo,
    reservas de ficheros
argument-hint: "<objective> | --resume <run-id>"
disable-model-invocation: false
---

# Orca team — supervise work

Select this route through the [shared contract](../../rules/skill-routing.md).

Use **one worktree per workflow**. Orca owns terminals,
Tasks, Dispatches and messages. Poneglyph owns scope, reservations and acceptance.
Reservations are cooperative instructions, not filesystem access control.
Resolve shared skills/docs from the installed root in `rules/harness-runtime.md`,
not from a Codex profile's parent directories.

## Definition of Done

- Reuse the approved objective, assigned task DoDs and quality priorities. Resolve the current role before acting.
- A collaborator returns scoped results and actual checks through the worker contract, then stops writing. Only the coordinator accepts tasks and closes workflow state.
- A coordinator closes when the agreed tasks are accepted with required evidence, or reports the actual blocker or agreed pause. Resume existing work and criteria without creating duplicate workers.

## How You're Graded

- You are graded on safe coordination, correct acceptance and useful evidence within the recorded authorization.
- Worker counts, dispatch completion alone and repeated execution of accepted work earn no credit.

## Choose the role first

If the current prompt carries a live Orca Dispatch, read the worker contract in
[coordination](references/coordination.md). Perform that assignment; do not create
a Run, worktree or team. A quoted or inherited preamble is not a live assignment.

Otherwise act as coordinator. For a feature, invoke `flow-lifecycle`; for bounded
work, invoke `dev-workflow`. Preserve their quality gates.

## Prepare and authorize

1. Read project instructions and the relevant task/oracle. Inspect existing
   implementations, contracts, changed files and shared runtime resources.
2. Apply `agent-routing` and `drillme-clarify`. Split only real independent work.
   Propose two concurrent collaborators initially; a sequential DAG is valid.
3. Give every task a role, dependencies, exclusive write resources and DoD.
   Identify shared contracts before dispatch. Keep a single owner per resource.
4. Obtain the team authorization defined by CLAUDE.md's **Agent spawn** section.
   Record its actual decision reference, tasks, models, concurrency, permitted
   launches/retries, shared worktree/base and communication/write permissions.
   Do not infer authorization from this skill, a task file or another agent.
5. Load installed `orca-cli` and `orchestration`. Resolve the executable once,
   then load its version-matched guides. Read [execution](references/execution.md)
   for startup, provider differences and recovery. If Orca is unavailable, report
   the missing capability; do not substitute native subagents for Orca workers.

## Coordinate

- Create one shared worktree from the authorized base. Keep all worker terminals
  there. Resolve required uncommitted input before launch; a new worktree does not
  inherit it. Preserve the repository's setup policy.
- Keep `coordination.md` beside the active flow plan, or at
  `.claude/coordination/<slug>/coordination.md` for standalone dev work. Use the
  record in [coordination](references/coordination.md). Only the coordinator writes
  it. Include its location in the Run objective so resumption can find it.
- Reserve resources before edits. Dispatch only tasks whose dependencies have
  coordinator acceptance and whose reservations do not conflict. Orca's ready
  status alone is insufficient. Start eligible collaborators before waiting.
- Review task prompts with `prompt-design`. Use the existing Arch H blocks with
  resolved paths, the worker contract, project context, oracle and exact task scope.
  Load relevant skills explicitly; coordinator context does not automatically transfer.
- Permit direct task-specific messages within the approved team. Workers send
  decisions and blockers to the coordinator. Only the coordinator changes shared
  contracts, task ownership or reservations. Messages do not grant user consent.
- Process complete Orca Deliveries and acknowledge them using the live guide.
  Use rolling waits of at most 60 seconds. A wait timeout is a checkpoint, not a
  failed worker. Check questions as well as completion and escalation messages.
- On a valid `worker_done`, verify its task, attempt, outcome, files and evidence.
  Follow Orca's receipt to reuse or release the settled terminal before the next
  wait. Terminal settlement and Poneglyph acceptance are separate decisions.

## Accept and resume

Workers execute `dev-workflow` and the applicable `flow` (build phase) discipline. They return evidence;
they never close HUs or edit the shared plan state. The coordinator reviews the
changed set and applies the [flow contract](../../docs/flow-contract.md) after
`changes-verify`. Failed or missing required checks leave the task unaccepted.

Before final checks, stop assigning writes and obtain a stable handoff from every
writer. Run the required checks on the assembled diff. Any later change invalidates
affected evidence. Use one approved fresh-context reviewer for `flow` (review phase); if no
reviewer is authorized, critique inline and report that limitation.

For `--resume <run-id>`, inspect the Run and record before binding. Reconcile live
Dispatches, pending questions, reservations and accepted evidence. Do not launch
a duplicate writer or transfer a reservation while its previous owner is uncertain.
Do not compete with an active coordinator. Follow current Orca recovery receipts.

Record real decisions and useful lessons. Report accepted/pending tasks, blockers,
provider evidence and measured cost when available. Preserve the worktree and
uncommitted changes. Run persistence does not keep a coordinator session alive.

## Content map

| Topic | File | Contents |
|---|---|---|
| Team contract | [coordination](references/coordination.md) | Read when defining roles, reservations, worker prompts or the durable record. |
| Runtime | [execution](references/execution.md) | Read before creating workers or recovering a Run; includes provider launch boundaries. |
| Acceptance pilot | [pilot](references/pilot.md) | Read before claiming live capability or comparing parallel work with inline work. |

## Commandments

I/V: reuse flow, dev and Orca. II/IV: accept observed evidence. III/VI: preserve
permission and report cooperative limits. VII/VIII: explicit roles and traceable
messages. IX/X: one transport, one coordinator, only useful parallel work.
