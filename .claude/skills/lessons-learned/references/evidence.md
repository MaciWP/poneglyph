# Lessons: evidence

The incident behind each lesson in `SKILL.md`. Read it when a lesson's scope is in doubt.

## Lessons: process

| Lesson | Evidence |
|---|---|
| **G1: Never infer a convention from a small sample** | A repository-wide test census contradicted a convention inferred from a small sample. Detailed evidence remains private. |
| **G2: Verify agent self-reports yourself** | A builder checked only its own files; checking the full changed set found omitted lint failures. Detailed evidence remains private. |
| **G3: Code recovered from a stash carries old lessons** | Recovered code reintroduced defects already corrected during an earlier review. Detailed evidence remains private. |
| **G4: Sweep the whole unit, not the line under review** | Success toasts were i18n'd while error toasts stayed hardcoded English in the same file; a dead barrel export and a copy-pasted wrong i18n key shipped with them |
| **G5: Team preference beats repo convention** | An automated review accepted a legacy pattern that contradicted an explicit team requirement. Detailed evidence remains private. |
| **G6: A merge gate is never a nit** | F401 (unused import) fails `nox -s lint`, a hard merge gate; classifying it NIT produced an APPROVED verdict on non-mergeable code |
| **G7: Sibling timeouts travel together** | An environment boot budget increased, but a dependent readiness check retained a shorter deadline and silently lost tools. Detailed evidence remains private. |
| **G8: Do not skip Phase 1 without a same-day spec stub** | 029-workflow-uplift: user skipped `spec.md`; critic still claimed “resolves spec.md”; retro 13 days later had no primary product artefact |
| **G9: Measure, don't estimate** | Feature 010 (html-report): the dark theme's AA contrast was *estimated* as passing; the measured ratio of the `ink-3` colour was 3.64, below the 4.5 floor. The founding incident behind the `[Suposición]` tag |
| **G10: A verified line is not a verified fix** | Feature 014: a review confirmed the changed line existed and concluded the fix was correct; the conclusion was wrong, existence checks say nothing about behaviour. Vacuous tests are the same shape: asserts that pass whether or not the fix exists (memory `tests_vacuous_asserts_on_commit_and_pk`); a 2026-10-01 follow-up review reran a fix's new tests on the pre-fix head before accepting them |
| **G11: Brief by default, no bureaucracy** | Repeated user feedback: answers opened with preamble ("I'll look at the config…") or process narration before the finding, and open questions got recaps instead of framing |
| **G13: A headless run is a spawn** | 2026-09-03 (plan 032): the Lead launched 82 `claude -p` sessions in one day for activation probes, evals and reruns, 44 on Opus (no `--model`, the print default) and 29 on Fable by choice, treating them as "verification commands"; 24 % of the weekly quota and 43 % of Fable in one conversation |
| **G12: Wire skills, don't hope for auto-trigger** | `_research-skill-activation-2026-06-09.md`: native auto-activation under-fires (baselines Haiku 20 % / Sonnet 55 % / Opus 87.5 %); flows that relied on it lost their phase skills mid-feature |
| **G15: The Bash tool eats doubled backslashes, quoted heredoc included** | 2026-09-03, `sync-claude.test.ts`: every `\\` written through `cat > file <<'EOF'` arrived as `\`, so `"C:\\Users\\..."` stopped being a valid path string. One test passed falsely (both sides of the `toBe` equally broken) and another failed with no visible cause; three attempts went by before the channel, not the code, was suspected. Re-verified on Claude Code 2.1.269 (2026-09-12): the same heredoc produced 2 backslashes where 4 were written |
| **G16: A live sibling session invalidates the measurement you are taking** | 2026-09-03: one session validated plan 032 while another was fixing it; files changed every 2-3 minutes underneath, so the figures expired before they could be reported, and two sessions could touch one file with no git warning |
| **G17: When a delete fails, suspect a working directory, not the tool that reported it** | 2026-09-12: `git worktree remove` deleted the worktree's files and its registration, then failed with "Permission denied" on the empty folder; `rm -rf` said "Device or resource busy". Neither git nor Orca was at fault. A detached Codex broker, spawned with that path as its `cwd` and alive until session end, held it. Shutting that one process down made the folder delete instantly |
| **G18: Records and acknowledgements are not process identity or completion** | 2026-09-13 review: `codex-brokers.ts` trusted a stored PID and reported directory release before confirming shutdown |
| **G14: A stub SKILL.md is not a retirement** | 037 critic M1/M2: `meta-create` stub existed while `references/` + `templates/` still taught `activation.keywords` and `model: sonnet`; stubs without `disable-model-invocation` + `user-invocable: false` still auto-invoked |
| **G19: Declare a missing spec in the FIRST delivery of the plan, not when challenged** | A ticket's Acceptance Criteria and References sections were empty and the linked design was unreachable; plan v1 read as fully specified, and the caveat only surfaced after the user rejected the plan asking "are you 100% sure?". Detailed evidence remains private. |
| **G20: Verbatim transcription is not a cheap-tier task** | A cheapest-tier agent told "do not summarise, copy every file path, code block and table verbatim" returned 20 lines for a 3-step story and 26 for an 8-item one. It reported the correct file list, so the structural check passed while fidelity failed. Detailed evidence remains private. |
| **G21: A git mutation never rides inside a measurement command** | A style-census one-liner embedded `git stash -q … git stash pop -q` behind `2>/dev/null`, unannounced, in a workspace whose stash stack is **shared across worktrees**, a pop conflict or a concurrent session would have mixed or lost work. Detailed evidence remains private. |
| **G22: A green publisher repo is not a compliant feature** | An API-contract change was approvable in its own repo while the consumer never called the new endpoint: it composed three legacy endpoints and recalculated client-side, and the generated types existed but were imported nowhere. Ten discrepancies, all invisible from the publisher repo. Detailed evidence remains private. |
| **G23: A validator only covers what its index can reach** | 2026-09-14: a memory file sat in the estate with no entry pointing at it, every session loaded the index and never saw the fact, while the estate looked healthy. The same shape bit a generated bundle elsewhere: an unregistered path passed lint, was silently omitted from the output, and no consumer ever received it. Detailed stack evidence remains private. |

## Lessons: diff hygiene

| Lesson | Evidence |
|---|---|
| **R1: Don't reformat lines unrelated to the change** | Reformatting noise buried a functional change during review. Detailed evidence remains private. |
| **R2: Copy-paste leaves live traces** | Copied code retained names and keys belonging to its source. Detailed evidence remains private. |

## Lessons: UI built from a design

| Lesson | Evidence |
|---|---|
| **U1: Replicated structure ≠ design fidelity** | A picker saved a selected value but never displayed it. Detailed ticket evidence remains private. |
| **U2: `undefined` is not `false`** | A missing status field was interpreted as false and displayed the wrong state. Detailed evidence remains private. |
