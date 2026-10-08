---
spec: 041-design-file-hook
phase: 5
retro_level: full
retro_level_reason: two decisions absorbed in review (Bash matcher, CLAUDE_PROJECT_DIR root) and a legitimate spec drift
verdict_phase4: APPROVED_WITH_WARNINGS
spec_drift: legitimate
promotions_proposed: 4
promotions_approved: 4
commandment_violations: 2 (⚠️ I, ⚠️ III)
living_spec_delta: applied (AC1, user decision 2026-10-02)
action_items: 5
created: 2026-10-02
status: approved
---

# Retro — 041 design-file hook

## Summary

Problem (spec.md): "The first UI edit of a session tells the agent, as a fact, whether the project has a design file, without depending on skill keywords."

Delivered: a non-blocking PreToolUse hook (`design-file-hint.ts`) on `Edit|Write|MultiEdit|Bash` for Claude, the same note on Codex `apply_patch` through `native-hook.ts`, a tightened `ui-design` step 0, and the docs rows. Always-loaded bytes stayed at Δ0.

How it went: friction, then a pivot inside review. The extraction offer went from 0 of 4 (US1 baseline) to 2 of 4 (review round 1) to 4 of 4 (round 2). Review took three rounds: US3 was closed 4 times and US4 3 times (`state.json` `reopen_history`).

## Technical lessons

### ✅ Patterns that worked

- **A factual hook note instead of more skill text.** US1's A/B on skill text alone gave 0 of 2 offers; the hook note gave 4 of 4 once it fired on every channel. Reuse: when a skill rule must hold on a concrete tool event, put a factual note on that event.
- **One host-neutral core.** `noteOnce` serves the Claude wrapper and the Codex adapter; the Codex branch needed no logic of its own (T5.1–T5.4).
- **Fresh-context reviewer.** The `claude-sonnet-5-5` reviewer found the `cwd` MAJOR that the inline round 1 missed (review.md §Round 3).
- **Offline replay of live evidence.** Replaying every tool call of the 4 round-2 sessions through the final code (`scratchpad/replay-r2.ts`) confirmed 4 of 4 without new probes, after the budget was spent.
- **TDD red per repair.** Each reopen has its red file (`US3r2-red.txt`, `US3r2b-red.txt`, `US3r3-red.txt`), so no repair landed without a failing test first.

### ❌ Patterns that didn't work

- **Matcher scoped to edit tools.** Headless agents edited UI files with `sed -i` and a python heredoc (2 of 5 round-1 runs), so the hook never fired. Avoid: an edit-detection hook covers `Bash` from the start, or the spec states why not.
- **Payload `cwd` taken as the project root.** It follows the agent's `cd` (code.claude.com/docs/en/hooks); `CLAUDE_PROJECT_DIR` stays at the root. Avoid: read the hook input contract for each field before using it.
- **Tokenizer tested only on positives.** The hook fired on this session's own heredoc that listed `.html .css` (live false positive, `reopen_history` entry 3). Avoid: test the obvious negatives (bare extensions, URLs) together with the positives.
- **Byte-trim HU verified without the ratchet rule.** US2's trim left `ui-design` 4 bytes below its snapshot, and `budget.test.ts` fails below the snapshot too; US2/US4 verification missed it (`verification-US5.json`, check `budget.test.ts`). Avoid: a HU that trims an always-loaded or skill file runs `budget.ts --tighten` in its own verification.
- **Planned file lists drifted.** US5 closed with `scripts/__tests__/native-hooks.test.ts`, `harness-adapters.md` and `hooks.md`, none of them in `tasks/US5.md:38-44`. Avoid: update the HU's file table when a file joins mid-HU.
- **Phase skills rebuilt from memory after compaction.** [session-transcript evidence] After a compaction the phase procedure was reconstructed instead of loaded; the user then required an explicit `Skill(flow, "<phase>")` per phase. Avoid: invoke the phase skill on every phase entry, compaction included.

## Process

| Phase | Effort | Friction observed | Improvement candidate |
|---|---|---|---|
| 1 scope | S | none; brief came from retro 039 | — |
| 2 plan | S | US5 file table incomplete | update the file table on a mid-HU addition |
| 2.5 test plan | M | oracle measured only the edit tools' channel | require the channel coverage question for hook oracles |
| 3 build | M | ratchet below-snapshot rule missed | `--tighten` in trim HUs |
| 4 review | XL | 3 rounds, 2 reopen cycles, 9 headless runs | read hook input semantics in KNOW |

Heaviest phase: review. The cause sits upstream: two assumptions made in build (edit tools are the only channel, payload `cwd` is the root) were only tested live in review. Review did its job; KNOW in US3 did not.

## Drillme — Phase 5

