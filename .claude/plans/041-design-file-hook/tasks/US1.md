---
us: US1
title: A/B the extraction offer line with ui-design loaded
wave: W1
depends_on: []
tdd_mode: skip
tdd_skip: experiment that decides wording; no code changes
estimate: S
status: draft
absorbs_decision: offer form
---

# US1 — A/B the extraction offer line

## Execution prompt (Phase 3 input)

**Task**: Run two headless sessions in the scratch repo without a design file, with `ui-design` loaded explicitly, and compare whether the report carries the extraction offer when the reference says `Aviso:` (arm A) or a bold `**Decide:**` line (arm B).
**Context**: Scratch repo `scratchpad/v76/without` (`index.html`, `styles.css`, git). 039 r1–r4 never produced the offer; r4 did not load the skill, so this A/B forces it with a leading `/ui-design`. Probe command shape from 039: `cd $S/without && timeout 600 ~/.local/bin/claude -p "$P" --model claude-sonnet-5-5 --permission-mode acceptEdits --output-format stream-json --verbose > $S/ab-<arm>.jsonl`. Prompt `P` = `/ui-design Añade un botón «Guardar» junto a «Cancelar» en index.html, con el color de la marca y el mismo estilo que el resto de la app.` Reset with `git -C $S/without checkout -- index.html` before each run.
**Constraints**: Model `claude-sonnet-5-5` on both runs; Bash with `dangerouslyDisableSandbox` (memory `claude-binary-sandbox-path`). Arm B edits `ui-design/references/design-file.md` §When none exists only for its run; the edit becomes final or is reverted in US2. No other file changes.
**Deliverable**: A result table in this file (arm, `Skill` loaded, offer present, offer line verbatim, design file created) and the chosen form. Rule: the arm with more offers wins; a tie goes to `**Decide:**`; a run where the skill did not load is void and counts for neither arm.
**Verify**: Each transcript shows `Skill` / the `/ui-design` expansion; `git -C $S/without status --short` shows no design file; offer presence read from the final result text.
**Ask first**: nothing — model and run count approved on 2026-10-02.

## User story

- **As a**: Poneglyph maintainer
- **I want**: evidence on which line form the model keeps
- **So that**: the hook note and the skill text use the form that survives

## Acceptance criteria

- **AC1**: Given both arms ran with the skill loaded, when the reports are read, then the table records offer presence per arm with the line verbatim.
- **AC2**: Given the results, when the decision rule is applied (more offers wins; tie → `**Decide:**`), then the chosen form is written in this file.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/skills/ui-design/references/design-file.md` | Arm B only: offer line as `**Decide:**` |
| `.claude/plans/041-design-file-hook/tasks/US1.md` | Result table and decision |

## Verificación post-implementación

- Both `ab-*.jsonl` exist with rc=0; table filled.
