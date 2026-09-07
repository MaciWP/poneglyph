# Anti-slop — bans + tells

The single highest-leverage lever for non-generic output is a **negative vocabulary**: concrete bans + a catalog of "AI tells". This reference is the **canonical home** for those — `SKILL.md` points here instead of restating (Cmd IX).

## Why AI design is generic (root cause)

LLMs emit the **statistical median** of their training corpus. The purple/indigo signature traces to Tailwind's `bg-indigo-500` demo default cascading across thousands of tutorials into training data. Escaping the median requires explicit prohibition — bans override priors better than positive guidance. Sources: prg.sh "Why Your AI Keeps Building the Same Purple Gradient Website"; dev.to/alanwest; pbakaus/impeccable.

## Absolute Bans (NEVER)

Unconditional. No exceptions, no reasoning required at use-time.

- Purple→blue / indigo gradients (the #1 AI tell)
- Inter / Roboto / Arial / system fonts as the *default* choice
- Pure black `#000` or pure white `#fff` (tint neutrals)
- Untinted neutral grey (`#808080`) for text or surfaces
- Grey text on a colored background (use a shade of the bg hue)
- Cards nested inside cards
- Equal 3-column "icon-tile + heading + text" feature grids
- Rounded-square icon tile above every heading/section
- Centering everything (left-align + asymmetry reads as designed)
- Em-dashes scattered as decoration
- Bounce / elastic easing (feels dated; real objects decelerate)
- Animating layout properties (width/height/padding/top/left)
- Tiny uppercase eyebrow on every section; numbered section markers as default scaffolding
- Glassmorphism / dark neon glows as a default
- Over-rounded corners (> 16px on cards)
- Sketchy hand-rolled SVG illustrations as filler

## AI-slop tells (tell · why · use-instead)

| Tell | Why it reads as AI | Use instead |
|---|---|---|
| Inter / system font default | training ubiquity → invisible | a distinctive but legible display + refined body pairing |
| Purple gradient hero | `bg-indigo-500` cascade | one confident non-purple accent, restrained |
| Cards-in-cards | model wraps everything in containers | not every element needs a container; use spacing |
| Everything centered | safe default | left-align long-form; asymmetry for interest |
| 3 equal feature cards | training-data layout | vary weight/size; break the grid intentionally |
| Icon-tile above each heading | templated pattern | drop it, or vary; let type carry hierarchy |
| Gray-on-color text | naive contrast | darker/lighter shade of the same hue |
| Fake-precise stats ("47.2%"), "Jane Doe" | synthetic filler | real data or omit |
| Beige + brass "premium" palette | dominates AI cookware/luxury sites | choose a context-specific palette |
| `transition: all` / bounce easing | lazy defaults | explicit props + ease-out / custom cubic-bezier |

## Note for integration (US5)
`SKILL.md` currently has an inline "anti-generic AI look" row. On integration, that row is **replaced by a pointer to this file** — single source of truth, no duplication.

## Sources
github.com/pbakaus/impeccable · github.com/leonxlnx/taste-skill (Production-Test Tells) · prg.sh · dev.to/alanwest · Anthropic frontend-design (anti-pattern list). Full provenance: `.claude/plans/_research-skill-evolution-2026-05-29.md` Part B.
