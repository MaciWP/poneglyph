import type {
  BoxProps,
  ButtonProps,
  CodeProps,
  ElementConstructor,
  InputProps,
  RenderChildren,
  RenderElement,
  TextProps,
} from "claude-code";

// Presentation only: register.ts prepares plain data and handlers, this file draws them.
export type Ui = {
  Box: ElementConstructor<BoxProps>;
  Text: ElementConstructor<TextProps>;
  Button: ElementConstructor<ButtonProps>;
  Input: ElementConstructor<InputProps>;
  Code: ElementConstructor<CodeProps>;
};

// One colour per section, so a glance tells which card needs attention.
export const C = {
  robin: "#22d3ee",
  decision: "#fbbf24",
  block: "#f87171",
  plan: "#4ade80",
  quality: "#60a5fa",
  agents: "#c084fc",
  fail: "#f87171",
  faint: "#4b5563",
} as const;

export type Tone = "ok" | "warn" | "fail" | "info" | "muted";
const tone: Record<Tone, string | undefined> = {
  ok: C.plan,
  warn: C.decision,
  fail: C.fail,
  info: C.quality,
  muted: undefined,
};

export type PaneDecision = {
  key: string;
  question: string;
  blocking: boolean;
  status: string;
  error?: string;
  context?: string;
  options: { label: string; detail?: string }[];
  recommended?: number;
  // Read from the chat's "Espera tu decisión" block instead of published by the tool.
  chat: boolean;
  open: boolean;
  draft: string;
  onAnswer: (value: string) => void;
  onDraft: (value: string) => void;
};
export type PaneTask = { title: string; state: string; label: string };
// A feature (a task without parent) with its subtasks; `total` 0 when it has none.
export type PaneFeature = PaneTask & { done: number; total: number; subtasks: PaneTask[] };
export type PaneQuality = { label: string; value: string; tone: Tone; ratio?: number | null };
export type PaneAgents = {
  mode: "solo" | "lead" | "pair" | "group";
  label: string;
  charge: (PaneTask & {
    kind?: string;
    depth: number;
    // How it ran ("haiku 5.5 · medium · 12K tok · 40 s"), its latest internal message and
    // whether it waits for main's reply.
    detail?: string;
    last?: string;
    waiting?: boolean;
  })[];
  peers: { name: string; counts: string; ago: string; tone: Tone }[];
  events: { icon: string; text: string; trail: string; fresh: boolean; tone: Tone }[];
};
export type PaneModel = {
  title: string;
  working: boolean;
  cols: number;
  robin: { text: string; at: number | null; detail: string | null; notice: string | null };
  failure: string | null;
  error: string | null;
  decisions: PaneDecision[];
  plan: { done: number; total: number; features: PaneFeature[] };
  quality: { heading: string | null; rows: PaneQuality[] }[];
  agents: PaneAgents;
  history: { open: boolean; items: { title: string; label: string }[]; onToggle: () => void };
  bridge: { connected: boolean; age: number | null; issues: string[] };
};

export const gauge = (ratio: number, width: number) => {
  const on = Math.round(Math.min(1, Math.max(0, ratio)) * width);
  return { on: "▰".repeat(on), off: "▱".repeat(width - on) };
};

const pendingIcon = { icon: "○" };
const icons: Record<string, { icon: string; color?: string }> = {
  completed: { icon: "✓", color: C.plan },
  running: { icon: "●", color: C.robin },
  working: { icon: "●", color: C.plan },
  needs_you: { icon: "●", color: C.decision },
  pending: pendingIcon,
  blocked: { icon: "⏸", color: C.decision },
  failed: { icon: "✗", color: C.fail },
  killed: { icon: "✗", color: C.fail },
};
const stateIcon = (state: string): { icon: string; color?: string } => icons[state] ?? pendingIcon;
const qualityIcon: Record<Tone, string> = { fail: "✗", ok: "✓", info: "✓", warn: "!", muted: "·" };

function card(
  ui: Ui,
  color: string,
  title: string,
  right: RenderChildren,
  body: RenderChildren[],
  quiet = false,
): RenderElement {
  return ui.Box({
    flexDirection: "column",
    borderStyle: "round",
    borderColor: color,
    borderDimColor: quiet,
    paddingX: 1,
    children: [
      ui.Box({
        justifyContent: "space-between",
        columnGap: 1,
        children: [
          ui.Box({ flexShrink: 0, children: ui.Text({ color, bold: true, children: title }) }),
          // A long label truncates instead of wrapping under the title.
          right ? ui.Box({ flexShrink: 1, children: right }) : null,
        ],
      }),
      ...body,
    ],
  });
}

