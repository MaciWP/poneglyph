---
us: US2
title: check-config AC19 recipe + AC20 agents YAML
wave: W1
depends_on: []
tdd_mode: forced
estimate: M
status: closed
absorbs_decision: D15 D29 AC19-20 three-host-scan
approved: 2026-09-10
closed: 2026-09-10
---

# US2 — check-config AC19 + AC20

## Execution prompt (Phase 3 input)

**Task**: Extend `check-config` so T3 **definition files on three hosts** use the skill `name`/`description` contract (AC20, baked 2026-09-10). Document the AC19 promotion recipe. Do **not** add a 500-character description error (D29).
**Context**: Gate today scans `.claude/skills/*/SKILL.md` and `.claude/commands/*.md` plus listed JSON/TOML configs. It does **not** scan agent dirs. Oriol (gate 2.5): all three hosts, every agent must fulfill the rules, names collide with skills/commands.
**Surfaces (A2)**: `.claude/agents/*.md`, `.grok/agents/*.md`, `.codex/agents/*.toml`. Not `[agents]` in `config.toml` (global caps). Not `.grok/personas/*.toml`.
**Constraints**: No second validator. Do not scan `rules/*.md` or CLAUDE.md/AGENTS.md (D15). D29: description 1–1024. Markdown without YAML is an error (`metadata.parse`). Codex also requires nonempty `developer_instructions` (vendor MUST, 2026-09-10 subagents page). Codex `name` need not match filename. Confirm Glob: this repo has no `.claude/agents/` today; if a new error would fail an in-repo agent file, stop (AC19).
**Deliverable**: three-host scan + tests T2.1–T2.10; AC19 recipe in `config-quality.md`.
**Verify**: `bun test ./.claude/scripts/__tests__/`; `bun run check:config` green on this repo.
**Ask first**: nothing remaining on scan scope — baked. If Codex `developer_instructions` would fail a tracked `.codex/agents/*.toml` in this repo, stop and report.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W1 |
| **Depends on** | none |
| **Blocks** | US6 (T3 templates must pass the new scan) |
| **Files touched** | `check-config.ts`, `config-quality.md`, fixtures/tests |
| **TDD-mode** | forced |
| **Estimate** | M |
| **Cómo arrancar** | Add failing fixtures T2.2 / T2.7 (Claude empty description; Codex missing developer_instructions) |
| **Decisión absorbida** | D15 D29 AC19–20 |

## User story

- **As a**: author of a subagent
- **I want**: the same mechanical floor as a skill
- **So that**: a nameless agent cannot enter the snapshot

## Acceptance criteria

- **AC1**: Given Claude `.claude/agents/*.md` or Grok `.grok/agents/*.md` with YAML, when `check:config` runs, then kebab `name` 1–64 **matching filename stem**, description 1–1024 nonempty. Missing YAML → `metadata.parse`.
- **AC2**: Given no agent files on a host, when the gate runs, then that scan is a no-op — not `inventory.empty`.
- **AC3**: Given `.codex/agents/*.toml`, when the gate runs, then `name` (kebab-hyphen 1–64, same regex as skills; underscore like `pr_explorer` fails), `description` 1–1024, and nonempty `developer_instructions` are required. Filename match optional. `[agents]` in `config.toml` is not this scan.
- **AC4**: Given an agent `name` that already belongs to a skill or command, when the gate runs, then `metadata.collision` (all three hosts).
- **AC5**: Given AC19 recipe in `config-quality.md`, when someone later finds an A/B/T1 limit, then the doc lists: one row, one rule, one fixture, template, catalog sweep before CI error.
- **AC6**: Given D29, when this HU lands, then no 500-char rule exists in the gate. Personas are not scanned.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/scripts/check-config.ts` | Scan Claude/Grok agent markdown + Codex agent TOML |
| `.claude/docs/config-quality.md` | AC19 recipe + three-host agents row |
| `.claude/scripts/__tests__/check-config*.ts` | Fixtures T2.1–T2.10 |

## Workflow detallado

1. Write failing tests T2.1–T2.10 (three hosts; no 500 rule).
2. Implement scans reusing `frontmatter()` for markdown; TOML parse for `.codex/agents/*.toml`.
3. Write AC19 recipe + three-host agents row. Do not add 500. Do not scan personas or `[agents]` caps.

## Verificación post-implementación

- Tests red then green.
- `bun run check:config` on this repo still 0.
