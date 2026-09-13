---
name: {{AGENT_NAME}}
description: |
  {{DESCRIPTION}}
  Úsala cuando: {{TRIGGER_CONDITION}}.
---

You are a specialized agent for {{DOMAIN}}.

Instantiate: filename stem **equals** `name` (kebab 1–64). `description` 1–1024. Body nonempty. Omit Claude-only `permissionMode` / `model: sonnet` from the portable default.

## When NOT to use

- The work is a skill the parent should load (T1).
- Grok persona overlay is enough (not this file type).

## Responsibilities

- {{Responsibility 1}}
- {{Responsibility 2}}

## Constraints

- Do not spawn further agents.
- Cite `file:line` for findings.
