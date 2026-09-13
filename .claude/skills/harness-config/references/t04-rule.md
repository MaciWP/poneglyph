---
parent: harness-config
name: t04-rule
description: T4 rule pack — always-loaded request files. Out of check-config (D15).
---

# T4 — Rule

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md) · [t01-skill.md](t01-skill.md) · [t09-memory.md](t09-memory.md).

## 1. What / when

Short always-do, often path-scoped. Hook (T5) when it must happen. Memory (T9) when it is project identity. Skill (T1) when it needs judgement.

## 2. Lookup

Claude memory/path-specific rules. Codex AGENTS.md / config. Grok `12-project-rules.md`.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Path | `.claude/rules/*.md` (path globs in frontmatter) | `AGENTS.md` layers; not a cloned `.claude/rules` tree | `.grok/rules/*.md` + AGENTS.md/CLAUDE.md names; also scans `.claude/rules/` when compat on |
| Gate | **Out of `check-config` (D15)** | same | same |
| Cost | Always-loaded — budget ratchet, not a new CI line count | AGENTS.md size is request cost | same |
| Disable | Remove or don't match path | Don't load that file | Don't ship the file; compat.claude.rules=false stops Claude-tree rules |
| Reload | Session / path touch | Restart / new session | Session; trust required for project files |

## 4. Min template

Template N/A as a gate artefact. A rule is markdown; do not add a `check:config` rule this HU.

## 5. Evidence

E2: instruction in memory = request; hook = guarantee. E6: no invented line-count CI. **sin evidencia A/B** for an ideal rule length.

## 6. Poneglyph grain

Keep rules thin. Path-scope when possible. Always-loaded growth hits the budget ratchet (AC30), not `check-config`.

## 7. Absences

| Cell | Status |
|---|---|
| Rules in `check-config` | **ausente** (D15) — do not add |
| Codex `.claude/rules` clone | **ausente** |
| Codex `.codex/rules/*.rules` | **ausente** from T4 — experimental sandbox `prefix_rule`, not always-do markdown |