// A row whose middle text truncates while its icon and trailing label stay visible.
function row(
  ui: Ui,
  icon: RenderChildren,
  text: string,
  trail?: RenderChildren,
  strong = false,
): RenderElement {
  return ui.Box({
    columnGap: 1,
    children: [
      icon,
      ui.Box({
        flexGrow: 1,
        flexShrink: 1,
        children: ui.Text({ wrap: "truncate", bold: strong, children: text }),
      }),
      trail ? ui.Box({ flexShrink: 0, children: trail }) : null,
    ],
  });
}

function bar(ui: Ui, ratio: number, width: number, color: string) {
  const g = gauge(ratio, width);
  return [ui.Text({ color, children: g.on }), ui.Text({ color: C.faint, children: g.off })];
}

// A state's icon and label in the state's colour; uncoloured states stay dim.
function marked(ui: Ui, state: string) {
  const s = stateIcon(state);
  return {
    icon: ui.Text({
      color: s.color,
      dimColor: !s.color,
      bold: state === "running",
      children: s.icon,
    }),
    label: (label: string) => ui.Text({ color: s.color, dimColor: !s.color, children: label }),
  };
}

const capped = <T>(items: T[], max: number) => ({
  shown: items.slice(0, max),
  more: Math.max(0, items.length - max),
});

function planCard(ui: Ui, plan: PaneModel["plan"], width: number): RenderElement {
  const { Text } = ui;
  const body: RenderChildren[] = [];
  if (plan.total)
    body.push(
      Text({
        wrap: "truncate",
        children: [
          ...bar(ui, plan.done / plan.total, width, C.plan),
          Text({ bold: true, children: ` ${Math.round((plan.done / plan.total) * 100)}%` }),
        ],
      }),
    );
  for (const f of plan.features) {
    const m = marked(ui, f.state);
    const finished = f.total > 0 && (f.done === f.total || f.state === "completed");
    // A finished feature folds into one line; its count says it was all done.
    if (finished) {
      body.push(
        row(
          ui,
          Text({ color: C.plan, children: "✓" }),
          f.title,
          Text({ dimColor: true, children: `${f.done}/${f.total}` }),
        ),
      );
      continue;
    }
    body.push(
      row(
        ui,
        m.icon,
        f.title,
        f.total
          ? Text({
              children: [
                ...bar(ui, f.done / f.total, 5, C.plan),
                Text({ dimColor: true, children: ` ${f.done}/${f.total}` }),
              ],
            })
          : m.label(f.label),
        f.state === "running",
      ),
    );
    // Subtasks unfold only under the feature that is moving or stuck.
    const unfold = [f, ...f.subtasks].some((t) =>
      ["running", "blocked", "failed"].includes(t.state),
    );
    if (unfold)
      for (const t of f.subtasks) {
        const s = marked(ui, t.state);
        body.push(ui.Box({ paddingLeft: 2, children: row(ui, s.icon, t.title, s.label(t.label)) }));
      }
  }
  if (!plan.total && !plan.features.length)
    body.push(
      Text({ dimColor: true, italic: true, children: "La IA todavía no ha publicado un plan" }),
    );
  return card(
    ui,
    C.plan,
    "PLAN",
    plan.total ? Text({ color: C.plan, children: `${plan.done}/${plan.total} hechas` }) : null,
    body,
    !plan.features.length,
  );
}

// Always red: quality is what "done" has not proven yet.
function qualityCard(ui: Ui, quality: PaneModel["quality"], width: number): RenderElement {
  const { Box, Text } = ui;
  const body: RenderChildren[] = [];
  for (const group of quality) {
    if (group.heading) body.push(Text({ bold: true, wrap: "truncate", children: group.heading }));
    for (const q of group.rows) {
      const color = q.tone === "info" ? C.plan : tone[q.tone];
      body.push(
        Box({
          columnGap: 1,
          children: [
            Text({
              color,
              dimColor: !color,
              bold: q.tone === "fail",
              children: qualityIcon[q.tone],
            }),
            Box({ width: 9, flexShrink: 0, children: Text({ dimColor: true, children: q.label }) }),
            typeof q.ratio === "number"
              ? Text({ children: bar(ui, q.ratio, Math.min(10, width), color ?? C.faint) })
              : null,
            Box({
              flexGrow: 1,
              flexShrink: 1,
              children: Text({
                wrap: "truncate",
                color,
                dimColor: !color,
                bold: q.tone === "fail",
                children: q.value,
              }),
            }),
          ],
        }),
      );
    }
  }
  if (!body.length) body.push(Text({ dimColor: true, children: "Sin repositorio con datos" }));
  return card(
    ui,
    C.quality,
    "CALIDAD",
    Text({ dimColor: true, children: "hecho ≠ verificado" }),
    body,
  );
}

