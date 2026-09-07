---
parent: meta-create
name: handlers-and-settings
description: Handler types, settings.json registration, matcher/if evaluation, exit codes, stdout JSON protocol.
---

# Handlers, Settings.json & Matching

## Contents

- [Handler Types](#handler-types)
- [Settings.json Entry Template](#settingsjson-entry-template)
- [Matcher Evaluation Rules](#matcher-evaluation-rules)
- [if Field (Permission Rule Syntax)](#if-field-permission-rule-syntax)
- [MCP Tool Matching](#mcp-tool-matching)
- [Exit Code Protocol](#exit-code-protocol)
- [Stdout JSON Protocol](#stdout-json-protocol)
- [Full Field Reference (settings.json)](#full-field-reference-settingsjson)

## Handler Types

| Type | Fields | Blocking | Async Support | Use Case |
|------|--------|----------|---------------|----------|
| `command` | `command`, `async`, `shell`, `timeout` | Yes (exit 2) | Yes | Shell scripts, TypeScript with bun |
| `http` | `url`, `headers`, `allowedEnvVars`, `timeout` | No | Inherently | External webhooks |
| `prompt` | `prompt`, `model`, `timeout` | Yes | No | LLM-evaluated policy checks |
| `agent` | `prompt`, `model`, `timeout` | Yes | No | Autonomous sub-agent decisions |

## Settings.json Entry Template

The EXACT JSON structure for registering hooks in `settings.json`.

### Single Hook on an Event

```json
{
  "hooks": {
    "{EVENT}": [
      {
        "matcher": "{TOOL_OR_PATTERN}",
        "if": "{PERMISSION_RULE_SYNTAX}",
        "hooks": [
          {
            "type": "command",
            "command": "bun run $HOME/.claude/hooks/{hook-name}.ts",
            "timeout": 600,
            "async": false
          }
        ]
      }
    ]
  }
}
```

### Multiple Hooks on the Same Event

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bun run $HOME/.claude/hooks/format-code.ts",
            "timeout": 30
          }
        ]
      },
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "bun run $HOME/.claude/hooks/your-read-hook.ts",
            "timeout": 10,
            "async": true
          }
        ]
      }
    ]
  }
}
```

### Hook with `if` Filter

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "if": "Bash(rm *)|Bash(git push --force*)",
        "hooks": [
          {
            "type": "command",
            "command": "bun run $HOME/.claude/hooks/block-dangerous.ts"
          }
        ]
      }
    ]
  }
}
```

## Matcher Evaluation Rules

| Matcher Value | Evaluated As | Example |
|---------------|-------------|---------|
| `"*"`, `""`, or omitted | Match ALL tool calls | Catch-all hooks |
| Only letters/digits/`_`/`\|` | Exact match or `\|`-separated list | `"Edit\|Write"` matches Edit or Write |
| Contains any other char | JavaScript regex | `"mcp__.*__query"` matches MCP tools |

## `if` Field (Permission Rule Syntax)

The `if` field provides fine-grained filtering beyond the matcher:

| `if` Value | Matches | Use Case |
|------------|---------|----------|
| `"Bash(git *)"` | Only git commands in Bash | Git-specific hooks |
| `"Edit(*.ts)\|Write(*.ts)"` | Only TypeScript file edits | Language-specific formatting |
| `"Bash(rm -rf *)"` | Only destructive rm commands | Safety checks |
| `"Edit(src/auth/*)"` | Only edits in auth directory | Domain-scoped validation |

## MCP Tool Matching

MCP (Model Context Protocol) tools follow the pattern `mcp__<server>__<tool>`:

| Pattern | Matches |
|---------|---------|
| `"mcp__memory__.*"` | All tools from the "memory" MCP server |
| `"mcp__.*__query"` | Any MCP server's "query" tool |
| `"mcp__github__create_issue"` | Specific MCP tool |

## Exit Code Protocol

| Code | Meaning | When | Stdout |
|------|---------|------|--------|
| `0` | Success | Hook completed normally | Parsed as JSON when it starts with `{` and ends with `}`; otherwise added as plain-text context on the events that accept it |
| `2` | Block | Blocking events only (PreToolUse, PermissionRequest, PreModelSwitch) | Ignored |
| Other | Non-blocking error | Any event | Ignored, stderr shown as warning |

> **Since 2.1.248**: stdout that starts with `{` and ends with `}` but is NOT valid JSON is reported as a `<hook name> hook error` (non-blocking, every exit code except 2) and is NOT added as context. Before 2.1.248 it was silently treated as plain text. Always `JSON.stringify` the whole object (see `security-gate.ts`) or print plain prose without a leading `{`.

> **`if` is best-effort (2.1.243)**: when Claude Code cannot determine which commands a Bash input runs (substitutions, pipes), it runs the hook regardless of the pattern; `Bash(cat *)` does not fire on `echo before $(date) after`. Use `permissions` for a hard allow/deny, never a hook.

## Stdout JSON Protocol

When a hook exits 0 and writes JSON to stdout, Claude Code parses it:

```typescript
interface HookOutput {
  // Merged into the hook result, available to Claude
  hookSpecificOutput?: {
    additionalContext?: string;  // Extra context for Claude
    [key: string]: unknown;
  };
  // For PermissionRequest hooks only
  decision?: "allow" | "deny";
}
```

## Full Field Reference (settings.json)

### Hook Entry Fields (inside the event array)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `matcher` | string | No | Tool name pattern. `"*"` or omitted = match all. Pipe-separated or regex |
| `if` | string | No | Permission rule syntax for fine-grained filtering |
| `hooks` | array | Yes | Array of handler objects |

### Handler Fields (inside the `hooks` array)

| Field | Type | For Types | Required | Default | Description |
|-------|------|-----------|----------|---------|-------------|
| `type` | string | All | Yes | - | `"command"`, `"http"`, `"prompt"`, `"agent"` |
| `command` | string | command | Yes* | - | Shell command to execute |
| `url` | string | http | Yes* | - | Webhook URL |
| `prompt` | string | prompt, agent | Yes* | - | LLM prompt (`$ARGUMENTS` for input) |
| `model` | string | prompt, agent | No | varies | Model for LLM evaluation |
| `headers` | object | http | No | `{}` | HTTP headers (use `${ENV_VAR}` for secrets) |
| `allowedEnvVars` | string[] | http | No | `[]` | Environment variables passed to the request |
| `async` | boolean | command | No | `false` | Fire-and-forget (stdout/exit ignored) |
| `shell` | string | command | No | system default | Shell to use (e.g., `"bash"`, `"zsh"`) |
| `timeout` | number | All | No | varies | Seconds before kill: command=600, prompt=30, agent=60 |
| `statusMessage` | string | All | No | - | Message shown in UI while hook runs |
| `once` | boolean | frontmatter only | No | `false` | Run only once per session (NOT in settings.json) |
