---
us: US5
title: Codex apply_patch adapter for the design-file note; Grok limit documented
wave: W4
depends_on: [US3, US4]
tdd_mode: forced
estimate: M
status: draft
---

# US5 — Codex adapter

## Execution prompt (Phase 3 input)

**Task**: Teach `native-hook.ts` to return the design-file note for a Codex `apply_patch` PreToolUse event, register the matcher in the Codex hook config, and document Codex and Grok.
**Context**: `.claude/hooks/native-hook.ts:57-68` PreToolUse handles shell tools only and returns null otherwise. Codex payload: `tool_name` `apply_patch`, `tool_input.command` = patch text with `*** Add File: <path>` / `*** Update File: <path>` lines, `session_id`, `cwd`. `.claude/scripts/lib/native-hooks.ts:30` builds `PreToolUse: [entry("PreToolUse", "Bash")]`. Tests: `.claude/hooks/__tests__/native-hook.test.ts`, `.claude/scripts/__tests__/native-hooks.test.ts` (line 42 asserts the event keys).
**Constraints**: Reuse `noteOnce({cwd, session, paths})` from US3 (hook-to-hook import, like `judgeCommand`); it owns the UI filter, lookup, marker and log write. Add `patchPaths(patch)` in `native-hook.ts`: the paths from every `*** Add File:` / `*** Update File:` line, in order. The adapter only extracts `cwd`, `session_id` and the paths, then calls `noteOnce`; it never writes the log itself. Grok returns null (passive stdout ignored). The shell branch's behavior is unchanged. Codex output: `{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"…"}}`. Codex requires `/hooks` trust after a change: document it; do not grant it. No live Codex run (spec AC5). Edit only `scripts/lib/native-hooks.ts`, never `sync-codex`/`sync-grok` (D12). The `apply_patch` group reuses the same command string as the `Bash` group; `mergeNativeHooks` keys owned handlers by command, so T5.4 must prove a second merge is identical. Out of scope: Windows parity — `entry()` emits no `command_windows`, and the new group inherits that (0 hits for `command_windows` in `.claude/`).
**Deliverable**: `patchPaths`, adapter branch, config matcher `apply_patch`, tests red→green, docs rows for Codex and Grok in `harness-adapters.md` and `hooks.md`.
**Verify**: `bun test ./.claude/hooks/__tests__/native-hook.test.ts ./.claude/scripts/__tests__/native-hooks.test.ts ./.claude/scripts/__tests__/sync-codex.test.ts` red then green; `bun .claude/hooks/native-hook.ts --check --cwd "$PWD"` passes; `bun run check:config` 0 errors.
**Ask first**: nothing.

## User story

- **As a**: Codex user
- **I want**: the same note on my first UI patch
- **So that**: the design-file step behaves the same on both hosts

## Acceptance criteria

- **AC1**: Given a Codex `apply_patch` payload that adds or updates a UI file, when `handleNativeHook("codex","PreToolUse",…)` runs, then it returns `additionalContext` with the note and no `permissionDecision`.
- **AC2**: Given a patch touching only non-UI files, or the session already noted, then it returns null.
- **AC3**: Given the same payload for Grok, then it returns null.
- **AC4**: Given `nativeHookConfig("codex", root)`, then PreToolUse has the `Bash` group and an `apply_patch` group; repeated merges stay idempotent.
- **AC5**: Given a shell command payload, then the existing judgement is unchanged.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/hooks/native-hook.ts` | `apply_patch` branch |
| `.claude/scripts/lib/native-hooks.ts` | Matcher entry |
| `.claude/hooks/__tests__/native-hook.test.ts` | New cases |
| `.claude/scripts/__tests__/native-hooks.test.ts` | Config case |
| `.claude/docs/harness-adapters.md` | Codex and Grok cells |
| `.claude/rules/paths/hooks.md` | Codex `apply_patch` note in the PreToolUse row |

## Verificación post-implementación

- Checks above green.
