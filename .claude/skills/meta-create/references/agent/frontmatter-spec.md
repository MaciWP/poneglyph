---
parent: meta-create
name: frontmatter-spec
description: Full agent frontmatter spec, permission modes, dynamic model selection, fields NOT in agent frontmatter.
---

# Agent Frontmatter Spec

Every field available for agent frontmatter, plus fields that are intentionally NOT supported.

## Required Description Format

**CRITICAL**: `description` MUST include "Use proactively when:" and "Keywords -" lines. Without these, Claude Code will NOT register the agent as a valid `subagent_type`.

```yaml
description: |
  {purpose statement}.
  Use proactively when: {trigger conditions}.
  Keywords - {kw1, kw2, kw3}
```

## Full Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | **Yes** | Purpose + "Use proactively when: {situations}." + "Keywords - {kw1, kw2, ...}" |
| `tools` | string | **Yes** | Comma-separated tool whitelist. Plain names only (no scoped syntax like `Task(scout)`) |
| `disallowedTools` | string/list | No | Tools blocked. **camelCase** (e.g., `Task`, `NotebookEdit`) — NOT snake_case |
| `permissionMode` | string | No | `default`, `plan`, `acceptEdits`, `dontAsk`, `bypassPermissions` |
| `effort` | string | No | Only if invariable. Options: `low`, `medium`, `high`, `xhigh` (xhigh on Opus 4.7+) |
| `maxTurns` | number | No | Optional hard stop. **Caution**: when reached, no result is returned and work is lost. Default (no limit) is correct for well-scoped tasks. Only set if running in CI/production pipelines. |
| `color` | string | No | Visual identifier: `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` |
| `skills` | list | No | Skills auto-loaded when agent starts |
| `memory` | object | No | `scope: user\|project\|local` |
| `background` | boolean | No | `true` = always run in background |
| `hooks` | object | No | Hooks scoped to agent (PreToolUse, PostToolUse, Stop) |
| `isolation` | string | No | `worktree` = isolated git worktree |
| `initialPrompt` | string | No | Auto-submitted prompt on agent start |

## Fields NOT in Agent Frontmatter

| Field | Reason |
|-------|--------|
| `name` | Agent is identified by filename, not a `name` field |
| `model` | Model routing is dynamic — the Lead determines model per-invocation based on complexity |

## Permission Modes

| Mode | Behavior | Recommended For |
|------|----------|-----------------|
| `default` | Standard permission prompts | General purpose |
| `plan` | Read-only, no write operations | Readers, researchers |
| `acceptEdits` | Auto-accept file edits | Trusted builders |
| `dontAsk` | Auto-deny permission requests | Strict read-only |
| `bypassPermissions` | Skip all permission checks | Automation only |

## Model Selection (Dynamic — NOT in Frontmatter)

Model is determined dynamically by the Lead based on agent category and task complexity. Do NOT set `model` in agent frontmatter.

| Agent Category | Complexity < 30 | 30-50 | > 50 |
|----------------|----------------|-------|------|
| Code agents (builder, reviewer) | sonnet | sonnet | opus |
| Read-only agents (scout, executor) | haiku | haiku | sonnet |
| Strategic agents (planner) | opus | opus | opus |
