---
parent: meta-create
name: frontmatter-spec
description: Canonical v2 skill frontmatter reference — all fields, valid values, invalid fields, invocation model
---

# Skill Frontmatter — Canonical v2 Reference

Full spec for every field allowed in skill frontmatter. Read this when authoring a skill's frontmatter and you need to know exactly what fields are allowed, what values they accept, and which fields are forbidden.

## Field Reference

Official fields (verified against `code.claude.com/docs/en/skills` on 2026-09-02, CC 2.1.258):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No (defaults to dir name) | Unique kebab-case identifier — Poneglyph always sets it |
| `description` | string | Recommended | Purpose + "Úsala cuando:" line (es-ES, see §Description Format). Combined with `when_to_use` it is truncated at 1,536 chars in the listing |
| `when_to_use` | string | No | Trigger phrases appended to `description` in the listing (counts toward the 1,536 cap) |
| `argument-hint` | string | No | Args shown in autocomplete (e.g., `"[file-path or module]"`) |
| `arguments` | string \| list | No | Named positional args for `$name` substitution |
| `disable-model-invocation` | boolean | No | `true` = manual only (`/name`); also blocks subagent preload and scheduled-task runs |
| `user-invocable` | boolean | No | `false` hides the skill from the `/` menu (background knowledge). Default `true`. Does NOT affect auto-activation |
| `allowed-tools` | string \| list | No | Tools pre-approved for the turn that invokes the skill (grant clears on the next message; goes through the normal permission flow). Workspace trust does not gate it — review before checking a skill into a repo |
| `disallowed-tools` | string \| list | No | Tools removed from the pool while the skill is active (e.g. `AskUserQuestion` for a background loop) |
| `model` | string | No | Model for the rest of the current turn (`/model` values or `inherit`). Poneglyph doctrine: leave it out — the Lead routes models dynamically |
| `effort` | string | No | `low` \| `medium` \| `high` \| `xhigh` \| `max` (availability depends on the model). Project doctrine: omit and inherit the session effort; pin a higher value ONLY when the skill genuinely needs it (critic/security-audit/unstuck pin `xhigh`; `decide`'s heavy tier escalates per-invocation). Never pin BELOW what the skill needs |
| `context` | `fork` | No | Run the skill in a forked subagent (inherits the conversation). `agent` picks the subagent type; `background` (default `true`, CC ≥2.1.218) set to `false` waits for the result in-turn |
| `agent` | string | No | Subagent type used when `context: fork` |
| `background` | boolean | No | Only with `context: fork` — see above |
| `hooks` | object | No | Hooks registered when the skill is invoked (kept for the session; supports `once`) |
| `paths` | list | No | Globs — the skill auto-applies when touched files match (used by `security-audit`; see `rules/paths/orchestration.md`) |
| `shell` | `bash` \| `powershell` | No | Shell for inline `` !`command` `` blocks |

Poneglyph-only keys (ignored by Claude Code; keep them under `metadata:` so other harnesses' validators stay quiet — the `keywords` block moved there in `cdcb1fb`): `metadata.keywords` (the `Keywords -` block parsed by `skill-activation.ts`), `type` (taxonomy label, unused), `version`.

## Fields that look valid but are not

| Field | Reason | Alternative |
|---------------|--------|-------------|
| `allowedTools` / `disallowedTools` (camelCase) | Agent frontmatter spelling | Skills use kebab-case `allowed-tools` / `disallowed-tools` |
| `activation.keywords`, `for_agents` | Never read by Claude Code | `metadata.keywords` (hook) or the `description` prose |

## Invocation Model: Agents = Behavior, Skills = Knowledge

Skills provide domain knowledge that any agent can leverage. The `disable-model-invocation` field controls whether agents can self-invoke the skill:

| Skill Category | `disable-model-invocation` | Reason |
|----------------|---------------------------|--------|
| **Knowledge** (knowledge-base, reference, capability-uplift) | `false` | Any agent can invoke when needed — builder, reviewer, etc. |
| **Behavioral/Workflow** (workflow, mode toggles) | `true` | User-initiated — decisions, modes, scaffolding |
| **Meta** (encoded-preference for meta ops) | `true` | User-initiated — agent/skill creation |

A builder working on Django can self-invoke a `django-patterns` skill. A reviewer on the same project uses the same skill for review context. The skill is shared knowledge; the agent decides how to apply it.

## Description Format

> **Language (feature 023, ratified 2026-06-23)**: the `description` and `when_to_use` fields — the skill **activation surface** — are written in **es-ES** (they are matched against Oriol's Spanish prompts; personal Spanish-only config). Technical identifiers (skill names, `hook`, `TDD`, `commit`, paths) stay in their original form; the `Keywords -` label stays literal (the `skill-activation` hook parses it); keywords themselves may be ES+EN. The skill **body** stays English. This paragraph is the canonical spec of the exception (CLAUDE.md carries only the general register rule under §Base behavior).

The `description` field follows this pattern (es-ES prose, third person):

```yaml
description: |
  {Propósito en una línea, es-ES, tercera persona — "Propone…", "Genera…"}.
  Úsala cuando: {condiciones de disparo en es-ES}.
  Keywords - {keyword1, keyword2, ...}   # label literal; keywords ES+EN
when_to_use: |
  "frase-gatillo en español", "otra frase ES", "english technical phrase"
```

`description` + `when_to_use` combined ≤ 1.536 chars (Claude Code listing cap). Put load-bearing keywords EARLY. The pattern is load-bearing for auto-matching: the model selects on this prose alone.

## Validation Rules for Skill Name

| Rule | Check | Error Message |
|------|-------|---------------|
| Name format | Must be kebab-case | "Skill name must be kebab-case (e.g., api-patterns)" |
| Name unique | No existing directory | "Skill {name} already exists at {path}" |
| Type valid | One of 5 types | "Type must be: knowledge-base, encoded-preference, workflow, reference, capability-uplift" |

## Full Example (all fields)

```yaml
---
name: django-patterns
description: |
  Django model and view conventions for this project.
  Use when: working with Django models, views, or serializers.
  Keywords - django, model, view, serializer, orm
type: knowledge-base
disable-model-invocation: false
argument-hint: "[file-path or module]"
effort: medium
activation:
  keywords:
    - django
    - model
    - view
    - serializer
for_agents: [builder, reviewer]
version: "1.0"
---
```
