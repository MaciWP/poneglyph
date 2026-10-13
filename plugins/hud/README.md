# Hud

Native Claude Code mod that draws above the prompt, in the band under the transcript:

- **A stats bar**: the model and effort, context, the 5-hour and weekly plan limits, the cache countdown and the session cost, each named by a label. It replaces a `statusLine` command such as ccstatusline, and leaves the footer under the prompt to Claude Code.
- **Thumbnails of pasted images**. Each `[Image #N]` in the draft gets a preview of up to 48×12 cells in a rounded frame, captioned with its number and size in pixels (`#1 · 547×267`). The previews leave once the prompt is sent.
  Inside an Agentic OS terminal (`AOS_URL` on loopback and `AOS_AGENT_ID` set), the images go to
  Agentic OS as bytes (`POST /api/terminals/<id>/drafts`), which shows them at full resolution
  over that terminal; the band keeps one line (`▣ #1 #2 · a resolución completa en Agentic OS`).
  If Agentic OS refuses or cannot be reached, the block thumbnails come back.

When the cache is about to go cold over a half-full window, or the window passes 80 %, the band
proposes **Compactar ahora** (`c`) or **Descartar** (`x`). It never compacts on its own.

The bar keeps the widest of four levels that fits the band (`bodyColumns`):

```
 ◆ Opus 5.5 · alto   CONTEXTO ██▋        26 %  5 HORAS █▉     31 % ↻ 2 h 10  SEMANA ▊      13 %  CACHÉ 54 min  GASTO $12,46
 ◆ Opus 5.5 · alto   CONTEXTO █▌     26 %  5 HORAS 31 %  SEMANA 13 %  CACHÉ 54 min  GASTO $12,46
 ◆ Opus 5.5 · alto   CONTEXTO 26 %  5 HORAS 31 %  SEMANA 13 %  CACHÉ 54 min  GASTO $12,46
 Opus 5.5  ctx 26% · 5h 31% · caché 54 min
```

Full needs 123 cells with every figure, mid (only the context gauge) 96, compact about 90, and
minimal drops week and cost. The model sits in a pill with the theme's accent and labels are
grey. Each figure has its own hue, all theme keys, so they follow a light or dark theme:

| Figure | Color |
|---|---|
| Context | traffic light: `success` under 50 %, `warning` under 70 %, `claude` (orange) under 85 %, then `error` |
| 5 hours | `ide` (blue), `error` from 85 % |
| Week | `autoAccept` (violet), `error` from 85 % |
| Cache | `planMode` (teal), `warning` in its last five minutes, `error` when cold |
| Cost | dim |

Gauges fill to an eighth of a cell (`▏`…`▉`) over a `subtle` track. `→ lleno 16:40` follows the 5-hour figure at every width, and only when, at the
pace of the last hour, the window fills before it resets. The cache shows minutes and turns into
a clock for its last five, so the bar redraws once a minute until then. A survey in the band
hides the bar. The bar is the band's first row, so a short band scrolls the thumbnails and the
compaction proposal out of view before it.

Thumbnails draw 2×2 pixels a cell with quadrant blocks (`▘▝▖▗▚▞…`): each cell splits its four
pixels into the two groups that lose least color, as chafa does.

## What it reads, with which call, and what it costs

| Data | Call | Cost |
|---|---|---|
| Model and effort | `turn.step` of the main loop (subagents ignored), `$.session.model()` at start | none |
| Context, plan limits, cost | `session.measure` after each turn, `$.session.usage()` at start | none: no token, no request |
| Cache countdown | the time of the last `turn.complete`; TTL 60 min with plan limits reported, 5 min without | none |
| Pasted images | `$.prompt.read()` every 200 ms (pasting raises no event), then `sips` once per image | one `sips -g` and one `sips -z` per new image; nothing while the draft is unchanged |

It writes one file: `~/.cache/poneglyph/usage.json`, in ccstatusline's cache shape
(`sessionUsage`, `sessionResetAt`, `weeklyUsage`, `weeklyResetAt`), whenever the plan limits move.
Agentic OS reads it for its plan indicator. Nothing leaves the machine.

`HUD_CACHE_TTL_MIN` overrides the cache TTL.

## Where it draws

| Surface | Bar | Thumbnails |
|---|---|---|
| Terminal (any truecolor terminal, Agentic OS's xterm.js included) | ✓ | ✓ as a `Raster` of quadrant cells, four pixels per cell |
| Desktop Code tab | ✓ | no (`Raster` is terminal-only) |
| VS Code, `-p`, cloud | no | no |

The thumbnails need macOS `sips`; on other systems the band shows nothing extra and the tag stays in the draft.

## Load

Requires Claude Code 2.1.292 or later. Poneglyph's root `.claude-plugin/marketplace.json` lists
the mod: enable `hud@poneglyph` in the machine overlay and run `sync-poneglyph`. Once the bar is
visible, remove `statusLine` from the settings so the two do not repeat each other.

## Verification

```sh
claude plugin validate plugins/hud
claude plugin test plugins/hud
bun test plugins/hud/tests/*.spec.ts
```

The engine tests stub the host and prove the trees, hooks, buttons and the usage file; they
do not prove how a real terminal paints.
