---
id: 039-design-system
created: 2026-09-24
mode: full
phase: 1
status: closed
approved: 2026-09-25
closed: 2026-10-02
---

# Problema

There is no recorded design system, neither in Poneglyph nor as a method for other repos.

1. Poneglyph's HTML outputs look like three different products. `html-report` carries
   three palettes with two naming schemes: `templates/tokens.css` (warm paper, `--color-*`,
   used by `report` and `components`), the `dashboard` / `glance` / `decision` templates
   (dark-native, `--accent: #6ee7d3`) and `scripts/theme.ts` (cool-neutral v2, the dynamic
   mode). `tokens.css` calls itself the single source of truth, and it cites a
   `decide/templates/memo.html` that no longer exists.
2. In a work repo, `ui-design` treats the existing app as the spec, but the repo has no
   place to record it. Each UI task re-derives the design from sibling components.

If we do nothing: every new template adds drift, and every UI task in a work repo pays
the re-derivation again.

# Resultado esperado

- A report, a dashboard and a diagram generated after this change look like one product
  in light and in dark.
- A test fails when a Poneglyph HTML template defines a token value that differs from
  the single tokens source.
- In any repo, the agent reads the repo's design file before UI work. When the file is
  missing, it creates none until the user says yes (the extraction offer moved to 041,
  v2 — delta from retro 039-design-system).
- Poneglyph's design system is also published as a claude.ai Design System Artifact.
  The repo file stays the source of truth.

# Success criteria (medibles, Given/When/Then)

- **AC1**: Given the Poneglyph tokens source, when `bun test ./.claude/` runs, then every
  HTML template and `theme.ts` resolves each shared token to the source value, and a
  template edited to diverge makes the test fail.
- **AC2**: Given the unified tokens, when a report, a dashboard and an html-report inline
  SVG diagram are generated and opened in light and in dark, then they share background,
  surface, text, accent and status colors, and every text color meets WCAG AA 4.5:1
  (measured). Archify diagrams (`diagrams-interactive`) keep their own `classic` preset.
- **AC3**: Given the base palette is the cool-neutral v2 of `scripts/theme.ts`, when the
  unified tokens are compared with it, then surfaces, lines, ink and every dark value match
  v2; in light, accent and status colors are darkened only as far as WCAG AA 4.5:1 requires
  on `--bg`, `--surface` and `--surface-2` (measured, phase 2: v2 light `--mid` is 2.69:1).
- **AC4**: Given the dashboard, glance and decision templates, when they open without a
  user choice, then they start dark; reports follow the system preference.
- **AC5**: Given a repo with a design file, when the agent does UI work there, then it
  reads that file before its first UI edit and names it in its report.
- **AC6**: Given a repo without a design file, when the agent does UI work there, then it
  does not create files until the user says yes; on no, it continues with the current
  sibling-component method. v2 — delta from retro 039-design-system (the extraction offer
  never appeared in four probe runs; it moves to feature 041).
- **AC7**: Given the published Design System Artifact, when it is read, then its tokens
  equal the repo source, and the repo docs name the repo file as the source of truth.
- **AC8**: Given the change, when `check:config` and the dead-reference sweep run, then
  no reference to `decide/templates/memo.html` or to a removed palette remains.

# Out of scope (explícito)

- Re-rendering HTML pages that are already generated or published.
- Extracting the design file of a concrete work repo (the method ships; its first real
  use comes later).
- A light-default theme for dashboards (the user chose dark-native dashboards).
- Visual redesign of the base palette: v2 is kept, except the light accent/status
  darkening AC3 allows.
- The look acceptance of X1 (the pages read as one designed product): it moves to feature
  040. Contrast and AA stay here. v2 — delta from retro 039-design-system (the look needs
  a redesign, not a polish; user decision in review).

# Constraints

- Self-contained HTML: pages inline their styles; no external stylesheet at runtime
  (`html-report` build contract, `templates/tokens.css` header).
- Three hosts: the method is read from shared skills, so Codex and Grok get it without a
  claude.ai dependency (user decision: Artifacts are Claude-only, the repo file is the SSOT).
- The always-loaded budget ratchet (`scripts/budget.ts`, 0 % growth) applies; growth needs
  the user's `--update`.
- No commit without an explicit request (CLAUDE.md §Git / PR).

# Stakeholders

- **Oriol** — reads every HTML output and decides the gates.
- **Work repos** — receive the method through `ui-design`.

# Open questions

- **For the gate**: the method extends `ui-design` instead of adding a new skill. This is
  the Lead's proposal, not a questionnaire answer; approve or refine it at gate 1→2.
- **Accepted limit**: AC7 holds at publish time only. The Artifact is republished by hand
  when the tokens change; no test reads claude.ai, so drift is not tested.
- **Resolved in phase 2 (user, 2026-09-25)**: `diagrams-interactive` renders through the
  pinned Archify engine. It offers four fixed presets and no palette input (checked:
  `archify --help`, `archify guide theme`, the `meta.*` fields of its authoring contract),
  and the skill forbids patching its HTML. AC2 therefore covers html-report's inline SVG
  diagrams (`references/visuals-svg-first.md`), which already read the tokens.

Decisions from the questionnaire (2026-09-24):

| Question | Answer |
|---|---|
| Problem | Both: Poneglyph palettes and the method for other repos |
| Base palette | Cool-neutral v2 (`scripts/theme.ts`) |
| Light/dark | Reports follow the system; dashboard, glance and decision stay dark by default |
| Design System Artifact | In scope |
| Missing design file | Offer extraction and wait for the user |
| MVP | Same look across outputs plus a divergence test |
| Existing pages | Not re-rendered |
| Diagrams in AC2 (phase 2) | html-report inline SVG; Archify keeps its preset |
| AC2 vs AC3 contrast (phase 2) | Keep v2 surfaces, ink and dark; darken light accent/status to AA |
| Token names (phase 2) | One scheme: the v2 short names of `theme.ts`, plus the extras templates need |
| Print (phase 2) | The shared token block carries `@media print` with the light values; no hand-set print colors |
| Design file (phase 2) | `docs/DESIGN_SYSTEM.md` is canonical; `DESIGN.md` or `DESIGN_SYSTEM.md` at the root are accepted |
