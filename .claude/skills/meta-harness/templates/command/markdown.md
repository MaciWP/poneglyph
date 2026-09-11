---
name: {{COMMAND_NAME}}
description: |
  {{DESCRIPTION}}
  Úsala cuando: {{TRIGGER_CONDITION}}.
argument-hint: "[{{ARG1}}]"
---

# {{COMMAND_TITLE}}

{{One-screen procedure. Prefer a T1 skill if this needs references/.}}

Instantiate: file `.claude/commands/{{COMMAND_NAME}}.md` with kebab filename matching `name`. `description` 1–1024. `argument-hint` is a string.

## When NOT to use

- The host should auto-invoke this (use a T1 skill).
- You were about to add `/meta-harness` (forbidden).

## Steps

1. {{Step 1}}
2. {{Step 2}}
3. {{Verify}}
