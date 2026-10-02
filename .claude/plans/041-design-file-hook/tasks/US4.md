---
us: US4
title: Register the hook for Claude Code, install it, document it
wave: W3
depends_on: [US3]
tdd_mode: optional
estimate: S
status: draft
---

# US4 — Claude registration and docs

## Execution prompt (Phase 3 input)

**Task**: Register `design-file-hint.ts` on PreToolUse matcher `Edit|Write|MultiEdit` in `settings.global.json`, install it with the sync, and document it.
**Context**: `.claude/settings.global.json` PreToolUse array (lines 69-91: `Bash` group and `Bash|PowerShell|Monitor` group). Install: `bun .claude/commands/sync-poneglyph.ts --execute --backup --force` writes `~/.claude/settings.json` (memory `sync-claude-links-folders-not-files`: hooks folder is linked, settings is a real file). Docs: `.claude/rules/paths/hooks.md` PreToolUse row (today "Three handlers on matcher `Bash`"), `.claude/docs/harness-adapters.md` §Hook contracts table and the sentence "The four Claude registrations" (line 71), `.claude/docs/system-inventory.md:149` Hooks row. Measured with `jq` on `settings.global.json` before 041: 4 events, 5 groups, 6 handlers (the inventory says "5 handlers / 4 events" and is already stale). After 041: 4 events, 6 groups, 7 handlers.
**Constraints**: `sensitive:` declaration before editing `settings.global.json`. New group, timeout 5, command `bun "$HOME/.claude/hooks/design-file-hint.ts"`. Docs state the rule, no dates (memory `feedback-doctrine-no-dates-annotations`). `harness-adapters.md:71` drops the number ("The Claude registrations stay…"), so it cannot go stale again; `system-inventory.md` keeps the measured count, because that table is an inventory. Project `.claude/settings.json` stays hook-free (`harness-config` T5/T10). Do not edit `sync-claude`/`sync-codex`/`sync-grok` (D12). The registration takes effect in a new session; the review probes start new sessions. Always-loaded bytes unchanged (spec AC6).
**Deliverable**: Registration, installed settings, three doc updates.
**Verify**: `jq '([.hooks[]|length]|add), ([.hooks[][].hooks[]]|length)' .claude/settings.global.json` prints 6 and 7; `bun test ./.claude/scripts/__tests__/sync-claude.test.ts ./.claude/scripts/__tests__/check-config.test.ts` green; `bun run check:config` 0 errors; `jq '.hooks.PreToolUse' ~/.claude/settings.json` shows the group; `budget.ts` rc=0 with always-loaded Δ 0.
**Ask first**: nothing — install is part of the approved feature; the sync takes a backup.

## User story

- **As a**: Claude Code user
- **I want**: the hook active in every session
- **So that**: the note fires in any repo

## Acceptance criteria

- **AC1**: Given the installed settings, when read, then PreToolUse has an `Edit|Write|MultiEdit` group running `design-file-hint.ts`.
- **AC2**: Given the docs, when read, then `hooks.md` and `harness-adapters.md` describe the hook and its non-blocking, once-per-session behavior.
- **AC3**: Given `budget.ts`, when run, then always-loaded Δ is 0.
- **AC4**: Given `system-inventory.md` and `harness-adapters.md`, when read, then no hook count disagrees with `settings.global.json` measured by `jq`.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/settings.global.json` | New PreToolUse group |
| `.claude/rules/paths/hooks.md` | PreToolUse row |
| `.claude/docs/harness-adapters.md` | Contract row; drop the count at line 71 |
| `.claude/docs/system-inventory.md` | Hooks row: measured counts |

## Verificación post-implementación

- Checks above green.
