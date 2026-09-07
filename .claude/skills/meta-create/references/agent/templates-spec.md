---
parent: meta-create
name: templates-spec
description: The 4 agent templates (reader, builder, executor, researcher) with frontmatter and placeholders.
---

# Agent Template Specifications

## Contents

- [Available Templates](#available-templates)
- [Template: Reader](#template-reader)
- [Template: Builder](#template-builder)
- [Template: Executor](#template-executor)
- [Template: Researcher](#template-researcher)

Four canonical agent types. Actual template files live in `${CLAUDE_SKILL_DIR}/templates/{type}.md`; this reference documents the frontmatter and placeholder set for each.

## Available Templates

| Type | File | Tools | permissionMode | Best For |
|------|------|-------|----------------|----------|
| reader | `templates/reader.md` | Read, Grep, Glob | plan | Code review, analysis, audits |
| builder | `templates/builder.md` | Read, Write, Edit, Bash, Grep, Glob, LSP | acceptEdits | Implementation, refactoring |
| executor | `templates/executor.md` | Bash, Read | default | Running tests, deployments |
| researcher | `templates/researcher.md` | Read, Grep, Glob, WebSearch, WebFetch | plan | Investigation, documentation |

## Template: Reader

**Location**: `templates/reader.md`

**Use when**: Analysis, code review, security audit, quality checks.

**Frontmatter**:
```yaml
---
description: |
  {{DESCRIPTION}}.
  Use proactively when: {{TRIGGER_CONDITION}}.
  Keywords - {{KEYWORDS}}
tools: Read, Grep, Glob
disallowedTools: Task, Edit, Write, Bash
permissionMode: plan
effort: low
color: cyan
memory:
  scope: project
---
```

**Placeholders to replace**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{AGENT_NAME}}` | kebab-case name (used as filename) | `security-reviewer` |
| `{{DESCRIPTION}}` | What it does | `Security analysis specialist` |
| `{{TRIGGER_CONDITION}}` | When to delegate | `reviewing for security issues, auditing code` |
| `{{KEYWORDS}}` | Comma-separated keywords for matching | `security, review, audit, vulnerability` |
| `{{DOMAIN}}` | Area of expertise | `security vulnerabilities` |
| `{{WHAT_TO_ANALYZE}}` | Analysis target | `code for security issues` |
| `{{PATTERNS_OR_ISSUES}}` | What to find | `vulnerabilities, insecure patterns` |
| `{{CRITERIA}}` | Analysis criteria | `OWASP Top 10, input validation` |

## Template: Builder

**Location**: `templates/builder.md`

**Use when**: Feature implementation, code changes, refactoring.

**Frontmatter**:
```yaml
---
description: |
  {{DESCRIPTION}}.
  Use proactively when: {{TRIGGER_CONDITION}}.
  Keywords - {{KEYWORDS}}
tools: Read, Write, Edit, Bash, Grep, Glob, LSP
disallowedTools: Task
permissionMode: acceptEdits
color: blue
memory:
  scope: project
---
```

**Placeholders to replace**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{AGENT_NAME}}` | kebab-case name (used as filename) | `api-implementer` |
| `{{DESCRIPTION}}` | What it builds | `REST API endpoint specialist` |
| `{{TRIGGER_CONDITION}}` | When to delegate | `implementing API endpoints, building routes` |
| `{{KEYWORDS}}` | Comma-separated keywords for matching | `api, endpoint, route, implement` |
| `{{DOMAIN}}` | Area of expertise | `REST APIs with Elysia` |
| `{{WHAT_TO_BUILD}}` | Implementation target | `API endpoints following project patterns` |

## Template: Executor

**Location**: `templates/executor.md`

**Use when**: Running commands, tests, deployments, automation.

**Frontmatter**:
```yaml
---
description: |
  {{DESCRIPTION}}.
  Use proactively when: {{TRIGGER_CONDITION}}.
  Keywords - {{KEYWORDS}}
tools: Bash, Read
disallowedTools: Task, Edit, Write
permissionMode: default
effort: low
color: orange
---
```

**Placeholders to replace**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{AGENT_NAME}}` | kebab-case name (used as filename) | `test-runner` |
| `{{DESCRIPTION}}` | What commands it runs | `Test execution specialist` |
| `{{TRIGGER_CONDITION}}` | When to delegate | `running tests, checking test results` |
| `{{KEYWORDS}}` | Comma-separated keywords for matching | `test, run, execute, coverage` |
| `{{PURPOSE}}` | Command purpose | `running and reporting test results` |
| `{{COMMAND_1}}` | Allowed command | `bun test` |
| `{{COMMAND_2}}` | Allowed command | `bun test --coverage` |
| `{{COMMAND_3}}` | Allowed command | `bun test --watch` |

## Template: Researcher

**Location**: `templates/researcher.md`

**Use when**: Investigation, documentation research, complex questions.

**Frontmatter**:
```yaml
---
description: |
  {{DESCRIPTION}}.
  Use proactively when: {{TRIGGER_CONDITION}}.
  Keywords - {{KEYWORDS}}
tools: Read, Grep, Glob, WebSearch, WebFetch
disallowedTools: Task, Edit, Write
permissionMode: plan
color: purple
memory:
  scope: project
---
```

**Placeholders to replace**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{AGENT_NAME}}` | kebab-case name (used as filename) | `library-researcher` |
| `{{DESCRIPTION}}` | Research focus | `Library and API documentation specialist` |
| `{{TRIGGER_CONDITION}}` | When to delegate | `researching library usage, investigating APIs` |
| `{{KEYWORDS}}` | Comma-separated keywords for matching | `research, investigate, library, documentation` |
| `{{TOPIC}}` | Research topic | `library APIs and best practices` |
| `{{WHAT_TO_RESEARCH}}` | Investigation target | `library documentation and examples` |
