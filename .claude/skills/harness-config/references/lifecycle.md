---
parent: harness-config
name: lifecycle
description: Where each host turns a skill off without deleting it, and the check:config gate for create and modify. The verb table and the impact step live in SKILL.md.
---

# Lifecycle

The five verbs and the impact step have one source: the **Verbs** section of
[SKILL.md](../SKILL.md). Name the verb there first. This file carries what that table points
at — where each host disables, and the gate every artefact passes.

## Disable is not delete

| Host | Disable (skill stays on disk) | Effective when |
|---|---|---|
| Claude Code | `skillOverrides.<name>: "off"` in settings (or `"user-invocable-only"` to hide from the model). Frontmatter `disable-model-invocation: true` blocks auto-invoke AND takes the description out of the model context (`/name` still works); `user-invocable: false` alone keeps the listing. `disableBundledSkills` is bundled-only — it does **not** disable project skills. | Live for `SKILL.md` text; settings need the session to pick them up (`/skills` writes local settings) |
| Codex | `[[skills.config]]` with `path` + `enabled = false` in `~/.codex/config.toml` | Restart Codex |
| Grok Build | `[skills] disabled = ["name"]` in `~/.grok/config.toml`. `[skills] ignore` hides the path entirely (not the same as disable). | Next session / `grok inspect` shows `[disabled]` |

Hiding a skill from the model is not free: a skill that `CLAUDE.md` or `.claude/rules/` orders
the model to invoke turns into a dead reference under `disable-model-invocation: true` or
`skillOverrides: "user-invocable-only"`. Use `"name-only"` when the trigger already lives in
always-loaded law and only the description cost has to go.

Delete = remove the skill directory. Then grep leftover names in settings, `[[skills.config]]`, `[skills] disabled`, plugins. Do not report "gone" until that grep is clean **or** you state what remains unverified.

## Create / modify gate

Every skill that enters this repo's snapshot must pass `bun run check:config` (AC15). Instantiated templates must pass without hand patches (AC16). Native creator success is not the gate — see [native-creators.md](native-creators.md).
