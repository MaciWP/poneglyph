---
parent: meta-create
name: reference
description: Transport, scope, env-expansion, auth methods, CLI shortcuts and config file structure for MCP.
---

# MCP Reference

## Contents

- [Transports](#transports)
- [Scopes](#scopes)
- [Environment Variable Expansion](#environment-variable-expansion)
- [Authentication Methods](#authentication-methods)
- [CLI Shortcuts](#cli-shortcuts)
- [Config File Structure](#config-file-structure)

## Transports

| Transport | Use Case | Config Fields |
|-----------|----------|---------------|
| **http** (recommended) | Cloud services, remote APIs | `type: "http"`, `url`, `headers` |
| **sse** (deprecated) | Legacy streaming | Use `http` instead |
| **stdio** | Local processes, direct system access | `command`, `args`, `env` |

### Transport Decision Guide

| Signal | Transport |
|--------|-----------|
| URL, endpoint, API, cloud, remote, webhook | `http` |
| npx, command, local, process, CLI, binary | `stdio` |
| SSE, streaming (legacy) | `http` (SSE is deprecated) |

## Scopes

| Scope | Default | Stored In | Shared via VCS |
|-------|---------|-----------|----------------|
| `local` | Yes | `~/.claude.json` (per project path) | No |
| `project` | No | `.mcp.json` at project root | Yes |
| `user` | No | `~/.claude.json` (global) | No |

**Precedence**: local > project > user. A local config overrides project and user.

### Scope Decision Guide

| Signal | Scope |
|--------|-------|
| Team needs access, shared credentials | `project` |
| Personal API key, local dev tool | `local` |
| Use across all projects, personal utility | `user` |
| Contains secrets/tokens | `local` or `user` (NEVER `project`) |

## Environment Variable Expansion

Syntax: `${VAR}` or `${VAR:-default}` in command, args, env, url, and headers.

| Syntax | Behavior |
|--------|----------|
| `${VAR}` | Expands to value of VAR. Config parse fails if unset. |
| `${VAR:-fallback}` | Expands to value of VAR, or `fallback` if unset. |

## Authentication Methods

| Method | Config | When to Use |
|--------|--------|-------------|
| API key in header | `headers: { "Authorization": "Bearer ${API_KEY}" }` | Static API keys |
| OAuth 2.0 | `/mcp` in session to authenticate in browser | Cloud services (Google, GitHub) |
| headersHelper | `headersHelper: "path/to/script"` | Dynamic/SSO tokens, short-lived credentials |
| Pre-configured OAuth | `--client-id` + `--client-secret` in CLI | CI/CD pipelines |

## CLI Shortcuts

| Action | Command |
|--------|---------|
| Add HTTP server | `claude mcp add --transport http <name> <url>` |
| Add stdio server | `claude mcp add <name> -- <command> [args...]` |
| Add with scope | `claude mcp add --scope project <name> -- <command>` |
| Add with env vars | `claude mcp add --env KEY=val <name> -- <command>` |
| Add with headers | `claude mcp add --transport http --header "Auth: Bearer token" <name> <url>` |
| List all servers | `claude mcp list` |
| Remove server | `claude mcp remove <name>` |
| Add raw JSON | `claude mcp add-json <name> '<json>'` |
| Import from Desktop | `claude mcp add-from-claude-desktop` |

**IMPORTANT**: All flags (`--transport`, `--env`, `--scope`, `--header`) MUST come BEFORE the server name. `--` separates server name from command in stdio transport.

## Config File Structure

| Scope | File | Structure |
|-------|------|-----------|
| `project` | `.mcp.json` (project root) | Top-level `mcpServers` object |
| `local` | `~/.claude.json` | Nested under project path key |
| `user` | `~/.claude.json` | Global `mcpServers` section |

### .mcp.json (project scope)

```json
{
  "mcpServers": {
    "server-a": { ... },
    "server-b": { ... }
  }
}
```

### ~/.claude.json (local/user scope)

```json
{
  "projects": {
    "/path/to/project": {
      "mcpServers": {
        "local-server": { ... }
      }
    }
  },
  "mcpServers": {
    "global-server": { ... }
  }
}
```
