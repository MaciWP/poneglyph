---
parent: harness-config
name: t15-gitignore
description: T15 layer gitignore pack. Grok skill discovery does not use gitignore — hide via [skills] ignore / disabled.
---

# T15 — Layer gitignore

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md) · [t01-skill.md](t01-skill.md) · [t10-settings.md](t10-settings.md).
Absorbs cookbook `06-gitignore.md` (D27).

## 1. What / when

What to commit vs ignore in harness config. Hiding a skill from Grok is **not** a gitignore job.

## 2. Lookup

Claude `respectGitignore` + local settings. Codex project vs user files. Grok `08-skills.md` (discovery does **not** use `.gitignore`) + `[tools] respect_gitignore`.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Typical ignore | `.claude/settings.local.json`; `CLAUDE.local.md`; `.claude/agent-memory/*/MEMORY.md` | Local secrets / `.codex` machine files the team did not agree to share | Same class for local TOML secrets. **Skill dirs still load if present on disk** |
| Typical commit | `.claude/settings.json`, skills, `CLAUDE.md`, `.mcp.json` | `AGENTS.md`; agreed `.codex/config.toml` | `AGENTS.md`; agreed `.grok/` project files |
| Hide a skill | Don't ship the directory; or `skillOverrides` | `[[skills.config]]` `enabled = false` | `[skills] ignore` (hide path) or `disabled` (listed, inactive). **Not** `.gitignore` |
| Tool skip ignored files | `respectGitignore` (this repo project settings) | Host file tools honor gitignore unless told otherwise | `[tools] respect_gitignore` default **false**; `GROK_RESPECT_GITIGNORE` |

Gitignoring `.claude/**` does **not** mean “Grok stopped loading the skill”.

## 4. Min template

```gitignore
.claude/settings.local.json
CLAUDE.local.md
.claude/agent-memory/*/MEMORY.md
```

Do not add `.claude/skills/` or `.grok/skills/` as a “disable” trick.

## 5. Evidence

T1: Grok 08-skills.md 2026-09-10 — discovery skips gitignore. Cookbook 06: local vs shared table. **sin evidencia A/B** for “ignoring skills speeds startup”.

## 6. Poneglyph grain

Shared config stays committed. Machine paths (`ccstatusline.exe`) go in `settings.local.json`. Impact before deleting an ignore rule that was hiding secrets.

## 7. Absences

| Cell | Status |
|---|---|
| Grok hide-via-gitignore | **ausente** — use `[skills] ignore` / `disabled` |
| Gitignoring `.claude/**` as “Grok unloaded the skill” | **ausente** |
