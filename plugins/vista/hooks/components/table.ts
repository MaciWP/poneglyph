import type { RenderElement } from "claude-code";
import { LINK } from "../markdown.ts";
import { T, type Ui } from "../theme.ts";

export type TableRow = { label: string; values: string[]; best?: number };

const GAP = 3;
const MIN_CELL = 12;

// The lines a word-wrapped text takes at `width` (a word longer than the width breaks).
export function lines(text: string, width: number): number {
  let n = 1;
  let col = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!col) col = word.length;
    else if (col + 1 + word.length <= width) col += 1 + word.length;
    else {
      n++;
      col = word.length;
    }
    for (; col > width; col -= width) n++;
  }
  return n;
}

// Never wider than this: a reading line past 100 columns is hard to follow.
const MAX_WIDTH = 100;

// Cells that fit on one line make a grid that fits `width`: the label column takes what its
// longest label needs (at most a third), the value columns share the rest and a rule sits under
// the header. A cell that wraps, or columns too narrow to hold words, make a list instead: one
// entry per row behind an accent bar, the label in bold and each value under it with its column
// name at a fixed width, so every value starts at the same column.
// A cell with a link (value, label or column name) is drawn with the engine's Markdown, so the link
// opens on a click. It is measured in its raw markdown, never shorter than what Markdown draws even
// where the terminal shows each link's text then its URL.
export function table(ui: Ui, head: string[], rows: TableRow[], full: number, corner = ""): RenderElement {
  const width = Math.min(full, MAX_WIDTH);
  const longest = Math.max(corner.length, ...rows.map((r) => r.label.length));
  const labelWidth = Math.max(6, Math.min(longest, Math.floor(width / 3)));
  const cellWidth = Math.max(4, Math.floor((width - labelWidth - GAP * head.length) / Math.max(1, head.length)));
  const shown = (r: TableRow, i: number) => (i === r.best ? `✓ ${r.values[i]}` : (r.values[i] ?? ""));
  const height = (r: TableRow) => Math.max(lines(r.label, labelWidth), ...r.values.map((_, i) => lines(shown(r, i), cellWidth)));
  const linked = (s: string) => (ui.Markdown && LINK.test(s) ? ui.Markdown({ text: s }) : null);
  // A heading that truncates keeps one row with a link too: Markdown wraps, so a box clips it.
  const oneRow = (s: string) => {
    const link = linked(s);
    return link && ui.Box({ height: 1, overflow: "hidden", children: link });
  };
  // What the list's accent bar counts: a link's text only, as a terminal with hyperlinks draws it.
  const seen = (s: string) =>
    ui.Markdown && LINK.test(s) ? s.replace(/\[([^\]]*)\]\([^)\s]+\)/g, "$1").replace(/<(https?:\/\/[^>\s]+)>/g, "$1") : s;
  const cell = (r: TableRow, i: number) => {
    const link = linked(r.values[i] ?? "");
    // The best cell keeps its green check in front of the link.
    if (link && i === r.best) return ui.Box({ children: [ui.Text({ weight: "semibold", color: T.ok, children: "✓ " }), ui.Box({ flexShrink: 1, children: link })] });
    if (link) return link;
    return i === r.best
      ? ui.Text({ weight: "semibold", color: T.ok, wrap: "wrap", children: shown(r, i) })
      : ui.Text({ wrap: "wrap", children: shown(r, i) });
  };
  const label = (r: TableRow) => linked(r.label) ?? ui.Text({ weight: "semibold", wrap: "wrap", children: r.label });
  const heading = (h: string, wrap: "wrap" | "truncate-end") =>
    (wrap === "wrap" ? linked(h) : oneRow(h)) ?? ui.Text({ weight: "semibold", color: T.accent, wrap, children: h });
  const rule = (n: number) => ui.Text({ color: T.rule, children: "─".repeat(Math.max(1, Math.min(width, n))) });

  if (cellWidth < MIN_CELL || rows.some((r) => height(r) > 1)) {
    const body = width - 2;
    // One value needs no name: the row's label says what it is.
    const keyWidth = head.length > 1 ? Math.min(Math.max(...head.map((h) => h.length)) + 2, Math.floor(body / 3)) : 0;
    const valueWidth = body - keyWidth;
    return ui.Box({
      flexDirection: "column",
      rowGap: 1,
      width,
      children: [
        corner ? heading(corner, "wrap") : null,
        ...rows.map((r) => {
          const tall = lines(seen(r.label), body) + r.values.reduce((n, _, i) => n + lines(seen(shown(r, i)), valueWidth), 0);
          return ui.Box({
            columnGap: 1,
            children: [
              ui.Box({ width: 1, flexShrink: 0, children: ui.Text({ color: T.accent, children: Array(tall).fill("▌").join("\n") }) }),
              ui.Box({
                flexDirection: "column",
                width: body,
                children: [
                  label(r),
                  ...r.values.map((_, i) =>
                    ui.Box({
                      children: [
                        keyWidth ? ui.Box({ width: keyWidth, flexShrink: 0, children: oneRow(head[i] ?? "") ?? ui.Text({ color: T.label, wrap: "truncate-end", children: head[i] }) }) : null,
                        ui.Box({ width: valueWidth, children: cell(r, i) }),
                      ],
                    }),
                  ),
                ],
              }),
            ],
          });
        }),
      ],
    });
  }
  const line = (first: RenderElement, cells: RenderElement[]) =>
    ui.Box({
      columnGap: GAP,
      children: [ui.Box({ width: labelWidth, flexShrink: 0, children: first }), ...cells.map((c) => ui.Box({ width: cellWidth, flexShrink: 0, children: c }))],
    });
  return ui.Box({
    flexDirection: "column",
    children: [
      line(
        heading(corner, "truncate-end"),
        head.map((h) => heading(h, "truncate-end")),
      ),
      rule(labelWidth + (cellWidth + GAP) * head.length),
      ...rows.map((r) => line(label(r), r.values.map((_, i) => cell(r, i)))),
    ],
  });
}
