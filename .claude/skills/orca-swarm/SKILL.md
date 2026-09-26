---
name: orca-swarm
description: >-
  Run a hive of Orca workers toward one shared objective: a global DoD, a
  task board that workers bid on, a hard time budget and a
  coordinator-awarded leaderboard with a final podium. Layered on orca-team.
  A team without a board or scoring belongs to orca-team; a read-only opinion
  belongs to consult-model; one native session belongs to orca-cli.
metadata:
  keywords: >
    Keywords - orca swarm, orca-swarm, run an agent swarm, swarm of agents,
    enjambre de agentes, lanza un enjambre, monta una colmena,
    colmena de agentes, hive of agents, agent hive, reanuda la colmena,
    resume the swarm
argument-hint: "<objective> | --resume <run-id>"
disable-model-invocation: false
---

# Orca swarm — a hive with a board, a budget and a leaderboard

An orca-swarm run **is an orca-team workflow**. Load installed `orca-team` first
and keep all of it: authorization, the coordination record, cooperative
reservations, the worker contract, Orca execution and recovery. This skill adds
only four things on top: a hive charter, a task board that bees bid on, a hard
time budget and a leaderboard. Where the two disagree, orca-team wins.

## Definition of Done

- Before the first spawn, orca-team's single team authorization records every field it requires plus the charter: objective, global DoD, board with eligible bees per task, budget and scoring rules.
- The coordinator dispatches each board task to one eligible bee. The bee executes it under orca-team's worker contract plus the bee addendum, reports evidence and its next bid in `worker_done`, then idles. Only the coordinator dispatches, accepts and awards points.
- The coordinator closes when the global DoD is accepted with evidence, the time budget is spent, or a real blocker stands. The close reports accepted and pending tasks, measured time, cost (or "unknown") and the final podium.

## How You're Graded

- You are graded on the accepted global DoD within the agreed budget and authorization, with honest evidence.
- Points measure contribution inside the run; they are never the goal. A high score on work that fails acceptance earns nothing, and bee count, message volume and dispatch completion alone earn no credit.

## When NOT to use

| Situation | Use instead |
|---|---|
| Coordinated team without board, budget or scoring | `orca-team` |
| Bounded read-only opinion from another model | `consult-model` |
| Open, resume or hand off one native session | `orca-cli` |
| Work one Lead finishes inline in reasonable time | inline `dev-workflow` |
| Tasks that all touch the same files | inline, or a sequential orca-team DAG |

## 1. Charter and authorization

1. Run orca-team's "Prepare and authorize" steps. Split only real independent
   work into board tasks, each with a DoD, dependencies and exclusive resources.
2. Draft the charter from [hive](references/hive.md): objective, global DoD,
   board with the eligible bees per task, time budget in minutes, attempt cap
   per task, roster and models, and the scoring table from
   [scoring](references/scoring.md). A bee is eligible when its approved role and
   model fit that task.
3. Show the charter inside orca-team's authorization question and wait. The
   recorded approval covers the charter; changing the budget, roster, limits,
   eligibility or scoring later needs a new approval. Points never widen that
   envelope: no score grants spawning, commits, publishing, branch changes or scope changes.
4. Record the start time with `date` in the charter. The model has no clock.

## 2. The board (bees bid, the coordinator dispatches)

An Orca worker holds one Task and idles after `worker_done`, so bees bid.

- The board lives in orca-team's `coordination.md`; only the coordinator writes it.
- The coordinator dispatches the first wave from the charter.
- A bee ends its `worker_done` report with `Next bid: <task ID> — <reason>` or
  `Next bid: none`. It never bids with `ask`, which is only for a blocking
  question about its current task.
- On acceptance, grant the bid when the bee is eligible, the task's dependencies
  are accepted and its resources are free: reserve them per orca-team and
  dispatch the task on the same terminal. Bids that arrive together are granted
  in `worker_done` order. A bid that cannot be granted now never shares a path:
  release the terminal per orca-team and leave the task open.
- The coordinator can still assign directly to break a deadlock or keep a
  critical path moving; say so in the grant.

## 3. Communication

Encourage task-referenced peer messages inside the approved team: interface
questions, findings about another bee's work, offers to unblock. Shared
decisions still reach the coordinator in the same thread. No progress
broadcasts. The coordinator puts the one-line leaderboard in every task dispatch
and in the final report; bees never award, request or trade points.

## 4. Budget

- Checkpoint with `date` on every wait cycle (at most 60 seconds, per orca-team).
  The clock holds only while the coordinator session lives; nothing else schedules.
- At 80 % of the time budget: grant no new bids; let in-flight tasks finish.
- At 100 %: grant nothing and request stable handoffs. Run the assembled checks
  only after every writer has handed off. A writer still silent after two more
  wait cycles leaves its task blocked and the checks pending: tell the user and
  never kill it. Close as partial. Never extend the budget without the user.
- The attempt cap per task stands in for a cost cap. Orca exposes no token
  usage; after the close, measure it from provider session logs, else "unknown", never zero.

## 5. Acceptance, scoring and close

Accept exactly as orca-team does; award points only after acceptance or a
coordinator-verified event, in the points ledger. At close, write the podium
and badges to the hall of fame and report them with the evidence. Preserve the
worktree and uncommitted changes.

## Eval scenarios

| Prompt / situation | Expected behavior |
|---|---|
| "Monta una colmena de 3 agentes para migrar estos 3 endpoints en 40 min" | Loads orca-team, drafts the charter, asks for authorization and models, spawns nothing before approval |
| Two bids for one task, or for tasks sharing a file | The earlier `worker_done` wins; the other bee is released; no shared path |
| A bee bids on a task it is not eligible for | Bid refused; changing eligibility needs a new approval |
| A bee reports green checks that the coordinator cannot reproduce | Task unaccepted, −10 penalty in the ledger, partial work preserved |
| The clock reaches 80 % and then 100 % | No grants at 80 %; at 100 % handoffs, then assembled checks and a partial close with podium |
| "Coordina Codex y Claude para estas tareas" (no hive, no scoring) | Routes to orca-team, not orca-swarm |

## Anti-patterns

| Anti-pattern | Correction |
|---|---|
| Copying orca-team rules into the charter | Link them; this skill adds only charter, board, budget and scoring |
| A bee asking for work with `ask`, editing without a grant or self-awarding | It bids in `worker_done`; only the coordinator dispatches and awards |
| Scoring messages, activity or self-reported checks | Score accepted outcomes and verified cooperation only |
| Extending the budget "to finish" | Close partial at 100 %; ask the user for more time |
| Letting points unlock permissions | The authorization envelope is fixed by the user |
| Reporting cost as 0 when it was not measured | Report "unknown" |

## Content map

| Topic | File | Read when |
|---|---|---|
| Charter, board, budget and ledger sections; bee addendum | [hive](references/hive.md) | Drafting the charter, writing a bee prompt or resuming a swarm |
| Achievements, penalties, leaderboard line and podium | [scoring](references/scoring.md) | Drafting the scoring table, awarding points or closing |

Validation: static checks prove discovery only. A live hive needs orca-team's
[pilot](../orca-team/references/pilot.md) plus a bid conflict, a leaderboard
line and a podium, run with approved models; until then it is unverified.

## Commandments

I/V: reuse orca-team, add only what it lacks. II/IV: points follow accepted
evidence. III/VI: the budget and envelope stay the user's. VII: board, ledger
and podium are observable. IX/X: one coordinator, one transport, useful bees only.
