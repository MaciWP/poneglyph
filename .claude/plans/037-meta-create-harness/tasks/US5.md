---
us: US5
title: T2 command pack
wave: W3
depends_on: [US3]
tdd_mode: skip
estimate: S
status: closed
approved: 2026-09-10
closed: 2026-09-10
---

# US5 — T2 command

## Execution prompt (Phase 3 input)

**Task**: Write the T2 command pack copying T1's 7-point contract. Commands are an artifact type, not a second entrypoint (D7).
**Context**: Claude `.claude/commands/*.md`; Codex `$name` on shared markdown; Grok `commands/*.md` or `user-invocable` skill. Gate already scans commands. T1 golden in `references/t01-skill.md`.
**Constraints**: Do not add `/meta-harness` command. Thin pack. Lookup recipe only (D22).
**Deliverable**: `references/t02-command.md` + command template if needed.
**Verify**: three host columns; template instance passes `check:config` if it is a `commands/*.md`.
**Ask first**: nothing.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W3 |
| **Depends on** | US3 |
| **Blocks** | none |
| **Files touched** | `meta-harness/references/t02-command.md`, optional `templates/command/` |
| **TDD-mode** | skip: documentation pack |
| **Estimate** | S |
| **Cómo arrancar** | Copy t01 structure; swap paths and invocation (`/` vs `$`) |
| **Decisión absorbida** | D7 D23 D26 |

## User story

- **As a**: Lead adding a slash/dollar command
- **I want**: host-correct declaration
- **So that**: I do not clone a Claude command into Codex

## Acceptance criteria

- **AC1**: Given T2 pack, when opened, then 7-point contract + Claude/Codex/Grok columns.
- **AC2**: Given Codex, when documenting invocation, then `$name` on the shared markdown — not a cloned Claude-only file.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/skills/meta-harness/references/t02-command.md` | Pack |

tdd-skip: documentation pack, no testable behavior
