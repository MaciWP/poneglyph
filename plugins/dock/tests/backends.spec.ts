import { expect, test } from "bun:test";
import { type Host, locate, perform } from "../hooks/backends.ts";

const LOCATIONS = [
  { id: "app", label: "Agentic OS", cwd: "/r/agentic-os" },
  { id: "repo:poneglyph", label: "poneglyph", cwd: "/r/poneglyph" },
  { id: "repo:plugins", label: "plugins", cwd: "/r/poneglyph/plugins" },
];

type Call = { url: string; method?: string; headers?: Record<string, string>; body?: unknown };

// A machine: Agentic OS up or down, the routes it answers, the files that exist.
function machine(opts: { aos?: boolean; reveal?: number | { delivered: boolean }; create?: number; config?: Host["config"] } = {}) {
  const calls: Call[] = [];
  const runs: string[][] = [];
  const h: Host = {
    fetch: async (url, init) => {
      calls.push({ url, method: init?.method, headers: init?.headers, body: init?.body ? JSON.parse(init.body) : undefined });
      if (!opts.aos) throw new Error("ECONNREFUSED");
      if (url.endsWith("/api/terminals") && !init?.method) return { status: 200, ok: true, text: JSON.stringify({ terminals: [], locations: LOCATIONS }) };
      if (url.endsWith("/api/terminals")) {
        const status = opts.create ?? 201;
        return { status, ok: status < 300, text: "{}" };
      }
      if (url.endsWith("/api/code/reveal")) {
        const r = opts.reveal ?? 404;
        return typeof r === "number" ? { status: r, ok: r < 300, text: "{}" } : { status: 200, ok: true, text: JSON.stringify(r) };
      }
      return { status: 404, ok: false, text: "" };
    },
    run: async (argv) => {
      runs.push(argv);
      return { exitCode: 0, stderr: "" };
    },
    // A last segment with a dot is a file; anything else a folder.
    kind: async (p) => (p.includes("missing") ? null : /\.[^/]+$/.test(p) ? "file" : "dir"),
    config: opts.config ?? {},
    sleep: () => new Promise(() => {}),
  };
  return { h, calls, runs };
}

test("a path maps to the place with the longest folder that holds it", () => {
  expect(locate(LOCATIONS, "/r/poneglyph/plugins/dock/a.ts")).toEqual({ id: "repo:plugins", rel: "dock/a.ts" });
  expect(locate(LOCATIONS, "/r/poneglyph/README.md")).toEqual({ id: "repo:poneglyph", rel: "README.md" });
  expect(locate(LOCATIONS, "/r/poneglyph")).toEqual({ id: "repo:poneglyph", rel: "" });
  // A sibling that only shares the prefix is not inside.
  expect(locate(LOCATIONS, "/r/poneglyph-work/a.ts")).toBeNull();
});

test("with Agentic OS up, a terminal in a known place opens there with its guard headers", async () => {
  const m = machine({ aos: true });
  const r = await perform(m.h, { kind: "terminal", label: "Claude", cwd: "/r/poneglyph/x", harness: "claude", prompt: "hola" });
  expect(r).toEqual({ ok: true, via: "Agentic OS · repo:poneglyph" });
  expect(m.calls.at(-1)).toEqual({
    url: "http://localhost:4317/api/terminals",
    method: "POST",
    headers: { Origin: "http://localhost:4317", "Content-Type": "application/json" },
    body: { harness: "claude", location: "repo:poneglyph", prompt: "hola" },
  });
  expect(m.runs).toHaveLength(0);
});

test("with Agentic OS up, a file goes to its editor, and a closed dashboard is opened to take it", async () => {
  const shown = machine({ aos: true, reveal: { delivered: true } });
  expect(await perform(shown.h, { kind: "file", label: "a", path: "/r/agentic-os/server/app.ts", line: 9 })).toEqual({ ok: true, via: "Agentic OS · app" });
  expect(shown.calls.at(-1)?.body).toEqual({ location: "app", path: "server/app.ts", line: 9 });
  expect(shown.runs).toHaveLength(0);
  const closed = machine({ aos: true, reveal: { delivered: false }, config: { aosUrl: "http://agentic-os.localhost:4317/" } });
  await perform(closed.h, { kind: "file", label: "a", path: "/r/agentic-os/server/app.ts" });
  expect(closed.calls.at(-1)?.url).toBe("http://agentic-os.localhost:4317/api/code/reveal");
  expect(closed.runs).toEqual([["open", "http://agentic-os.localhost:4317"]]);
});

test("Agentic OS down, without the reveal route, or the path outside its places: the local app", async () => {
  const file = { kind: "file", label: "a", path: "/r/agentic-os/server/app.ts", line: 9 } as const;
  for (const [m, via] of [[machine(), "PyCharm"], [machine({ aos: true, reveal: 404 }), "PyCharm (AOS 404)"]] as const) {
    expect(await perform(m.h, file)).toEqual({ ok: true, via });
    expect(m.runs).toEqual([["open", "-na", "PyCharm", "--args", "--line", "9", "/r/agentic-os/server/app.ts"]]);
  }
  const outside = machine({ aos: true });
  expect(await perform(outside.h, { kind: "terminal", label: "s", cwd: "/tmp/x", harness: "shell" })).toEqual({ ok: true, via: "Terminal" });
  expect(outside.runs).toEqual([["open", "-a", "Terminal", "/tmp/x"]]);
  const refused = machine({ aos: true, create: 400 });
  // A refusal is named next to the app that opened instead.
  expect(await perform(refused.h, { kind: "terminal", label: "s", cwd: "/r/poneglyph", harness: "shell" })).toEqual({ ok: true, via: "Terminal (AOS 400)" });
  expect(refused.runs).toEqual([["open", "-a", "Terminal", "/r/poneglyph"]]);
});

