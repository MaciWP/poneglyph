---
parent: meta-create
name: directory-structure
description: Skill directory conventions — SKILL.md, references/, templates/, scripts/, examples/
---

# Skill Directory Structure

Read this to understand the conventions for organizing a skill's files on disk, including the optional subdirectories and when to use them.

## Standard Layout

```
.claude/skills/
├── {skill-name}/
│   ├── SKILL.md           # Required: main skill file (entry)
│   ├── references/        # Optional: deep reference bundle (recommended for > 300 lines)
│   │   ├── topic-a.md
│   │   └── topic-b.md
│   ├── reference.md       # Optional: legacy single-file detailed doc (prefer references/)
│   ├── examples.md        # Optional: usage examples (or examples/ directory)
│   ├── templates/         # Optional: scaffold templates (meta-create-* skills only)
│   │   └── {type}.md
│   └── scripts/           # Optional: helper scripts
│       └── validate.sh
```

## When to use each subdirectory

| Subdirectory | Use when |
|--------------|----------|
| `references/` | Entry SKILL.md would exceed ~300 lines — split deep content into topic-scoped files |
| `templates/` | The skill generates other artifacts (meta-create-skill, meta-create-agent) |
| `scripts/` | The skill runs helper scripts (validators, generators) |
| `examples/` | Multiple worked examples that would bloat the entry |

## The 500-Line Soft Cap

A skill's `SKILL.md` file should stay **under 500 lines** (soft cap; >500 triggers a CRITICAL benchmark violation). Aggressive target: **≤ 300 lines** for the entry, with deeper material moved to `references/`.

## Referencing files from the entry SKILL.md

Use the `${CLAUDE_SKILL_DIR}` variable (Anthropic official) to reference sibling files. This resolves at load time to the skill's directory regardless of where the skill lives:

```markdown
| Topic | File | Contents |
|---|---|---|
| Frontmatter spec | `${CLAUDE_SKILL_DIR}/references/frontmatter-spec.md` | Full field reference ... |
```

**Do not use**:
- Relative paths (`./references/foo.md`) — fragile across contexts
- Absolute paths (`/Users/.../references/foo.md`) — machine-specific
- Bare filenames (`foo.md`) — ambiguous

## Content Map format (3 columns)

The entry `SKILL.md` must include a **Content Map** table that points to every reference file with a 3-column format:

| Column | Purpose |
|--------|---------|
| **Topic** | Short human-readable label |
| **File** | `${CLAUDE_SKILL_DIR}/references/<file>.md` |
| **Contents** | 1-2 sentences describing what's inside AND when to read it |

The "when to read it" phrasing is critical — it tells the reader which trigger should make them open the reference.

This aligns with Anthropic's official skills guidance:

> *"Reference supporting files from SKILL.md so Claude knows what each file contains and when to load it."*
> — [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)

The Contents column is the "when to load it" half of that instruction. See `orchestrator-protocol/references/06-context-arch-h.md` (§Content Map Pattern) for the canonical repo-wide rule.

## Reference file frontmatter

Files under `references/` need minimal frontmatter:

```yaml
---
parent: {parent-skill-name}
name: {topic-name}
description: {1-line description}
---
```

Reference files are **not loaded as standalone skills** — no `version`, `type`, `activation`, or `for_agents` needed. They are only read on-demand from the parent's entry file.
