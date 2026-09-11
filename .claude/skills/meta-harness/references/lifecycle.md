---
parent: meta-harness
name: lifecycle
description: Five verbs for native config plus the impact step that runs before mutate. Impact is not a sixth verb.
---

# Lifecycle

Name the verb **before** acting. Impact is a step, not a sixth verb (D16).

| Verb | Does | Does not |
|---|---|---|
| Consult | Fetch live official docs; report unchanged / changed / unreachable | Edit files |
| Create | Write a valid artefact (portable default) | Skip `bun run check:config` |
| Modify | Change the asked behaviour; keep the rest | Wipe with the default template |
| Disable | Turn off where the host supports it | Fake disable with a delete |
| Delete | Remove source + leftover name registries | Claim runtime is gone without checking |

## Impact (before modify / disable / delete / rename)

1. Grep consumers of the name, path, and trigger phrases.
2. Read [doctrine-sweep.md](doctrine-sweep.md) if other files assert the old fact.
3. Close honestly: live refs in these roots vs installed / running state **unverified**.

## Disable is not delete

| Host | Disable (skill stays on disk) | Effective when |
|---|---|---|
| Claude Code | `skillOverrides.<name>: "off"` in settings (or `"user-invocable-only"` to hide from the model). Frontmatter `disable-model-invocation: true` only blocks auto-invoke. `disableBundledSkills` is bundled-only — it does **not** disable project skills. | Live for `SKILL.md` text; settings need the session to pick them up (`/skills` writes local settings) |
| Codex | `[[skills.config]]` with `path` + `enabled = false` in `~/.codex/config.toml` | Restart Codex |
| Grok Build | `[skills] disabled = ["name"]` in `~/.grok/config.toml`. `[skills] ignore` hides the path entirely (not the same as disable). | Next session / `grok inspect` shows `[disabled]` |

Delete = remove the skill directory. Then grep leftover names in settings, `[[skills.config]]`, `[skills] disabled`, plugins. Do not report "gone" until that grep is clean **or** you state what remains unverified.

## Create / modify gate

Every skill that enters this repo's snapshot must pass `bun run check:config` (AC15). Instantiated templates must pass without hand patches (AC16). Native creator success is not the gate — see [native-creators.md](native-creators.md).
