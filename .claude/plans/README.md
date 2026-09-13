# Plans directory convention

`.claude/plans/` stores persistent artefacts from the 5-phase workflow. Each feature occupies one directory; templates live in `templates/`.

## Naming convention

```
.claude/plans/{NNN}-{slug}/
```

- `NNN`: 3-digit sequential integer, zero-padded (001, 002, …). Next free number — no gaps.
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
| 2 | `tasks/` directory containing `index.md` (DAG + summary) + one `US{N}.md` per story | tech-plan |
| 2.5 | `tests.md` (code) **or** `validations.md` (markdown/skills/docs) — chosen per HU based on whether files are executable | tdd-design |
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

## Closed features — what stays in git

Closing a feature keeps only the durable record in this directory and moves the
working set out of git (rule decided 2026-09-09):

| Plan state | In git | In `_archive/{NNN}-{slug}/` (gitignored, machine-local) |
|---|---|---|
| Open (`state.json` → `feature_closed: false`) | Everything — the working set must travel between machines and worktrees | — |
| Closed (`close-feature` done, retro ratified) | `spec.md` (definition) + `retro.md` (outcome, lessons, verdict) | `tasks/`, `tests.md`, `validations.md`, `state.json`, `review.md`, baselines, JSON evidence, research notes |
| Plan-mode artefact (no `state.json`) | `plan.md` (decisions + results) | everything else |

Exception: a file that a tracked script or skill still reads stays in git and is
named in the table below (today only `032-polish-pass/activation/*.json`).

Why: this repository is public and the working set is scratch — it exposes
detail without adding context. The industry keeps the short durable record in
the repo (ADRs, Kiro/spec-kit specs) and the working plan outside it (Claude
Code and Cursor write plans to the home directory by default). `spec.md` +
`retro.md` already carry definition, outcome and lessons; no extra summary
document is needed.

The move is an authorized action at closure (`retro` Step 13d), never
automatic. A closed plan is not repaired with `sync-artifacts`; reopening
restores its working set from `_archive/` first.

| Dir | Closed | Verdict | Record in git |
|---|---|---|---|
| `024-poneglyph-style-review` | 2026-06-23 | APPROVED | `spec.md`, `retro.md` |
| `025-flow-backhalf-gate` | 2026-06-30 | APPROVED | `spec.md`, `retro.md` |
| `026-opus48-fable-uplift` | 2026-07-07 | APPROVED_WITH_WARNINGS | `spec.md`, `retro.md` |
| `027-roi-fixes-model-advisor` | 2026-07-07 | APPROVED | `spec.md`, `retro.md` |
| `028-p2-backlog-closeout` | 2026-07-08 | APPROVED_WITH_WARNINGS | `spec.md`, `retro.md` |
| `029-workflow-uplift` | 2026-08-18 | APPROVED_WITH_WARNINGS (retro ratified) | `spec.md`, `retro.md` |
| `032-polish-pass` | 2026-09-03 | plan-mode | `plan.md` + `activation/*.json` (read by `docs/component-audit-2026-09-05/review-main-802d795.ts`) |
| `033-headless-cheap-tier` | 2026-09-03 | plan-mode | `plan.md` |
| `034-archify-integration` | 2026-09-08 | plan-mode | `plan.md` |

Plan-mode artefacts (dev loop + drillme, not a `/flow` feature) share the
numbering sequence so nothing collides. In-flight = `state.json` with
`feature_closed: false`. Check with `bun .claude/scripts/flow-state.ts status`.

## Other projects

`/flow` writes to `<project>/.claude/plans/`. `scope` settles the git policy
once per project (Initial detection, step 0) and never writes it silently:

| Project type | Policy | Mechanism |
|---|---|---|
| Personal | Same rule as this repo: open = everything, closed = `spec.md` + `retro.md` | `.claude/plans/.gitignore` containing `_archive/` |
| Company / shared | Nothing from `.claude/plans/` enters the shared repo; the durable outcome goes to the team's system of record (ticket, wiki) | The file `git rev-parse --git-path info/exclude` returns gets `.claude/plans/` — machine-local, zero footprint in the repo, shared by every worktree of that checkout (in a linked worktree `.git` is a file, so never hardcode `.git/info/exclude`) |

Detection: `git check-ignore -q .claude/plans` exits 0 → company policy set;
`git check-ignore -q .claude/plans/_archive` exits 0 → personal policy set (this
repo's root `.gitignore` already does it); neither → ask.
Under the company policy plans do not travel between machines, the same as
Claude Code's own `~/.claude/plans/`; accepted trade-off.

## Archived plans (`_archive/`) — reading rule

`_archive/{NNN}-{slug}/` holds the working set of every closed feature and the
whole directory of abandoned ones (gitignored — preserved on disk, out of git
and out of fresh clones). Nothing functional in `.claude/` reads from it; only
historical prose cites archived files by name, which degrades-not-breaks.

**Reading rule**: treat `_archive/` as historical. **Exclude it from exploratory `Grep`/`Glob`** (`grep … | grep -v _archive`, as `doctrine-sweep` already does). Read a file under `_archive/` only when (a) an explicit reference points at a concrete file there, or (b) the user asks for provenance/archaeology. This is a **soft** convention: gitignore keeps `_archive/` out of git and out of context, but does NOT block `Read`/`Grep`. The only residual risk is accidentally surfacing stale info — low-impact now that nothing functional lives there, so a soft rule is sufficient (a hard PreToolUse block would be over-engineering and would also break legitimate by-reference reads).

**Why not delete `_archive/` outright?** Gitignored → ~0 recurring token cost (not in clones, not in context). Deleting saves nothing and loses the decision trail → net-negative. Rationale: always-loaded content costs every turn, on-demand content costs once (Cmd IX).

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
