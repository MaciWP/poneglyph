# Taste hard-rules

Expert-vetted design rules consumed by `html-report` during generation (and available to any visual surface). **HARD** = measurable/checkable; **TASTE** = expert consensus. Every rule carries its source.

> Scope: this reference ADDS measurable rules. It does NOT restate html-report's own doctrine (warm paper, single deep-teal accent, serif display, tabular numerals) — that lives in `SKILL.md`. No overlap by design (Cmd IX).

## Spacing

| Rule | Value | Type | Source |
|---|---|---|---|
| Base unit | 4px (0.25rem); all spacing a multiple of it | HARD | Tailwind default |
| Scale gaps | no two scale steps closer than ~25% | HARD | Refactoring UI |
| Whitespace bias | start with too much, remove until "just enough" | TASTE | Refactoring UI |
| Grouping | more space *between* groups than *within* a group | HARD | Refactoring UI |
| Don't fill | empty space is a design element; don't fill the viewport | TASTE | Refactoring UI |

## Typography

| Rule | Value | Type | Source |
|---|---|---|---|
| Line length | 45–75 chars (`max-width: 65ch` on body) | HARD | Refactoring UI |
| Min weight | no font weight < 400 in UI | HARD | Rauno Freiberg; Refactoring UI |
| Heading weight | 500–600 (not 700) for medium headings | TASTE | Rauno Freiberg |
| Type scale | one modular ratio (1.25 web UI / 1.333 editorial); don't mix | TASTE | spec.fm, Cieden |
| Line height | ~1.5 body, 1.1–1.25 headings (taller for small text) | TASTE | Refactoring UI |
| Numerals | `font-variant-numeric: tabular-nums` on data columns | HARD | Rauno Freiberg |
| Don't center | never center long-form paragraphs (headlines/labels OK) | HARD | Refactoring UI |
| Fluid sizing | `clamp(min, vw, max)` for responsive display type | TASTE | Rauno Freiberg |

## Color

| Rule | Value | Type | Source |
|---|---|---|---|
| Grayscale first | design hierarchy in grayscale, add color last | TASTE | Refactoring UI |
| Full palette | 8–10 shades per hue, defined upfront (not improvised) | TASTE | Refactoring UI |
| Tinted greys | never neutral `#808080`; tint toward the bg hue | HARD | Refactoring UI |
| Text on color | use a darker/lighter shade of the bg hue, not grey | HARD | Refactoring UI |
| Dark shades | rotate hue (not only drop lightness) to avoid muddy darks | TASTE | Refactoring UI |
| Color space | prefer OKLCH for new palettes (perceptual uniformity); HSL fallback | TASTE | Josh Comeau; shadcn/ui |
| Semantic tokens | `--x` surface + `--x-foreground` text pair | HARD | shadcn/ui |

## Depth (shadow / elevation)

| Rule | Value | Type | Source |
|---|---|---|---|
| Single light source | all shadows share one offset ratio (~2:1 vertical:horizontal) | HARD | Josh Comeau |
| Elevation scaling | as elements rise: offsets grow + blur grows + opacity drops | HARD | Josh Comeau |
| Hue-matched | shadows match bg hue (low sat), never semi-transparent black | TASTE | Josh Comeau |
| Layered | stack multiple box-shadows for realistic depth | TASTE | Josh Comeau |
| Fewer borders | prefer space / bg-contrast / shadow over borders | TASTE | Refactoring UI |

## Motion

| Rule | Value | Type | Source |
|---|---|---|---|
| Purpose gate | every animation must state what it communicates, else cut | HARD | Emil Kowalski |
| Frequency gate | actions seen 100+×/day → no animation (or 0ms) | HARD | Emil Kowalski |
| Duration | component UI ≤ 200–300ms; full-screen only may go longer (MD3 450–1000ms) | HARD | Emil; NNGroup; MD3 |
| Exit faster | exit ~75–80% of enter duration | TASTE | NNGroup |
| Easing by direction | ease-out enter · ease-in exit · ease-in-out on-screen · ease hover | HARD | Emil; Comeau; MD3 |
| Custom curves | custom cubic-bezier beats built-in easings for quality | TASTE | Emil Kowalski |
| Origin-aware | scale from the trigger (`transform-origin`), not center | HARD | Emil Kowalski |
| Initial scale | enter from `scale(0.9+)`, never `scale(0)` | HARD | Emil Kowalski |
| GPU-only | animate only `transform` + `opacity` (never width/height/top/left) | HARD | web.dev; Comeau |
| Theme switch | switching theme must NOT trigger transitions | HARD | Rauno Freiberg |

## Accessibility (WCAG — hard, measurable)

| Rule | Value | Type | Source |
|---|---|---|---|
| Body contrast | ≥ 4.5:1 (AA) | HARD | WCAG 2.1/2.2 |
| Large/UI contrast | ≥ 3:1 (AA, ≥18pt or 14pt bold; icons/controls) | HARD | WCAG 2.1/2.2 |
| Reduced motion | every animation has a `prefers-reduced-motion` path (decorative→none, functional→instant) | HARD | web.dev; Apple HIG |
| Not color-alone | convey state via text/label, not color alone | HARD | WCAG |

## Sources
Refactoring UI (Wathan/Schoger) · github.com/raunofreiberg/interfaces · joshwcomeau.com (shadows, color-formats) · emilkowal.ski + animations.dev · m3.material.io · nngroup.com/articles/animation-duration · web.dev/animations-guide · tailwindcss.com · ui.shadcn.com · WCAG 2.1/2.2. Full provenance: `.claude/plans/_research-skill-evolution-2026-05-29.md` Part B.
