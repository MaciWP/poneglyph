---
name: lessons-learned
description: >-
  Consulta y amplía el registro entre proyectos de errores reales (lessons learned),
  cada uno con su evidencia y la regla que aplicar. Se lee en toda review de un diff o
  una PR y al comprobar que un fix aguanta; se amplía cuando el feedback de una review
  destapa un error que se repetiría. Úsala para "revisa la PR", "haz un repaso para
  saber si lo hemos solucionado", "¿lo hemos arreglado?", "did we fix it", "apunta esta
  lección". No es para guardar una preferencia o un dato del proyecto (la memoria).
disable-model-invocation: false
---

# lessons: cross-project lessons learned

Every entry below cost something real: a PR rejection, a silent data loss, a wasted
cycle. This is the **single home** for cross-repo lessons across every repo Oriol works
on. Company-specific knowledge belongs in an optional private addon. The core
works without that addon and must not discover or activate it automatically.

## Definition of Done

- For review, apply the relevant existing lessons to the actual change and return to the caller.
- For capture, persist only an incident-backed, reusable lesson that passes the admission rule and is not already recorded. Otherwise state that no new lesson qualifies and stop.

## Quality Bar

- Success means preventing a demonstrated repeat failure and keeping one accurate home for each lesson.
- Lesson counts and generic best-practice entries add no value. No new lesson is a valid result.

## Frontier: what lives where

| Layer | Holds | Read at |
|---|---|---|
| **This file** | Mistakes that repeat across repos or stacks: process, review hygiene, delivery discipline | On demand, before review, before "done" |
| **Optional private addon** | Company evidence, stack-specific rules and team conventions | Only after explicit machine or project opt-in |
| **memory** (`memory/*.md`) | Facts about Oriol, his preferences, project state: how to work *with him*. **Per-machine cache**: it lives under `~/.claude/projects/<path>/memory/` and does not travel between machines | Auto-injected every session |

A lesson belongs in exactly **one** layer. Anything that must survive the machine is
written here (or in `docs/`), never only in memory: four `feedback-*` memories cited
by evals and docs were lost that way and were lost that way (G9–G12 now hold them). When an entry has a memory sibling, this file points at it: no copies.

## Triggers

| Moment | Action |
|---|---|
| Before reviewing a PR/diff (`pr-review`, `flow` review phase) | Read §Lessons; every guard is a checkable item |
| Before declaring work done (`changes-verify`) | Re-check G2, G3, G4, the ones that bite at the finish line |
| Starting a HU in a configured work project (`flow` build phase) | Read the matching private skill if installed; otherwise use the applicable core lessons |
| A review (human or agent) surfaces a mistake | Append here if cross-repo; to the private addon's stack reference if stack-specific |
| `flow` retro phase Step 7 promotion, scope = cross-project | Land it here |

## Admission rule: three conditions, all mandatory

1. **Real evidence**: a concrete PR, finding or lost cycle. "Good practice" with no
   incident behind it is not a lesson; it is filler, and it dilutes the ones that matter.
2. **Not already default behavior**: if the model does it right without being told
   (tutorial material: "comments explain why, not what"): it does not enter.
3. **Cross-repo reach**: tied to one stack or company → its private reference, not the tables below. A promotion needs human privacy review; keep the detailed evidence private and link to the shared rule instead of copying it.

Entry format: a `| Lesson | Rule to apply |` row here, and its evidence (where it bit us) in `references/evidence.md`.

## Lessons: process

