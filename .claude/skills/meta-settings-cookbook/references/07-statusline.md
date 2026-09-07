# StatusLine — ccstatusline (v2.2.19)

## Contents

- [Installation and configuration](#installation-and-configuration)
- [Version-controlled config + sync-claude](#version-controlled-config-sync-claude)
- [⚠️ Correct registry names (the README calls them differently)](#correct-registry-names-the-readme-calls-them-differently)
- [Widgets by category](#widgets-by-category)
- [Recommended layout (4 lines, left/right alignment)](#recommended-layout-4-lines-leftright-alignment)
- [Gotchas / cross-OS](#gotchas-cross-os)
- [Windows (PowerShell) — env.PATH caveat](#windows-powershell-envpath-caveat)
- [Critical notes](#critical-notes)

## Installation and configuration

```bash
bun install -g ccstatusline@2.2.19
```

> **Pin the version** (`@2.2.19`, not `@latest`) — see supply-chain issue #298.

**settings.json** (`~/.claude/settings.json`):
```json
"statusLine": {
  "type": "command",
  "command": "$HOME/.bun/bin/ccstatusline",
  "padding": 0,
  "refreshInterval": 10
}
```

Must be the **absolute path** `$HOME/.bun/bin/ccstatusline`. Bare `ccstatusline` does not resolve in Claude Code's statusLine spawn context — the interactive PATH lacks `~/.bun/bin` and the committed `env.PATH` does not rescue it in that spawn context. Empirically verified: bare form caused the statusline to disappear; reverting to the absolute path restored it.

> **Windows caveat**: `$HOME/.bun/bin/ccstatusline` expands to a POSIX path that does not exist on Windows. Use a per-machine `~/.claude/settings.local.json` (gitignored) to override `statusLine.command` with the Windows absolute path:
> ```json
> { "statusLine": { "type": "command", "command": "C:\\Users\\Maci\\.bun\\bin\\ccstatusline.exe", "padding": 0, "refreshInterval": 10 } }
> ```
> See "Windows (PowerShell) — env.PATH caveat" below for the same pattern applied to PATH.

Widget config: `~/.config/ccstatusline/settings.json` (default path on ALL OSes — see Gotchas).

---

## Version-controlled config + sync-claude

The widget config is now tracked at `.claude/ccstatusline/settings.json` and linked to the default path via `sync-claude`:

```
.claude/ccstatusline/settings.json  ←(git-tracked)
         ↕  (symlink on macOS / junction on Windows)
~/.config/ccstatusline/settings.json  ←(what ccstatusline reads)
```

TUI edits (`ccstatusline --tui`) write through the symlink/junction directly to the git-tracked file. Changes are immediately draftable for commit.

To set up on a new machine:

```bash
bun .claude/commands/sync-claude.ts --execute --backup
```

`--backup` is required when `~/.config/ccstatusline` already exists as a real directory (status `exists`). Without it, the sync removes the directory with `rmSync` before linking — only local scratch files not present in the committed copy would be lost, but `--backup` preserves them safely.

---

## ⚠️ Correct registry names (the README calls them differently)

| Correct name | Incorrect alias in docs | What it does |
|---|---|---|
| `reset-timer` | ~~block-reset-timer~~ | Time remaining in the 5h block |
| `git-review` | ~~git-pr~~ | Current PR status with clickable link |

---

## Widgets by category

**Model and session**
- `model` — name of the active model
- `thinking-effort` — effort level (low/medium/high/default)
- `session-cost` — accumulated cost in USD

**Git**
- `git-branch` — current branch
- `git-review` — PR status (requires authenticated `gh` CLI)
- `git-changes` — `(+N,-M)` changes in staging
- `git-insertions` / `git-deletions` — separately (read real staging, not `cost.total_lines_*`)

**Context**
- `context-percentage` — % of the context window used
- `context-bar` — visual bar `▓▓▓░░░░░░░` (requires `context_window_size` in the input JSON)
- `context-length` — used tokens as a number

**Paths**
- `current-working-dir` — current directory
  - `metadata.segments: "1"` — only the last segment (must be a **string**, not a number)
  - `metadata.abbreviateHome: "true"` — abbreviate with `~`
  - `rawMode: true` — remove "cwd: " prefix

**Timers and quotas** (require Anthropic usage API — do not work in test without a real session)
- `session-usage` — % of the session limit used
- `weekly-usage` — % of the weekly limit used
- `reset-timer` — time remaining until the 5h block resets
- `weekly-reset-timer` — time remaining until weekly reset

**New in 2.2.19**
- Monthly/overage usage widgets
- `CCSTATUSLINE_WIDTH` env var for explicit width override
- Git command caching (`~/.cache/ccstatusline/git-cache`, TTL default 5s) — reduces subprocess overhead on every refresh
- `windowsHide: true` for child processes (suppresses cmd windows on Windows)
- `GIT_OPTIONAL_LOCKS=0` env var on git subprocesses (avoids index.lock churn on refresh)

---

## Recommended layout (4 lines, left/right alignment)

```json
{
  "version": 3,
  "lines": [
    [
      {"id":"1", "type":"current-working-dir", "color":"brightBlue", "rawMode":true,
       "metadata":{"segments":"1","abbreviateHome":"true"}},
      {"id":"2", "type":"flex-separator"},
      {"id":"3", "type":"model", "color":"cyan", "rawMode":true},
      {"id":"4", "type":"separator"},
      {"id":"5", "type":"thinking-effort", "color":"brightMagenta", "rawMode":true}
    ],
    [
      {"id":"6",  "type":"git-review",    "color":"brightCyan"},
      {"id":"7",  "type":"separator"},
      {"id":"8",  "type":"git-changes",   "color":"brightWhite"},
      {"id":"9",  "type":"separator"},
      {"id":"10", "type":"session-cost",  "color":"brightYellow", "rawMode":true},
      {"id":"11", "type":"flex-separator"},
      {"id":"12", "type":"git-branch",    "color":"magenta"}
    ],
    [
      {"id":"13", "type":"weekly-reset-timer", "color":"brightBlack"},
      {"id":"14", "type":"flex-separator"},
      {"id":"15", "type":"context-percentage", "color":"brightRed"},
      {"id":"16", "type":"separator"},
      {"id":"17", "type":"context-bar", "color":"brightRed",
       "metadata":{"display":"slider-only"}}
    ],
    [
      {"id":"18", "type":"weekly-usage",  "color":"brightCyan"},
      {"id":"19", "type":"flex-separator"},
      {"id":"20", "type":"session-usage", "color":"brightGreen"},
      {"id":"21", "type":"separator"},
      {"id":"22", "type":"reset-timer",   "color":"brightYellow"}
    ]
  ],
  "flexMode": "full-minus-40",
  "colorLevel": 2
}
```

---

## Gotchas / cross-OS

**(a) `--config` does NOT expand `~`.**
`--config ~/foo.json` calls `path.resolve` only — it creates a literal `~` directory. Always use absolute paths with `--config`, or avoid it entirely. We use the **default path** (`~/.config/ccstatusline/settings.json`) exclusively.

**(b) Config path is `os.homedir()/.config/ccstatusline` on ALL OSes.**
Not `%APPDATA%` on Windows. Resolves to `%USERPROFILE%\.config\ccstatusline` on Windows (e.g. `C:\Users\Maci\.config\ccstatusline`). The `sync-claude` external link uses `path.join(os.homedir(), ".config", "ccstatusline")` — correct per-OS automatically.

**(c) Schema v3 is stable across 2.2.10 → 2.2.19.**
No migration needed. Existing `settings.json` files work unchanged.

**(d) Notable 2.2.19 changes** (see New in 2.2.19 widget section above).

---

## Windows (PowerShell) — env.PATH caveat

A single committed `env.PATH` in `.claude/settings.json` **cannot** be valid on both macOS `sh` (`:` -delimited, POSIX paths) and Windows PowerShell (`;`-delimited, `C:\...` paths). The committed `env.PATH` is POSIX-shaped — it works on macOS `sh` and Git Bash, but is the wrong format for Windows PowerShell.

The committed `statusLine.command` (`$HOME/.bun/bin/ccstatusline`) expands to a POSIX path that does not exist on Windows. And a single committed `env.PATH` cannot be valid on both macOS `sh` (`:` -delimited, POSIX paths) and Windows PowerShell (`;`-delimited, `C:\...` paths) — the committed `env.PATH` is POSIX-shaped.

**Recommended remedy (per-machine, NOT committed):** create `~/.claude/settings.local.json` on the Windows machine:

```json
{
  "env": { "PATH": "C:\\Users\\Maci\\.bun\\bin;${PATH}" },
  "statusLine": { "type": "command", "command": "C:\\Users\\Maci\\.bun\\bin\\ccstatusline.exe", "padding": 0, "refreshInterval": 10 }
}
```

Verify bun resolves on PowerShell first:

```powershell
bun --version
Get-Command ccstatusline
```

`settings.local.json` is per-machine and gitignored (see `.gitignore`). We deliberately did NOT rewrite the committed values because they work on macOS and a single string cannot satisfy both shells.

---

## Critical notes

- `flex-separator` pushes subsequent content to the right of the line
- `context-bar` requires `context_window.context_window_size` in Claude Code's input JSON
- `git-changes` shows changes from the git staging area — not the session's `cost.total_lines_added`
- `block-timer` ≠ `reset-timer`: the first shows elapsed time, the second shows remaining time
- Installing globally with bun avoids the "Resolving dependencies" noise on each refresh (every 10s)
- Usage-API widgets (weekly/session-usage, reset-timers) emit empty output without a real Anthropic session — this is expected in test/preview mode
