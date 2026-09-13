---
name: lessons
description: |
  Cross-project lessons learned: real mistakes made in any repo Oriol works on, each
  carrying the evidence that produced it and the rule to apply. Not a best-practices
  list — every entry earned its place by causing a real bug, a PR rejection or a
  wasted cycle. Read it before reviewing a diff/PR and before declaring work done;
  append to it when a review surfaces a mistake that would repeat in another repo.
  Úsala cuando: vas a revisar una PR o un diff, vas a declarar "hecho", acabas de
  recibir feedback de review, o quieres registrar una lección aprendida.
metadata:
  keywords: >
    Keywords - lecciones, lecciones aprendidas, lección aprendida, lessons, lessons learned,
    qué aprendimos, no repitamos el error, registra la lección, apunta esta lección, errores
    recurrentes, pitfalls, guards, review lessons, past mistakes, no volver a fallar
disable-model-invocation: false
when_to_use: |
  "apunta esta lección", "no repitamos este error", "qué lecciones tenemos",
  before reviewing a PR/diff, before declaring done, right after review feedback lands
---

# lessons — cross-project lessons learned

Every entry below cost something real: a PR rejection, a silent data loss, a wasted
cycle. This is the **single home** for cross-repo lessons across every repo Oriol works
on. Company-specific knowledge belongs in an optional private addon. The core
works without that addon and must not discover or activate it automatically.

## Frontier — what lives where

| Layer | Holds | Read at |
|---|---|---|
| **This file** | Mistakes that repeat across repos or stacks: process, review hygiene, delivery discipline | On demand — before review, before "done" |
| **Optional private addon** | Company evidence, stack-specific rules and team conventions | Only after explicit machine or project opt-in |
| **memory** (`memory/*.md`) | Facts about Oriol, his preferences, project state — how to work *with him*. **Per-machine cache**: it lives under `~/.claude/projects/<path>/memory/` and does not travel between machines | Auto-injected every session |

A lesson belongs in exactly **one** layer. Anything that must survive the machine is
written here (or in `docs/`), never only in memory — four `feedback-*` memories cited
by evals and docs were lost that way and had to be recovered as G9–G12 (plan 032,
2026-09-03). When an entry has a memory sibling, this file points at it — no copies.

## Triggers

| Moment | Action |
|---|---|
| Before reviewing a PR/diff (`pr-review`, `critic`) | Read §Lessons; every guard is a checkable item |
| Before declaring work done (`verify`) | Re-check G2, G3, G4 — the ones that bite at the finish line |
| Starting a HU in a configured work project (`build`) | Read the matching private skill if installed; otherwise use the applicable core lessons |
| A review (human or agent) surfaces a mistake | Append here if cross-repo; to the company plugin's `references/<stack>` if stack-specific |
| `retro` Step 8 promotion, scope = cross-project | Land it here |

## Admission rule — three conditions, all mandatory

1. **Real evidence**: a concrete PR, finding or lost cycle. "Good practice" with no
   incident behind it is not a lesson — it is filler, and it dilutes the ones that matter.
2. **Not already default behavior**: if the model does it right without being told
   (tutorial material: "comments explain why, not what"), it does not enter.
3. **Cross-repo reach**: tied to one stack or company → its private reference, not the tables below. A promotion needs human privacy review; keep the detailed evidence private and link to the shared rule instead of copying it.

Entry format: `| Lesson | Evidence (where it bit us) | Rule to apply |`.

## Lessons — process

