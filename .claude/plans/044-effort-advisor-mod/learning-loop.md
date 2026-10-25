# log-pose learning loop and eval v2

Status: §1 built in 0.3.0 (`declined:` in `<past>`, with the two-hour guard); §2 deferred: 60 days
of router notes held 15 accepted fix pairs, and the only 2 seen in 2+ sessions were already
glossary variants. Build §2 when a month of notes gives 5+ new pairs seen in 2+ sessions.
Follows plan.md "Decisión v3" and the 2026-10-15 model comparison.

## Goal

The router gets better with use, never worse, and the mod loses nothing the hook had:

1. Skills: each week it picks more of the skills the user really uses.
2. False positives: a skill the Lead keeps declining for a kind of prompt stops being suggested.
3. Dictation: misheard words that keep coming back grow the glossary by themselves.
4. Speed: with better examples the model reaches its answer with fewer output tokens.

Definition of done: eval v2 shows each memory helps (ablation), no arm adds false positives,
the weekly report shows the four trends, and everything stays under 1 % of the weekly spend.

## What exists

| Signal | Source | Used today |
|---|---|---|
| Skills the Lead called or the user named | transcripts → `router-memory.jsonl` (`memory.ts --build`, every 6 h) | yes, `<past>` (3 most similar prompts) |
| The Lead's `Router: x sí/no (why)` | transcripts (`skill-usage.ts` parseRouterAnswers) | counted only |
| The router's `fixes` off the glossary | router reply | dropped |
| Output tokens per call | mod usage | logged, not used |

## Design

All learning runs in the detached memory builder (`memory.ts --build`), never in the prompt path.
The mod and the hook only read its files. Shared by Claude, Codex and Grok.

### 1. Negative memory (false positives)

- A turn where the router suggested skill X, the Lead answered `Router: X no`, X was not loaded
  in that turn and the user did not name it: the entry records `declined: [X]`.
- `<past>` shows it: `- "<prompt>" → used: a · declined: X`. The router prompt gains one line:
  a skill declined for a very similar past prompt needs a clear new reason.
- Guard: a decline counts only if no later turn of the same task loaded X (the Lead was wrong).

### 2. Self-growing glossary

- The mod logs every raw fix (`heard → meant`) to its calibration log, kept or dropped.
- The builder promotes a pair to `<config>/router-glossary.learned.json` when:
  - `meant` is a known term (a skill, plugin, repo or glossary name, or a word the user typed
    in a later prompt of the same session), and
  - the same pair appears in at least 2 sessions.
- Never edits the core or personal glossary; the learned file is a third layer, loaded live
  (the mod already merges glossaries live). `report.ts` lists new terms so the user can veto.

### 3. Progressive skill detection

- Positive memory stays as is (called or named, never the router's own picks: no self-reinforcement).
- `<past>` grows from 3 to 5 examples, mixing positives and negatives, ranked by similarity.

### 4. Faster thinking

- No direct lever (Haiku 5.5 takes no thinking budget). Better `<past>` examples are the lever;
  eval v2 measures output tokens per arm and per memory variant.

### 5. Guards

- Input stays far from Haiku's 100k price step: measured 9.3k p50, 10.6k max. Caps: prompt
  3,000 chars (exists), `<past>` 5 × 300 chars, extra catalog 30 entries × 600 chars.
- A learned file that fails to parse is ignored, never fatal.

## Eval v2

Same held-out cases (even half for test, odd for tuning), with memory built only from entries
older than each case (no leakage, `router-heldout.ts --memory`).

| Arm | Model and effort |
|---|---|
| H-low | Haiku low |
| H-med | Haiku medium |
| H-high | Haiku high |
| S-low | Sonnet low (measured: no thinking, output = JSON length) |

Each arm × memory variant (none, positive, positive + negative), 2 sequential runs (no parallel
runs: they skew latency).

| Metric | Bar |
|---|---|
| hit@3, label recall | ≥ hook (50-51 / 64) |
| False positives on negatives | ≤ hook (8 / 23) |
| Dictation fixes: precision on glossary cases | ≥ hook |
| Effort labels vs the user's 40 labelled prompts | ≥ 70 % difficulty, 0 easy↔hard |
| Latency p50 / p95 / max | max ≤ 15 s, 0 timeouts |
| Output tokens | reported per arm and memory variant |
| Cost per prompt (warm, cold) and per week (~550 prompts) | < 1 % of weekly spend |

Estimated cost of eval v2: under 3 $ (Sonnet is most of it).

## Order of work

1. Mod: log raw fixes and output tokens; cap the extra catalog; `<past>` with declines.
2. Builder: negative entries and learned glossary, with tests on recorded transcripts.
3. Eval v2: memory variants in `--from` mode, the 4 arms, the report.
4. Pick the model with the numbers; then activation (plan.md Fase E).

## Risks

| Risk | Mitigation |
|---|---|
| The memory learns the Lead's mistakes | Declines only without a later load; positives never from router picks |
| A wrong glossary pair spreads | 2-session threshold, known-term rule, separate file, veto in the report |
| Leakage inflates eval v2 | Memory cut by timestamp per case, as the hook eval does |
| More `<past>` slows the call | Measured in eval v2 (output tokens and latency) |
