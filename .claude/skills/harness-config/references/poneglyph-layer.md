---
parent: harness-config
name: poneglyph-layer
description: Rule of use for every Poneglyph component, and where to edit and sync the layer. CLAUDE.md keeps the trigger; this file keeps the procedure.
---

# Poneglyph layer

## Rule of use

- Every skill, rule or hook justifies its existence against at least one of the 10 Commandments
  (`CLAUDE.md` §Principles). The SKILL.md "Commandments" table records that justification.
- Two components that cover the same ground: one of them goes.
- A component with value that fits no commandment means the list may be incomplete: discuss it
  with the user before adding it.

## Which layer owns a rule

| Layer | Owns |
|---|---|
| `CLAUDE.md` | How to work: principles, method, permissions, agents, configuration |
| Output style | How the answer reads: language, shape, voice, how truth is worded |
| Skill reference | A procedure for one kind of task; `CLAUDE.md` or the style keeps the trigger |
| Hook | Enforcing or reminding a duty at the moment it applies |

- `CLAUDE.md` never describes the shape of the answer; the style never decides what work to do.
  The style may cite a `CLAUDE.md` section; `CLAUDE.md` never cites the style.
- Every visible marker (`ROBIN:`, `Aviso:`, `Espera tu decisión:`, `Router:`, `sensitive:`) is
  defined in one place.
- A hook enforces or reminds; the doctrine states the duty in one line and never explains the
  hook's mechanics. Grok ignores passive hook output, so the duty stays in the doctrine.
- Prefer a non-blocking reminder (`PostToolUse` or the next `UserPromptSubmit` context) over a
  Stop block: a block forces a full extra model turn.

## Where to edit

- The instructions, skills, hooks and house style come from the Poneglyph git repo, the one that
  `~/.claude/skills` links to. Codex and Grok receive generated equivalents.
- Edit the source in that repo, never `~/.claude/` or another installed copy. Then, from the repo:
  `bun .claude/commands/sync-poneglyph.ts --execute --backup --force`.
- Never hand-edit generated files (`settings.json`, `system-prompts/poneglyph-sp.md`, Codex
  `AGENTS.md`, the router agent); the sync rewrites them.
- Host install and limits: `.claude/docs/harness-adapters.md`.