function agentsCard(ui: Ui, a: PaneAgents): RenderElement {
  const { Text } = ui;
  if (a.mode === "solo")
    return card(ui, C.agents, "AGENTES", Text({ dimColor: true, children: a.label }), [], true);
  const body: RenderChildren[] = [];
  const section = (title: string) => body.push(Text({ bold: true, children: title }));
  const more = (n: number) => n && body.push(Text({ dimColor: true, children: `+${n} más` }));
  if (a.charge.length) {
    section("A su cargo");
    const { shown, more: rest } = capped(a.charge, 6);
    for (const c of shown) {
      const m = marked(ui, c.state);
      body.push(
        ui.Box({
          paddingLeft: c.depth * 2,
          children: row(ui, m.icon, `${c.kind ? `${c.kind} · ` : ""}${c.title}`, m.label(c.label)),
        }),
      );
      const facts = [
        c.detail ? Text({ dimColor: true, children: c.detail }) : null,
        c.waiting ? Text({ color: tone.warn, bold: true, children: "espera respuesta" }) : null,
      ].filter(Boolean);
      if (facts.length)
        body.push(
          ui.Box({
            paddingLeft: c.depth * 2 + 2,
            children: Text({
              wrap: "truncate",
              children: facts.flatMap((f, i) => (i ? [Text({ dimColor: true, children: " · " }), f] : [f])),
            }),
          }),
        );
      if (c.last)
        body.push(
          ui.Box({
            paddingLeft: c.depth * 2 + 2,
            children: Text({ dimColor: true, wrap: "truncate", children: c.last }),
          }),
        );
    }
    more(rest);
  }
  if (a.peers.length) {
    section("Conversa con");
    const { shown, more: rest } = capped(a.peers, 6);
    for (const p of shown) {
      const color = tone[p.tone] ?? C.agents;
      body.push(
        row(
          ui,
          Text({ color, children: p.tone === "ok" ? "●" : "○" }),
          p.name,
          Text({
            children: [
              Text({ color: C.agents, children: p.counts }),
              Text({ color: tone[p.tone], dimColor: p.tone === "ok", children: `  ${p.ago}` }),
            ],
          }),
        ),
      );
    }
    more(rest);
  }
  if (a.events.length) {
    section("Últimas comunicaciones");
    for (const e of a.events)
      body.push(
        row(
          ui,
          Text({ color: C.agents, bold: e.fresh, children: e.icon }),
          e.text,
          Text({
            children: [
              Text({ color: tone[e.tone], dimColor: e.tone === "muted", children: e.trail }),
              e.fresh ? Text({ color: C.agents, bold: true, children: "  nuevo" }) : null,
            ],
          }),
          e.fresh,
        ),
      );
  }
  return card(
    ui,
    C.agents,
    "AGENTES",
    Text({ color: C.agents, bold: a.mode === "group", wrap: "truncate", children: a.label }),
    body,
  );
}

function decisionsCard(ui: Ui, decisions: PaneDecision[]): RenderElement {
  const { Box, Text, Button, Input } = ui;
  if (!decisions.length)
    return card(
      ui,
      C.decision,
      "DECISIONES",
      Text({ dimColor: true, children: "Sin decisiones pendientes" }),
      [],
      true,
    );
  const body: RenderChildren[] = [];
  for (const d of decisions) {
    const color = d.blocking ? C.block : C.decision;
    body.push(
      Text({
        children: [
          Text({ color, bold: true, children: d.blocking ? "⛔ Bloquea " : "◷ Puede esperar " }),
          d.chat ? Text({ dimColor: true, children: "· pregunta en el chat " }) : null,
        ],
      }),
      Text({ bold: true, children: d.question }),
      d.context ? Text({ dimColor: true, children: d.context }) : null,
      d.status ? Text({ dimColor: true, children: d.status }) : null,
    );
    if (d.error) body.push(Text({ color: C.decision, children: d.error }));
    if (!d.open) continue;
    const label = (o: { label: string }, i: number) =>
      `${i + 1}. ${o.label}${d.recommended === i ? " ★" : ""}`;
    const button = (o: { label: string }, i: number) =>
      Button({
        key: `answer-${d.key}-${i}`,
        label: label(o, i),
        onPress: () => d.onAnswer(o.label),
      });
    // Options with an explanation stack one per line; bare labels share a row.
    if (d.options.some((o) => o.detail))
      for (const [i, o] of d.options.entries())
        body.push(
          Box({
            flexDirection: "column",
            children: [
              button(o, i),
              o.detail
                ? Box({ paddingLeft: 3, children: Text({ dimColor: true, children: o.detail }) })
                : null,
            ],
          }),
        );
    else if (d.options.length)
      body.push(Box({ flexWrap: "wrap", columnGap: 1, children: d.options.map(button) }));
    body.push(
      Input({
        key: `answer-${d.key}-text`,
        label: "Respuesta",
        placeholder: d.chat ? "Responde a la pregunta del chat" : "Escribe tu decisión",
        value: d.draft,
        onInput: d.onDraft,
        submitLabel: "Enviar",
        onSubmit: d.onAnswer,
      }),
    );
  }
  const blocking = decisions.some((d) => d.blocking && d.open);
  const open = decisions.filter((d) => d.open).length;
  return card(
    ui,
    blocking ? C.block : C.decision,
    "DECISIONES",
    Text({
      color: blocking ? C.block : C.decision,
      children: blocking ? "te bloquea" : `${open} ${open === 1 ? "abierta" : "abiertas"}`,
    }),
    body,
  );
}

