---
parent: meta-create
name: rule-system
description: How Claude Code's rule system loads, scopes and prioritizes rules.
---

# Rule System Reference

How `.claude/rules/` works: locations, loading behavior, priorities, and comparison with CLAUDE.md.

## Where Rules Live

| Location | Scope | Shared |
|----------|-------|--------|
| `.claude/rules/*.md` | Project | Yes, via VCS |
| `.claude/rules/paths/*.md` | Path-scoped (project) | Yes, via VCS |
| `~/.claude/rules/*.md` | All projects (user) | No |

## Loading Behavior

| Aspect | Detail |
|--------|--------|
| Always-on (no `paths:`) | Loaded at session start, injected into every context |
| Path-scoped (has `paths:`) | Loaded only when Claude reads a matching file |
| Discovery | Files discovered recursively within `.claude/rules/` |
| Priority | Project rules override user-level rules |
| Load order | User-level rules load first, then project rules |
| Granularity | One topic per file; use descriptive filenames |

## CLAUDE.md vs Rules

| Aspect | CLAUDE.md | .claude/rules/ |
|--------|-----------|----------------|
| Format | Free-form markdown | One topic per file |
| Scope | Project, user, local, managed | Project or user |
| Path-scoping | No | Yes (via `paths:` frontmatter) |
| Best for | General project context | Specific conventions, domain patterns |
| Team sharing | Yes (committed) | Yes (committed) |
| Post-compact | Re-injected automatically | Always-on re-inject; path-scoped reload on file access |

## Directory Structure

```
.claude/rules/
├── error-handling.md        # Always-on: typed errors
├── naming-conventions.md    # Always-on: casing, prefixes
├── formatting.md            # Always-on: code style
├── config-scope.md          # Always-on: config architecture
└── paths/
    ├── api-patterns.md      # Path-scoped: src/api/**
    ├── test-conventions.md  # Path-scoped: **/*.test.*
    ├── hooks.md             # Path-scoped: .claude/hooks/**
    └── orchestration.md     # Path-scoped: .claude/rules/**
```

## Scope Decision Guide

| Scenario | Scope | Reason |
|----------|-------|--------|
| General coding standards | always-on | Applies everywhere |
| Error handling patterns | always-on | Universal convention |
| Formatting rules | always-on | Applies everywhere |
| Security rules | always-on | Universal enforcement |
| API endpoint conventions | path-scoped (`src/api/**`) | Only for API files |
| Test conventions | path-scoped (`**/*.test.*`) | Only for test files |
| Database patterns | path-scoped (`src/db/**`) | Only for DB layer |
| Hook conventions | path-scoped (`.claude/hooks/**`) | Only for hook files |
| Component patterns | path-scoped (`src/components/**`) | Only for UI components |
