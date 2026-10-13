// Image thumbnails as Raster cells. vista keeps a byte copy (a plugin installs alone, so it
// cannot import this one); its drift test fails when the two differ.

// A thumbnail's size in cells, from the image's size in pixels. A terminal cell is about twice
// as tall as wide, so one cell holds a square of one pixel across and two down; scale the image
// to twice the cells each way (bmpCells draws 2×2 pixels a cell).
export function thumbSize(w: number, h: number, maxColumns: number, maxRows: number) {
  const scale = Math.min(maxColumns / w, (maxRows * 2) / h);
  const columns = Math.max(1, Math.round(w * scale));
  const rows = Math.max(1, Math.round((h * scale) / 2));
  return { columns, rows };
}

const DEFAULT_COLOR = 0x01000000;
const SPACE = 0x20;
// The block for each set of lit quadrants: bit 1 top left, 2 top right, 4 bottom left, 8 bottom right.
const QUADRANT = [SPACE, 0x2598, 0x259d, 0x2580, 0x2596, 0x258c, 0x259e, 0x259b, 0x2597, 0x259a, 0x2590, 0x259c, 0x2584, 0x2599, 0x259f, 0x2588];

type Channel = { shift: number; max: number };
const maskShift = (mask: number): Channel => {
  let shift = 0;
  while (mask && !(mask & 1)) {
    mask >>>= 1;
    shift++;
  }
  return { shift, max: mask };
};

const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mean = (colors: number[]) => {
  const sum = [0, 0, 0];
  for (const c of colors) channels(c).forEach((v, i) => (sum[i] = (sum[i] ?? 0) + v));
  const [r, g, b] = sum.map((v) => Math.round(v / colors.length)) as [number, number, number];
  return (r << 16) | (g << 8) | b;
};
const distance = (a: number, b: number) => {
  const [x, y] = [channels(a), channels(b)];
  return x.reduce((n, v, i) => n + (v - (y[i] ?? 0)) ** 2, 0);
};

// One cell from its four pixels (top left, top right, bottom left, bottom right): of the ways to
// split them in two groups, the one whose two average colors lose least, drawn as the quadrant
// block of the first group over the second, as chafa does. Transparent pixels stay unlit over
// the terminal's default background.
export function quadCell(px: number[]): [number, number, number] {
  const solid = px.map((p) => p !== DEFAULT_COLOR);
  if (!solid.includes(true)) return [SPACE, DEFAULT_COLOR, DEFAULT_COLOR];
  if (solid.includes(false)) {
    const lit = px.filter((_, i) => solid[i]);
    return [QUADRANT[solid.reduce((m, on, i) => m | (on ? 1 << i : 0), 0)] ?? SPACE, mean(lit), DEFAULT_COLOR];
  }
  let best: [number, number, number] = [QUADRANT[15] ?? SPACE, mean(px), mean(px)];
  let error = px.reduce((n, p) => n + distance(p, best[1]), 0);
  // Masks 1-7 leave the bottom-right pixel unlit; each other split is one of these, inverted.
  for (let mask = 1; mask < 8; mask++) {
    const on = px.filter((_, i) => mask & (1 << i));
    const off = px.filter((_, i) => !(mask & (1 << i)));
    const [fg, bg] = [mean(on), mean(off)];
    const e = on.reduce((n, p) => n + distance(p, fg), 0) + off.reduce((n, p) => n + distance(p, bg), 0);
    if (e < error) [error, best] = [e, [QUADRANT[mask] ?? SPACE, fg, bg]];
  }
  return best;
}

// Cells for a Raster from an uncompressed BMP (24 or 32 bits, top-down or bottom-up, BI_RGB
// or BI_BITFIELDS, as macOS sips writes): one quadCell per 2×2 pixels.
export function bmpCells(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint16(0) !== 0x424d) throw new Error("not a BMP");
  const offset = v.getUint32(10, true);
  const header = v.getUint32(14, true);
  const width = v.getInt32(18, true);
  const rawHeight = v.getInt32(22, true);
  const bpp = v.getUint16(28, true);
  const compression = v.getUint32(30, true);
  if ((bpp !== 24 && bpp !== 32) || (compression !== 0 && compression !== 3)) throw new Error("unsupported BMP");
  const height = Math.abs(rawHeight);
  const bitfields = compression === 3 && header >= 52;
  const [rm, gm, bm, am] = bitfields
    ? [v.getUint32(54, true), v.getUint32(58, true), v.getUint32(62, true), header >= 56 ? v.getUint32(66, true) : 0]
    : [0xff0000, 0xff00, 0xff, bpp === 32 ? 0xff000000 : 0];
  const [r, g, b, a] = [rm, gm, bm, am].map(maskShift) as [Channel, Channel, Channel, Channel];
  const stride = Math.ceil((width * bpp) / 32) * 4;
  const pixel = (x: number, y: number) => {
    if (x >= width || y >= height) return DEFAULT_COLOR;
    const row = rawHeight < 0 ? y : height - 1 - y;
    const at = offset + row * stride + (x * bpp) / 8;
    const p = bpp === 32 ? v.getUint32(at, true) : v.getUint8(at) | (v.getUint8(at + 1) << 8) | (v.getUint8(at + 2) << 16);
    const channel = (c: Channel, mask: number) => Math.round((((p & mask) >>> c.shift) / c.max) * 255);
    if (am && channel(a, am) < 128) return DEFAULT_COLOR;
    return (channel(r, rm) << 16) | (channel(g, gm) << 8) | channel(b, bm);
  };
  const columns = Math.ceil(width / 2);
  const rows = Math.ceil(height / 2);
  const numbers = new Uint32Array(columns * rows * 3);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++)
      numbers.set(quadCell([pixel(2 * x, 2 * y), pixel(2 * x + 1, 2 * y), pixel(2 * x, 2 * y + 1), pixel(2 * x + 1, 2 * y + 1)]), (y * columns + x) * 3);
  return { columns, rows, cells: new Uint8Array(numbers.buffer).toBase64() };
}
