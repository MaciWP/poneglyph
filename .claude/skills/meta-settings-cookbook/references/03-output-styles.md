# Output Styles Reference

## What They Are

Modify how Claude responds (role, tone, format). They edit the system prompt, not add to it.

## File Locations

| Scope | Path |
|-------|------|
| User | `~/.claude/output-styles/` |
| Project | `.claude/output-styles/` |
| Plugins | `output-styles/` in plugin root |

## Template: Custom Output Style

```markdown
---
name: Concise Engineer
description: Terse responses focused on code, minimal explanation
keep-coding-instructions: true
---

You respond in the most concise way possible.

## Rules
- Lead with the code change, not an explanation
- No preamble ("Sure!", "Great question!")
- Skip obvious explanations
- Use bullet points, not paragraphs
- If the answer is a single line of code, just give the line
```

## Frontmatter

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `name` | string | No | From filename |
| `description` | string | No | None |
| `keep-coding-instructions` | boolean | No | `false` |

## Gotchas

| Gotcha | Detail |
|--------|--------|
| `keep-coding-instructions: false` (default) | Removes coding-specific system prompt. Set to `true` if style is for coding tasks |
| Changes need new session | Output style changes take effect on next session start (prompt caching) |
| Built-in styles | Default, Explanatory, Learning |
