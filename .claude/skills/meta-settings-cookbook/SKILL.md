---
name: meta-settings-cookbook
description: |
  Plantillas de referencia rápida para configuraciones pequeñas de Claude Code: CLAUDE.md, settings.json, output styles, variables de entorno, permisos.
  Úsala cuando: montar config de proyecto, crear CLAUDE.md, configurar settings, añadir permisos, crear output styles, "permisos", "settings.json", "env vars".
metadata:
  keywords: >
    Keywords - CLAUDE.md, settings, config, permissions, output style, env vars, setup
disable-model-invocation: false
argument-hint: "[config-type]"
when_to_use: |
  "configura CLAUDE.md", "permisos", "settings.json", "output style", "env vars", "configure permissions"
---

# Quick Config

Quick-reference templates for Claude Code configurations.

## Official Documentation

| Config Type | Docs URL |
|-------------|----------|
| CLAUDE.md & Rules | `https://code.claude.com/docs/en/memory.md` |
| Settings | `https://code.claude.com/docs/en/settings.md` |
| Output Styles | `https://code.claude.com/docs/en/output-styles.md` |
| Environment Variables | `https://code.claude.com/docs/en/env-vars.md` |
| Permissions | `https://code.claude.com/docs/en/permissions.md` |

## References

| Reference | Contents |
|-----------|----------|
| `${CLAUDE_SKILL_DIR}/references/01-claude-md.md` | Locations, precedence, template, `@path` imports, gotchas |
| `${CLAUDE_SKILL_DIR}/references/02-settings-json.md` | Scopes, templates (project + user), key settings table, gotchas |
| `${CLAUDE_SKILL_DIR}/references/03-output-styles.md` | File locations, template, frontmatter fields, gotchas |
| `${CLAUDE_SKILL_DIR}/references/04-env-vars.md` | Where to set, useful env vars table, gotchas |
| `${CLAUDE_SKILL_DIR}/references/05-permissions.md` | Syntax, evaluation order, templates, common patterns |
| `${CLAUDE_SKILL_DIR}/references/06-gitignore.md` | Template gitignore, what to commit vs gitignore |
| `${CLAUDE_SKILL_DIR}/references/07-statusline.md` | ccstatusline setup, verified widget types, 4-line layout |

## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `config-type` | No | show menu | `claude-md`, `settings`, `output-style`, `env-vars`, `permissions`, `gitignore` |

## Related

- `meta-create` skill: auto-activable skill that creates hooks, rules, MCP configs, plugins, agents and skills (templates + references under `.claude/skills/meta-create/`)
- After any behavioral meta-config change (CLAUDE.md, output-style, permissions affecting behavior), run the golden-prompt regression: `bun .claude/evals/run.ts` (in the poneglyph repo — evals/ is deliberately not synced) (protocol: `.claude/evals/README.md`)
