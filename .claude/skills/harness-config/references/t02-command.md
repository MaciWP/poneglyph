---
parent: harness-config
name: t02-command
description: T2 command pack — slash/dollar commands as an artifact type, not a second harness-config entrypoint.
---

# T2 — Command

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md) · [t01-skill.md](t01-skill.md).
Template: [markdown.md](../templates/command/markdown.md).

No `/harness-config` command (D7). Commands are a type. Skills with `user-invocable: true` already appear as `/name` — prefer T1 unless you need a flat file with no supporting directory.

## 1. What / when

Thin invocable prompt, usually one file. Choose T1 when the procedure needs `references/` or auto-activation description.

## 2. Lookup

[lookup.md](lookup.md). Claude: skills page (custom commands merged into skills). Codex: `$name` on shared markdown / `$` menu. Grok: `08-skills.md` (flat `commands/*.md`) + `04-slash-commands.md`.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Path | `.claude/commands/<name>.md` (legacy; prefer `.claude/skills/<name>/SKILL.md`) | Portable: shared markdown skill, invoke `$name`. Deprecated vendor leftover: `~/.codex/prompts/*.md` as `/prompts:<name>` (migrate to a skill) | `<scope>/.grok/commands/*.md` or invocable skill. Also discovers `.claude/commands/` |
| Invoke | `/name` | `$name` (skill). `/prompts:<name>` is the deprecated custom-prompt surface | `/name` (collision → qualified `/local:name`) |
| Gate | `check:config` scans `.claude/commands/*.md` | Same file if it lives under `.claude/commands` | Grok commands are not that scan unless they sit in `.claude/commands` |
| Disable | `skillOverrides` / `user-invocable: false` | `[[skills.config]] enabled=false` if it is a skill | `[skills] disabled` |
| Reload | Live for skills; restart if only commands dir is new | Auto / restart | Disk |

## 4. Min template

`templates/command/markdown.md`. Instantiated `.claude/commands/<kebab>.md` must pass `check:config` (description 1–1024; name optional, defaults to filename stem).

## 5. Evidence

T1/B: Claude Skills page 2026-09-10 (custom commands folded into skills). Compact beats a second entrypoint. **sin evidencia A/B** for “commands outperform skills”.

## 6. Poneglyph grain

This repo: es-ES description. Do not add `/harness-config`. Codex cell is `$name`, never “copy the Claude commands folder”.

## 7. Absences

| Cell | Status |
|---|---|
| Codex `.claude/commands` clone | **ausente** — shared markdown + `$name` |
| Codex `~/.codex/prompts` as the default | **ausente** as the portable recipe — deprecated; migrate to T1 |
| Companion `/harness-config` | **ausente** (D7) |
