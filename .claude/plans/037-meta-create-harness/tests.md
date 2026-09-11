---
spec: 037-meta-create-harness
tasks: tasks/
created: 2026-09-10
phase: 2.5
status: approved
test_mode: tdd
tdd_policy: optional
approved: 2026-09-10
---

# Test specs per HU (TDD-mode)

## Why TDD-mode?

Project policy is `auxiliary`. Inside `/flow`, US2 and US4 change executable behavior
(`check-config.ts`, eval case inventory), so they are `tdd: forced`. Other HUs are
docs/packs → `validations.md`.

## Classification

| HU | Mode | Why |
|---|---|---|
| US1 | validation | Rename, stubs, sweep, budget snapshot. `rank.ts` is a map key, not new logic. |
| US2 | **TDD** | Extends `validate()` for `.claude/agents/*.md`. |
| US3 | validation | Golden pack + templates. Instantiated templates reuse existing `check:config`. |
| US4 | **TDD** | Four jsonl rows are an inventory oracle; live `claude -p` is not CI. |
| US5–US18 | validation | Type packs. `tdd-skip: documentation pack`. Gate coverage for T3 lives in US2. |

Untestable: none. Property-based: reuse existing `it.each` length table on agents; no new generator.

## Assumptions baked 2026-09-10 (Oriol: three hosts + “todo cumpla las reglas” + shared collision)

| Id | Decision | Evidence |
|---|---|---|
| A1 | Markdown agents (Claude + Grok): `name` matches filename stem. Codex TOML: `name` is the identifier; filename match is convention only (official subagents page). | Vendor Codex vs project skill convention |
| A2 | Scan **definition files**, not `[agents]` / `[subagents]` global tables: `.claude/agents/*.md`, `.grok/agents/*.md`, `.codex/agents/*.toml`. Missing dirs are no-op. Personas (`.grok/personas/*.toml`) are **not** this scan. | Codex: custom agents are standalone TOML; `[agents]` = caps/defaults. Grok: agents are `.md`; personas are a different type (US6). |
| A3 | No skip: markdown without YAML → `metadata.parse`. Empty/missing `description` → `metadata.description`. Codex TOML also requires nonempty `developer_instructions` (vendor MUST). | Oriol: control so every agent fulfills the rules. |
| A4 | Agent `name` values join the existing skill/command collision set (all three hosts). | Oriol pick |
| A5 | Git does not track empty directories: “no dir” and “empty dir” are the same Map. | Git |

Pinned existing tests to keep green: `check-config.test.ts` description 1–1024 and
name 64; `graders.test.ts` T3.8–T3.9 `skillTriggerParse`. No current test puts
agent markdown in `source()` and expects it to be ignored.

Reuse: `source()`, `errors()`, `skill()`, `validate()` from
`.claude/scripts/__tests__/check-config.test.ts`.
New helper needed: `agent(stem, description, extra)` writing
`.claude/agents/${stem}.md`. No existing fixture covers agents.

---

## US2 — check-config AC20 agents (three hosts) + D29 (no 500)

Helpers: keep `source()`, `errors()`, `skill()`. **New** (none exist today):
`claudeAgent(stem, description, extra)` → `.claude/agents/${stem}.md`
`grokAgent(stem, description, extra)` → `.grok/agents/${stem}.md`
`codexAgent(fileStem, { name, description, developer_instructions })` → `.codex/agents/${fileStem}.toml`

Default skill stays in every fixture so `inventory.empty` does not fire.

### T2.1 — Valid Claude + Grok markdown agents pass

- **Type**: unit
- **Pre-condition**: default skill + `.claude/agents/reviewer.md` and `.grok/agents/reviewer.md` with matching `name`, nonempty description ≤1024, nonempty body.
- **Action**: `errors(source({ ... }))`
- **Assert**: no `metadata.name` / `metadata.description` / `metadata.parse` on those paths.
- **Must fail before impl (red)**: those paths are skipped today, so a **bad** agent also returns `[]`. Pair with T2.2 as the real red.

### T2.2 — Missing YAML or empty description is an error (A3)

- **Type**: unit
- **Pre-condition**: default skill; one Claude agent without `---` YAML; one Grok agent with `description: ""`.
- **Action**: `errors(...)`
- **Assert**: no-YAML path → `metadata.parse`; empty description → `metadata.description`.
- **Must fail before impl (red)**: `[]` (paths skipped).

### T2.3 — No agent files is a no-op

- **Type**: unit
- **Pre-condition**: `source()` with only the default skill; no agent keys.
- **Action**: `errors(source())`
- **Assert**: unchanged vs today; not `inventory.empty` from missing agents.
- **Must fail before impl (red)**: already passes. Non-regression pin against a mistaken empty-inventory error.

### T2.4 — Markdown `name` matches stem (A1)

- **Type**: unit
- **Pre-condition**: `.claude/agents/reviewer.md` with `name: other` (repeat once for Grok).
- **Action**: `errors(...)`
- **Assert**: `metadata.name`.
- **Must fail before impl (red)**: skipped → `[]`.

