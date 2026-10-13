# Plans directory convention

`.claude/plans/` stores persistent artefacts from the 5-phase workflow. Each feature occupies one directory; templates live in `templates/`.

## Naming convention

```
.claude/plans/{NNN}-{slug}/
```

- `NNN`: 3-digit sequential integer, zero-padded (001, 002, …): the next free number, with no gaps.
- `slug`: kebab-case description of the feature (e.g. `auth-refactor`, `onboarding-flow`).
- If two features share the same slug, NNN differentiates them (`002-foo`, `003-foo`).

## Lifecycle

Flow always uses the same six phase skills. Depth scales with the task; justified
skips are announced and recorded. New plans use mode: full; historical mode
values remain readable. The [flow contract](../docs/flow-contract.md) owns commands,
verification and artifact recovery.

## Files by phase

| Phase | File / Dir | Skill |
|---|---|---|
| 1 | `spec.md` | scope |
| 2 | `tasks/` directory containing `index.md` (DAG + summary) + one `US{N}.md` per story | plan |
| 2.5 | `tests.md` (code) **or** `validations.md` (markdown/skills/docs), chosen per HU based on whether files are executable | test-plan |
| 3 | Code changes; records verified closure in `state.json` | build |
| 4 | `review.md` | critic |
| 5 | `retro.md` | retro |

> **`tasks/` is a directory, not a single `tasks.md` file.** This was a deliberate choice: one file per story keeps each HU under ~200 lines and parseable in isolation. The legacy monolithic `tasks.md` is not supported.

## Status transitions

Documents start as draft. Recorded human approval projects approved status.
A verified HU closure projects closed status; reopening invalidates review/retro
and restores approved task status. Feature closure requires verified HUs, an
approving review and resolved retro. BLOCKED is a lifecycle verdict, not an
implicit approval to continue. The helper owns these transitions.

A feature with every HU closed and an approving review, whose retro is written
but not yet ratified, waits at `retro_status: pending`. That is a waiting state,
not a stalled one, and only a human leaves it:
`bun .claude/scripts/flow-state.ts retro-status approved`, or
`retro-status "skipped — <justificación ≥10 chars>"`. It is the last gate before
`close-feature`, which refuses to run while the retro is still pending.

## Garbage collection policy

Directories with `status: draft` and no updates for **>30 days** may be purged manually. There is no auto-purge. Before deleting: verify no other feature depends on this one via `Grep` in `.claude/plans/`.

## Closed features

Closing a feature removes its directory from the working tree with `git rm -r`.
Git history is the record: `git log --all -- .claude/plans/{NNN}-{slug}` finds it and
`git checkout <hash> -- .claude/plans/{NNN}-{slug}` restores it to reopen. What the
feature taught goes out before the removal, through the retro's promotions (rules,
skills, memory, lessons), so nothing live depends on the plan directory.

The removal is an authorized action at closure (`flow` retro phase Step 12d), never
automatic. Only open plans and parked stubs stay in `.claude/plans/`. Plan-mode
artefacts (dev loop + drillme-clarify, not a `/flow-lifecycle` feature) share the
numbering sequence so nothing collides; take the next number after the highest one in
`git log --all --name-only -- .claude/plans`. In-flight = `state.json` with
`feature_closed: false`. Check with `bun .claude/scripts/flow-state.ts status`.

## Other projects

`/flow-lifecycle` writes to `<project>/.claude/plans/`. The `flow` scope phase settles the git policy
once per project (Initial detection, step 0) and never writes it silently:

| Project type | Policy | Mechanism |
|---|---|---|
| Personal | Same rule as this repo: open plans are tracked, a closed plan leaves the tree | Plans are committed like any other file |
| Company / shared | Nothing from `.claude/plans/` enters the shared repo; the durable outcome goes to the team's system of record (ticket, wiki) | The file `git rev-parse --git-path info/exclude` returns gets `.claude/plans/`, machine-local, zero footprint in the repo, shared by every worktree of that checkout (in a linked worktree `.git` is a file, so never hardcode `.git/info/exclude`) |

Detection: `git check-ignore -q .claude/plans` exits 0 → company policy set;
`git log -1 --format=%h -- .claude/plans` prints a hash → personal policy set;
neither → ask. Under the company policy plans do not travel between machines, the
same as Claude Code's own `~/.claude/plans/`; accepted trade-off.

## Template override (project-local)

Templates in this directory are the global defaults: `sync-claude` links
`plans/templates` to `~/.claude/plans/templates` (the rest of `plans/` is never
synced). A project-local override takes precedence:

1. Skill checks `.claude/plans/templates/<name>.template.md` (project-local).
2. If not found, falls back to the global `~/.claude/plans/templates/<name>.template.md`.

Override only what differs; keep the rest from the global template to stay consistent.

## Template reference

| Template | Phase | Purpose |
|---|---|---|
| [spec.template.md](templates/spec.template.md) | 1 | Feature scope definition |
| [tasks.template.md](templates/tasks.template.md) | 2 | Single US{N}.md story |
| [tasks-index.template.md](templates/tasks-index.template.md) | 2 | Summary index of all stories |
| [tests.template.md](templates/tests.template.md) | 2.5 | TDD test specs (executable code) |
| [validations.template.md](templates/validations.template.md) | 2.5 | Validation specs (markdown/docs/configs) |
| [review.template.md](templates/review.template.md) | 4 | Critic review checklist + findings |
| [retro.template.md](templates/retro.template.md) | 5 | Retrospective + promotions |
| [state.template.json](templates/state.template.json) | all (full mode) | Tracking schema |
