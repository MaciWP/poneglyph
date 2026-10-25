import type { RenderElement } from "claude-code";
import type { Compare } from "../schema.ts";
import { frame, T, type Ui } from "../theme.ts";
import { table } from "./table.ts";

export type Tabs = { active: number; onTab: (i: number) => void; hotkeys: boolean };

// The options side by side, one topic at a time: a tab per topic switches the table, the
// active one a filled pill, the rest plain words.
export function compare(ui: Ui, v: Compare, width: number, tabs: Tabs): RenderElement {
  const active = Math.min(tabs.active, v.topics.length - 1);
  const topic = v.topics[active] ?? v.topics[0];
  return frame(ui, "◆ COMPARAR", v.title, [
    v.topics.length > 1
      ? ui.Box({
          columnGap: 1,
          flexWrap: "wrap",
          children: v.topics.map((t, i) =>
            ui.Button({
              key: `vista-tab-${i}`,
              label: t.name,
              plain: true,
              hotkey: tabs.hotkeys ? String(i + 1) : undefined,
              onPress: () => tabs.onTab(i),
              children:
                i === active
                  ? ui.Text({ backgroundColor: T.accent, color: T.onAccent, weight: "semibold", children: ` ${t.name} ` })
                  : ui.Text({ color: T.label, children: ` ${t.name} ` }),
            }),
          ),
        })
      : ui.Text({ color: T.label, weight: "semibold", children: topic?.name ?? "" }),
    table(ui, v.options, topic?.rows ?? [], width - 4),
    v.verdict ? ui.Box({ columnGap: 1, children: [ui.Text({ color: T.accent, weight: "semibold", children: "→" }), ui.Text({ wrap: "wrap", children: v.verdict })] }) : null,
  ]);
}
