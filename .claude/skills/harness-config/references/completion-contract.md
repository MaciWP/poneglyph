# Skill completion and grading contract

Poneglyph authoring convention, adopted 2026-09-22. This is not an Agent Skills
vendor requirement or evidence that a model follows a prompt.

## Authoring

Keep `## Definition of Done` and `## How You're Graded` before the procedure in
each core `SKILL.md`. Each section needs concrete prose. Preserve the three
template flavors and existing activation settings. Replace equivalent completion
instructions instead of copying a second checklist. Keep detailed mode criteria
in the mode's existing reference and name that reference from the entrypoint.

- **Stable procedure:** specify its output, required evidence and local return condition directly.
- **Variable task:** require the agent to reuse the caller's agreed criteria; missing outcomes and evidence are proposed with a default and waited on before execution (CLAUDE.md §The dev loop).
- **Mixed skill:** keep stable requirements and bind only the variable criteria for the selected mode.

Do not add a frontmatter field to classify these cases. A skill can have several
modes. Put resolved criteria in the existing plan/task or a short inline PLAN;
do not create a new ledger. Ask only for a missing DoD or an open material decision.

## Runtime meaning

The DoD defines verified completion of the agreed scope, not a time or token cap.
Include required delivery and closure work. Completing a skill returns control
to its caller; the caller still owns the task and any later lifecycle gates.
An assessment can finish with a negative verdict. A failed implementation check
cannot become a successful implementation result.

Reuse valid evidence for unchanged inputs. Once all applicable criteria hold,
deliver and stop. A changed input, new failure, invalidated evidence or explicit
scope change can reopen work. Return to PLAN when an assumption changes. Never
lower criteria retrospectively to fit the output or skip a mandatory check to
save resources. Report blockers and follow the existing recovery protocol.

Graded names observable outcomes and behaviors to favor during work. Give
task-specific quality priorities when the task needs them. Correctness, safety,
truthful evidence and authorized scope are requirements. Efficiency means avoiding
unnecessary work while satisfying them. Extra code, sources, questions, findings,
lessons, praise and tool calls do not earn credit by volume.

Keep any existing domain rubric; do not add another numerical score. Do not
print a self-grade unless requested. Do not run an extra improvement loop after
the DoD is met. Fabricated evidence or unauthorized actions require honest
reporting and the applicable recovery; a normal failing test during development
is a repair signal, not a reason to abandon the workflow.

## Examples

| Invocation | Definition of Done | How You're Graded |
|---|---|---|
| `pr-comments` on supplied findings | Deliver actionable Conventional Comments tied to the reviewed lines; publish only if authorized | Accurate, useful feedback; zero praise is valid without a grounded positive finding |
| `deep-research` comparing storage choices | Before research, resolve the workload, constraints and decision questions; return supported answers and trade-offs | Evidence relevant to that workload, explicit uncertainty, a usable recommendation; no source quota |
| `dev-workflow` repairing a filter | Reuse the requested filter behavior and project checks; verify the failing case and affected consumers, report residual risk and finish LEARN | Correct behavior, reuse and minimal scope; no new UI features to improve a grade |

## Handoff and resume

Carry references to the current goal, DoD, quality priorities, completed work,
checked inputs, observed results, blockers and next pending action in the existing
handoff or resume note. Do not copy entire transcripts or create another state
store. Recheck input validity before reusing evidence. A completed task must not
restart because a session resumed. A worker report does not prove acceptance.

## Acceptance scenarios

These are behavioral oracles for review or authorized trials, not automated model
results. Static section checks cannot prove these behaviors or token savings.

| Scenario | Expected behavior | Failure signal |
|---|---|---|
| All criteria and required checks pass | Deliver and return to the caller | Extra research, polishing or unchanged green checks |
| A required check fails or cannot run | Repair within scope or report the blocker | A success claim or silently omitted check |
| The task has variable scope | Propose missing outcomes and evidence, then wait before execution | Execute first, invent acceptance later |
| The plan already defines acceptance | Reuse the plan and bind the selected mode | Reword criteria into a conflicting second contract |
| Resume with completed work and valid evidence | Continue the next pending action only | Restart accepted work or claim unchecked results |
| A review finds no issue or a retro has no lesson | Return an honest empty result | Invent findings, praise or lessons for a quota |
| Verification finishes inside a development task | Return to the caller for remaining closure work | End the whole task before required delivery or LEARN |
| The input changes after a passing check | Recheck affected criteria | Reuse stale evidence or rerun unrelated checks |

## Validation and provenance

`check:config` checks the two non-empty sections in core skill entrypoints outside
code examples and comments. It does not score the text, check model adherence or
apply this Poneglyph convention to addons, commands or generated entrypoints.
Run the existing template and catalog tests. Model trials remain subject to the
project's agent/model authorization rules; never launch them as an implicit check.

The [Disler task prompt](https://github.com/disler/self-compact-pi-agent/blob/main/prompts/end_draft_plan.md)
uses explicit completion criteria and grading instructions. Its experiment-specific
directory isolation rules are not general Poneglyph rules; preserve reuse-first
research and existing authorization boundaries. The
[compaction prompt](https://github.com/disler/self-compact-pi-agent/blob/main/apps/self-compact/.pi/self-compact/USER_PROMPT_COMPACTION_MESSAGE.md)
informs the continuity note, without introducing a compactor or new hooks.

| Date | Decision | Basis |
|---|---|---|
| 2026-09-22 | Migrate the 24 core skills and three templates to an explicit DoD and Graded contract | User-approved plan: stop at verified completion; reward useful outcomes; resolve variable task criteria before execution |
| 2026-09-22 | Narrow historical D12: avoid unsolicited catalog rewrites; allow this explicitly scoped migration | User requested the existing skills and templates together; names, activation and host adapters remain stable |
| 2026-09-22 | Rebaseline the required on-demand contracts without weakening the zero-growth ratchet | The 24 SKILL.md files grow from 219,829 to 235,948 LF-normalized UTF-8 bytes (+16,119; `git cat-file` at `13c3c29` and `6c05910`). The Claude always-loaded source estimate falls from 39,311 to 39,302 bytes. These are source sizes, not measured tokens, savings or model adherence. |
