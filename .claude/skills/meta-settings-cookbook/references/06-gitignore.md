# .gitignore Patterns for Claude Code

## Template

```gitignore
# Claude Code local settings (not shared)
.claude/settings.local.json
CLAUDE.local.md

# Claude Code auto-generated
.claude/agent-memory/*/MEMORY.md
```

## What to Commit vs Gitignore

| Commit (shared) | Gitignore (personal) |
|-----------------|---------------------|
| `.claude/settings.json` | `.claude/settings.local.json` |
| `.claude/agents/*.md` | `CLAUDE.local.md` |
| `.claude/skills/` | Agent memory files |
| `CLAUDE.md` | |
| `.mcp.json` | |
