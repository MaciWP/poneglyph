---
parent: meta-create
name: gotchas
description: Non-obvious MCP behaviors and troubleshooting for common failure modes.
---

# MCP Gotchas & Troubleshooting

## Gotchas

| Gotcha | Problem | Solution |
|--------|---------|----------|
| **Windows npx** | stdio servers with `npx` fail to spawn on Windows | Use `cmd /c` wrapper: `"command": "cmd", "args": ["/c", "npx", "-y", "@some/package"]` |
| **Flag order** | `claude mcp add my-server --scope project` is WRONG | Flags MUST come before server name: `claude mcp add --scope project my-server` |
| **Local scope path** | `local` scope stores in `~/.claude.json`, NOT `.claude/settings.local.json` | Check `~/.claude.json` under the project path key |
| **OAuth auth** | Remote servers may require browser-based OAuth flow | Use `/mcp` command in session to authenticate interactively |
| **Output limits** | Warning at 10K tokens, hard max 25K per tool response | Override with env: `MAX_MCP_OUTPUT_TOKENS=50000` |
| **Deferred tools** | MCP tools are deferred by default (only names loaded at startup) | Claude searches tool definitions on demand. Requires Sonnet 4+ or Opus 4+ |
| **headersHelper** | For dynamic auth (SSO, short-lived tokens), static headers are insufficient | Use `headersHelper` field pointing to a script that outputs JSON headers to stdout |
| **Managed lockdown** | `managed-mcp.json` at system path prevents all user modifications | Contact IT admin; users cannot add/modify servers when managed config exists |
| **SSE deprecated** | `sse` transport still works but is legacy | Always use `http` transport for new remote servers |
| **Env var required** | `${VAR}` without default causes config parse failure if VAR is unset | Use `${VAR:-default}` for optional vars, or document required vars clearly |

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Server not appearing in `claude mcp list` | Config in wrong file/scope | Verify scope and file location |
| "Connection refused" on stdio | Command not found or wrong path | Check command exists: `which <command>` |
| "Unauthorized" on http | Missing or expired auth token | Verify env var is set, use `/mcp` for OAuth |
| Tools not available | Deferred loading, model too old | Use Sonnet 4+ or Opus 4+; tools load on demand |
| Config parse error | Env var referenced but not set | Set the variable or use `${VAR:-default}` syntax |
| "Cannot modify servers" | Managed lockdown active | Check for `managed-mcp.json` at system path |
