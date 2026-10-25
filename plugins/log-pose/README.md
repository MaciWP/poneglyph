# Log Pose

Native Claude Code mod that replaces Poneglyph's async `prompt-router.ts` hook on Claude. One
Sonnet call (`low` effort, 8 s timeout) per typed prompt, before the model starts, returns the
dictation fixes, up to three skill candidates and three labels. The labels pick the reasoning
effort of the turn's main Opus steps and an advisor gauge. Codex and Grok keep the hook.

## Load

Requires Claude Code **2.1.299** or later: since that build `turn.start` also fires for
subagents, and the mod skips those turns. The mod API is early access.

Poneglyph's root `.claude-plugin/marketplace.json` lists the mod. Enable `log-pose@poneglyph`
in the machine overlay, run `sync-poneglyph`, then `claude plugin install log-pose@poneglyph`.
For a single session: `claude --plugin-dir /absolute/path/to/poneglyph/plugins/log-pose`.
The installed mod runs from `~/.claude/plugins/cache/poneglyph/log-pose/<version>`, not from
this folder: a source change needs a version bump in `plugin.json`, `claude plugin marketplace
update poneglyph`, `claude plugin update log-pose@poneglyph` and a new session.

While the mod is enabled and installed and `<config>/agents/prompt-router.md` exists, the hook
stays silent (`modRoutes`). It takes over again for the session once the mod's last three calls
failed (`modFailing`). Disable the mod in the overlay and sync to return to the hook.

## How it decides

- **Prompt.** Built in memory from the synced router agent (its intro and the `fixes:`,
  `process:` and `skills:` sections, plus the glossary and catalog) and the mod's own `LABELS`,
  `REPLY_LINE` and `EXAMPLES` in `hooks/core.ts`. One rule source for skills and dictation. If
  the agent loses a section, the mod falls back to the agent body plus `RUBRIC` and logs
  `prompt: "fallback"` on the session row.
- **Reply.** Keys in order: `task`, `fixes`, `process`, `skills`, `difficulty`, `uncertainty`,
  `continuity`. The labels go last: placed first, they made Sonnet drop skills on follow-ups.
  When Sonnet writes a corrected object after the first one, the last parsable object wins.
- **Dictation.** A fix counts only when `meant` is a glossary term or a catalog name and `heard`
  sounds like it, one of its variants or, for a catalog name, one of its parts of 4+ letters
  (`landsOn`, `soundsLike`: Spanish sound folds plus Levenshtein, 0.6; a sound key of three
  letters or fewer needs an identical key, so `PRO` no longer lands on `PR`). A fix said twice is
  kept once. The hook uses the same filter.
- **Effort.** `MATRIX` maps difficulty × uncertainty to `low`, `medium`, `high` or `xhigh`
  (never `max`) and a gauge 0-3, from each prompt's own labels. No cell gives `xhigh`: hard ×
  unclear is `high`, and becomes `xhigh` only on a same-task follow-up whose last typed turn ran
  at `high` or `xhigh`, or by the override. Easy × some-doubt is `low` on a same-task follow-up
  (a check or a commit after a finished turn) and `medium` when new. The target mix is about
  low 10 / medium 50 / high 30 / xhigh 10 %. A follow-up is labelled with
  `<last-turn>` in view (the previous main turn's level, steps, tool calls, whether it was
  interrupted and the end of its answer; a task notification's turn does not replace it), so Sonnet rates the work still left: it lowers the
  level after a hard turn that ended, and holds it when the hard part is still open. Continuations (`sigue`, `ok`, `vale`…) and prompts that did not come from
  the composer or a bridge keep the last level without a call. A prompt typed over a running
  turn keeps that turn's level and gets only dictation fixes. A session level other than
  `medium` is a floor, read from the settings until a step names it; when it overrides the
  mod's level, the note names both and one toast per session says so. The mod rewrites `effort`
  on every main Opus step; subagents and other models are untouched.
- **Session.** After `/clear` or a resume the process goes on under a new id with no
  `session.start`; the mod sees the new id on the next prompt and drops the old conversation's
  loaded skills, previous prompt, decision and override.
- **Cache guard.** If the prompt cache breaks twice on an effort change, the mod stops
  rewriting and steers with words instead (`steer` mode, also forced by
  `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`).
- **Override.** The model calls `mcp__log-pose__set` with a level, or `auto`, when the mod
  picked the wrong one; it applies from the next step of the running turn.
- **Phase hints.** The first main-loop `Agent` call of a session without `prompt-design` loaded,
  and the first `Artifact` publish without `natural-writing`, are refused once with a line naming
  the skill (`phaseHint`); the repeated call passes. A `prompt-router` launch is exempt. Hints
  were followed 3 times in 13 before the block (0.3.5). The doctor's Skills row counts the refusals
  from the transcripts.
- **Memory.** `<past>` holds the three most similar earlier prompts from
  `<config>/router-memory.jsonl` (rebuilt every 6 h by the hook's `memory.ts --build`): the
  skills used for each and, after `declined:`, the ones the main model turned down in its
  `Router:` line and did not load within two hours. A skill first called after the turn's first
  edit is not learned for that prompt.

## Logs

| File | Contents |
|---|---|
| `~/.cache/poneglyph/log-pose/<session>.jsonl` | session, submit (with `skip` when no call, and `why` when the call failed), other (another origin), step, override, hint (`blocked`), complete and end rows, appended when a turn or the session ends |
| `prompt-router.log` (the hook's resolved `learned/` folder) | one `via=mod` line per call, the hook's format plus `floor`, `read` and `write`; `effort` is the mod's own level. `timeout` is a call that ran to the limit; a call cut sooner (Escape, a newer prompt) is `superseded`, which `modFailing` ignores |

## Tests and eval

```sh
bun test ./plugins/log-pose/tests/core.spec.ts
bun test ./.claude/hooks/__tests__/log-pose-parity.test.ts
claude plugin test plugins/log-pose   # native.test.ts: bun cannot load claude-code/testing
```

The parity test keeps the mod's copies of the hook's parsing, note and memory code equal to the
hook's. The classifier eval is `.claude/evals/log-pose-v3.ts` (`LOG_POSE_EVAL`, `LOG_POSE_MODEL`,
`LOG_POSE_EFFORT`, `LOG_POSE_TIMEOUT`, `LOG_POSE_PROMPT=fallback` select the arm) scored by
`log-pose-v3-score.ts`.