### T2.5 — D29: 500 is valid; 1025 is not (Claude agent)

- **Type**: unit
- **Pre-condition**: matching `name`.
- **Action**: `it.each` 500 / 1024 / 1025 Unicode code points (same counting as skills).
- **Assert**: 500 and 1024 clean; 1025 → `metadata.description`. No 500-specific rule.
- **Must fail before impl (red)**: 1025 currently `[]`.

### T2.6 — Collision skill ↔ any-host agent (A4)

- **Type**: unit
- **Pre-condition**: default skill `sample` plus either `.claude/agents/sample.md` `name: sample` **or** `.codex/agents/other.toml` `name = "sample"`.
- **Action**: `errors(...)` for each host separately.
- **Assert**: `metadata.collision` in both cases (Codex collides on the `name` field, not the filename).
- **Must fail before impl (red)**: skipped → no collision.

### T2.7 — Codex TOML custom agent: required fields (A2/A3)

- **Type**: unit
- **Pre-condition**: default skill + `.codex/agents/reviewer.toml`.
- **Action**: five fixtures — (a) kebab `name`, `description`, `developer_instructions` all nonempty; (b) missing `description`; (c) missing `developer_instructions`; (d) `name = "Reviewer"`; (e) `name = "pr_explorer"` (vendor example, underscore).
- **Assert**: (a) no metadata errors; (b) `metadata.description`; (c) `metadata.instructions` (or documented rule id for missing `developer_instructions`); (d) and (e) `metadata.name`. Filename may differ from kebab `name` in (a) without `metadata.name` (A1 Codex exception). Underscore is not kebab — Oriol 2026-09-10, one contract.
- **Must fail before impl (red)**: `.codex/agents/*.toml` is not in today’s config regex, so all five yield `[]` for those rules.

### T2.8 — `[agents]` in config.toml is not this scan

- **Type**: unit
- **Pre-condition**: `.codex/config.toml` with `[agents]\nmax_threads = 6` and no `.codex/agents/` files.
- **Action**: `errors(...)`
- **Assert**: no `metadata.name` / `metadata.description` from that table. Invalid TOML still `config.parse` (existing).
- **Must fail before impl (red)**: already passes. Pin so US2 does not invent a name check on global caps.

### T2.9 — Personas are not agents

- **Type**: unit
- **Pre-condition**: `.grok/personas/researcher.toml` with empty description.
- **Action**: `errors(...)`
- **Assert**: no agent metadata error on that path.
- **Must fail before impl (red)**: already passes. Pin against accidental persona scan.

### T2.10 — AC19 recipe is documentation; no 500 error row

- **Type**: unit (negative)
- **Pre-condition**: current catalog fixtures.
- **Action**: grep for a 500-character description cap; existing skill 1024 pin still green.
- **Assert**: no new 500 rule.
- **Must fail before impl (red)**: N/A — forbid-new-rule pin.

Property-based opt-in: none new. Length table is `it.each`, same as skills.

---

## US4 — evals AC27

### T4.1 — Four es-ES trigger cases expect `meta-harness`

- **Type**: unit
- **Pre-condition**: `.claude/evals/cases.jsonl` readable. New test file
  `.claude/evals/__tests__/cases-meta-harness.test.ts` (no existing inventory
  fixture for this skill).
- **Action**: parse each jsonl line; filter `type === "skill-trigger"` and `expected === "meta-harness"`.
- **Assert**: at least four rows; the four prompts cover crear, modificar, borrar, consultar (match on prompt text or `id` prefix `skill-meta-harness-`); `grader` is `skillTriggerParse`; language of prompts is Spanish (no English-only prompt).
- **Must fail before impl (red)**: filter length is 0.

### T4.2 — Stubs are not the expected skill (AC27 / AC2)

- **Type**: unit
- **Pre-condition**: same jsonl.
- **Action**: among rows whose prompt talks about native config create/modify/delete/consult (the US4 ids).
- **Assert**: `expected` is never `meta-create` or `meta-settings-cookbook`.
- **Must fail before impl (red)**: vacuously true today (zero rows). Keep coupled to T4.1 ids so it cannot pass by having no cases.

### T4.3 — Grader still accepts `expected: "meta-harness"`

- **Type**: unit
- **Pre-condition**: existing `skillTriggerParse` in `graders.ts` (do not rewrite the grader).
- **Action**: same event shape as `graders.test.ts` T3.8 with `input.skill = "meta-harness"`.
- **Assert**: `pass === true`; text-only transcript → `pass === false` and detail contains `meta-harness`.
- **Must fail before impl (red)**: this already passes if we only change `expected` in the helper call — it is a pin that the grader is name-agnostic. Not a red test. Skip writing it if T3.8 already proves any expected string works; prefer T4.1 as the real red.

Live `bun .claude/evals/run.ts` against a model is **out of this oracle**. README policy: Sonnet 5 for `skillTriggerParse`, never Fable unless `--allow-expensive` + this-turn permission. Phase 3 reports live eval as unverified if skipped.
