---
parent: harness-config
name: t10-settings
description: T10 host settings pack — Claude settings.json, Codex config.toml, Grok config.toml. Extra keys a host ignores stay ignored.
---

# T10 — Host settings

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md) · [t11-permissions.md](t11-permissions.md) · [t12-env.md](t12-env.md).
Absorbs cookbook `02-settings-json.md` (D27). Do not edit `sync-claude` / `sync-codex` / `sync-grok`.

## 1. What / when

Durable host defaults (model, TUI, feature flags, where hooks/MCP/plugins are registered). Permissions are T11. Env vars are T12. Output-style files are T13. Statusline keys are T14.

## 2. Lookup

Claude settings-reference (`code.claude.com/docs/en/settings-reference`). Codex `learn.chatgpt.com/docs/config-file/config-reference`. Grok `05-configuration.md` + `26-config-reference.md`.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Files | Managed → CLI → `.claude/settings.local.json` → project `.claude/settings.json` → `~/.claude/settings.json`. Arrays merge+dedupe | `~/.codex/config.toml`; repo `.codex/config.toml`; profiles | `~/.grok/config.toml` (host). `~/.grok/pager.toml` = TUI appearance only, not Claude settings. Project `.grok/config.toml` **only** `[mcp_servers]`, `[plugins]`, `[permission]`, `[mcp] max_output_bytes` |
| This repo | **Project `.claude/settings.json` stays hook-free**: `$schema` + `respectGitignore` only. Global via `settings.global.json` → sync | Host-native TOML | Host-native TOML; `grok inspect` shows who won |
| Extra keys | Invalid key can **skip the whole file** (attribution boolean vs string). Unknown keys: confirm live schema | Extra keys ignored or fail parse — confirm live | Unknown keys: `grok inspect` reports; do not copy Claude JSON keys into TOML |
| Reload | New session for most keys | Restart | Restart (`grok inspect`) |

MCP is **not** Claude `settings.json` (T6: `.mcp.json`).

## 4. Min template

Template N/A as a skill file. This-repo project floor:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "respectGitignore": true
}
```

Do not add `hooks` here. User/global templates belong in `settings.global.json` (named, not rewritten by this pack).

## 5. Evidence

T1 + B: vendor settings pages 2026-09-10. Cookbook 02 measured: one invalid key skips the whole Claude settings file. **sin evidencia A/B** for “ideal key count”.

## 6. Poneglyph grain

Name the install/sync step. Do not change sync scripts (D12). `enabledPlugins` in this repo lives in `settings.global.json` or the next sync disables the plugin.

## 7. Absences

| Cell | Status |
|---|---|
| Project Claude hooks in `settings.json` | **ausente** in this repo (T5) |
| Copying Claude JSON keys into Codex/Grok TOML | **ausente** |
| Changing sync scripts | **ausente** (D12) |
