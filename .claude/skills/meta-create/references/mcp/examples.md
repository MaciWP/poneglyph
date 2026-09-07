---
parent: meta-create
name: examples
description: Three worked MCP server configurations (GitHub stdio, HTTP API, memory server).
---

# MCP Server Examples

## Contents

- [Example 1: GitHub MCP (stdio, project scope)](#example-1-github-mcp-stdio-project-scope)
- [Example 2: Custom API (http, local scope)](#example-2-custom-api-http-local-scope)
- [Example 3: Memory Server (stdio, user scope)](#example-3-memory-server-stdio-user-scope)

Three complete end-to-end configurations showing JSON + CLI + env vars for common patterns.

## Example 1: GitHub MCP (stdio, project scope)

```
/meta-create mcp github-mcp stdio
```

**JSON Config** (`.mcp.json` at project root):

```json
{
  "mcpServers": {
    "github-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

**Windows variant** (`.mcp.json`):

```json
{
  "mcpServers": {
    "github-mcp": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

**CLI Command**:

```bash
claude mcp add --scope project github-mcp -- npx -y @modelcontextprotocol/server-github

# Windows:
claude mcp add --scope project github-mcp -- cmd /c npx -y @modelcontextprotocol/server-github
```

**Environment Variables**:

| Variable | Purpose | How to Set |
|----------|---------|------------|
| `GITHUB_TOKEN` | GitHub API access | `export GITHUB_TOKEN="ghp_..."` |

## Example 2: Custom API (http, local scope)

```
/meta-create mcp analytics-api http
```

**JSON Config** (`~/.claude.json` under project path):

```json
{
  "mcpServers": {
    "analytics-api": {
      "type": "http",
      "url": "https://analytics.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${ANALYTICS_API_KEY}"
      }
    }
  }
}
```

**CLI Command**:

```bash
claude mcp add --transport http --header "Authorization: Bearer ${ANALYTICS_API_KEY}" analytics-api https://analytics.example.com/mcp
```

**Environment Variables**:

| Variable | Purpose | How to Set |
|----------|---------|------------|
| `ANALYTICS_API_KEY` | API authentication | `export ANALYTICS_API_KEY="ak_..."` |

## Example 3: Memory Server (stdio, user scope)

```
/meta-create mcp memory-server stdio
```

**JSON Config** (`~/.claude.json` global section):

```json
{
  "mcpServers": {
    "memory-server": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {}
    }
  }
}
```

**CLI Command**:

```bash
claude mcp add --scope user memory-server -- npx -y @modelcontextprotocol/server-memory

# Windows:
claude mcp add --scope user memory-server -- cmd /c npx -y @modelcontextprotocol/server-memory
```

**Environment Variables**: None required.

**Notes**: User scope makes this server available across all projects. Useful for persistent memory, note-taking, or cross-project context.
