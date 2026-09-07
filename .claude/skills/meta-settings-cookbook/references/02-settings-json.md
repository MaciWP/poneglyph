# settings.json Reference

## Scopes & Precedence

| Priority | Scope | File | Shared |
|----------|-------|------|--------|
| 1 (highest) | Managed | System paths | Org |
| 2 | CLI args | `--flag` | Session |
| 3 | Local | `.claude/settings.local.json` | No |
| 4 | Project | `.claude/settings.json` | Team |
| 5 (lowest) | User | `~/.claude/settings.json` | No |

Arrays **merge + deduplicate** across scopes (not replace).

## Template: Project settings.json

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(bun test *)",
      "Bash(bun run *)",
      "Bash(git *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)"
    ]
  },
  "env": {
    "NODE_ENV": "development"
  }
}
```

## Template: User settings.json (personal preferences)

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "effortLevel": "high",
  "language": "english",
  "showThinkingSummaries": true,
  "voiceEnabled": false
}
```

## Key Settings Reference

| Setting | Type | Description |
|---------|------|-------------|
| `permissions` | object | allow/deny/ask arrays + defaultMode |
| `env` | object | Env vars applied to every session |
| `hooks` | object | Hook registration (see `meta-create` skill: `references/hook/`) |
| `model` | string | Override default model (`ANTHROPIC_MODEL` in the shell wins over it; `ANTHROPIC_DEFAULT_MODEL` applies only when no file sets `model`) |
| `fallbackModel` | string \| string[] | Ordered backup chain when the primary is overloaded; taken whole from the highest-precedence file |
| `effortLevel` | string | `low`, `medium`, `high`, `xhigh`, `max` (`/effort` saves a default per model since 2.1.251; `s` = session-only since 2.1.257) |
| `outputStyle` | string | Active output style name |
| `language` | string | Claude's response language |
| `attribution` | object | Git commit/PR attribution. `commit`: string (default `"Co-Authored-By: Claude <claude@anthropic.com>"`), `pr`: string (default `"[Created by Claude](https://claude.ai)"`), `sessionUrl`: boolean. **Empty string `""` hides** the trailer/line — Poneglyph sets both to `""` (no AI authorship). ⚠️ The reference doc mentions `false`, but the 2.1.258 schema rejects booleans ("Expected string") and a settings file with ONE invalid key is **skipped entirely** (hooks, permissions, style — everything). `includeCoAuthoredBy` is deprecated |
| `promptCacheTtl` / `subagentPromptCacheTtl` | number (minutes) \| `"off"` | Cache lifetime for the main conversation / for subagents and side requests (default 5; 2.1.243) |
| `modelPicker` | array | Curated `/model` list (`{id, label}`), user or managed scope only; never merged across files (2.1.243) |
| `modelOverrides` | object | Map model IDs to a provider's IDs (Bedrock ARNs, gateways) |
| `feedbackDrafts` | boolean | Let Claude queue `SendFeedback` drafts for `/feedback` (default `true`; 2.1.247) |
| `crossSessionInbound` | `"allow"` \| `"notify"` \| `"deny"` | Messages from your other Claude sessions: deliver / notice only (default) / refuse. Project/local files may only tighten (2.1.224) |
| `dialogExpiry` | number (ms) | How long a forwarded dialog (Remote Control / SDK) waits before cancelling (default 30000) |
| `minimumVersion` | string | Auto-update floor (Poneglyph: `settings.global.json`) |
| `worktree` | object | `symlinkDirectories`, `sparsePaths` |
| `statusLine` | object | Custom status bar: `type`, `command`, `padding`, `refreshInterval` |
| `sandbox` | object | Sandboxing configuration |
| `autoMode` | object | Auto mode classifier customization |
| `claudeMdExcludes` | array | Globs for CLAUDE.md files to skip |
| `enabledPlugins` / `extraKnownMarketplaces` | object | `claude plugin install` and `claude plugin marketplace add` WRITE these into the user settings file. In Poneglyph that file is generated: mirror both keys in `settings.global.json` or the next `sync-claude --execute` silently disables the plugin (measured 2026-09-03, plan 032/WP2) |
| `showThinkingSummaries` | boolean | Show thinking process summaries |

## Gotchas

| Gotcha | Detail |
|--------|--------|
| `$schema` field | Add for IDE autocomplete: `"$schema": "https://json.schemastore.org/claude-code-settings.json"` |
| MCP is NOT in settings.json | MCP servers go in `.mcp.json` (project) or `~/.claude.json` (user/local) |
| Arrays merge, not replace | `allow` rules from user + project + managed all concatenate |
| `.local.json` is gitignored | Use for personal overrides that should not be committed |
| Some keys ignore project/local scope | `defaultMode: "bypassPermissions"` (2.1.257), `remoteControlAtStartup: true` (2.1.222), `modelPicker`, `sandbox.ripgrep` and `env.CLAUDE_CONFIG_DIR`/`TMPDIR` (2.1.251) only apply from user or managed settings |
| Tools retired per model | `TaskCreate/TaskUpdate/TaskList/TaskGet` and `TodoWrite` do not exist on Opus 4.8 / Sonnet 5 / Fable 5+ (2.1.233) — an `allow` entry for them is dead weight; `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` brings them back |
