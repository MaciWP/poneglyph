---
parent: harness-config
name: t05-hook
description: T5 hook pack — enforcement, not a request. Delete is not disable. Project Claude settings stay hook-free.
---

# T5 — Hook

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md) · [native-creators.md](native-creators.md).
Do not edit `sync-claude` / `sync-codex` / `sync-grok`. Packs **name** the install step.

## 1. What / when

Must-happen on an event (block, log, inject). CLAUDE.md/AGENTS.md is a request. Skill is a procedure with judgement.

## 2. Lookup

Claude hooks docs. Codex https://learn.chatgpt.com/docs/hooks.md (fetched 2026-09-10). Grok `10-hooks.md`.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Source | Vendor: user `~/.claude/settings.json`, project `.claude/settings.json`, local, managed, plugins. **This repo:** project `.claude/settings.json` stays hook-free (`$schema` + `respectGitignore` only); global via `settings.global.json` → sync | `~/.codex/hooks.json` or `[hooks]` in `config.toml`; repo `.codex/` when trusted | `~/.grok/hooks/*.json`; project `.grok/hooks/*.json` (trust); also reads Claude/Cursor hooks if compat on |
| Effective | Loaded settings overlay + session. Deleting a repo file does **not** prove the host stopped | Matching hooks from all layers run. Trust hash; `/hooks` to review. `[features] hooks = false` kills user hooks | Merge all locations. `/hooks` Space toggles one hook immediately |
| Disable | Remove handler from the **settings that are actually loaded**; `disableAllHooks` is a blunt switch | `/hooks` disable one; or `[features] hooks = false` | Space in Hooks tab; or `[compat.claude] hooks = false` to stop scanning Claude files |
| Windows | bun/node handlers in global settings | Present: `command_windows` / `commandWindows` override. Not “disabled on Windows”. | Present |
| Reload | Settings change: new session or documented reload | Restart if config.toml; `/hooks` for trust | Hooks tab `r` reloads from disk in-session; Space toggles enable/disable; restart if you skip the modal |

## 4. Min template

Template N/A as a gate artefact. Do **not** add hooks to **this repo's** project `.claude/settings.json`. Author the handler under `.claude/hooks/` (or `~/.grok/hooks/`) and register it in the **global** Claude settings / Grok json / Codex hooks.json.

## 5. Evidence

E2: hook = guarantee. T1: Grok/Codex pages 2026-09-10. **sin evidencia A/B** for a “max hooks” number.

## 6. Poneglyph grain

Impact before mutate (grep who depends on the event). After delete, name leftover overlay/session. H8: widening authority on delete/scope-change — say so.

## 7. Absences

| Cell | Status |
|---|---|
| Project Claude `settings.json` hooks | **ausente** in this repo |
| Codex hooks “disabled on Windows” | **ausente** as of 2026-09-10 docs — use `command_windows` |
| Changing sync scripts | **ausente** (D12) |
