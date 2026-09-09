---
status: approved
phase: 2.5
validation_mode: validation
test_policy: auxiliary
approved: 2026-09-08
---

# Validation oracle

## US1

- Pre: Existing Orca guides, dev, build and flow-state contract inspected.
- Post: A shared worktree, roles, DoD, DAG and reservation protocol are executable
  instructions; startup, acceptance and recovery preserve ownership.
- Structural: Valid skill metadata and resolved local references. Main entrypoint
  routes to worker instructions before any coordinator creation action.
- Smoke: Run the source validator and use the real metadata loader to discover
  the new skill. Compare documented CLI recipes with installed help.
- Cross: A timeout never transfers a reservation. An Orca completed task cannot
  satisfy a dependency before coordinator acceptance. Native policy is not consent.

## US2

- Pre: US1 accepted.
- Post: The team exception has a canonical permission owner and explicit routes
  from flow/build. The default inline path remains available.
- Structural: Check references and search active callers for contradictory
  unconditional inline, per-agent worktree and permission statements.
- Smoke: For this PR-only publication, run the portable doctor checks and the
  installed native-hook `--check --cwd`. Let the normal pre-commit run the suite.
  Run adapter integration tests with disposable homes and the new skill present.
  Report the live machine doctor separately; this release does not install a
  development branch into the user's global profiles.
- Cross: Workers cannot close HU state. Installation does not imply live hook
  activation. Existing private/global profiles and native permission settings stay
  outside this source-only change.

## US3

- Pre: User approves concrete team, models, launch count and one pilot worktree.
- Post: Observe all scenarios in the skill's pilot reference. Record commands,
  outcomes, Run/Task/Dispatch IDs and measurable consumption when available.
- Structural: Every worker has one current Dispatch and a bounded reservation.
- Smoke: Exercise real agent messages and writes, contention, deferred dependency,
  failed evidence, quiescent validation, interruption and resumed questions.
- Cross: Preserve all work; release only owned settled terminals. Claude and Codex
  must pass; Grok remains explicitly unverified if its capability probe cannot run.

Static checks cannot close US3. The 2026-09-09 publication plan authorizes Claude
sonnet and Codex gpt-5.6-luna with medium effort, plus one fresh Claude sonnet
medium reviewer. Reuse compatible idle terminals, at most two simultaneous
collaborators, and one in-scope correction per task. It also authorizes commit,
push and PR creation, but not PR merge or global installation.
