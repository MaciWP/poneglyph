# Orca execution and recovery

Use the executable selected by the installed `orca-cli` skill throughout. `ORCA`
below is a placeholder, not a shell variable. Resolve resource paths through
`rules/harness-runtime.md`. The live guide and help override example syntax here.

## Preflight

```text
ORCA status --json
ORCA skills get orca-cli --json
ORCA skills get orchestration --json
ORCA orchestration worker-start --help
ORCA worktree current --json
```

Confirm the runtime is reachable and orchestration is available. If a requested
guide reference is unsupported, use the installed guide's `--full` fallback.
Do not enable experimental settings or change provider permissions silently.
Inspect project setup commands before launch; worktree creation can execute them.

Treat workspace trust and other native startup prompts as readiness gates. A
terminal existing, or a generic `agent_prompt_stalled`, does not prove the agent
can accept a task. Inspect the exact terminal before retrying. If Claude needs
workspace trust, open it in the selected worktree with the approved model/effort,
let the user resolve the native prompt, then wait for its normal idle composer.
Attach that prepared terminal with `worker-start --terminal`; do not paste a task
into the trust dialog or a shell. Preserve the existing session's model settings.
This does not authorize editing trust records or bypassing permission checks.

On Windows PowerShell, long arguments with literal quotes or newlines can lose
their boundaries at a native executable. Pass structured arguments through an
argv-array call, for example `Bun.spawnSync([resolvedOrca, ...args])`, using the
same resolved Orca executable. A temporary JSON request can carry the arguments;
do not interpolate JSON into shell command text. Keep stdout and stderr separate
and check the process exit code and returned receipt before continuing.

Obtain team approval before starting any model process. Choose the shared base
explicitly. Child lineage fits work stacked on the active feature; an independent
workflow uses top-level lineage. Lineage does not choose the Git base.

If required inputs are uncommitted, identify their exact set in team preparation.
Copy only the selected project inputs into the new worktree under coordinator
control before clearance. Validate new, modified and deleted paths against the
source. Preserve source changes and both indexes; never stash or commit as a
hidden transport. Exclude ignored credentials and unrelated user changes.

## Start one shared worktree

Create or bind the Run, with the coordination record location in its objective.
Create the authorized tasks before starting independent workers. The first
worker's task contains a **startup hold**: ask for clearance and do not edit until
the coordinator confirms setup, input preparation and the reservation record.

```text
ORCA orchestration run-create --objective <objective-and-record-location> --json
ORCA orchestration task-create --spec <task-with-startup-hold> --json
ORCA orchestration worker-start --task <task-id> --worktree new-child --name <name> --base-branch <base-ref> --agent codex --model <approved-model> --setup run --json
```

For independent work use `new-top-level` and the authorized base. Read the receipt
for the exact full worktree ID, Dispatch, effective launch and setup outcome.
Preserve start-immediately versus wait-for-setup behavior. A ready agent with
setup running is not yet permission to run checks that require that setup.

While the worker waits, prepare the team record and selected plan/input artifacts
in that worktree. The coordinator uses the team's exact paths for later commands;
its own terminal need not move. Keep flow-state mutations pointed at that team's
plan. Confirm prerequisites, record reservations and reply with clearance.

All remaining workers use the same worktree ID. Existing worktrees do not rerun
setup. Create separate Tasks and fresh agent terminals; do not create a worktree
per worker or send a supervised task through an untracked handoff.

```text
ORCA orchestration worker-start --task <next-task-id> --worktree id:<full-worktree-id> --agent claude --model <approved-model> --json
ORCA orchestration dispatch-show --task <next-task-id> --json
```

Use explicit Run selection or the proven current binding. Read actual IDs from
receipts; do not infer terminal identities from titles. Before dispatching an
Orca-ready task, also check coordinator acceptance of all predecessors.

## Providers

| Provider | Launch | Evidence needed |
|---|---|---|
| Claude | `worker-start --agent claude --model <id>` | Requested/effective model, task delivery, ask/reply and completion |
| Codex | `worker-start --agent codex --model <id>` | Same lifecycle checks; do not assume native hook trust |
| Grok | Check live support before using launch preferences | Same lifecycle checks; terminal launch alone is insufficient |

Resolve available models from the actual provider, not memorized model names.
Pass effort only when supported and approved. Orca 1.4.197 advertises launch
preferences for Claude, Codex and Cursor; its composed command does not advertise
Grok model/effort overrides. Grok's own CLI supports `--model` and
`--reasoning-effort`; recheck `grok --help` before use.

For Grok in the already prepared shared worktree, create a fresh terminal using
`terminal create --command` with the approved explicit Grok arguments. Wait for
TUI readiness, then attach it with `worker-start --task ... --worktree ...
--terminal <handle>`. Quote arguments for the actual shell. Do not launch Grok's
own worktree option. The reused-terminal path cannot take `--model`/`--effort`.
Inspect the ownership receipt: pre-existing terminals may be retained rather than
owned by worker-release. Report that limitation; do not force-close them.

If a provider cannot prove lifecycle delivery, leave it unverified and use an
already approved compatible provider only if the roster permits that substitution.
Do not widen permissions, change settings or substitute another model silently.

## Wait, settle and recover

```text
ORCA orchestration check --wait --types worker_done,escalation,question --timeout-ms 60000 --json
ORCA orchestration worker-show --dispatch <dispatch-id> --json
ORCA orchestration worker-read --dispatch <dispatch-id> --json
```

Process the whole Delivery, including questions. Reply before acknowledging its
delivery ID. Keep stdout JSON separate from stderr keepalives. Use current guide
commands for `ask --resume`, delivery acknowledgment and retry request identities.

On valid completion, first decide the terminal's next owner: reuse the exact
terminal for an immediate authorized Task, or run `worker-release`. Follow
`release_pending`/`release_unknown` recovery receipts rather than `terminal close`.
Explicit user retention uses `worker-retain`. Preserve the shared worktree.

| Observation | Coordinator action |
|---|---|
| Wait timeout, heartbeat, question or idle TUI | Inspect liveness and continue; retain ownership and reservations |
| Lost startup response | Inspect `request-show` and retry only with its request identity; do not start a second writer |
| Failed task with stopped writer | Inspect partial changes, then retry within the approved allowance and existing retry budget |
| Outcome or writer identity unknown | Keep reservations. Resolve the exact Dispatch before replacement; abandonment does not prove process termination |
| Coordinator session interrupted | Workers can finish assigned work or wait. No independent scheduler continues planning |
| Resume requested | Inspect Run, record and workers; reconcile mail, authorization and stable handoffs before dispatch |

If the old coordinator is active, do not take over its Run. Use only the runtime's
supported takeover/rebind path; legacy recovery is conditional, not a generic
fallback. Read-only inspection remains useful when mutation authority is missing.

Do not auto-release file reservations on a timeout. Do not use orchestration reset,
Git reset, worktree removal or broad process termination as recovery. Native host
permissions and the project's destructive-operation gate remain authoritative.
