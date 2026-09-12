# 038 — Quality regression gate

**Status: NOT STARTED.** Phase 1 stub, parked deliberately on 2026-09-12. Nothing
depends on it; the repo is consistent without it.

## Problem

The layer has a ratchet for size and none for quality.

| Gate | Watches | State |
|---|---|---|
| `scripts/budget.ts` | The always-loaded layer does not grow | Exists, `TOLERANCE = 0` |
| `evals/graders.ts` | Formal adherence: separators, prose ceiling, certainty tags | Exists, 11 graders |
| *(none)* | Replies do not get **worse** when the style changes | Missing |

Add a byte to `output-styles/poneglyph.md` and the suite turns red. Add a norm that
degrades the answers and nothing notices. PR #20 added three norms and 208 B: the
suite proves they are obeyed, not that they help.

## Where the idea comes from

Reviewing [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) (2026-09-11/12).
Its `evals/` measures a candidate style against a baseline with a blind judge, and that
measurement caught a regression its own authors did not expect — `partial-success`, −0.63,
traced to their rule 8. Read `evals/RESULTS.md` there before designing this.

Worth borrowing:

- The weighted rubric: correctness 35 %, autonomy 25 %, actionability 20 %, safety 10 %,
  concision 10 %, scored 1-5, plus a `blocker` flag.
- The blinding in `scripts/judge.py`: the label permutation is derived from a digest of the
  group key, so reruns reproduce the same labels while the order still varies per group.
  `grader_rubric` also trims the rubric so the judge prompt does not leak the vocabulary
  the blinding hides.

**Not** worth borrowing: their release gate. It demands zero blockers in absolute terms, so
a candidate that cuts blockers from 7 to 3 still fails. Their own RESULTS.md documents the
flaw. Ours should be comparative, like the byte ratchet: correctness and safety hold at or
above baseline, weighted score improves.

## What already exists here

| Piece | File |
|---|---|
| A/B launcher for style ON vs OFF, and for the system-prompt channel | `evals/compare.ts` |
| Cases | `evals/cases.jsonl` |
| Runner with live and offline modes | `evals/run.ts` |

Missing: the rubric, the judge, a stored baseline, and the comparison rule.

## Constraints

- Live evals are one agentic session per case. The retro of `024-poneglyph-style-review`
  recorded 4 timeouts trying to run them in-session, so this is a script Oriol runs outside
  the sandbox, never a CI gate.
- Cost reference: their run was $3.59 for 14 cases × 3 trials × 2 conditions.
- Poneglyph's evals are deterministic-first and an LLM judge is forbidden for the existing
  graders (W2 D4). That decision is right for formal adherence and does not extend here:
  "is this answer better" is not measurable by regex. Scope the judge to this gate only.

## Open question before starting

Does the style keep changing? This is measurement infrastructure and it only pays while
`output-styles/poneglyph.md` is still moving. If the style settles, leave this parked.
