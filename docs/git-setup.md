# Git Setup

How git is installed and configured for this project on Windows.

> Context: this machine had **no git** installed and **no package manager**
> (`winget` / `choco` / `scoop` not functional). Git was installed as a
> **portable MinGit** build — no admin rights, no UAC, fully self-contained.

---

## 1. Installed configuration

### Binary location

| Item | Value |
|------|-------|
| Distribution | MinGit 2.51.2 (git-for-windows, headless zip) |
| Install dir | `%LOCALAPPDATA%\Programs\PortableGit` |
| Executable | `%LOCALAPPDATA%\Programs\PortableGit\cmd\git.exe` |
| PATH | `…\PortableGit\cmd` added to the **user** PATH (persistent) |

> In a shell session opened *before* the PATH change, call git by absolute
> path or re-export `$env:Path`. New sessions resolve `git` directly.

### Global config applied

```ini
[user]
    name = Oriol Macias
    email = developer@example.com
[core]
    autocrlf = true            # normalize CRLF/LF on Windows
[init]
    defaultBranch = main
[pull]
    rebase = false             # merge on pull (explicit default)
```

Verify any time:

```powershell
git config --global --list
```

---

## 2. Installation steps (reproduce from scratch)

Run in **PowerShell**. No admin required.

### Step 1 — Resolve the latest MinGit 64-bit asset

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$rel = Invoke-RestMethod `
  -Uri "https://api.github.com/repos/git-for-windows/git/releases/latest" `
  -Headers @{ "User-Agent" = "ps" }
$asset = $rel.assets |
  Where-Object { $_.name -match 'MinGit-.*-64-bit\.zip' -and $_.name -notmatch 'busybox' } |
  Select-Object -First 1
$asset.browser_download_url
```

### Step 2 — Download + extract

```powershell
$ProgressPreference = 'SilentlyContinue'
$zip  = "$env:TEMP\MinGit.zip"
$dest = "$env:LOCALAPPDATA\Programs\PortableGit"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath $dest -Force
Test-Path "$dest\cmd\git.exe"   # -> True
```

### Step 3 — Add to user PATH (persistent)

```powershell
$gitCmd   = "$env:LOCALAPPDATA\Programs\PortableGit\cmd"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$gitCmd*") {
    $newPath = if ([string]::IsNullOrEmpty($userPath)) { $gitCmd } else { "$userPath;$gitCmd" }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
}
$env:Path = "$env:Path;$gitCmd"   # current session
```

### Step 4 — Configure identity + defaults

```powershell
git config --global user.name  "Oriol Macias"
git config --global user.email "developer@example.com"
git config --global core.autocrlf      true
git config --global init.defaultBranch main
git config --global pull.rebase        false
```

### Step 5 — Verify

```powershell
git --version
git config --global --list
```

---

## 3. Notes

- **Full installer alternative.** The official `Git-*-64-bit.exe` (system-wide,
  PATH auto) works too: `Git-*.exe /VERYSILENT /NORESTART`. It may trigger UAC
  / require admin. The portable route above avoids that and was chosen here.
- **SFX archive gotcha.** The `PortableGit-*.7z.exe` self-extractor needs
  `Start-Process -FilePath <exe> -ArgumentList "-o""<dir>""","-y" -Wait`.
  The plain MinGit **zip** + `Expand-Archive` is simpler for headless sessions.
- **Repo state at setup.** `E:\PYTHON\claude-code-poneglyph` was on branch
  `main` with **0 commits**; `git rev-parse HEAD` returns exit 128 until the
  first commit exists.
- **Uninstall.** Remove `%LOCALAPPDATA%\Programs\PortableGit` and strip
  `…\PortableGit\cmd` from the user PATH.
