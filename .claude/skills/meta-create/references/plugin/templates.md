---
parent: meta-create
name: templates
description: Minimal, full and marketplace plugin templates with placeholders.
---

# Plugin Templates

## Contents

- [Template: Minimal Plugin (Skills Only)](#template-minimal-plugin-skills-only)
- [Template: Full Plugin (All Components)](#template-full-plugin-all-components)
- [Template: Marketplace Entry](#template-marketplace-entry)

Three canonical templates: minimal (skills only), full (all components) and marketplace entry.

## Template: Minimal Plugin (Skills Only)

**Use when**: Packaging reusable knowledge without automation.

**Directory structure**:

```
{plugin-name}/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── {skill-name}/
        └── SKILL.md
```

**plugin.json**:

```json
{
  "name": "{{PLUGIN_NAME}}",
  "version": "1.0.0",
  "description": "{{DESCRIPTION}}",
  "author": {
    "name": "{{AUTHOR_NAME}}"
  },
  "keywords": ["{{KEYWORD_1}}", "{{KEYWORD_2}}"],
  "skills": "./skills/"
}
```

**Placeholders**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{PLUGIN_NAME}}` | kebab-case plugin name | `code-quality-pack` |
| `{{DESCRIPTION}}` | Brief purpose | `Code quality skills and patterns` |
| `{{AUTHOR_NAME}}` | Author display name | `Dev Team` |
| `{{KEYWORD_1}}` | Primary keyword | `quality` |
| `{{KEYWORD_2}}` | Secondary keyword | `review` |
| `{{SKILL_NAME}}` | kebab-case skill name | `quality-checklist` |

## Template: Full Plugin (All Components)

**Use when**: Complete extension with skills, agents, hooks, and MCP.

**Directory structure**:

```
{plugin-name}/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── {skill-name}/
│       └── SKILL.md
├── agents/
│   └── {agent-name}.md
├── hooks/
│   └── hooks.json
├── .mcp.json
├── scripts/
│   └── format-code.sh
└── CHANGELOG.md
```

**plugin.json**:

```json
{
  "name": "{{PLUGIN_NAME}}",
  "version": "1.0.0",
  "description": "{{DESCRIPTION}}",
  "author": {
    "name": "{{AUTHOR_NAME}}",
    "email": "{{AUTHOR_EMAIL}}"
  },
  "repository": "{{REPO_URL}}",
  "license": "MIT",
  "keywords": ["{{KEYWORD_1}}", "{{KEYWORD_2}}", "{{KEYWORD_3}}"],
  "skills": "./skills/",
  "agents": "./agents/",
  "mcpServers": "./.mcp.json",
  "userConfig": {
    "{{CONFIG_KEY}}": {
      "description": "{{CONFIG_DESCRIPTION}}",
      "sensitive": false
    }
  }
}
```

**hooks/hooks.json**:

```json
{
  "hooks": {
    "{{EVENT}}": [
      {
        "matcher": "{{MATCHER}}",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/{{SCRIPT_NAME}}"
          }
        ]
      }
    ]
  }
}
```

**.mcp.json**:

```json
{
  "mcpServers": {
    "{{SERVER_NAME}}": {
      "command": "{{COMMAND}}",
      "args": ["{{ARG_1}}"],
      "env": {
        "API_TOKEN": "${user_config.api_token}"
      }
    }
  }
}
```

**Placeholders**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{PLUGIN_NAME}}` | kebab-case plugin name | `database-toolkit` |
| `{{DESCRIPTION}}` | Brief purpose | `Database tools with query validation` |
| `{{AUTHOR_NAME}}` | Author display name | `Dev Team` |
| `{{AUTHOR_EMAIL}}` | Author email | `dev@example.com` |
| `{{REPO_URL}}` | Git repository URL | `https://github.com/org/plugin` |
| `{{KEYWORD_1-3}}` | Relevant keywords | `database`, `sql`, `validation` |
| `{{CONFIG_KEY}}` | userConfig key name | `db_connection_string` |
| `{{CONFIG_DESCRIPTION}}` | What the config does | `Database connection string` |
| `{{EVENT}}` | Hook event name | `PostToolUse` |
| `{{MATCHER}}` | Tool matcher pattern | `Write\|Edit` |
| `{{SCRIPT_NAME}}` | Script filename | `format-code.sh` |
| `{{SERVER_NAME}}` | MCP server identifier | `db-query` |
| `{{COMMAND}}` | MCP server command | `npx` |
| `{{ARG_1}}` | Command argument | `@org/db-mcp-server` |
| `{{AGENT_NAME}}` | Agent filename (no ext) | `db-validator` |
| `{{SKILL_NAME}}` | Skill directory name | `query-patterns` |

## Template: Marketplace Entry

**Use when**: Distributing one or more plugins via a marketplace.

**marketplace.json** (at marketplace repo root):

```json
{
  "name": "{{MARKETPLACE_NAME}}",
  "owner": {
    "name": "{{OWNER_NAME}}"
  },
  "plugins": [
    {
      "name": "{{PLUGIN_NAME}}",
      "source": "{{SOURCE}}",
      "description": "{{DESCRIPTION}}",
      "version": "1.0.0"
    }
  ]
}
```

**Source types**:

| Type | Format | Example |
|------|--------|---------|
| Relative path | `./plugins/{name}` | `./plugins/code-quality` |
| GitHub repo | `{"source": "github", "repo": "owner/repo"}` | `{"source": "github", "repo": "acme/lint-plugin"}` |
| Git URL | `{"source": "git", "url": "https://..."}` | `{"source": "git", "url": "https://git.corp.com/plugin.git"}` |
| Git subdirectory | `{"source": "git-subdir", "url": "...", "path": "..."}` | Path within a monorepo |
| npm | `{"source": "npm", "package": "@org/plugin"}` | npm registry package |

**Placeholders**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{MARKETPLACE_NAME}}` | Marketplace identifier | `acme-tools` |
| `{{OWNER_NAME}}` | Marketplace owner | `ACME Corp` |
| `{{PLUGIN_NAME}}` | Plugin name | `code-quality` |
| `{{SOURCE}}` | Plugin source location | `./plugins/code-quality` |
| `{{DESCRIPTION}}` | Plugin description | `Code quality review tools` |
