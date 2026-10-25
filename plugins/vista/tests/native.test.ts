import { test, expect, mock } from "claude-code/testing";
import type { On } from "claude-code";

const TOOL = "mcp__vista__show";
const start = { cwd: "/work/project", surface: "terminal" as const, isInteractive: true };
const viewport = { columns: 100, rows: 40, isFullscreen: true };

const compare = {
  kind: "compare",
  title: "SQLite · Postgres · DuckDB",
  options: ["SQLite", "Postgres", "DuckDB"],
  topics: [
    { name: "Rendimiento", rows: [{ label: "Lecturas", values: ["muy rápidas", "rápidas", "rápidas"], best: 0 }] },
    { name: "Precio", rows: [{ label: "Licencia", values: ["dominio público", "PostgreSQL", "MIT"] }] },
  ],
  verdict: "SQLite para local, Postgres para servidor.",
};
const draft = { kind: "draft", title: "Descripción del PR", label: "PR", subject: "feat: vista", body: "Añade el mod vista." };
const cards = {
  kind: "cards",
  title: "Vinos para la cena",
  items: [
    { name: "Rioja Reserva", metric: "92 pts", badge: "18 €", image: "/img/rioja.png" },
    { name: "Albariño", detail: "Fresco y con acidez." },
  ],
};

function toolUse(id: string, input: object, state: Partial<{ isRunning: boolean; isErrored: boolean; isInterrupted: boolean }> = {}) {
  return {
    plugin: "vista",
    surface: "terminal" as const,
    component: "ToolUse" as const,
    requestId: id,
    viewport,
    props: { tool_use_id: id, tool: TOOL, input, isRunning: false, isErrored: false, isInterrupted: false, output: undefined, onScreen: null, ...state },
  } as never;
}

// A 2×2 top-down 32-bit BMP, as sips writes it.
function bmp() {
  const offset = 14 + 56;
  const v = new DataView(new ArrayBuffer(offset + 16));
  v.setUint16(0, 0x424d);
  v.setUint32(10, offset, true);
  v.setUint32(14, 56, true);
  v.setInt32(18, 2, true);
  v.setInt32(22, -2, true);
  v.setUint16(28, 32, true);
  v.setUint32(30, 3, true);
  v.setUint32(54, 0xff0000, true);
  v.setUint32(58, 0xff00, true);
  v.setUint32(62, 0xff, true);
  for (let i = 0; i < 4; i++) v.setUint32(offset + i * 4, 0xffff0000, true);
  return new Uint8Array(v.buffer).toBase64();
}

function world(on: On) {
  const clock = mock.clock(on, { now: Date.parse("2026-10-11T10:00:00Z") });
  mock.env(on, { TMPDIR: "/tmp/t" });
  const copies: string[] = [];
  const opens: unknown[] = [];
  const runs: string[][] = [];
  const toasts: string[] = [];
  const tools: { name: string; description: string }[] = [];
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("session.attach", (_, e) => ({ clientId: e.clientId }));
  on("command.register", (_, e) => ({ value: { command: e.name } }));
  on("tool.register", (_, e) => {
    tools.push(e);
    return { value: { tool: TOOL } };
  });
  on("ui.open", (_, e) => {
    opens.push(e);
    return { value: undefined };
  });
  on("ui.copy", (_, e) => {
    copies.push(e.text);
    return { value: { isCopied: true } };
  });
  on("ui.toast", (_, e) => {
    toasts.push(e.text);
    return { value: undefined };
  });
  on("fs.stat", () => ({ value: { kind: "file", size: 1000, mtimeMs: 0, isLink: false } }));
  on("fs.read", () => ({ value: { base64: bmp() } }));
  on("process.run", (_, e) => {
    runs.push([...e.argv]);
    const stdout = e.argv.includes("-g") ? "  pixelWidth: 200\n  pixelHeight: 100\n" : "";
    return { value: { exitCode: 0, stdout, stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
  });
  on("turn.start", (_, e) => ({ turnId: e.turnId }));
  on("turn.complete", (_, e) => ({ text: e.answer }));
  // The engine's own drawing; for a reply it drops the ROBIN line the way workboard does
  // when its pane shows it, standing in for any mod after vista.
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e);
    if (e.component !== "AssistantMessage") return Text({ children: `Original ${e.component}` });
    const text = e.props.text.replace(/\n?ROBIN:.*$/, "");
    return Text({ children: `${e.props.isFirstOfReply ? "⏺ " : ""}MD:${text}` });
  });
  return { clock, copies, opens, runs, toasts, tools };
}

