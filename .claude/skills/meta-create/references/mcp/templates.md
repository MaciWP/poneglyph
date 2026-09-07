---
parent: meta-create
name: templates
description: JSON templates for HTTP and stdio MCP servers with placeholders.
---

# MCP Server Templates

## Contents

- [Template: HTTP Server (Remote API)](#template-http-server-remote-api)
- [Template: HTTP Server with headersHelper](#template-http-server-with-headershelper)
- [Template: stdio Server (Local Process)](#template-stdio-server-local-process)
- [Template: stdio Server (Windows npx)](#template-stdio-server-windows-npx)

Four canonical templates covering HTTP (static auth / dynamic auth) and stdio (Unix / Windows) transports.

## Template: HTTP Server (Remote API)

```json
{
  "mcpServers": {
    "{{SERVER_NAME}}": {
      "type": "http",
      "url": "{{URL}}",
      "headers": {
        "Authorization": "Bearer ${{{API_KEY_VAR}}}"
      }
    }
  }
}
```

**Placeholders**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{SERVER_NAME}}` | kebab-case server name | `my-api` |
| `{{URL}}` | Full URL to MCP endpoint | `https://api.example.com/mcp` |
| `{{API_KEY_VAR}}` | Env var name for API key | `MY_API_KEY` |

## Template: HTTP Server with headersHelper

For dynamic auth (SSO, short-lived tokens) where static headers are insufficient.

```json
{
  "mcpServers": {
    "{{SERVER_NAME}}": {
      "type": "http",
      "url": "{{URL}}",
      "headersHelper": "{{SCRIPT_PATH}}"
    }
  }
}
```

**Placeholders**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{SERVER_NAME}}` | kebab-case server name | `corporate-api` |
| `{{URL}}` | Full URL to MCP endpoint | `https://internal.corp.com/mcp` |
| `{{SCRIPT_PATH}}` | Path to script that outputs JSON headers to stdout | `./scripts/get-auth-headers.sh` |

## Template: stdio Server (Local Process)

```json
{
  "mcpServers": {
    "{{SERVER_NAME}}": {
      "command": "{{COMMAND}}",
      "args": [{{ARGS}}],
      "env": {
        "{{ENV_KEY}}": "${{{ENV_VAR}}}"
      }
    }
  }
}
```

**Placeholders**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{SERVER_NAME}}` | kebab-case server name | `github-mcp` |
| `{{COMMAND}}` | Executable command | `npx` |
| `{{ARGS}}` | JSON array of arguments | `"-y", "@modelcontextprotocol/server-github"` |
| `{{ENV_KEY}}` | Key name in env block | `GITHUB_TOKEN` |
| `{{ENV_VAR}}` | Env var to expand | `GITHUB_TOKEN` |

## Template: stdio Server (Windows npx)

`npx` in stdio requires a `cmd /c` wrapper on Windows. Without it, the process may not spawn.

```json
{
  "mcpServers": {
    "{{SERVER_NAME}}": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "{{PACKAGE}}"],
      "env": {
        "{{ENV_KEY}}": "${{{ENV_VAR}}}"
      }
    }
  }
}
```
