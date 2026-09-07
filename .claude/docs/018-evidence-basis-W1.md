# Decision memo W1 — Orchestration II

> Each implication cites ≥1 Tier A/B finding from `evidence/W1.md` (+ seeds). C/D appears only as color, labeled. Implementation of everything below is **019+** — this memo fixes direction and constraints only.

## D1 — "Best-of-N verificado" mode: adopt as DIY pattern, pilot-grade

| Constraint | Value | Evidence |
|---|---|---|
| Mechanism | `claude -p --worktree` × N, same prompt; run project test suite in each worktree; pick green; human diff-review as tiebreak | B: CC worktrees doc (no built-in selection; `-p` worktrees leak — manual `git worktree remove` step is part of the pattern) |
| N | **2-3**, never more | A: verifier gap (seed-academic: selection plateaus); C: only measured solo run had 75% wasted attempts — cheap attempts are the enabling condition |
| Eligibility gate | ONLY hard tasks (high expected single-attempt failure) WITH a runnable check | A: SWE-bench gains exist because tests verify (seed); products without test-selection stop at human/judge picks (B: Cursor/Codex/Windsurf) |
| Do NOT build | An LLM-judge selector | B/C: Cursor 2.2 judge already drawing "manual combination beats it" reports; A: MAST flags verification as 23.5% of MAS failures (seed) |
| Status | Pilot — no public data exists for N=2-5 + test-selection interactive; our pilot GENERATES evidence | gap declared in W1 angle (a) |

## D2 — Background-sessions pilot: review-bounded, measured

| Constraint | Value | Evidence |
|---|---|---|
| Pilot size | 2-3 concurrent sessions max, **capped by same-day review capacity** | A: 2601.15195 — reviewer abandonment = top rejection pattern (38% of studied rejected sample); seed-industry practitioner ceiling 2-8 with review as bottleneck |
| Task eligibility | Well-scoped, self-contained, with runnable checks | A: Copilot issue-readiness paper (seed); B: vendor convergence on isolated-VM/worktree → PR for independent tasks |
| Metrics (MANDATORY before scaling) | merged/**all-started** (not merged/ready), rework-within-14-days, corrective follow-ups, actual-vs-forecast time | A: AIDev denominator trap; B/C: GitClear churn; A: 2601.16809 corrective share; A: METR forecast gap |
| Measurement protocol | **METR-lite (PROPOSAL only — impl 019+)**: coin-flip assignment before reading task, pre-task time forecast, ≥20-30 tasks, directional reads only | A: METR mechanics; protocol synthesis itself UNVERIFIED as instrument |
| Anti-claim | Never cite the +26% Management Science RCT for agents (it measured autocomplete Copilot) | A with refuter-confirmed scope |

## D3 — `orchestrator-protocol` heuristic upgrades

| Heuristic | Rule to adopt | Evidence |
|---|---|---|
| Progress ledger | Per-round 5-question check on any multi-step delegated work: done? looping? progressing? who next? what instruction? **Stall ≤2 non-progressing rounds → replan**, not retry | A: Magentic-One (refuter-confirmed verbatim); aligns with existing error-recovery "same error 2× → STOP" |
| Budget composition | Per-unit budgets must compose into a GLOBAL cap (delegation multiplies caps otherwise); on per-unit budget exhaustion, salvage the partial result | C: OpenHands #2121 (MAX² bug); B: SWE-agent per-instance auto-submit ($3 default; global cap does NOT auto-submit — replicate that asymmetry consciously) |
| Sizing | 3-5 workers, 5-6 tasks/worker, file-disjoint ownership; "three focused beat five scattered" | B: CC agent-teams docs (refuter-confirmed verbatim); convergent with seed-anthropic 3-5 parallel subagents |
| Delegation trigger | Delegate on **output verbosity** (would flood Lead context, summary suffices), NOT on task difficulty/size | B: CC subagents doc; D-convergent: Cognition share-context (opposite camp, same conclusion) |
| Protocol size | Keep always-on rules SHORT, binding rules FIRST — adherence decays with instruction density (68% at 500 instructions) and favors earlier ones | A: IFScale 2507.11538 — directly supports 017's always-loaded diet; future rule additions must displace, not accumulate |

## D4 — What the evidence does NOT support (guard rails)

- No measured optimum exists for the "≥4 units → fan out" threshold — it stays a convention, reviewable, not a law (declared gap, Tier C only).
- "More agents" as a quality knob: refuted for hard tasks (A: non-monotone scaling) and for coupled writing tasks (MAST + Cognition + Anthropic's own coding exclusion, seeds).
- LLM-judge selection layers: do not build (D1).

## Tensions for US6

- D1/D3 vs token cost: best-of-N and ledgers both add spend; both are gated to hard/delegated work only — flag for the roadmap's quality-first prioritization.
- D2's review-bounded cap vs the original "5-10 agents for speed" aspiration: the evidence consistently relocates the bottleneck to the human reviewer; speed comes from independence + verification, not from agent count.
