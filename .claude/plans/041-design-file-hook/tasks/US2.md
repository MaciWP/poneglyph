---
us: US2
title: Put the extraction offer in the form US1 chose
wave: W2
depends_on: [US1]
tdd_mode: optional
estimate: S
status: draft
---

# US2 — Offer line in the chosen form

## Execution prompt (Phase 3 input)

**Task**: Make `ui-design` ask for extraction in the form US1 chose, in both the reference and the SKILL.md step 0.
**Context**: `.claude/skills/ui-design/references/design-file.md` §When none exists (offer line, "Write nothing until the user says yes"); `.claude/skills/ui-design/SKILL.md:40-42` step 0 says "offer extraction in `Aviso:`". Body budget: `ui-design` is 4641 bytes with a tightened snapshot.
**Constraints**: Keep "Write nothing until the user says yes: no design file, no directory, no stub" verbatim (V7.4 of 039). Spanish example line, English prose. `bun .claude/scripts/budget.ts --bodies` must not show growth for `ui-design`.
**Deliverable**: Both files state the same form; the example line is concrete (path and source file).
**Verify**: grep both files for the chosen form; `budget.ts` rc=0; `bun run check:config` 0 errors.
**Ask first**: nothing.

## User story

- **As a**: user working in a repo without a design file
- **I want**: the extraction question on its own visible line
- **So that**: I can answer it instead of missing it among warnings

## Acceptance criteria

- **AC1**: Given the reference and SKILL.md, when read, then both name the same offer form and neither names the other one.
- **AC2**: Given the budget check, when run, then `ui-design` body bytes ≤ snapshot.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/skills/ui-design/references/design-file.md` | §When none exists: offer line form |
| `.claude/skills/ui-design/SKILL.md` | Step 0 wording |

## Verificación post-implementación

- `budget.ts` rc=0; `check:config` 0 errors.
