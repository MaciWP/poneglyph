# Coordination — flow single skill

## Objective

Merge the six `/flow-lifecycle` phase skills into one skill `flow` (shared `SKILL.md` + one
reference per phase), delete the six, and repoint every live reference in the repository.
Retired (deleted) names: `flow-scope`, `flow-plan`, `flow-test-plan`, `flow-build`,
`flow-review`, `flow-retro`.

| Field | Value |
|---|---|
| Project / worktree | `github:maciwp/poneglyph` · `D:/PYTHON/poneglyph-flow-single-skill` · branch `refactor/flow-single-skill` · base `main` @ `068b9cb` |
| Orca worktree id | `38dfc722-d072-43f4-b2ab-d5ccb0a0b7f0::D:/PYTHON/poneglyph-flow-single-skill` |
| Input changes selected | none from the source tree (its three dirty files are unrelated) |
| Installed skill paths | `~/.claude/skills/orca-team`, `~/.claude/skills/dev-workflow`, `~/.claude/skills/drillme-clarify`; Orca CLI 1.4.205 with embedded `orca-cli` / `orchestration` guides |
| Authorization reference | Oriol, 2026-09-17, AskUserQuestion rounds 1-2 and the deletion gate: shape = skill `flow` router + references · content = dedupe + trim · delete the six now and repoint 45 references · execution = Lead inline + 1 reference worker (Claude Sonnet) + 1 reviewer (Codex default model) |
| Concurrency / launches | 1 worker + 1 reviewer, sequential; 1 relaunch each; no worker may spawn agents |
| Permissions | Coordinator: everything. Worker: writes only its reserved files. Reviewer: read-only. Worker ↔ coordinator messages only. No commits, no publication, no branch mutation, no worktree removal |

## Task map

| Task | Role | Owner | Depends on | DoD |
|---|---|---|---|---|
| T1 Write `skills/flow/` and delete the six skills | Coordinator (inline) | Lead | — | `bun test ./.claude/skills/flow` green; six directories removed; budget snapshot updated |
| T2 Repoint code, tests, canonical docs (`commands/flow-lifecycle.md`, hook, rank, probes, evals, settings, `docs/flow-contract.md`, `docs/auxiliary-skills-matrix.md`, `rules/`, drillme bank headings) | Coordinator (inline) | Lead | T1 | Touched tests green |
| T3 Repoint live prose in the remaining files (list below) | Collaborator | Orca worker (Claude Sonnet) | T1 accepted | `live-references.test.ts` green; report of remaining legitimate history mentions |
| T4 Independent review of the assembled diff | Reviewer | Orca worker (Codex, default model), read-only | T2 + T3 accepted, writers quiesced | Findings against the DoD with file:line; no edits |
| T5 Assembled checks and acceptance | Coordinator | Lead | T4 | `bun test ./.claude/` green; `bun run budget` within snapshot; `native-hook.ts --check` clean; residual risk declared |

## Reservations

| Resource | Owner | Phase | Evidence |
|---|---|---|---|
| `.claude/skills/flow/**` (except the two files below), `.claude/commands/flow-lifecycle.md`, `.claude/hooks/**`, `.claude/scripts/**`, `.claude/evals/**`, `.claude/settings.global.json`, `.claude/docs/flow-contract.md`, `.claude/docs/auxiliary-skills-matrix.md`, `.claude/rules/**`, `.claude/workflows/**`, `.claude/coordination/**` | Lead (T1, T2, T5) | writing | — |
| T3 file set: `.claude/skills/flow/references/plan/04-classification-waves.md`, `.claude/skills/flow/references/plan/05-team-mode.md`, `.claude/skills/agent-routing/**`, `.claude/skills/changes-explain/**`, `.claude/skills/changes-verify/SKILL.md`, `.claude/skills/code-quality/SKILL.md`, `.claude/skills/compare-and-decide/SKILL.md`, `.claude/skills/deep-research/SKILL.md`, `.claude/skills/dev-workflow/references/02-on-request-lenses.md`, `.claude/skills/drillme-clarify/references/03-phase-questions.md`, `.claude/skills/html-report/**`, `.claude/skills/lessons-learned/SKILL.md`, `.claude/skills/orca-team/**`, `.claude/skills/pr-review/SKILL.md`, `.claude/skills/prompt-design/SKILL.md`, `.claude/skills/security-audit/SKILL.md`, `.claude/skills/task-unblock/SKILL.md`, `.claude/skills/troubleshooting/SKILL.md`, `.claude/docs/system-inventory.md`, `.claude/docs/pr3-review.md`, `.claude/docs/model-uplift-playbook.md`, `.claude/commands/expert-role.md`, `.claude/plans/README.md`, `.claude/plans/templates/tasks.template.md` | T3 worker | reserved | granted at dispatch |
| Everything else | nobody | held | out of scope |

