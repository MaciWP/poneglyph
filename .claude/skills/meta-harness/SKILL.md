---
name: meta-harness
description: |
  Punto de entrada para la configuración nativa de Claude Code, Codex y Grok Build: consultar la documentación oficial, crear, modificar, desactivar o borrar skills, commands, agents, rules, hooks, MCP, plugins, workflows, memoria de proyecto, settings, permisos, env, output styles, statusline y gitignore. Incluye el impacto antes de mutar y el gate check:config.
  Úsala cuando: introduces o cambias config de un arnés, "crea una skill", "añade un hook", "nueva regla", "crea un agente", "MCP", "plugin", "permisos", "settings.json", "output style", "borra esta skill", "desactiva un hook", "qué ha cambiado en Codex".
metadata:
  keywords: >
    Keywords - meta-harness, crea una skill, new skill, añade un hook, nueva regla, crea un agente,
    create agent, MCP server, plugin, configura CLAUDE.md, permisos, settings.json, output style,
    env vars, borra esta skill, desactiva un hook, consulta docs oficiales, harness config
disable-model-invocation: false
when_to_use: |
  "crea una skill", "añade un hook", "nueva regla", "crea un agente", "configura CLAUDE.md",
  "permisos", "settings.json", "output style", "env vars", "borra esta skill",
  "desactiva un hook", "consulta docs oficiales", "qué ha cambiado en Codex/Grok"
---

# meta-harness — native harness configuration

Single entry for **any** native-config job on Claude Code, OpenAI Codex, and Grok Build.
Native creators draft. This skill owns lookup, impact, `check:config`, and the Poneglyph layer.

There is no companion `/meta-harness` command or workflow.

## Verbs

Name the verb **before** acting. Impact is a step, not a sixth verb (D16).

| Verb | Does | Does not |
|---|---|---|
| Consult | Fetch live official docs; report unchanged / changed / unreachable | Edit files |
| Create | Write a valid artefact (portable default) | Skip `bun run check:config` |
| Modify | Change the asked behaviour; keep the rest | Wipe with the default template |
| Disable | Turn off where the host supports it | Fake disable with a delete |
| Delete | Remove source + leftover name registries | Claim runtime is gone without checking |

**Impact** (before modify / disable / delete / rename): grep consumers, then `references/doctrine-sweep.md`. Close honestly: live refs in these roots vs installed state unverified.

## How to use

1. Identify the type (T1–T15) and the verb.
2. Load **one** pack: `references/tNN-<type>.md` when that file exists. Do not load sibling packs.
3. Lookup live official docs ([lookup.md](references/lookup.md); indexes below). Local pack text is snapshot + gotchas, not the live law.
4. A native creator may draft; §Native creators keeps the ownership split.
5. Write **inline**. Fan-out via Workflow only for ≥4 independent units.
6. Packs name the install/sync step. Do not change `sync-claude` / `sync-codex` / `sync-grok` here.

Do not invent a host recipe. Markdown-link a pack only when the file exists.

## Catalog (T1–T15)

| Id | Type | Pack file (when present) |
|---|---|---|
| T1 | Skill | [t01-skill.md](references/t01-skill.md) |
| T2 | Command | [t02-command.md](references/t02-command.md) |
| T3 | Agent / subagent | [t03-agent.md](references/t03-agent.md) |
| T4 | Rule | [t04-rule.md](references/t04-rule.md) |
| T5 | Hook | [t05-hook.md](references/t05-hook.md) |
| T6 | MCP config entry | [t06-mcp.md](references/t06-mcp.md) |
| T7 | Plugin | [t07-plugin.md](references/t07-plugin.md) |
| T8 | Workflow | [t08-workflow.md](references/t08-workflow.md) |
| T9 | Project memory (`CLAUDE.md` / `AGENTS.md`) | [t09-memory.md](references/t09-memory.md) |
| T10 | Host settings | [t10-settings.md](references/t10-settings.md) |
| T11 | Permissions | [t11-permissions.md](references/t11-permissions.md) |
| T12 | Environment variables | [t12-env.md](references/t12-env.md) |
| T13 | Output style | [t13-output-style.md](references/t13-output-style.md) |
| T14 | Statusline | [t14-statusline.md](references/t14-statusline.md) |
| T15 | Layer gitignore | [t15-gitignore.md](references/t15-gitignore.md) |

Choice tree: always-the-same with no judgement → T5. Short always-do → T9 or T4. Procedure sometimes → T1 or T2. Isolated context → T3. External system → T6. Share across repos → T7. Bounded multi-worker orchestration → T8.

A host that lacks a type is **ausente**. Never clone a Claude recipe into that cell.

## Live docs (lookup)

Fetch now. Do not treat this table as the spec.

| Surface | Index |
|---|---|
| Portable (Agent Skills) | `https://agentskills.io/llms.txt` · spec `https://agentskills.io/specification` |
| Claude Code | `https://code.claude.com/docs/llms.txt` |
| Codex | `https://developers.openai.com/codex` · `https://learn.chatgpt.com/llms.txt` |
| Grok Build | `https://docs.x.ai/build` · installed `~/.grok/docs/user-guide/` |

Date-stamp the fetch. Unreachable → use the pack snapshot and say so.

## Native creators (draft only)

Full contract: [native-creators.md](references/native-creators.md). Claude `skill-creator`, Codex `$skill-creator`, Grok `/create-skill`. They draft. This skill still owns lookup, impact, `check:config`, and Poneglyph copy.

## When NOT to use

- Application code that is not harness configuration.
- Implementing an MCP **server** from scratch (only the config entry is T6).
- Other harnesses (Cursor, Gemini, Copilot).
- Rewriting the existing ~30-skill catalog to a new template.
- Publishing a plugin marketplace listing.

## Content map

| Topic | File | Read when |
|---|---|---|
| T1 skill pack | [t01-skill.md](references/t01-skill.md) | Creating, changing, disabling, or deleting a skill |
| Live official docs | [lookup.md](references/lookup.md) | Before treating local pack text as current law |
| Evidence labels | [evidence.md](references/evidence.md) | Citing a practice as a norm |
| Host disable matrix + gate | [lifecycle.md](references/lifecycle.md) | Turning a skill off on a host, or checking the create gate |
| Native creators | [native-creators.md](references/native-creators.md) | After a host tool drafts files |
| Doctrine sweep | [doctrine-sweep.md](references/doctrine-sweep.md) | Rename, delete, or change a fact other files assert |
| Type packs T2–T15 | catalog links above | That type is in play — load **one** pack |

Related: `bun run check:config` (quality floor). Predecessor directories stay as AC28 stubs until prune.
