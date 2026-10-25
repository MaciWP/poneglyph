import { test, expect, mock } from "claude-code/testing";
import type { On } from "claude-code";

const NOW = Date.parse("2026-10-11T10:00:00Z");
const MIN = 60_000;
const start = { cwd: "/work/project", surface: "terminal" as const, isInteractive: true };
const band = {
  plugin: "hud",
  surface: "terminal" as const,
  component: "AbovePrompt" as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 160, scroll: { offset: 0, bodyRows: 10 }, view: {} },
};
const limits = [
  { kind: "five_hour", percentUsed: 31, resetsAt: new Date(NOW + 130 * MIN).toISOString() },
  { kind: "seven_day", percentUsed: 12, resetsAt: new Date(NOW + 3 * 1440 * MIN).toISOString() },
];

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

function world(on: On, { draft = "", context = 48, env = {} as Record<string, string> } = {}) {
  const clock = mock.clock(on, { now: NOW });
  mock.env(on, { HOME: "/home/me", CLAUDE_CODE_TMPDIR: "/tmp/cc", ...env });
  const writes: Record<string, string> = {};
  const runs: string[][] = [];
  const toasts: string[] = [];
  let compactions = 0;
  let prompt = draft;
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("session.attach", (_, e) => ({ clientId: e.clientId }));
  on("session.id", () => ({ value: "s1" }));
  on("session.model", () => ({ value: "claude-opus-5-5" }));
  on("session.usage", () => ({ value: { startedAt: NOW, context: { window: 200_000, percent: context }, rateLimits: [], cost: { usd: 0.5 } } }));
  on("session.measure", (_, e) => ({ changed: e.changed }));
  on("session.compact", () => {
    compactions++;
    return { messages: [{ role: "user" as const, text: "summary", toolUses: [] }] };
  });
  on("turn.complete", (_, e) => ({ text: e.answer }));
  on("prompt.read", () => ({ value: { text: prompt, cursor: 0 } }));
  on("fs.list", () => ({ value: [{ name: "proj", kind: "dir", size: 0, mtimeMs: 0, isLink: false }] }));
  on("fs.exists", () => ({ value: true }));
  on("fs.read", () => ({ value: { base64: bmp() } }));
  on("fs.write", (_, e) => {
    writes[e.path] = e.text;
    return { value: undefined };
  });
  on("process.run", (_, e) => {
    runs.push([...e.argv]);
    const stdout = e.argv.includes("-g") ? "  pixelWidth: 200\n  pixelHeight: 100\n" : "";
    return { value: { exitCode: 0, stdout, stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
  });
  on("ui.toast", (_, e) => {
    toasts.push(e.text);
    return { value: undefined };
  });
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e);
    return Text({ children: [e.component === "PromptHint" ? "? for shortcuts" : "Existing band"] });
  });
  return { clock, writes, runs, toasts, compactions: () => compactions, type: (t: string) => (prompt = t) };
}

const answer = { answer: "ok", durationMs: 1, isAborted: false, turnId: "t1", reason: "answer" as const };

test("the bar sits above the prompt, labelled, and the plan limits reach the file Agentic OS reads", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await w.clock.settle();
  await $.session.measure({ context: { window: 200_000, percent: 48 }, rateLimits: limits, cost: { usd: 1.84 }, changed: ["rateLimits", "cost", "context"] });
  await $.turn.complete(answer);
  const above = await $.ui.mount(band);
  expect(await above.find({ text: "Existing band" })).toBeDefined();
  expect(await above.find({ text: " Opus 5.5 " })).toBeDefined();
  expect(await above.find({ text: "CONTEXTO " })).toBeDefined();
  // The whole row, exact: each gauge fills to an eighth of a cell over its blank track.
  expect((await above.find({ type: "Text", text: " Opus 5.5   CONTEXTO" }))?.text).toBe(
    " Opus 5.5   CONTEXTO ████▊      48 %  5 HORAS █▉     31 % ↻ 2 h 10  SEMANA ▊      12 %  CACHÉ 1 h 00  GASTO $1,84",
  );
  expect(await above.find({ text: "48 %" })).toBeDefined();
  expect(await above.find({ text: " ↻ 2 h 10" })).toBeDefined();
  expect(await above.find({ text: "SEMANA " })).toBeDefined();
  expect(await above.find({ text: "$1,84" })).toBeDefined();
  expect(await above.find({ text: "1 h 00" })).toBeDefined();
  expect(JSON.parse(w.writes["/home/me/.cache/poneglyph/usage.json"] ?? "null")).toEqual({
    sessionUsage: 31,
    sessionResetAt: limits[0]?.resetsAt,
    weeklyUsage: 12,
    weeklyResetAt: limits[1]?.resetsAt,
  });
  // A reading that moved nothing still refreshes the file's date.
  delete w.writes["/home/me/.cache/poneglyph/usage.json"];
  await $.session.measure({ context: { window: 200_000, percent: 49 }, rateLimits: limits, changed: ["context"] });
  expect(w.writes["/home/me/.cache/poneglyph/usage.json"]).toBeDefined();
  // A subagent finishing does not restart the main conversation's cache countdown, and the
  // minute that passes reaches the bar through the tick, without a manual redraw.
  await w.clock.advance(2 * MIN);
  await $.turn.complete({ ...answer, agentId: "a1" });
  await w.clock.settle();
  expect(await above.find({ text: "58 min" })).toBeDefined();
  // Nothing to propose with a fresh cache.
  expect(await above.find({ text: "Compactar ahora" })).toBeUndefined();
});

