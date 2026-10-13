import { expect, test } from "bun:test";
import {
  addSample,
  bar,
  cacheLeft,
  contextTone,
  fullAt,
  imageNumbers,
  layout,
  left,
  meter,
  modelName,
  shouldPropose,
  usageFile,
  type Limit,
  type Run,
} from "../hooks/core.ts";
import { bmpCells, quadCell, thumbSize } from "../hooks/raster.ts";

const NOW = Date.parse("2026-10-11T10:00:00Z");
const MIN = 60_000;
const limits: Limit[] = [
  { kind: "five_hour", percentUsed: 31, resetsAt: new Date(NOW + 130 * MIN).toISOString() },
  { kind: "seven_day", percentUsed: 12.5, resetsAt: new Date(NOW + 3 * 1440 * MIN).toISOString() },
];

test("model ids read as their family and version", () => {
  expect(modelName("claude-opus-5-5")).toBe("Opus 5.5");
  expect(modelName("claude-haiku-5-5[1m]")).toBe("Haiku 5.5");
  expect(modelName("gpt-x")).toBe("gpt-x");
});

test("time left switches from a clock to hours and days", () => {
  expect(left(41 * MIN, true)).toBe("41:00");
  expect(left(130 * MIN)).toBe("2 h 10");
  expect(left(3 * 1440 * MIN)).toBe("3 d");
  expect(left(-5)).toBe("0 min");
});

test("meter fills to an eighth of a cell and clamps", () => {
  expect(meter(50)).toEqual({ fill: "████", track: "    " });
  expect(meter(37, 10)).toEqual({ fill: "███▊", track: "      " });
  expect(meter(140)).toEqual({ fill: "████████", track: "" });
  expect(meter(0)).toEqual({ fill: "", track: "        " });
});

test("context runs a traffic light; the windows keep their hue until near the limit", () => {
  expect([10, 50, 70, 85].map(contextTone)).toEqual(["success", "warning", "claude", "error"]);
  const hues = (five: number, week: number) =>
    bar({ limits: [{ kind: "five_hour", percentUsed: five }, { kind: "seven_day", percentUsed: week }] }, NOW).map((s) => s.tone);
  expect(hues(31, 12)).toEqual(["ide", "autoAccept"]);
  expect(hues(90, 85)).toEqual(["error", "error"]);
});

const text = (runs: Run[]) => runs.map((r) => r.text).join("");
const busy = { model: "claude-opus-5-5", effort: "high", context: 26, limits, costUsd: 12.456, cacheLeftMs: 54 * MIN };

test("the bar names each figure in reading order, each with its tone", () => {
  const segs = bar({ ...busy, context: 48 }, NOW);
  expect(segs.map((s) => [s.id, s.label, s.value, s.trail])).toEqual([
    ["model", "", "Opus 5.5", "alto"],
    ["context", "CONTEXTO", "48 %", undefined],
    ["five", "5 HORAS", "31 %", "↻ 2 h 10"],
    ["week", "SEMANA", "13 %", undefined],
    ["cache", "CACHÉ", "54 min", undefined],
    ["cost", "GASTO", "$12,46", undefined],
  ]);
  expect(segs[1]).toMatchObject({ gauge: 48, tone: "success" });
  expect(segs[4]).toMatchObject({ tone: "planMode" });
  expect(segs[5]).toMatchObject({ dim: true });
  expect(bar({ ...busy, effort: 2048 }, NOW)[0]?.trail).toBe("2048");
});

