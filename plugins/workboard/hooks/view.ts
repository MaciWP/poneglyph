import type {
  BoxProps,
  ButtonProps,
  CodeProps,
  ElementConstructor,
  LinkProps,
  RenderChildren,
  RenderElement,
  TextProps,
} from "claude-code";

// Presentation only: register.ts prepares plain data and handlers, this file draws them.
export type Ui = {
  Box: ElementConstructor<BoxProps>;
  Text: ElementConstructor<TextProps>;
  Button: ElementConstructor<ButtonProps>;
  Code: ElementConstructor<CodeProps>;
  Link: ElementConstructor<LinkProps>;
};
// How the pane fits its room: docked it runs floor to ceiling, so text wraps instead of
// truncating; below NARROW columns a label moves under what it labels instead of beside it.
type Fit = Ui & { wrap: boolean; stack: boolean };
const NARROW = 36;

// One colour per section, so a glance tells which card needs attention.
export const C = {
  robin: "#22d3ee",
  decision: "#fbbf24",
  plan: "#4ade80",
  quality: "#60a5fa",
  agents: "#c084fc",
  changes: "#fda4af",
  fail: "#f87171",
  // The Agents card's four sections, one colour per rank.
  coworkers: "#2dd4bf",
  orchestrator: "#f472b6",
  subordinates: "#fb923c",
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

export type PaneTask = { title: string; state: string; label: string };
// A feature (a task without parent) with its subtasks; `total` 0 when it has none.
export type PaneFeature = PaneTask & { done: number; total: number; subtasks: PaneTask[] };
export type PaneQuality = { label: string; value: string; tone: Tone; ratio?: number | null };
export type PaneCharge = PaneTask & {
  kind?: string;
  depth: number;
  // How it ran ("haiku 5.5 · medium · 12K tok · 40 s"), its latest internal message and
  // whether it waits for main's reply.
  detail?: string;
  last?: string;
  waiting?: boolean;
};
export type PanePeer = { name: string; counts: string; ago: string; tone: Tone };
export type AgentRole = "subagents" | "coworkers" | "orchestrator" | "subordinates";
export type PaneAgents = {
  mode: "solo" | "lead" | "pair" | "group" | "worker";
  label: string;
  // Only the sections with someone in them, in this order.
  sections: { role: AgentRole; charge: PaneCharge[]; peers: PanePeer[] }[];
  events: { icon: string; text: string; trail: string; fresh: boolean; tone: Tone }[];
};
const roles: Record<AgentRole, { title: string; color: string }> = {
  subagents: { title: "Subagentes", color: C.agents },
  coworkers: { title: "Coworkers", color: C.coworkers },
  orchestrator: { title: "Orquestador", color: C.orchestrator },
  subordinates: { title: "Subordinados", color: C.subordinates },
};
// One repo of the Cambios card: its summary always, the rest once the files unfold.
export type PaneRepo = {
  heading: string;
  status: string;
  notes: { text: string; tone: Tone }[];
  pr: { href: string; label: string } | null;
  checks: string[];
  files: { key: string; path: string; detail: string; onView: () => void }[];
  more: number;
  coverage: { key: string; label: string; onPress: () => void };
};
export type PaneModel = {
  title: string;
  working: boolean;
  cols: number;
  robin: { text: string; at: number | null; detail: string | null; notice: string | null };
  failure: string | null;
  error: string | null;
  plan: { done: number; total: number; features: PaneFeature[] };
  quality: { heading: string | null; rows: PaneQuality[] }[];
  changes: { repos: PaneRepo[]; open: boolean; onToggle: () => void };
  refresh: { busy: boolean; onPress: () => void };
  agents: PaneAgents;
  history: { open: boolean; items: { title: string; label: string }[]; onToggle: () => void };
  bridge: { connected: boolean; age: number | null; issues: string[] };
  // Docked beside the transcript with this many body rows, or null when inline above the prompt.
  dock: number | null;
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
  ui: Fit,
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
        flexDirection: ui.stack ? "column" : "row",
        justifyContent: "space-between",
        columnGap: 1,
        children: [
          ui.Box({ flexShrink: 0, children: ui.Text({ color, bold: true, children: title }) }),
          // Beside the title a long label truncates; narrow, it takes its own line.
          right ? ui.Box({ flexShrink: 1, children: right }) : null,
        ],
      }),
      ...body,
    ],
  });
}

