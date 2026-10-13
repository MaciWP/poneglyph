import { test, expect, mock } from "claude-code/testing";
import type { On } from "claude-code";
import { initialState, publish } from "../hooks/core.ts";

const start = { cwd: "/work/project", surface: "terminal" as const, isInteractive: true };
const pane = {
  plugin: "workboard",
  surface: "terminal" as const,
  component: "Pane" as const,
  requestId: "workboard",
  props: {
    title: "Workboard",
    isFocused: false,
    bodyColumns: 48,
    placement: "dock" as const,
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
};
// The same pane seated inline above the prompt, and docked but narrow.
const inline = { ...pane, props: { ...pane.props, bodyColumns: 80, placement: "inline" as const, scroll: { offset: 0, bodyRows: 20 } } };
const narrow = { ...pane, props: { ...pane.props, bodyColumns: 28 } };
const band = {
  plugin: "workboard",
  surface: "terminal" as const,
  component: "AbovePrompt" as const,
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
};
const data = {
  version: 1,
  cwd: start.cwd,
  ticket: "TEST-1",
  at: 1,
  repos: [
    {
      cwd: start.cwd,
      files: [{ path: "a.ts", lines: [1], kind: "changed", staged: true, unstaged: false }],
      branch: "TEST-1",
      pr: { state: "none" },
      coverage: { state: "missing" },
    },
  ],
  allRepos: [],
  bridge: { state: "offline", sessions: [], published: [] },
};
function world(on: On, stored?: unknown, snap: unknown = data, env: Record<string, string> = {}) {
  const clock = mock.clock(on);
  mock.store(on, stored ? { "session:s1": stored } : {});
  mock.env(on, env);
  const opens: unknown[] = [];
  const prompts: string[] = [];
  const toasts: string[] = [];
  const agents: unknown[] = [];
  let agentResult: unknown = "ok";
  let bashError = false;
  let shown = true,
    placed = true;
  let pending: (() => void) | undefined;
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("session.id", () => ({ value: "s1" }));
  on("command.register", (_, e) => ({ value: { command: e.name } }));
  on("tool.register", () => ({ value: { tool: "mcp__workboard__progress" } }));
  on("ui.open", (_, e) => {
    opens.push(e);
    shown = true;
    return { value: undefined };
  });
  on("ui.close", () => {
    shown = false;
    return { value: undefined };
  });
  on("ui.panes", () => ({
    value: [
      { id: "workboard", title: "Workboard", isShown: shown, isPlaced: placed, isFocused: false },
    ],
  }));
  on("agent.list", () => ({ value: agents as never }));
  on("agent.spawn", () => ({ model: "claude-sonnet-5-5", agentId: "a2" }));
  on("ui.toast", (_, e) => {
    toasts.push(e.text);
    return { value: undefined };
  });
  on("process.run", (_, e) => ({
    value: {
      exitCode: 0,
      stdout: JSON.stringify(
        e.argv.includes("diff") ? { path: "a.ts", source: "-old\n+new", truncated: false } : snap,
      ),
      stderr: "",
    },
  }));
  on("turn.complete", (_, e) => ({ text: e.answer }));
  on("turn.start", (_, e) => ({ turnId: e.turnId }));
  on("tool.call", (_, e) =>
    e.tool === "Bash" && bashError
      ? { isError: true as const, result: "Exit code 1", text: "Exit code 1" }
      : { result: e.tool === "Agent" ? agentResult : "ok" },
  );
  on("session.send", () => ({ isDelivered: true }));
  on("session.receive", (_, e) => ({ text: e.text }));
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e);
    return Text({ children: e.component === "AssistantMessage" ? e.props.text : "Existing band" });
  });
  on("prompt.submit", async (_, e) => {
    prompts.push(e.text);
    await new Promise<void>((r) => {
      pending = r;
    });
    return { text: e.text };
  });
  return {
    clock,
    opens,
    prompts,
    toasts,
    agents,
    agentAnswers: (value: unknown) => {
      agentResult = value;
    },
    bashFails: (value: boolean) => {
      bashError = value;
    },
    isShown: () => shown,
    release: () => pending?.(),
    placement: (value: boolean) => {
      placed = value;
    },
  };
}

