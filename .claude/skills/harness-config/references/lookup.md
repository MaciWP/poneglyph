---
parent: harness-config
name: lookup
description: Live official-docs recipe per host. Fetch now. Local pack text is snapshot plus gotchas, not the live law.
---

# Lookup: live official docs

No fetcher script (D22). Date-stamp every fetch. Unreachable → use the pack snapshot and say so.

## Indexes (fetch these, then open the type page)

| Surface | Index | Type page for skills (T1) | CLI / path check |
|---|---|---|---|
| Portable (Agent Skills) | https://agentskills.io/llms.txt | https://agentskills.io/specification | Optional: `skills-ref validate ./<skill>` |
| Claude Code | https://code.claude.com/docs/llms.txt | https://code.claude.com/docs/en/skills | `claude --help`; settings: https://code.claude.com/docs/en/settings-reference |
| Codex | https://developers.openai.com/codex · https://learn.chatgpt.com/llms.txt | https://learn.chatgpt.com/codex/build-skills.md | `$skill-creator`; `~/.codex/config.toml` |
| Grok Build | https://docs.x.ai/build/overview | Installed `~/.grok/docs/user-guide/08-skills.md` | `grok inspect` |

Conflict: portable Agent Skills wins for the nucleus (`name`, `description`, body, `references/`). Host extensions stay in that host's column. A conflict between live doc, pack snapshot, and installed CLI is reported with provenance; never updated in silence.

## How to record a fetch

```text
Fetched: <URL or path>
Date: YYYY-MM-DD
Result: unchanged | changed (<what>) | unreachable (using snapshot from <date>)
```

## Last fetch (this pack)

| Surface | Date | CLI / stamp | Result |
|---|---|---|---|
| Agent Skills spec | 2026-09-10 | n/a (web spec) | `name` ≤64 kebab matching dir; `description` ≤1024; SKILL.md <500 lines guidance; refs one level |
| Claude skills | 2026-09-10 | `claude --help` | `skillOverrides` per-skill visibility; listing `description`+`when_to_use` 1536; live reload of `SKILL.md` |
| Codex build-skills | 2026-09-10 | `codex --version` | listing ≤2% or 8000 chars; `[[skills.config]]` `path` + `enabled = false`; `$skill-creator` |
| Grok 08-skills.md | 2026-09-10 | `grok --version` / installed user-guide | `[skills] disabled`; `when-to-use`; `model`/`effort` applied; `grok inspect` |

## Upstream marks

The one record of how far upstream changes were reviewed. `whats-new` reads it and moves a
row only after the user reviews that source; other docs point here instead of keeping a stamp.

| Source | Location | Reviewed up to | Evidence |
|---|---|---|---|
| `claude-api` | https://platform.claude.com/docs/en/release-notes/overview.md | 2026-10-23 | Notes up to 2026-10-15 read; `model-uplift-playbook.md` §4 |
| `prompting` | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/ (`.md` pages) | 2026-10-23 | Opus 5 and 5.5 read in full; Haiku 5.5, Sonnet 5 and 5.5, Opus 4.8, Fable 5 and 5.1, best practices searched by topic only |
| `claude-code` | https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md | 2.1.302 | `model-uplift-playbook.md` §4 |
| `blogs` | https://claude.dev/rss.xml · https://www.anthropic.com/engineering | 2026-10-23 | Posts to 2026-10-15; code review, agent automations and eval design read, the rest by title |
| `codex` | https://learn.chatgpt.com/docs/changelog | 0.163.0 | Changelog to 2026-10-15; installed 0.160.1 |
| `grok` | `~/.grok/docs/user-guide/` (ships with the CLI) | 1.0.46 | Docs of 2026-10-16 searched by topic only |
