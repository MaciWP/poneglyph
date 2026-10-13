# Poneglyph Repository Addendum

Repo-specific only: the global doctrine reaches Codex via `$CODEX_HOME/AGENTS.md` and Claude via
root `CLAUDE.md`; Claude reads this file through `.claude/CLAUDE.md`.

- The repo `.claude/` is the source of the global layer, linked from `~/.claude/` (Windows: junctions,
  file copies). Codex `AGENTS.md` = root `CLAUDE.md` + `.claude/system-prompts/poneglyph-sp.md` +
  `.claude/docs/harness-runtime.md`.
- Generated files (`~/.claude/settings.json`, Codex `AGENTS.md`, the style twin, the router agent) and Windows
  copies change only through a sync; never edit them by hand. The project `.claude/settings.json` is hand-edited.
- Global Claude config goes in `.claude/settings.global.json`; the project `.claude/settings.json` stays hook-free.
- After behavioral config changes, run `bun run doctor`.
- Sync status: `bun .claude/commands/sync-poneglyph.ts --status`; per host `bun .claude/scripts/sync-claude.ts --status`,
  `sync-codex.ts --status`, `sync-grok.ts --status`.
- Codex links the shared skill catalog and generates entrypoints for shared commands; hook adapters reuse
  shared logic; host permissions stay native.
- Registration is not execution evidence: Codex hooks need native trust, and Grok ignores passive hook
  stdout. Shared resource paths: `.claude/docs/harness-runtime.md`.
