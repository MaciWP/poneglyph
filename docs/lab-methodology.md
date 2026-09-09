# Laboratory methodology: measuring Poneglyph

Status: documentation and design; not a claim of measured uplift.

Reviewed: 2026-09-09. Code snapshot: [b0638e0](https://github.com/MaciWP/poneglyph/tree/b0638e010bd7839909c863beb3f8d4157374b209).
Updated the same day after the [final review](lab-final-review.md): items marked
"implemented 2026-09-09" exist in the working tree ahead of that snapshot.

Audience: Oriol, future maintainers, and readers reproducing the method.

## 1. The decision this laboratory should support

Does a particular Poneglyph configuration improve **quality, reliability,
performance, and cost** on a declared bank of controlled tasks? The answer may be
a useful improvement, a regression, a trade-off, or insufficient evidence.
Poneglyph's net personal value is not established by its implementation tests.

Use a small fictional repository with deliberately designed problems and frozen
starting points. It need not track a changing work repository. Conclusions apply
to the selected tasks, harness, model, environment and budget. Broader usefulness
remains a hypothesis until tested on other tasks or actual use.

This document specifies the method. It does not implement the proposed cases,
trace collection, isolation changes or statistics. The current CLI and data formats
remain unchanged. Native acceptance, US10 and merge approval remain separate.

[Operational commands](../.claude/lab/README.md) stay in the laboratory README.
The historical [publication review](../.claude/plans/036-reproducible-lab/pr-review.md)
records code findings and tests; its test count is not a model-quality score.

### Three different kinds of evidence

| Evidence | What it can establish | What it cannot establish |
|---|---|---|
| Instrument tests | Versioning, grading, process handling and recovery work for exercised counterexamples | Whether a model benefits from Poneglyph |
| Controlled model trials | Observed effects of assigned configurations under recorded conditions | General productivity, or universal superiority |
| Personal-use validation | Whether the controlled findings transfer to Oriol's work | A universal effect across other people, projects or models |

The current `demo` deliberately gives non-base profiles reference solutions.
It tests the mechanism. It is not an A/B measurement of model behavior.

## 2. What exists, and what remains uncertain

The following observations come from the inspected code, not vendor claims.

| Ref | Current behavior and source | Interpretation or missing capability |
|---|---|---|
| H1 | [Version store](../.claude/lab/store.ts) hashes inputs; [runner](../.claude/lab/runner.ts) freezes scenarios, environment and engine identity | Reuse this foundation. A changed prompt/profile produces another definition; old results retain their meaning |
| H2 | [Profiles](../.claude/lab/profiles.ts) captures installed behavioral entries and keeps common native settings | `base` can remove third-party personal behavior as well as Poneglyph. An inventory is required before attributing the difference to Poneglyph alone |
| H3 | The runner creates fresh task directories, quarantines state, and attempts [transactional recovery](../.claude/lab/transaction.ts) | Filesystem control is implemented; native loading and recovery on real user profiles remain unaccepted |
| H4 | The [catalog](../.claude/lab/catalog.ts) has five tasks in one Bun/SQLite service. Only `src/service.ts` is submitted | Suitable for narrow correctness tests. It does not yet exercise broader repository navigation, multi-file repair or general code quality |
| H5 | The runner decodes stdout into terminal validity, model and consumption, and (implemented 2026-09-09) keeps the raw host stream as `stream.jsonl`, the final text, turn count, API seconds, per-model usage and permission denials per attempt | Trace review is possible per attempt. A normalized cross-host trace schema and a non-model fixture that reproduces load events remain proposed |
| H6 | [Comparison](../.claude/lab/report.ts) checks conditions and pair coverage and reports descriptive differences | No uncertainty calculation, calibrated maintainability rubric, or automatic decision rule is implemented |
| H7 | [Process handling](../.claude/lab/process.ts) measures process time. Results include verifier/setup/elapsed fields | The summary emphasizes agent-time ratios. A useful decision also needs end-to-end time and the laboratory's own overhead |
| H8 | Telemetry and API-equivalent cost can be null | Missing measurements are unknown. API-equivalent spend is not subscription quota or actual billing |
| H9 | Scenario objects include reference code; verifier code lives outside the writable task directory. The agent works in an opaque OS temporary directory outside the laboratory root (implemented 2026-09-09) | Directory separation now covers laboratory objects, other runs and condition labels. It is not proof of read isolation: no model has been shown cheating here, and an observed isolation probe remains pending |
| H10 | The runner checks the native home and active agents; live execution uses the actual user configuration roots | It is not a disposable OS sandbox. Operational inconvenience and restoration risk matter when judging the laboratory itself |

The [native acceptance record](../.claude/plans/036-reproducible-lab/native-validation.json)
is authoritative for executed host/platform evidence. Passing simulated macOS CI
does not demonstrate native macOS configuration loading.

The current runner also appends autonomous-execution authorization to every task.
That is a legitimate condition for bounded coding tasks, but it does not test
whether Flow asks the right approval questions in ordinary collaboration.

The schedule randomizes condition order inside each case/repetition block.
Its seed controls scheduling and fixture data, not deterministic model generation.
A new seed with different IDs is not automatically a new kind of problem.

The current recipe permits 1–10 repetitions. A comparison selects one execution
on each side; repeated execution directories are not automatically pooled into
a statistical analysis. These are implementation limits, not sample-size advice.

## 3. External methods: borrow mechanisms, not conclusions

Sources were read on 2026-09-09. T1 denotes inspected local code; D denotes
primary technical documentation; B denotes vendor-reported observations; A
denotes a published study with an explicit experimental method. These labels
describe provenance, not a guarantee that a result transfers to this laboratory.

| Source | Evidence | Mechanism worth borrowing | Limitation for this project |
|---|---|---|---|
| [Anthropic: agent evaluations](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), 2026-01-09 | B/D | Assess outcomes and traces; distinguish capability from regression cases | A saturated bank can hide improvements; model graders need calibration |
| [Anthropic: infrastructure noise](https://www.anthropic.com/engineering/infrastructure-noise), 2026-02-05 | B | Treat resource allocation and enforcement as experimental variables | A benchmark difference can arise from infrastructure, not configuration intelligence |
| [OpenAI: evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) | D | Use task-specific criteria and human calibration | Judge position and verbosity biases can distort apparent quality |
| [SWE-bench harness](https://www.swebench.com/SWE-bench/reference/harness/) | D | Fixed repository states, patch evaluation, and reproducible test environments | Its task distribution and infrastructure footprint are not our default workload |
| [Harbor task format](https://www.harborframework.com/docs/tasks) | D | Explicit task, environment, reference and verifier; optional separate verifier environment | Separation is configurable, not automatic; native platform compatibility still needs testing |
| [Inspect metrics](https://inspect.aisi.org.uk/metrics.html) and [logs](https://inspect.aisi.org.uk/eval-logs.html) | D | Multiple metrics, preserved observations and grouping repeated samples | Repetitions of one case must not be counted as unrelated tasks |
| [METR study](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) and [2026 update](https://metr.org/blog/2026-02-24-uplift-update/) | A; methodological follow-up | Separate perceived usefulness, benchmark capability and real-world impact | The follow-up identifies selection and time-measurement difficulties; neither study decides Poneglyph's value |
| [Microsoft: metric interpretation pitfalls](https://www.microsoft.com/en-us/research/publication/a-dirty-dozen-twelve-common-metric-interpretation-pitfalls-in-online-controlled-experiments/), 2017 | Published experimental practice | Audit the interpretation of metric movements, not only their calculation | A personal task bank is not a high-traffic online A/B platform |
| [NIST: randomized blocks](https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm) | Statistical reference | Hold important nuisance factors within blocks and randomize condition order | Blocking reduces some variation; it does not freeze the provider's inference infrastructure |

No vendor percentage is treated as evidence of Poneglyph uplift. No leaderboard
ranking is used to select a winner.

### Framework fit

| Option | Fit | Cost or unresolved question | Decision |
|---|---|---|---|
| Retain the current runner | Already handles versioned Poneglyph profiles and recovery | Missing traces, stronger isolation and statistical reporting | Keep as the inspected starting point |
| Integrate Harbor | Closely matches controlled coding tasks and verifier separation | Native CLI/authentication/platform fit and migration cost need a focused check | Candidate for a later bounded integration study |
| Integrate Inspect | Useful evaluation, logging and analysis primitives | A replacement agent loop would change what we are measuring | Consider analysis or a bridge that preserves the actual harness |
| Use direct model/API evals as a replacement | Useful for prompt-only questions | Does not reproduce the native Claude Code, Codex or Grok harness | Complementary, not equivalent to configuration evaluation |

The first integration study should reproduce one existing task with a non-model
process, retain its artifacts, and demonstrate isolated grading. That is a
feasibility check, not a reason to rewrite the laboratory in advance.

## 4. The controlled repository and its designed traps

**Proposed bank:** retain Bun/SQLite and grow the fixture into a small notes API
with service, policy, repository and utility modules. No frontend, cloud service
or network dependency is needed for the first bank. K1–K5 exist in narrower form;
K6–K8 and broader multi-file submissions are proposals.

Each task starts from a fresh checkout of a declared fixture revision plus one
versioned task overlay and seeded database. Tasks do not accumulate changes.
Agents may inspect public tests and add their own tests within the declared
submission surface. Hidden checks test public requirements, not secret rules.

Every case has: public prompt, initial state, allowed edits, acceptance conditions,
one passing reference, known incorrect alternatives, metrics and an explicit
statement of what it does not measure. Freeze all of these before a campaign.

### K1 — Ownership boundary (existing: ownership)

- Public prompt: repair note access so a user can read their own note, receives
  null for missing/inaccessible notes, and cannot read another user's note.
- Initial state: the lookup filters by note ID but omits owner ID.
- Acceptance: legitimate access, denied cross-user access, missing IDs and existing
  behavior all work. Permit equivalent implementations through the supplied Store.
- Traps: deny every request; trust any ID; fix only the public happy-path example.
- Primary signal: functional correctness and reliability. This is not a complete
  authentication-system audit.

### K2 — Validation before mutation (existing: creation)

- Public prompt: accept non-empty trimmed string titles of at most 80 JavaScript
  code units; throw an error for invalid input before any write; persist owner and
  title. The word "throw" is public since 2026-09-09; "reject" left a valid
  return-null reading that the oracle penalized.
- Initial state: creation is incomplete.
- Acceptance: types, whitespace, length boundaries, returned values and persistence;
  invalid input changes no rows.
- Traps: trim after inserting; accept invalid types; write and then undo; pass only
  the visible example.
- Signal: boundary reasoning and data integrity. The length unit is public, so
  accepting Unicode characters under another length rule is not a fair shortcut.

### K3 — Query work (existing: queries)

- Public prompt: list the user's notes with owner name and deterministic note order
  using at most one Store SQL call, including an empty result.
- Initial state: one lookup per note produces N+1 queries.
- Acceptance: exact result contract, filtering, order, empty result and query count.
- Traps: omit records to save work; hardcode fixture data; reset instrumentation.
- Signal: generated-code query efficiency. SQL-call counts are not a benchmark of
  database latency or the agent's own response time.

### K4 — Interrupted, idempotent import (existing: batch_import)

- Public prompt: validate titles before writes; import atomically; key idempotency
  by owner and batch ID; replay identical normalized titles without writing;
  reject conflicting payloads; allow a clean retry after an injected interruption.
- Initial state: the operation does not use the available transaction.
- Acceptance: inspect the intermediate failure state before retry; check replay,
  conflicting payloads, invalid titles and original data.
- Traps: leave partial rows; repair leftovers only on retry; return equal data
  while writing again. Oracle v2 detects the last class through Store row changes.
- Design extension: add explicit cross-owner batch-key and invalid-container cases.
  These proposed checks must not be described as already implemented.
- Signal: stateful correctness, not crash durability across arbitrary storage systems.

### K5 — A justified no-op (existing: no_op)

- Public prompt: optimize only if owner isolation, ordering or the query budget is
  violated; otherwise explain that no change is needed and leave the service intact.
- Initial state: the implementation already satisfies those requirements.
- Acceptance: required behavior remains valid and the submitted service is unchanged.
- Traps: gratuitous refactor; instrumentation edits; a cosmetic change presented as
  a fix. Exact-byte checking is justified here by the explicit no-change requirement.
- The explanation criterion is proposed; the current oracle checks code/behavior.
  Do not penalize valid alternative code elsewhere using this case's byte rule.

### K6 — Reuse an existing utility (proposed)

- Public prompt: add a title-preview operation with stated normalization and Unicode
  behavior. Point to the public project convention that existing utilities should
  be reused where they meet the contract.
- Initial state: the utility already handles the required edge cases; the new caller
  is missing.
- Acceptance: behavior tests plus a blinded quality review of reuse or a justified
  alternative. Keep functional acceptance separate from that quality dimension.
- Traps: duplicate subtly different normalization; assume fewer lines means better
  quality; mechanically require the reference patch.
- Signal: navigation and maintainability, not broad architectural judgment.

### K7 — Repair a shared cause (proposed)

- Public prompt: correct an inconsistent owner check used by two API routes and a
  batch operation, preserving each route's published contract.
- Initial state: consumers share a flawed policy helper.
- Acceptance: exercise every affected entrypoint, valid access and denied access;
  check regressions outside the reported route. Permit different sound repairs.
- Traps: patch one caller; duplicate the policy; remove checks to make the reported
  example pass.
- Signal: root-cause and impact analysis across files.

### K8 — Follow a symptom to another module (proposed)

- Public prompt: fix incorrect paginated note ordering after import; supply a
  reproducible example and the required stable ordering/tie-breaking contract.
- Initial state: the visible route delegates to a repository query with the defect.
  All supplied requirements are truthful; old comments may be labelled historical.
- Acceptance: public behavior across page sizes, ties and imported data; no
  fixture-specific hardcoding or unrelated data deletion.
- Traps: sort just the example in the route; modify tests instead of behavior;
  follow an obsolete comment over the current requirement.
- Signal: diagnosis under realistic navigation cost, not guessing an undisclosed rule.

### Agent problems versus evaluator counterexamples

| Bank | Examples | Required interpretation |
|---|---|---|
| Tasks submitted to models | K1–K8 | These produce evidence about assigned configurations |
| Mutants used to test grading | Fake successful stdout, deny-all, modified Store, counter resets, no-op UPDATE on replay | These validate the instrument; they are not extra model tasks |
| Runtime/recovery tests | Cancellation, failed spawn, inherited pipes, interrupted file moves, conflicts | These test laboratory reliability, not skill effectiveness |

The current source contains references in saved scenario objects. A later isolation
test must show that the agent cannot read those objects, reference patches or
hidden grader inputs. Merely placing them in another directory is insufficient.
Do not claim a disclosure has occurred without an observed trace.

Keep a development set and a reserved confirmation set. Fix their membership
before tuning configurations. New IDs alone do not make a meaningful holdout:
vary the defect structure, call paths and edge cases while keeping requirements
explicit. If every configuration succeeds, the case remains useful for regression
and cost checks, but may no longer distinguish functional capability.

## 5. Experiments: one component or the whole configuration

### E1 — Component versions

Start from one frozen Poneglyph profile. A, B and C replace exactly one skill or
command. For example: an explanatory body, a concise structured body, and a body
with worked examples. Keep hard requirements, tool permissions, skill name,
description, routing metadata and all other components fixed.

If examples add substantive instructions, call this a comparison of versions,
not proof that length or formatting alone caused the difference. Check semantic
equivalence of mandatory requirements before any model run.

### E2 — Whole configurations and the native control

Compare explicitly captured versions of Poneglyph, optionally including a native
control N. Define whether the treatment is Poneglyph core alone or a broader
personal bundle. Keep unrelated behavior either absent from every condition or
fixed in every condition. Record all additions and removals.

N means no selected personal behavioral customization. It still includes the
harness's built-in instructions, authentication, mandatory policy and declared
common tools/provider settings, including the user's permission allow-list and
`env` block, which every condition shares. It is not a raw model with an empty
system prompt.
The current `base` label does not establish this attribution without inventory.

Do not combine E1 and E2 into a causal claim about a single skill. Different
harnesses/models are later experimental blocks. A model plus its harness is a
different system; changing both is not a model-only comparison.

### Natural use and forced invocation

Natural use is primary: give the same task without demanding a particular skill.
The assigned profile is the treatment, even when the agent does not read the
changed skill. Keep every valid assigned attempt in the primary comparison.

Explicit invocation is a separate diagnostic mode. It can test behavior when the
skill is invoked, but cannot establish normal discovery or everyday benefit.
Do not condition the primary result on successful skill activation: activation is
itself affected by the treatment.

## 6. Controls, execution and evidence

### Campaign planning record

This is a **design worksheet, not a new CLI schema**. All fields must be resolved
before a live campaign; absent model/budget information prevents execution.

| Required entry | Decision to record |
|---|---|
| Question and estimand | E1 or E2; outcome, target task bank and exact contrast |
| Inputs | Fixture/task/prompt/profile revisions, component diff and grader/rubric versions |
| Native system | Harness binary/version, requested and resolved model when available, provider, inference settings |
| Environment | OS/image, dependencies, CPU/RAM limits and enforcement, network policy, working path, cache policy, concurrency |
| Assignment | Case IDs, repetition count, randomization seed and time blocks |
| Budget | Max attempts, per-attempt and total time; token/spend constraints only where enforceable; reserve for evaluation itself |
| Analysis | Four metrics, practical margins, confidence level, comparisons, exclusions, stopping and missing-data rules |
| Privacy | Retention, redaction, access, export policy and approved authentication handling |
| Acceptance | Reference/mutant calibration, loading evidence, isolation probes and recovery rehearsal |

CPU/RAM limits and provider state are not equivalent controls. Record what was
controlled, what was merely observed and what was unavailable. A model-name alias
or requested ID does not prove an unchanged backend. Never promise identical
inference conditions just because the fixture hash matches.

### Trial sequence

1. Verify the frozen manifest, case calibration and required native acceptance.
2. Start a fresh controlled runtime and task snapshot. Verify empty prior state.
3. Materialize one assigned profile and record effective-load evidence where the
   harness exposes it. Use opaque trial paths rather than advertising a winner
   (implemented 2026-09-09: the agent's working directory is an opaque OS temporary
   directory outside the laboratory root).
4. Run the fixed public task under the shared budget and declared permission policy.
5. Capture visible messages/tool events, submission, timing and available consumption
   (implemented 2026-09-09: raw stream, final text, turns, API seconds, model usage
   and permission denials per attempt).
6. Grade the submission independently; retain the grader version and full findings.
7. Preserve evidence and restore/dispose of the runtime. Report conflicts explicitly.
8. Aggregate only after the declared block/campaign boundary.

Prefer an isolated account/runtime whose personal state cannot contaminate the
trial; a VM may be needed to preserve native host semantics. This is a future
requirement, not a capability already supplied by the current real-home runner.
A Linux container does not validate native Windows or macOS behavior.

All conditions receive each case/repetition block; randomize their order.
Use a fixed concurrency policy, initially serial. Spread scheduled blocks across
time windows when provider variation matters. An A/A campaign labels two copies
of the same profile differently to check pipeline asymmetry and observed noise;
different individual outputs are expected, not an A/A failure.

Classify failures before inspecting the winning condition. Model timeouts and
failed solutions count toward practical reliability and cost. Infrastructure
invalidations remain visible. If an invalid block must be rerun, rerun the entire
affected comparison block under the declared rule and retain the original records.
Do not rerun only a losing condition until it succeeds.

### Behavioral observability

| Signal | Evidence | What it does not prove |
|---|---|---|
| Available | Materialized profile and discovery paths | That the harness loaded the content |
| Loaded/read | Native load event (`system/init` in the retained stream) or observed read, where available | That the model followed it |
| Observable action | Tool call, changed artifact or executed validation | That the skill caused the action |
| Outcome | Independent checks and quality review | Why one condition performed differently |

Capture only emitted/visible information; do not require hidden model reasoning.
Store tool names, arguments with redaction, durations, outcomes, observed file reads,
public messages and child-worker usage where available. Missing child or provider
telemetry makes total consumption incomplete. Raw traces stay private by default;
export only reviewed summaries and synthetic examples.

Use trace data to explain hypotheses, not reward ritual. More tool calls, more
stages printed, or the literal name of a skill are not success criteria.

## 7. Four pillars and decision rules

An accepted attempt meets all mandatory behavioral/safety checks and the declared
minimum quality rubric. Also report functional pass rate separately. Current
`accepted` is executable-check acceptance; rubric-qualified acceptance is proposed.

| Pillar | Measures | Reporting and limits |
|---|---|---|
| Quality | Functional requirements, regressions, critical defects; anchored maintainability/reuse/scope rubric | Separate hard checks from qualitative dimensions. Do not reward brevity or reference similarity by default |
| Reliability | Accepted/valid assigned attempts per case, critical failure frequency, timeouts and incompleteness | Show failures and small-sample uncertainty; best-of-many success is not first-attempt reliability |
| Performance | Agent time, verifier/setup/cleanup overhead, wall-clock trial/campaign time, time per accepted result | Include failed attempts. Generated-code efficiency is a separate case-specific measure |
| Cost | Known input/output/cache/reasoning categories, observed spend, evaluator cost and consumption per accepted result | Keep provider categories distinct. Avoid double-counting cached input. Quota coverage must be explicit |

For a condition with n valid attempted trials and a accepted trials:

- Acceptance rate = a / n. If n = 0, it is undefined.
- Known agent seconds per accepted result = sum(agent seconds for **all** n trials) / a.
- Known tokens per accepted result = sum(comparable reported tokens for **all** n trials) / a.
- Either ratio is undefined when a = 0, or when any required measurement is missing.
- Report end-to-end campaign time and evaluation overhead separately from agent time.
  Costs from invalidated infrastructure attempts remain in the expenditure ledger.
- Compare currencies only within a declared conversion policy. API-equivalent
  price is not actual subscription usage or billed spend.

### Quality rubric design

Use public dimensions with anchored examples: correctness/safety, unnecessary
scope, maintainability and appropriate reuse. Score each qualitative dimension
as unacceptable / meets requirements / strong, with concrete artifact-based reasons.
A different sound implementation may receive the same score as the reference.

Blind reviewers to condition labels; randomize candidate order. Human calibration
comes before using an LLM judge for decisions. Keep judge disagreements and
uncertainty visible. A judge is a budgeted, versioned component, not a free oracle.
No paid judge is authorized by this document.

### Statistical interpretation

Estimate paired differences within the same cases and declared blocks. Present
per-case results before any aggregate. A proposed equal-case-weight aggregate
averages case effects, so extra repeats do not silently overweight a case.

Predeclare practical improvement and non-inferiority margins for the four pillars,
using task needs and budget rather than choosing thresholds after seeing results.
Use intervals on the paired contrast, not a test of whether two separate error
bars overlap. Analysis must respect repeated observations and case grouping.

For sufficient data, use a versioned grouped analysis with case/block-aware
uncertainty. For a tiny pilot, show raw outcomes and label inference insufficient;
do not produce a zero-width certainty claim from all-success bootstrap samples.
There is no universally sufficient repetition count. The pilot informs variance
and cost; confirmation uses its own frozen design and budget.

Treat A/B/C selection as multiple comparisons. Predeclare the primary contrasts
against the incumbent; confirm the selected candidate on reserved cases with an
appropriate multiplicity policy. A fixed-budget first campaign avoids repeatedly
peeking and stopping at a favorable result. A future sequential design needs its
own valid stopping/interval procedure.

| Decision label | Required meaning |
|---|---|
| Promising observation | A useful point difference worth confirmation; not established superiority |
| Supported improvement | Relevant contrast and uncertainty meet the predeclared practical criteria without unacceptable regression |
| Trade-off | A pillar improves while another worsens; show the cost of the choice |
| Regression | An unacceptable failure or supported degradation under the declared criteria |
| Inconclusive | Insufficient data, uncertainty too wide, or a difference too small to decide |
| Not comparable / partial | Inputs or coverage do not support that contrast; still report independently valid dimensions |

Absence of a detected difference is not equivalence. A lower cost is not useful if
quality/reliability falls below the required floor. Keep the current configuration
when evidence is inconclusive unless a separately stated operational reason
justifies a reversible trial.

## 8. Worked example: fictional numbers only

**These numbers are invented to verify arithmetic and interpretation. They are
not outputs of a model run and do not measure Poneglyph.** Three cases, two repeats
per case and three assigned configurations give 18 attempts. The quality floor
is assumed met for each counted acceptance; no detailed rubric score is invented.

| Case / repeat | A accepted | B accepted | C accepted |
|---|---|---|---|
| K1 / 1 | 1 | 1 | 1 |
| K1 / 2 | 1 | 1 | 1 |
| K4 / 1 | 1 | 0 | 1 |
| K4 / 2 | 0 | 1 | 1 |
| K5 / 1 | 1 | 1 | 1 |
| K5 / 2 | 0 | 0 | 0 |

| Configuration | Accepted / attempted | Total agent seconds | Total reported tokens | Seconds / accepted | Tokens / accepted |
|---|---|---|---|---|---|
| A | 4 / 6 | 360 | 48,000 | 90 | 12,000 |
| B | 4 / 6 | 300 | 36,000 | 75 | 9,000 |
| C | 5 / 6 | 450 | 70,000 | 90 | 14,000 |

B uses 25% fewer tokens than A and 16.7% less agent time, with the same observed
acceptance count. It is promising, not proven equivalent in quality/reliability.
Their failed K4 repetitions differ, illustrating why aggregate counts lose detail.

C accepts one more attempt than B: +16.7 percentage points in this example.
Its token cost per accepted result is 55.6% higher than B (14,000 / 9,000 - 1).
That is a trade-off, not an automatic victory. Six attempts spanning three cases
do not establish superiority.

If B's failed attempt has missing usage, its total/per-accepted token figure is
**unknown**, not 30,000 and not zero. If no attempts pass, ratios per accepted
result are undefined. Equal A/A labels are not expected to yield identical text.

A report should offer four aligned metric views, per-case detail, a coverage panel
and trace links. Do not average quality, seconds and tokens into a single score.

## 9. Repository decision and component boundaries

**Decision: keep the laboratory in this repository as an optional independent
tool.** No extraction is performed. This is a reversible packaging decision,
not evidence that the evaluation is scientifically valid.

| Perspective | Argument | Consequence |
|---|---|---|
| Pragmatic | Existing versioning/recovery and generators can be reused | Avoid a second release and integration workflow before the method is proven |
| Extensibility | Poneglyph versions should be inputs, not the location of the runner | Design explicit profile-source/artifact contracts and separable task packs |
| Critical | Moving Git repositories fixes neither biased tasks nor leaked answers | Prioritize observation, isolation and interpretation before packaging |

The [Claude sync folder list](../.claude/commands/sync-claude.ts) does not install
`lab` globally. Merely keeping it in this repository does not inject it into every
model conversation. However, the normal full test suite includes the laboratory's
synthetic tests, so maintenance/CI time is a real overhead to measure separately.

The [profile module](../.claude/lab/profiles.ts) imports the Claude/Codex generators;
the CLI derives the Poneglyph source root from its own directory. Those are actual
couplings to address before claiming independent packaging.

| Component | Owns | Boundary |
|---|---|---|
| Configuration under test | Poneglyph revision, selected skill/command overlays | Read-only input to the laboratory; never edits its grader |
| Laboratory | Assignment, runtime control, observation and analysis | Selects explicit input versions; not discovered as an ordinary skill |
| Fictional task repository | Frozen starts, public requirements and submission surfaces | Recreated per trial; does not contain accessible grading answers |
| Evidence store | Private traces, artifacts, grades and reports | Outside normal source publication; reviewed export only |

Future independence requires explicit source/artifact selection, ownership-aware
profile manifests, versioned task/grader contracts, and no implicit dependence on
the runner's checkout. These are design requirements, not new accepted CLI flags.

Consider extraction only when another consumer needs an independent release,
installation becomes materially burdensome, or the boundaries are stable enough
to move without copying generators. Record measured maintenance costs before
using packaging as a justification for more infrastructure.

## 10. Prioritized adaptations and acceptance of this design

| Priority | Future adaptation | Evidence required before calling it complete |
|---|---|---|
| P1 | Structured private trace and telemetry coverage. Raw stream, final text, turns, API seconds, model usage and denials are persisted since 2026-09-09 | A non-model fixture reproduces tool/load events; a normalized cross-host schema exists; missing fields stay unknown |
| P1 | Profile/answer isolation and native loading | Controlled probes show intended loading and denied access to references; recovery is demonstrated per host/platform |
| P2 | Versioned multi-module fixture and K6–K8 | References pass; known mutants fail; requirements admit alternative correct solutions |
| P2 | Four-pillar reporting and quality calibration | Arithmetic, missing data, failure accounting and blinded rubric examples are checked |
| P2 | A/A plus a small E1 pilot design | Model, budget, margins, allocation and stop rules are explicitly chosen before execution |
| P3 | Grouped analysis and reserved confirmation | Raw paired data, analysis version, uncertainty and selection policy are retained |
| P3 | Regrading saved submissions | Both old and new grader results remain immutable; no model rerun is mislabelled as necessary |
| Later | Whole-profile E2 and model/harness matrices | Attribution and budget remain clear; native systems are not mixed into a single unexplained ranking |

[Harbor regrading](https://www.harborframework.com/docs/run-jobs/regrade) demonstrates
the useful pattern of grading retained artifacts without running the agent again.
A future implementation here should preserve both grader versions and their
results rather than overwrite evidence.

### Acceptance checklist for the documentation

- Current, proposed and unverified capabilities are visibly distinguished.
- Each case names its public contract, traps, valid outcomes and scope.
- Metrics define their denominator, coverage, costs of failure and undefined values.
- Examples are explicitly fictional and their calculations can be reproduced.
- Comparisons state the varied factor, native control and limits of attribution.
- Risks cover contamination, accessible references, judge bias, unobserved activation,
  infrastructure noise, saturation, repeated-sample dependence and changing providers.
- The method allows an inconclusive outcome and does not imply Poneglyph already helps.
- Operational instructions are linked rather than duplicated.
- No implementation, installation, live campaign, paid judge or merge is performed.

**Retained lesson:** verifying an instrument and measuring a configuration's value
are different achievements. A useful laboratory must make both visible.
