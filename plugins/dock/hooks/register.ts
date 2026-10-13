import type { EngineInterface, Register, RenderElement } from "claude-code";
import { type Host, perform } from "./backends.ts";
import { INPUT_SCHEMA, type Panel, target, validate } from "./schema.ts";

const TOOL = "mcp__dock__actions";

const DESCRIPTION =
  "Show buttons the user presses to act on their machine: open a file at a line or a folder in the editor, a terminal in a folder (shell, or a claude, codex or grok session with an optional first prompt), a URL in the browser, or a path in Finder. Through Agentic OS when it runs, local apps otherwise. Offer it when the next step is the user's own hands-on look or work, not to report; 1-6 items, absolute paths. After it returns, add at most one sentence.";
const CONTEXT =
  "Dock: when the next step is the user's own hands-on look or work on what you point at (a file, folder, terminal, agent session, URL), call mcp__dock__actions with those buttons; not to report. Then one sentence.";
const SHOWN = "Buttons shown to the user. Add at most one sentence; do not list them again.";

// What each press came to, by call and item, for this session.
const states = new Map<string, string>();
let drawn = false;

async function host($: EngineInterface): Promise<Host> {
  const config = { aosUrl: await $.env.get("AOS_URL"), editor: await $.env.get("DOCK_EDITOR"), terminal: await $.env.get("DOCK_TERMINAL") };
  return {
    config,
    fetch: (url, init) => $.http.fetch(url, init),
    run: (argv) => $.process.run(argv, { timeoutMs: 10_000 }),
    kind: (path) => $.fs.stat(path).then((st) => st.kind, () => null),
    sleep: (ms) => $.clock.sleep(ms),
  };
}

function press($: EngineInterface, key: string, panel: Panel, i: number) {
  const action = panel.items[i];
  if (!action || states.get(key) === "…") return;
  states.set(key, "…");
  $.ui.invalidate("ui.render");
  void host($).then((h) => perform(h, action)).then((r) => {
    states.set(key, r.ok ? `✓ ${r.via}` : `✗ ${r.error}`);
    if (!r.ok) $.ui.toast(r.error);
    $.ui.invalidate("ui.render");
  });
}

function draw($: EngineInterface, ui: ReturnType<EngineInterface["ui"]["resolve"]>, id: string, panel: Panel): RenderElement {
  const { Box, Text, Button } = ui;
  // One line per button, whole: what it opens, then what the press came to.
  const lines = panel.items.map((a, i) => {
    const s = states.get(`${id}:${i}`);
    const failed = s?.startsWith("✗");
    return Text({ dimColor: !failed, color: failed ? "error" : undefined, wrap: "wrap", children: `${a.label} → ${target(a)}${s ? `  ${s}` : ""}` });
  });
  return Box({
    flexDirection: "column",
    children: [
      panel.title ? Text({ bold: true, children: panel.title }) : null,
      Box({ columnGap: 1, flexWrap: "wrap", children: panel.items.map((a, i) => Button({ key: `dock-${i}`, label: a.label, onPress: () => press($, `${id}:${i}`, panel, i) })) }),
      ...lines,
    ],
  });
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    // The actions run on this machine, from the CLI's own process: a desktop or headless
    // session gets no tool and the model names paths in text.
    drawn = e.isInteractive && e.surface === "terminal";
    if (drawn) await $.tool.register({ name: "actions", description: DESCRIPTION, inputSchema: INPUT_SCHEMA });
    return r;
  });

  on("prompt.submit", async ($, e, next) => (drawn ? next({ ...e, context: [...(e.context ?? []), CONTEXT] }) : next(e)));

  on("tool.describe", { tool: TOOL }, async ($, e, next) => ({ ...(await next(e)), isDeferred: false }));

  on("tool.call", { tool: TOOL }, async ($, e) => {
    const { tool, tool_use_id, ...input } = e as unknown as Record<string, unknown> & { tool: string; tool_use_id: string };
    const checked = validate(input);
    if (!checked.ok) return { result: `Not shown: ${checked.error}. Fix it and call again, or name the paths in text.`, isError: true };
    return { result: SHOWN };
  });

  on("ui.render", { component: "ToolUse" }, async ($, e, next) => {
    const p = e.props;
    if (p.tool !== TOOL || p.isRunning || p.isErrored || p.isInterrupted) return next(e);
    const checked = validate(p.input);
    if (!checked.ok) return next(e);
    return draw($, $.ui.resolve(e), p.tool_use_id, checked.panel);
  });

  on("ui.render", { component: "ToolResult" }, async ($, e, next) => {
    if (e.props.tool !== TOOL || e.props.isErrored) return next(e);
    const { Text } = $.ui.resolve(e);
    return Text({ dimColor: true, children: "  ⎿ pulsa un botón para abrirlo" });
  });
};
