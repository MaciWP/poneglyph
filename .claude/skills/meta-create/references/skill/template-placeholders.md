---
parent: meta-create
name: template-placeholders
description: Placeholder reference for each template file — what to replace and with what
---

# Template Placeholders

## Contents

- [Reference Template (templates/reference.md)](#reference-template-templatesreferencemd)
- [Workflow Template (templates/workflow.md)](#workflow-template-templatesworkflowmd)
- [Research / Reference Template (templates/research.md)](#research-reference-template-templatesresearchmd)
- [Knowledge Base Template (templates/knowledge-base.md)](#knowledge-base-template-templatesknowledge-basemd)
- [Overview](#overview)
- [Patterns](#patterns)
- [Anti-Patterns](#anti-patterns)
- [References](#references)
- [Encoded Preference Template (templates/encoded-preference.md)](#encoded-preference-template-templatesencoded-preferencemd)
- [Rules](#rules)
- [Exceptions](#exceptions)

Each template under `templates/` uses `{{DOUBLE_BRACE}}` placeholders. Read this when filling a template to know exactly which placeholders exist and what values they expect.

## Reference Template (`templates/reference.md`)

**Use when**: Documenting patterns, conventions, best practices for auto-retrieval.

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{SKILL_NAME}}` | kebab-case name | `api-conventions` |
| `{{SKILL_TITLE}}` | Display title | `API Conventions` |
| `{{DESCRIPTION}}` | What it provides | `REST API design patterns` |
| `{{TRIGGER_CONDITION}}` | When to auto-load | `creating or modifying API endpoints` |
| `{{Condition 1-3}}` | Usage conditions | `Creating new API endpoint` |
| `{{Pattern 1-2 Name}}` | Pattern names | `Request Validation` |
| `{{language}}` | Code language | `typescript` |
| `{{Code example}}` | Pattern code | `app.post('/api', validate(schema))` |

**Key sections**: When to Use, Patterns, Checklist, Anti-Patterns, References.

## Workflow Template (`templates/workflow.md`)

**Use when**: Creating manual commands for multi-step tasks.

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{SKILL_NAME}}` | kebab-case name | `deploy` |
| `{{SKILL_TITLE}}` | Display title | `Deploy Application` |
| `{{DESCRIPTION}}` | What it does | `Deploy application to environment` |
| `{{ARG1}}, {{ARG2}}` | Arguments | `environment`, `version` |
| `{{TOOLS}}` | Required tools | `Bash, Read, Write` |
| `{{Prerequisite 1-2}}` | Requirements | `Environment configured` |
| `{{Action Title}}` | Step names | `Build Application` |
| `{{Error 1-2}}` | Error cases | `Build failed` |

**Key sections**: Usage, Prerequisites, Steps, Output, Error Handling, Rollback.

## Research / Reference Template (`templates/research.md`)

**Use when**: Deep investigation or lookup material that benefits from isolated context.

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{SKILL_NAME}}` | kebab-case name | `arch-analysis` |
| `{{SKILL_TITLE}}` | Display title | `Architecture Analysis` |
| `{{DESCRIPTION}}` | Research focus | `Codebase architecture patterns` |
| `{{TRIGGER_CONDITION}}` | When to activate | `analyzing architecture, structure, design` |
| `{{TOPIC}}` | Research topic | `codebase architecture` |
| `{{Area 1-2}}` | Research areas | `Module Dependencies` |
| `{{Question 1-2}}` | Questions to answer | `What patterns are used?` |

**Key sections**: Methodology, Research Areas, Output Format, Constraints.

## Knowledge Base Template (`templates/knowledge-base.md`)

**Use when**: Capturing domain-specific patterns and conventions that agents auto-invoke during implementation or review.

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{SKILL_NAME}}` | kebab-case name | `django-patterns` |
| `{{SKILL_TITLE}}` | Display title | `Django Patterns` |
| `{{DESCRIPTION}}` | What knowledge it provides | `Django model and view conventions` |
| `{{USE_CASES}}` | When to auto-load | `working with Django models, views, or serializers` |
| `{{KEYWORDS}}` | Comma-separated keywords | `django, model, view, serializer` |
| `{{KEYWORD_1}}, {{KEYWORD_2}}` | Activation keywords | `django`, `model` |
| `{{PATTERN}}` | Pattern name | `Fat Models` |
| `{{WHEN}}` | When to apply | `Business logic in models` |
| `{{EXAMPLE}}` | Code or usage example | `model.clean()` |
| `{{AVOID}}` | Anti-pattern | `Logic in views` |
| `{{ALTERNATIVE}}` | Preferred approach | `Move to model method` |
| `{{REASON}}` | Why | `Testability and reuse` |
| `{{REFERENCE_LINKS}}` | Documentation links | `https://docs.djangoproject.com/` |

**Body template**:
```markdown
# {{SKILL_TITLE}}

## Overview
{{OVERVIEW}}

## Patterns
| Pattern | When | Example |
|---------|------|---------|
| {{PATTERN}} | {{WHEN}} | {{EXAMPLE}} |

## Anti-Patterns
| Avoid | Use Instead | Why |
|-------|-------------|-----|
| {{AVOID}} | {{ALTERNATIVE}} | {{REASON}} |

## References
- {{REFERENCE_LINKS}}
```

**Key sections**: Overview, Patterns, Anti-Patterns, References.

## Encoded Preference Template (`templates/encoded-preference.md`)

**Use when**: Encoding behavioral rules and standards that agents apply automatically during their work.

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{SKILL_NAME}}` | kebab-case name | `error-handling-rules` |
| `{{SKILL_TITLE}}` | Display title | `Error Handling Rules` |
| `{{DESCRIPTION}}` | What rules it encodes | `Typed error handling conventions` |
| `{{USE_CASES}}` | When to auto-load | `writing error handling, catch blocks, Result types` |
| `{{KEYWORDS}}` | Comma-separated keywords | `error, catch, Result, typed error` |
| `{{KEYWORD_1}}, {{KEYWORD_2}}` | Activation keywords | `error`, `catch` |
| `{{RULE}}` | Rule name | `Always use typed errors` |
| `{{WHEN}}` | When it applies | `Any catch block` |
| `{{EXAMPLE}}` | Code or usage example | `catch (e: AppError)` |
| `{{EXCEPTION}}` | Exception to the rule | `Third-party library callbacks` |
| `{{CONTEXT}}` | When exception applies | `Library expects untyped throw` |
| `{{HANDLING}}` | How to handle the exception | `Wrap in typed error at boundary` |

**Body template**:
```markdown
# {{SKILL_TITLE}}

## Rules
| Rule | Applies When | Example |
|------|-------------|---------|
| {{RULE}} | {{WHEN}} | {{EXAMPLE}} |

## Exceptions
| Exception | Context | Handling |
|-----------|---------|----------|
| {{EXCEPTION}} | {{CONTEXT}} | {{HANDLING}} |
```

**Key sections**: Rules, Exceptions.
