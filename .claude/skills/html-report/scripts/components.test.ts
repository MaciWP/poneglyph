import { test, expect } from "bun:test";
import { tableFilterable } from "./components.ts";
import type { Table } from "./contract.ts";

const t: Table = {
  filterable: true,
  columns: [
    { key: "name", label: "Name" },
    { key: "n", label: "N", numeric: true },
  ],
  rows: [
    { cells: { name: "Alpha", n: "1" } },
    { cells: { name: "Beta", n: "2" } },
  ],
};

test("US4 — filterable table has search input + per-row data-text", () => {
  const html = tableFilterable(t, "t1");
  expect(html.includes('class="tbl-search"')).toBe(true);
  expect(html.includes('data-for="t1"')).toBe(true);
  expect((html.match(/data-text=/g) || []).length).toBe(2);
});

test("US4 — fallback: all rows present in static markup", () => {
  const html = tableFilterable(t, "t1");
  expect(html.includes("Alpha")).toBe(true);
  expect(html.includes("Beta")).toBe(true);
  // data-text is lowercased for filtering
  expect(html.includes('data-text="alpha 1"')).toBe(true);
});

test("US4 — non-filterable table omits the search box", () => {
  const html = tableFilterable({ ...t, filterable: false }, "t2");
  expect(html.includes('class="tbl-search"')).toBe(false);
  expect(html.includes("Alpha")).toBe(true);
});
