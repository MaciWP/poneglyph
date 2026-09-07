# Critique / audit mode

The capability neither `html-report` nor the builtin `frontend-design` has: **review** a rendered HTML/CSS (or html-report's own output) against the taste corpus and report violations. Both of those skills are generative-only; this is the missing review side.

## When

- User says "critica este HTML", "audita el diseño", "revisa el render".
- Self-check after generating a report, before sharing.
- Auditing an external/legacy page for AI-slop tells.

## How (markdown-mode — no JS by default, Cmd V)

The model performs the critique guided by the references; no framework required.

1. **Load the corpus**: `taste-hard-rules.md` (measurable rules) + `anti-slop.md` (bans/tells) + `pre-flight-checklist.md` (the gate).
2. **Inspect** the target across dimensions: typography · color+contrast · spacing+layout · depth · motion · accessibility · anti-slop.
3. **Emit findings** — each: `dimension · rule violated · severity · location · fix`.
4. **Run the pre-flight checklist** → pass/fail per item.
5. **Verdict**: `CLEAN` (no MAJOR+), `WARN` (MINOR/NIT only), `FAIL` (≥1 BLOCKER/MAJOR).

## Severity (reuses `critic`'s vocabulary)

| Severity | Trigger |
|---|---|
| BLOCKER | WCAG contrast fail / unreadable / not self-contained |
| MAJOR | an Absolute Ban present (purple gradient, cards-in-cards, untinted greys, animates layout props) |
| MINOR | a TASTE guideline missed (weak hierarchy, uniform spacing, centered long-form) |
| NIT | polish (could tighten a scale step, a shadow ratio) |

## Output format

```
## Critique — <target>
| Dimension | Rule | Severity | Location | Fix |
|---|---|---|---|---|
| color | WCAG 4.5:1 body | BLOCKER | .lead grey on teal | darker shade of bg hue |
...
Pre-flight: 18/22 pass (4 fail: contrast×2, centered long-form, missing reduced-motion)
Verdict: FAIL — 1 BLOCKER, 2 MAJOR
```

## Optional deterministic helper

Contrast-ratio math can be extracted to `scripts/contrast-check.ts` (with a paired test, red→green) IF deterministic checking is wanted. Default: the model estimates contrast guided by the WCAG rule. Keep markdown-mode unless precise automated contrast auditing is required (OQ3 / Cmd V).

## Source
Pattern from impeccable (deterministic + LLM critique layering) + critic skill (severity vocabulary). Provenance: `.claude/plans/_research-skill-evolution-2026-05-29.md` Part B.
