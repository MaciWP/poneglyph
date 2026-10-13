import { test, expect, mock } from "claude-code/testing";
import type { On } from "claude-code";

const TOOL = "mcp__dock__actions";
const start = { cwd: "/work/project", surface: "terminal" as const, isInteractive: true };
const viewport = { columns: 100, rows: 40, isFullscreen: true };

const panel = {
  title: "Siguiente paso",
  items: [
    { label: "Abrir app.ts", kind: "file", path: "/r/poneglyph/app.ts", line: 4 },
    { label: "Shell", kind: "terminal", cwd: "/r/poneglyph" },
  ],
};

function toolUse(id: string, input: object, state: Partial<{ isRunning: boolean; isErrored: boolean; isInterrupted: boolean }> = {}) {
  return {
    plugin: "dock",
    surface: "terminal" as const,
    component: "ToolUse" as const,
    requestId: id,
    viewport,
    props: { tool_use_id: id, tool: TOOL, input, isRunning: false, isErrored: false, isInterrupted: false, output: undefined, onScreen: null, ...state },
  } as never;
}

// Agentic OS down unless `aos` is set; every command exits 0 unless `fail` names it.
function world(on: On, opts: { aos?: boolean; fail?: string; os?: string } = {}) {
  const clock = mock.clock(on, { now: Date.parse("2026-10-13T10:00:00Z") });
  mock.env(on, {});
  const runs: string[][] = [];
  const posts: { url: string; body: unknown }[] = [];
  const toasts: string[] = [];
  const tools: { name: string; description: string }[] = [];
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("tool.register", (_, e) => {
    tools.push(e);
    return { value: { tool: TOOL } };
  });
  on("ui.toast", (_, e) => {
    toasts.push(e.text);
    return { value: undefined };
  });
  on("fs.stat", (_, e) => ({ value: { kind: /\.[^/]+$/.test(e.path) ? "file" : "dir", size: 1, mtimeMs: 0, isLink: false } }));
  on("http.fetch", (_, e) => {
    if (!opts.aos) throw new Error("ECONNREFUSED");
    if (e.init?.method === "POST") {
      posts.push({ url: e.url, body: JSON.parse(String(e.init.body)) });
      return { value: { status: 201, ok: true, headers: {}, text: "{}" } };
    }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ locations: [{ id: "repo:poneglyph", cwd: "/r/poneglyph" }] }) } };
  });
  on("process.run", (_, e) => {
    if (e.argv[0] === "uname") return { value: { exitCode: 0, stdout: `${opts.os ?? "Darwin"}\n`, stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
    runs.push([...e.argv]);
    const failed = opts.fail !== undefined && e.argv.includes(opts.fail);
    return { value: { exitCode: failed ? 1 : 0, stdout: "", stderr: failed ? "Unable to find application" : "", isStdoutTruncated: false, isStderrTruncated: false } };
  });
  on("ui.render", ($, e) => $.ui.resolve(e).Text({ children: `Original ${e.component}` }));
  return { clock, runs, posts, toasts, tools };
}

test("actions registers in a terminal session with its schema in the prompt and a context line", async ($, on) => {
  const w = world(on);
  let context: string[] = [];
  on("prompt.submit", (_, e) => {
    context = [...(e.context ?? [])];
    return { text: e.text };
  });
  on("tool.describe", (_, e) => ({ description: e.description, isDeferred: true }));
  await $.session.start(start);
  expect(w.tools[0]?.name).toBe("actions");
  expect(w.tools[0]?.description.split(/\s+/).length).toBeLessThan(120);
  await $.prompt.submit({ text: "¿dónde está el fallo?", origin: { kind: "composer" } } as never);
  expect(context.at(-1)).toContain(TOOL);
  const described = await $.tool.describe({ tool: TOOL, description: "d", isDeferred: true, provider: { plugin: "dock", tier: "user" } });
  expect(described.isDeferred).toBe(false);
});

test("a desktop or headless session gets neither the tool nor the context line", async ($, on) => {
  const w = world(on);
  let context: string[] = [];
  on("prompt.submit", (_, e) => {
    context = [...(e.context ?? [])];
    return { text: e.text };
  });
  await $.session.start({ ...start, surface: "desktop" });
  await $.session.start({ ...start, isInteractive: false });
  expect(w.tools).toHaveLength(0);
  await $.prompt.submit({ text: "hola", origin: { kind: "composer" } } as never);
  expect(context.some((c) => c.includes("dock"))).toBe(false);
});

test("outside macOS the tool is not registered, since open and osascript are macOS's", async ($, on) => {
  const w = world(on, { os: "Linux" });
  await $.session.start(start);
  expect(w.tools).toHaveLength(0);
});

test("a malformed call goes back to the model with the field to fix", async ($, on) => {
  world(on);
  await $.session.start(start);
  expect(await $.tool.call({ tool: TOOL, tool_use_id: "t1", ...panel } as never)).toEqual({ result: "Buttons shown to the user. Add at most one sentence; do not list them again." });
  const bad = await $.tool.call({ tool: TOOL, tool_use_id: "t2", items: [{ label: "x", kind: "url", href: "file:///etc" }] } as never);
  expect(bad).toEqual({ result: "Not shown: items[0].href must be an http or https URL. Fix it and call again, or name the paths in text.", isError: true });
});

test("the buttons draw from a finished call, and a press runs the local app and says which", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  for (const [i, state] of [{ isRunning: true }, { isErrored: true }, { isInterrupted: true }].entries()) {
    expect(await (await $.ui.mount(toolUse(`s${i}`, panel, state))).find({ text: "Original ToolUse" })).toBeDefined();
  }
  const row = await $.ui.mount(toolUse("t1", panel));
  expect(await row.find({ text: "Siguiente paso" })).toBeDefined();
  expect(await row.find({ type: "Button", text: "Abrir app.ts" })).toBeDefined();
  await row.press({ key: "dock-0" });
  await w.clock.settle();
  await row.redraw();
  expect(w.runs).toEqual([["open", "-na", "PyCharm", "--args", "--line", "4", "/r/poneglyph/app.ts"]]);
  expect(await row.find({ text: "Abrir app.ts → fichero /r/poneglyph/app.ts:4  ✓ PyCharm" })).toBeDefined();
});