test("show registers deferred, with a fixed context line naming how to load it, on every prompt", async ($, on) => {
  const w = world(on);
  let context: string[] = [];
  on("prompt.submit", (_, e) => {
    context = [...(e.context ?? [])];
    return { text: e.text };
  });
  on("tool.describe", (_, e) => ({ description: e.description, isDeferred: true }));
  await $.session.start(start);
  expect(w.tools[0]?.name).toBe("show");
  // The description stays under the agreed budget, so its tokens stay small and cached.
  expect(w.tools[0]?.description.split(/\s+/).length).toBeLessThan(120);
  await $.prompt.submit({ text: "Compara A y B", origin: { kind: "composer" } } as never);
  expect(context.at(-1)).toContain("mcp__vista__show");
  const described = await $.tool.describe({ tool: TOOL, description: "d", isDeferred: true, provider: { plugin: "vista", tier: "user" } });
  expect(described.isDeferred).toBe(true);
  expect(context.at(-1)).toContain("ToolSearch");
});

test("a session that draws nothing gets neither the tool nor the context line", async ($, on) => {
  const w = world(on);
  let context: string[] = [];
  on("prompt.submit", (_, e) => {
    context = [...(e.context ?? [])];
    return { text: e.text };
  });
  await $.session.start({ ...start, isInteractive: false });
  expect(w.tools).toHaveLength(0);
  await $.prompt.submit({ text: "Compara A y B", origin: { kind: "composer" } } as never);
  expect(context.some((c) => c.includes("vista"))).toBe(false);
});

// The desktop app starts the session as `-p` does (no surface, not interactive) and joins it
// afterwards; only that join tells the two apart.
test("the desktop gets the tool once it joins, and draws without the terminal's gutter", async ($, on) => {
  const w = world(on);
  let context: string[] = [];
  on("prompt.submit", (_, e) => {
    context = [...(e.context ?? [])];
    return { text: e.text };
  });
  await $.session.start({ cwd: "/work/project", surface: null, isInteractive: false });
  expect(w.tools).toHaveLength(0);
  await $.session.attach({ surface: "desktop", clientId: "desktop:default" });
  // A second client of the same session registers nothing twice.
  await $.session.attach({ surface: "desktop", clientId: "desktop:2" });
  expect(w.tools.map((t) => t.name)).toEqual(["show"]);
  await $.prompt.submit({ text: "Compara A y B", origin: { kind: "composer" } } as never);
  expect(context.at(-1)).toContain("mcp__vista__show");
  const desk = <T extends object>(m: T) => ({ ...m, surface: "desktop" }) as never;
  const row = await $.ui.mount(desk(toolUse("t1", compare)));
  expect(await row.find({ type: "Button", text: "Rendimiento" })).toBeDefined();
  const result = await $.ui.mount(desk({ plugin: "vista", component: "ToolResult", requestId: "t1", viewport, props: { tool_use_id: "t1", tool: TOOL, output: "Shown", isErrored: false, onScreen: null } }));
  expect((await result.find({ type: "Text", text: /vista mostrada/ }))?.text).toBe("vista mostrada");
  // A reply opening with a table: the terminal would draw vista's own ⏺ in a gutter beside it.
  const m = await $.ui.mount(desk(reply("m1", "| Base | Precio |\n|---|---|\n| SQLite | gratis |\n\nDespués.")));
  expect(await m.find({ type: "Text", text: "SQLite" })).toBeDefined();
  // The bullet column is vista's own; the stub engine's "⏺ MD:" piece is not it.
  expect(await m.find({ type: "Text", text: /^⏺$/ })).toBeUndefined();
});

test("a desktop joining a terminal session registers nothing twice", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await $.session.attach({ surface: "desktop", clientId: "desktop:default" });
  expect(w.tools.map((t) => t.name)).toEqual(["show"]);
});

test("a phone joining draws nothing new: only the desktop registers the tool", async ($, on) => {
  const w = world(on);
  await $.session.start({ cwd: "/work/project", surface: null, isInteractive: false });
  await $.session.attach({ surface: "mobile", clientId: "mobile:default" });
  expect(w.tools).toHaveLength(0);
});

test("a valid call is shown and a malformed one goes back to the model with the field to fix", async ($, on) => {
  world(on);
  await $.session.start(start);
  const ok = await $.tool.call({ tool: TOOL, tool_use_id: "t1", ...compare } as never);
  expect(ok).toEqual({ result: "Shown to the user. Add at most one sentence; do not repeat the data." });
  const bad = await $.tool.call({ tool: TOOL, tool_use_id: "t2", kind: "compare", title: "x", options: ["a"] } as never);
  expect(bad).toEqual({ result: "Not shown: options has 1 entries; send 2 to 4. Fix it and call again, or answer in markdown.", isError: true });
});