test("everything lives in the pane: the band passes through, history and files fold, focus stays with the prompt", async ($, on) => {
  const s = publish(initialState("s1", start.cwd), {
    tasks: [
      { id: "done", title: "Already finished", state: "completed" },
      { id: "now", title: "Still working", state: "running" },
    ],
  });
  const w = world(on, s);
  await $.session.start(start);
  await w.clock.settle();
  expect(w.opens).toHaveLength(1);
  expect(w.opens[0]).not.toHaveProperty("focus");
  const a = await $.ui.mount(band),
    p = await $.ui.mount(inline);
  // Nothing of Workboard's is drawn outside its pane.
  expect(await a.find({ text: "Existing band" })).toBeDefined();
  expect(await a.find({ text: "TEST-1" })).toBeUndefined();
  expect(await a.find({ type: "Button" })).toBeUndefined();
  expect(await p.find({ text: "Still working" })).toBeDefined();
  expect(await p.find({ text: "Already finished" })).toBeUndefined();
  // No PR, no CI, no coverage and no agents: those cards take no screen.
  expect(await p.find({ text: "CALIDAD" })).toBeUndefined();
  expect(await p.find({ text: "AGENTES" })).toBeUndefined();
  await p.press({ key: "history" });
  expect(await p.find({ text: "Already finished" })).toBeDefined();
  expect(await p.find({ text: "work/project · TEST-1 · 1 cambios" })).toBeDefined();
  expect(await p.find({ text: "a.ts" })).toBeUndefined();
  await p.press({ key: "changes-files" });
  expect(await p.find({ text: "a.ts" })).toBeDefined();
  await p.press({ key: "file-/work/project-a.ts" });
  expect(await p.find({ type: "Code", text: "+new" })).toBeDefined();
  await p.press({ key: "back" });
  expect(await p.find({ text: "Still working" })).toBeDefined();
});

test("ROBIN moves only when its replacement is drawn; closure and narrow placement restore it", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await w.clock.settle();
  const original = "The answer.\n\nROBIN: All done.";
  const result = await $.turn.complete({
    answer: original,
    durationMs: 1,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });
  expect(result.text).toBe(original);
  const msg = {
    plugin: "workboard",
    surface: "terminal" as const,
    component: "AssistantMessage" as const,
    props: { text: original, isFirstOfReply: true, onScreen: null },
  };
  const chat = await $.ui.mount(msg);
  expect(await chat.find({ text: "ROBIN:" })).toBeDefined();
  await $.ui.mount(pane);
  await chat.redraw();
  expect(await chat.find({ text: "ROBIN:" })).toBeUndefined();
  w.placement(false);
  await chat.redraw();
  expect(await chat.find({ text: "ROBIN:" })).toBeDefined();
  w.placement(true);
  await $.command.run({
    command: "workboard",
    args: "",
    origin: { kind: "composer" },
    presentation: { isFullscreen: true, columns: 160 },
  });
  await chat.redraw();
  expect(await chat.find({ text: "ROBIN:" })).toBeDefined();
});

test("a session saved with decisions by an older build loads without them", async ($, on) => {
  const s = {
    ...publish(initialState("s1", start.cwd), {
      tasks: [{ id: "now", title: "Still working", state: "running" }],
    }),
    decisions: [
      { id: "choice", question: "Choose", options: ["A"], blocking: true, revision: 1, state: "queued", response: "A" },
    ],
  };
  const w = world(on, s);
  await $.session.start(start);
  await w.clock.settle();
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "Still working" })).toBeDefined();
  expect(await p.find({ text: "Choose" })).toBeUndefined();
  expect(await p.find({ text: "DECISIONES" })).toBeUndefined();
  expect(w.prompts).toHaveLength(0);
});

test("a failed panel restores ROBIN and falls back without an invalidation loop", async ($, on) => {
  const broken = {
    ...initialState("s1", start.cwd),
    agents: null,
    robin: { text: "Keep this summary", at: 1 },
  };
  const w = world(on, broken);
  await $.session.start(start);
  await w.clock.settle();
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "Existing band" })).toBeDefined();
  const chat = await $.ui.mount({
    plugin: "workboard",
    surface: "terminal",
    component: "AssistantMessage",
    props: { text: "ROBIN: Keep this summary", isFirstOfReply: true },
  });
  expect(await chat.find({ text: "ROBIN:" })).toBeDefined();
});

