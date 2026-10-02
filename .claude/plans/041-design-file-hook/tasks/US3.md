---
us: US3
title: New PreToolUse hook that notes the design file once per session
wave: W2
depends_on: [US1]
tdd_mode: forced
estimate: M
status: draft
---

# US3 — `design-file-hint.ts`

## Execution prompt (Phase 3 input)

**Task**: Create `.claude/hooks/design-file-hint.ts`, a PreToolUse hook that, on the first edit of a UI file in a session, returns a factual `additionalContext` note about the project's design file and never blocks.
**Context**: Pattern `hooks/headless-model-gate.ts` (pure exported functions, `import.meta.main` wrapper, catch-all, exit 0). Reuse `readHookStdin` (`hooks/lib/hook-stdin.ts`) and `appendLog` (`hooks/instructions-loaded.ts`). Claude input: `session_id`, `cwd`, `tool_name` (`Edit|Write|MultiEdit`), `tool_input.file_path`. Output shape: `{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"…"}}`. Lookup order from `ui-design/references/design-file.md`: `docs/DESIGN_SYSTEM.md`, `DESIGN_SYSTEM.md`, `DESIGN.md`.
**Constraints**: Exports: `isUiFile(path)` (extensions `.html .css .scss .tsx .jsx .vue .svelte`, case-insensitive), `findDesignFiles(root)` (existing names in lookup order), `buildNote(found)` (factual sentences, no imperatives; with none, names the 3 paths checked and that `ui-design` `references/design-file.md` covers extraction after a yes, using the US1 form), `alreadyNoted(logText, session)`, `noteOnce({cwd, session, paths})` — the host-neutral core: null unless some path is a UI file; otherwise looks up the design files, reads the log, checks the marker, appends the line and returns the note — and `designFileHint(payload)`, the thin Claude wrapper (tool `Edit|Write|MultiEdit`, one `tool_input.file_path`). US5 calls `noteOnce`, so the marker write lives in the core, never in the `import.meta.main` wrapper. Log `<cwd>/.claude/learned/design-file-hints.log`, line `<ISO ts> <session_id> <found|none> <first found or ->`; the line is the session marker. Non-UI path → return before any filesystem call. No imports from `.claude/scripts/` (sync trap). `ponytail:` comment on the `cwd` root (monorepo subdirectory).
**Deliverable**: Hook file + `.claude/hooks/__tests__/design-file-hint.test.ts`, red first, then green.
**Verify**: `bun test ./.claude/hooks/__tests__/design-file-hint.test.ts` red before the implementation, green after; `bun test ./.claude/hooks/` green; a spawn test pipes a payload into the script and parses stdout as JSON.
**Ask first**: nothing.

## User story

- **As a**: agent editing UI in any repo
- **I want**: to learn once whether a design file exists
- **So that**: the design-file step happens without depending on skill keywords

## Acceptance criteria

- **AC1**: Given a session's first `Edit`/`Write`/`MultiEdit` on a UI file, when the hook runs, then stdout is one JSON object with `additionalContext` naming the file found or stating none exists, and no `permissionDecision`.
- **AC2**: Given the log already holds this `session_id`, when another UI edit runs, then stdout is empty.
- **AC3**: Given a non-UI path (`.ts`, `.md`) or a non-edit tool, when the hook runs, then stdout is empty and no log line is written.
- **AC4**: Given two design files exist, when the note is built, then it names the first in lookup order and lists the other.
- **AC5**: Given a malformed payload, when the hook runs, then it exits 0 with empty stdout.
- **AC6**: Given the note text, when checked, then it contains no imperative opener ("Read", "Ask", "You must").

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/hooks/design-file-hint.ts` | New hook |
| `.claude/hooks/__tests__/design-file-hint.test.ts` | New tests |

## Casos edge

- `cwd` missing → `process.cwd()`, the same as `instructions-loaded.ts`.
- Unwritable log → note still returned; logging is best-effort, so the note may repeat in that session. `appendLog` throws on failure, and the same broken `.claude/learned` makes the log read throw `ENOTDIR`; both calls need their own `try`/`catch` (T3.8).

## Verificación post-implementación

- `bun test ./.claude/hooks/` green.
