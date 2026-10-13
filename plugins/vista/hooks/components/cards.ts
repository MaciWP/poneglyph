import type { RenderElement } from "claude-code";
import type { Cards } from "../schema.ts";
import { frame, T, type Ui } from "../theme.ts";

export type Thumb = { columns: number; rows: number; cells: string };
// One entry per card: the thumbnail when ready, null when it failed, undefined while it loads.
export type Thumbs = (Thumb | null | undefined)[];

const fileName = (path: string) => path.split("/").at(-1) ?? path;

// A ranking, best first: the rank in a pill (the first in the accent), name and badge, the
// metric in the accent, the detail wrapped, and the thumbnail on the left when the card names
// a local image.
export function cards(ui: Ui, v: Cards, thumbs: Thumbs): RenderElement {
  return frame(
    ui,
    "★ RANKING",
    v.title,
    v.items.map((c, i) => {
      const thumb = thumbs[i];
      const picture =
        c.image === undefined
          ? null
          : thumb && ui.Raster
            ? ui.Raster({ key: `vista-card-${i}`, ...thumb })
            : ui.Text({ color: T.label, children: thumb === undefined ? "…" : `▢ ${fileName(c.image)}` });
      return ui.Box({
        columnGap: 2,
        children: [
          picture ? ui.Box({ flexShrink: 0, children: picture }) : null,
          ui.Box({
            flexDirection: "column",
            flexGrow: 1,
            flexShrink: 1,
            children: [
              ui.Box({
                columnGap: 1,
                children: [
                  ui.Box({
                    flexShrink: 0,
                    children: ui.Text({ backgroundColor: i === 0 ? T.accent : T.rule, color: i === 0 ? T.onAccent : undefined, bold: true, children: ` ${i + 1} ` }),
                  }),
                  ui.Box({ flexShrink: 1, children: ui.Text({ bold: true, wrap: "truncate-end", children: c.name }) }),
                  c.badge ? ui.Box({ flexShrink: 0, children: ui.Text({ backgroundColor: T.label, color: T.onAccent, children: ` ${c.badge} ` }) }) : null,
                ],
              }),
              c.metric ? ui.Text({ color: T.accent, bold: true, children: `  ${c.metric}` }) : null,
              c.detail ? ui.Box({ paddingLeft: 2, children: ui.Text({ wrap: "wrap", children: c.detail }) }) : null,
            ],
          }),
        ],
      });
    }),
  );
}