test("the Cambios card names a provider error and states missing coverage once", async ($, on) => {
  const remoteless = {
    ...data,
    repos: [{ ...data.repos[0], pr: { state: "error", error: "no git remotes found" } }],
  };
  const w = world(on, undefined, remoteless);
  await $.session.start(start);
  await w.clock.settle();
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "GitHub: sin remoto" })).toBeDefined();
  expect(await p.find({ text: "cobertura sin datos" })).toBeDefined();
  expect(await p.find({ text: "sin datos sin datos" })).toBeUndefined();
});

test("the progress tool stays in the prompt instead of behind ToolSearch", async ($, on) => {
  on("tool.describe", (_, e) => ({ description: e.description, isDeferred: true }));
  const described = await $.tool.describe({
    tool: "mcp__workboard__progress",
    description: "Publish the plan",
    isDeferred: true,
    provider: { plugin: "workboard", tier: "user" },
  });
  expect(described).toEqual({ description: "Publish the plan", isDeferred: false });
  const other = await $.tool.describe({
    tool: "mcp__other__tool",
    description: "Something else",
    isDeferred: true,
    provider: { plugin: "other", tier: "user" },
  });
  expect(other).toEqual({ description: "Something else", isDeferred: true });
});

test("the progress tool answers with text the host accepts and shows the plan", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await w.clock.settle();
  const r = await $.tool.call({
    tool: "mcp__workboard__progress",
    update: { tasks: [{ id: "read", title: "Read the routes", state: "running" }] },
  });
  expect(typeof r.result).toBe("string");
  expect(JSON.parse(r.result as string)).toMatchObject({ accepted: true });
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "Read the routes" })).toBeDefined();
  // A partial update keeps the title; decisions are refused toward the native dialog.
  const update = await $.tool.call({
    tool: "mcp__workboard__progress",
    update: { tasks: [{ id: "read", state: "blocked" }] },
  });
  expect(JSON.parse(update.result as string)).toEqual({ accepted: true });
  const refused = await $.tool.call({
    tool: "mcp__workboard__progress",
    update: { decisions: [{ id: "d", question: "Which?", options: ["A"], blocking: true }] },
  });
  expect(refused.isError).toBe(true);
  expect(refused.result).toContain("AskUserQuestion");
  expect(await p.find({ text: "Read the routes" })).toBeDefined();
});

test("the panel shows only this session: other sessions' plans and agents stay out", async ($, on) => {
  const other = {
    ...data,
    bridge: {
      state: "offline",
      sessions: [
        {
          id: "t2",
          sessionId: "s2",
          title: "Other agent",
          state: "working",
          cwd: start.cwd,
          harness: "claude",
        },
      ],
      published: [
        {
          ...publish(initialState("s2", start.cwd), {
            tasks: [{ id: "x", title: "Other session plan", state: "running" }],
          }),
          updatedAt: 1,
        },
      ],
    },
  };
  const w = world(on, undefined, other);
  await $.session.start(start);
  await w.clock.settle();
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "Other session plan" })).toBeUndefined();
  expect(await p.find({ text: "Other agent" })).toBeUndefined();
  expect(await p.find({ text: "AGENTES" })).toBeUndefined();
});

test("a message this session sends shows its partner and the latest communication", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await w.clock.settle();
  const sent = await $.session.send({
    to: "reviewer",
    text: "Review the diff of view.ts",
    origin: { kind: "model" },
  });
  expect(sent).toEqual({ isDelivered: true });
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "De tú a tú · reviewer" })).toBeDefined();
  expect(await p.find({ text: "Últimas comunicaciones" })).toBeDefined();
  expect(await p.find({ text: "Review the diff of view.ts" })).toBeDefined();
  expect(await p.find({ text: "nuevo" })).toBeDefined();
});

