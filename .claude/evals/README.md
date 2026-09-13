# Golden-prompt evals (feature 019)

Deterministic regression harness for poneglyph's OWN named behaviors. Every constraint below is evidence-locked (018 `decision-memo-W2.md` D1/D2/D4 — Anthropic/LangSmith/Spence convergent).

## Protocol

| Rule | Value |
|---|---|
| **Cadence** | Run on EVERY meta-config change: CLAUDE.md, output-styles, rules, skill descriptions, hooks that shape behavior |
| **Expectation** | ≈100% pass. These are regression checks on behaviors that already work — not aspirational targets |
| **On any FAIL** | **SUSPECT THE EVAL FIRST** (Anthropic's own 42%→95% grading-bug incident), then the config change. Fix the grader or fix the config; never normalize a red suite |
| **ERR vs FAIL** | Live runs require an assistant turn, a terminal successful result and exit 0. Malformed streams, nonzero exits and the 120-second deadline produce ERR. Both runners drain stdout and stderr. Partial tool calls do not count as activation hits. Offline plain-text fixtures remain supported. |
| **UNVERIFIED** | `evidenceBeforeDone` cannot establish truth or executed checks from prose. These semantic cases are excluded from PASS and FAIL; they keep the report non-green. Validate them in harness-lab. `completionEvidenceMarkers` and `labelPresence` check form only; their PASS does not prove honesty, execution or routing compliance. |
| **Trials** | `trials: 2` on stochastic style criteria (pass^k — every trial must pass); 1 on deterministic-ish ones. Cap 3 |
| **Grading** | Deterministic code graders ONLY (`graders.ts`). NO LLM judge, ever — judges measured ~80% FP in-domain and run-to-run inconsistent (W2 D4) |
| **Suite cap** | ≤50 cases. Growth = one new case per NEW real documented failure, clustered (no near-duplicates). No synthetic filler |
| **Cost scope** | Config-regression only (live mode shells `claude -p` per case) — never live per-turn gating |
| **Model policy (plan 033)** | Every headless run names its model through `scripts/lib/headless.ts`: **Haiku 4.5** for prose graders and smoke, **Sonnet 5** for `skillTriggerParse` cases and activation probes. Fable/Opus are refused unless `--allow-expensive` is passed together with Oriol's this-turn permission (CLAUDE.md §Agent spawn). Reason: 2026-09-03, 82 headless sessions in a day — 44 on Opus (no `--model`, host default) and 29 on Fable — burned 24 % of the weekly quota. Read trigger deltas on the SAME model; the Sonnet baseline replaces the old Fable one |
| **Reruns** | At most ONE rerun per failed case; a second rerun is Oriol's call, not the Lead's. `--dry-run` lists the resolved commands (model included) without spawning anything |

## Running

```bash
bun .claude/evals/run.ts                                  # live: claude -p per case + grade
bun .claude/evals/run.ts cases.jsonl --offline <dir>      # re-grade stored transcripts (<dir>/<case-id>.txt|.jsonl)
bun test ./.claude/evals/                                  # grader unit suite (pure, offline)
bun .claude/evals/compare.ts "<prompt>" [--preset sp|stock|style-vs-sp|dupe]
```

`run.ts` is the regression **gate**. `compare.ts` is an exploration A/B (eyeball + markers), not a pass/fail suite — run it outside a sandboxed session.

Exit code ≠ 0 on any case failure.

## Case schema (JSONL, one per line)

```json
{"id":"...","prompt":"...","type":"skill-trigger|style|register|honesty","grader":"<graders.ts name>","expected":"<grader-specific>","trials":2,"source":"<real-failure citation — MANDATORY>"}
```

`source` is non-negotiable: a case without a traceable real-failure origin is synthetic and gets cut (spec 019 out-of-scope).

## Clusters (24 cases: 18 from the 2026-06-10 harvest + calque-19 and devloop-20 from 024-029 + skill-meta-harness-22..25 from 037)

Declared count matches documented real failures only — no filler added (the original harvest was honestly 18, not a round 20). `devloop-trivial-21` (expected `no-ceremony` on a typo fix) was cut in audit 010 (2026-09-02): commit `ca797ff` (2026-08-10) made the full KNOW→LEARN loop mandatory on every coding task, so the case contradicted the doctrine it was meant to guard. The grader's `no-ceremony` mode stays available for a future, doctrine-consistent case.

| Cluster | Cases | Grader | Failure origin |
|---|---|---|---|
| Skill triggering | skill-01..04 | `skillTriggerParse` | Native under-triggering verified in `_research-skill-activation-2026-06-09.md`; wiring lesson = `lessons` G12 (skill wiring over auto-trigger) |
| meta-harness routing | skill-meta-harness-create-22 .. consult-25 | `skillTriggerParse` | 037 AC27: create/modify/delete/consult must route to `meta-harness`, not the stubs |
| Anti-sycophancy openers | opener-05..09 | `bannedOpeners` | poneglyph.md kill-list (distilled from real feedback); hook-reliability false-claim case |
| es-ES register | eses-10..12 | `esEsDetect` | CLAUDE.md language convention; 017 translated-English debt |
| BLUF position | bluf-13..15 | `blufPosition` | poneglyph.md §2 Glance anti-examples; `lessons` G11 (brief by default, no bureaucracy) |
| Confidence labels | label-16..18 | `labelPresence` | `lessons` G9 (measure, don't estimate — 010 incident); `lessons` G10 (verified line ≠ correct fix — 014) |

## Known gaps (declared)

- **Near-miss negatives** for skill triggering (prompts that should NOT trigger) need an `expected: none` grader mode — not shipped in v1; add with the first documented false-positive trigger.
- Absolute skill-trigger rates are model/prompt-density dominated (research file: Haiku 20% / Sonnet 55% / Opus 87.5% baselines) — read DELTAS across config versions, not absolutes.
- Capability evals for individual skills → `skill-creator` harness (complementary; its trigger-isolation bias documented in W2 D3 / anthropics/skills#556).
