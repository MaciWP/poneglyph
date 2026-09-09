# Laboratory final review: instrument, method and what remains unknown

Status: independent fresh-context review, 2026-09-09. Code snapshot
[b0638e0](https://github.com/MaciWP/poneglyph/tree/b0638e010bd7839909c863beb3f8d4157374b209)
on `feat/reproducible-lab` with `origin/main` `5ebbe2b` merged. Draft PR #6 is not merged.

The [methodology](lab-methodology.md) is left unchanged so that this review remains
distinguishable from it. No code, fixture, evaluator, installed configuration, Git or PR state
was modified. No model, agent, subagent or headless session was started. Local documentation
changes present in the workspace (`docs/lab-methodology.md`, the README link) were read as the
current publication candidate.

What was read: the methodology, the [laboratory README](../.claude/lab/README.md), the plan 036
records (`spec.md`, `pr-review.md`, `native-validation.json`, `state.json`, `tasks/US10.md`),
every laboratory module and its tests, `.claude/settings.global.json`, the Claude sync folder
list, and the local report receipts. One offline measurement was performed: the size of the
initial-to-reference change per scenario. Primary sources were rechecked on 2026-09-09
(section 10).

## 1. Verdict

| Object | Verdict | Basis |
|---|---|---|
| Instrument: runner, oracle, store, recovery | Sound for what it tests. Versioned inputs, calibrated independent grading, honest failure bookkeeping and journaled recovery are implemented and tested offline. Native acceptance is still `not_run` in all six host/platform cells. | Section 4; [native record](../.claude/plans/036-reproducible-lab/native-validation.json) |
| Proposed method | Largely sound and unusually candid about its limits. Four gaps block meaningful measurement: bank saturation (H1), no behavioral trace (H2), reachable references and labels (H3), an undeclared permission envelope (H5). | Section 3 |
| Poneglyph's value | Unknown. Nothing has been measured. The current bank and runner cannot answer the question even if a campaign ran today. | Section 2 |

The laboratory can already run a controlled, versioned, recoverable comparison with
independent grading. It cannot yet tell whether Poneglyph helps, for four reasons that compound:

1. No trial has run natively. Every native cell is `not_run`.
2. The five cases are one-line fixes in a 19-line file, and the correct patterns are present in
   the same file. Any frontier model passes them with any configuration. Quality and
   reliability will not separate conditions.
3. The runner receives the full `stream-json` transcript on stdout and keeps five fields from
   it. Natural configuration use is therefore unobservable.
4. Reference solutions, previous results and the condition label are within reach of the agent
   process. A positive result would be attackable.

The bias matters more than the gaps. On trivial tasks a configuration can only add cost. A first
campaign on K1 to K5 would most likely conclude "Poneglyph costs more tokens and time with no
quality difference". That conclusion would be an artefact of the bank, not a measurement of
Poneglyph. The same bank is still useful as a regression and overhead bank once the gaps
are closed.

## 2. What remains unknown about Poneglyph's actual value

- Whether the installed configuration loads at all in a `claude -p` trial. Only the file swap is
  verified. The `system/init` event that would show loaded plugins and tools is discarded.
- The fixed overhead per trivial task in tokens and seconds. This is the one thing K1 to K5 can
  measure, and it has not been measured.
- Whether skills are invoked naturally, how often, and which ones. No trace exists.
- Any effect on multi-file navigation, reuse or root-cause repair. No such case exists yet
  (K6 to K8 are proposals).
- The noise floor between two identical configurations on this machine and provider.
- Anything about Codex, Grok, macOS or other models.
- Subscription quota consumption. The instrument cannot observe it (H8).

## 3. Findings

Severity: Major blocks meaningful measurement. Medium distorts attribution or fairness. Minor
limits interpretation. Info is a watch item. "Inferred" means derived from code paths and
documentation, not observed in a live session.

| Ref | Severity | Finding | Evidence | Consequence | Recommendation |
|---|---|---|---|---|---|
| H1 | Major | **The bank saturates by construction.** The reference fix is one line in `ownership` (149 to 174 characters), `queries` (259 to 221) and `batch_import` (`apply()` to `db.transaction(apply)`), the three-line `create` template in `creation`, and zero lines in `no_op`. The file has 19 lines. The correct patterns sit in the same file: the title-validation expression inside `importNotes`, `Store.transaction`, the reference `listNotes` shape. | [catalog.ts:3-7](../.claude/lab/catalog.ts#L3), [catalog.ts:38-55](../.claude/lab/catalog.ts#L38); measured offline | Quality and reliability cannot separate conditions. Only overhead differs, and overhead can only be positive. Anthropic's own guidance: "Make sure the problems are hard enough"; an eval at 100% "provides no signal for improvement". | Keep K1 to K5 as a regression and overhead bank. Build and calibrate K6 to K8 before any quality claim. |
| H2 | Major | **No behavioral trace is persisted, although the evidence already arrives on stdout.** The Claude stream is decoded into `terminal`, `text`, `model`, `usage` and `apiEquivalentUsd`; the stream and the final text are dropped. stderr is never kept. `--no-session-persistence` removes the native transcript. The stream carries `system/init` (model, tools, plugins loaded), every `tool_use`, `result.permission_denials`, `modelUsage`, `num_turns` and `duration_api_ms`. | [runner.ts:125-136](../.claude/lab/runner.ts#L125), [process.ts:27](../.claude/lab/process.ts#L27), [adapters.ts:15](../.claude/lab/adapters.ts#L15); Claude Code headless documentation | Available, loaded and acted cannot be distinguished. Natural skill use cannot be audited. A difference cannot be explained. K5's "explain that" criterion cannot be graded. | Mandatory. Write the raw stream to `runs/<id>/stream.jsonl` (mode 0600) and the final text to `final.txt`. Persist `permission_denials`, `num_turns`, `duration_api_ms` and the whole `modelUsage`. The workspace is already ignored by Git. |
| H3 | Medium | **References, previous results and the condition label are reachable from the agent's working directory.** `objects/scenario/<hash>.json` stores `reference` as plain text four directory levels above `work/`. Sibling runs expose `work/src/service.ts` and `evaluation.json` with hidden check names. The run directory is named `ownership.t1.current`, so the label is in `cwd`. `Read` outside the working directory is denied under `dontAsk`; `Bash` is allowed by the adapter and by the user's allow list. Inferred, not observed. | [runner.ts:74](../.claude/lab/runner.ts#L74), [runner.ts:103](../.claude/lab/runner.ts#L103), [store.ts:51](../.claude/lab/store.ts#L51), [store.ts:82](../.claude/lab/store.ts#L82), [catalog.ts:65](../.claude/lab/catalog.ts#L65) | A positive result is attackable. The methodology's own rule "use opaque trial paths" is not implemented. | Materialize `work` under an opaque random name outside the reach of `objects/` and other runs, or store `reference` in a kind never co-located with runs. Keep the mapping in `results.json`. Cheap. |
| H4 | Medium | **Model attribution silently degrades to `null`.** The adapter records the model only when `modelUsage` has exactly one key. The user's common settings define `CLAUDE_CODE_SUBAGENT_MODEL` and a `fallbackModel` list, so any fallback or subagent produces two keys and `null`. `compare()` skips `null` when checking "Resolved models differ". | [adapters.ts:42](../.claude/lab/adapters.ts#L42), [report.ts:33-34](../.claude/lab/report.ts#L33), [settings.global.json:5-15](../.claude/settings.global.json#L5) | A trial that fell back to another model is treated as comparable. | Persist the whole `modelUsage`. Treat an unknown or multi-model trial as non-comparable, or flag it in the comparison. |
| H5 | Medium | **The permission envelope is inherited from the user's settings, not declared by the experiment.** The adapter passes six tools in `--allowedTools`. The effective envelope comes from `permissions.allow` in `settings.json`, kept as common configuration in every profile: `Skill`, `WebFetch`, `WebSearch`, `AskUserQuestion`, `SendMessage`, a context7 MCP pattern. `Agent` and `Workflow` are `ask`, which `dontAsk` denies. The Skill tool requires permission, so skills work only because the user's list contains `Skill`. Real use runs `defaultMode: auto`; trials run `dontAsk`. | [adapters.ts:15](../.claude/lab/adapters.ts#L15), [profiles.ts:70](../.claude/lab/profiles.ts#L70), [settings.global.json:17-37](../.claude/settings.global.json#L17), [settings.global.json:60](../.claude/settings.global.json#L60); Claude Code permissions and tools reference | A trimmed settings file or another user would measure "Poneglyph with its skills blocked" and never know, because denials are not persisted. | Declare the envelope in the adapter: add `Skill` explicitly; decide `WebFetch` and `WebSearch`. Persist `permission_denials` (H2). Document `dontAsk` versus `auto` as a declared trial condition. |
| H6 | Medium | **K2 says "Reject", the oracle requires a thrown error.** An implementation that returns `null` for an invalid title fails `invalid-create-no-write`. K4 says "must throw" explicitly; K2 does not. | [catalog.ts:33](../.claude/lab/catalog.ts#L33), [oracle.ts:71](../.claude/lab/oracle.ts#L71) | A valid reading of a public requirement is penalized. | Change the K2 prompt to "throw". This changes the scenario hash; recalibrate. |
| H7 | Minor | Statistics are absent. `acceptancePoints` is a mean paired point difference. Repeats across executions are not pooled. Declared honestly in the methodology. | [report.ts:36](../.claude/lab/report.ts#L36) | No decision can be claimed from `compare` alone. | Nothing for the pilot. Later, a CSV export of paired rows for external analysis. |
| H8 | Minor | The cost pillar cannot observe subscription quota. `total_cost_usd` is a client-side estimate according to the documentation. Reported tokens by category are the only persisted proxy. | [adapters.ts:42](../.claude/lab/adapters.ts#L42) | Weekly availability is outside the instrument. | State tokens as the primary cost proxy. A manual usage reading before and after a campaign is a coarse external note, not a measurement. |
| H9 | Minor | Network and MCP are inside the envelope (`WebFetch`, `WebSearch`, context7) although the fixture needs no network. | [settings.global.json:25-32](../.claude/settings.global.json#L25) | External latency and content variance enter time and cost. Outside research is legitimate Poneglyph behavior, so it must be recorded, not hidden. | Record the network policy in the campaign record. Keep it equal across conditions. |
| H10 | Minor | Maintenance overhead is unmeasured. Laboratory tests run in the full suite and the commit hook; the CLI test has a 90-second cap. The laboratory is not synced globally. | [cli.test.ts:16](../.claude/lab/cli.test.ts#L16), [sync-claude.ts:14-24](../.claude/commands/sync-claude.ts#L14) | Real but bounded cost. No context cost in ordinary sessions. | Measure suite time with and without `.claude/lab`. Split the laboratory tests from the commit hook only if the difference is material. |
| H11 | Info | Two headless runners exist: the [golden-prompt evals](../.claude/evals/README.md) with the model gate, and the laboratory's `commandFor`. Purposes differ: style regression versus task outcomes. | [adapters.ts:10-16](../.claude/lab/adapters.ts#L10) | Commandment IX watch item, not a defect. The laboratory already requires an explicit model. | Keep the purposes distinct. Do not let either grow into the other. |
| H12 | Info | The `D:\PYTHON\poneglyph` checkout at the same HEAD has the whole laboratory staged as deleted in its index (72 status entries; files present on disk). Not touched by this review. | `git status` in that checkout | A sync or commit from that checkout could drop the laboratory. | Reconcile that index before any operation from `D:\`. |

## 4. What holds

These design choices were verified in code and tests and should be kept as they are.

| Property | Where | Note |
|---|---|---|
| Content-addressed inputs and integrity hashes on results | [store.ts:49-63](../.claude/lab/store.ts#L49), [runner.ts:76](../.claude/lab/runner.ts#L76) | Hashes detect accidental change, not an adversary. Stated correctly in the README. |
| Calibration before any swap: initial fails, reference passes | [runner.ts:82-91](../.claude/lab/runner.ts#L82) | Reference trees are removed after calibration; only results stay. |
| Independent verifier with nonce, frozen `Store`, separate process, restricted environment | [worker.ts](../.claude/lab/worker.ts), [oracle.ts:43-50](../.claude/lab/oracle.ts#L43) | Measures the supplied connection only. A submission opening its own SQLite connection would bypass the query counter; the independent readback would still catch actual writes. Inferred, not observed. |
| Seeded IDs defeat fixture hardcoding; intermediate failure state inspected before retry | [oracle.ts:28-56](../.claude/lab/oracle.ts#L28) | Oracle v2 row-change checks close the replay and invalid-title write classes. |
| Failed attempts stay in every ratio; missing measurements yield `null`, never zero | [report.ts:8-11](../.claude/lab/report.ts#L8) | |
| Factor discipline and common-configuration equality across conditions | [store.ts:71-72](../.claude/lab/store.ts#L71), [runner.ts:23](../.claude/lab/runner.ts#L23) | |
| Randomized condition order inside each (case, trial) block | [store.ts:79-82](../.claude/lab/store.ts#L79) | Case order is fixed and serial; see C7. |
| Journaled swap that never overwrites originals; conflicts kept | [transaction.ts:98-127](../.claude/lab/transaction.ts#L98) | Native acceptance on a real home is still pending. |
| Base profile keeps authentication, policy and common settings and strips every behavioral layer | [profiles.ts:163-166](../.claude/lab/profiles.ts#L163) | Strips Poneglyph and third-party layers alike; attribution needs the inventory, as the methodology says. |
| Submitted `work/` tree retained per run | [runner.ts:109](../.claude/lab/runner.ts#L109) | A blinded diff review is possible later without running a model again. This is the local equivalent of Harbor's regrade pattern. |

## 5. Mandatory, optional, unnecessary

| Class | Item | Closes |
|---|---|---|
| Mandatory before meaningful measurement | M1 Persist the raw stream, final text, `permission_denials`, `num_turns`, `duration_api_ms` and full `modelUsage` per run | H2, H4 |
| Mandatory | M2 Opaque work directories out of reach of `objects/` and other runs; no co-located reference | H3 |
| Mandatory | M3 Declare the permission envelope in the adapter, with `Skill` explicit; record `dontAsk` as the trial mode | H5 |
| Mandatory | M4 Native swap and restore drill accepted on Claude/Windows (the US10 cell that gates any live run) | AC8 |
| Mandatory for any quality claim only | M5 K6 to K8 built, with references passing and mutants failing | H1 |
| Optional | K2 wording "throw" (H6); CSV export of paired rows (H7); network policy line in the campaign record (H9); suite-time measurement (H10) | |
| Unnecessary now | Harbor or Inspect integration; an LLM judge; grouped statistical model or bootstrap; VM isolation for the first pilot; multi-host or multi-model matrix; a regrading command; the campaign record as a CLI schema | Would consume effort before the instrument has produced one trace |

M1 to M3 are small, bounded runner changes. They are prerequisites, not features. M4 is
already planned as US10. M5 is the only large item and it is only needed for the quality pillar.

## 6. Corrections to the methodology

The methodology is accurate in most places. The following statements are unsupported,
overstated or incomplete as written.

| Ref | Methodology text | Correction |
|---|---|---|
| C1 | §4 "Hidden checks test public requirements, not secret rules" | True except K2, where "reject" is graded as "throw" (H6), and K3, where the exact result fields rest on "Preserve all other behavior". Spell both out in the prompts. |
| C2 | §2 H9 "verifier code lives outside the writable task directory" | Understates reachability. The reference is in the same laboratory root, four levels above `work/`, readable with `Bash`. Sibling runs expose submissions and check names. Add the concrete paths (H3). |
| C3 | §6 "Use opaque trial paths rather than advertising a winner" | Not implemented. The run path embeds the condition label. Mark it as a gap, not a rule already followed. |
| C4 | §7 Cost "observed spend" | Spend is never observed. Claude's figure is a client-side estimate. Rephrase to "reported tokens and API-equivalent estimate". |
| C5 | §5 "The assigned profile is the treatment, even when the agent does not read the changed skill" | Correct, but it depends on H2. Without a trace the read or invoke rate cannot even be reported as a diagnostic. |
| C6 | §3 Anthropic row | Add the explicit guidance that tasks must be hard enough and that capability evals start at a low pass rate. It applies directly to K1 to K5. |
| C7 | §2 "The schedule randomizes condition order inside each case/repetition block" | Correct for conditions. Case order is fixed and execution is serial, so time drift confounds cases, not conditions. Say so. |
| C8 | §7 "Current `accepted` is executable-check acceptance" | Also state that the `critical` flag has no effect on acceptance: every check must pass ([oracle.ts:13](../.claude/lab/oracle.ts#L13)). The report's critical-failure column is informational. |
| C9 | §5 native control N "still includes ... declared common tools/provider settings" | Add "the user's permission allow-list and `env` block". They are part of every condition, including N, and they decide whether skills and network are usable at all (H5, H9). |

Statements verified as accurate: §2 H1 to H8 and H10; §9 couplings
([profiles.ts:6-7](../.claude/lab/profiles.ts#L6), [cli.ts:88](../.claude/lab/cli.ts#L88));
the 1 to 10 repetition limit ([store.ts:67](../.claude/lab/store.ts#L67)); the demo's
synthetic nature; the characterization of every rechecked external source (section 10).

## 7. Repository and tool boundary

Decision: keep the laboratory in this repository as an optional, independent tool. The settled
decision stands; no contrary evidence was found.

| Angle | Evidence | Weight |
|---|---|---|
| For extraction | Poneglyph versions should be inputs, not the runner's location | Valid as a design constraint; the profile and store formats already treat them as inputs |
| Against extraction now | `profiles.ts` imports the sync generators and `cli.ts` derives the source root from its own directory | Extraction would force a public generator API before the method has produced a single trace |
| Neutral | `lab` is not in the Claude sync folder list, so it costs no session context; the only measurable cost is suite time (H10) | Measure that cost before using packaging as an argument |

Revisit only when a second consumer appears or the suite-time measurement is material.

## 8. Smallest useful next step

An A/A pilot on Claude/Windows with saturation and noise measurement, after M1 to M4.

| Element | Decision |
|---|---|
| Question | Does the pipeline produce comparable, trace-backed results for two identical configurations, and does the current bank saturate for the chosen model? |
| Conditions | Two condition IDs pointing to the same frozen `current` profile hash, same prompt version, `factor: profile` |
| Cases and trials | The five existing cases, one trial each, serial: 10 attempts |
| Model and budget | The cheapest tier the repository's own headless policy allows, chosen by Oriol. No model or budget is authorized by this review |
| Prerequisites | M1 trace persisted; M2 opaque work directories; M3 declared envelope; M4 `drill` on the real home with `native_swap_restore: passed` recorded for Claude/Windows |

Acceptance criteria:

1. Execution state is `finished-restored` and the original configuration digest is verified.
2. Every run has a `stream.jsonl` whose `system/init` lists the plugins and tools expected from the
   installed profile. This is the first "loaded" evidence.
3. `compare(A, A2)` returns `comparable: true`.
4. Saturation count is reported: cases passed by both copies. If it is 5 of 5, the quality pillar
   is uninformative on this bank for this model, and K6 to K8 precede any current-versus-base
   quality run.
5. Noise floor is reported: per-case range of agent seconds and reported tokens between copies.
6. `permission_denials` contains no `Skill` denial.
7. No `Bash` command in any trace touches `objects/` or another run directory.

What it does not answer: anything about Poneglyph versus native. If budget allows, add `base` as
a third condition in the same run to obtain a first overhead estimate. That extension changes
nothing in the acceptance criteria above.

## 9. Residual uncertainty and unperformed checks

- No live run, no native swap, no `lab doctor` was executed. All native cells remain `not_run`.
- H3 reachability is inferred from directory layout and documented permission behavior, not
  observed in a session.
- H4 multi-model `modelUsage` behavior is inferred from settings and documentation, not observed.
- Whether personal skills in `~/.claude/skills` load in `-p` mode rests on the headless
  documentation ("loads the same context an interactive session would, including ... `~/.claude`").
  Not observed.
- Laboratory suite wall time and the size of a captured profile on this machine were not measured.
- Five external sources were not rechecked (section 10).
- The Spanish HTML report was checked for overstated wording by search, not read in full.
- The `--bare` flag was considered and rejected as a native control: it skips hooks, skills,
  plugins and `CLAUDE.md`, but it also switches authentication to an API key, which changes billing
  and possibly rate limits. That would change the evaluated system.

## 10. Sources rechecked on 2026-09-09

| Source | Confirmed | Used for |
|---|---|---|
| Claude Code CLI reference | `--allowedTools` is a permission allow-list, not an availability filter; `--tools` restricts availability; `--no-session-persistence` disables saving sessions in print mode | H2, H5 |
| Claude Code permissions | `dontAsk` auto-denies tools unless pre-approved; `AskUserQuestion` denied even if allowed; read-only tools still prompt outside the working directory | H3, H5 |
| Claude Code tools reference | Skill tool requires permission; Agent launch does not prompt, its tool calls are checked | H5 |
| Claude Code headless guide | `stream-json` carries `system/init` (model, tools, plugins), `permission_denials`, `total_cost_usd` as a client-side estimate; `-p` loads the same context as an interactive session; `--bare` skips discovery and needs an API key | H2, H8, section 9 |
| Anthropic, Demystifying evals for AI agents (2026-01-09) | Capability versus regression evals; saturation hides improvement; "Make sure the problems are hard enough"; LLM graders need human calibration; pass@k versus pass^k | H1, C6 |
| Anthropic, Infrastructure noise (2026-02-05) | 6 percentage-point gap on Terminal-Bench 2.0 between resource setups; memory enforcement drives infrastructure error rates | Methodology §3 row confirmed |
| Inspect eval logs | Per-sample transcript with events and model usage; epochs aggregated through reductions | Shape for `stream.jsonl` and repeat handling |
| Harbor regrade | "The recorded agent execution is held fixed; only the verdict is recomputed"; "Source trials and jobs are never modified" | Section 4, retained `work/` |
| METR uplift update (2026-02-24) | Selection effects, unreliable time measurement with parallel agents, "only very weak evidence" | Methodology §3 row confirmed |
| Not rechecked | OpenAI evaluation guide, SWE-bench harness, Harbor task format, Microsoft metric pitfalls, NIST randomized blocks | Generic use in the methodology; low decision relevance |

## Appendix: review questions answered

| Group | Short answer |
|---|---|
| A. Fitness | The bank distinguishes overhead, not quality (H1). Conclusions apply to a 19-line Bun/SQLite service with single-function fixes. Claiming personal value from it exceeds the evidence in every pillar except cost overhead. K6 to K8 target behavior Poneglyph can plausibly affect; K1 to K5 barely do. Each experiment isolates the declared factor (store and runner checks). The base profile removes all behavioral layers, Poneglyph and third-party alike; a candidate draft can remove only Poneglyph. The native control preserves authentication, policy and common settings, plus the user's allow-list and env (C9). Model, harness, environment and task versions are distinguished; resource limits and cache policy are recorded only as an environment hash. Reproducibility and determinism are correctly separated in §2. |
| C. Evaluator | Requirements are public and fair except K2 (H6). Alternative implementations pass through the `Store` facade. Calibration covers initial, reference and eight mutant classes. References and prior results are reachable (H3, inferred). Agent tasks and instrument tests are correctly separated in §4. |
| D. Observability | Verified: no trace, no final text, no denials persisted (H2). Available and outcome are instrumented; loaded and acted are not. Tool counts are not collected, so they cannot be rewarded. Failed attempts and verifier time are accounted for; delegated-worker usage would appear in `usage` but `Agent` is denied under `dontAsk`. Quality is executable checks only; the retained `work/` tree enables a later blinded rubric. Cost claims are appropriately limited to tokens and API-equivalent estimates; quota is unobservable (H8). |
| E. Statistics | A/A proposed, not run. Blocks randomize conditions within (case, trial). Comparisons are paired by case and trial. Repeated-case dependence is declared and not modeled. With five cases there is nothing to hold out. Saturation is the dominant risk (H1). `compare` refuses incomplete coverage and never filters by skill use, so selection bias is structurally avoided. Fixed budget and refusal of interrupted executions prevent peeking. The method can return "inconclusive". No sample size is invented. |
| F. External methods | Mechanisms borrowed correctly: fixed states and verifier separation, transcript plus outcome grading, epochs as grouped repeats, regrading from retained artifacts. Reuse: the current runner, store and oracle. Simplify: no framework integration, judge or statistical model before the first trace. Overhead: unmeasured suite time (H10), no global sync. Integrations must preserve the native harness; `--bare` and direct API evals change the evaluated system. |

Retained conclusion: the instrument is promising and honest. It cannot yet answer whether
Poneglyph adds value. Close M1 to M4, run the A/A pilot, then decide whether K6 to K8 are
worth building.

## Addendum, 2026-09-09, after the review

Implemented the same day in the working tree, uncommitted, engine hash changed:

| Item | Change | Addresses |
|---|---|---|
| M1 | Every attempt keeps `stream.jsonl` (raw host stdout) and `final.txt`; rows carry `numTurns`, `apiSeconds`, full `modelUsage` and `permissionDenials`. stderr is still dropped. `--no-session-persistence` is kept; the stream replaces the native transcript | H2 |
| M1 | `compare()` requires the same set of resolved models on both sides and refuses a completed live row without one | H4 |
| M2 | The agent works in an opaque OS temporary directory outside the laboratory root; the tree is copied to `runs/<id>/work` after grading, also on failure | H3, C3 |
| M3 | `Skill` is in the Claude adapter's declared envelope; README states the envelope and `dontAsk` | H5 |
| K2 | Prompt says "Throw an error for invalid titles before any write" | H6, C1 |
| Docs | README and methodology (H5, H9, §4 K2, §5 E2, §6, §10 P1) updated with dated notes | C2, C4 partially, C9 |

Verified: 55 laboratory tests pass, strict types pass, `native-hook --check` passes, and the
`demo` flow shows the retained stream, final text and work tree with no temporary directory
left behind. Not changed: H1 (bank saturation), M4 (native drill), M5 (K6 to K8), H7 to H12.
The findings table above still describes snapshot b0638e0. The cross-device copy path of the
retention step ran only on one volume in tests.