| Lesson | Evidence | Rule to apply |
|---|---|---|
| **G1 — Never infer a convention from a small sample** | A repository-wide test census contradicted a convention inferred from a small sample. Detailed evidence remains private. | Measure across the **whole** repo before normalizing a style. Match the majority, not your taste. Sibling: G9 (measure, don't estimate); use patterns that separate the cases before counting |
| **G2 — Verify agent self-reports yourself** | A builder checked only its own files; checking the full changed set found omitted lint failures. Detailed evidence remains private. | After delegated work, re-run the gates over the **whole** changed set (`git diff --name-only --diff-filter=d HEAD`) and read the real diff. A report is a claim, not evidence |
| **G3 — Code recovered from a stash carries old lessons** | Recovered code reintroduced defects already corrected during an earlier review. Detailed evidence remains private. | Run the lessons pass over stash/old-branch code **before** declaring it done, not after |
| **G4 — Sweep the whole unit, not the line under review** | Success toasts were i18n'd while error toasts stayed hardcoded English in the same file; a dead barrel export and a copy-pasted wrong i18n key shipped with them | When touching a cross-cutting category (strings, logging, error handling), sweep the entire file/feature for the same category |
| **G5 — Team preference beats repo convention** | An automated review accepted a legacy pattern that contradicted an explicit team requirement. Detailed evidence remains private. | When the existing convention and the team's stated preference diverge, the **team wins** — and the old convention becomes legacy-to-migrate, not the target |
| **G6 — A merge gate is never a nit** | F401 (unused import) fails `nox -s lint`, a hard merge gate; classifying it NIT produced an APPROVED verdict on non-mergeable code | If the check blocks merge, severity is MAJOR minimum and APPROVED is forbidden while it is red. Run the linter before the verdict, don't infer it |
| **G7 — Sibling timeouts travel together** | An environment boot budget increased, but a dependent readiness check retained a shorter deadline and silently lost tools. Detailed evidence remains private. | When raising a shared timeout/budget, grep every literal timeout in the same flow and point them at the one constant; a clock left behind turns the fix into a new downstream failure |
| **G8 — Do not skip Phase 1 without a same-day spec stub** | 029-workflow-uplift: user skipped `spec.md`; critic still claimed “resolves spec.md”; retro 13 days later had no primary product artefact | If Phase 1 is skipped, write a `spec.md` stub the same day (problem, AC, out-of-scope) or you cannot later run an honest retro / living-spec. A mini-spec buried in `tasks/index.md` is not a spec |
| **G9 — Measure, don't estimate** | Feature 010 (html-report): the dark theme's AA contrast was *estimated* as passing; the measured ratio of the `ink-3` colour was 3.64 — below the 4.5 floor. The founding incident behind the confidence tags (`[Seguro]`/`[Suposición]`) | A number that can be measured (contrast, size, count, timing) is measured before it is asserted; an unmeasured figure carries `[Suposición]`, never a bare value. Recovered from the lost memory `feedback-measure-dont-estimate` (2026-09-03) |
| **G10 — A verified line is not a verified fix** | Feature 014: a review confirmed the changed line existed and concluded the fix was correct; the conclusion was wrong — existence checks say nothing about behaviour | Existence checks verify premises (file, line, symbol exist); correctness needs its own evidence (test, run, trace). An unverified conclusion is labelled, not asserted. Recovered from the lost memory `feedback-antihallucination-not-fix-correctness` |
| **G11 — Brief by default, no bureaucracy** | Repeated user feedback (2026-06): answers opened with preamble ("I'll look at the config…") or process narration before the finding, and open questions got recaps instead of framing | Lead with the conclusion or the framing (output style §2 Glance); process narration and recaps are cut (§4 Cost). Recovered from the lost memory `feedback-default-brief-no-bureaucracy` |
| **G13 — A headless run is a spawn** | 2026-09-03 (plan 032): the Lead launched 82 `claude -p` sessions in one day for activation probes, evals and reruns — 44 on Opus (no `--model`, the print default) and 29 on Fable by explicit choice — treating them as "verification commands"; 24 % of the weekly quota and 43 % of Fable in one conversation | Every `claude -p` is a separate model worker under CLAUDE.md §Agent spawn: permission + model, cheap tier by default (Haiku for prose graders and smoke, Sonnet for skill triggers), Fable/Opus only with `--allow-expensive` and this-turn permission, one rerun at most. Mechanised in `scripts/lib/headless.ts` + the `headless-model-gate` PreToolUse hook (plan 033) |
| **G12 — Wire skills, don't hope for auto-trigger** | `_research-skill-activation-2026-06-09.md`: native auto-activation under-fires (baselines Haiku 20 % / Sonnet 55 % / Opus 87.5 %); flows that relied on it lost their phase skills mid-feature | Deterministic wiring wins: `/flow` invokes each phase skill explicitly, `skill-activation.ts` injects `Skill()` on precise keywords, `skill-advisor` ratifies; a gate never depends on a description match alone. Recovered from the lost memory `feedback-skill-wiring-over-autotrigger` |
| **G15 — The Bash tool eats doubled backslashes, quoted heredoc included** | 2026-09-03, `sync-claude.test.ts`: every `\\` written through `cat > file <<'EOF'` arrived as `\`, so `"C:\\Users\\..."` stopped being a valid path string. One test passed falsely (both sides of the `toBe` equally broken) and another failed with no visible cause; three attempts went by before the channel, not the code, was suspected. Re-verified on Claude Code 2.1.269 (2026-09-12): the same heredoc produced 2 backslashes where 4 were written | Content carrying backslashes — Windows paths, regexes, escape sequences — is written with Write/Edit, never a heredoc from the Bash tool. The collapse also rewrites the **command's own** flags and patterns, so a probe that spells backslashes to detect the collapse silently tests the wrong string: confirm byte counts with a command that contains none |
| **G16 — A live sibling session invalidates the measurement you are taking** | 2026-09-03: one session validated plan 032 while another was fixing it; files changed every 2-3 minutes underneath, so the figures expired before they could be reported, and two sessions could touch one file with no git warning | Pin the measurement to what you measured: record the commit, or a hash of each file the figure depends on, and re-check it before reporting. A changed hash invalidates the number — re-measure, and only then look for the sibling session that moved it. Waiting to watch a transcript grow proves nothing: another session can be idle and the files still change, or busy elsewhere and they do not |
| **G17 — When a delete fails, suspect a working directory, not the tool that reported it** | 2026-09-12: `git worktree remove` deleted the worktree's files and its registration, then failed with "Permission denied" on the empty folder; `rm -rf` said "Device or resource busy". Neither git nor Orca was at fault. A detached Codex broker, spawned with that path as its `cwd` and alive until session end, held it. Shutting that one process down made the folder delete instantly | On Windows a process holding a directory as its working directory locks it against deletion even when empty. Before blaming the delete tool, find the holder: list the long-lived helpers you started (`codex-brokers.ts` for this one) and check which path each was given. The prevention is upstream — never hand a disposable directory to anything that outlives the command |
| **G14 — A stub SKILL.md is not a retirement** | 037 critic M1/M2: `meta-create` stub existed while `references/` + `templates/` still taught `activation.keywords` and `model: sonnet`; stubs without `disable-model-invocation` + `user-invocable: false` still auto-invoked | When parking a skill, poison-pill or delete `references/` and `templates/` in the **same** HU as the stub. Grep the parked tree for recipes, not only `SKILL.md`. Stubs that must not fire: `disable-model-invocation: true`, `user-invocable: false`, dead one-line description, empty keywords |

## Lessons — diff hygiene

| Lesson | Evidence | Rule to apply |
|---|---|---|
| **R1 — Don't reformat lines unrelated to the change** | Reformatting noise buried a functional change during review. Detailed evidence remains private. | Touch only what the task requires; formatting sweeps are their own commit |
| **R2 — Copy-paste leaves live traces** | Copied code retained names and keys belonging to its source. Detailed evidence remains private. | After copying a block, re-read it for names, keys and comments belonging to the origin |

## Lessons — UI built from a design

| Lesson | Evidence | Rule to apply |
|---|---|---|
| **U1 — Replicated structure ≠ design fidelity** | A picker saved a selected value but never displayed it. Detailed ticket evidence remains private. | Before coding from a mockup, enumerate every **visible** element (label, displayed value, selected-state feedback, badge) and make each one an AC |
| **U2 — `undefined` is not `false`** | A missing status field was interpreted as false and displayed the wrong state. Detailed evidence remains private. | In status columns, distinguish unknown (`-`) from false. Never let a falsy default stand in for missing data |

## Stack references (read on demand — only the one the work touches)

Company-specific stack references live in the configured private addon. Read only
the reference relevant to the task. An absent addon is normal; these cross-project
lessons still apply. Keep each rule in one place and private evidence in its own
repository. Do not copy company paths or examples into the core during promotion.

## Pruning

The value of this file is inverse to its length. On every append, check the neighbors:

- Entry the model now handles by default → delete it.
- Two entries with the same root cause → merge them, keep both pieces of evidence.
- Entry that only ever applied to one repo → move it down to that repo's layer.

## Anti-patterns

| Anti-pattern | Correction |
|---|---|
| Adding a lesson with no incident behind it | Admission rule #1 — evidence or it does not enter |
| Putting a stack-specific lesson in the cross-repo tables | It belongs in `references/<stack>` — one lesson, one layer (Cmd IX) |
| Recreating a lessons layer inside a repo | The layers were merged here on purpose; a second home drifts |
| Restating something already in memory | Point at the memory file instead |
| Reading this file *after* the review verdict | Guards only pay off before the verdict, not as a post-mortem |
| Auto-capturing lessons via a hook | Tried and cut (`learning-inbox`, 030): produced truncated confidence-0.5 fragments with no consumer. Lessons are written deliberately, by a human or a Lead that just saw the failure |

## Commandments cubiertos

| # | Cómo |
|---|---|
| II | Each lesson carries its evidence; no unbacked claims |
| IV | G2/G6 keep the gates honest — a report is not a passing check |
| V | R1/R2 protect the delivered diff from noise and copy-paste debris |
| IX | The frontier table and the pruning rule stop this becoming a third source of truth |
