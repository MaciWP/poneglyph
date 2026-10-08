---
id: 041-design-file-hook
created: 2026-10-02
mode: full
phase: 1
status: closed
approved: 2026-10-02
closed: 2026-10-02
---

# Problema

With no design file in a repo, the agent never offers to extract one: 0 offers in four runs of 039 (retro 039, review r1–r4). Two causes stack. The `ui-design` step 0 only runs when the skill loads, and loading depends on keywords that hit 0/11 held-out prompts. When it does load, the offer loses the report's single `Aviso:` slot to other warnings (hypothesis H1, r3 transcript).

# Resultado esperado

- The first UI edit of a session tells the agent, as a fact, whether the project has a design file, without depending on skill keywords.
- With no design file, the end-of-task report carries a visible extraction question for the user, and nothing is written before a yes.
- With a design file, the agent names it in the report (AC5 of 039 keeps passing).
- The same behavior on Claude Code and Codex; Grok's limit is documented.

# Success criteria (medibles, Given/When/Then)

- **AC1**: Given a session in a project, when the agent first touches a UI file (an edit tool, or a UI path in a Bash command), then the agent receives, once per session and project, a factual note stating which design file exists (`docs/DESIGN_SYSTEM.md`, `DESIGN_SYSTEM.md`, `DESIGN.md`) or that none does. The edit is not blocked. _v2 — delta from review 041-design-file-hook (Bash matcher: a UI path in a shell command counts as contact; user decision 2026-10-02 "Enmendar AC1")._
- **AC2**: Given the same session, when the agent edits more UI files, or edits a non-UI file at any time, then no note is added.
- **AC3**: Given a project with no design file, when the agent finishes a UI task, then the report contains an extraction question for the user on its own line, and the project shows no design file, directory or stub. Measured on the V7.6 prompt plus 3 held-out UI prompts written before the first run: ≥3 of 4 runs pass.
- **AC4**: Given a project with a design file, when the agent finishes a UI task, then the report names that file (V7.6 "with" run).
- **AC5**: Given Codex, when an `apply_patch` edit touches a UI file, then the same note reaches the model through Codex's PreToolUse `additionalContext`. Verified by the adapter contract test; a live Codex run is not part of this feature.
- **AC6**: Given the always-loaded layer (CLAUDE.md, rules, output style), when the feature closes, then its byte count has not grown (`budget.ts`).

# Out of scope (explícito)

- Blocking the edit (deny once, ask). The user chose a non-blocking note on 2026-10-02.
- Grok: it discards passive hook output. Its limit is documented, not worked around.
- A persistent "already told" marker across sessions. The note fires once per session and project.
- The quality of the extracted design file itself (039 format stays as is).
- The look of the HTML outputs (feature 040, reserved number).
- Re-tuning skill keywords: retro 039 showed it overfits.

# Constraints

- **Note wording is factual, not imperative**: command-style hook text can trigger the model's prompt-injection defenses and get surfaced to the user instead of used. Source: https://code.claude.com/docs/en/hooks §Add context for Claude.
- **Timing**: on Claude Code, PreToolUse `additionalContext` lands next to the tool result, so the first edit is already applied when the note is read. Same source.
- **Codex**: PreToolUse fires for `apply_patch` edits and accepts `hookSpecificOutput.additionalContext`. Source: https://learn.chatgpt.com/docs/hooks.
- **PreToolUse is unreliable** (issue #6305): the note reinforces `ui-design` step 0 and never replaces it. Source: `.claude/rules/paths/hooks.md`.
- **Synced hooks cannot import from `.claude/scripts/`** (broken in clones). Source: memory `feedback-sync-trap-hook-script`.
- **Headless probes**: about 8 `claude -p` runs approved on `claude-sonnet-5-5`, model set on every run (user decision 2026-10-02).
- `bun test ./.claude/hooks/` and `bun test ./.claude/scripts/__tests__/` stay green; `settings.global.json` edits need a `sensitive:` declaration.

# Open questions

- None that change scope. H1 (where the offer line goes) is tested in phase 2 with a 2-run A/B before the hook is built.

# Decisiones (scope questionnaire, 2026-10-02)

| Question | Answer |
|---|---|
| Block the first UI edit? | No: inform without blocking |
| Hosts | Claude Code + Codex (Grok documented) |
| Frequency | Once per session and project |
| Numbering | 041; 040 stays reserved for the glance redesign |

Cuestionario reducido por brief detallado: problem, outcome and out-of-scope came from retro 039 and the approved plan; 3 questions asked.
