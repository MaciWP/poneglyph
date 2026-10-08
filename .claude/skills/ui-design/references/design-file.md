# Design file

The repo's recorded design: one file the agent reads before touching UI, so it stops re-deriving the design from sibling components on every task. Load this when `SKILL.md` step 0 points here.

## Lookup order

Take the first that exists:

1. `docs/DESIGN_SYSTEM.md` (canonical)
2. `DESIGN_SYSTEM.md` at the repo root
3. `DESIGN.md` at the repo root

Several exist: read the first in this order and mention the others in the report.

## When the file exists

- Read it before the first UI edit and name it in the report (path plus what you took from it).
- Code wins over the file: when they disagree, follow the code, report the drift, and do not edit the file unasked.

## When none exists

- Do the task with the sibling-component method (Mode 1 steps 1-2).
- Put the offer on its own bold line in the report, for example: `**Decide:** no hay fichero de diseño; ¿extraigo docs/DESIGN_SYSTEM.md de styles.css?` The missing file is a fact the user needs, so the line is required even when the task is small and when the report already carries other decisions.
- Write nothing until the user says yes: no design file, no directory, no stub.
- On no, do not offer again in the same task. On yes, write `docs/DESIGN_SYSTEM.md` in the format below.

## Extraction format

Values are copied from code, never invented. A value you cannot find in code is left out or marked `unknown`, not guessed.

| Section | Content |
|---|---|
| Tokens | Each token with its value (light and dark when both exist) and where it lives in code (`path:line`) |
| Type scale | Families, sizes, weights and line heights as used, with the token or class that carries each |
| Spacing | The scale in use and where it is defined |
| Radius | The radius values in use and where they are defined |
| Components | Each shared component with its states (hover, focus, disabled, loading, error, empty) and where it lives |
| Usage rules | Conventions the code follows consistently (which token for which role, what never mixes), each backed by two or more usages |

Keep it short: a table or list per section, no prose that restates the code.
