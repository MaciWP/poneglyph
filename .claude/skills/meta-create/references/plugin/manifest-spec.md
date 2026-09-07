---
parent: meta-create
name: manifest-spec
description: plugin.json schema, component paths, userConfig, env vars, installation scopes, agent security restrictions.
---

# Plugin Manifest Specification

## Contents

- [Directory Structure (Standard Layout)](#directory-structure-standard-layout)
- [Manifest Schema (plugin.json)](#manifest-schema-pluginjson)
- [Component Path Fields](#component-path-fields)
- [Environment Variables](#environment-variables)
- [userConfig (User-Facing Settings)](#userconfig-user-facing-settings)
- [Installation Scopes](#installation-scopes)
- [Agent Security Restrictions in Plugins](#agent-security-restrictions-in-plugins)
- [Hooks in Plugins](#hooks-in-plugins)

Full reference for `plugin.json`, component resolution, environment variables, scopes and agent security restrictions.

## Directory Structure (Standard Layout)

```
{plugin-name}/
├── .claude-plugin/
│   └── plugin.json          # Manifest (optional but recommended)
├── skills/                   # Skills with name/SKILL.md structure
│   └── {skill-name}/
│       └── SKILL.md
├── commands/                 # Skills as flat .md files
├── agents/                   # Subagent definitions
│   └── {agent-name}.md
├── hooks/
│   └── hooks.json            # Hook configuration (NOT settings.json)
├── .mcp.json                 # MCP server definitions
├── .lsp.json                 # LSP server configurations
├── output-styles/            # Output style definitions
├── bin/                      # Executables added to PATH
├── scripts/                  # Hook and utility scripts
├── settings.json             # Default settings (only agent settings supported)
└── CHANGELOG.md
```

**CRITICAL**: `.claude-plugin/` contains ONLY `plugin.json`. All component directories (skills/, agents/, hooks/) go at plugin ROOT, not inside `.claude-plugin/`.

## Manifest Schema (plugin.json)

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Brief plugin description",
  "author": {
    "name": "Author Name",
    "email": "author@example.com"
  },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "skills": "./skills/",
  "commands": "./commands/",
  "agents": "./agents/",
  "mcpServers": "./.mcp.json",
  "lspServers": "./.lsp.json",
  "outputStyles": "./output-styles/"
}
```

Only `name` is required if manifest exists. The manifest itself is optional — Claude Code auto-discovers components in default locations.

## Component Path Fields

| Field | Type | Description |
|-------|------|-------------|
| `skills` | string\|array | Skill directories with `name/SKILL.md` |
| `commands` | string\|array | Flat `.md` skill files |
| `agents` | string\|array | Agent markdown files |
| `hooks` | string\|array\|object | ADDITIONAL hook config files or an inline definition. Never list the standard `./hooks/hooks.json`: it is auto-loaded and the duplicate fails the whole plugin load ("Duplicate hooks file detected", CC 2.1.259, measured 2026-09-03) |
| `mcpServers` | string\|array\|object | MCP config file or inline definition |
| `lspServers` | string\|array\|object | LSP config file or inline definition |
| `outputStyles` | string\|array | Output style files |
| `userConfig` | object | User-configurable values prompted at enable time |
| `channels` | array | Channel declarations for message injection |

## Environment Variables

| Variable | Purpose | Persists across updates |
|----------|---------|------------------------|
| `${CLAUDE_PLUGIN_ROOT}` | Absolute path to plugin installation dir | NO (changes on update) |
| `${CLAUDE_PLUGIN_DATA}` | Persistent directory for plugin state | YES (`~/.claude/plugins/data/{id}/`) |

Both are substituted inline in skill content, agent content, hook commands, MCP/LSP configs. Also exported as env vars to subprocesses.

## userConfig (User-Facing Settings)

```json
{
  "userConfig": {
    "api_endpoint": {
      "description": "Your team's API endpoint",
      "sensitive": false
    },
    "api_token": {
      "description": "API authentication token",
      "sensitive": true
    }
  }
}
```

| Aspect | Behavior |
|--------|----------|
| Reference in configs | `${user_config.KEY}` in MCP, LSP, hooks |
| Env var export | `CLAUDE_PLUGIN_OPTION_<KEY>` to subprocesses |
| Sensitive values | Stored in system keychain (~2KB limit) |
| Non-sensitive values | Stored in `settings.json` under `pluginConfigs` |
| Prompted when | At plugin enable time |

## Installation Scopes

| Scope | Settings file | Use case |
|-------|---------------|----------|
| `user` | `~/.claude/settings.json` | Personal (default) |
| `project` | `.claude/settings.json` | Team, via VCS |
| `local` | `.claude/settings.local.json` | Project-specific, gitignored |

## Agent Security Restrictions in Plugins

Plugin agents have restricted frontmatter. The following fields are NOT supported:

| Forbidden | Reason |
|-----------|--------|
| `hooks` | Security: agent-scoped hooks could bypass plugin sandbox |
| `mcpServers` | Security: agent cannot declare its own MCP servers |
| `permissionMode` | Security: agent cannot escalate its own permissions |

Plugin agents DO support: `name`, `description`, `model`, `effort`, `maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, `isolation`.

## Hooks in Plugins

Plugins use `hooks/hooks.json` (NOT `settings.json`). Same hook format as global hooks:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format-code.sh"
          }
        ]
      }
    ]
  }
}
```

**Key difference**: Use `${CLAUDE_PLUGIN_ROOT}` to reference scripts bundled with the plugin, ensuring paths resolve correctly regardless of installation location.

**Auto-load rule**: `hooks/hooks.json` at the plugin root is picked up automatically. Do NOT also list it under `manifest.hooks` — Claude Code refuses to load the plugin ("Hook load failed: Duplicate hooks file detected", 2.1.259). `manifest.hooks` is only for extra files. Bump `version` after fixing: the cache keys on it.
