import type { RenderElement } from "claude-code";
import type { CalloutKind } from "../markdown.ts";
import { T, type Ui } from "../theme.ts";

const LOOK: Record<CalloutKind, { title: string; color: string }> = {
  note: { title: "◆ Nota", color: T.accent },
  tip: { title: "✓ Consejo", color: T.ok },
  important: { title: "◆ Importante", color: "claude" },
  warning: { title: "△ Atención", color: T.warn },
  caution: { title: "✗ Cuidado", color: T.bad },
};

// A `> [!WARNING]` block as a framed note in its tone, its body still drawn as markdown.
export function callout(ui: Ui, type: CalloutKind, text: string): RenderElement {
  const look = LOOK[type];
  return ui.Box({
    flexDirection: "column",
    borderStyle: "round",
    borderColor: look.color,
    paddingX: 1,
    children: [
      ui.Text({ bold: true, color: look.color, children: look.title }),
      ui.Markdown ? ui.Markdown({ text }) : ui.Text({ wrap: "wrap", children: text }),
    ],
  });
}
