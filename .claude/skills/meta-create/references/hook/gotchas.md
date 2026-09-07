---
parent: meta-create
name: gotchas
description: Critical hook pitfalls, directory conventions and testing approaches.
---

# Hook Gotchas, Directory & Testing

Critical pitfalls when creating hooks. Read these BEFORE writing any hook.

## Gotchas

| # | Gotcha | Detail | Fix |
|---|--------|--------|-----|
| 1 | **Shebang on Windows** | `#!/usr/bin/env bash` fails — Claude Code runs with reduced PATH where `env` is not found | Use `#!/bin/bash` (absolute) or prefer `.ts` with `#!/usr/bin/env bun` (bun is in PATH via settings.json) |
| 2 | **stop_hook_active guard** | Stop and SubagentStop hooks that exit 2 create INFINITE LOOPS — Claude retries the stop, hook blocks again, forever | Check `if (input.stop_hook_active) process.exit(0);` at the top of every Stop/SubagentStop hook |
| 3 | **async: true ignores everything** | When `async: true`, exit codes AND stdout are completely ignored — fire-and-forget | Only use `async: true` for observability hooks (logging, metrics). Never for validators or transforms |
| 4 | **stdin is single-read** | `readStdin()` or `Bun.stdin.text()` can only be called ONCE per process. Second read returns empty | Read stdin into a variable once at the top, reuse the variable |
| 5 | **$HOME in settings.json** | Use `$HOME/.claude/hooks/` for global hooks. Relative paths resolve from the PROJECT cwd, not from `~/.claude/` | Always use `$HOME` prefix for hooks in global settings.json |
| 6 | **Timeout defaults** | `command`: 600s, `prompt`: 30s, `agent`: 60s — exceeding timeout kills the hook silently | Set explicit timeout matching your hook's expected duration |
| 7 | **MCP tool names** | MCP tools use `mcp__<server>__<tool>` pattern, not plain names | Use regex matcher: `"mcp__memory__.*"` |
| 8 | **once: true** | Available in skill/agent frontmatter hooks — runs only once per session, NOT in settings.json hooks | Use only in frontmatter-scoped hooks |
| 9 | **Hook ordering** | Multiple hooks on the same event run IN ORDER of the array in settings.json | Place blocking validators before async loggers |
| 10 | **Bun.stdin vs readFileSync** | `Bun.stdin.text()` is async and preferred. `readFileSync("/dev/stdin")` is sync but works. Do NOT mix both | Pick one approach per hook and stick with it |
| 11 | **Exit 2 only blocks on specific events** | Exit 2 only blocks on PreToolUse and PermissionRequest. On other events, exit 2 is treated as an error | Only use exit 2 for PreToolUse and PermissionRequest hooks |
| 12 | **Global vs project hooks** | Global hooks (`~/.claude/settings.json`) run for ALL projects. Project hooks (`.claude/settings.json`) are project-scoped | Put general-purpose hooks in global, project-specific in local |

## Directory Structure

```
.claude/hooks/
├── {hook-name}.ts              # Hook scripts
├── {hook-name}.test.ts         # Tests for the hook
├── lib/                        # Shared utilities
│   ├── hook-stdin.ts           # stdin parsing
│   └── yaml-frontmatter.ts     # YAML frontmatter parser
└── validators/                 # Grouped validators
    ├── config.ts               # Shared config (exit codes, readStdin)
    ├── security/               # Security validators
    ├── code-quality/           # Quality validators
    ├── format/                 # Format validators
    ├── context/                # Context tracking
    └── stop/                   # Stop validators
```

## Testing Hooks

| Method | Command | When |
|--------|---------|------|
| Unit test | `bun test .claude/hooks/{hook-name}.test.ts` | After implementation |
| Manual stdin | `echo '{"tool_name":"Edit","tool_input":{}}' \| bun run .claude/hooks/{hook-name}.ts` | Quick validation |
| Dry run | Set `HOOK_DRY_RUN=1` env var (if supported) | Pre-deploy check |
| Integration | Trigger the event in Claude Code and check behavior | Final verification |
