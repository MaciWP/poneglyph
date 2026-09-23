---
parent: dev-workflow
name: worked-example
description: The dev loop by level — a trivial change with one line of evidence, and a normal task with one loop-back in full and compact rendering.
---

# Worked examples

## Trivial level (no new logic, 1 file, easy to revert)

Task: "fix the typo `recieve` in the README install section".

KNOW still happens: Grep `recieve` finds one hit in `README.md` and no code
reference. Nothing else uses the word, so the change is trivial. The response:

```text
Corregido `recieve` → `receive` en `README.md:42`. Evidencia: `git grep recieve` ya no devuelve nada.
```

No stages, no scan line. If the Grep had found the word in an identifier or an
API field, the task would not be trivial: that is new behavior across files.

## Normal level (small task, one loop-back)

Task: "add a `--json` flag to the report CLI".

A new flag is new logic, so this is normal work. The stages carry real content
here, so the response shows them.

1. **KNOW** — read the CLI entry; Grep flags: an `--output` pattern exists in
   `export.ts` → reuse its parser. External research: not needed (internal pattern).
2. **PLAN** — Goal: `--json` prints the same report as JSON; pretty output stays
   default. The ask stated no DoD, so KNOW's research gives the proposal: "Hecho
   significa: `--json` output parses and matches the pretty report, suite green ·
   Cuándo paro: after REVIEW" → the user answers "Adelante". Questions: only the DoD proposal.
   Assumptions: (1) report data is plain-serializable. Risks: scripts may parse
   current stdout → mitigation: flag is opt-in, default untouched. Price: S, one
   file. Low blast radius → proceed.
3. **BUILD** — ladder rung 3: `JSON.stringify` (stdlib), no new dep; ~6 lines in
   `export.ts` style.
4. **REVIEW** — suite green, BUT impact sweep shows `report.ts` also feeds the HTML
   exporter and its `Date` fields break assumption (1). **Loop-back → PLAN**: re-plan
   with ISO date conversion; tell the user. Rebuild; suite + manual run green.
   Residual risk: none known.
5. **LEARN** — persist: "report data is NOT plain-serializable — `Date` fields need
   ISO conversion (`report.ts`)".

## Compact rendering of the same loop

For bounded normal work, the stages can render as the scan line plus one row per
stage. Only the prose shrinks. Drop a row that would only hold filler.

```text
🟢 KNOW · 🟢 PLAN · 🟢 BUILD · 🟢 REVIEW · 🟢 LEARN
```

| Stage | Result |
|---|---|
| KNOW | `--output` parser in `export.ts` reused; no external research needed |
| PLAN | Goal: `--json` = same report as JSON, pretty stays default · DoD proposed (parses, matches pretty, suite green) → "Adelante" · only question: the DoD proposal · A1 data plain-serializable · R1 scripts parse stdout → opt-in flag |
| BUILD | Rung 3, `JSON.stringify`, ~6 lines in `export.ts` style |
| REVIEW | Suite green; impact sweep: `report.ts` `Date` fields broke A1 → loop-back to PLAN (ISO conversion), rebuilt, green; residual risk none |
| LEARN | Report data is not plain-serializable: `Date` → ISO in `report.ts` |

High-blast-radius tasks (new module, schema, auth, money, migrations, deletion)
keep the full stages above and wait for approval after PLAN.
