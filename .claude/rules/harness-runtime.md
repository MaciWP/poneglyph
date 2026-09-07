# Shared runtime contract

The shared resource root is `<Poneglyph source root>/.claude` in Codex, and
`~/.claude/` in Claude and Grok. Codex prints its source root in generated
AGENTS.md. Read `rules/skill-routing.md` and
`rules/error-recovery.md` there when starting work. Keep project plans, source,
and learned output in the current project; never create them inside installed skills.

Resolve `${CLAUDE_SKILL_DIR}` to the directory of the loaded SKILL.md on every
host. Resolve its relative resources there. Resolve Poneglyph `.claude/scripts/`
and `.claude/docs/` references from the installation. Check project overrides first.

`Skill(x)` means load the installed skill. `AskUserQuestion` means the host's
question tool or a direct question. `Workflow` requires Claude's actual contract;
otherwise execute the same phases inline. Native tools and permissions remain
authoritative. A skill cannot provide a missing tool or authorize an agent launch.
If a named skill is absent from the host catalog, inspect enabled installed
plugins for its SKILL.md. Verify its path and enabled state before reading it.

Commands share their source. Claude/Grok use `/name`; Codex uses `$name`.
Treat `$ARGUMENTS` as the supplied arguments when the host does not expand it.

Before completing code changes in a Git worktree, run the project's checks and
`bun <installed-hooks>/native-hook.ts --check --cwd <project>`; quote paths.
This reuses the existing secret heuristic. It is not a full privacy audit.
Grok discards passive hook output, so apply routing and verification explicitly.
Codex hook registration needs native trust before execution. Report missing
capabilities and unverified activation; never count static installation as model quality.
