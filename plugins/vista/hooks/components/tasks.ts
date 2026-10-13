import type { RenderElement } from "claude-code";
import type { Task } from "../markdown.ts";
import { gauge, T, type Ui } from "../theme.ts";

// A checklist under its progress bar and count: done items ticked in green, dimmed and struck
// through, pending ones open.
export function tasks(ui: Ui, items: Task[]): RenderElement {
  const done = items.filter((t) => t.done).length;
  return ui.Box({
    flexDirection: "column",
    children: [
      ui.Box({
        columnGap: 1,
        children: [gauge(ui, done / items.length, 16, T.ok), ui.Text({ color: T.label, children: `${done} de ${items.length} hechas` })],
      }),
      ...items.map((t) =>
        ui.Box({
          columnGap: 1,
          children: [
            ui.Box({ flexShrink: 0, children: ui.Text({ color: t.done ? T.ok : T.label, bold: t.done, children: t.done ? "✓" : "○" }) }),
            ui.Text({ wrap: "wrap", dimColor: t.done, strikethrough: t.done, children: t.text }),
          ],
        }),
      ),
    ],
  });
}
