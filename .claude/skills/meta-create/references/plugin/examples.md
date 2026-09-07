---
parent: meta-create
name: examples
description: Three worked plugin examples (skills+hooks pack, skills+mcp+agents toolkit, marketplace distribution).
---

# Worked Plugin Examples

## Contents

- [Example 1: Code Quality Plugin (Skills + Hooks)](#example-1-code-quality-plugin-skills-hooks)
- [Example 2: Database Tools Plugin (Skills + MCP + Agents)](#example-2-database-tools-plugin-skills-mcp-agents)
- [Responsibilities](#responsibilities)
- [Constraints](#constraints)
- [Example 3: Marketplace Distribution](#example-3-marketplace-distribution)

Three complete end-to-end plugins showing the shape of finished files for common patterns.

## Example 1: Code Quality Plugin (Skills + Hooks)

```
/meta-create plugin code-quality-pack skills,hooks
```

**Creates**:

```
code-quality-pack/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── quality-review/
│       └── SKILL.md
├── hooks/
│   └── hooks.json
└── scripts/
    └── check-complexity.sh
```

**plugin.json**:

```json
{
  "name": "code-quality-pack",
  "version": "1.0.0",
  "description": "Code quality skills and automated formatting hooks",
  "author": {
    "name": "Dev Team"
  },
  "keywords": ["quality", "review", "formatting"],
  "skills": "./skills/",
  "hooks": "./hooks/hooks.json"
}
```

**hooks/hooks.json**:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/check-complexity.sh"
          }
        ]
      }
    ]
  }
}
```

**skills/quality-review/SKILL.md**:

```markdown
---
name: quality-review
description: |
  Code quality review patterns and checklist.
  Use proactively when: reviewing code quality, checking for smells, SOLID violations.
  Keywords - quality, review, smells, SOLID, clean code
type: encoded-preference
---

# Quality Review

Review code for quality patterns...
```

## Example 2: Database Tools Plugin (Skills + MCP + Agents)

```
/meta-create plugin database-toolkit skills,mcp,agents
```

**Creates**:

```
database-toolkit/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── query-patterns/
│       └── SKILL.md
├── agents/
│   └── db-validator.md
└── .mcp.json
```

**plugin.json**:

```json
{
  "name": "database-toolkit",
  "version": "1.0.0",
  "description": "Database query patterns, MCP server, and validation agent",
  "author": {
    "name": "Data Team",
    "email": "data@example.com"
  },
  "keywords": ["database", "sql", "query", "validation"],
  "skills": "./skills/",
  "agents": "./agents/",
  "mcpServers": "./.mcp.json",
  "userConfig": {
    "db_connection_string": {
      "description": "Database connection string (e.g., postgres://user:pass@host/db)",
      "sensitive": true
    }
  }
}
```

**.mcp.json**:

```json
{
  "mcpServers": {
    "db-query": {
      "command": "npx",
      "args": ["@database-toolkit/mcp-server"],
      "env": {
        "DATABASE_URL": "${user_config.db_connection_string}"
      }
    }
  }
}
```

**agents/db-validator.md**:

```markdown
---
description: |
  Database query validator. Checks SQL queries for performance and safety.
  Use proactively when: validating SQL, checking query performance, reviewing migrations.
  Keywords - sql, query, validate, migration, performance
tools: Read, Grep, Glob
disallowedTools: Task, Edit, Write, Bash
effort: low
---

You are a database query validation specialist.

## Responsibilities
- Validate SQL queries for correctness
- Check for N+1 query patterns
- Review migration safety
- Suggest index optimizations

## Constraints
- Read-only analysis, no modifications
- Always cite file:line for findings
```

## Example 3: Marketplace Distribution

Publishing a plugin marketplace with GitHub source:

**marketplace.json** (at marketplace repo root):

```json
{
  "name": "acme-tools",
  "owner": {
    "name": "ACME Corp"
  },
  "plugins": [
    {
      "name": "code-quality-pack",
      "source": {
        "source": "github",
        "repo": "acme/code-quality-pack"
      },
      "description": "Code quality skills and automated formatting hooks",
      "version": "1.0.0"
    },
    {
      "name": "database-toolkit",
      "source": "./plugins/database-toolkit",
      "description": "Database tools with query validation and MCP server",
      "version": "1.0.0"
    }
  ]
}
```

**Usage**:

```bash
# Add the marketplace
claude plugin marketplace add https://github.com/acme/tool-marketplace

# Install a plugin from it
claude plugin install code-quality-pack@acme-tools

# Install with project scope (committed to VCS)
claude plugin install database-toolkit@acme-tools --scope project
```