1. `[approach]` Review weighed more than needed, for the upstream reason above; the three rounds themselves were proportionate to real findings.
2. `[failure]` Avoidable friction: the `cwd` MAJOR (one doc read in US3) and the bare-extension false positive (one negative test).
3. `[context]` Reusable pattern: hook input fields need their documented semantics, and edit-detection needs every edit channel. Both apply to any Claude Code hook.
4. `[location]` Global: the hook pack of `harness-config` is where hook authors look. The ratchet rule is local to this repo.
5. `[failure]` Silent violation: the first round-3 assessment said `checks: passed` while `review.md` recorded a red gate; the advisor caught it before the verdict was recorded (⚠️ III below).

## Promotion candidates

| Candidate | Scope | Type | Why (evidence) | Concrete proposal |
|---|---|---|---|---|
| H1 Hook input gotchas | global | skill reference | `cwd` MAJOR and the Bash-channel MAJOR (review.md rounds 1 and 3); `t05-hook.md` has no `CLAUDE_PROJECT_DIR` mention (grep, 0 hits) | `.claude/skills/harness-config/references/t05-hook.md` — two gotcha lines: "payload `cwd` follows `cd`; the project root is `CLAUDE_PROJECT_DIR`" and "edit-detection must cover `Bash` (`sed -i`, heredocs), or say why not" |
| H2 Trim HUs tighten the ratchet | memory | memory | US2 trim left `ui-design` below snapshot; caught only in US5 | new memory: a byte-trim runs `budget.ts --tighten` in its own verification; below-snapshot is a failure too |
| H3 Replay instead of re-probing | memory | memory | round-3 X1–X2 verified offline, 0 extra runs (review.md §Round 3) | new memory: after a code change, replay the recorded tool calls of the full session transcripts (`~/.claude/projects/<slug>/<session>.jsonl`; stream-json lacks hook output) through the new code |
| H4 Explicit phase skills after compaction | memory | memory update | [session-transcript evidence] procedure rebuilt from memory after compaction | extend `feedback-skill-wiring-over-autotrigger.md` with the compaction case |

Discarded: a `lessons-learned` row for the Bash matcher would cover the same ground as H1; one place is enough. Eval case: none proposed. The ❌ lessons are code-design gaps of a hook, and `cases.jsonl` graders score response behaviour; the regression cases are the unit tests T3.10–T3.13.

## Living-spec deltas

Applied in review with the user's decision ("Enmendar AC1", 2026-10-02): AC1 reads "first touches a UI file (an edit tool, or a UI path in a Bash command)", with the v2 note in `spec.md`. Legitimate: the Bash channel was a real edge case found in review, it serves the spec's intent (the note reaches the agent at the start of UI work), and the finding is documented in review.md round 1.

## Commandments check

| # | Result | Evidence |
|---|---|---|
| I | ⚠️ | US3 used payload `cwd` without reading its documented semantics; found by the fresh reviewer |
| II | ✅ | AC3 measured live (0 → 2 → 4 of 4); `cwd` semantics confirmed against the official hooks doc; round 3 verified by replay |
| III | ⚠️ | First round-3 assessment wrote `checks: passed` next to a recorded red gate; corrected to `failed` before any verdict, then `passed` after the user's exclusion decision |
| IV | ✅ | Red file before every repair; 489 hook tests; no test edited to pass |
| V | ✅ | `noteOnce` shared by both hosts; no duplicate lookup code |
| VI | ✅ | `sensitive:` declared before each `settings.global.json` edit; the hook never blocks |
| VII | ✅ | One log line per session in `.claude/learned/design-file-hints.log` is the marker and the record |
| VIII | ✅ | Execution prompts scored with `prompt-design`; reviewer prompt built to Arch H |
| IX | ✅ | Always-loaded Δ0; `hooks.md` and `harness-adapters.md` updated in the same HU |
| X | ✅ | 11 headless runs (2 A/B, 1 pre-probe, 5 review round 1, 4 round 2) and 1 reviewer, each approved with an explicit `claude-sonnet-5-5` |

### Forensics — ⚠️ I

- When: US3 build, first version of `designFileHint`.
- Alternative path: read the PreToolUse input table in code.claude.com/docs/en/hooks for `cwd` before using it as the root.
- Action: H1 puts the gotcha where hook authors read.

### Forensics — ⚠️ III

- When: closing review round 3, before the verdict call.
- Alternative path: derive `checks` from the X5 row as written, then ask the user about the out-of-scope row.
- Action: the verdict helper only reads the JSON, so the Lead compares `review.md` checks and the assessment before every `verdict` call.

## Action items

| Action | Owner | Trigger | Due |
|---|---|---|---|
| A1 Decide the `pr-comments` growth (`budget.ts --update` or trim) | user | before any commit | plan part D |
| A2 🟢 Applied H1–H4 (t05-hook.md gotchas; 2 new memories; skill-wiring memory extended) | Lead | user ratification 2026-10-02 | done |
| A3 🟢 Working set archived to `_archive/041-design-file-hook/`, untracked, README row added (no commit) | Lead | user authorization 2026-10-02 | done |
| A4 Codex shell edits get no note | next session | a Codex run edits UI files through `exec_command` | when seen |
| A5 Monorepo subdirectory design files are missed (`ponytail:` in `noteOnce`) | next session | a project keeps its design file below the root | when seen |