test("the layout keeps the widest level that fits: full, mid, compact or minimal", () => {
  const segs = bar(busy, NOW);
  expect(text(layout(segs, 160))).toBe(
    " ◆ Opus 5.5 · alto   CONTEXTO ██▋        26 %  5 HORAS █▉     31 % ↻ 2 h 10  SEMANA ▊      13 %  CACHÉ 54 min  GASTO $12,46",
  );
  // The edges are exact: the full row is 123 cells, mid 96 and compact 89.
  const gauges = (columns: number) => layout(segs, columns).filter((r) => r.style === "gauge").length;
  expect([123, 122, 96, 95].map(gauges)).toEqual([3, 1, 1, 0]);
  expect(text(layout(segs, 100))).toBe(" ◆ Opus 5.5 · alto   CONTEXTO █▌     26 %  5 HORAS 31 %  SEMANA 13 %  CACHÉ 54 min  GASTO $12,46");
  expect(text(layout(segs, 95))).toBe(" ◆ Opus 5.5 · alto   CONTEXTO 26 %  5 HORAS 31 %  SEMANA 13 %  CACHÉ 54 min  GASTO $12,46");
  expect(text(layout(segs, 60))).toBe(" Opus 5.5  ctx 26% · 5h 31% · caché 54 min");
  // The fill warning survives every width: it is the one figure that warns ahead.
  const filling = bar({ ...busy, fullAt: NOW + 60 * MIN }, NOW);
  expect(text(layout(filling, 60))).toContain("5h 31% → lleno ");
  expect(layout(filling, 160).find((r) => r.text.includes("lleno"))?.tone).toBe("warning");
});

test("the layout styles labels, values and the model pill apart", () => {
  const runs = layout(bar({ ...busy, context: 90 }, NOW), 160);
  expect(runs[0]).toEqual({ text: " ◆ Opus 5.5 · alto ", style: "pill" });
  expect(runs.find((r) => r.text === "CONTEXTO ")?.style).toBe("label");
  expect(runs.find((r) => r.text === "90 %")).toEqual({ text: "90 %", tone: "error", style: "value" });
  expect(runs.find((r) => r.style === "gauge")).toEqual({ text: "█████████", tone: "error", style: "gauge" });
  expect(runs.find((r) => r.style === "track")).toEqual({ text: " ", style: "track" });
  expect(runs.find((r) => r.text === "54 min")).toEqual({ text: "54 min", tone: "planMode", style: "value" });
  expect(runs.find((r) => r.text === "$12,46")?.style).toBe("dim");
});

test("before the first answer there is no cost, effort or context to show", () => {
  expect(text(layout(bar({ limits: [], costUsd: 0.003 }, NOW), 160))).toBe("GASTO <$0,01");
  expect(text(layout(bar({ model: "claude-haiku-5-5", limits, costUsd: 0 }, NOW), 160))).toBe(
    " Haiku 5.5   5 HORAS █▉     31 % ↻ 2 h 10  SEMANA ▊      13 %",
  );
  expect(bar({ limits: [], context: 90, cacheLeftMs: 3 * MIN }, NOW).map((s) => [s.value, s.tone])).toEqual([
    ["90 %", "error"],
    ["3:00", "warning"],
  ]);
  expect(layout([], 60)).toEqual([]);
});

test("a cold cache says so in red", () => {
  const seg = bar({ limits: [], cacheLeftMs: 0 }, NOW)[0];
  expect(seg).toMatchObject({ value: "fría", tone: "error" });
  expect(cacheLeft(NOW, NOW - 2 * 3600_000, 3600_000)).toBe(0);
  expect(cacheLeft(NOW, undefined, 3600_000)).toBeUndefined();
});

test("pace projects the fill time only when it beats the reset", () => {
  const five = limits[0];
  const rising = [
    { at: NOW - 30 * MIN, percent: 10 },
    { at: NOW, percent: 31 },
  ];
  const at = fullAt(rising, five, NOW);
  expect(at).toBeDefined();
  expect(Math.round(((at as number) - NOW) / MIN)).toBe(99);
  expect(fullAt([{ at: NOW - 30 * MIN, percent: 30 }, { at: NOW, percent: 31 }], five, NOW)).toBeUndefined();
  expect(fullAt([{ at: NOW - 5 * MIN, percent: 10 }, { at: NOW, percent: 31 }], five, NOW)).toBeUndefined();
});

test("samples restart when the window resets and skip repeats", () => {
  let s = addSample([], { at: NOW, percent: 20 });
  s = addSample(s, { at: NOW + MIN, percent: 20 });
  expect(s).toHaveLength(1);
  s = addSample(s, { at: NOW + 2 * MIN, percent: 3 });
  expect(s).toEqual([{ at: NOW + 2 * MIN, percent: 3 }]);
});

test("a compaction is proposed near a cold cache over a half-full window, or near a full one", () => {
  expect(shouldPropose(4 * MIN, 55)).toBe(true);
  expect(shouldPropose(4 * MIN, 30)).toBe(false);
  expect(shouldPropose(20 * MIN, 82)).toBe(true);
  expect(shouldPropose(0, 60)).toBe(false);
  expect(shouldPropose(4 * MIN, undefined)).toBe(false);
});

