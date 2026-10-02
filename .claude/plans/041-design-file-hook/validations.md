---
spec: 041-design-file-hook
tasks: tasks/
created: 2026-10-02
phase: 2.5
status: draft
validation_mode: validation
test_policy: auxiliary
---

# Validations per HU (validation-mode)

## ¿Por qué validation-mode y no TDD?

US1 is an experiment, US2 edits skill markdown, US4 edits settings JSON and docs. None adds executable logic. Their oracles are file contents, installed state and the live behavior the spec asks for, checked with grep, `jq`, the repo scripts and headless probes.

## US1 — A/B the offer line

### Pre

- `scratchpad/v76/without` has no `DESIGN_SYSTEM.md`, `DESIGN.md` or `docs/`; reset with `git -C $S/without checkout -- index.html` (it is dirty from 039 r4).
- `~/.local/bin/claude` exists; model `claude-sonnet-5-5`.

### Post

- `ab-A.jsonl` and `ab-B.jsonl` exist with rc=0.
- After each run, `git -C $S/without status --short` lists no design file, no `docs/` and no stub.

### Structural assertions

- US1.md has a result table: arm, skill loaded (yes/no), offer present (yes/no), offer line verbatim, design file created (yes/no).
- US1.md names the chosen form and the rule that chose it.

### Smoke

- Each transcript shows the `ui-design` skill body in context (the `/ui-design` expansion or a `Skill` call).

### Cross-validations

- A run where the skill did not load is reported as void and not counted for either arm.

## US2 — Offer line in the chosen form

### Pre

- US1 decision recorded.
- `bun .claude/scripts/budget.ts --bodies` baseline: `ui-design` 4641 bytes.

### Post

- `design-file.md` §When none exists and `SKILL.md` step 0 name the same form.
- `budget.ts` rc=0; `ui-design` body ≤ 4641 bytes.

### Structural assertions

- `grep -n "Write nothing until the user says yes: no design file, no directory, no stub" .claude/skills/ui-design/references/design-file.md` → 1 hit.
- If `**Decide:**` won: `grep -n "Aviso" .claude/skills/ui-design/SKILL.md .claude/skills/ui-design/references/design-file.md` → 0 hits about the offer.

### Smoke

- `bun run check:config` 0 errors.

### Cross-validations

- The note text in US3 `buildNote` uses the same form (T3.3).

## US4 — Claude registration and docs

### Pre

- US3 tests green.
- `sensitive:` declaration written before the `settings.global.json` edit.

### Post

- `jq '.hooks.PreToolUse[] | select(.matcher=="Edit|Write|MultiEdit") | .hooks[].command' ~/.claude/settings.json` prints the `design-file-hint.ts` command.
- Sync ran with `--backup`; backup path reported.

### Structural assertions

- `settings.global.json` group: matcher `Edit|Write|MultiEdit`, timeout 5, command `bun "$HOME/.claude/hooks/design-file-hint.ts"`.
- `rules/paths/hooks.md` PreToolUse row names the hook, its trigger and that it never blocks.
- `harness-adapters.md` contract table has a "Design-file note" row (Claude / Codex / Grok cells).
- Hook counts (US4 AC4): `jq '([.hooks[]|length]|add), ([.hooks[][].hooks[]]|length)' .claude/settings.global.json` prints `6` and `7`; `system-inventory.md` Hooks row says 7 handlers / 4 events; `grep -nE "(four|five|six) Claude registrations" .claude/docs/harness-adapters.md` → 0 hits; the `hooks.md` PreToolUse row names four handlers and the new matcher.
- `.claude/settings.json` (project) still has no `hooks` key: `jq 'has("hooks")' .claude/settings.json` → `false`.

### Smoke

- `bun test ./.claude/scripts/__tests__/sync-claude.test.ts ./.claude/scripts/__tests__/check-config.test.ts` green.
- `bun run check:config` 0 errors.
- `bun .claude/scripts/budget.ts` rc=0, always-loaded Δ 0 (spec AC6).

### Cross-validations

- `bun .claude/hooks/native-hook.ts --check --cwd "$PWD"` passes.

## Cross-cutting validations (review, live probes)

Run in review on the installed hook, without the `/ui-design` prefix (natural prompts). Model `claude-sonnet-5-5`, explicit on each run; binary `~/.local/bin/claude`; command shape from US1. Reset `index.html` before each run. Budget: 5 runs; 2 used by US1; total 7 of 8.

Held-out prompts, written on 2026-10-02 before any 041 run, not tuned afterwards:

| Id | Repo | Prompt |
|---|---|---|
| P0 | `with` | V7.6: `Añade un botón «Guardar» junto a «Cancelar» en index.html, con el color de la marca y el mismo estilo que el resto de la app.` |
| P1 | `without` | V7.6, same prompt |
| P2 | `without` | `Muestra un mensaje de error en rojo debajo del campo Nombre cuando esté vacío.` |
| P3 | `without` | `El botón Cancelar no debería competir con Guardar; hazlo secundario.` |
| P4 | `without` | `Añade un pie de página con un enlace a la política de privacidad.` |

- **X1 (spec AC1, AC2)**: each run's `<repo>/.claude/learned/design-file-hints.log` gains exactly one line for its session, even when the run makes several UI edits.
- **X2 (spec AC3)**: P1–P4 pass when the final report holds the extraction question on its own line or in bold, and no design file, `docs/` or stub is created. Pass ≥3 of 4.
- **X3 (spec AC4)**: P0's final report names `docs/DESIGN_SYSTEM.md`.
- **X4 (spec AC5)**: T5.1–T5.4 green; no live Codex run. Codex `/hooks` trust stays the user's step, documented in `harness-adapters.md`.
- **X5**: `bun test ./.claude/hooks/ ./.claude/scripts/__tests__/` green (feature scope, not the full suite).