export function paneView(ui: Ui, m: PaneModel): RenderElement {
  const { Box, Text, Button } = ui;
  const width = Math.max(6, Math.min(20, m.cols - 24));
  const nodes: RenderChildren[] = [];

  nodes.push(
    Box({
      justifyContent: "space-between",
      paddingX: 1,
      columnGap: 1,
      children: [
        Text({
          wrap: "truncate",
          children: [
            Text({ color: C.robin, bold: true, children: "WORKBOARD" }),
            Text({ dimColor: true, children: " · " }),
            Text({ bold: true, children: m.title }),
          ],
        }),
        m.working
          ? Text({ color: C.plan, bold: true, children: "● trabajando" })
          : Text({ dimColor: true, children: "○ esperando" }),
      ],
    }),
  );

  nodes.push(
    card(
      ui,
      C.robin,
      "ROBIN",
      m.robin.at
        ? Text({ dimColor: true, children: new Date(m.robin.at).toLocaleTimeString("es-ES") })
        : null,
      [
        Text({ children: m.robin.text }),
        m.robin.detail
          ? Text({ dimColor: true, wrap: "truncate", children: m.robin.detail })
          : null,
        m.robin.notice ? Text({ color: C.decision, children: `Aviso: ${m.robin.notice}` }) : null,
        m.failure
          ? Text({ color: C.decision, children: `⚠ Incidencia observada: ${m.failure}` })
          : null,
        m.error ? Text({ color: C.fail, children: `✗ ${m.error}` }) : null,
      ],
    ),
  );

  nodes.push(planCard(ui, m.plan, width));
  nodes.push(qualityCard(ui, m.quality, width));
  nodes.push(agentsCard(ui, m.agents));
  nodes.push(decisionsCard(ui, m.decisions));

  nodes.push(
    Box({
      justifyContent: "space-between",
      paddingX: 1,
      columnGap: 1,
      children: [
        Button({
          key: "history",
          label: `Terminados (${m.history.items.length}) ${m.history.open ? "−" : "+"}`,
          plain: true,
          onPress: m.history.onToggle,
        }),
        m.bridge.connected
          ? Text({
              color: C.plan,
              wrap: "truncate",
              children: `● AOS conectado${m.bridge.age === null ? "" : ` · hace ${m.bridge.age} s`}`,
            })
          : Text({
              dimColor: true,
              wrap: "truncate",
              children: "○ Agentic OS desconectado · datos locales",
            }),
      ],
    }),
  );
  for (const issue of m.bridge.issues)
    nodes.push(Text({ color: C.decision, children: `⚠ ${issue}` }));
  if (m.history.open)
    for (const x of m.history.items)
      nodes.push(
        Box({
          paddingX: 1,
          children: row(
            ui,
            Text({ color: C.plan, children: "✓" }),
            x.title,
            Text({ dimColor: true, children: x.label }),
          ),
        }),
      );

  return Box({ flexDirection: "column", children: nodes });
}

export function diffView(
  ui: Ui,
  d: { path: string; source: string; truncated: boolean },
  onBack: () => void,
): RenderElement {
  const { Box, Text, Button, Code } = ui;
  return Box({
    flexDirection: "column",
    children: [
      card(
        ui,
        C.robin,
        "CAMBIO",
        Button({ key: "back", label: "Volver al trabajo", onPress: onBack }),
        [
          Text({ wrap: "truncate-start", children: d.path }),
          d.truncated
            ? Text({ color: C.decision, children: "Vista limitada a 9000 caracteres" })
            : null,
        ],
      ),
      Code({ source: d.source, path: d.path }),
    ],
  });
}
