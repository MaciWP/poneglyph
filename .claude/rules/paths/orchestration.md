---
paths:
  - ".claude/skills/**"
  - ".claude/agents/**"
---

<!-- Scoped with `paths` (CC ignores `globs`), so this rule loads only for skill/agent authoring. The agents-dir glob is harmless when the dir is absent. -->

## Orchestration Context

### Agent Frontmatter — key fields

| Field | Note |
|-------|------|
| `effort` | Fixed per agent. NOT variable per-invocation. Only define if invariable |
| `maxTurns` | Safety net. Returns `error_max_turns` to the Lead |
| `memory` | Scope: `user`, `project`, `local` |
| `isolation` | `worktree` for isolated git worktree |
| `initialPrompt` | Auto-submit on agent start |

### Skill Frontmatter — key fields

| Field | Note |
|-------|------|
| `effort` | Override effort when invoking skill |
| `paths` | YAML list of globs — skill applies only to these paths |
| `context` | `fork` = isolated context |

> Error recovery + SendMessage pattern: see `agent-routing/references/07-error-recovery.md §SendMessage Recovery`.
