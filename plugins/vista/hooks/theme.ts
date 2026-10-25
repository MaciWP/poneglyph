import type { BoxProps, ButtonProps, ElementConstructor, MarkdownProps, RasterProps, RenderChildren, RenderElement, TextProps } from "claude-code";

// Theme keys only, so every colour follows the person's light or dark theme.
export const T = {
  accent: "suggestion",
  onAccent: "inverseText",
  label: "inactive",
  ok: "success",
  warn: "warning",
  bad: "error",
  rule: "subtle",
} as const;

// A progress bar to an eighth of a cell: the fill in `color` over a `rule` track (as hud's gauges).
const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];
export function gauge(ui: Ui, ratio: number, width: number, color: string): RenderElement {
  const eighths = Math.round(Math.max(0, Math.min(1, ratio)) * width * 8);
  const fill = "█".repeat(Math.floor(eighths / 8)) + EIGHTHS[eighths % 8];
  return ui.Text({
    children: [
      ui.Text({ color, backgroundColor: T.rule, children: fill }),
      ui.Text({ backgroundColor: T.rule, children: " ".repeat(width - fill.length) }),
    ],
  });
}

export type Ui = {
  Box: ElementConstructor<BoxProps>;
  Text: ElementConstructor<TextProps>;
  Button: ElementConstructor<ButtonProps>;
  Raster?: ElementConstructor<RasterProps>;
  Markdown?: ElementConstructor<MarkdownProps>;
};

// Each component's frame: a rounded border in the accent, a pill naming the kind and the title.
export function frame(ui: Ui, kind: string, title: string, body: RenderChildren[]): RenderElement {
  return ui.Box({
    flexDirection: "column",
    borderStyle: "round",
    borderColor: T.accent,
    paddingX: 1,
    rowGap: 1,
    children: [
      ui.Box({
        columnGap: 1,
        children: [
          ui.Box({ flexShrink: 0, children: ui.Text({ backgroundColor: T.accent, color: T.onAccent, weight: "semibold", children: ` ${kind} ` }) }),
          ui.Box({ flexShrink: 1, children: ui.Text({ weight: "semibold", wrap: "truncate-end", children: title }) }),
        ],
      }),
      ...body,
    ],
  });
}
