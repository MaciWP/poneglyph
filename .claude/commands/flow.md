---
description: Guide a feature from scope to verified closure through research, atomic tasks, test-first execution, critique and retro.
argument-hint: "<task> | --resume <slug>"
allowed-tools: Read, Edit, Write, Bash, Glob, Grep, Skill, Agent, AskUserQuestion
---

# /flow — a reliable feature lifecycle

Use the six phase skills below. Keep the feature in the current project's
`.claude/plans/{NNN}-{slug}/`. `state.json` records progress and decisions;
the [flow contract](../docs/flow-contract.md) defines the helper and recovery.
`dev` owns the development loop; `flow` coordinates it across a whole feature.

## Start or resume

- New work: resolve the request and choose the next `NNN` once. Create the plan
  from [state.template.json](../plans/templates/state.template.json). If another
  feature is active, resolve which one the user means before starting a second.
- `--resume <slug>`: read its state and artifacts. Continue from recorded progress;
  do not ask again for an approval that still covers this work.
- Missing/corrupt state: recover work separately from decisions. Artifact existence
  does not prove approval. Recover the actual decision or leave it unknown.
- Run all phases. Scale depth to the real complexity found during investigation.
  Announce and record a justified skip when a phase does not apply. Legacy
  `--minimal|--standard|--full` flags do not select another pipeline.

## Six steps

1. **Scope — `scope`.** Define the problem, required outcomes, boundaries and risks
   in `spec.md`. Resolve consequential questions. Record phase 1 complete, then
   the user's scope approval at gate 1→2. Without approval, keep scope open.
2. **Research and plan — `tech-plan`.** Inspect existing code and relevant primary
   documentation. Reuse existing mechanisms. Split the work into verifiable HUs,
   with acceptance criteria and real dependencies. Create draft tasks and record
   phase 2 complete. A sequential DAG is valid; never invent parallel work.
3. **Design checks — `tdd-design`.** Define expected behavior before implementation.
   Behavior changes use TDD by default; documentation uses validation checks.
   Justify exceptions before execution. Record phase 2.5 complete and present
   tasks plus oracle together. Gate 2→3 records one actual user decision and
   updates their approval status. A rejected package returns to planning.
4. **Build — `build`.** Select a pending HU whose dependencies are complete.
   For TDD: observe the relevant test fail, implement, then observe it pass.
   Include documentation updates before final verification. Run `verify` and
   close the HU only with its verification record. Failures leave it pending.
5. **Critique — `critic`.** Check the assembled result against every requirement:
   requirement → executed check → observed outcome. Exercise the real flow when
   runtime exists. Passing unit tests alone does not establish the feature's
   success. Record the supported verdict. For an in-scope defect, reopen the
   affected HUs, fix them and repeat verification and critique. Respect existing
   retry limits. Escalate changed scope, unresolved questions or a real blocker;
   `BLOCKED` requires an authorized reopen.
6. **Retro and close — `retro`.** Capture useful lessons and propose any promotions
   or scope deltas for ratification. Record the resolved retro, or an announced
   justified skip. Close the feature only after verified HUs and an approving
   review. Repair stale documents from state; never mark unfinished work complete.

## Controls at each boundary

Record the phase skill used, the previous artifact/check, and the transition with
the helper's `boundary-check` command. Confirm the human decision at gates 1→2
and 2→3. At planning/build entry, apply `skill-advisor` and the `drillme` gap sweep;
zero unresolved gaps means zero questions. Invoke the phase skill explicitly;
do not rely on automatic activation or reconstruct its instructions from memory.

Use the helper for transitions, including approval, closure, review, reopening
and retro status. `sync-artifacts` repairs document projections without granting
permission. The [contract](../docs/flow-contract.md) contains the commands and
record formats. Do not close work with failed or unexecuted required checks.

## Hosts and optional workflows

Resolve shared resources through the installed `rules/harness-runtime.md`.
`Skill(x)` means invoke the skill or read its installed instructions. Use the
host's real search and question tools. Codex's generated `$flow` reads this same
source. Claude metadata does not provide another host with Claude APIs.

Build runs inline. Agents require the applicable user permission and explicit
model choice. Task decomposition never grants that permission. If an independent
reviewer cannot run, critique inline and disclose that limitation.

With explicit opt-in, at least four independent HUs may use Claude's saved
`flow-build` (build and checks) or `flow-cycle` (also proposed review) workflow.
Both take `slug`; `flow-cycle` also takes `only` and `level`. Serialize file
collisions. Validate returned evidence before recording any closure or verdict.
Use these only where the real Claude Workflow contract exists; otherwise keep
the same phases inline. Workflows never approve state or authorize publication.

## Report and retain

Report phase, completed/pending HUs, verdict, verification, blockers and next
action. Use `status` to find incomplete lifecycles. A report or retro document
alone does not mean completion. Keep promotions and justified skips visible.
Git publication follows its own authorization; closure does not imply a commit.
Archive closed/abandoned plans under `_archive/` only through an authorized move;
keep templates and live references available.
