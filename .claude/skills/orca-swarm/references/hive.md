# Hive record and bee addendum

These sections extend orca-team's [durable record](../../orca-team/references/coordination.md).
Add them to the same coordinator-only `coordination.md`; do not start a second
record, database or mailbox. Orca remains the source of runtime state and mail.

## Charter

Record it before the authorization question and keep it unchanged afterwards,
except through a recorded user amendment.

```markdown
## Charter

- Objective: <one sentence>
- Global DoD: <observable outcomes and required assembled checks>
- Stop: global DoD accepted · time budget spent · blocker
- Time budget: <N> min, started <date output>; soft stop at 80 % (<time>), hard stop at 100 % (<time>)
- Attempt cap per task: <n> (inside orca-team's retry allowance)
- Roster: <bee name> — <provider> <approved model>, effort <e>
- Scoring: table in references/scoring.md, unchanged / amended as <link to decision>
```

## Board

One row per task. The board is the backlog bees claim from; the task DoD and
reservation rules are orca-team's.

```markdown
| Task | DoD | Deps | Resources | Status | Bee | Orca Task / Dispatch |
|---|---|---|---|---|---|---|
| T1 | <criteria + checks> | — | `src/a.ts` | open / claimed / writing / review / accepted / failed | bee-a | ids |
```

A claim moves a row from `open` to `claimed` only when the coordinator grants
it and records the reservation. Queue conflicting claims in grant order.

## Budget log

One line per checkpoint that changes a decision, not per wait cycle:

```markdown
| Time | Elapsed | Decision |
|---|---|---|
| 10:12 | 32/40 min (80 %) | Soft stop: no new grants; T4 stays open |
```

At close, add measured cost per provider when the session logs expose it, and
write "unknown" for the rest.

## Points ledger and hall of fame

```markdown
| Time | Bee | Event | Evidence | Points | Total |
|---|---|---|---|---|---|
| 09:58 | bee-a | T1 accepted, first attempt | acceptance of msg_… | +13 | 13 |
```

Every row cites the acceptance, message ID or check that proves it. The hall of
fame holds the final podium and badges from [scoring](scoring.md).

## Bee addendum

Append this block to the [worker contract](../../orca-team/references/coordination.md#worker-contract)
in every bee prompt, filled with real values. Review the whole prompt with
`prompt-design`.

```text
[HIVE]
You are <bee name> in a hive working toward: <objective>.
The global DoD is: <global DoD>. Your task serves it; do not widen your task.
The time budget ends at <hard-stop time>. At <soft-stop time> no new tasks are granted.
When you have no granted task, ask the coordinator for one board task: task ID and one line of reason.
Never edit before the grant names your reserved resources.
Message other bees about interfaces, findings or help, always with a task reference.
Send shared decisions to the coordinator in the same thread.
The coordinator awards points only for accepted work and verified cooperation.
The current leaderboard arrives at the end of grant and acceptance messages.
Do not award, request or trade points. A false check report costs 10 points and the task.
```
