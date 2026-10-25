# Log Pose 0.3.6: fixes from the 2026-10-23 review

Source: `.claude/evals/private/log-pose-review/REPORT.md` (private; page
https://claude.ai/artifact/PmVEFQHEDm3mSUEdskGiZp). Decisions below are the user's (2026-10-23).

## Definition of done

- Every item in Phase 1 has a unit test in `plugins/log-pose/tests/core.spec.ts` (pure logic) or a
  case in `tests/native.test.ts` (`claude plugin test .`); the parity test stays green.
- `plugin.json` bumped to 0.3.6; README updated where behavior changes; `bun run doctor` clean.
- Installed with the README's update steps; one real session shows the new rows (`aborted`, `why`).
- Phase 2 glossary list approved by the user before any term is added; eval v3 precision and recall
  reported before and after (test split held out, never tuned on).

## Phase 1: code (one PR-sized change)

1. **Phase hint → block.** The first main-loop `Agent` call without `prompt-design` loaded, and the
   first `Artifact` publish without `natural-writing`, are denied once per session with the hint
   text (keep the `Log Pose: Skill(` marker so `skill-usage.ts` still counts it); the retried call
   passes. Trigger met: 13 hints, 3 followed (23 %). `register.ts:286-298`, `core.ts:phaseHint`.
2. **B1** `register.ts:188`: `r.reason === "aborted"` → outcome `superseded` (Agentic OS and the
   hook already accept it; `modFailing` ignores it). Keep `timeout` for real timeouts.
3. **B2** `register.ts:326`: write the `submit` row and the router-log line with outcome
   `superseded` before returning.
4. **B3** `register.ts:170,188,196`: carry `why` (agent file missing, `r.reason`, the caught error's
   message, cut to 120 chars) in `Classified` and the session `submit` row only (the router log
   schema stays as is).
5. **B5** `register.ts:79-80`: when the file exists and the read fails, skip the rewrite.
6. **B6** `core.ts:302-307` + hook twin: a term or variant whose sound key has ≤3 letters only
   accepts an identical key ("PRO" no longer lands on PR). Parity test updated in step.
7. **B7** `core.ts:336-341` + hook twin: dedupe fixes by folded `heard` and `meant`.
8. **B9** `register.ts:349-394`: only turns opened by a typed prompt (composer or bridge) update
   `ran` and `lastTurn`; task notifications and peer messages leave them alone.
9. **Levels** (user target ≈ low 10 / medium 50 / high 30 / xhigh 10 %). `decide()` gains the level
   the last main turn ran at:
   - hard × unclear → `high`; it becomes `xhigh` only for a `same` follow-up whose last turn ran at
     high or xhigh (escalation), or by Opus's override;
   - easy × some-doubt → `low` when `same` (a check or commit after a finished turn); `medium` when new.
   Simulated on 57 live calls since 10-22: low 14 %, medium 54 %, high 25 %, xhigh 7 %
   (today 5 / 63 / 12 / 19). Small n and ~32 % label noise: re-measure after 2 weeks with
   `turns.ts` and adjust one cell at a time.
10. **Glossary, seen today:** `Log Pose` (log pos, log pouse), `Claude` (Claudio, Claud), `prompt`
    (prom, promt, pro). `pea` stays out until it repeats.

## Phase 2: dictation mining (research, then the user's approval)

- Haiku agents, one narrow question each, over the dictated prompts in `~/.claude/projects/*` and
  the `Probable dictation fixes` notes: pairs heard → meant backed by context (an accepted fix,
  Opus saying it read X as Y, a re-ask that spells the word). Output: a table with pair, count,
  sessions and one evidence line each.
- The user approves the list; only approved pairs go into `.claude/hooks/router/glossary.json`.
- Measure with `.claude/evals/log-pose-v3.ts --split tune`, then once on the test split.

### Phase 2 result (2026-10-23)

- Mined 903 Spanish prompts (6 Haiku agents, scripts in `.claude/evals/private/dictation-mining/`):
  70 pairs. 42 already passed `soundsLike` with the glossary of the day, so the glossary was not
  the bottleneck for most; whether Sonnet proposes the fix is.
- Approved and added: `CLAUDE.md`, `submodule`, `worker`, `commit`, `merge`, `tenant`, Haiku
  variants (repo); `Jira` (personal `<config>/router-glossary.json`). Left out: one-off typed typos
  and keys of ≤3 letters (`PAC`, `CR` → PR would reopen B6).
- `s-v2` on the 74 mined prompts (in-sample, optimistic): kept 45 → 61 % of 92 pairs, proposed
  63 → 69 %. Tune split (120): 8 fixes, all right. Test split (180): 18 → 25 fixes, the 9 new all
  right, one doubtful (`orque` → Orca) gone. The mining read every transcript, so test prompts were
  mined too: the recall gain there is not independent; the precision (no false fix) holds.

## Out of scope

B4 (double write, suspected, 2/146 lines), B8 (engine), B10 (not chosen), router prompt wording
(noise), Agentic OS I2/I5/I6/J1.
