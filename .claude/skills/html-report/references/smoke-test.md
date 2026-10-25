# Smoke test

Run it after changing a template, `tokens.css` or a component.

## Render and check

The canonical smoke test: render the real audit at `.claude/skills/html-report/examples/sample-audit-report.md`.

1. Render it with the `report` template → `examples/sample-audit-report.html` (next to the input).
2. **Open with network disabled**: everything except webfonts must render (Geist/Newsreader degrade to the system stack); the single Google Fonts `<link>` is the only network dependency.
3. Verify against the frontmatter (`mean_score: 7.57`, `findings_count: 10`, `corpus_size: 17`, `review_verdict: APPROVED_WITH_WARNINGS`, `commit_sha: c2eb838`, `mode: full`):
   - Gauge (C1) shows `7.57 / 10`, `score--good`, arc offset 79.39.
   - Severity-bar (C5) = 1 BLOCKER (10%) · 6 MAJOR (60%) · 3 MINOR (30%) · 0 NIT (legend only).
   - Scoring table (C2) renders the `3` for Critic as a `score--bad` pill, distinct from the BLOCKER finding row.
   - Verdict badge (C8) = `verdict--minor` (amber) for `APPROVED_WITH_WARNINGS`.
4. Toggle OS dark mode: `report.template` flips every token; `dashboard`, `glance` and `decision` open dark (their light values are the print stylesheet). Severity/score colors stay legible (amber, not yellow).
5. Print-preview: sidebar hidden, no shadows, link URLs expanded, cards don't break across pages.
6. Run `pre-flight-checklist.md` against the render: all items pass.

## Block→component coverage

Every block of `report.md` maps to a component; no orphan content.

| report.md block | Component |
|---|---|
| Frontmatter (mean/verdict/sha/mode/dates) | C8 metadata-header |
| `> Lectura rápida` blockquote | C4 callout `--note` |
| §1 Executive (prose + BLOCKER) | prose + C4 callouts + C5 severity-bar |
| §2 Top-10 table (sev rows, /flow-lifecycle) | C2 data-table `sev-row` mode |
| `1 BLOCKER · 6 MAJOR · 3 MINOR · 0 NIT` | C5 severity-bar + legend |
| §3 Quick-wins table | C2 data-table |
| §4 Scoring 14-row table (the `3`) | C2 data-table + score-pill |
| Mean/Median/Min/Max | C5 stat-tiles |
| AC5 honesty check note | C4 callout `--note` |
| §5 Cross (Genuine/Parcial verdicts) | C2 tables + verdict badges |
| §6 Rúbrica + `> Techo n=1` | C2 + C4 callout |
| §7 Inventory counts | C2 / C5 stat-tile grid |
| §8 Corpus numbered lists + links | ordered lists, `--link` (print expands URLs) |
| §8.5 Síntesis (ordered decisions) | ordered list |
| §9 Limitations table | C2 data-table |
| AC-compliance 8/8 | C6 progress-bar or C5 tile |

NIT (`0 NIT`) is kept in the system though this report doesn't exercise it; the `flow` review phase's rubric emits NIT for `review.md` rendering.
