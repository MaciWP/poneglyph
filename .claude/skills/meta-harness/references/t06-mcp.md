---
parent: meta-harness
name: t06-mcp
description: T6 MCP configuration entry pack. Does not implement an MCP server.
---

# T6 — MCP config entry

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md). Out of scope: writing a server from scratch.

## 1. What / when

Wire an existing MCP server into a host. Implementing the server is application code, not this skill.

## 2. Lookup

Claude MCP docs. Codex MCP / config (developers.openai.com/codex). Grok `07-mcp-servers.md`. Protocol: modelcontextprotocol.io.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Path | Project `.mcp.json`. User: `~/.claude.json` `mcpServers` (not `settings.json` — that key does not load) | `~/.codex/config.toml` `[mcp_servers.<name>]` (confirm live) | `~/.grok/config.toml` `[mcp_servers.<name>]`; project-scoped files may contribute `[mcp_servers]` |
| Transport | command XOR HTTP(S) URL (`check:config`) | stdio / HTTP per vendor page | stdio, HTTP, streamable; `enabled = true` |
| Secrets | Env / key files — **never** commit tokens in the JSON/TOML | same | `env = { API_KEY = "sk-..." }` in docs is an example — use env interpolation, not a committed secret |
| Disable | `/mcp` → `disabledMcpServers`. Reject project `.mcp.json` → `disabledMcpjsonServers` (distinct lists) | `[mcp_servers.<id>] enabled = false` (or omit / `codex mcp` / `/mcp`) | Project sticky `[mcp_servers.<name>] enabled = false`. User `disabled_mcp_servers` via `grok mcp disable` (does not rewrite project configs) |
| Gate | `check:config` MCP subset (command XOR URL; no credentials in URLs) | not this repo's scan unless the file is a scanned JSON/TOML | not the Claude `.mcp.json` scan |

## 4. Min template

Template N/A as a skill file. Write the native config mapping. `check:config` already rejects credentials in URLs.

## 5. Evidence

T1 + B: Grok 07, Claude MCP, `config-quality.md` MCP row. **sin evidencia A/B** for “one transport is faster”.

## 6. Poneglyph grain

Secrets stay in env. Install/sync is named, not reimplemented.

## 7. Absences

| Cell | Status |
|---|---|
| Implementing an MCP server | **ausente** (router when-NOT) |
| Pasting Claude `.mcp.json` into Codex | **ausente** |
