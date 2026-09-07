# StatusLine Setup (ccstatusline)

How the Claude Code status line — showing **usage cost + quota reset** — is
installed and configured on Windows.

> Context: the project shipped a `statusLine` config pointing at
> `C:/Users/Maci/.bun/bin/ccstatusline.exe` — a different user that does **not
> exist** on this machine — and no `bun`/`node` runtime was installed. This doc
> records the repair: install `bun` + `ccstatusline` portable for the current
> user, configure widgets, and fix `settings.json`.

The tool is **`ccstatusline`** (not `ccusage`). It renders model, git branch,
session cost, 5h-block reset timer, and session/weekly usage. Reference:
`.claude/skills/meta-settings-cookbook/references/07-statusline.md`.

---

## 1. Installed configuration

| Item | Value |
|------|-------|
| Runtime | Bun 1.3.6 portable |
| Bun binary | `%USERPROFILE%\.bun\bin\bun.exe` |
| Statusline tool | ccstatusline 2.2.10 (`bun install -g`) |
| Statusline shim | `%USERPROFILE%\.bun\bin\ccstatusline.exe` |
| Widget config | `%USERPROFILE%\.config\ccstatusline\settings.json` |
| PATH | `…\.bun\bin` added to the **user** PATH (persistent) |
| Settings source | `.claude/settings.global.json` → `statusLine` (sync-claude regenerates `~/.claude/settings.json` from it) |

### `statusLine` block (`.claude/settings.global.json`)

```json
"statusLine": {
  "type": "command",
  "command": "C:/Users/Oriol/.bun/bin/ccstatusline.exe",
  "padding": 0,
  "refreshInterval": 10
}
```

> Portable alternative to the absolute path: `"command": "ccstatusline"` — relies
> on `env.PATH` containing `${HOME}/.bun/bin`. The absolute path is used here
> because it is machine-verified and independent of PATH resolution timing.

### Widget layout (1 line — "cost + reset")

```
⚡ Opus 4.8 │  main │ $4.21 │ 5h ⏳ 2h14m │ sesión 38% │ semana 12%
```

`model · git-branch · session-cost · reset-timer · session-usage · weekly-usage`
— all widget types verified against `07-statusline.md` for v2.2.10.

---

## 2. Installation steps (reproduce from scratch)

PowerShell, **no admin required**.

### Step 1 — Install Bun portable

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
$rel   = Invoke-RestMethod "https://api.github.com/repos/oven-sh/bun/releases/latest" -Headers @{ "User-Agent" = "ps" }
$asset = $rel.assets | Where-Object { $_.name -eq 'bun-windows-x64.zip' } | Select-Object -First 1
$zip   = "$env:TEMP\bun-windows-x64.zip"
Invoke-WebRequest $asset.browser_download_url -OutFile $zip -UseBasicParsing
$tmp = "$env:TEMP\bun-extract"; Expand-Archive $zip -DestinationPath $tmp -Force
$bunExe = Get-ChildItem $tmp -Recurse -Filter bun.exe | Select-Object -First 1
$binDir = "$env:USERPROFILE\.bun\bin"; New-Item -ItemType Directory -Force $binDir | Out-Null
Copy-Item $bunExe.FullName "$binDir\bun.exe" -Force
```

> Do **not** use `irm bun.sh/install.ps1 | iex` — remote script execution is the
> same risk class the repo blocks via `permissions.deny` (`curl * | sh`).

### Step 2 — Add Bun to user PATH (persistent)

```powershell
$binDir = "$env:USERPROFILE\.bun\bin"
$userPath = [Environment]::GetEnvironmentVariable("Path","User")
if ($userPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$binDir", "User")
}
$env:Path = "$env:Path;$binDir"   # current session
```

### Step 3 — Install ccstatusline globally

```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" install -g ccstatusline@latest
```

### Step 4 — Configure widgets

Write `%USERPROFILE%\.config\ccstatusline\settings.json` (schema `version: 3`,
see `07-statusline.md` for the full verified widget catalog). The 1-line
cost+reset layout used here:

```json
{
  "version": 3,
  "lines": [[
    { "id": "1",  "type": "model",         "color": "cyan",        "rawMode": true },
    { "id": "2",  "type": "separator" },
    { "id": "3",  "type": "git-branch",    "color": "magenta" },
    { "id": "4",  "type": "separator" },
    { "id": "5",  "type": "session-cost",  "color": "brightYellow","rawMode": true },
    { "id": "6",  "type": "separator" },
    { "id": "7",  "type": "reset-timer",   "color": "brightYellow" },
    { "id": "8",  "type": "separator" },
    { "id": "9",  "type": "session-usage", "color": "brightGreen" },
    { "id": "10", "type": "separator" },
    { "id": "11", "type": "weekly-usage",  "color": "brightCyan" }
  ]],
  "flexMode": "full-minus-40",
  "colorLevel": 2
}
```

### Step 5 — Point settings at it

Add the `statusLine` block (section 1) to `.claude/settings.global.json`, then
re-run `bun .claude/commands/sync-claude.ts --execute` — it regenerates the
global `~/.claude/settings.json` from that source. The project
`.claude/settings.json` stays hook- and statusline-free (scope separation).

### Step 6 — Verify

```powershell
# Render with a sample Claude Code statusline payload:
$sample = '{"model":{"display_name":"Opus 4.8"},"workspace":{"current_dir":"E:/PYTHON/claude-code-poneglyph"},"cost":{"total_cost_usd":4.21}}'
$sample | & "C:/Users/Oriol/.bun/bin/ccstatusline.exe"
# Expect: Opus 4.8 │ <branch> │ $4.21
```

Then reload Claude Code to see the live status bar.

---

## 3. Notes & gotchas

- **`git-branch` needs `git` on PATH.** Resolved via PortableGit in the user
  PATH (see `docs/git-setup.md`). Without git, the widget shows `Processing…`.
- **Timers need a real session.** `reset-timer`, `session-usage`,
  `weekly-usage` only populate from the Anthropic usage API during a live
  session — blank in synthetic tests (expected).
- **No TTY.** Running `ccstatusline` interactively opens its TUI configurator
  (blocks in headless shells). Claude Code invokes it non-interactively, piping
  the session JSON to stdin.
- **Cross-machine cleanup.** This setup also removed `Maci`-specific paths from
  the project `settings.json`: stale segments in `env.PATH` and the dead
  `mcpServers.cclsp` entry (pointed at an uninstalled node + Maci paths; LSP is
  covered by the `typescript-lsp` plugin + `ENABLE_LSP_TOOL=1`).
- **Uninstall.** Remove `%USERPROFILE%\.bun`, `%USERPROFILE%\.config\ccstatusline`,
  strip `…\.bun\bin` from the user PATH, and delete the `statusLine` blocks.
