import { test, expect } from "bun:test";
import { scale, bar } from "./charts.ts";

test("T5.1 — scale maps domain→range", () => {
  const s = scale([0, 10], [0, 200]);
  expect(s(0)).toBe(0);
  expect(s(10)).toBe(200);
  expect(s(5)).toBe(100);
});

test("T5.2 — bar: N rects, width proportional to value", () => {
  const svg = bar([{ label: "a", value: 2 }, { label: "b", value: 8 }]);
  const bars = svg.match(/class="bar"[^>]*width="([\d.]+)"/g) || [];
  expect(bars.length).toBe(2);
  const widths = [...svg.matchAll(/class="bar"[^>]*width="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
  // value 8 width ≈ 4× value 2 width
  expect(widths[1] / widths[0]).toBeCloseTo(4, 1);
  expect(svg.includes('role="img"')).toBe(true);
});

test("T5.3 — edge: empty and single-point", () => {
  expect(() => bar([])).not.toThrow();
  const empty = bar([]);
  expect((empty.match(/class="bar"/g) || []).length).toBe(0);
  const one = bar([{ label: "x", value: 5 }]);
  expect((one.match(/class="bar"/g) || []).length).toBe(1);
});

test("T5.4 — property: scale is monotonic ascending", () => {
  for (let i = 0; i < 50; i++) {
    const d1 = Math.random() * 100;
    const d0 = d1 - Math.random() * 50 - 0.01;
    const s = scale([d0, d1 + 1], [0, 100]);
    const a = d0 + Math.random() * (d1 - d0);
    const b = a + Math.random() * 10 + 0.01;
    expect(s(a)).toBeLessThanOrEqual(s(b));
  }
});
