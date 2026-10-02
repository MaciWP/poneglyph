---
spec: 041-design-file-hook
tasks: tasks/
created: 2026-10-02
phase: 2.5
status: draft
test_mode: tdd
tdd_policy: adaptive
---

# Test specs per HU (TDD-mode)

## ¿Por qué TDD-mode?

US3 and US5 add executable hook logic: a path filter, a file lookup, a session marker and two output contracts. Each has a binary oracle that fails before the code exists. `rules/test-policy.md` §Override in plan raises both to `tdd: forced` inside `/flow-lifecycle`; the feature-level policy is `adaptive` (US1, US2 and US4 use `validations.md`).

Conventions reused: `bun:test`, temporary directories via `mkdtempSync(join(tmpdir(), …))`, and the spawn style of `native-hook.test.ts` ("reports malformed CLI payloads"). The repo has no shared hook fixture; each test builds its own temp project. New helper needed, local to the new test file: `project(files: string[])`, which creates a temp dir with the named design files. No existing helper provides it.

## US3 — tests

File: `.claude/hooks/__tests__/design-file-hint.test.ts`, importing from `../design-file-hint`.

### T3.1 — UI-file filter

- **Type**: unit
- **Pre-condition**: none.
- **Action**: `isUiFile(p)` for `src/App.tsx`, `a/B.VUE`, `styles.scss`, `index.html`, `x.svelte`, `y.jsx`, `z.css`, then `hook.ts`, `README.md`, `data.json`, `Makefile`.
- **Assert**: the first seven return `true` and the last four return `false`.
- **Must fail before impl (red)**: `SyntaxError: Export named 'isUiFile' not found in module '…/design-file-hint.ts'` (module missing → `Cannot find module '../design-file-hint'`).

### T3.2 — Lookup order and multiple files

- **Type**: unit
- **Pre-condition**: `project(["DESIGN.md", "docs/DESIGN_SYSTEM.md"])`; a second `project([])`.
- **Action**: `findDesignFiles(dir)` on both.
- **Assert**: first returns `["docs/DESIGN_SYSTEM.md", "DESIGN.md"]` (lookup order, not creation order); second returns `[]`.
- **Must fail before impl (red)**: module not found, as T3.1.

### T3.3 — Note text, found and none

- **Type**: unit
- **Pre-condition**: none.
- **Action**: `buildNote(["docs/DESIGN_SYSTEM.md", "DESIGN.md"])` and `buildNote([])`.
- **Assert**: found note contains `docs/DESIGN_SYSTEM.md` and `DESIGN.md`, and names the first as the one in use. None note contains all three lookup paths and `references/design-file.md`, plus the offer form chosen in US1. Neither note matches `/^(Read|Ask|You must|Do not|Never)\b/m` (spec AC1 factual wording).
- **Must fail before impl (red)**: module not found.

### T3.4 — Session marker

- **Type**: unit
- **Pre-condition**: log text `"2026-10-02T10:00:00Z s-1 none -\n"`.
- **Action**: `alreadyNoted(log, "s-1")`, `alreadyNoted(log, "s-10")`, `alreadyNoted("", "s-1")`.
- **Assert**: `true`, `false`, `false`. The second case shows the match is the whole session field, not a prefix.
- **Must fail before impl (red)**: module not found.

### T3.5 — First UI edit notes, the second is silent, non-UI is silent

- **Type**: integration
- **Pre-condition**: `project([])`.
- **Action**: spawn `bun .claude/hooks/design-file-hint.ts` with stdin `{session_id:"s-1", cwd:dir, tool_name:"Edit", tool_input:{file_path: dir+"/index.html"}}`, twice; then with `session_id:"s-2"`, `tool_name:"Write"`, `file_path` `notes.md`.
- **Assert**: run 1 exit 0, stdout parses as JSON with `hookSpecificOutput.hookEventName === "PreToolUse"` and `additionalContext` containing `DESIGN_SYSTEM.md`, and no `permissionDecision` key. `dir/.claude/learned/design-file-hints.log` holds exactly one line matching `/^\S+ s-1 none -$/`. Run 2 exit 0, empty stdout, still one log line. Run 3 exit 0, empty stdout, still one log line.
- **Must fail before impl (red)**: `expect(received).toBe(expected)` on exit code: bun reports `Module not found` with exit 1.

### T3.6 — Non-edit tool and malformed payload

- **Type**: integration
- **Pre-condition**: `project([])`.
- **Action**: spawn with `tool_name:"Read"` on `index.html`; spawn with stdin `{broken`.
- **Assert**: both exit 0 with empty stdout; no log file exists.
- **Must fail before impl (red)**: exit code 1 (`Module not found`), expected 0.

### T3.7 — Found file is named

- **Type**: integration
- **Pre-condition**: `project(["docs/DESIGN_SYSTEM.md"])`.
- **Action**: spawn with a `MultiEdit` payload on `src/App.tsx`.
- **Assert**: `additionalContext` contains `docs/DESIGN_SYSTEM.md`; log line ends `found docs/DESIGN_SYSTEM.md`.
- **Must fail before impl (red)**: exit code 1, expected 0.

### T3.8 — Unwritable log still returns the note

