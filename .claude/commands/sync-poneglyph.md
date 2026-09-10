---
description: "Syncs Poneglyph into every installed harness (Claude Code, Codex, Grok Build): detects them, asks once, runs the per-host engines in order."
argument-hint: "[--status|--execute] [--backup] [--force] [--hosts claude,codex,grok|all] [--no-validate]"
---

# Sync Poneglyph

One command installs (or refreshes) the global Poneglyph layer in every harness present on
this machine, so every project on it gets the same skills, commands, rules, hooks and style.

```bash
bun .claude/commands/sync-poneglyph.ts                          # preview
bun .claude/commands/sync-poneglyph.ts --status                 # current state per host
bun .claude/commands/sync-poneglyph.ts --execute --backup       # sync, one confirmation
bun .claude/commands/sync-poneglyph.ts --execute --backup --force   # no prompt (CI / agents)
```

## Detection

A host counts as **installed** when its CLI resolves on PATH **or** its config home exists.

| Host | CLI | Config home(s) | Engine |
|------|-----|----------------|--------|
| Claude Code | `claude` | `~/.claude` | `.claude/scripts/sync-claude.ts` |
| Codex | `codex` | `$CODEX_HOME` and `~/.codex` — one run per existing profile | `.claude/scripts/sync-codex.ts` |
| Grok Build | `grok` | `~/.grok` | `.claude/scripts/sync-grok.ts` |

The command prints the detected set as a table (host · CLI · targets · action) before doing
anything. `--hosts` overrides detection (`--hosts claude,codex` or `--hosts all`). Nothing
detected → it says so and exits without changes.

## Order and dependencies

Engines run sequentially, fail-fast, always in this order:

1. **Claude** — links `~/.claude/*`, generates `~/.claude/settings.json` (base + machine
   overlay, validated by `claude doctor`) and regenerates the style twin
   `.claude/system-prompts/poneglyph-sp.md`.
2. **Codex** — generates `AGENTS.md` (doctrine + twin), links the core skills, generates
   `$name` command entrypoints and the native hooks. Once per profile.
3. **Grok** — links the style twin and installs its native hook. Grok reuses `~/.claude`, so
   selecting Grok always syncs Claude first (the command tells you).

A failing engine stops the run; the summary shows 🟢 ran / 🔴 failed (exit code) / ⚪ not run.

## Options

| Option | Description |
|--------|-------------|
| *(none)* | Preview: each engine shows what it would change |
| `--status` | Current state of every detected host |
| `--execute` | Apply changes; asks once for the whole set |
| `--backup` | Save existing content before replacing — Codex and Grok **require** it when a target already exists |
| `--force` | Skip the confirmation; **required** without an interactive terminal (exit 2 otherwise) |
| `--hosts LIST` | Override detection: `claude,codex,grok` in any combination, or `all` |
| `--no-validate` | Skip the `claude doctor` acceptance check of the generated settings.json (Claude only) |

The orchestrator asks once and then passes `--force` to every engine.

## Engine-only flags

Per-host operations that do not make sense for the whole set stay on the engines:

| Engine | Flags | Purpose |
|--------|-------|---------|
| `bun .claude/scripts/sync-claude.ts` | `--check` · `--unlink` · `--validate-hooks` · `--method auto\|symlink\|junction\|copy` | System/permission check, remove links, verify hook paths, force a link method |
| `bun .claude/scripts/sync-codex.ts` | `--unlink --backup` | Remove Poneglyph entries from one profile (`CODEX_HOME` selects it) |
| `bun .claude/scripts/sync-grok.ts` | `--home-dir PATH` | Install into a disposable Grok home |

Each engine prints its help with `--help`.

## What the Claude engine syncs

| Item | Contents |
|------|----------|
| `skills/` `commands/` `hooks/` `workflows/` `output-styles/` `scripts/` | Whole-folder links (junctions on Windows, symlinks elsewhere) |
| `rules/` `docs/` | Per-entry links; project-only entries (`test-policy.md`, `docs/local-model/`) stay out of the global layer |
| `plans/templates/` | `/flow` document templates — global fallback outside poneglyph |
| `CLAUDE.md` `loop.md` | Global instructions and the default `/loop` prompt |
| `settings.json` | **Generated** real file: `.claude/settings.global.json` deep-merged with the ignored `.claude/settings.machine.json` |
| `~/.config/ccstatusline/` | ccstatusline widget config (external link) |

Not synced: `agent_docs/`, `experts/`, `plans/` (except `templates/`), `metrics/`, `evals/`.

## Multi-OS

| OS | Default link method | Required permissions |
|----|---------------------|----------------------|
| Windows | Junction (folders) · copy (files) | None |
| Windows (Developer Mode) | Symlink | Developer Mode ON |
| macOS / Linux | Symlink | User permissions |

`bun .claude/scripts/sync-claude.ts --check` reports OS, Developer Mode and whether links can
be created, with recommendations. Codex profiles on Windows install skills as junctions and
`AGENTS.md` as a generated file; Grok's twin is a checked copy.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `No interactive terminal and --force not set` (exit 2) | Re-run with `--force` |
| Codex/Grok: `requires --backup` | A target already exists; add `--backup` |
| `A different Poneglyph native hook is installed` | The hooks point at another checkout. Sync only from the canonical checkout, or remove the stale handlers first (see `docs/harness-adapters.md`) |
| Windows: symlinks unavailable | Junctions are automatic; enable Developer Mode or use `--method copy` on the Claude engine |
| Conflicting links | `--status` shows where they point; `--execute --backup` replaces them with a backup |

Registration is not activation: Codex hooks need trust in its `/hooks`, and Grok ignores
passive hook output. After a sync, `bun run doctor` reports the state of every installed host.

---

**Version**: 3.0.0 (2026-09-10 — replaces `/sync-claude`; one command for the three harnesses, Codex once per profile)
