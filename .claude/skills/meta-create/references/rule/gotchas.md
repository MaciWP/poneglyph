---
parent: meta-create
name: gotchas
description: Non-obvious behaviors of Claude Code rule loading and syntax.
---

# Rule Gotchas

Read these carefully. Each one addresses a non-obvious behavior that can silently break a rule.

## 1. `paths:` with Quoted Strings

Quoting glob patterns in `paths:` can fail silently. Always use unquoted patterns:

```yaml
# WRONG - may fail silently
paths:
  - "src/**/*.ts"

# CORRECT
paths:
  - src/**/*.ts
```

## 2. Write Tool Does Not Trigger Path Rules

Path-scoped rules only trigger on file **READ** operations, not Write/Edit. If your rule must apply during file creation, make it always-on instead.

## 3. User-Level Path Rules

`~/.claude/rules/` with `paths:` works, but project rules have higher priority. User-level path rules load first; project rules override on conflict.

## 4. Only `paths:` Is Official Frontmatter

The only officially supported frontmatter field for rules is `paths:`. Other fields (`priority:`, `globs:`, `weight:`, etc.) are NOT part of the Claude Code spec and will be ignored.

## 5. Size Guidance

Keep rules under 200 lines. Large rules dilute context and reduce effectiveness. Split into multiple focused files instead of one mega-rule.

## 6. Post-Compact Behavior

After `/compact`, project-root rules (always-on) re-inject automatically. Path-scoped rules reload **only** when their matching files are accessed again. If the user compacts and then asks about a domain without reading files, the path-scoped rule is not present.

## 7. Naming Conventions

Use descriptive filenames: `error-handling.md`, not `rule-001.md`. The filename helps Claude understand when to apply the rule. Group related path-scoped rules in the `paths/` subdirectory.

## 8. HTML Comments Are Stripped

Any `<!-- ... -->` in rules is stripped before injection to save tokens. Do not rely on HTML comments for content that must reach the model.