test("the comparison switches topic with a click and keeps the engine's row while it runs", async ($, on) => {
  world(on);
  await $.session.start(start);
  const running = await $.ui.mount(toolUse("t0", compare, { isRunning: true }));
  expect(await running.find({ text: "Original ToolUse" })).toBeDefined();
  const row = await $.ui.mount(toolUse("t1", compare));
  expect(await row.find({ text: " ◆ COMPARAR " })).toBeDefined();
  expect(await row.find({ type: "Button", text: "Rendimiento" })).toBeDefined();
  // The active tab is a filled pill; the others are plain words.
  expect((await row.find({ type: "Text", text: " Rendimiento " }))?.props).toMatchObject({ backgroundColor: "suggestion", weight: "semibold" });
  expect((await row.find({ type: "Text", text: " Precio " }))?.props).toMatchObject({ color: "inactive" });
  expect(await row.find({ text: "✓ muy rápidas" })).toBeDefined();
  expect(await row.find({ type: "Text", text: "─────" })).toBeDefined();
  expect(await row.find({ text: "SQLite para local, Postgres para servidor." })).toBeDefined();
  await row.press({ key: "vista-tab-1" });
  await row.redraw();
  expect(await row.find({ text: "dominio público" })).toBeDefined();
  expect((await row.find({ type: "Text", text: " Precio " }))?.props).toMatchObject({ backgroundColor: "suggestion" });
  expect(await row.find({ text: "✓ muy rápidas" })).toBeUndefined();
  // A narrow transcript stacks each row instead of breaking words in thin columns.
  const narrow = await $.ui.mount({ ...(toolUse("t8", compare) as object), viewport: { ...viewport, columns: 50 } } as never);
  expect((await narrow.find({ type: "Text", text: /^SQLite$/ }))?.props).toMatchObject({ color: "inactive" });
  expect(await narrow.find({ type: "Text", text: /^▌/ })).toBeDefined();
  expect(await row.find({ type: "Text", text: /^▌/ })).toBeUndefined();
  // Each call keeps its own tab.
  const other = await $.ui.mount(toolUse("t9", compare));
  expect(await other.find({ text: "✓ muy rápidas" })).toBeDefined();
});

test("failed, interrupted or malformed calls keep the engine's row", async ($, on) => {
  world(on);
  await $.session.start(start);
  for (const [id, state] of [["e1", { isErrored: true }], ["e2", { isInterrupted: true }]] as const) {
    const row = await $.ui.mount(toolUse(id, compare, state));
    expect(await row.find({ text: "Original ToolUse" })).toBeDefined();
  }
  const malformed = await $.ui.mount(toolUse("t2", { kind: "compare", title: "x" }));
  expect(await malformed.find({ text: "Original ToolUse" })).toBeDefined();
  const result = await $.ui.mount({
    plugin: "vista",
    surface: "terminal",
    component: "ToolResult",
    requestId: "t1",
    viewport,
    props: { tool_use_id: "t1", tool: TOOL, output: "Shown", isErrored: false, onScreen: null },
  } as never);
  expect(await result.find({ text: "  ⎿ vista mostrada · /vista la abre con teclado" })).toBeDefined();
});

test("Copiar copies subject and body and says so", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  const row = await $.ui.mount(toolUse("t3", draft));
  expect(await row.find({ text: " ✉ PR " })).toBeDefined();
  expect(await row.find({ text: "Añade el mod vista." })).toBeDefined();
  await row.press({ key: "vista-copy" });
  await w.clock.settle();
  await row.redraw();
  expect(w.copies).toEqual(["feat: vista\n\nAñade el mod vista."]);
  expect(await row.find({ text: "✓ Copiado" })).toBeDefined();
});

