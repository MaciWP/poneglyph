---
name: {{SKILL_NAME}}
description: |
  {{DESCRIPTION}}
  Úsala cuando: {{TRIGGER_CONDITION}}.
metadata:
  keywords: >
    Keywords - {{KEYWORD_1}}, {{KEYWORD_2}}, {{KEYWORD_3}}
disable-model-invocation: true
argument-hint: "[{{ARG1}}] [{{ARG2}}]"
when_to_use: |
  "{{TRIGGER_PHRASE_1}}", "{{TRIGGER_PHRASE_2}}", "{{TRIGGER_PHRASE_3}}"
---

# {{SKILL_TITLE}}

{{Purpose of this workflow}}

Instantiate: `{{SKILL_NAME}}` kebab 1–64 matching the directory; `description` 1–1024; `argument-hint` is a string. `disable-model-invocation: true` blocks auto-invoke (Claude/Grok). Codex: also set `agents/openai.yaml` `allow_implicit_invocation: false` if implicit match must not fire. This-repo activation copy stays es-ES.

## When NOT to use

- {{This is a one-off edit, not a repeatable procedure}}
- {{The always-do belongs in a hook or project memory}}

## Usage

```text
/{{SKILL_NAME}} {{arguments}}
```

## Prerequisites

- [ ] {{Prerequisite 1}}
- [ ] {{Prerequisite 2}}

## Steps

### Step 1: {{Action title}}

{{Instructions}}

### Step 2: {{Action title}}

{{Instructions}}

### Step 3: Verify

{{Verification}}

## Eval scenarios (≥3)

1. {{Happy path with arguments}}
2. {{Missing prerequisite — must stop}}
3. {{Partial failure — rollback or report, do not claim done}}

## Anti-patterns

| Avoid | Instead |
|---|---|
| {{Claim done without the verify step}} | {{Run the check named in Step 3}} |

## Error handling

| Error | Cause | What to do |
|---|---|---|
| {{Error 1}} | {{Cause}} | {{Solution}} |
| {{Error 2}} | {{Cause}} | {{Solution}} |

## Content map

| Topic | File | Read when |
|---|---|---|
| {{Topic}} | `references/{{file}}.md` | {{When to load}} |
