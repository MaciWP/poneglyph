# Prompt: trim the always-loaded layer (CLAUDE.md + output style)

Paste the block below into a fresh Claude Code session opened in the poneglyph repo.

```text
Task: cut the bytes that Poneglyph loads into EVERY message, without losing any behavior rule.
Two files: the global doctrine `CLAUDE.md` (repo root; ~/.claude/CLAUDE.md is a symlink to it)
and the output style `.claude/output-styles/poneglyph.md`.

## Context (measured 2026-10-10, do not re-derive)
- First-turn context of an interactive Opus session: ~42-45k tokens. Host system prompt + tools
  are ~22.7k and out of scope. Workflow and ScheduleWakeup are already in permissions.deny.
- Output style: 7,900 B. Removing it saves 3,015 tokens per message on a headless Haiku run
  (`claude -p ... --settings '{"outputStyle":"default"}'`, compared with the base run).
- CLAUDE.md: 10,086 B, estimated ~3.9k tokens (2.6 B/token, from /context "Memory files" in
  agentic-os). Measure it before you trust that number.
- `bun run budget` reports the always-loaded total: 18,249 B (CLAUDE.md + style + skill lines).
- Haiku compacts at ~87k, so every always-loaded token weighs most on Haiku. Haiku must still
  follow the style after the cut.
- Read these memories first: feedback-rescue-value-before-pruning,
  feedback-rules-must-be-generation-executable, feedback-terse-and-scannable-compatible,
  feedback-behavioral-ac-next-session, feedback-trim-hu-tightens-ratchet,
  feedback-doctrine-no-dates-annotations, project-no-model-names-in-doctrine,
  style-lab-harness-isolation, feedback-live-evals-impractical-in-session.

## Goal and target
- Default target: combined CLAUDE.md + style ≤ 12,600 B (-30%). A rule that cannot move or
  shrink without losing behavior stays; report it instead of forcing the number.
- Allowed moves, in this order: (1) delete text that duplicates another always-loaded
  sentence (CLAUDE.md vs style, or inside one file); (2) move procedure detail that is only
  needed during a specific task into the skill that already owns that task (for example
  dev-workflow, agent-routing, harness-config); leave a one-line pointer; (3) compress wording.
- Keep in the always-loaded layer: the 10 Commandments table, Hard rules, the es-ES language
  rule, the final-answer shape (bold first line, Aviso, ROBIN), the tag table and the
  examples that make rules executable during generation.

## Steps
1. Measure the baseline. Token cost of each file via headless Haiku runs that remove one file
   at a time (style: the outputStyle setting above; CLAUDE.md: run from a temp HOME copy or
   ask me for a method if none isolates it cleanly). Record the numbers.
2. Build one table, one row per section of both files: section · bytes · verdict
   (keep / dedupe / move to <skill> / compress) · where the rule lives afterwards · risk.
   Mark every duplicate pair explicitly.
3. STOP and show me the table and the projected bytes. Wait for my approval. This is a
   doctrine change with a high blast radius.
4. After approval: apply the edits. Never hand-edit generated files (settings.json, the style
   twin `system-prompts/poneglyph-sp.md`, Codex AGENTS.md); regenerate them with
   `bun .claude/commands/sync-poneglyph.ts --execute --backup --force`.
5. Verify: `bun run budget`, then `bun .claude/scripts/budget.ts --tighten`, `bun run doctor`,
   and the same headless Haiku measurement as step 1 (before vs after tokens).
   Behavior: one A/B with `.claude/evals/compare.ts --preset style-vs-sp` (or the closest preset)
   on 3-5 prompts that exercise language, answer shape, tags and a disagreement. Report the
   diffs; do not claim behavior is unchanged from grep.

## Constraints
- No commit, push or branch change unless I ask in that turn.
- No dates, model names or plan history inside doctrine text.
- Every moved rule must still be reachable: the pointer names the skill and the section.
- Do not touch host-owned context (system prompt, built-in tools).

## Reply format
Spanish (es-ES), Poneglyph style. Step 3 reply: the table, the projected byte total vs
18,249 B, and the list of rules you refuse to cut with the reason. Final reply: bytes and
tokens before/after, doctor status, A/B findings, residual risk.
```
