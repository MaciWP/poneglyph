# Flow lifecycle contract

`scripts/flow-state.ts` records transitions. `scripts/lib/flow-contract.ts`
validates verification records and classifies reviews. State is authoritative;
Markdown status is a repairable projection. The helper records actual decisions,
not inferred permission. It does not authenticate callers or run their checks.

## What `current_phase` means

`current_phase` names the phase that is **ready to run**, never the phase that
finished. This file is its single owner: a skill cites this table and states no
number of its own. Before this was written down, `build` handed over `4`, `critic`
asked for `3`, `retro` asked for `4` while the helper had already written `5`, so
each phase entry check contradicted the state the previous phase produced
(findings H24 and H71, quality review 2026-09-11).

| Value | Ready to run | Written by |
|---|---|---|
| `2` | Technical plan | `approve-gate 1-2` |
| `2.5` | Test and oracle design | `complete-phase 2` |
| `3` | Build | `approve-gate 2-3`, `reopen-us`, `verdict NEEDS_CHANGES` |
| `4` | Review and critique | the last `close-us`, `complete-phase 3` |
| `5` | Retrospective | `verdict` with an approving value |
| `closed` | Nothing; the feature is finished | `close-feature` |

A phase entry check therefore reads its **own** number: `build` starts at `3`,
`critic` at `4`, `retro` at `5`.

## Commands

Resolve the helper from the installed shared root (`rules/harness-runtime.md`).
Use `bun "<shared-root>/scripts/flow-state.ts" <command> --plan "<plan-directory>"`.
Without `--plan`, mutations require exactly one open plan in the current project.
`status --plan <plans-root>` lists all open plans instead.

| Command | Required input and effect |
|---|---|
| `complete-phase 1` | Scope is prepared; record completion before asking for approval |
| `approve-gate 1-2 --approval <decision-ref>` | Prepared scope and actual approval; record decision and approve spec frontmatter |
| `complete-phase 2` / `complete-phase 2.5` | Approved scope → draft tasks → oracle; preparation does not approve execution |
| `approve-gate 2-3 --approval <decision-ref>` | Prepared tasks and oracle; validate nonempty task DAG, register HUs and approve package documents |
| `close-us US1 --verification <report.json>` | Approved execution, completed dependencies and valid verification; save history and project HU closure |
| `verdict <value> --review <assessment.json>` | Assessment must support the verdict; approval also requires verified HUs |
| `reopen-us US1 --note <reason>` | Reopen an identified HU; invalidate old review/retro. BLOCKED also requires `--approval <decision-ref>` |
| `retro-status approved` | Record actual ratification; `pending` or `skipped — <reason of at least 10 characters>` are also supported |
| `close-feature` | Verified HUs, approving review, resolved retro and completed prior phases; project spec/index closure |
| `sync-artifacts` | Repair the recorded artifact set without changing state or creating approvals |
| `boundary-check <phase> <item>` | Record an observed boundary check |

Both `1-2` and quoted `1->2` spellings work. Repeating an approved gate does not
rewind phases, duplicate decisions or add newly discovered tasks. Scope changes
return to planning; they are not an implicit second approval. Commands that fail
exit nonzero. Never treat reassuring stdout as success after a nonzero exit.

## Verification record

Reuse results from the checks already executed on the final inputs. Supply a
report file, then retain its content in `us_history`; another permanent copy is
not required. `--tests-passed` alone no longer closes a HU.

```json
{
  "us": "US1",
  "revision": "commit-and-diff-fingerprint-of-checked-inputs",
  "tests_passed": true,
  "checks": [
    {"name": "project tests", "status": "passed", "evidence": "run reference and observed result"},
    {"name": "acceptance scenario", "status": "passed", "evidence": "expected and observed behavior"}
  ]
}
```

These values are illustrative. Include every required check. `failed` and
`not_run` prevent closure. `not_applicable` requires a reason and cannot hide an
unavailable required check. At least one observed passing check is required.
Use `tests_passed: null` only for validation-only work without a suite run.
After an input changes, repeat its affected checks and record the new result.
The helper validates the supplied record, not the authenticity of a log or Git
fingerprint. It does not prove that omitted checks ran. Record evidence honestly.

## Review and repair

```json
{"blockers":0,"majors":0,"minors":1,"nits":0,"checks":"passed","coverageMet":true}
```

| Verdict | Condition, in order |
|---|---|
| `BLOCKED` | A blocker exists or required checks could not run |
| `NEEDS_CHANGES` | A MAJOR exists, required checks failed, or required coverage/outcomes are unmet |
| `APPROVED_WITH_WARNINGS` | Checks and requirements pass; only MINOR/NIT findings remain |
| `APPROVED` | Checks and requirements pass; no findings |

`critic` must trace each requirement to observed evidence; `coverageMet` is not
the percentage of HUs marked done. Reopen only the HUs implicated by findings,
then repair within the approved scope and repeat verification/review. Keep
existing retry limits. A new scope or unresolved blocker needs the user's
decision. No command may erase BLOCKED through a replacement verdict or phase.

## Interruption and compatibility

Mutations acquire an exclusive `.flow-state.lock` directory with owner metadata.
State and documents use temporary files and same-directory rename. Validate all
document updates before committing state. Commit state first, then project the
documents. This is recoverable projection, not a multi-file atomic transaction.

A crash can leave a lock. Inspect its owner and confirm the process stopped;
removal needs the applicable authorization. Then run `sync-artifacts`. There is
no automatic stale-lock takeover. Recovery preserves unknown decisions and uses
recorded approval paths; it does not discover new artifacts to approve.

Historical plans remain readable. Their missing verification is not converted
to success. Reopen and verify unfinished historical work before its next closure.
Closed archives are not migrated or rewritten automatically. Existing Boolean
approval flags remain readable, but the helper never invents their missing
decision references. This change does not install global profiles or grant
permission to publish, spawn workers or perform destructive operations.
