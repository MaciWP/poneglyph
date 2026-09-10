# Poneglyph Repository Addendum

The user-level Poneglyph doctrine is loaded by Codex from `$CODEX_HOME/AGENTS.md`.
This file intentionally contains only repository-specific instructions so the same
doctrine is not injected twice when developing Poneglyph itself.

- Global Claude configuration belongs in `.claude/settings.global.json`; the
  project `.claude/settings.json` must stay hook-free.
- Run `bun run doctor` (suite, `claude plugin validate .claude`, sync status, budget ratchet, privacy grep) after behavioral
  configuration changes.
- Use `bun .claude/commands/sync-poneglyph.ts --status` to inspect every installed
  harness; per host, `bun .claude/scripts/sync-claude.ts --status` (Claude) and
  `bun .claude/scripts/sync-codex.ts --status` (Codex).
- Codex links the shared core skill catalog and generates entrypoints for shared
  commands. Native hook adapters reuse shared logic; host permissions stay native.
- Inspect Grok with `bun .claude/scripts/sync-grok.ts --status`. Registration is
  not execution evidence: Codex hooks need native trust, and Grok ignores passive
  hook stdout. Follow `.claude/rules/harness-runtime.md` for shared resource paths.