test("features fold their subtasks until one of them moves", async ($, on) => {
  const s = publish(initialState("s1", start.cwd), {
    tasks: [
      { id: "a", title: "Feature done", state: "completed" },
      { id: "a1", title: "Done step", state: "completed", parent: "a" },
      { id: "b", title: "Feature now", state: "running" },
      { id: "b1", title: "Write tests", state: "running", parent: "b" },
      { id: "c", title: "Feature later", state: "pending" },
      { id: "c1", title: "Hidden step", state: "pending", parent: "c" },
    ],
  });
  const w = world(on, s);
  await $.session.start(start);
  await w.clock.settle();
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "Feature done" })).toBeDefined();
  expect(await p.find({ text: "Write tests" })).toBeDefined();
  expect(await p.find({ text: "Feature later" })).toBeDefined();
  expect(await p.find({ text: "1/3 hechas" })).toBeDefined();
  // Docked floor to ceiling every open feature unfolds; inline, only the moving one does.
  expect(await p.find({ text: "Hidden step" })).toBeDefined();
  await p.unmount();
  const compact = await $.ui.mount(inline);
  expect(await compact.find({ text: "Write tests" })).toBeDefined();
  expect(await compact.find({ text: "Hidden step" })).toBeUndefined();
});

test("docked, the pane fills its height with the footer at the bottom and Terminados folded; narrow, labels drop a line", async ($, on) => {
  const s = publish(initialState("s1", start.cwd), {
    tasks: [
      { id: "done", title: "Already finished", state: "completed" },
      { id: "now", title: "Still working on a long task title that would not fit", state: "running" },
    ],
  });
  const w = world(on, s);
  await $.session.start(start);
  await w.clock.settle();
  expect(w.opens[0]).toMatchObject({ rows: 40 });
  const p = await $.ui.mount(pane);
  const boxes = await p.findAll({ type: "Box" });
  expect(boxes.some((b) => (b.props as { minHeight?: number }).minHeight === 30)).toBe(true);
  expect(boxes.some((b) => (b.props as { flexGrow?: number }).flexGrow === 1 && !b.children.length)).toBe(true);
  // Finished work stays folded: the pane shows what is open.
  expect(await p.find({ text: "Already finished" })).toBeUndefined();
  expect((await p.find({ type: "Text", text: "Still working on a long task title that would not fit" }))?.props).toMatchObject({ wrap: "wrap" });
  await p.unmount();
  const compact = await $.ui.mount(inline);
  expect(await compact.find({ text: "Already finished" })).toBeUndefined();
  expect((await compact.findAll({ type: "Box" })).some((b) => (b.props as { minHeight?: number }).minHeight)).toBe(false);
  await compact.unmount();
  const thin = await $.ui.mount(narrow);
  expect((await thin.findAll({ type: "Box" })).some((b) => (b.props as { flexDirection?: string }).flexDirection === "column" && b.text.startsWith("CAMBIOS"))).toBe(true);
  // The state and the button wrap rather than break a word when they do not fit side by side.
  expect((await thin.findAll({ type: "Box" })).some((b) => (b.props as { flexWrap?: string }).flexWrap === "wrap" && b.text.includes("esperando"))).toBe(true);
});

test("the chat's decision block stays in the chat; the pane keeps the notice and the turn", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await w.clock.settle();
  await $.turn.start({ text: "Work", turnId: "t1" });
  await $.tool.call({ tool: "Bash", command: "ls", tool_use_id: "u1" });
  await $.turn.complete({
    answer:
      "Done.\n\n**Espera tu decisión:** ¿Borro el endpoint viejo?\n\nAviso: la rama va por detrás.\nROBIN: Falta tu decisión.",
    durationMs: 1,
    isAborted: false,
    turnId: "t1",
    reason: "answer",
  });
  await w.clock.settle();
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "¿Borro el endpoint viejo?" })).toBeUndefined();
  expect(await p.find({ text: "Aviso: la rama va por detrás." })).toBeDefined();
  expect(await p.find({ text: "1 comando" })).toBeDefined();
  // `ls` runs no check, so Quality stays hidden.
  expect(await p.find({ text: "CALIDAD" })).toBeUndefined();
  expect(w.prompts).toHaveLength(0);
});