| Lesson | Rule to apply |
|---|---|
| **G1: Never infer a convention from a small sample** | Measure across the **whole** repo before normalizing a style. Match the majority, not your taste. Sibling: G9 (measure, don't estimate); use patterns that separate the cases before counting |
| **G2: Verify agent self-reports yourself** | After delegated work, re-run the gates over the **whole** changed set (`git diff --name-only --diff-filter=d HEAD`) and read the real diff. A report is a claim, not evidence |
| **G3: Code recovered from a stash carries old lessons** | Run the lessons pass over stash/old-branch code **before** declaring it done, not after |
| **G4: Sweep the whole unit, not the line under review** | When touching a cross-cutting category (strings, logging, error handling), sweep the entire file/feature for the same category |
| **G5: Team preference beats repo convention** | When the existing convention and the team's stated preference diverge, the **team wins**, and the old convention becomes legacy-to-migrate, not the target |
| **G6: A merge gate is never a nit** | If the check blocks merge, severity is MAJOR minimum and APPROVED is forbidden while it is red. Run the linter before the verdict, don't infer it |
| **G7: Sibling timeouts travel together** | When raising a shared timeout/budget, grep every literal timeout in the same flow and point them at the one constant; a clock left behind turns the fix into a new downstream failure |
| **G8: Do not skip Phase 1 without a same-day spec stub** | If Phase 1 is skipped, write a `spec.md` stub the same day (problem, AC, out-of-scope) or you cannot later run an honest retro / living-spec. A mini-spec buried in `tasks/index.md` is not a spec |
| **G9: Measure, don't estimate** | A number that can be measured (contrast, size, count, timing) is measured before it is asserted; an unmeasured figure carries `[Suposición]`, never a bare value. Recovered from the lost memory `feedback-measure-dont-estimate` (2026-09-03) |
| **G10: A verified line is not a verified fix** | Existence checks verify premises (file, line, symbol exist); correctness needs its own evidence (test, run, trace). A fix that brings new tests: run them against the pre-fix head too; passing there means they do not test the fix. An unverified conclusion is labelled, not asserted. Recovered from the lost memory `feedback-antihallucination-not-fix-correctness` |
| **G11: Brief by default, no bureaucracy** | No preamble; short answer on the first line, verdict + next step on the closing `ROBIN:` line (style §2); process narration and recaps are cut (§4 Cost). Recovered from the lost memory `feedback-default-brief-no-bureaucracy` |
| **G13: A headless run is a spawn** | Every `claude -p` is a separate model worker under CLAUDE.md §Agents and skills: an explicit model, the cheapest tier by default (prose graders, smoke), the mid tier only when the probe measures that tier (skill triggers), the top tier only with `--allow-expensive` and this-turn permission, one rerun at most. Mechanised in `scripts/lib/headless.ts` + the `headless-model-gate` PreToolUse hook (plan 033) |
| **G12: Wire skills, don't hope for auto-trigger** | Deterministic wiring wins: `/flow-lifecycle` invokes each phase skill explicitly, the prompt router names candidate skills on every human prompt; a gate never depends on a description match alone. Recovered from the lost memory `feedback-skill-wiring-over-autotrigger` |
| **G15: The Bash tool eats doubled backslashes, quoted heredoc included** | Content carrying backslashes, Windows paths, regexes, escape sequences, is written with Write/Edit, never a heredoc from the Bash tool. The collapse also rewrites the **command's own** flags and patterns, so a probe that spells backslashes to detect the collapse silently tests the wrong string: confirm byte counts with a command that contains none |
| **G16: A live sibling session invalidates the measurement you are taking** | Pin the measurement to what you measured: record the commit, or a hash of each file the figure depends on, and re-check it before reporting. A changed hash invalidates the number; re-measure, and only then look for the sibling session that moved it. Waiting to watch a transcript grow proves nothing: another session can be idle and the files still change, or busy elsewhere and they do not |
| **G17: When a delete fails, suspect a working directory, not the tool that reported it** | On Windows a process holding a directory as its working directory locks it against deletion even when empty. Before blaming the delete tool, find the holder: list the long-lived helpers you started (`codex-brokers.ts` for this one) and check which path each was given. The prevention is upstream: never hand a disposable directory to anything that outlives the command |
| **G14: A stub SKILL.md is not a retirement** | When parking a skill, poison-pill or delete `references/` and `templates/` in the **same** HU as the stub. Grep the parked tree for recipes, not only `SKILL.md`. Stubs that must not fire: `disable-model-invocation: true`, `user-invocable: false`, dead one-line description, empty keywords |
| **G19: Declare a missing spec in the FIRST delivery of the plan, not when challenged** | When the requirement source is incomplete (empty ACs, unreachable design, undocumented endpoint), open the plan with what is **missing** and mark every inferred requirement as inferred. A plan that does not separate "the ticket asks this" from "I deduced this" hides its own risk, and the reader cannot audit what they cannot see |
| **G20: Verbatim transcription is not a cheap-tier task** | Faithfulness under length is a capability, not a mechanical chore; long verbatim copying belongs one tier up. When delegating it anyway, verify by **size against the source** (`wc -l` of output vs the section it copies), never by the agent's own file list. Extends G2: a report can satisfy the output format and still fail the requirement |
| **G21: A git mutation never rides inside a measurement command** | Baselines come from `git show <ref>:<path>`, zero mutation. If state genuinely must move, the mutation is its **own declared step** (scoped `git stash push -m <tag> -- <paths>`, restore verified afterwards), never buried mid-pipeline behind `-q`/`2>/dev/null` |
| **G22: A green publisher repo is not a compliant feature** | On a multi-repo ticket the AC-trace ends in the **consumer**: grep each consuming repo for the new endpoint/type actually imported and called. A review scoped to one repo declares that limit explicitly. The stack mechanics live in the private addon |
| **G23: A validator only covers what its index can reach** | When a validator walks an index, writing the artefact is half the change, register it in the **same** commit. Verify against the *output* (grep the generated artefact, or the consumer's view) for the new name, never against the validator's green: an entry the index cannot reach is exactly what the validator has nothing to say about |

## Lessons: diff hygiene

| Lesson | Rule to apply |
|---|---|
| **R1: Don't reformat lines unrelated to the change** | Touch only what the task requires; formatting sweeps are their own commit |
| **R2: Copy-paste leaves live traces** | After copying a block, re-read it for names, keys and comments belonging to the origin |

## Lessons: UI built from a design

| Lesson | Rule to apply |
|---|---|
| **U1: Replicated structure ≠ design fidelity** | Before coding from a mockup, enumerate every **visible** element (label, displayed value, selected-state feedback, badge) and make each one an AC |
| **U2: `undefined` is not `false`** | In status columns, distinguish unknown (`-`) from false. Never let a falsy default stand in for missing data |

## Evidence

The incident behind each lesson: `${CLAUDE_SKILL_DIR}/references/evidence.md`.

## Stack references (read on demand: only the one the work touches)

Company-specific stack references live in the configured private addon. Read only
the reference relevant to the task. An absent addon is normal; these cross-project
lessons still apply. Keep each rule in one place and private evidence in its own
repository. Do not copy company paths or examples into the core during promotion.

## G18: Records and acknowledgements are not process identity or completion

The 2026-09-13 review found that `codex-brokers.ts` trusted a stored PID and
reported directory release before confirming shutdown. PID reuse can target an
unrelated process. Use the installed owner's state resolver and protocol; reject
invalid endpoints. An acknowledgement proves request acceptance, not process exit
or released resources. Local protocol fixtures cover rejection, silence and
bounded acknowledgement; they do not prove native lifecycle behavior.

## Pruning

The value of this file is inverse to its length. On every append, check the neighbors:

- Entry the model now handles by default → delete it.
- Two entries with the same root cause → merge them, keep both pieces of evidence.
- Entry that only ever applied to one repo → move it down to that repo's layer.

## Anti-patterns

| Anti-pattern | Correction |
|---|---|
| Adding a lesson with no incident behind it | Admission rule #1, evidence or it does not enter |
| A stack-specific lesson in the cross-repo tables | Goes to the private addon, one lesson, one layer (Cmd IX) |
| Recreating a lessons layer inside a repo | The layers were merged here on purpose; a second home drifts |
| Restating something already in memory | Point at the memory file instead |
| Reading this file *after* the review verdict | Guards only pay off before the verdict, not as a post-mortem |
| Auto-capturing lessons via a hook | Tried and cut (`learning-inbox`): produced truncated confidence-0.5 fragments with no consumer. Lessons are written deliberately, by a human or a Lead that just saw the failure |

## Commandments cubiertos

| # | Cómo |
|---|---|
| II | Each lesson carries its evidence; no unbacked claims |
| IV | G2/G6 keep the gates honest: a report is not a passing check |
| V | R1/R2 protect the delivered diff from noise and copy-paste debris |
| IX | The frontier table and the pruning rule stop this becoming a third source of truth |