- **Type**: integration
- **Pre-condition**: `project([])`, then a plain file written at `dir/.claude/learned`, so `appendLog`'s `mkdirSync` throws (`appendLog` in `instructions-loaded.ts:40` does not catch).
- **Action**: spawn with an `Edit` payload on `index.html`, session `s-9`.
- **Assert**: exit 0; stdout parses as JSON and `additionalContext` contains `DESIGN_SYSTEM.md` (US3 edge case: logging is best-effort, the note is not).
- **Must fail before impl (red)**: exit code 1 (`Module not found`), expected 0. After a naive implementation without guards on the log read and `appendLog`, the hook's catch-all still exits 0, so the failure is `expect(stdout).toContain("DESIGN_SYSTEM.md")` on an empty stdout.

### T3.9 — Host-neutral core with several paths

- **Type**: unit
- **Pre-condition**: `project([])`.
- **Action**: `noteOnce({cwd: dir, session: "m-1", paths: ["src/util.ts"]})`; then `noteOnce({cwd: dir, session: "m-1", paths: ["src/util.ts", "web/Button.vue"]})`; then the same call again.
- **Assert**: first → `null` and no log file; second → a note containing `DESIGN_SYSTEM.md`, and the log holds one line `/^\S+ m-1 none -$/`; third → `null`, still one line. Proves the marker write is in the core US5 reuses.
- **Must fail before impl (red)**: module not found, as T3.1.

## US5 — tests

Files: `.claude/hooks/__tests__/native-hook.test.ts` (new `describe` block) and `.claude/scripts/__tests__/native-hooks.test.ts` (new `it`).

Pinned-behavior sweep: `native-hook.test.ts:20` pins `exec_command` with `git status` → `null`; it stays true. `native-hooks.test.ts:42` pins Grok's hook keys `["PreToolUse"]`; it stays true. `native-hooks.test.ts` "preserves foreign handlers" pins merge idempotence and removal; the new `apply_patch` group must pass it unchanged. No test pins `apply_patch` today (grep: 0 hits in `.claude/hooks`, `.claude/scripts`). US5 AC5 (shell judgement unchanged) has no new test: its oracle is the existing "denies …" cases and the `exec_command` → `null` case in `native-hook.test.ts`, which must stay green. `handleNativeHook` is async (`native-hook.ts:52`), so every T5 action is awaited.

Doc check (US5 docs, no test): `grep -n "apply_patch" .claude/docs/harness-adapters.md .claude/rules/paths/hooks.md` → ≥1 hit in each.

### T5.1 — Codex patch on a UI file returns the note

- **Type**: unit
- **Pre-condition**: `project([])` (temp dir, local helper as in US3).
- **Action**: `handleNativeHook("codex", "PreToolUse", {session_id:"c-1", cwd:dir, tool_name:"apply_patch", tool_input:{command:"*** Begin Patch\n*** Update File: web/index.html\n@@\n-a\n+b\n*** End Patch\n"}})`.
- **Assert**: `hookSpecificOutput.hookEventName === "PreToolUse"`, `additionalContext` contains `DESIGN_SYSTEM.md`, no `permissionDecision`.
- **Must fail before impl (red)**: `expect(received).not.toBeNull()` — received `null`, because today's branch returns null for non-shell tools.

### T5.2 — Add File path parsed; non-UI patch and repeat are silent

- **Type**: unit
- **Pre-condition**: fresh `project([])`.
- **Action**: a patch with `*** Add File: src/util.ts` only (session `c-2`); then a patch with `*** Add File: src/util.ts` and `*** Add File: src/Button.vue` (session `c-3`), twice.
- **Assert**: first → `null`; second → note; third (same `c-3`) → `null`. Also `patchPaths("*** Begin Patch\n*** Add File: a.ts\n*** Update File: b/C.vue\n*** End Patch\n")` equals `["a.ts", "b/C.vue"]`.
- **Must fail before impl (red)**: the second call receives `null`, expected an object; `patchPaths` fails with `SyntaxError: Export named 'patchPaths' not found`.

### T5.3 — Grok gets nothing for the same payload

- **Type**: unit
- **Pre-condition**: fresh `project([])`.
- **Action**: `handleNativeHook("grok", "PreToolUse", {sessionId:"g-1", cwd:dir, toolName:"apply_patch", toolInput:{command:"*** Update File: index.html\n"}})`.
- **Assert**: `null`, and no log file written.
- **Must fail before impl (red)**: none — this test passes before and after. It guards against the Codex branch leaking into Grok. Kept because it pins AC3 of US5, not counted as red evidence.

### T5.4 — Codex config carries the apply_patch group, merge stays idempotent

- **Type**: unit
- **Pre-condition**: none.
- **Action**: `nativeHookConfig("codex", "/source")`; `mergeNativeHooks(merged, desired)` twice; `nativeHookConfig("grok", "/source")`.
- **Assert**: Codex `hooks.PreToolUse.map(g => g.matcher)` equals `["Bash", "apply_patch"]`; the second merge equals the first; Grok PreToolUse matchers equal `["Bash"]`.
- **Must fail before impl (red)**: `expected ["Bash", "apply_patch"], received ["Bash"]`.
