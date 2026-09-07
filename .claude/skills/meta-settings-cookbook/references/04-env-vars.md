# Environment Variables Reference

## Where to Set

| Method | Scope | Persistence |
|--------|-------|-------------|
| `settings.json` → `env` | Per scope (user/project/local) | Permanent |
| Shell export | Current terminal | Session |
| `.env` file | N/A — Claude Code does not read .env | N/A |

## Most Useful Env Vars

| Variable | Purpose |
|----------|---------|
| `CLAUDE_CODE_EFFORT_LEVEL` | Override effort: `low`, `medium`, `high`, `max`, `auto` |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable agent teams (`1`) |
| `MAX_THINKING_TOKENS` | Max tokens for extended thinking (`0` to disable) |
| `ANTHROPIC_MODEL` | Override model — wins over the `model` setting; `--model`/`/model` win over it |
| `ANTHROPIC_DEFAULT_MODEL` | Model new sessions start on; a `/model` pick still overrides and persists (2.1.236). Applies only when no settings file sets `model` |
| `CLAUDE_CODE_SUBAGENT_MODEL` | **Default** model for subagents (2.1.251: an agent-definition or per-spawn model wins). Poneglyph sets the cheap tier as backstop for a spawn that forgot its model; `fork` ignores it (parent model) |
| `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` | Apply `CLAUDE_CODE_SUBAGENT_MODEL` to EVERY subagent, ignoring per-spawn overrides (2.1.257) — not used here |
| `CLAUDE_CODE_ENABLE_TODO_TOOLS` | `1` restores `TaskCreate/…`/`TodoWrite` on models where they were retired (2.1.233) |
| `CLAUDE_CODE_RESTRICTED` | `1` = same as `--restricted`: no Bash/code tools or WebFetch, file tools inside cwd, no `bypassPermissions`, settings files ignored (2.1.248). Used by `consult`'s Claude adapter |
| `CLAUDE_CODE_DISABLE_1M_CONTEXT` | Hold every model with a native 1M window to 200K via auto-compaction (2.1.223) |
| `CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT` | `1` lets sessions on unrecognized model IDs grow past the assumed window (2.1.223 default keeps them inside it) |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | Real window for an unrecognized model (local Qwen: `131072`) `[Probable — not in the public env-vars page; verified in use in docs/local-model]` |
| `CLAUDE_CODE_GOAL_CHECKIN_MINUTES` | `/goal` check-in cadence on long background work (`0` disables; 2.1.234) |
| `CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS` | WebFetch URL cache TTL (default 15 min; 2.1.233) |
| `DISABLE_AUTO_COMPACT` | Disable auto-compaction (`1`) |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | Context window threshold for compaction (default 200K) |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | Max parallel tools (default 10) |
| `BASH_DEFAULT_TIMEOUT_MS` | Bash timeout (default 120000) |
| `ENABLE_TOOL_SEARCH` | MCP tool search (`true`/`false`/`auto`) |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | Disable auto memory (`1`) |

## Gotchas

| Gotcha | Detail |
|--------|--------|
| Claude Code does NOT read `.env` files | Use `settings.json` `env` field or shell exports |
| Env var > setting | `CLAUDE_CODE_EFFORT_LEVEL` overrides `effortLevel` in settings.json |
| `CLAUDECODE=1` | Set automatically in Bash tool spawned shells (NOT in hooks or status line) |
