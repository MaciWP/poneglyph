# Skill Routing — mandatory dispatch table

Invoke matching skills; explain any skip. The full discipline catalog remains
in `.claude/docs/model-uplift-playbook.md`.

| Situation | Skill |
|---|---|
| Two or more skills could apply and the task does not name one | `choose-skills` |
| A decision with gaps, doubts or under-specified points | `drillme-clarify` |
| Supervised Orca team: shared worktree, reservations, messages or resume | `orca-team` (handoffs: `orca-cli`) |
| Interactive technical diagram or standalone explorable architecture/flow; simple inline diagrams keep Mermaid | `diagrams-interactive` |
| Approved spec needs technical decomposition | `flow-plan` |
| About to report "done" on work with runtime surface | `changes-verify` |
| About to review a diff/PR, or a review just surfaced a repeatable mistake | `lessons-learned` |

Model/effort routing per task type: `.claude/docs/model-uplift-playbook.md §4` (surfaced by `choose-skills` — do not copy the table).
