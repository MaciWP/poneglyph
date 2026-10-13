import type { EngineInterface, Register, RenderElement, UiPressArgument } from "claude-code";
import { callout } from "./components/callout.ts";
import { cards } from "./components/cards.ts";
import { compare } from "./components/compare.ts";
import { draft } from "./components/draft.ts";
import { table } from "./components/table.ts";
import { tasks } from "./components/tasks.ts";
import { hasBlocks, parse } from "./markdown.ts";
import { draftText, INPUT_SCHEMA, validate, type View } from "./schema.ts";
import type { Ui } from "./theme.ts";
import type { Thumb } from "./components/cards.ts";
import { bmpCells, thumbSize } from "./raster.ts";

const TOOL = "mcp__vista__show";
const PANE = "vista";

// The description alone made the model see the tool and never call it (0 of 8); the fixed
// line on every prompt made it call when it should and stay quiet otherwise (16 of 16).
const DESCRIPTION =
  "Show the user an interactive component in the terminal instead of markdown. Every call needs kind and title. kind compare: 2-4 options side by side, one tab per topic (options, topics[{name, rows[{label, values: one per option, best?: index of the winner}]}], verdict?). kind cards: a ranking of 1-5 items, best first (items[{name, metric?, badge?, detail?, image?: absolute local path}]). kind draft: text the user will copy, such as a PR body, commit message, email or chat message (label, subject?, body). Do not use it for yes/no answers, explanations, a single item, plain lists or command output. After it returns, add at most one sentence; never repeat the data.";
const CONTEXT =
  "Vista: call mcp__vista__show instead of markdown when comparing 2+ options on 2+ dimensions (compare), ranking items (cards) or handing over text to copy: PR, commit, email, message (draft); then one sentence.";
const SHOWN = "Shown to the user. Add at most one sentence; do not repeat the data.";

// Card thumbnails from local images, loaded apart from the pure render: macOS sips scales the
// image into an uncompressed BMP in the temp folder and raster.ts turns it into cells.
// ponytail: macOS only, other systems show the file name; decode in-process if vista runs elsewhere.
const BOX = { columns: 16, rows: 6 };
const MAX_BYTES = 20 * 1024 * 1024;
const IMAGE = /\.(png|jpe?g|gif|webp|heic|tiff?|bmp)$/i;

// By path, for the session; null is a failed load.
const done = new Map<string, Thumb | null>();
const loading = new Map<string, Promise<Thumb | null>>();

// The thumbnail if it is ready, null if it failed, undefined while it loads (or not started).
const thumbOf = (path: string) => done.get(path);

async function load($: EngineInterface, path: string): Promise<Thumb | null> {
  try {
    if (!IMAGE.test(path)) return null;
    const stat = await $.fs.stat(path);
    if (stat.kind !== "file" || stat.size > MAX_BYTES) return null;
    const dims = (await $.process.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path])).stdout;
    const w = Number(/pixelWidth: (\d+)/.exec(dims)?.[1]);
    const h = Number(/pixelHeight: (\d+)/.exec(dims)?.[1]);
    if (!(w > 0 && h > 0)) return null;
    const { columns, rows } = thumbSize(w, h, BOX.columns, BOX.rows);
    const out = `${(await $.env.get("TMPDIR")) ?? "/tmp"}/vista-${crypto.randomUUID()}.bmp`.replace("//", "/");
    try {
      const run = await $.process.run(["sips", "-z", String(rows * 2), String(columns * 2), "-s", "format", "bmp", path, "--out", out]);
      if (run.exitCode !== 0) return null;
      return bmpCells(Uint8Array.fromBase64((await $.fs.read(out, { as: "bytes" })).base64));
    } finally {
      await $.process.run(["rm", "-f", out]).catch(() => {});
    }
  } catch {
    return null;
  }
}

// Starts each image once; `onReady` runs when one finishes so the caller can redraw.
function loadThumbs($: EngineInterface, paths: string[], onReady: () => void) {
  for (const path of paths) {
    if (done.has(path) || loading.has(path)) continue;
    const job = load($, path).then((thumb) => {
      done.set(path, thumb);
      loading.delete(path);
      onReady();
      return thumb;
    });
    loading.set(path, job);
  }
}

// Every valid call seen this session, in order (a restored transcript fills it as it draws),
// with what the person chose in it.
const calls = new Map<string, View>();
const tabs = new Map<string, number>();
const copied = new Set<string>();
let paneCall: string | undefined;
// A reply is rewritten only once its turn ended: while it streams, a half-written table must
// not flicker between two drawings. Blocks drawn while idle (a restored transcript, earlier
// replies) are settled and keep vista's drawing through later turns.
let working = false;
let drawn = false;
const settled = new Set<string>();

function remember($: EngineInterface, id: string, view: View) {
  if (!calls.has(id)) calls.set(id, view);
  if (view.kind === "cards") loadThumbs($, view.items.flatMap((c) => (c.image ? [c.image] : [])), () => $.ui.invalidate("ui.render"));
}

