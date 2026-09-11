---
us: US6
title: T3 agent / subagent pack
wave: W3
depends_on: [US2, US3]
tdd_mode: skip
estimate: M
status: closed
approved: 2026-09-10
closed: 2026-09-10
---

# US6 — T3 agent / subagent

## Execution prompt (Phase 3 input)

**Task**: Write the T3 pack. Templates must pass US2's agent YAML scan (AC20). Cover Claude `.claude/agents/*.md`, Codex `[agents]` / subagents, Grok `.grok/agents/` + personas.
**Context**: This repo may have no `.claude/agents/`. Old templates `meta-create/templates/agent/*.md` are Claude-centric (`model: sonnet`). Grok user-guide `16-subagents.md` (`.grok/agents/*.md`). Codex custom agents: `.codex/agents/*.toml` (`name`, `description`, `developer_instructions`). `[agents]` in config.toml is global caps, not the file type.
**Constraints**: Do not clone Claude `permissionMode` onto Codex/Grok. Personas ≠ agents (Grok). Disable: Grok `GROK_SUBAGENTS=0` / `[subagents] enabled=false` is host-level, not per-file delete.
**Deliverable**: `references/t03-agent.md` + gate-clean agent templates.
**Verify**: instantiated agent fixture passes `check:config`; three columns; absences declared.
**Ask first**: nothing.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W3 |
| **Depends on** | US2, US3 |
| **Blocks** | none |
| **Files touched** | `t03-agent.md`, `templates/agent/*` |
| **TDD-mode** | skip: pack docs; gate covered by US2 |
| **Estimate** | M |
| **Cómo arrancar** | Read US2 contract; rewrite agent templates without Claude-only required keys |
| **Decisión absorbida** | AC20 D13 |

## User story

- **As a**: Lead adding a subagent
- **I want**: portable YAML plus host extras
- **So that**: Grok personas and Codex `[agents]` are not faked as Claude agents

## Acceptance criteria

- **AC1**: Given T3 pack, when a YAML agent is instantiated, then `check:config` applies name/description (AC20).
- **AC2**: Given a host without Claude agent files, when documenting, then the cell is the native mechanism or «ausente» — never a copied `.claude/agents` recipe.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/skills/meta-harness/references/t03-agent.md` | Pack |
| `.claude/skills/meta-harness/templates/agent/*.md` | Gate-clean |

tdd-skip: documentation pack, gate tests live in US2
