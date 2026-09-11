# Skill Routing — mandatory dispatch table

Invoke matching skills; explain any skip. The full discipline catalog remains
in `.claude/docs/model-uplift-playbook.md`.

| Situation | Skill |
|---|---|
| Two or more skills could apply and the task does not name one | `skill-advisor` |
| A decision with gaps, doubts or under-specified points | `drillme` |
| Supervised Orca team: shared worktree, reservations, messages or resume | `orca-workflow` (handoffs: `orca-cli`) |
| Interactive technical diagram or standalone explorable architecture/flow; simple inline diagrams keep Mermaid | `archify` |
| Approved spec needs technical decomposition | `tech-plan` |
| About to report "done" on work with runtime surface | `verify` |
| About to review a diff/PR, or a review just surfaced a repeatable mistake | `lessons` |

Model/effort routing per task type: `.claude/docs/model-uplift-playbook.md §4` (surfaced by `skill-advisor` — do not copy the table).
