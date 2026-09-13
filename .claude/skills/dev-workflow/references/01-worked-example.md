---
parent: dev-workflow
name: worked-example
description: The dev loop on a small task with one loop-back — full and compact renderings of the same five stages.
---

# Worked example (small task, one loop-back)

Relocated verbatim from `SKILL.md` on 2026-09-03 (plan 032/WP4 — progressive disclosure; nothing changed but the address).

Task: "add a `--json` flag to the report CLI".

Even if this had looked like "one flag, five minutes", every stage still runs and
shows up in the response — depth can be short; omission cannot.

1. **KNOW** — read the CLI entry; Grep flags: an `--output` pattern exists in
   `export.ts` → reuse its parser. External research: not needed (internal pattern).
2. **PLAN** — Goal: `--json` prints the same report as JSON; pretty output stays
   default. Questions: 0 blocking. Assumptions: (1) report data is plain-serializable.
   Risks: scripts may parse current stdout → mitigation: flag is opt-in, default
   untouched. Price: S, one file. Low blast radius → proceed.
3. **BUILD** — ladder rung 3: `JSON.stringify` (stdlib), no new dep; ~6 lines in
   `export.ts` style.
4. **REVIEW** — suite green, BUT impact sweep shows `report.ts` also feeds the HTML
   exporter and its `Date` fields break assumption (1). **Loop-back → PLAN**: re-plan
   with ISO date conversion; tell the user. Rebuild; suite + manual run green.
   Residual risk: none known.
5. **LEARN** — persist: "report data is NOT plain-serializable — `Date` fields need
   ISO conversion (`report.ts`)".

## Compact rendering of the same loop (CLAUDE.md §The dev loop, 032/WP5)

When KNOW shows the task is bounded, the five stages may render as the scan line plus
one row per stage. Every stage still appears; only the prose shrinks.

```text
🟢 KNOW · 🟢 PLAN · 🟢 BUILD · 🟢 REVIEW · 🟢 LEARN
```

| Stage | Result |
|---|---|
| KNOW | `--output` parser in `export.ts` reused; no external research needed |
| PLAN | Goal: `--json` = same report as JSON, pretty stays default · 0 blocking questions · A1 data plain-serializable · R1 scripts parse stdout → opt-in flag |
| BUILD | Rung 3, `JSON.stringify`, ~6 lines in `export.ts` style |
| REVIEW | Suite green; impact sweep: `report.ts` `Date` fields broke A1 → loop-back to PLAN (ISO conversion), rebuilt, green; residual risk none |
| LEARN | Report data is not plain-serializable: `Date` → ISO in `report.ts` |

Unbounded or high-blast-radius tasks (new module, schema, auth, money, migrations,
deletion) keep the full stages above.