// The desktop app starts the session as -p does (no surface, not interactive) and joins it
// afterwards: the bar comes up then, and the terminal's pasted-image polling does not.
test("the desktop gets the bar once it joins, without polling a terminal draft", async ($, on) => {
  const w = world(on, { draft: "[Image #1]" });
  await $.session.start({ cwd: "/work/project", surface: null, isInteractive: false });
  const before = await $.ui.mount({ ...band, surface: "desktop" });
  expect(await before.find({ text: " Opus 5.5 " })).toBeUndefined();
  await $.session.attach({ surface: "desktop", clientId: "desktop:default" });
  await $.session.measure({ context: { window: 200_000, percent: 26 }, rateLimits: limits, changed: ["rateLimits", "context"] });
  await $.turn.complete(answer);
  await w.clock.advance(1000);
  const above = await $.ui.mount({ ...band, surface: "desktop" });
  expect(await above.find({ text: " Opus 5.5 " })).toBeDefined();
  expect(await above.find({ text: "26 %" })).toBeDefined();
  expect(w.runs.some((r) => r[0] === "sips")).toBe(false);
});

test("the footer is left alone, a narrow band gets the short bar, and a survey hides it", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await $.session.measure({ context: { window: 200_000, percent: 26 }, rateLimits: limits, changed: ["rateLimits", "context"] });
  await $.turn.complete(answer);
  await w.clock.settle();
  const footer = await $.ui.mount({
    plugin: "hud",
    surface: "terminal",
    component: "PromptHint",
    props: { isDraft: false, isWorking: false, hint: "? for shortcuts" },
    viewport: { columns: 160, rows: 40, isFullscreen: false },
  });
  expect(await footer.find({ text: "? for shortcuts" })).toBeDefined();
  expect(await footer.find({ text: " Opus 5.5 " })).toBeUndefined();
  const narrow = await $.ui.mount({ ...band, props: { ...band.props, bodyColumns: 55 } });
  expect(await narrow.find({ text: "ctx " })).toBeDefined();
  expect(await narrow.find({ text: "CONTEXTO " })).toBeUndefined();
  const survey = await $.ui.mount({ ...band, props: { ...band.props, hasSurvey: true } });
  expect(await survey.find({ text: "Existing band" })).toBeDefined();
  expect(await survey.find({ text: "ctx " })).toBeUndefined();
  expect(await survey.find({ text: "CONTEXTO " })).toBeUndefined();
});

test("near a cold cache over a half-full window it proposes, and the person decides", async ($, on) => {
  // A six-minute cache keeps the 200 ms draft poll inside what the mock clock advances.
  const w = world(on, { context: 55, env: { HUD_CACHE_TTL_MIN: "6" } });
  await $.session.start(start);
  await $.session.measure({ context: { window: 200_000, percent: 55 }, rateLimits: limits, changed: ["rateLimits", "context"] });
  await $.turn.complete(answer);
  await w.clock.advance(2 * MIN);
  const above = await $.ui.mount(band);
  expect(await above.find({ text: "Existing band" })).toBeDefined();
  expect(await above.find({ type: "Button", text: "Compactar ahora" })).toBeDefined();
  await above.press({ key: "hud-dismiss" });
  await above.redraw();
  expect(await above.find({ text: "Compactar ahora" })).toBeUndefined();
  // A new answer opens a new cache window, and with it a new proposal.
  await $.turn.complete(answer);
  await w.clock.advance(2 * MIN);
  await above.redraw();
  await above.press({ key: "hud-compact" });
  await w.clock.settle();
  expect(w.compactions()).toBe(1);
  // The summary starts a fresh cache, so the proposal leaves.
  await above.redraw();
  expect(await above.find({ text: "Compactar ahora" })).toBeUndefined();
});

