# Skill Routing — when a skill helps

Use the skill when its situation matches. Select by action, not provider.
The full discipline catalog remains in `.claude/docs/model-uplift-playbook.md`.

| Situation | Skill |
|---|---|
| Multiple plausible skills, none named | `choose-skills` |
| Decision gaps or doubts | `drillme-clarify` |
| “Consulta a Codex”: bounded read-only opinion | `consult-model` |
| “Abre un Codex”: native session; resume, control or handoff | `orca-cli` |
| “Coordina Codex y Claude”: supervise tasks and acceptance | `orca-team` |
| Interactive technical diagram; simple inline diagrams keep Mermaid | `diagrams-interactive` |
| Approved spec needs technical decomposition | `flow` (plan phase) |
| About to report done on runtime work | `changes-verify` |
| Review a diff/PR or capture a repeatable review lesson | `lessons-learned` |

Routing authorizes no launch. Session and plugin edge cases:
[harness-adapters](../docs/harness-adapters.md).
