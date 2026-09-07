---
parent: meta-create
name: gotchas-and-cli
description: Plugin gotchas, CLI reference, and pre-publish validation checklist.
---

# Plugin Gotchas, CLI & Validation Checklist

## Gotchas

| Gotcha | Why | Workaround |
|--------|-----|------------|
| `.claude-plugin/` contains ONLY `plugin.json` | Components at root are auto-discovered; nesting them inside `.claude-plugin/` hides them | Always place skills/, agents/, hooks/ at plugin ROOT |
| `hooks/hooks.json` not `settings.json` | Plugin hooks have their own config file, separate from global settings | Create `hooks/hooks.json` with the standard hooks format |
| Standard `hooks/hooks.json` listed in `manifest.hooks` | It is auto-loaded; the manifest entry makes it a duplicate and the plugin fails to load ("Duplicate hooks file detected", 2.1.259) | Omit `hooks` from `plugin.json` unless you add EXTRA hook files; verify with `claude plugin list` (Status: loaded) |
| Path traversal forbidden | Security: `../` in component paths could escape plugin sandbox | All paths must start with `./` and stay within plugin dir |
| `CLAUDE_PLUGIN_ROOT` changes on update | Plugin installation dir is not stable across versions | Use `CLAUDE_PLUGIN_DATA` for persistent state, `CLAUDE_PLUGIN_ROOT` only for bundled assets |
| Agent security restrictions | Plugin agents cannot have `hooks`, `mcpServers`, or `permissionMode` | Define hooks at plugin level, not agent level; use plugin-scoped MCP |
| Version conflict between plugin.json and marketplace.json | If version appears in both, `plugin.json` always wins silently | Set version in ONE place only |
| `strict` mode (default `true`) | `plugin.json` is authority for components; marketplace entry supplements | Set `"strict": false` only if marketplace entry is sole authority |
| Event names are case-sensitive | `PostToolUse` not `postToolUse` | Match exact casing from hook events reference |
| All paths must be relative | Absolute paths fail validation | Always start paths with `./` |
| Plugin cache at `~/.claude/plugins/cache` | Updated code without version bump = existing users see stale version | Always bump version in `plugin.json` when publishing changes |
| Symlinks preserved in cache | Useful for external dependencies | Create symlinks within plugin dir; they survive caching |

## CLI Reference

| Action | Command |
|--------|---------|
| Install from marketplace | `claude plugin install <name>@<marketplace>` |
| Install local | `claude plugin install ./<path> --scope local` |
| Install with scope | `claude plugin install <name> --scope project` |
| Uninstall | `claude plugin uninstall <name>` |
| Enable | `claude plugin enable <name>` |
| Disable | `claude plugin disable <name>` |
| Update | `claude plugin update <name>` |
| Validate | `claude plugin validate` |
| Debug loading | `claude --debug` (shows plugin loading details) |
| Add marketplace | `claude plugin marketplace add <source>` |
| List marketplaces | `claude plugin marketplace list` |
| Remove marketplace | `claude plugin marketplace remove <name>` |
| Reload after changes | `/reload-plugins` |

## Validation Checklist

| Check | Requirement |
|-------|-------------|
| Name format | kebab-case, no spaces, no underscores |
| Name unique | No existing plugin with same name in target scope |
| Paths relative | All paths start with `./` |
| No path traversal | No `../` in any path |
| Components at root | Not inside `.claude-plugin/` |
| Scripts executable | `chmod +x` on hook scripts |
| Version bumped | If updating, version must change |
| Manifest valid JSON | `plugin.json` parses without errors |
| Hook events cased correctly | `PostToolUse` not `postToolUse` |
| Agent restrictions respected | No `hooks`, `mcpServers`, or `permissionMode` in plugin agents |
| userConfig keys documented | Each key has a `description` field |
| Sensitive values marked | API tokens and secrets have `"sensitive": true` |