function draw($: EngineInterface, ui: Ui, id: string, view: View, width: number, hotkeys: boolean): RenderElement {
  if (view.kind === "compare")
    return compare(ui, view, width, {
      active: tabs.get(id) ?? 0,
      hotkeys,
      onTab: (i) => {
        tabs.set(id, i);
        $.ui.invalidate("ui.render");
      },
    });
  if (view.kind === "cards") return cards(ui, view, view.items.map((c) => (c.image ? thumbOf(c.image) : null)));
  return draft(ui, view, {
    copied: copied.has(id),
    hotkeys,
    onCopy: (surface: UiPressArgument["surface"]) => {
      void $.ui.copy({ text: draftText(view), surface }).then(({ isCopied }) => {
        if (!isCopied) return $.ui.toast("No se ha podido copiar");
        copied.add(id);
        $.ui.invalidate("ui.render");
      });
    },
  });
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    // Where nothing is drawn (-p, the SDK, a consultation) a shown component would be lost
    // data: the tool stays unregistered and the model answers in markdown.
    drawn = e.isInteractive && (e.surface === "terminal" || e.surface === "desktop");
    if (!drawn) return r;
    await $.tool.register({ name: "show", description: DESCRIPTION, inputSchema: INPUT_SCHEMA });
    await $.command.register({ name: "vista", description: "Abrir una vista en un panel con teclado", argumentHint: "[n]", immediate: true });
    return r;
  });

  on("prompt.submit", async ($, e, next) => (drawn ? next({ ...e, context: [...(e.context ?? []), CONTEXT] }) : next(e)));

  // Keep the schema in the prompt instead of behind ToolSearch; the text never changes, so the
  // prompt cache holds.
  on("tool.describe", { tool: TOOL }, async ($, e, next) => ({ ...(await next(e)), isDeferred: false }));

  on("tool.call", { tool: TOOL }, async ($, e) => {
    const { tool, tool_use_id, ...input } = e as unknown as Record<string, unknown> & { tool: string; tool_use_id: string };
    const checked = validate(input);
    if (!checked.ok) return { result: `Not shown: ${checked.error}. Fix it and call again, or answer in markdown.`, isError: true };
    remember($, tool_use_id, checked.view);
    return { result: SHOWN };
  });

  // Only a finished, valid call becomes a component; running, failed, interrupted or
  // malformed ones keep the engine's row.
  on("ui.render", { component: "ToolUse" }, async ($, e, next) => {
    const p = e.props;
    if (p.tool !== TOOL || p.isRunning || p.isErrored || p.isInterrupted) return next(e);
    const checked = validate(p.input);
    if (!checked.ok) return next(e);
    remember($, p.tool_use_id, checked.view);
    const ui = $.ui.resolve(e);
    return draw($, { ...ui, Raster: "Raster" in ui ? ui.Raster : undefined }, p.tool_use_id, checked.view, e.viewport?.columns ?? 100, false);
  });

  // The result is for the model; the person already sees the component.
  on("ui.render", { component: "ToolResult" }, async ($, e, next) => {
    if (e.props.tool !== TOOL || e.props.isErrored) return next(e);
    const { Text } = $.ui.resolve(e);
    return Text({ dimColor: true, children: "  ⎿ vista mostrada · /vista la abre con teclado" });
  });

  on("turn.start", async ($, e, next) => {
    working = true;
    return next(e);
  });

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (!e.agentId) {
      working = false;
      $.ui.invalidate("ui.render");
    }
    return r;
  });

  // Tables, callouts and task lists in a reply get vista's components; the text around them
  // goes through next() piece by piece, so Claude Code (and any mod after this one, such as
  // workboard moving ROBIN) still draws it. The first piece keeps the reply's bullet.
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    const p = e.props;
    if (p.isSummary || !e.viewport) return next(e);
    if (!working) settled.add(e.requestId);
    if (!settled.has(e.requestId)) return next(e);
    const blocks = parse(p.text);
    if (!hasBlocks(blocks)) return next(e);
    const ui = $.ui.resolve(e);
    const { Box, Text } = ui;
    const width = e.viewport.columns - 2;
    const parts: RenderElement[] = [];
    for (const [i, b] of blocks.entries()) {
      const first = i === 0;
      if (b.kind === "text") {
        const drawn = (await next({ ...e, props: { ...p, text: b.text, isFirstOfReply: first && p.isFirstOfReply } })) as RenderElement;
        parts.push(first ? drawn : Box({ paddingLeft: 2, children: drawn }));
        continue;
      }
      const own =
        b.kind === "table"
          ? table({ ...ui, Raster: undefined }, b.head.slice(1), b.rows.map((r) => ({ label: r[0] ?? "", values: r.slice(1) })), width, b.head[0])
          : b.kind === "callout"
            ? callout({ ...ui, Raster: undefined }, b.type, b.text)
            : tasks({ ...ui, Raster: undefined }, b.items);
      // A reply that opens with a component draws the bullet itself.
      parts.push(Box({ children: [Box({ width: 2, flexShrink: 0, children: Text({ children: first && p.isFirstOfReply ? "⏺" : "" }) }), Box({ flexGrow: 1, flexShrink: 1, children: own })] }));
    }
    return Box({ flexDirection: "column", rowGap: 1, children: parts });
  });

  on("command.run", { command: "vista" }, async ($, e) => {
    const ids = [...calls.keys()];
    if (!ids.length) return { text: "Todavía no hay ninguna vista en esta conversación." };
    const n = Number(e.args.trim());
    const id = Number.isInteger(n) && n >= 1 && n <= ids.length ? ids[n - 1] : ids.at(-1);
    paneCall = id;
    await $.ui.open({ id: PANE, title: "Vista", columns: 100, rows: 24, focus: true });
    $.ui.invalidate("ui.render");
    return {};
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e, next) => {
    const view = paneCall ? calls.get(paneCall) : undefined;
    if (!paneCall || !view) return next(e);
    const ui = $.ui.resolve(e);
    const ids = [...calls.keys()];
    const { Box, Text } = ui;
    return Box({
      flexDirection: "column",
      children: [
        Text({ dimColor: true, children: `Vista ${ids.indexOf(paneCall) + 1} de ${ids.length} · /vista <n> abre otra` }),
        draw($, { ...ui, Raster: "Raster" in ui ? ui.Raster : undefined }, paneCall, view, e.props.bodyColumns, true),
      ],
    });
  });
};
