---
name: {{SKILL_NAME}}
description: |
  {{DESCRIPTION}}
  Úsala cuando: {{TRIGGER_CONDITION}}.
metadata:
  keywords: >
    Keywords - {{KEYWORD_1}}, {{KEYWORD_2}}, {{KEYWORD_3}}
disable-model-invocation: false
when_to_use: |
  "{{TRIGGER_PHRASE_1}}", "{{TRIGGER_PHRASE_2}}", "{{TRIGGER_PHRASE_3}}"
---

# {{SKILL_TITLE}}

{{Brief overview of what this skill provides}}

Instantiate: `{{SKILL_NAME}}` kebab 1–64 matching the directory; `description` 1–1024; `when_to_use` and `metadata.keywords` strings. This-repo activation copy stays es-ES. Foreign repo: portable description, drop keywords/`when_to_use` if unused.

## Definition of Done

- Reuse the caller's scope and acceptance criteria. Resolve any missing task-specific outcome before applying the patterns.
- {{Observable answer or application of the reference that satisfies the request}}
- {{Evidence needed to verify that outcome}}
- Return the result when these criteria hold. Report unmet criteria honestly; do not expand the task after completion.

## How You're Graded

- For variable scope, reuse the caller's quality priorities or resolve them with the DoD before work.
- You are graded on {{specific useful behavior or outcome}} and {{evidence that demonstrates its quality}}.
- Preserve the reference's constraints when adapting it to the task. Additional patterns, prose or changes earn no credit.

## When to use

- {{Condition 1}}
- {{Condition 2}}
- {{Condition 3}}

## When NOT to use

- {{Anti-trigger 1 — use a hook / memory / different skill}}
- {{Anti-trigger 2}}

## Patterns

### {{Pattern 1 Name}}

{{Description of pattern}}

```text
{{Code or command example}}
```

### {{Pattern 2 Name}}

{{Description of pattern}}

```text
{{Code or command example}}
```

## Eval scenarios (≥3)

1. {{Happy path — prompt in, expected behaviour}}
2. {{Near-miss — must not fire}}
3. {{Edge — empty input / conflict / missing tool}}

## Anti-patterns

| Avoid | Instead |
|---|---|
| {{Bad practice}} | {{Good practice}} |

## Content map

| Topic | File | Read when |
|---|---|---|
| {{Topic}} | `references/{{file}}.md` | {{When to load}} |

## Checklist

- [ ] {{Check 1}}
- [ ] {{Check 2}}
- [ ] {{Check 3}}
