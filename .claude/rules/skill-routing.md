# Skill Routing — when a skill helps

Use a skill when its situation matches; pick by action, not provider.
Discipline catalog: `.claude/docs/model-uplift-playbook.md`.

| Situation | Skill |
|---|---|
| Several plausible skills, none named | `choose-skills` |
| Decision gaps or doubts | `drillme-clarify` |
| “Consulta a Codex”: bounded read-only opinion | `consult-model` |
| “Abre un Codex”: native session; resume, control or handoff | `orca-cli` |
| “Coordina Codex y Claude”: supervise tasks and acceptance | `orca-team` |
| “Monta una colmena”: board, budget, scores | `orca-swarm` |
| Interactive technical diagram; simple ones keep Mermaid | `diagrams-interactive` |
| Approved spec needs decomposition | `flow` (plan phase) |
| About to report done on runtime work | `changes-verify` |
| Review a diff/PR, capture a repeatable review lesson | `lessons-learned` |

Routing authorizes no launch. Edge cases:
[harness-adapters](../docs/harness-adapters.md).