test("a ranking draws its thumbnail once loaded and names the file when it cannot", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  const row = await $.ui.mount(toolUse("t4", cards));
  expect(await row.find({ text: " ★ RANKING " })).toBeDefined();
  expect((await row.find({ type: "Text", text: " 1 " }))?.props).toMatchObject({ backgroundColor: "suggestion" });
  expect((await row.find({ type: "Text", text: " 2 " }))?.props).toMatchObject({ backgroundColor: "subtle" });
  expect(await row.find({ text: "  92 pts" })).toBeDefined();
  expect(await row.find({ text: " 18 € " })).toBeDefined();
  await w.clock.settle();
  await row.redraw();
  expect(await row.find({ type: "Raster" })).toBeDefined();
  expect(w.runs.find((r) => r.includes("-z"))?.slice(0, 4)).toEqual(["sips", "-z", "8", "32"]);
  // The temporary BMP is removed once read.
  expect(w.runs.some((r) => r[0] === "rm" && r[2]?.startsWith("/tmp/t/vista-"))).toBe(true);
  const missing = await $.ui.mount(toolUse("t5", { ...cards, items: [{ name: "Sin foto", image: "/img/notes.txt" }] }));
  await w.clock.settle();
  await missing.redraw();
  expect(await missing.find({ text: "▢ notes.txt" })).toBeDefined();
});

test("/vista opens the last call, or the nth, in a pane with hotkeys", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  const empty = await $.command.run({ command: "vista", args: "", origin: { kind: "composer" }, presentation: { isFullscreen: true, columns: 160 } } as never);
  expect(empty).toEqual({ text: "Todavía no hay ninguna vista en esta conversación." });
  await $.tool.call({ tool: TOOL, tool_use_id: "t1", ...compare } as never);
  await $.tool.call({ tool: TOOL, tool_use_id: "t2", ...draft } as never);
  const pane = {
    plugin: "vista",
    surface: "terminal" as const,
    component: "Pane" as const,
    requestId: "vista",
    props: { title: "Vista", isFocused: true, bodyColumns: 80, placement: "dock" as const, scroll: { offset: 0, bodyRows: 20 }, view: {} },
  } as never;
  await $.command.run({ command: "vista", args: "", origin: { kind: "composer" }, presentation: { isFullscreen: true, columns: 160 } } as never);
  expect(w.opens).toHaveLength(1);
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "Vista 2 de 2 · /vista <n> abre otra" })).toBeDefined();
  expect(await p.find({ type: "Button", text: "Copiar" })).toBeDefined();
  await $.command.run({ command: "vista", args: "1", origin: { kind: "composer" }, presentation: { isFullscreen: true, columns: 160 } } as never);
  await p.redraw();
  expect(await p.find({ text: "Vista 1 de 2 · /vista <n> abre otra" })).toBeDefined();
  await p.press({ key: "vista-tab-1" });
  await p.redraw();
  expect(await p.find({ text: "dominio público" })).toBeDefined();
});

function reply(id: string, text: string, extra: object = {}) {
  return {
    plugin: "vista",
    surface: "terminal" as const,
    component: "AssistantMessage" as const,
    requestId: id,
    viewport,
    props: { text, isFirstOfReply: true, onScreen: null, ...extra },
  } as never;
}
const answer = { answer: "ok", durationMs: 1, isAborted: false, turnId: "t1", reason: "answer" as const };
const withTable = "Antes:\n\n| Base | Precio |\n|---|---|\n| SQLite | gratis |\n\nDespués.\nROBIN: hecho";

test("a reply with a table gets vista's table, and the text around it stays the engine's", async ($, on) => {
  world(on);
  await $.session.start(start);
  const plainReply = await $.ui.mount(reply("m0", "Solo texto."));
  expect(await plainReply.find({ type: "Text", text: "⏺ MD:Solo texto." })).toBeDefined();
  const m = await $.ui.mount(reply("m1", withTable));
  // The first piece keeps the bullet; the last one still loses ROBIN downstream.
  expect((await m.find({ type: "Text", text: "⏺ MD:Antes:" }))?.text).toBe("⏺ MD:Antes:");
  expect((await m.find({ type: "Text", text: "Base" }))?.text).toBe("Base");
  expect((await m.find({ type: "Text", text: "SQLite" }))?.text).toBe("SQLite");
  expect((await m.find({ type: "Text", text: "gratis" }))?.text).toBe("gratis");
  expect((await m.find({ type: "Text", text: "MD:Después." }))?.text).toBe("MD:Después.");
  expect(await m.find({ type: "Text", text: "ROBIN: hecho" })).toBeUndefined();
  // The row label is semibold body text, not the faint grey that made it hard to read.
  expect((await m.find({ type: "Text", text: "SQLite" }))?.props).toMatchObject({ weight: "semibold" });
  expect((await m.find({ type: "Text", text: "SQLite" }))?.props.color).toBeUndefined();
});

