---
spec: 035-flow-coherence
phase: 4
status: reviewed
review_level: full
verdict: APPROVED_WITH_WARNINGS
spec_drift: none
fresh_reviewer_invoked: false
created: 2026-09-08
---

# Source implementation review

The approved flow changes are implemented in this repository. Review ran inline;
no independent model worker or live behavioral probe was authorized. The original
upstream proposal was adapted, not merged wholesale.

## Requirement evidence

| Requirement | Evidence | Result |
|---|---|---|
| AC1 | Draft-to-approval lifecycle, registered task DAG and real CLI gate spellings | Passed |
| AC2 | Missing, failed, not-run, empty and wrong-HU records rejected without changing state/documents | Passed |
| AC3 | Disjoint review table, both BLOCKED bypasses rejected, reopened work needs new evidence | Passed |
| AC4 | Concurrent writer rejection; repair of interrupted status/date projections; progressive legacy reopening | Passed |
| AC5 | Six-step guide; TDD policy explicitly scoped to flow; 804 words versus 1,385 | Passed |
| AC6 | Sequential DAG test; pending dependency blocked; requirement/evidence table and in-scope repair loop | Passed |
| AC7 | Source validator; obligation map; current dev, adapters, publication protocol, dependencies and CI untouched | Passed |
| AC8 | Full source doctor, native plugin validation, actual CLI lifecycle and modified-file secret check | Passed within source scope |

## Checks

- `bun run doctor --ci`: exit 0; 546 tests passed, zero failed; native plugin validation and budget passed.
- Scoped state/contract/workflow suites: 80 tests passed, zero failed before the final CLI scenario expansion; the full source doctor includes that expansion.
- `bun .claude/hooks/native-hook.ts --check --cwd D:/PYTHON/poneglyph`: exit 0; modified-file secret heuristic passed.
- `git diff --check`: passed. Existing line-ending policy was preserved.
- `bun run doctor`: exit 1 because the generated Codex flow entrypoint is stale after the source description changed. Global synchronization is explicitly outside this task.
- The final source validator reports zero errors and four warnings: the existing graphify length warning and three binary privacy-review warnings for concurrently added diagrams. Those diagrams belong to another task. No budget snapshot was raised.

## Review dimensions

Correctness: positive and negative lifecycle transitions are exercised, including the CLI.
Quality: tests precede fixes; existing callers and fixtures follow the new contract.
Security: artifact paths are constrained and linked task sources are rejected; this is not a sandbox or authentication system.
Performance: no new dependency, service, model call or always-on hook; the main flow guide is shorter.
Maintainability: one YAML parser and one review classifier; workflow conformance tests guard its runtime adapter.

## Residual warning

MINOR: native rollout and real-agent behavior remain unverified. The generated
Codex flow entrypoint needs a separately authorized sync. The evidence record
validates supplied outcomes; it does not authenticate logs, execute omitted checks
or independently validate a supplied revision fingerprint. No claim of unchanged
agent quality, speed or token consumption is made from these source tests.

Concurrent changes to root documentation and diagrams belong to another task and
were preserved. They are excluded from this implementation's source fingerprint.

## Non-obvious findings resolved

Recovery must allow progressive reopening of historical HUs without certifying
their unverified siblings. It must also restore the recorded completion date when
a stale document already says closed. Both behaviors have regression tests.
