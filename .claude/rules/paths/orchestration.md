---
paths:
  - ".claude/skills/**"
  - ".claude/agents/**"
---

<!-- Last verified: 2026-06-22 (021 — globs→paths fix: CC honors `paths` not `globs`, so this rule was eager-loaded every session; now lazy-scoped to skill/agent authoring. agents-dir glob kept future-proof — harmless when the dir is absent, matches when meta-create adds one in any repo) -->

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

> Error recovery + SendMessage pattern: see `orchestrator-protocol/references/07-error-recovery.md §SendMessage Recovery`.
