---
parent: meta-harness
name: t07-plugin
description: T7 plugin pack — install/enable/disable. Marketplace publish is out of scope.
---

# T7 — Plugin

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md).

## 1. What / when

Share a bundle (skills, agents, hooks, MCP) across repos. A single skill in-tree is T1.

## 2. Lookup

Claude plugins-reference. Codex https://learn.chatgpt.com/docs/plugins.md (2026-09-10). Grok `09-plugins.md`.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Manifest | `.claude-plugin/plugin.json` | Root `plugin.json` (`.codex-plugin/plugin.json` is fallback). Local marketplace: `.agents/plugins/marketplace.json` | marketplace + plugin bundle (skills, commands, agents, hooks, MCP) |
| Enable | `enabledPlugins` in settings | `/plugins` then Space on/off; new session for bundled skills | install **then** enable; hooks/MCP wait for trust |
| Disable (not uninstall) | `enabledPlugins["name@market"] = false` | Space in `/plugins` **and** `[plugins."<name>@<market>"] enabled = false`. Uninstall is separate | `[plugins] disabled = ["…"]` or `grok plugin disable` / Space. Not uninstall and not removing the marketplace source |
| Uninstall | `/plugin uninstall` | UI, `/plugins`, or `codex plugin` remove | `grok plugin` remove; marketplace remove is another step |
| Publish | out of scope | out of scope | out of scope |

Disable ≠ uninstall ≠ delete source.

## 4. Min template

Template N/A for a full plugin (too host-specific). Do not publish a marketplace listing from this skill.

## 5. Evidence

B/T1: vendor plugin pages 2026-09-10. **sin evidencia A/B** for marketplace conversion rates.

## 6. Poneglyph grain

This repo's plugins stay reviewed. Private addon boundary stays in `config-quality.md`.

## 7. Absences

| Cell | Status |
|---|---|
| Marketplace publish | **ausente** |
| Codex IDE plugins | **ausente** (docs: IDE extension doesn't support plugins) |
