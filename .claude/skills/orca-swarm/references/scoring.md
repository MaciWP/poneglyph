# Scoring, leaderboard and podium

Points make contribution visible and let bees compete. They are symbolic: they
never change permissions, reservations or the authorization envelope, and they
never override acceptance. Only the coordinator awards them, and only for
evidence it verified itself.

Effect on real quality is unproven. Competitive framing may raise effort or may
invite gaming; the live pilot measures defects, time and human interventions
before this design claims any benefit.

## Achievements

| Event | Points | Evidence required |
|---|---|---|
| Task accepted with its required checks | +10 | Coordinator acceptance |
| Accepted on the first attempt | +3 | No rework request before acceptance |
| Unblocked a peer | +3 | The peer confirms in-thread and the coordinator sees the blocked work resume |
| Real defect found in another bee's work before its acceptance | +5 | Coordinator reproduces the defect |
| Shared-contract proposal adopted | +3 | Coordinator records the decision |
| Finished inside its budget slice | +2 | Acceptance time within the slice set at grant |

## Penalties

| Event | Points |
|---|---|
| Edit outside the granted reservation | −10 |
| Reporting a check as run or passing when it was not | −10, and the task stays unaccepted |
| Holding a reservation with no progress across two checkpoints | −3 |

Cooperation scores on purpose: unblocking and defect finding pay, so competing
never pays more than helping. Messages, tool calls and self-reports score zero.

## Leaderboard line

Append one line to the end of every grant and acceptance message, never as a
separate broadcast:

```text
🐝 🥇 bee-a 23 · 🥈 bee-b 18 · 🥉 bee-c 10
```

Show the top three; a hive of two shows both. Ties break by fewer penalty
points, then by the earlier acceptance.

## Podium and badges

At close, write to the hall of fame and the final report:

| Place | Title |
|---|---|
| 🥇 | Reina de la colmena |
| 🥈 | Obrera de oro |
| 🥉 | Exploradora |

| Badge | Awarded for |
|---|---|
| Primer intento | Every accepted task of the bee passed on the first attempt |
| Desbloqueadora | Most verified unblocks |
| Cazabugs | Most reproduced defects in peer work |

A partial close still awards the podium on accepted work and says the run was
partial. Titles and badges are symbolic; they carry no permission.