test("pasted images show as thumbnails above the prompt and leave once sent", async ($, on) => {
  const w = world(on, { draft: "mira [Image #1]" });
  await $.session.start(start);
  await w.clock.advance(250);
  await w.clock.settle();
  const above = await $.ui.mount(band);
  expect(await above.find({ type: "Raster" })).toBeDefined();
  // A short band keeps the same tree: the bar comes first, so the engine scrolls the
  // thumbnails out of view before the bar.
  const short = await $.ui.mount({ ...band, props: { ...band.props, maxRows: 2, scroll: { offset: 0, bodyRows: 1 } } });
  expect(await short.find({ text: " Opus 5.5 " })).toBeDefined();
  expect(await short.find({ type: "Raster" })).toBeDefined();
  expect((await above.find({ type: "Text", text: "#1 · 200×100" }))?.text).toBe("#1 · 200×100");
  // Twice the cells each way: a 2:1 image fills 48×12 cells of 2×2 pixels.
  const sips = w.runs.find((r) => r.includes("-z"));
  expect(sips?.slice(0, 4)).toEqual(["sips", "-z", "24", "96"]);
  w.type("");
  await w.clock.advance(250);
  await w.clock.settle();
  await above.redraw();
  expect(await above.find({ type: "Raster" })).toBeUndefined();
});

test("inside Agentic OS the draft's images go there as bytes and the band keeps one line; refused, thumbnails return", async ($, on) => {
  const posts: { url: string; headers: Record<string, string>; body: { images: { n: number; image: { mime: string; data: string } }[] } }[] = [];
  let ok = true;
  on("http.fetch", (_, e) => {
    posts.push({ url: e.url, headers: (e.init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(e.init?.body ?? "{}")) });
    return { value: { status: ok ? 200 : 400, ok, headers: {}, text: "{}" } };
  });
  const w = world(on, { draft: "mira [Image #1] y [Image #2]", env: { AOS_URL: "http://127.0.0.1:4317/", AOS_AGENT_ID: "t7" } });
  await $.session.start(start);
  await w.clock.advance(250);
  await w.clock.settle();
  expect(posts).toHaveLength(1);
  expect(posts[0]?.url).toBe("http://127.0.0.1:4317/api/terminals/t7/drafts");
  expect(posts[0]?.headers).toMatchObject({ origin: "http://127.0.0.1:4317", "x-aos-agent-id": "t7", "content-type": "application/json" });
  expect(posts[0]?.body.images.map((i) => [i.n, i.image.mime, i.image.data])).toEqual([
    [1, "image/png", bmp()],
    [2, "image/png", bmp()],
  ]);
  // No sips and no block thumbnails: Agentic OS draws the pixels.
  expect(w.runs.some((r) => r.includes("-z"))).toBe(false);
  const above = await $.ui.mount(band);
  expect(await above.find({ type: "Raster" })).toBeUndefined();
  expect(await above.find({ text: "▣ #1 #2 · a resolución completa en Agentic OS" })).toBeDefined();
  // A sent prompt clears the draft there too.
  w.type("");
  await w.clock.advance(250);
  await w.clock.settle();
  expect(posts.at(-1)?.body).toEqual({ images: [] });
  // Refused: the thumbnails come back.
  ok = false;
  w.type("otra [Image #3]");
  await w.clock.advance(250);
  await w.clock.settle();
  await above.redraw();
  expect(await above.find({ type: "Raster" })).toBeDefined();
});

test("an AOS_URL that is not a loopback origin sends nothing", async ($, on) => {
  let calls = 0;
  on("http.fetch", () => {
    calls++;
    return { value: { status: 200, ok: true, headers: {}, text: "{}" } };
  });
  const w = world(on, { draft: "[Image #1]", env: { AOS_URL: "http://evil.example/", AOS_AGENT_ID: "t7" } });
  await $.session.start(start);
  await w.clock.advance(250);
  await w.clock.settle();
  expect(calls).toBe(0);
  expect(await (await $.ui.mount(band)).find({ type: "Raster" })).toBeDefined();
});