test("local checks say whether they passed or failed; other commands are not checks", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await w.clock.settle();
  await $.tool.call({ tool: "Bash", command: "bun test", description: "Run unit tests", tool_use_id: "c1" });
  await $.tool.call({ tool: "Bash", command: "grep -n test src", description: "Find tests", tool_use_id: "c2" });
  w.bashFails(true);
  await $.tool.call({ tool: "Bash", command: "npm run lint", description: "Lint", tool_use_id: "c3" });
  // tail decides this exit status, so the row claims nothing.
  w.bashFails(false);
  await $.tool.call({ tool: "Bash", command: "bun test 2>&1 | tail -5", description: "Piped tests", tool_use_id: "c4" });
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "CALIDAD" })).toBeDefined();
  expect(await p.find({ text: "Run unit tests · pasó" })).toBeDefined();
  expect((await p.find({ type: "Text", text: "Lint · falló" }))?.props.color).toBe("#f87171");
  expect(await p.find({ text: "Find tests" })).toBeUndefined();
  expect(await p.find({ text: "Piped tests · sin veredicto" })).toBeDefined();
});

test("failing checks are marked in red and an AOS consultation makes this session lead", async ($, on) => {
  const snap = {
    ...data,
    repos: [
      {
        ...data.repos[0],
        pr: {
          state: "loaded",
          number: 7,
          approval: "REVIEW_REQUIRED",
          appliesToLocal: true,
          checks: [
            { name: "unit", state: "FAILURE" },
            { name: "lint", state: "SUCCESS" },
          ],
        },
      },
    ],
    bridge: {
      ...data.bridge,
      links: [
        {
          id: "aos:c:q1:a1",
          at: Date.now(),
          kind: "consult",
          peer: "consult:q1",
          harness: "codex",
          name: "codex gpt-5",
          text: "Review the plan",
          status: "running",
          source: "aos",
        },
      ],
    },
  };
  const w = world(on, undefined, snap);
  await $.session.start(start);
  await w.clock.settle();
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "1 fallos" })).toBeDefined();
  expect(await p.find({ text: "✗" })).toBeDefined();
  // Quality is blue, so it never reads as a decision; its failing rows stay red.
  expect((await p.find({ type: "Text", text: "CALIDAD" }))?.props.color).toBe("#60a5fa");
  expect((await p.find({ type: "Text", text: "✗" }))?.props.color).toBe("#f87171");
  expect(await p.find({ text: "Dirige 1" })).toBeDefined();
  expect(await p.find({ text: "consulta · codex gpt-5 · Review the plan" })).toBeDefined();
});

test("a received message passes unchanged and shows who sent it when the host says", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await w.clock.settle();
  const anonymous = await $.session.receive({ origin: { kind: "peer" }, text: "Diff looks fine" });
  expect(anonymous).toEqual({ text: "Diff looks fine" });
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "mensaje recibido de otra sesión «Diff looks fine»" })).toBeDefined();
  const named = await $.session.receive({
    origin: { kind: "peer", teammate: "researcher", isVerified: true },
    text: "Found the route",
  });
  expect(named).toEqual({ text: "Found the route" });
  await p.redraw();
  expect(await p.find({ text: "researcher «Found the route»" })).toBeDefined();
  expect(await p.find({ text: "En grupo · 3 sesiones" })).toBeDefined();
});

test("the bridge receives only the session fields Agentic OS accepts", async ($, on) => {
  const posts: { url: string; body: Record<string, unknown> }[] = [];
  on("http.fetch", (_, e) => {
    posts.push({ url: e.url, body: JSON.parse(String(e.init?.body ?? "{}")) });
    return { value: { status: 200, ok: true, headers: {}, text: "{}" } };
  });
  const s = publish(initialState("s1", start.cwd), {
    tasks: [
      { id: "f", title: "Feature", state: "running" },
      { id: "f1", title: "Step", state: "running", parent: "f" },
    ],
  });
  const w = world(
    on,
    s,
    { ...data, bridge: { ...data.bridge, state: "connected" } },
    {
      AOS_AGENT_ID: "agent-1",
    },
  );
  await $.session.start(start);
  await w.clock.settle();
  const body = posts.find((p) => p.url.endsWith("/api/workboard/session"))?.body;
  expect(body).toBeDefined();
  expect(Object.keys(body!).sort()).toEqual([
    "agents",
    "checks",
    "cwd",
    "decisions",
    "failure",
    "robin",
    "sessionId",
    "tasks",
    "ticket",
    "version",
    "working",
  ]);
  expect(body!.tasks).toEqual([
    { id: "f", title: "Feature", state: "running", dependsOn: [] },
    { id: "f1", title: "Step", state: "running", dependsOn: [] },
  ]);
  // Agentic OS still requires the array; it stays empty.
  expect(body!.decisions).toEqual([]);
});

