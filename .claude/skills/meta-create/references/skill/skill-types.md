---
parent: meta-create
name: skill-types
description: The 5 skill types — when to use each, template mapping, comparison, gathering questions
---

# Skill Types — Selection Guide

Read this to decide which of the 5 skill types fits your use case, and what details to gather from the user before generating.

## Types at a Glance

| Type | Description | Use Case |
|------|-------------|----------|
| `knowledge-base` | Domain patterns, conventions | API patterns, DB conventions, framework guides |
| `encoded-preference` | Behavioral rules, standards | Code quality, security review, formatting rules |
| `workflow` | Interactive step-by-step processes | Deploy, migration, scaffolding |
| `reference` | Lookup material, cheat sheets | Quick reference, checklists |
| `capability-uplift` | Tool guidance, advanced usage | LSP operations, advanced git |

## Comparison Matrix

| Aspect | knowledge-base | encoded-preference | workflow | reference | capability-uplift |
|--------|---------------|-------------------|----------|-----------|-------------------|
| Invocation | Auto | Auto | Manual | Auto | Auto |
| Context | main | main | main | main | main |
| Purpose | Domain patterns | Behavioral rules | Tasks | Lookup material | Tool guidance |
| Template available | Yes | Yes | Yes | Yes | No (use reference) |
| User triggers | Keywords | Keywords | `/command` | Keywords | Keywords |
| Typical effort | medium | low | medium | low | medium |
| `disable-model-invocation` | `false` | `false` | `true` | `false` | `false` |

## Gathering Questions by Type

Once the user has picked a type, ask the relevant questions to fill the template placeholders.

### capability-uplift
- Tool/capability: (e.g., LSP operations, advanced git, regex patterns)
- When to trigger: (e.g., when navigating code, when searching)
- Key techniques to include: (e.g., goToDefinition, findReferences)

### workflow
- Purpose: (e.g., deploy application, run migrations)
- Arguments: (e.g., environment, version)
- Steps: (e.g., build, test, deploy)

### knowledge-base
- Domain: (e.g., Django models, React hooks, SQL optimization)
- Key patterns: (e.g., model inheritance, hook composition)
- Anti-patterns to avoid: (e.g., N+1 queries, prop drilling)
- Target agents: (e.g., builder, reviewer)

### encoded-preference
- Rules: (e.g., always use typed errors, never use any)
- When they apply: (e.g., all TypeScript files, only in tests)
- Exceptions: (e.g., legacy code, generated files)

### reference (research/lookup)
- Topic: (e.g., library comparison, architecture options)
- Questions to answer: (e.g., best tool for X, how to implement Y)
- Sources: (e.g., codebase, documentation, web)

## Template Mapping

| Type | Template file (in `templates/`) |
|------|-------------------------------|
| knowledge-base | `knowledge-base.md` |
| encoded-preference | `encoded-preference.md` |
| workflow | `workflow.md` |
| reference | `reference.md` or `research.md` |
| capability-uplift | (reuse `reference.md`) |