test("a table of prose becomes a list: an accent bar per row, the label over its text", async ($, on) => {
  world(on);
  await $.session.start(start);
  const long = "Lo que se gana es cuota del plan y paralelismo, no dinero, porque los subagentes son el uno por ciento del gasto total del mes";
  const md = `| Hallazgo | Consecuencia |\n|---|---|\n| Delegar ahora muy poco | ${long} |\n| FILE_ROOTS falla en Windows | Deniega toda lectura |`;
  const m = await $.ui.mount(reply("p1", md));
  // Only the first column's name heads the list; no rule, no "A · B" title.
  expect((await m.find({ type: "Text", text: "Hallazgo" }))?.props).toMatchObject({ weight: "semibold", color: "suggestion" });
  expect(await m.find({ text: "Hallazgo · Consecuencia" })).toBeUndefined();
  expect(await m.find({ text: /^─+$/ })).toBeUndefined();
  expect((await m.find({ type: "Text", text: "Delegar ahora muy poco" }))?.props).toMatchObject({ weight: "semibold" });
  expect((await m.find({ type: "Text", text: long }))?.props).toMatchObject({ wrap: "wrap" });
  // One value needs no name: the row's label says what it is.
  expect(await m.find({ text: "Consecuencia" })).toBeUndefined();
  // The bar runs the whole row: the label's line plus the two lines the long text wraps to.
  const bars = (await m.findAll({ type: "Text", text: /^▌(\n▌)*$/ })).map((t) => t.text.split("\n").length);
  expect(bars).toEqual([3, 2]);
});

test("with several values each one is named at the same width, and long one-line cells still make a list", async ($, on) => {
  world(on);
  await $.session.start(start);
  const wide = "x ".repeat(75).trim();
  const md = `| Cambio | Qué notarás | Por qué |\n|---|---|---|\n| Imágenes | ${wide} | Nada tapa un terminal |`;
  const m = await $.ui.mount({ ...(reply("p2", md) as object), viewport: { ...viewport, columns: 200 } } as never);
  const keys = await Promise.all(["Qué notarás", "Por qué"].map((text) => m.find({ type: "Text", text })));
  for (const k of keys) expect(k?.props).toMatchObject({ color: "inactive" });
  // Both names sit in boxes as wide as the longest name plus two, so the values line up.
  const named = (await m.findAll({ type: "Box" })).filter((b) => (b.props as { width?: number }).width === "Qué notarás".length + 2);
  expect(named.length).toBe(2);
  // Capped at 100 columns, the 150-character cell wraps, so the table is a list, not a grid.
  expect((await m.findAll({ type: "Text", text: /^▌/ })).length).toBe(1);
});

test("while a turn runs a new reply stays native, and turns into vista's once it ends", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  const old = await $.ui.mount(reply("m1", withTable));
  await $.turn.start({ text: "Otra", turnId: "t1" });
  const live = await $.ui.mount(reply("m2", withTable));
  expect(await live.find({ type: "Text", text: "⏺ MD:Antes:\n\n| Base | Precio |\n|---|---|\n| SQLite | gratis |\n\nDespués." })).toBeDefined();
  // An earlier reply keeps vista's drawing through the new turn.
  await old.redraw();
  expect((await old.find({ type: "Text", text: "Base" }))?.text).toBe("Base");
  await $.turn.complete(answer);
  await w.clock.settle();
  await live.redraw();
  expect((await live.find({ type: "Text", text: "Base" }))?.text).toBe("Base");
});

test("callouts and checklists are drawn; summaries and replies opening with a block keep a bullet", async ($, on) => {
  world(on);
  await $.session.start(start);
  const m = await $.ui.mount(reply("m3", "> [!WARNING]\n> Haz copia.\n\n- [x] Tests\n- [ ] Docs"));
  expect((await m.find({ type: "Text", text: "△ Atención" }))?.text).toBe("△ Atención");
  expect((await m.find({ type: "Text", text: "1 de 2 hechas" }))?.text).toBe("1 de 2 hechas");
  // Half done: 8 of the bar's 16 cells filled, over its track.
  expect((await m.find({ type: "Text", text: "████████" }))?.text).toBe("████████        ");
  expect((await m.find({ type: "Text", text: "Tests" }))?.props).toMatchObject({ strikethrough: true });
  expect((await m.find({ type: "Text", text: "⏺" }))?.text).toBe("⏺");
  const summary = await $.ui.mount(reply("m4", withTable, { isSummary: true }));
  // find matches a substring: the only node is the whole original block.
  expect((await summary.find({ type: "Text", text: "⏺ MD:Antes:" }))?.text).toBe("⏺ MD:Antes:\n\n| Base | Precio |\n|---|---|\n| SQLite | gratis |\n\nDespués.");
});
