---
parent: meta-create
name: templates
description: Always-on and path-scoped rule templates with placeholders and optional sections.
---

# Rule Templates

## Contents

- [Template: Always-On Rule](#template-always-on-rule)
- [Patterns](#patterns)
- [Anti-Patterns](#anti-patterns)
- [Template: Path-Scoped Rule](#template-path-scoped-rule)
- [Patterns](#patterns)
- [Anti-Patterns](#anti-patterns)
- [Frontmatter Reference](#frontmatter-reference)

Two canonical templates: always-on (no frontmatter) and path-scoped (`paths:` frontmatter required).

## Template: Always-On Rule

**Use when**: Conventions that apply everywhere, every session.

**Location**: `.claude/rules/{rule-name}.md`

**Frontmatter**: None required. Filename should be descriptive.

```markdown
# {Rule Title}

{Brief description of what this rule enforces.}

## Patterns

| Pattern | When | Example |
|---------|------|---------|
| {pattern} | {when to apply} | {code or description} |

## Anti-Patterns

| Avoid | Use Instead | Reason |
|-------|-------------|--------|
| {bad practice} | {good practice} | {why} |
```

**Placeholders to replace**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{Rule Title}` | Title case name | `Error Handling` |
| `{pattern}` | Recommended practice | `Use typed errors` |
| `{bad practice}` | What to avoid | `throw new Error("msg")` |
| `{good practice}` | What to do instead | `throw new AppError(code, msg)` |

**Optional sections** (add as needed):

| Section | When to Include |
|---------|-----------------|
| Examples | Complex patterns that benefit from full code blocks |
| Exceptions | Rules that have valid edge cases |
| References | External docs or standards being followed |
| Checklist | Verification steps before completing |

## Template: Path-Scoped Rule

**Use when**: Conventions that only apply to specific file patterns.

**Location**: `.claude/rules/paths/{rule-name}.md`

**Frontmatter**: Required. Only `paths:` is officially supported.

```markdown
---
paths:
  - src/api/**/*.ts
  - src/routes/**/*.ts
---

# {Rule Title}

{Brief description of what this rule enforces for these paths.}

## Patterns

| Pattern | Example |
|---------|---------|
| {pattern} | {code or description} |

## Anti-Patterns

| Avoid | Use Instead |
|-------|-------------|
| {bad practice} | {good practice} |
```

**Placeholders to replace**:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{paths}` | Glob patterns (YAML list, unquoted) | `src/api/**/*.ts` |
| `{Rule Title}` | Title case name | `API Endpoint Patterns` |
| `{pattern}` | Recommended practice | `Validate all inputs with Zod` |
| `{bad practice}` | What to avoid | `Access raw body without validation` |

## Frontmatter Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `paths` | YAML list | Only for path-scoped | Glob patterns for conditional loading |

**Note**: `paths` is the ONLY officially supported frontmatter field for rules. All other fields are ignored.

### What Goes in Frontmatter vs Body

| Content | Where | Example |
|---------|-------|---------|
| File pattern matching | `paths:` frontmatter | `paths: [src/api/**/*.ts]` |
| Rule description | Body heading | `# API Patterns` |
| Patterns and examples | Body tables/code blocks | Pattern tables, code examples |
| Anti-patterns | Body tables | Avoid/Instead columns |
