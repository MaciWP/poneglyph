# Implementation notes

## TDD and loop-backs
Missing exports established red before new modules. Behavioral red cases exposed
fabricated verifier checks, empty Grok JSON, missing repetitions, writable query
instrumentation, simulation escaping its workspace, changed result records and
candidate edits that did not reach the discovered skill.

The strict writer rejected an undefined optional child field during recovery.
recordChild now omits it. A failed-import mutant left a batch record that its next
attempt removed; the parent now checks the intermediate state before retrying.

## Lessons retained in this project
| Observation | Evidence | Rule |
|---|---|---|
| A later step can conceal a defect | Self-healing batch-record mutant initially passed | Inspect required intermediate state before continuing |
| Copies can make candidate edits inert | Core skill edits initially left discovery unchanged | Bind sources and regenerate derived guidance when freezing |
| References are not literal credentials | Context7 environment Authorization reference was rejected | Parse values and distinguish references from literals |
| Strict persistence affects optional fields | Recovery failed on undefined child | Remove absent fields explicitly |

No global lessons were promoted. Final critic and retro remain pending native
acceptance; passing the offline suite does not close the lifecycle.

## Publication review — 2026-09-09

Two additional faulty implementations passed the original oracle: an idempotent
retry that executed a no-op UPDATE, and invalid batch titles that caused writes
before rejection. Both regression tests were red before the oracle repair.
Oracle version 2 observes per-action SQLite row changes and exercises invalid
batch titles. Reference solutions still pass. The engine fingerprint and scenario
hashes change, so older experiments remain readable but cannot silently replay
with different measurements.

A cancellation sent while recording the child was also lost before listener
registration. Its regression failed before the executor rechecked the signal.
A separate test now forces a real spawn error by moving its temporary cwd and
verifies restoration. Parent-exit cleanup is exercised with a non-model child
that retains inherited pipes. No production homes or models are used.

The real commit gate then exposed a shared-hook defect: temporary Git fixtures
inherited the committing index and changed it. The commit failed, with working
files intact. The hook now clears Git-local context for tests only and checks
the staged tree afterward. A real two-repository regression verifies isolation.