test("the usage file keeps ccstatusline's shape", () => {
  expect(usageFile(limits)).toEqual({
    sessionUsage: 31,
    sessionResetAt: limits[0]?.resetsAt,
    weeklyUsage: 12.5,
    weeklyResetAt: limits[1]?.resetsAt,
  });
  expect(usageFile([])).toBeUndefined();
});

test("image numbers come out in order, once each", () => {
  expect(imageNumbers("mira [Image #2] y [Image #1] otra vez [Image #2]")).toEqual([2, 1]);
  expect(imageNumbers("nada")).toEqual([]);
});

test("thumbnails keep the aspect ratio inside the box", () => {
  expect(thumbSize(1734, 1040, 24, 8)).toEqual({ columns: 24, rows: 7 });
  expect(thumbSize(400, 1600, 24, 8)).toEqual({ columns: 4, rows: 8 });
});

// A 2×3 top-down 32-bit BI_BITFIELDS BMP, the shape sips writes, built by hand.
function bmp(pixels: number[][], { topDown = true, alpha = true } = {}) {
  const w = pixels[0]?.length ?? 0;
  const h = pixels.length;
  const offset = 14 + 56;
  const buf = new DataView(new ArrayBuffer(offset + w * h * 4));
  buf.setUint16(0, 0x424d);
  buf.setUint32(10, offset, true);
  buf.setUint32(14, 56, true);
  buf.setInt32(18, w, true);
  buf.setInt32(22, topDown ? -h : h, true);
  buf.setUint16(28, 32, true);
  buf.setUint32(30, 3, true);
  buf.setUint32(54, 0xff0000, true);
  buf.setUint32(58, 0xff00, true);
  buf.setUint32(62, 0xff, true);
  buf.setUint32(66, alpha ? 0xff000000 : 0, true);
  pixels.forEach((row, y) =>
    row.forEach((p, x) => buf.setUint32(offset + ((topDown ? y : h - 1 - y) * w + x) * 4, p >>> 0, true)),
  );
  return new Uint8Array(buf.buffer);
}

const decode = (cells: string) => [...new Uint32Array(Uint8Array.fromBase64(cells).buffer)];

test("a cell splits its four pixels into the two groups that lose least color", () => {
  const [red, blue, white, clear] = [0xff0000, 0x0000ff, 0xffffff, 0x01000000];
  expect(quadCell([red, red, red, red])).toEqual([0x2588, red, red]);
  // Top left over the rest: ▘ in red over blue.
  expect(quadCell([red, blue, blue, blue])).toEqual([0x2598, red, blue]);
  // A diagonal: the bottom-right pixel is always background, so ▞ in blue over red.
  expect(quadCell([red, blue, blue, red])).toEqual([0x259e, blue, red]);
  // Three colors: the two closest share a group, averaged.
  expect(quadCell([white, white, red, 0xfe0000])).toEqual([0x2580, white, 0xff0000]);
  // Transparent pixels stay unlit over the terminal's background.
  expect(quadCell([red, clear, clear, red])).toEqual([0x259a, red, clear]);
  expect(quadCell([clear, clear, clear, clear])).toEqual([0x20, clear, clear]);
});

test("a BMP becomes one quadrant cell per 2×2 pixels, in either row order", () => {
  const red = 0xffff0000;
  const blue = 0xff0000ff;
  const clear = 0x000000ff;
  const pixels = [
    [red, blue, red],
    [blue, blue, clear],
    [red, red, red],
  ];
  const out = bmpCells(bmp(pixels));
  expect(out).toMatchObject({ columns: 2, rows: 2 });
  expect(decode(out.cells)).toEqual([
    0x2598, 0xff0000, 0x0000ff,
    0x2598, 0xff0000, 0x01000000,
    0x2580, 0xff0000, 0x01000000,
    0x2598, 0xff0000, 0x01000000,
  ]);
  expect(bmpCells(bmp(pixels, { topDown: false })).cells).toBe(out.cells);
});

test("anything but an uncompressed BMP is refused", () => {
  expect(() => bmpCells(new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new Array(60).fill(0)]))).toThrow("not a BMP");
});