test("a native envelope names its sender, and one partner on two channels counts once", async ($, on) => {
  on("http.fetch", () => ({ value: { status: 200, ok: true, headers: {}, text: "{}" } }));
  const snap = {
    ...data,
    bridge: {
      ...data.bridge,
      state: "connected",
      links: [
        {
          id: "aos:m:1",
          at: Date.now() - 5000,
          kind: "sent",
          peer: "t-b",
          harness: "claude",
          status: "delivered",
          source: "aos",
        },
      ],
      aliases: { "agentic-os-70": { id: "t-b", harness: "claude" } },
    },
  };
  const w = world(on, undefined, snap, { AOS_AGENT_ID: "t-a" });
  await $.session.start(start);
  await w.clock.settle();
  const r = await $.session.receive({
    origin: { kind: "peer" },
    text: '<cross-session-message from="uds:/tmp/cc-socks/4838.sock" from-name="agentic-os-70">\nHola A\n</cross-session-message>',
  });
  expect(r.text).toContain("Hola A");
  const p = await $.ui.mount(pane);
  // Agentic OS has no title for the new terminal yet: the native name labels both channels.
  expect(await p.find({ text: "De tú a tú · claude · agentic-os-70" })).toBeDefined();
  expect(await p.find({ text: "agentic-os-70 «Hola A»" })).toBeDefined();
  expect(await p.find({ text: "t-b" })).toBeUndefined();
  expect(await p.find({ text: "En grupo" })).toBeUndefined();
});

test("/workboard toggles the pane, one call opens an unplaced one, and Actualizar says how it went", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await w.clock.settle();
  const p = await $.ui.mount(pane);
  const toggle = () =>
    $.command.run({
      command: "workboard",
      args: "",
      origin: { kind: "composer" },
      presentation: { isFullscreen: true, columns: 160 },
    });
  await toggle();
  expect(w.isShown()).toBe(false);
  await toggle();
  expect(w.isShown()).toBe(true);
  // Shown but without room to be placed: the person sees nothing, so one call opens it.
  w.placement(false);
  const opened = w.opens.length;
  await toggle();
  expect(w.isShown()).toBe(true);
  expect(w.opens).toHaveLength(opened + 1);
  w.placement(true);
  await p.press({ key: "workboard-refresh" });
  await w.clock.settle();
  expect(w.toasts).toContain("Actualizado");
});

