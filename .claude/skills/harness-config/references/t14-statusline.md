---
parent: harness-config
name: t14-statusline
description: T14 statusline pack — Claude statusLine, Codex tui.status_line, Grok [ui.status_line]. All three hosts have a real key.
---

# T14 — Statusline

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md) · [t10-settings.md](t10-settings.md).
Absorbs cookbook `07-statusline.md` (D27). Machine install for ccstatusline: `docs/statusline-setup.md`.

## 1. What / when

The TUI footer row. Unlike T13, **no host cell is ausente**.

## 2. Lookup

Claude `statusLine` in settings-reference. Codex `tui.status_line` (`config-reference`, `/statusline`). Grok `25-status-line.md`.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Key | `statusLine` in settings (`type`, `command`, `padding`, `refreshInterval`) | `tui.status_line` = `array<string>` of item ids (default `["spinner", "project"]`). `/statusline` picker persists it | `[ui.status_line]` in `~/.grok/config.toml`. `type = "builtin" \| "command" \| "disabled"` (default disabled) |
| Command | Absolute path to the script (bare `ccstatusline` often fails PATH). Windows: `.exe` in `settings.local.json` | Built-in items (model, context, git, tokens, …) — not a Claude command script | `type = "command"` + `command = "~/…"`. **Project `.grok/config.toml` cannot set this** (user/managed only) |
| Disable | Omit / empty command | `tui.status_line = []` (empty item list) | `type = "disabled"` (`off`/`none`/`hidden` spell the same) |
| Reload | New session | Immediate after `/statusline` | Restart (`[ui.status_line]` read at startup) |

**Codex gotcha.** The config reference prints the type as `array<string> | null` and says the empty
value disables the line. That `null` is type notation: TOML has no null literal, and a config file
carrying it fails to load (`codex doctor` → "config could not be loaded"). Write the empty list
instead. Omitting the key does **not** disable anything — it restores the default two items.

This repo's Claude command is `ccstatusline` via `settings.global.json`. Pin **`ccstatusline@2.2.19`** (not `@latest`; supply-chain #298). Widget names (`reset-timer`, `git-review`) differ from the README aliases. Widget config is git-tracked at `.claude/ccstatusline/settings.json` and linked by `bun .claude/commands/sync-poneglyph.ts --execute --backup`. Windows: override `statusLine.command` to the `.exe` path in gitignored `settings.local.json`.

## 4. Min template

Claude (this repo — command path is machine-local):

```json
"statusLine": {
  "type": "command",
  "command": "$HOME/.bun/bin/ccstatusline",
  "padding": 0,
  "refreshInterval": 10
}
```

Codex: `tui.status_line = ["model", "context"]` or `/statusline`. Grok:

```toml
[ui.status_line]
type = "builtin"
items = ["cwd", "model", "context"]
```

## 5. Evidence

T1 + B: Grok 25-status-line.md; Codex config-reference `tui.status_line` 2026-09-10. Cookbook 07: bare command + POSIX `$HOME` fail on Windows. **sin evidencia A/B** for widget layout performance.

T1 (probe, 2026-09-11): Codex CLI 0.153.4 on Windows, isolated `CODEX_HOME`. The null form makes
`codex doctor` report "✗ config — config could not be loaded"; the empty list loads with no config
error. The rendered footer was not inspected, so "empty list hides the line" stays **probable**.

## 6. Poneglyph grain

Keep the ccstatusline recipe in `docs/statusline-setup.md`. This pack owns the three host keys. Do not rewrite sync.

## 7. Absences

| Cell | Status |
|---|---|
| Any host without a statusline key | **ausente** — all three have one |
| Grok project-repo command statusline | **ausente** — user/managed only |
| Copying Claude `statusLine` JSON into Codex | **ausente** — Codex uses item ids |
