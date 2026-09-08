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

## Garbage collection policy

Directories with `status: draft` and no updates for **>30 days** may be purged manually. There is no auto-purge. Before deleting: verify no other feature depends on this one via `Grep` in `.claude/plans/`.

## Closed (still in this directory)

`_archive/` is gitignored — moving a closed plan there drops it from git.
Closed numbered features stay here and are listed so `plans/` is not mistaken
for in-flight work.

| Dir | Closed | Verdict |
|---|---|---|
| `024-poneglyph-style-review` | 2026-06-23 | APPROVED |
| `025-flow-backhalf-gate` | 2026-06-30 | APPROVED |
| `026-opus48-fable-uplift` | 2026-07-07 | APPROVED_WITH_WARNINGS |
| `027-roi-fixes-model-advisor` | 2026-07-07 | APPROVED |
| `028-p2-backlog-closeout` | 2026-07-08 | APPROVED_WITH_WARNINGS |
| `029-workflow-uplift` | 2026-08-18 | APPROVED_WITH_WARNINGS (retro ratified) |

In-flight = `state.json` with `feature_closed: false`. Check with `bun .claude/scripts/flow-state.ts status`.

**Plan-mode artefacts** (dev loop + drillme, not a `/flow` feature — no `state.json`): `032-polish-pass/` holds `plan.md` (decisions, work packages, results per WP), `diet-ledger.md` (skill diet measurements), `activation/` (probe evidence) plus the independent `review.md` / `validation.md`; `033-headless-cheap-tier/` holds the plan and results of the headless-model guard (2026-09-03). Same numbering sequence as features so nothing collides.

## Archived plans (`_archive/`) — reading rule

Closed features with no live references move to `_archive/` (gitignored — preserved on disk, out of git and out of fresh clones). As of 2026-06-24 `_archive/` has **zero functional dependents**: nothing in `.claude/` reads a file from it. (The one real dependency — html-report's smoke-test input — was relocated to `skills/html-report/examples/sample-audit-report.md`; the rest were already-dead pointers, now fixed. Only historical prose in retros/decision-notes cites archived plans *by name*, which degrades-not-breaks.)

**Reading rule**: treat `_archive/` as historical. **Exclude it from exploratory `Grep`/`Glob`** (`grep … | grep -v _archive`, as `doctrine-sweep` already does). Read a file under `_archive/` only when (a) an explicit reference points at a concrete file there, or (b) the user asks for provenance/archaeology. This is a **soft** convention: gitignore keeps `_archive/` out of git and out of context, but does NOT block `Read`/`Grep`. The only residual risk is accidentally surfacing stale info — low-impact now that nothing functional lives there, so a soft rule is sufficient (a hard PreToolUse block would be over-engineering and would also break legitimate by-reference reads).

**Why not delete `_archive/` outright?** Gitignored → ~0 recurring token cost (not in clones, not in context). Deleting saves nothing and loses the decision trail → net-negative. Rationale: always-loaded content costs every turn, on-demand content costs once (Cmd IX).

## Template override (project-local)

Templates in this directory are global defaults (via `~/.claude/` symlink). A project-local override takes precedence:

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