test("Cambios lists every repo with its CI, PR, attribution and coverage, and caps the files", async ($, on) => {
  const many = Array.from({ length: 103 }, (_, i) => ({
    path: `f${i}.ts`,
    lines: [1],
    kind: "changed",
    staged: false,
    unstaged: true,
  }));
  const snap = {
    ...data,
    repos: [
      {
        ...data.repos[0],
        files: [
          { path: "a.ts", lines: [1], kind: "changed", staged: true, unstaged: false },
          { path: "b.ts", lines: [2], kind: "added", staged: false, unstaged: true },
        ],
        pr: {
          state: "loaded",
          number: 7,
          url: "https://github.com/o/r/pull/7",
          head: "abcdef1234",
          approval: "aprobada",
          appliesToLocal: true,
          checks: [
            { name: "build", state: "SUCCESS" },
            { name: "e2e", state: "FAILURE" },
          ],
        },
        coverage: {
          state: "ready",
          coverage: { percent: 80, files: [{ path: "a.ts", percent: 50, filePercent: 75 }] },
          baseline: [{ path: "a.ts", percent: 70 }],
        },
        canRecalculate: true,
      },
      { cwd: "/work/api", files: many, branch: "main", pr: { state: "none" }, coverage: { state: "missing" } },
      {
        cwd: "/work/web",
        files: [],
        branch: "dev",
        pr: { state: "none" },
        coverage: { state: "missing" },
        baseError: "no base",
        error: "git exploded",
      },
    ],
  };
  const w = world(on, undefined, snap);
  await $.session.start(start);
  await w.clock.settle();
  await $.tool.call({ tool: "Edit", tool_use_id: "e1", file_path: "/work/project/a.ts" } as never);
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "work/api · main · 103 cambios" })).toBeDefined();
  expect(await p.find({ text: "work/web · dev · 0 cambios" })).toBeDefined();
  expect(await p.find({ text: "CI: 1 fallos" })).toBeDefined();
  expect(await p.find({ text: "Base no disponible; se muestran cambios locales" })).toBeDefined();
  expect(await p.find({ text: "git exploded" })).toBeDefined();
  expect(await p.find({ type: "Link", text: "PR #7 · abcdef12" })).toBeDefined();
  await p.press({ key: "changes-files" });
  expect(await p.find({ text: "CI: e2e · FAILURE" })).toBeDefined();
  expect(await p.find({ text: "fichero 70.0% → 75.0%" })).toBeDefined();
  expect(await p.find({ text: "changed · edición observada" })).toBeDefined();
  // Files there at the first snapshot predate the session; another repo's are unknown.
  expect(await p.find({ text: "added · preexistente" })).toBeDefined();
  expect(await p.find({ text: "f0.ts" })).toBeDefined();
  expect(await p.find({ text: "changed · atribución desconocida" })).toBeDefined();
  expect(await p.find({ text: "f99.ts" })).toBeDefined();
  expect(await p.find({ text: "f100.ts" })).toBeUndefined();
  expect(await p.find({ text: "3 ficheros más; consulta Git para el detalle completo" })).toBeDefined();
  expect(await p.find({ type: "Button", text: "Recalcular cobertura" })).toBeDefined();
  expect(await p.find({ type: "Button", text: "Configurar cobertura: /workboard-config" })).toBeDefined();
});

test("subagents show how they ran, and their messages stay inside this session", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await w.clock.settle();
  w.agents.push(
    { id: "a1", description: "Find the routes", type: "Explore", status: "completed" },
    { id: "a2", description: "Check the docs", type: "Explore", status: "running", name: "scout" },
  );
  w.agentAnswers({ status: "async_launched", agentId: "a1", description: "Find the routes", prompt: "x", outputFile: "/tmp/a1" });
  await $.tool.call({
    tool: "Agent",
    description: "Find the routes",
    prompt: "Find the routes",
    subagent_type: "Explore",
    model: "haiku",
    effort: "medium",
    tool_use_id: "t1",
  });
  // The background agent's run ends: its time, tokens and model come with its turn.
  const usage = { input_tokens: 2000, output_tokens: 400, cache_read_input_tokens: 10000, cache_creation_input_tokens: 0 };
  await $.turn.complete({
    answer: "done",
    durationMs: 40000,
    isAborted: false,
    turnId: "ta1",
    reason: "answer",
    agentId: "a1",
    usage: { ...usage, model: "claude-haiku-5-5" },
  });
  // An engine fork no agent list names is not drawn.
  await $.turn.complete({ answer: "x", durationMs: 1, isAborted: false, turnId: "tf", reason: "answer", agentId: "fork-1" });
  await $.agent.spawn({
    prompt: "Check the docs",
    description: "Check the docs",
    subagentType: "Explore",
    tool_use_id: "t2",
    provider: { plugin: "engine", tier: "core" },
    parentModel: "claude-opus-5-5",
    background: true,
    fork: false,
  });
  await $.session.send({ to: "scout", text: "Look in docs/ too", origin: { kind: "model" } });
  await $.session.send({ to: "team-lead", text: "Docs say v2", origin: { kind: "model" }, agentId: "a2" });
  const echo = await $.session.receive({ origin: { kind: "peer" }, text: "Docs say v2" });
  expect(echo).toEqual({ text: "Docs say v2" });
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "Dirige 2" })).toBeDefined();
  expect(await p.find({ text: "haiku 5.5 · medium · 12K tok · 40 s" })).toBeDefined();
  expect(await p.find({ text: "sonnet 5.5" })).toBeDefined();
  expect(await p.find({ text: "espera respuesta" })).toBeDefined();
  expect(await p.find({ text: "→ principal «Docs say v2»" })).toBeDefined();
  expect(await p.find({ text: "scout → principal «Docs say v2»" })).toBeDefined();
  expect(await p.find({ text: "principal → scout «Look in docs/ too»" })).toBeDefined();
  expect(await p.find({ text: "Conversa con" })).toBeUndefined();
  expect(await p.find({ text: "mensaje recibido de otra sesión «Docs say v2»" })).toBeUndefined();
  // No placeholder row: "agente" alone, not inside "Subagentes".
  expect((await p.find({ text: "WORKBOARD" }))?.text).not.toMatch(/(?<!Sub)agente(?!s)/);
  // An agent's empty message never swallows the next real delivery from another session.
  await $.session.send({ to: "team-lead", text: "", origin: { kind: "model" }, agentId: "a2" });
  await $.session.receive({ origin: { kind: "peer" }, text: "Unrelated note" });
  await p.redraw();
  expect(await p.find({ text: "mensaje recibido de otra sesión «Unrelated note»" })).toBeDefined();
});

