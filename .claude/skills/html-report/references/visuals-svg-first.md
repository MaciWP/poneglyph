---
parent: html-report
name: visuals-svg-first
description: SVG-first diagram & chart patterns for self-contained reports + the decision rule for when to fall back to JS (mermaid.js). Feature 007.
---

# Visuals — SVG-first (diagrams + charts)

How `html-report` embeds **diagrams** (flow, comparison) and **charts** (bars, score, decision matrix) while staying **self-contained**. The generator composes inline SVG by hand — same pattern already proven in the templates (gauge, severity-bar). No charting library, no JS by default.

> **Environment fact (re-verified 2026-06-08 via `command -v`)**: `node` / `npx` / `bunx` / `bun` / `python3` / `pandoc` ARE present (`/opt/homebrew/bin`); `typst` / `weasyprint` / `chromium` are absent. (This corrects the prior "2026-06-03: node/npx absent" claim, which was stale.) Consequences: a **generation-time** step (e.g. running Observable Plot or `mmdc` via `npx` to emit SVG, then inlining it) IS now possible. **SVG-by-hand remains the default** — not because runtime is missing, but because it guarantees the artefact is **self-contained with zero generation-time dependencies** (Cmd V). Generation-time tooling is an opt-in that must degrade to the hand path if the package/network is unavailable.

## Decision rule — SVG-by-hand vs JS opt-in

| Situation | Path | Why |
|---|---|---|
| Flow ≤ ~8 nodes, linear or simple branch | **SVG by hand** | Self-contained, offline, prints, client-ready |
| Comparison / bars / score / decision matrix | **SVG + CSS by hand** | Data geometry is trivial; reuse gauge/sevbar pattern |
| Dense graph (>~10 nodes, crossing edges, auto-layout needed) | **JS opt-in** (`mermaid.js`) | Hand layout not reasonable; declare the dependency |

**JS opt-in is a declared exception, not a default.** When taken: inline `mermaid.js` OR a CDN `<script>` — note in the document header that it is no longer pure-offline (CDN = network dependency; inline bundle = +hundreds of KB). Prefer SVG-by-hand whenever the diagram is simple enough (Cmd V, spec AC2/AC4).

> Open question (calibrate in use): the exact node/edge count where hand-SVG stops being reasonable. Start conservative (~8 nodes) and revise.

## A11y + anti-slop (every visual)

- `role="img"` + a descriptive `aria-label` on every `<svg>` (WCAG, not color-alone).
- Colors via the dark tokens (`--accent`, `--good/mid/warn/bad`, `--ink-*`) — never raw hex, never purple gradients, never chartjunk (anti-slop.md).
- `font-variant-numeric: tabular-nums` on numeric labels.

## Patterns

### 1 — Flow (steps)

```html
<svg role="img" aria-label="Flujo: Scope → Plan → Build → Review" viewBox="0 0 600 64" width="100%" style="max-width:600px">
  <style>
    .nx{fill:var(--panel);stroke:var(--line);rx:8} .nt{fill:var(--ink);font:500 13px var(--sans)}
    .ar{stroke:var(--ink-3);stroke-width:1.5;marker-end:url(#a)}
  </style>
  <defs><marker id="a" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
    <path d="M0,0 L6,3 L0,6 Z" fill="var(--ink-3)"/></marker></defs>
  <rect class="nx" x="2"   y="18" width="120" height="28"/><text class="nt" x="62"  y="36" text-anchor="middle">Scope</text>
  <rect class="nx" x="160" y="18" width="120" height="28"/><text class="nt" x="220" y="36" text-anchor="middle">Plan</text>
  <rect class="nx" x="318" y="18" width="120" height="28"/><text class="nt" x="378" y="36" text-anchor="middle">Build</text>
  <rect class="nx" x="476" y="18" width="120" height="28"/><text class="nt" x="536" y="36" text-anchor="middle">Review</text>
  <line class="ar" x1="124" y1="32" x2="158" y2="32"/><line class="ar" x1="282" y1="32" x2="316" y2="32"/><line class="ar" x1="440" y1="32" x2="474" y2="32"/>
</svg>
```

### 2 — Comparison bars (A vs B vs …)

```html
<svg role="img" aria-label="Comparativa: A 8, B 6, C 4 sobre 10" viewBox="0 0 320 96" width="100%" style="max-width:320px">
  <style>.bt{fill:var(--ink-2);font:500 12px var(--mono)} .bv{fill:var(--ink);font:600 12px var(--mono)}</style>
  <text class="bt" x="0" y="16">A</text><rect x="28" y="6"  width="240" height="14" rx="7" fill="var(--track)"/><rect x="28" y="6"  width="192" height="14" rx="7" fill="var(--good)"/><text class="bv" x="276" y="17">8</text>
  <text class="bt" x="0" y="46">B</text><rect x="28" y="36" width="240" height="14" rx="7" fill="var(--track)"/><rect x="28" y="36" width="144" height="14" rx="7" fill="var(--mid)"/> <text class="bv" x="276" y="47">6</text>
  <text class="bt" x="0" y="76">C</text><rect x="28" y="66" width="240" height="14" rx="7" fill="var(--track)"/><rect x="28" y="66" width="96"  height="14" rx="7" fill="var(--warn)"/><text class="bv" x="276" y="77">4</text>
</svg>
```

### 3 — Score / progress (single value)

Reuse the existing CSS bar pattern (no SVG needed): a track `<div>` + a fill `<div style="width:N%">` colored by threshold (`--good/mid/warn/bad`). See the gauge/sevbar in `templates/components.html` for the canonical version.

### 4 — Decision matrix (consumed by decision.template — US3)

A weighted options×criteria grid: an HTML `<table>` whose score cells carry a small inline bar (CSS width = score/max) colored by threshold, plus a weighted total column. Pure HTML+CSS, no SVG library. US3's `decision.template.html` embeds this as its core component; this section is its single source — do NOT re-author it elsewhere (Cmd IX).

```html
<table class="dmatrix"><thead><tr><th>Opción</th><th>Precio (×3)</th><th>Panel (×2)</th><th>Total</th></tr></thead>
<tbody>
  <tr><td>Monitor A</td><td><span class="cell"><i style="width:80%;background:var(--good)"></i>8</span></td><td><span class="cell"><i style="width:60%;background:var(--mid)"></i>6</span></td><td class="tot good">7.2</td></tr>
</tbody></table>
```

## Verification (US2 oracle)

- Every example renders with the network disabled (no external asset).
- `Grep '<script'` over a generated doc using only these patterns → 0.
- Passes `anti-slop.md` (no purple gradients, no chartjunk) + `taste-hard-rules.md` (tabular-nums, tinted colors, a11y label).