// A row whose middle text truncates (or wraps, docked) while its icon and trailing label stay
// visible; narrow, the label sits under the text.
function row(
  ui: Fit,
  icon: RenderChildren,
  text: string,
  trail?: RenderChildren,
  strong = false,
): RenderElement {
  const line = ui.Box({
    columnGap: 1,
    children: [
      icon,
      ui.Box({
        flexGrow: 1,
        flexShrink: 1,
        children: ui.Text({ wrap: ui.wrap ? "wrap" : "truncate", bold: strong, children: text }),
      }),
      trail && !ui.stack ? ui.Box({ flexShrink: 0, children: trail }) : null,
    ],
  });
  if (!trail || !ui.stack) return line;
  return ui.Box({ flexDirection: "column", children: [line, ui.Box({ paddingLeft: 2, children: trail })] });
}

function bar(ui: Fit, ratio: number, width: number, color: string) {
  const g = gauge(ratio, width);
  return [ui.Text({ color, children: g.on }), ui.Text({ color: C.faint, children: g.off })];
}

// A state's icon and label in the state's colour; uncoloured states stay dim.
function marked(ui: Fit, state: string) {
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

function planCard(ui: Fit, plan: PaneModel["plan"], width: number): RenderElement {
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
    // Subtasks unfold under the feature that is moving or stuck, and under every open one
    // once docked, where the height is there to use.
    const unfold =
      ui.wrap ||
      [f, ...f.subtasks].some((t) => ["running", "blocked", "failed"].includes(t.state));
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
function qualityCard(ui: Fit, quality: PaneModel["quality"], width: number): RenderElement {
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
  return card(
    ui,
    C.quality,
    "CALIDAD",
    Text({ dimColor: true, children: "hecho ≠ verificado" }),
    body,
  );
}

// What changed in each repo and what GitHub, CI and coverage say about it.
function changesCard(ui: Fit, c: PaneModel["changes"]): RenderElement {
  const { Box, Text, Button, Link } = ui;
  const count = c.repos.reduce((n, r) => n + r.files.length + r.more, 0);
  const body: RenderChildren[] = [];
  for (const r of c.repos) {
    body.push(Text({ bold: true, wrap: ui.wrap ? "wrap" : "truncate", children: r.heading }));
    body.push(Text({ dimColor: true, wrap: ui.wrap ? "wrap" : "truncate", children: r.status }));
    for (const n of r.notes) body.push(Text({ color: tone[n.tone], children: n.text }));
    if (r.pr) body.push(Link({ href: r.pr.href, label: r.pr.label }));
    if (!c.open) continue;
    for (const check of r.checks) body.push(Text({ wrap: "truncate", children: check }));
    for (const f of r.files)
      body.push(
        row(
          ui,
          Text({ color: C.changes, children: "·" }),
          f.path,
          Button({ key: f.key, label: "Ver cambio", plain: true, onPress: f.onView }),
        ),
        Box({ paddingLeft: 2, children: Text({ dimColor: true, wrap: "truncate", children: f.detail }) }),
      );
    if (r.more)
      body.push(
        Text({ dimColor: true, children: `${r.more} ficheros más; consulta Git para el detalle completo` }),
      );
    body.push(Button({ key: r.coverage.key, label: r.coverage.label, onPress: r.coverage.onPress }));
  }
  return card(
    ui,
    C.changes,
    "CAMBIOS",
    Button({
      key: "changes-files",
      label: `Ficheros (${count}) ${c.open ? "−" : "+"}`,
      plain: true,
      onPress: c.onToggle,
    }),
    body,
  );
}

function agentsCard(ui: Fit, a: PaneAgents): RenderElement {
  const { Text } = ui;
  const body: RenderChildren[] = [];
  const section = (title: string, color?: string) =>
    body.push(Text({ bold: true, color, children: color ? `● ${title}` : title }));
  const more = (n: number) => n && body.push(Text({ dimColor: true, children: `+${n} más` }));
  for (const s of a.sections) {
    const { title, color } = roles[s.role];
    section(title, color);
    const { shown, more: rest } = capped(s.charge, 6);
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
    const peers = capped(s.peers, 6);
    for (const p of peers.shown) {
      const dot = p.tone === "ok" ? color : (tone[p.tone] ?? color);
      body.push(
        row(
          ui,
          Text({ color: dot, children: p.tone === "ok" ? "●" : "○" }),
          p.name,
          Text({
            children: [
              Text({ color, children: p.counts }),
              Text({ color: tone[p.tone], dimColor: p.tone === "ok", children: `  ${p.ago}` }),
            ],
          }),
        ),
      );
    }
    more(peers.more);
  }
  if (a.events.length) {
    section("Últimas comunicaciones");
    for (const e of a.events)
      body.push(
        row(
          // One line each: the whole message is in the agents' own view.
          { ...ui, wrap: false },
          Text({ color: C.agents, bold: e.fresh, children: e.icon }),
          e.text,
          Text({
            wrap: "truncate",
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
    Text({
      color: a.mode === "worker" ? C.orchestrator : C.agents,
      bold: a.mode === "group" || a.mode === "worker",
      wrap: "truncate",
      children: a.label,
    }),
    body,
  );
}

export function paneView(base: Ui, m: PaneModel): RenderElement {
  const ui: Fit = { ...base, wrap: m.dock !== null, stack: m.cols < NARROW };
  const { Box, Text, Button } = ui;
  const width = Math.max(6, Math.min(20, m.cols - 24));
  const nodes: RenderChildren[] = [];

  nodes.push(
    Box({
      flexDirection: ui.stack ? "column" : "row",
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
        Box({
          flexShrink: 0,
          // A pane too narrow for the state and the button puts the button on its own line.
          flexWrap: "wrap",
          columnGap: 1,
          children: [
            m.working
              ? Text({ color: C.plan, bold: true, children: "● trabajando" })
              : Text({ dimColor: true, children: "○ esperando" }),
            Button({
              key: "workboard-refresh",
              label: m.refresh.busy ? "Actualizando" : "Actualizar",
              hotkey: "a",
              onPress: m.refresh.onPress,
            }),
          ],
        }),
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
          ? Text({ color: C.decision, wrap: "truncate", children: `⚠ ${m.failure}` })
          : null,
        m.error ? Text({ color: C.fail, children: `✗ ${m.error}` }) : null,
      ],
    ),
  );

  nodes.push(planCard(ui, m.plan, width));
  // A card with nothing to say takes no screen: no quality data, or an agent working alone.
  if (m.quality.length) nodes.push(qualityCard(ui, m.quality, width));
  if (m.changes.repos.length) nodes.push(changesCard(ui, m.changes));
  if (m.agents.sections.length) nodes.push(agentsCard(ui, m.agents));
  // Docked, the footer sits at the bottom of the pane, as a sidebar's footer on a web page.
  if (m.dock !== null) nodes.push(Box({ flexGrow: 1 }));

  nodes.push(
    Box({
      flexDirection: ui.stack ? "column" : "row",
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

  return Box({ flexDirection: "column", minHeight: m.dock ?? undefined, children: nodes });
}

export function diffView(
  base: Ui,
  d: { path: string; source: string; truncated: boolean },
  onBack: () => void,
): RenderElement {
  const ui: Fit = { ...base, wrap: false, stack: false };
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