test("with Agentic OS up a terminal opens there; a failing app shows the error and a toast", async ($, on) => {
  const up = world(on, { aos: true, fail: "PyCharm" });
  await $.session.start(start);
  const row = await $.ui.mount(toolUse("t2", panel));
  await row.press({ key: "dock-1" });
  await up.clock.settle();
  await row.redraw();
  expect(up.posts).toEqual([{ url: "http://localhost:4317/api/terminals", body: { harness: "shell", location: "repo:poneglyph" } }]);
  expect(await row.find({ text: "Shell → shell en /r/poneglyph  ✓ Agentic OS · repo:poneglyph" })).toBeDefined();
  // A folder always opens the local editor, even with Agentic OS up.
  const folder = await $.ui.mount(toolUse("t3", { items: [{ label: "Carpeta", kind: "folder", path: "/r/poneglyph" }] }));
  await folder.press({ key: "dock-0" });
  await up.clock.settle();
  await folder.redraw();
  expect(up.toasts).toEqual(["Unable to find application"]);
  expect(await folder.find({ text: "Carpeta → carpeta /r/poneglyph  ✗ Unable to find application" })).toBeDefined();
});

test("before any press each button shows whole where it goes, an agent's prompt included", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  const row = await $.ui.mount(
    toolUse("t4", {
      items: [
        { label: "Abrir terminal", kind: "terminal", cwd: "/r/poneglyph", harness: "claude", prompt: "borra la rama vieja" },
        { label: "Docs", kind: "url", href: "https://example.com/a?b=1" },
      ],
    }),
  );
  expect(await row.find({ text: "Abrir terminal → claude en /r/poneglyph · «borra la rama vieja»" })).toBeDefined();
  expect(await row.find({ text: "Docs → https://example.com/a?b=1" })).toBeDefined();
  expect(w.runs).toHaveLength(0);
});

test("the result row tells the person to press", async ($, on) => {
  world(on);
  await $.session.start(start);
  const result = await $.ui.mount({
    plugin: "dock",
    surface: "terminal",
    component: "ToolResult",
    requestId: "r1",
    viewport,
    props: { tool_use_id: "t1", tool: TOOL, output: "x", isErrored: false },
  } as never);
  expect(await result.find({ text: "  ⎿ pulsa un botón para abrirlo" })).toBeDefined();
});