## Shared contract decisions

- Retired name → replaced by: `flow-scope` → `flow` scope phase, `skills/flow/references/01-scope.md`; `flow-plan` → plan, `02-plan.md`; `flow-test-plan` → test-plan, `03-test-plan.md`; `flow-build` → build, `04-build.md`; `flow-review` → review, `05-review.md`; `flow-retro` → retro, `06-retro.md`. The deleted `flow-plan/references/0N-*.md` → `flow/references/plan/0N-*.md`.
- Step renumbering: scope old Step 4 → 3, old 5 → 4. Test plan old Step 1.7 → 1.5. Retro old Steps 4…14 → 3…13 (old 13a-d → 12a-d). Plan, build and review keep their numbers.
- Dated history stays as written (a decision log line, a "was X" statement, a retro lesson). Only live instructions change. `flow-build-review` is the saved Workflow's own name and is never touched.

## Acceptance log

| Task | Decision | Evidence |
|---|---|---|
| T1 | accepted (Lead) | `bun test ./.claude/skills/flow` 19/19; six directories removed with `git rm -r`; `budget.ts --update` written |
| T2 | accepted (Lead) | touched tests 438 pass after the two invariant fixes (H19 one-line rule, H53 flow line cites test-policy) |
| T3 | accepted (Lead) | `worker_done` outcome `succeeded` at 2026-09-17T20:19Z (msg `msg_1f7030f636e5`, delivery `delivery_09a1b7fdc87e` acknowledged); 32 of 34 reserved files edited, 2 needed no edit; Lead sampled 4 files (agent-routing 04, system-inventory, expert-role, orca-team coordination) — grammatical and consistent; remaining old-name hits are history (sample-audit-report, dated 2026-05-29 → added to the test's example corpus allowance). Terminal `term_fdcbf7bf…`: `worker-release` returned `state: retained, reason: user_takeover` — the terminal stays open under user ownership, not force-closed |

| T4 | accepted (Lead) | `worker_done` outcome `succeeded` at 2026-09-17T20:28Z (findings msg `msg_4cf1a58fc60e`, delivery `delivery_6b89389b700b` acknowledged; terminal released, `processAction: closed_agent_terminal`). Verdict NEEDS_CHANGES: H1 MAJOR (review Step 4 lost the `/code-review --fix` re-review rule and the `/ultrareview` user-only rule) → restored in `05-review.md`; H2 MINOR (matrix and compare-and-decide still described the cut scope perspectives) → removed; H3 MINOR (performance catalog path abbreviated) → full path; I1 MINOR pre-existing (discovery pointed to missing `docs/orchestrator/*.md`) → repointed to the project's CLAUDE.md/AGENTS.md and inventory doc. `compare-and-decide/SKILL.md` was T3's reservation; T3 had released before the Lead edited it |

| T5 | accepted (Lead) | After the T4 fixes: `bun test ./.claude/` 848 pass / 0 fail; `bun .claude/scripts/budget.ts` within snapshot (always-loaded total 39146, −797 vs the pre-merge snapshot; snapshot ratified twice: after deletion and after the rename growth); `native-hook.ts --check` passed. Residual risk: the installed `~/.claude` layer and the Codex/Grok profiles are not synced (no `sync-poneglyph` run — user decision); no headless activation probe ran for the new `flow` name |

## Resume note

All tasks accepted. The change set is uncommitted in the worktree; publication and sync are the user's call.

| Item | ID |
|---|---|
| Orca Run | `run_b7c46fdad3b8` (created 2026-09-17T20:06Z, coordinator handle `term_ae9c32b7-4216-4c62-bae2-3d2da0cb1e40`) |
| T3 Task / Dispatch | `task_b06d29d26452` (created 2026-09-17T20:07Z) / `ctx_ff95e6bf820b`, terminal `term_fdcbf7bf-c872-4972-97e5-b32d5fbbb848`, Claude effective model `sonnet`, started 2026-09-17T20:09Z |
| T4 Task / Dispatch | `task_618a7d95ddc6` / `ctx_a2a7088df896`, terminal `term_49b177b4-ce38-4fe9-8758-f9a19594ed8a`, Codex default model (no `--model` passed), started 2026-09-17T20:27Z; writers quiesced before launch (T3 released, Lead edits finished; full suite 848/848, budget snapshot ratified) |
