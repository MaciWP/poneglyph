---
paths:
  - ".claude/hooks/**"
---

## Hooks Context

The event table below describes Claude Code. Codex and Grok use
`native-hook.ts`; see `docs/harness-adapters.md` for their contracts. Reuse shared
decisions, translate payloads and responses, and test actual stdin/stdout. Never
parse another host's transcript as Claude JSONL. Grok passive stdout is ignored;
Codex native hooks require trust. Registration alone does not prove execution.

### Shebang Gotcha (Windows / Reduced PATH)

| Shebang | Works | Alternative |
|---------|-------|-------------|
| `#!/usr/bin/env bash` | NO | `#!/bin/bash` (absolute path) |
| `#!/usr/bin/env bun` | YES | Poneglyph includes bun in PATH via the generated user settings (`settings.global.json` + machine overlay) |
| `#!/bin/bash` | YES | Absolute path, does not depend on env |

**Prefer `.ts` with bun** over `.sh`. If `.sh` is needed, use `#!/bin/bash`.

### Available Hook Events + reliability

Reliability matters because PreToolUse/PostToolUse may silently fail to fire (open issue #6305) — never use them as the *sole* gate for a critical check.

| Event | When | Reliability | Usage in Poneglyph |
|-------|------|-------------|--------------------|
| PreToolUse | Before tool | Unreliable (#6305) | Two handlers on matcher `Bash`, both best-effort (silent unless they fire). (1) `headless-model-gate.ts` — denies a `claude -p`/`--print` without `--model`, or with a Fable/Opus model (`--model`/`--fallback-model`) and no `--allow-expensive`, and a repo headless script (`evals/run.ts`, `compare.ts`, `probe-activation.ts`) with an expensive `--model`; the braces are `scripts/lib/headless.ts`. Cause: one day ran 82 headless sessions, 44 Opus + 29 Fable. (2) `bash-output-shaper.ts` — **deny** a `cat`/`sed -n` on a file >12 KB (Read with offset/limit, or Grep), **rewrite** an unbounded `git log` → `--oneline -n 30` and `ls -R`/`find`/`tree` → `\| head -n 200` via `updatedInput`; never touches tests, `git diff`, piped or redirected commands, or a line ending `# raw`. Cause: tool output was 56 % of context over 14 days, `cat` its heaviest file family |
| PostToolUse | After tool | Unreliable (#6305) | — (none registered; `code-validator.ts` was removed: fail-closed on an unreliable event; secrets covered by Stop gate) |
| Stop | End of turn | Reliable | `security-gate.ts` — quality gate (secret warn + **git-discipline warn on unasked git mutations** — both dual-channel: systemMessage to user + additionalContext to the model). Secrets channel filters type/schema RHS (`password: string;`, Zod/Django field defs) so OpenAPI-generated clients and interfaces do not cry wolf; real literals still warn. Git-discipline excludes mutations landing OUTSIDE the session cwd (disposable repos in /tmp/scratchpad — 3/3 fires in a month were that class); unresolvable destinations fail open. **Degradation canary**: the style asks every final answer to end with a line starting `ROBIN:`; the gate reads `last_assistant_message` (fallback: last text block of the turn in the transcript tail), logs `<ts> <session> ok|miss <transcript KB>` to `<cwd>/.claude/learned/canary.log` and warns the user on a miss (systemMessage only — no model re-prompt). Claude only: `native-hook.ts` Stop does not run it. `learning-inbox.ts` was removed (4 entries in 6 weeks, half noise) |
| UserPromptSubmit | On prompt submit | Reliable as event (gap early-session/post-compaction, #17277) | `skill-activation.ts` — injects `Skill(<name>)` on PRECISE keyword match (multi-word phrase alone, or ≥2 distinct single-words per skill — the length-≥5 tier was cut after measuring a 2/54 honor rate) + `/flow-lifecycle` line on feature-shaped prompts + shape-only model/effort hint, and logs every emitted hint (with the matched keyword as `reasons`) to `<cwd>/.claude/learned/skill-hints.log` (honor-rate emit side); best-effort layer. Skips non-human payloads (task-notifications, system reminders) and slash commands EXCEPT `/goal <task>` (its arg is real work) |
| InstructionsLoaded | On instruction load | Reliable as event | `instructions-loaded.ts` (async) — logs every CLAUDE.md/rules load (load-layer proof) |
| SessionStart | On every session start (incl. resume/clear) | Reliable as event | — (none registered here. Work's duplicate workspace hint was retired in the PR #3 migration; check installed caches as well as source. the `session-start-plans.ts` open-plans reminder was removed: followed 1/9 times) |
| SubagentStop | End of subagent | Reliable as event | — (none registered) |
| StopFailure | API error (rate limit, auth) | — | — |
| PermissionRequest | Claude requests permission | — | — (none registered; `auto-approve.ts` was removed: default-allow for non-Bash tools silently overrode the settings `ask` list — Workflow, MCP tools) |
| PostCompact | After compaction | — | — (none registered; `post-compact.ts` was removed: CLAUDE.md and the always-on rules are reloaded on compaction — `instructions-loaded.log` trigger `compact` — so the reminder duplicated the always-loaded layer) |
| MessageDisplay | Assistant text about to render | — | — (can transform/hide assistant message text, CC ≥2.1.152) |
| PreModelSwitch / PostModelSwitch | Before (sequential, can block) / after (async) a model switch | — | — (none registered; CC ≥2.1.251. Declined: a switch guard would be over-engineering) |

> **Stdout contract (CC ≥2.1.248)**: a stdout that starts with `{` and ends with `}` but is not valid JSON is now a reported hook error, not plain text. `security-gate.ts` prints one `JSON.stringify` object; `skill-activation.ts` prints prose that never starts with `{`.

There is no automatic test-pass validator — the Lead verifies tests manually after each build step (a Stop test-gate was declined). Never rely solely on PostToolUse for security enforcement.

> **Stop / SubagentStop feedback** (CC ≥2.1.163): both can return `hookSpecificOutput.additionalContext` to feed Claude and keep the turn going without being flagged a hook error. The security gate uses BOTH channels: `systemMessage` for the user + `additionalContext` instructing the model to verify/redact in-turn.

### `if` field for conditional filtering

```json
{"matcher": "Edit|Write", "if": "Edit(*.ts)|Write(*.ts)"}
```
