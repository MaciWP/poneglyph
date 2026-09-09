# Laboratory publication review

Reviewed on 2026-09-09. Target: `feat/reproducible-lab` against
`1ca2c86ea0d6cdf5f6548548512f550bde7a877e` (`origin/main`).

**Disposition: ready for draft publication after the commit and CI gates pass;
not approved for merge.** US10 and native acceptance remain open. This is an
inline review, not an independent reviewer or a completed Critic/Retro lifecycle.

## Scope and method

The initial inventory contains 60 files: 4 tracked modifications and 56 new files.
This report and the necessary pre-commit correction bring the candidate to 63 files.
All authored runtime modules, tests, documentation,
workflow definitions, task criteria, and structured verification records were
reviewed. Generated Archify HTML and PNG were checked against their JSON, pinned
engine, delivery hashes, browser behavior, and rendered output instead of treating
bundled viewer code as a new handwritten implementation.

The repository has no overriding PR-review command. The accepted spec supplies
AC1–AC8; there is no external ticket. The core review criteria, Poneglyph's
publication rules, cross-project lessons, and security checks apply. Each finding
below has an observed counterexample or a concrete coverage gap. Changes address
those findings without importing historical Git history or changing doctrine.

## Findings and corrections

| Ref | Severity | Finding and evidence | Resolution |
|---|---|---|---|
| F1 | Major | A retry that executed `UPDATE notes SET title = title` passed the old evaluator. The new test at [advanced.test.ts:31](../../lab/advanced.test.ts#L31) first failed because the faulty submission was accepted. | [oracle.ts:74](../../lab/oracle.ts#L74) requires zero observed row changes for replay and conflicting payloads. The protected [Store metric](../../lab/catalog.ts#L22) and [bridge](../../lab/worker.ts#L15) supply per-action observations. |
| F2 | Major | Invalid batch titles could cause writes before rejection without being tested. [advanced.test.ts:39](../../lab/advanced.test.ts#L39) first showed the faulty submission accepted. | [oracle.ts:75](../../lab/oracle.ts#L75) exercises invalid batch titles and requires failure with zero row changes. Invalid creation checks use the same observation. |
| F3 | Major | Cancellation during child registration occurred before listener attachment and was lost. [process.test.ts:20](../../lab/process.test.ts#L20) first returned `cancelled: false`. | [process.ts:36](../../lab/process.ts#L36) rechecks the signal after handlers are installed. The regression now passes. |
| F4 | Minor | The old runner test name claimed both cancellation and failed-launch coverage, but only aborted before launch. | Renamed that test. [runner.test.ts:48](../../lab/runner.test.ts#L48) now removes the temporary cwd through a reversible rename, asserts a real `spawn` error, and verifies original configuration and journal recovery. |
| F5 | Critical | The real commit hook failed 2/600 tests because Git fixtures inherited the committing worktree's index. The fixture commands changed that index; the working files remained intact. | [pre-commit.ts](../../scripts/pre-commit.ts) retains the hook context for staged validation, clears Git-local context only for the test subprocess, and checks that tests leave the index tree unchanged. [The regression](../../scripts/__tests__/pre-commit.test.ts) uses two real repositories and asserts owner-index preservation. |

`praise (non-blocking):` The runner calibrates initial and reference implementations
before configuration replacement, and retains individual failure states. This
makes an invalid verifier or failed process observable.

`issue (blocking for merge):` Native swap, effective loading, hook trust, model
execution, and recovery remain unaccepted for the six host/platform cells.
`suggestion:` Complete US10 with the selected models, budget, exclusive native
configuration ownership, and Windows/macOS evidence before final lifecycle review.

The unresolved-code rubric is 100 minus zero Critical, zero Major, and zero Minor
code findings after these corrections. That arithmetic is not a measurement of
review completeness, native compatibility, or model quality. Native acceptance
remains a separate blocking requirement, so this is not a merge approval.

## Requirement trace and impact

| Criterion | Implementation and evidence | Limit |
|---|---|---|
| AC1 — Versioned inputs | [Version store](../../lab/store.ts#L49), profile tests, and CLI exercise preserve the original experiment while saving a new profile, prompt, and definition. Repetition after editing the draft uses the original definition. | The engine and scenario hashes change for oracle v2; old results remain readable, but execution with another engine is rejected. |
| AC2 — Fresh attempts | [Runner](../../lab/runner.ts#L97) installs a frozen profile and materializes a fresh task after quarantine. Runner/profile tests exercise this with synthetic homes. | Actual host loading remains pending. |
| AC3 — Recovery | [Transaction](../../lab/transaction.ts#L39), interruption tests, real failed spawn, and CLI recovery after a separate process exits abruptly verify original bytes, links, absence, and retained conflicts. | Real user-home swaps remain pending. |
| AC4 — Independent checks | [Oracle](../../lab/oracle.ts#L11), reference/initial tests, forged output, protected-file edits, instrumentation tampering, and the two new write counterexamples. | The supplied Store connection is measured; this is not an adversarial OS sandbox. |
| AC5 — Five scenarios | [Catalog](../../lab/catalog.ts#L30) covers ownership, creation, queries, atomic import, and no-op. All reference solutions still pass. | One small Bun/SQLite task family does not measure general productivity. |
| AC6 — Explicit execution failures | [Executor](../../lab/process.ts#L4), [decoders](../../lab/adapters.ts#L17), output-cap/timeout tests, cancellation race, failed spawn, and descendant-pipe cleanup. | Native wire-format and model acceptance remain separate. Unknown telemetry stays null. |
| AC7 — Honest comparison | [Comparison](../../lab/report.ts#L14) checks declared factors, environments and pairs; ratios include failed attempts. The CLI exercise verifies matched repetition, deliberate prompt comparison, and rejection of incompatible definitions. | No automatic winner or statistical superiority claim. Repeated attempts are not independent tasks. |
| AC8 — Evidence-based compatibility | [Native acceptance record](native-validation.json) retains six pending cells; README, diagrams and this report state the same limit. | Windows/macOS native acceptance and final Critic/Retro are pending. |

Impact sweep: the oracle change touches the protected Store, worker observations,
scenario version and calibration, execution checks and historical engine identity.
The CLI and Recipe/Results public formats remain version 1. Oracle version is 2.
The executor change affects agent processes, verifier processes, environment
inspection and CLI tests. No new package dependency or native permission bypass
was introduced.

The pre-commit correction is a necessary publication repair discovered while
running the normal gate, rather than an unrelated cleanup. It follows Git's
[documented hook environment contract](https://git-scm.com/docs/githooks#_description):
Git-local variables must not redirect commands intended for another repository.
The staged validator keeps its original context; no hook or test is bypassed.

SQLite's [total-change counter](https://www.sqlite.org/c3ref/total_changes.html)
counts row modifications on the supplied connection. This supports detection of
the observed replay and invalid-input defects; it does not prove that another
connection or an external side effect was absent.

## Verification and publication evidence

This report is prepared before commit. Final commit-hook and remote CI results
belong to the exact candidate SHA and are recorded in the PR description, not
assumed from the earlier 595-test implementation snapshot.

| Check | Observed result before commit |
|---|---|
| Focused regressions | Oracle/reference suite: 10 passed. Executor suite: 4 passed. Runner suite: 5 passed, including real spawn failure. The three reproduced defects were red before their repairs. |
| Strict types | TypeScript 5.9.3 strict no-emit check passed across every laboratory TypeScript file and its imports. PowerShell used an expanded file list; CI uses Bash expansion. |
| Hook isolation regression | 47 targeted hook/configuration tests passed after the repair, including real owner-index preservation and the existing staged-invalid/unstaged-repaired check. |
| Real CLI exercise | 19 successful CLI steps; 30 synthetic task attempts across original, repeated and changed-prompt experiments; drill recorded two profiles and zero attempts. Frozen history, incompatible comparisons, and recovery after abrupt exit were checked. |
| HTML and diagrams | Report disclosures, both themes, and horizontal containment checked in Edge. Archify passed 9/9 showcase checks; four chapters, search, focus, themes, presentation and native exports worked offline. Eight nodes survived canonical SVG export; the README PNG was inspected. |
| Source gates | Doctor in CI/fast mode and modified-file secret heuristic passed. Five static warnings: four unscanned PNG binaries and the existing Graphify skill length. The new PNG was inspected; the three older images are unchanged base artifacts. |
| Commit gates | Normal pre-commit must validate the staged configuration, run the full suite and validate the plugin. It remains enabled. |
| Remote gates | Required CI: Windows tests, Ubuntu tests, plugin structure, and history secrets. Additionally require all three laboratory jobs on Ubuntu, Windows and macOS. Await the final candidate's results. |

The shared original repository changed to bare mode during this review. Ordinary
Git-dependent checks then failed before reading the candidate. An Orca-managed
publication worktree was created, and all 60 candidate files were copied with
per-file hash equality. The originals were preserved. Dependencies were installed
with the frozen lockfile. Source checks use this isolated checkout; installed
global configuration was not redirected or synchronized.

The original implementation review and verification-US records remain dated,
fingerprinted historical evidence. This review supersedes their conclusions for
the corrected candidate, without rewriting their observations or closing US10.

Ignored local evidence: `.cache/lab-pr/` contains CLI receipts, report screenshots,
and the candidate inventory; the existing diagram cache retains render and browser
receipts. No captured native profile, execution directory, credential, private
privacy-term file or cache belongs in the PR.

## File inventory

| File | Reviewed purpose |
|---|---|
| `.claude/lab/README.md` | User-facing commands, diagrams, interpretation and limits |
| `.claude/lab/adapters.ts` | Laboratory runtime and trust boundaries |
| `.claude/lab/advanced.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/catalog.ts` | Laboratory runtime and trust boundaries |
| `.claude/lab/cli.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/cli.ts` | Laboratory runtime and trust boundaries |
| `.claude/lab/codex.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/grok.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/oracle.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/oracle.ts` | Laboratory runtime and trust boundaries |
| `.claude/lab/process.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/process.ts` | Laboratory runtime and trust boundaries |
| `.claude/lab/profiles.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/profiles.ts` | Laboratory runtime and trust boundaries |
| `.claude/lab/recovery.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/report.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/report.ts` | Laboratory runtime and trust boundaries |
| `.claude/lab/runner.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/runner.ts` | Laboratory runtime and trust boundaries |
| `.claude/lab/store.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/store.ts` | Laboratory runtime and trust boundaries |
| `.claude/lab/transaction.test.ts` | Deterministic behavioral and failure coverage |
| `.claude/lab/transaction.ts` | Laboratory runtime and trust boundaries |
| `.claude/lab/worker.ts` | Laboratory runtime and trust boundaries |
| `.claude/plans/036-reproducible-lab/implementation-notes.md` | Accepted scope, oracle, evidence, and retained lessons |
| `.claude/plans/036-reproducible-lab/implementation-review.md` | Accepted scope, oracle, evidence, and retained lessons |
| `.claude/plans/036-reproducible-lab/native-validation.json` | Six native host/platform cells remain unaccepted |
| `.claude/plans/036-reproducible-lab/spec.md` | Accepted scope, oracle, evidence, and retained lessons |
| `.claude/plans/036-reproducible-lab/state.json` | Lifecycle state; US10 remains pending |
| `.claude/plans/036-reproducible-lab/tasks/US1.md` | Approved task contract and recorded status |
| `.claude/plans/036-reproducible-lab/tasks/US10.md` | Approved task contract and recorded status |
| `.claude/plans/036-reproducible-lab/tasks/US2.md` | Approved task contract and recorded status |
| `.claude/plans/036-reproducible-lab/tasks/US3.md` | Approved task contract and recorded status |
| `.claude/plans/036-reproducible-lab/tasks/US4.md` | Approved task contract and recorded status |
| `.claude/plans/036-reproducible-lab/tasks/US5.md` | Approved task contract and recorded status |
| `.claude/plans/036-reproducible-lab/tasks/US6.md` | Approved task contract and recorded status |
| `.claude/plans/036-reproducible-lab/tasks/US7.md` | Approved task contract and recorded status |
| `.claude/plans/036-reproducible-lab/tasks/US8.md` | Approved task contract and recorded status |
| `.claude/plans/036-reproducible-lab/tasks/US9.md` | Approved task contract and recorded status |
| `.claude/plans/036-reproducible-lab/tasks/index.md` | Approved task contract and recorded status |
| `.claude/plans/036-reproducible-lab/tests.md` | Accepted scope, oracle, evidence, and retained lessons |
| `.claude/plans/036-reproducible-lab/validations.md` | Accepted scope, oracle, evidence, and retained lessons |
| `.claude/plans/036-reproducible-lab/verification-US1.json` | Historical fingerprinted verification; scope inspected |
| `.claude/plans/036-reproducible-lab/verification-US10.json` | Historical fingerprinted verification; scope inspected |
| `.claude/plans/036-reproducible-lab/verification-US2.json` | Historical fingerprinted verification; scope inspected |
| `.claude/plans/036-reproducible-lab/verification-US3.json` | Historical fingerprinted verification; scope inspected |
| `.claude/plans/036-reproducible-lab/verification-US4.json` | Historical fingerprinted verification; scope inspected |
| `.claude/plans/036-reproducible-lab/verification-US5.json` | Historical fingerprinted verification; scope inspected |
| `.claude/plans/036-reproducible-lab/verification-US6.json` | Historical fingerprinted verification; scope inspected |
| `.claude/plans/036-reproducible-lab/verification-US7.json` | Historical fingerprinted verification; scope inspected |
| `.claude/plans/036-reproducible-lab/verification-US8.json` | Historical fingerprinted verification; scope inspected |
| `.claude/plans/036-reproducible-lab/verification-US9.json` | Historical fingerprinted verification; scope inspected |
| `.github/workflows/lab.yml` | Offline test/type matrix; no model invocation |
| `.gitignore` | Track only the intended laboratory HTML |
| `README.md` | User-facing commands, diagrams, interpretation and limits |
| `docs/diagrams/lab.html` | Generated interactive guide; JSON/hash/browser review |
| `docs/diagrams/lab.png` | Native export; visual and byte review |
| `docs/diagrams/lab.workflow.json` | Authored workflow and guided chapters |
| `docs/diagrams/sources.md` | Diagram source fingerprints and reproduction |
| `package.json` | On-demand lab command; no dependency change |

| `.claude/plans/036-reproducible-lab/pr-review.md` | Current review, trace, findings and inventory |
| `.claude/scripts/pre-commit.ts` | Isolate test Git context and reject index mutation; staged validation retained |
| `.claude/scripts/__tests__/pre-commit.test.ts` | Two-repository regression proving the owner index remains unchanged |

## Review protocol completion

Steps 0–8: override lookup, local/base resolution, spec-based acceptance trace,
authored-file and generated-artifact review, project-check discovery, criteria and
lessons pass, requirement trace, scope discipline, and this report were performed.
There is no external ticket and no independent reviewer. The final full-suite
and remote-gate observations are completed by the normal publication pipeline and
reported on the PR. No unrelated baseline cleanup was included.
