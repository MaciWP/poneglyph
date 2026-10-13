import type { RenderElement, UiPressArgument } from "claude-code";
import type { Draft } from "../schema.ts";
import { frame, T, type Ui } from "../theme.ts";

export type Copy = { copied: boolean; onCopy: (surface: UiPressArgument["surface"]) => void; hotkeys: boolean };

// The text exactly as it will be copied, with one Copiar under it.
export function draft(ui: Ui, v: Draft, copy: Copy): RenderElement {
  return frame(ui, `✉ ${(v.label ?? "BORRADOR").toUpperCase()}`, v.title, [
    ui.Box({
      flexDirection: "column",
      borderStyle: "single",
      borderColor: T.label,
      paddingX: 1,
      rowGap: 1,
      children: [v.subject ? ui.Text({ bold: true, wrap: "wrap", children: v.subject }) : null, ui.Text({ wrap: "wrap", children: v.body })],
    }),
    ui.Box({
      columnGap: 1,
      children: [
        ui.Button({ key: "vista-copy", label: "Copiar", hotkey: copy.hotkeys ? "c" : undefined, onPress: (p) => copy.onCopy(p.surface) }),
        copy.copied ? ui.Text({ color: T.ok, children: "✓ Copiado" }) : null,
      ],
    }),
  ]);
}
