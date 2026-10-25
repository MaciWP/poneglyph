# log-pose eval v3: one call, five decisions

Status: proposed. Precedes learning-loop.md (parked) and the model choice.

The call now makes five decisions at once: dictation fixes, skills, difficulty (→ effort),
uncertainty (→ advisor gauge) and continuity. The eval so far scored skills only, on 64 + 59
cases. v3 scores all five, on real prompts, with gold labels from more than one source, and
compares models with paired statistics.

## Questions (pre-registered)

| Id | Question | Decides |
|---|---|---|
| Q1 | Which arm is best per decision and overall, at what cost and latency? | The model |
| Q2 | Does Sonnet with no thinking match Haiku with thinking? | Whether thinking is worth its latency |
| Q3 | Does asking five things at once hurt any of them (joint vs single-task prompts)? | One call or two |
| Q4 | Does predicted difficulty match what the turn really cost? | Whether the effort matrix holds |
| Q5 | Do runs agree with themselves (flip rate)? | How much a single run can be trusted |

## Arms

| Arm | Call |
|---|---|
| H-low | Haiku, effort low |
| H-med | Haiku, effort medium |
| H-high | Haiku, effort high |
| S-none | Sonnet, effort low (measured 2026-10-15: output = JSON length, no thinking) |
| Hook | Current hook (skills, fixes and the effort reason only) |

Ablation for Q3: H-high and S-none with the router-only prompt (no rubric) and with a
rubric-only prompt (no catalog).

## Dataset

- Source: main-session prompts from the last 60 days, all projects (665 transcripts).
- Size: about 600 prompts, stratified by project, length, task type (question, build, fix,
  review, ship, write) and dictation noise (glossary variants present or not).
- Split by time: the oldest 40 % tunes, the newest 60 % tests. This mirrors deployment and
  blocks leakage better than even/odd.
- The 146 labelled router cases stay as an anchor set, so v3 stays comparable with v2.
- Each case carries what the turn really did (below), extracted once and frozen in
  `.claude/evals/private/v3/`.

## Gold labels, per decision

| Decision | Source 1 (automatic) | Source 2 (judge) | Source 3 (user) |
|---|---|---|---|
| Skills | Named by the user or called by the Lead (current method) | Judge reads prompt + catalog | Anchor set labels |
| Dictation | Glossary variants in the prompt → their term | Judge lists misheard terms | 40 dictated prompts |
| Difficulty | What the turn cost: tool calls, files edited, duration, failed checks | Judge reads prompt + a summary of the turn (hindsight) | 60 stratified prompts |
| Uncertainty | Loop-backs, user corrections ("no, eso no"), questions asked, advisor calls that changed course | Same hindsight judge | Same 60 prompts |
| Continuity | Same session and adjacent prompt, same files touched | Judge reads both prompts | Same 60 prompts |

- The judge is checked against the user's labels first (Cohen's kappa ≥ 0.6 per decision).
  Below that, that decision's gold is the user's subset only.
- Hindsight matters: the router sees only the prompt, but the gold may use what happened
  after. That measures real usefulness, not agreement with another prompt-only model.

## Metrics

| Decision | Metric |
|---|---|
| Skills | hit@3, label recall, precision, false positives on negatives |
| Dictation | Fix precision and recall on gold pairs; harmful fixes (a correct word changed) |
| Effort | Accuracy and macro-F1 on difficulty; easy↔hard swaps; under-effort on turns that failed or looped (regret); over-effort cost |
| Advisor gauge | Recall of gauge ≥ 2 on turns that changed course; gauge 0 on turns that went straight |
| Continuity | Accuracy, recall on `same` |
| All | Latency p50/p95/max, timeouts, output tokens, cost warm and cold, invalid JSON |

## Protocol

- 3 sequential runs per arm (parallel runs skew latency).
- Paired comparisons on the same cases: McNemar for binary hits, bootstrap 95 % confidence
  intervals for rates and deltas. A difference counts only when its interval excludes zero.