test("generic actions pass every argument as argv, and the agent script quotes them itself", async () => {
  const m = machine({ config: { editor: "Visual Studio Code", terminal: "iTerm" } });
  await perform(m.h, { kind: "file", label: "a", path: "/r/a b.ts", line: 3 });
  await perform(m.h, { kind: "folder", label: "f", path: "/r" });
  await perform(m.h, { kind: "terminal", label: "s", cwd: "/r", harness: "shell" });
  await perform(m.h, { kind: "url", label: "u", href: "https://example.com/?q=1;rm -rf" });
  await perform(m.h, { kind: "finder", label: "f", path: "/r/a b.ts" });
  await perform(m.h, { kind: "terminal", label: "c", cwd: "/r/it's", harness: "codex", prompt: "$(whoami)" });
  expect(m.runs.slice(0, 5)).toEqual([
    ["open", "-na", "Visual Studio Code", "--args", "/r/a b.ts"],
    ["open", "-na", "Visual Studio Code", "--args", "/r"],
    ["open", "-a", "iTerm", "/r"],
    ["open", "https://example.com/?q=1;rm -rf"],
    ["open", "-R", "/r/a b.ts"],
  ]);
  const agent = m.runs[5] ?? [];
  expect(agent[0]).toBe("osascript");
  expect(agent.slice(-3)).toEqual(["/r/it's", "codex", "$(whoami)"]);
  expect(agent.join(" ")).toContain("quoted form of item 1 of argv");
  expect(agent.join(" ")).toContain("quoted form of item 3 of argv");
});

test("an AOS_URL that is not a loopback origin is never called: the local app opens", async () => {
  for (const AOS_URL of ["http://evil.example:4317", "https://localhost:4317", "http://localhost:4317/x"]) {
    const m = machine({ aos: true, config: { aosUrl: AOS_URL } });
    expect(await perform(m.h, { kind: "terminal", label: "s", cwd: "/r/poneglyph", harness: "shell" })).toEqual({ ok: true, via: "Terminal" });
    expect(m.calls).toHaveLength(0);
  }
});

test("a terminal or folder on a file is refused before anything runs: Terminal.app would run it", async () => {
  const m = machine({ aos: true });
  expect(await perform(m.h, { kind: "terminal", label: "Shell", cwd: "/r/poneglyph/x.command", harness: "shell" })).toEqual({ ok: false, error: "/r/poneglyph/x.command no es una carpeta" });
  expect(await perform(m.h, { kind: "folder", label: "f", path: "/r/x.sh" })).toEqual({ ok: false, error: "/r/x.sh no es una carpeta" });
  expect(await perform(m.h, { kind: "file", label: "f", path: "/r/poneglyph" })).toEqual({ ok: false, error: "/r/poneglyph no es un fichero" });
  expect(m.runs).toHaveLength(0);
  expect(m.calls).toHaveLength(0);
});

test("a missing path or a failing command comes back as an error, nothing run", async () => {
  const m = machine();
  expect(await perform(m.h, { kind: "file", label: "a", path: "/r/missing.ts" })).toEqual({ ok: false, error: "No existe /r/missing.ts" });
  expect(m.runs).toHaveLength(0);
  const failing = machine();
  failing.h.run = async () => ({ exitCode: 1, stderr: "Unable to find application named 'PyCharm'\nmore" });
  expect(await perform(failing.h, { kind: "folder", label: "f", path: "/r" })).toEqual({ ok: false, error: "Unable to find application named 'PyCharm'" });
});

test("a 2xx reveal with no JSON body counts as done, with no local fallback", async () => {
  const m = machine({ aos: true });
  const fetch = m.h.fetch;
  m.h.fetch = async (url, init) => (url.endsWith("/api/code/reveal") ? { status: 204, ok: true, text: "" } : fetch(url, init));
  const r = await perform(m.h, { kind: "file", label: "x", path: "/r/poneglyph/a.ts" });
  expect(r).toEqual({ ok: true, via: "Agentic OS · repo:poneglyph" });
  expect(m.runs.some((a) => a[0] === "open" && a[1] === "-na")).toBe(false);
});

test("a stuck Agentic OS write times out and falls back to the local app", async () => {
  const m = machine({ aos: true });
  const fetch = m.h.fetch;
  m.h.fetch = (url, init) => (init?.method === "POST" ? new Promise(() => {}) : fetch(url, init));
  m.h.sleep = (ms) => (ms >= 8000 ? Promise.resolve() : new Promise(() => {}));
  const r = await perform(m.h, { kind: "terminal", label: "x", cwd: "/r/poneglyph/x", harness: "claude" });
  expect(r).toEqual({ ok: true, via: "Terminal (AOS timeout)" });
});
