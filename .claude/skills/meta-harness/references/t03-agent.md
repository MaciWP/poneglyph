---
parent: meta-harness
name: t03-agent
description: T3 agent/subagent pack — Claude/Grok markdown agents, Codex standalone TOML. Personas are not this type.
---

# T3 — Agent / subagent

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md). Gate: US2 / `config-quality.md` agents row.
Templates: [markdown.md](../templates/agent/markdown.md) · [codex.toml](../templates/agent/codex.toml).

## 1. What / when

Isolated context (own window, optional tool/model). Not a skill. Grok **personas** (`.grok/personas/`, `[subagents.personas]`) are a different type — do not scan or author them as agents.

## 2. Lookup

Claude sub-agents docs (code.claude.com). Codex custom agents (`.codex/agents/*.toml`). Grok `16-subagents.md`.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Definition file | `.claude/agents/<stem>.md` | `.codex/agents/<file>.toml` | `.grok/agents/<stem>.md` |
| Not this type | — | `[agents]` in `config.toml` = caps/defaults | Personas; `[subagents]` host switch |
| `name` | Frontmatter kebab 1–64. Vendor identity is `name`, not the filename. **This-repo gate:** stem **equals** `name` | Vendor example may use underscores (`pr_explorer`). **This-repo gate:** kebab 1–64 (`pr_explorer` fails `check:config`). Filename match optional | kebab matching stem |
| `description` | 1–1024 | 1–1024 | 1–1024 |
| Body | nonempty markdown | nonempty `developer_instructions` | nonempty markdown |
| Collision | vs skills and commands, not vs the same agent name on another host | same | same |
| Disable | omit / don't spawn; no per-file TOML | don't list / don't spawn | Host-level `GROK_SUBAGENTS=0` or `[subagents] enabled=false`. Per-type `[subagents.toggle.<name>] = false`. Per-agent: Agents tab `/config-agents`. Not a per-file delete |
| Reload | session | restart | `/config-agents` |

Do **not** require Claude `permissionMode` or `model: sonnet` on the portable default.

## 4. Min template

Instantiate markdown into `.claude/agents/` or `.grok/agents/` (stem = name). Codex: copy `codex.toml`. Must pass US2 scan (`validate()` / `check:config`).

## 5. Evidence

T1 + B: Grok user-guide agents vs personas. Vendor schemas. **sin evidencia A/B** for an “ideal” agent description length (E6).

## 6. Poneglyph grain

This repo: es-ES description. Spawn still needs this-turn permission (CLAUDE.md). Keep templates portable.

## 7. Absences

| Cell | Status |
|---|---|
| Codex markdown agents | **ausente** — TOML only |
| Vendor underscore names in this repo | **ausente** from the gate — rename `pr_explorer` → kebab before `check:config` |
| Grok personas as agents | **ausente** |
| Copy `.claude/agents` into Codex/Grok | **ausente** |
| Delete `.grok/agents/<stem>.md` as the only disable | **ausente** — use `[subagents.toggle.<name>]` or `/config-agents` |