- Flip rate per arm: share of cases whose answer changes between runs.
- Cost from the reported usage and the official prices (Haiku 5.5 and Sonnet 5.5, 2026-10-15).
- The tuning split may change prompts; the test split runs once per final arm.

## Deliverables

- `.claude/evals/log-pose-v3.ts`: build, judge, run, score (reuses router-heldout parsing).
- A report page: per-decision tables, cost/latency/quality frontier, confidence intervals.
- A recommendation: model and effort, one call or two, matrix changes if Q4 says so.

## Cost and time

| Item | Estimate |
|---|---|
| Arm runs: 5 arms × 3 runs × ~360 test prompts + ablations | Haiku < 2 $, Sonnet ~ 4-6 $ |
| Judge: ~600 prompts with turn summaries | Sonnet ~ 6 $; Opus ~ 30 $ (needs explicit permission) |
| The user's labels | ~60 prompts, about 30-40 minutes, in a page with buttons |
| Build and runs | ~3-4 h of work |

## Risks

| Risk | Mitigation |
|---|---|
| The judge shares the arms' bias | Hindsight inputs, kappa against the user's labels |
| Proxies of difficulty (tool calls, duration) reflect the Lead's effort, not the task's | Combined with the judge; Q4 reports their agreement |
| Private prompts leave the machine | Only to Anthropic models, as the router already does; files stay in the gitignored folder |
| Overfitting the tuning split | Test split runs once per final arm |

## Results: the mod's own prompt (`s-v2`, test split, 3 runs)

`s-v2` is Sonnet `low` with the prompt `parseAgentFile` builds (agent sections plus `LABELS`,
`REPLY_LINE`, `EXAMPLES`, labels last in the reply) and the `soundsLike` filter. `s-none` is the
study's Sonnet (agent body plus `RUBRIC`). Two tuning iterations on the tune split; the test split
ran once per arm. Report: `.claude/evals/private/v3/report-test-v2.json`.

| Metric | s-v2 | s-none | Hook | Always medium | Threshold | Met |
|---|---|---|---|---|---|---|
| hit@3 | 72 % | 71 % | 69 % | – | Δ lower bound ≥ −5 (got −4) | ✅ |
| FP on empty | 20 % | 13 % | 20 % | – | ≤ 13 % | ❌ accepted |
| Dictation precision | 90 % | 67 % | – | – | ≥ 80 % | ✅ |
| Dictation recall | 43 % | – | 38 % | – | ≥ hook | ✅ |
| Difficulty accuracy | 74 % | 62 % | – | – | – | +12, p < 0.001 |
| Effort accuracy | 62 % | 60 % | – | 46 % | – | – |
| Under-effort | 24 % | 32 % | – | 37 % | ≤ 20 % | ❌ |
| Two-level jumps | 4 % | 8 % | – | 12 % | ≤ 3 % | ❌ |
| Output tokens | 194 | 165 | – | – | ≤ +30 % (got +18 %) | ✅ |
| Invalid replies | 3 | – | – | – | 0 | ✅ after `jsonObject` |
| p95 latency | 3.0 s | – | – | – | warn > 3.5 s | ✅ |

Effort split, s-v2 vs gold: low 11/18 %, medium 62/46 %, high 22/24 %, xhigh 4/12 %. High or
not: 81 % s-v2, 73 % hook. Run-to-run flips: 39 % of decisions (22 % of skill sets), against
23 % and 10 % for s-none.

Decision (the user, 2026-10-16): activate the rewrite although under-effort and two-level jumps
miss their thresholds, since s-v2 beats both "always medium" (today) and the study arm on every
effort metric; accept 20 % FP on empty prompts. The default Opus effort is `medium`, because any
other session level acts as a floor (`floorOf`) and would hide the mod's lower choices.

Lessons:
- With the labels first in the reply, Sonnet dropped skills on follow-ups (iteration 1). Labels
  last, and present in every example, fixed it.
- Sonnet without thinking sometimes writes a corrected second JSON object: parse the last one.
- The 0.6 `soundsLike` threshold was set on glossary variants and invented pairs, never on the
  test split.
