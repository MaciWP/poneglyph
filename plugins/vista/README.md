# Vista

Native Claude Code mod that gives answers a visual, interactive form in the transcript. The
model calls one tool, `show`, with plain data; the mod draws it.

| kind | Draws | Interaction |
|---|---|---|
| `compare` | 2-4 options side by side, one tab per topic (up to 6; the active one a filled pill), the winner of each row marked `✓`, an optional verdict | a click on a tab switches the table |
| `cards` | a ranking of 1-5 items, best first: rank in a pill (the first in the accent), name, badge, metric, detail and a thumbnail of a local image (2×2 pixels a cell) | none |
| `draft` | text to copy (PR, commit, email, message): optional subject over the exact body | **Copiar** copies subject and body |

## Markdown in replies

Vista also redraws three markdown blocks in the model's replies, with the same components:

| Block | Drawn as |
|---|---|
| GFM table | at most 100 columns wide. While every cell fits on one line, the comparison table: bold accent header over a rule and a bold first column. Once a cell wraps (or columns get too narrow), a list: the first column's name on top, then each row behind an accent bar, its label in bold and each value under it with its column name at one fixed width, so values line up |
| `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` | a framed note in its tone, its body still markdown |
| flat task list (`- [x]`, `- [ ]`) | a checklist under a progress bar and its count (`1 de 2 hechas`); done items struck through |

A reply with none of them is left untouched. Code fences are never looked into, and an
incomplete or nested block stays text. The text around a block goes back to Claude Code piece
by piece (`next()`), so the reply keeps its bullet and a mod after vista, such as workboard
moving ROBIN to its pane, still acts on it. A reply is redrawn only once its turn ends, so a
table being written never flickers; summaries are left alone. Cell text loses its inline marks
(bold, italics, code), since a table cell is plain text.

`show` is only for what markdown cannot do: tabs, thumbnails and Copiar. Running, failed, interrupted or malformed calls keep Claude Code's own row, and the
result row under a shown component is one dim line.

Without a mouse, `/vista` opens the last component in a focused pane and `/vista <n>` the nth
of the conversation; there the tabs answer to `1`-`6` and Copiar to `c`.

A narrow transcript (a value column under 12 cells) stacks each comparison row: the label,
then one `option: value` line per option, so no word is broken.

## When the model calls it

The tool's description alone made the model see it and never call it (0 of 8 prompts). A fixed
line added to every prompt (`prompt.submit`) fixes that: in a judgement run of 8 prompts on
Haiku and Sonnet, it called `show` for the 4 comparisons, rankings and drafts and stayed in
markdown for a yes/no, an explanation, a `git status` and a list of steps (16 of 16). That run
used `claude -p`, before vista stopped registering itself where nothing is drawn; repeat it in
an interactive session. A
malformed call returns the exact field to fix, and the model retries.

Known misses: after a web search, a ranking may still come back as a markdown list, and a
model may repeat the data in prose after the component.

## What it costs

The tool is deferred: only its name is in every request, and the fixed context line tells the
model to load it with ToolSearch before the first call. Pinning the schema with `isDeferred: false`
had measured about 1,200 tokens per request, schema plus line (20,957 against 19,721 input tokens on
Haiku for the same prompt), for 30 uses in 190 sessions over 14 days. A comparison payload is about 1,500 characters of output.

Thumbnails need macOS `sips`: an image of up to 20 MB is scaled into a temporary BMP, read
and removed. Elsewhere the card names the file instead.

## Where it draws

| Surface | Components | Thumbnails |
|---|---|---|
| Terminal (Agentic OS's xterm.js included) | ✓ | ✓ as a `Raster` of quadrant cells |
| Desktop Code tab | ✓, once the app joins; no ⏺ gutter, no keyboard hints | no (`Raster` is terminal-only) |
| `-p`, SDK, consultations, mobile | not registered: no tool, no context line, plain markdown | no |

The desktop app starts its session as `-p` does (no surface, not interactive) and joins it
afterwards (`session.attach`); the mod comes up on that join.

## Load

Requires Claude Code 2.1.292 or later. Poneglyph's root `.claude-plugin/marketplace.json` lists
the mod: enable `vista@poneglyph` in the machine overlay and run `sync-poneglyph`.

`hooks/raster.ts` is a copy of hud's: a plugin installs alone and cannot import another. A
test fails when the two differ.

## Verification

```sh
claude plugin validate plugins/vista
claude plugin test plugins/vista
bun test plugins/vista/tests/*.spec.ts
```

The engine tests prove the trees, the tab switch, Copiar, the pane, every state that keeps
the original row, and replies redrawn only after their turn with the text still passed on; they do not prove how a real terminal paints.
