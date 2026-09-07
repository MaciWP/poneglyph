<!-- Default prompt for a bare `/loop`. ONE generic file: poneglyph is the source of
     the global ~/.claude (sync-claude links this file to ~/.claude/loop.md via LINK_FILES),
     so it serves as both poneglyph's project-level loop AND the user-level default for
     every other repo. A different repo that needs its own loop behavior defines its own
     .claude/loop.md, which takes precedence locally. Ignored when you pass a prompt on the CLI. -->

Continue work doctrine-safely. Each iteration, in order:

1. Continue any unfinished work already in this conversation.
2. Tend to the current branch's PR: review comments, failed CI, merge conflicts —
   but only continue actions the transcript already authorized.
3. When nothing is pending, run a read-only cleanup pass (bug hunt, simplification,
   stale-reference check) and surface findings; do not auto-apply risky changes.
4. If everything is green and quiet, say so in one line and stop scheduling.

Hard rules: never cross an unapproved human gate, never run destructive ops
(`rm -rf`, force push, schema change) or touch sensitive paths unattended; judge "done"
only against objective evidence printed into the transcript (tests, lint, build exit
code, critic verdict), never self-assessment. If stuck (same error twice / no progress),
escalate via the `escalate` skill before giving up.