test("the Agents card splits partners into four ranked sections", async ($, on) => {
  const w = world(on);
  w.agents.push(
    { id: "a1", description: "Map the card", type: "Explore", status: "running" },
    { id: "t1", description: "Scout the API", type: "teammate", status: "running", teammateId: "scout@crew", name: "scout" },
  );
  await $.session.start(start);
  await w.clock.settle();
  await $.session.receive({ origin: { kind: "peer" }, text: '<cross-session-message from="uds:x" from-name="mate">\nSame repo\n</cross-session-message>' });
  await $.session.receive({ origin: { kind: "peer", teammate: "scout" }, text: "API mapped" });
  const p = await $.ui.mount(pane);
  await w.clock.settle();
  expect(await p.find({ text: "● Subagentes" })).toBeDefined();
  expect(await p.find({ text: "Explore · Map the card" })).toBeDefined();
  expect(await p.find({ text: "● Coworkers" })).toBeDefined();
  expect(await p.find({ text: "● Subordinados" })).toBeDefined();
  expect(await p.find({ text: "teammate · Scout the API" })).toBeDefined();
  expect(await p.find({ text: "● Orquestador" })).toBeUndefined();
  // The led teammate's message keeps it in Subordinados: one coworker, so a pair.
  expect(await p.find({ text: "De tú a tú · mate" })).toBeDefined();
  await $.session.receive({ origin: { kind: "coordinator", teammate: "lead" }, text: "Take the docs" });
  await p.redraw();
  expect(await p.find({ text: "● Orquestador" })).toBeDefined();
  expect(await p.find({ text: "A las órdenes de lead" })).toBeDefined();
});

test("a coordinator's hand-off as a prompt names an unnamed orchestrator", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await w.clock.settle();
  // A coworker's message just before never hides the hand-off.
  await $.session.receive({ origin: { kind: "peer", teammate: "mate" }, text: "Hi" });
  const submitted = $.prompt.submit({ text: "Review the schema", origin: { kind: "coordinator" } } as never);
  await w.clock.settle();
  w.release();
  await submitted;
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "● Orquestador" })).toBeDefined();
  expect(await p.find({ text: "A las órdenes de sesión coordinadora" })).toBeDefined();
});

test("the prompt router shows under Subagentes and turns followed when its skill loads", async ($, on) => {
  const snap = {
    ...data,
    router: { at: Date.now() - 10000, ms: 5141, outcome: "ok", skills: ["dev-workflow"], fixes: 0 },
  };
  const w = world(on, undefined, snap);
  await $.session.start(start);
  await w.clock.settle();
  const p = await $.ui.mount(pane);
  expect(await p.find({ text: "● Subagentes" })).toBeDefined();
  expect(await p.find({ text: "router · dev-workflow" })).toBeDefined();
  expect(await p.find({ text: "Sin otras sesiones · router" })).toBeDefined();
  expect(await p.find({ text: "no seguida" })).toBeDefined();
  await $.tool.call({ tool: "Skill", skill: "dev-workflow", tool_use_id: "s1" } as never);
  await p.redraw();
  expect(await p.find({ text: "seguida" })).toBeDefined();
  expect(await p.find({ text: "no seguida" })).toBeUndefined();
});
