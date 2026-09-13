---
parent: meta-harness
name: native-creators
description: Host skill/workflow creators draft files only. meta-harness owns lookup, impact, check:config, and the Poneglyph layer (AC26).
---

# Native creators — draft only (AC26)

| Host | Tool | Owns |
|---|---|---|
| Claude Code | `skill-creator` (bundled / plugin) | Draft files |
| Codex | `$skill-creator` (ChatGPT Work: `@skill-creator`) | Draft files |
| Grok Build | `/create-skill` · `/create-workflow` | Draft files |

A green native tool is **not** the gate. After the draft, this skill still owns:

1. **Lookup** — live official docs for the type and host ([lookup.md](lookup.md)).
2. **Impact** — grep consumers before modify / disable / delete (§Impact in [SKILL.md](../SKILL.md)).
3. **`bun run check:config`** — source floor in this repo.
4. **Poneglyph layer** — this-repo activation copy (es-ES `description` / `when_to_use`, `metadata.keywords`, ≥3 evals). Portable nucleus only when authoring for a foreign repo (AC13).

## Do not

- Skip lookup because the creator wrote a file.
- Treat creator output as already gate-clean (placeholders, extra host keys, English-only description in this repo).
- Let the creator replace `meta-harness` as the entry for consult / disable / delete.
- Add a companion `/meta-harness` command or workflow (D7).
