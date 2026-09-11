---
us: US8
title: T5 hook pack
wave: W3
depends_on: [US3]
tdd_mode: skip
estimate: M
status: closed
approved: 2026-09-10
closed: 2026-09-10
---

# US8 — T5 hook

## Execution prompt (Phase 3 input)

**Task**: Write the T5 hook pack with effective-state (AC25) and delete≠disable (AC23). Claude hooks via global `sync-claude` (project `settings.json` hook-free). Codex `hooks.json` / `[hooks]` (Windows support historically disabled — verify in lookup). Grok `~/.grok/hooks/*.json`.
**Context**: Old `meta-create/references/hook/*`. Grok `10-hooks.md`. Codex https://developers.openai.com/codex/hooks . Project `.claude/settings.json` may only have `$schema` and `respectGitignore`.
**Constraints**: Do not change sync scripts (D12). Packs **name** the install step. H8: a hook is enforcement; CLAUDE.md is a request.
**Deliverable**: `references/t05-hook.md` + templates that do not write project settings hooks.
**Verify**: columns include disable + effective-from (reload/restart); delete follow-up names overlay/session.
**Ask first**: if Codex hooks are still disabled on this Windows CLI, mark the cell «present, not effective on Windows» — do not invent a workaround.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W3 |
| **Depends on** | US3 |
| **Blocks** | none |
| **Files touched** | `t05-hook.md`, hook templates |
| **TDD-mode** | skip: documentation pack |
| **Estimate** | M |
| **Cómo arrancar** | Read handlers-and-settings.md + Grok 10-hooks + Codex hooks page |
| **Decisión absorbida** | AC23 AC25 D12 |

## User story

- **As a**: Lead adding or removing a hook
- **I want**: source vs install vs overlay vs session named
- **So that**: deleting a repo file is not reported as “the host stopped running it”

## Acceptance criteria

- **AC1**: Given T5 pack, when mutating, then impact + effective chain are required steps (AC24–25).
- **AC2**: Given project Claude settings, when creating a hook, then it does not add hooks to project `settings.json`.

tdd-skip: documentation pack, no testable behavior
