# Implementation and validation evidence

## Delivery

The optional skill coordinates one shared worktree through existing Orca commands.
The coordinator owns reservations and acceptance. Workers return evidence and do
not mutate flow state. Default work remains inline. Native permissions remain
authoritative; cooperative reservations are not filesystem access control.

The 2026-09-09 publication scope includes sanitized planning, commit, push and PR
checks. It excludes PR merge, global installation and an unmeasured efficiency claim.

## Observed checks

| Check | Result | Evidence |
|---|---|---|
| Source metadata and references | Passed | 32 skills; zero source-validator errors |
| Adapter and configuration regressions | Passed | 76/76 targeted tests after integrating current main |
| Portable doctor | Passed with warnings | Plugin structure and budget pass; five existing warnings; full suite reserved for pre-commit |
| Full project suite | Passed | Normal pre-commit: 547/547 tests, staged source validation and plugin structure passed |
| Initial isolated pilot | Partial | Claude stopped at workspace trust; Codex completed scoped 13/13 checks |
| Visible message demo | Passed | Two successful tasks; direct question, response, confirmation and closing messages |
| Release fixture | Passed | 19/19 tests after both writers handed off; two worker tasks succeeded |
| Machine installation | Not part of this delivery | Existing profiles remain on the canonical source; development-worktree sync conflicts are reported separately |
| Grok | Not verified | Authentication was unavailable; it is not included in the supported pilot result |

## Release-pilot scenarios

| Scenario | Observed result |
|---|---|
| Startup and scope | Prepared idle Claude/Codex terminals accepted new Dispatches; startup clearance preceded edits |
| Independent work | Both workers operated concurrently on disjoint implementation files and reported red then green scoped tests |
| Negative evidence | Initial 0/4 and 0/13 reports were explicitly held unaccepted; the downstream task stayed pending |
| Contract exchange | Both peer replies used the initial question ID as their canonical thread ID |
| Contention and owner uncertainty | B requested index.ts while A still held it; the coordinator withheld transfer until an explicit no-more-writes acknowledgment |
| Handoff write | After the grant, B reread and changed index.ts, preserving both exports; scoped checks still passed |
| Question recovery | Startup and export requests survived timeouts and resumed with the same question IDs |
| Delivery replay | An unacknowledged delivery returned the same three messages without another dispatch or grant |
| Controlled pause/resume | The coordinator saved its checkpoint, rebound the same Run and recovered the pending questions and reservations |
| Dependency acceptance | Orca marked the downstream task ready after worker completion; the coordinator still verified evidence before assembled acceptance |
| Stable assembled checks | After both worker completions, the coordinator ran all 19 tests successfully |
| Resource ownership | Existing inspection terminals were retained explicitly; fresh reviewer cleanup follows its runtime receipt |

A prepared both exports while it owned index.ts. To exercise a real handoff write,
the coordinator requested an equivalent explicit-import/grouped-export form from
B after transferring the reservation. The acceptance tests were unchanged.

This validates the documented controlled pause, not a process crash, runtime
restart or remote-server failover. No such stronger recovery claim is made.
Counters from reused sessions do not isolate this run's total cost.

Measured duration: 5m 02s from the first startup question to both worker
completions; 8m 28s from Run creation to coordinator acceptance. This includes
coordinator publication work, so it is not a throughput benchmark. The runtime
record contains six coordinator-to-worker messages and no additional human
intervention after launch. There is no matched single-agent baseline.

## Review and publication

A fresh read-only reviewer checked the candidate and independently reran the
19-test fixture. Its three non-blocking findings were addressed: the execution
inventory, lifecycle state and measured duration/intervention data. Final source
checks and review scope are recorded in review.md.
Flow closure remains gated by observed checks. No raw transcript, machine path,
account identifier or live Dispatch capability belongs in the published plan.

## Learn

Separate native startup readiness from task delivery. Use one canonical thread
ID across the entire peer conversation. On Windows, pass long literal arguments
as argv arrays rather than interpolating JSON into shell text. These lessons are
captured in the skill references; no additional orchestration service was added.
