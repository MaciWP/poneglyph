# Skill Routing — mandatory dispatch table

When a row matches, invoke the skill — skipping a matching row requires saying so with a one-line reason. This table replaced `model-uplift.md` (2026-08-05/030); the full discipline catalog stays on-demand in `.claude/docs/model-uplift-playbook.md`.

| Situation | Skill |
|---|---|
| Non-trivial task starting, or more than one skill could apply | `skill-advisor` |
| A decision with gaps, doubts or under-specified points | `drillme` |
| About to assert a file/function/signature exists | `anti-hallucination` |
| Any coding task | `dev` (the loop — CLAUDE.md §The dev loop) |
| Approved spec needs technical decomposition | `tech-plan` |
| About to report "done" on work with runtime surface | `verify` |
| About to review a diff/PR, or a review just surfaced a repeatable mistake | `lessons` |

Model/effort routing per task type: `.claude/docs/model-uplift-playbook.md §4` (surfaced by `skill-advisor` — do not copy the table).
