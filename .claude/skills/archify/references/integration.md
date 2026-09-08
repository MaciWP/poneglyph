# Official engine integration

## Paths and prerequisites

Resolve the loaded skill directory with `fs.realpathSync` (Node/Bun) before walking
three parent directories to the Poneglyph root. This follows installed directory
junctions on Windows and symlinks on other hosts. Do not use the target project's
working directory to locate the engine.

- The version and SHA-256 in the recipe below are the installation pin.
- Official releases: https://github.com/tt-a1i/archify/releases.
- Cache: `<Poneglyph root>/.cache/archify/v<version>/`.
- Engine: `<cache>/archify/`; CLI: `<engine>/bin/archify.mjs`.
- Node >=18 is required. No runtime npm installation is needed. Keep the bundled MIT license.
- A Chromium browser is needed for visual checks, but not for HTML generation.

Reuse an existing engine when its release metadata matches the pin and `doctor`
succeeds. Do not extract over an existing
or partial engine. Inspect an incomplete cache and use a fresh staging directory;
do not delete user data or silently accept an unexpected package. Do not change
the pinned release in response to an update notice.

## First installation

Windows: set `$archifyRoot` to the resolved Poneglyph root. Run this recipe when
the versioned cache does not exist. A verified copy of the same official ZIP can replace the
download. `Expand-Archive` is the native PowerShell extractor.

```powershell
$ErrorActionPreference = 'Stop'
$archifyRoot = '<Poneglyph root>'
$archifyVersion = '2.16.0'
$archifyExpectedSha = '4c59fa6557a2385beaaef8c7219cc414573acc9f0c30a932d5053b0b20689a46'
$archifyCache = "$archifyRoot/.cache/archify/v$archifyVersion"
$archifyArchive = "https://github.com/tt-a1i/archify/releases/download/v$archifyVersion/archify.zip"
if (Test-Path -LiteralPath $archifyCache) { throw 'Inspect the existing cache first' }
New-Item -ItemType Directory -Path $archifyCache | Out-Null
$archifyZip = "$archifyCache/archify.zip"
Invoke-WebRequest -UseBasicParsing -Uri $archifyArchive -OutFile $archifyZip
$archifySha = (Get-FileHash -LiteralPath $archifyZip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($archifySha -ne $archifyExpectedSha) { throw 'Archify SHA-256 mismatch; do not extract' }
Expand-Archive -LiteralPath $archifyZip -DestinationPath $archifyCache
node "$archifyCache/archify/bin/archify.mjs" doctor
if ($LASTEXITCODE -ne 0) { throw 'Archify doctor failed' }
```

macOS/Linux: use `curl --fail --location` to download into a fresh quoted cache path;
verify SHA-256 with `shasum -a 256` or `sha256sum` against the same pin, then use
`unzip '<archive>' -d '<cache>'`. Stop on a failed command or checksum mismatch. Run the
same Node `doctor`. These native steps require those utilities; do not install a
new package manager or claim this platform was tested without running it.

## Browser and invocation

Honor an existing `ARCHIFY_CHROME`. When automatic discovery misses an installed
browser, set this variable in the command environment to its verified executable.
On this Windows installation Edge is at
`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`.
Discover the actual executable on other machines instead of assuming that path.

```powershell
$env:ARCHIFY_CHROME = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node '<engine>/bin/archify.mjs' deliver workflow '<target>/process.workflow.json' '<target>/process.html' --quality showcase --json
node '<engine>/bin/archify.mjs' visual-check '<target>/process.html' --json
```

Run `visual-check` only after successful delivery; a failed delivery leaves the
previous HTML intact. Open its generated contact sheet or individual PNGs for visual
inspection. Do not change global browser settings or force an update-check override.

The existing `sync-claude.ts` and `sync-codex.ts` adapters expose this entrypoint.
Grok reuses Claude skill discovery; it needs no separate Archify installation.
They do not install the cached engine on another machine: run the first-install
recipe there. A newly installed skill may need a fresh host session for discovery.

## Approved updates

Use the installed package's notification-only update checker. When the user requests
an update, verify the official release archive in a new versioned cache, inspect the
new authoring and delivery contracts, and validate one representative guided diagram.
Change the pin only after those checks pass. Preserve the previous cache for recovery.
If a referenced upstream resource moved, resolve its replacement from the new
`SKILL.md`; report a missing capability instead of restoring a stale local manual.

This integration follows upstream through the installed references. It does not run
a background updater or regenerate diagrams when their target repository changes.
