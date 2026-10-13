import type { Action } from "./schema.ts";

// What a press needs from the engine, narrow so the tests fake it without one.
export type Host = {
  fetch: (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; ok: boolean; text: string }>;
  run: (argv: string[]) => Promise<{ exitCode: number; stderr: string }>;
  // What the path is, null when it does not exist.
  kind: (path: string) => Promise<"file" | "dir" | "other" | null>;
  sleep: (ms: number) => Promise<void>;
  // AOS_URL, DOCK_EDITOR and DOCK_TERMINAL, read when the button is pressed.
  config: { aosUrl?: string; editor?: string; terminal?: string };
};
export type Outcome = { ok: true; via: string } | { ok: false; error: string };

type Location = { id: string; cwd: string };
type Aos = { base: string; locations: Location[] };

const AOS_URL = "http://localhost:4317";
const PROBE_MS = 800;
// As workboard.mjs: a press never waits on a stuck Agentic OS for longer.
const POST_MS = 8000;

// Only a loopback origin is taken, as hud and workboard do: a press never reaches elsewhere.
function loopback(url: string): string | null {
  try {
    const u = new URL(url);
    const local = ["127.0.0.1", "localhost", "agentic-os.localhost", "[::1]"].includes(u.hostname);
    if (u.protocol !== "http:" || !local || u.username || u.password || u.pathname !== "/" || u.search || u.hash) return null;
    return u.origin;
  } catch {
    return null;
  }
}

// Agentic OS when it answers now, null otherwise: asked on every press, because it is started
// and stopped during a session. Its terminal list carries the places it may open.
export async function probe(h: Host): Promise<Aos | null> {
  const base = loopback(h.config.aosUrl ?? AOS_URL);
  if (!base) return null;
  try {
    const r = await Promise.race([h.fetch(`${base}/api/terminals`), h.sleep(PROBE_MS).then(() => null)]);
    if (!r?.ok) return null;
    const data = JSON.parse(r.text) as { locations?: unknown };
    const locations = Array.isArray(data.locations)
      ? data.locations.filter((l): l is Location => typeof l?.id === "string" && typeof l?.cwd === "string" && l.cwd.startsWith("/"))
      : [];
    return { base, locations };
  } catch {
    return null;
  }
}

// The place with the longest folder that holds `path`, and `path` relative to it.
// ponytail: plain prefix match, no realpath; a symlinked path falls to the generic action.
export function locate(locations: Location[], path: string): { id: string; rel: string } | null {
  let best: Location | undefined;
  for (const l of locations) {
    const cwd = l.cwd.replace(/\/+$/, "");
    if ((path === cwd || path.startsWith(`${cwd}/`)) && cwd.length > (best?.cwd.length ?? -1)) best = { ...l, cwd };
  }
  return best ? { id: best.id, rel: path.slice(best.cwd.length + 1) } : null;
}

// Agentic OS's local guard wants its own Origin and JSON on every write.
// The host's fetch takes no AbortSignal, so the wait is raced against a timer.
const post = (h: Host, base: string, route: string, body: object) =>
  Promise.race([
    h.fetch(`${base}${route}`, {
      method: "POST",
      headers: { Origin: new URL(base).origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    h.sleep(POST_MS).then(() => Promise.reject(new Error("timeout"))),
  ]);

// Done there, or why not: a refusal is said next to the local app that opened instead, so a
// broken Agentic OS route never passes for a working one. Null: the path is none of its places.
async function viaAos(h: Host, aos: Aos, a: Action): Promise<Outcome | string | null> {
  if (a.kind === "terminal") {
    const at = locate(aos.locations, a.cwd);
    if (!at) return null;
    const r = await post(h, aos.base, "/api/terminals", { harness: a.harness, location: at.id, ...(a.prompt ? { prompt: a.prompt } : {}) });
    return r.ok ? { ok: true, via: `Agentic OS · ${at.id}` } : `AOS ${r.status}`;
  }
  if (a.kind === "file") {
    const at = locate(aos.locations, a.path);
    if (!at?.rel) return null;
    const r = await post(h, aos.base, "/api/code/reveal", { location: at.id, path: at.rel, ...(a.line ? { line: a.line } : {}) });
    if (!r.ok) return `AOS ${r.status}`;
    // No dashboard open to take it: opening one picks the pending file up as it loads.
    // A 2xx with no JSON body still counts as done; the dashboard is just not opened.
    let delivered: boolean | undefined;
    try {
      delivered = (JSON.parse(r.text) as { delivered?: boolean }).delivered;
    } catch {}
    if (!delivered) await h.run(["open", aos.base]);
    return { ok: true, via: `Agentic OS · ${at.id}` };
  }
  return null;
}

// Terminal.app runs the agent in a new window; the folder and the prompt reach the script as
// argv and are quoted there, so nothing the model sent is read as a command.
const AGENT_SCRIPT = [
  "on run argv",
  'set cmd to "cd " & quoted form of item 1 of argv & " && " & item 2 of argv',
  'if (count of argv) > 2 then set cmd to cmd & " " & quoted form of item 3 of argv',
  'tell application "Terminal"',
  "activate",
  "do script cmd",
  "end tell",
  "end run",
].flatMap((line) => ["-e", line]);

function argvFor(h: Host, a: Action): { argv: string[]; via: string } {
  const editor = h.config.editor ?? "PyCharm";
  const terminal = h.config.terminal ?? "Terminal";
  switch (a.kind) {
    // `open -na <app> --args` hands the arguments to the running IDE, the JetBrains way.
    // ponytail: `--line` is JetBrains syntax; another editor gets the path alone.
    case "file":
      return { argv: ["open", "-na", editor, "--args", ...(a.line && /pycharm|idea|webstorm|goland|rider|clion|rubymine|phpstorm/i.test(editor) ? ["--line", String(a.line)] : []), a.path], via: editor };
    case "folder":
      return { argv: ["open", "-na", editor, "--args", a.path], via: editor };
    case "terminal":
      return a.harness === "shell"
        ? { argv: ["open", "-a", terminal, a.cwd], via: terminal }
        : { argv: ["osascript", ...AGENT_SCRIPT, a.cwd, a.harness, ...(a.prompt ? [a.prompt] : [])], via: "Terminal" };
    case "url":
      return { argv: ["open", a.href], via: "navegador" };
    case "finder":
      return { argv: ["open", "-R", a.path], via: "Finder" };
  }
}

// The path and what it must be. A terminal's folder must be one: Terminal.app runs a file it
// is handed as a script, so a "Shell" button on a .command file would run it.
function target(a: Action): { path: string; want: "file" | "dir" | "any" } | null {
  if (a.kind === "terminal") return { path: a.cwd, want: "dir" };
  if (a.kind === "folder") return { path: a.path, want: "dir" };
  if (a.kind === "file") return { path: a.path, want: "file" };
  if (a.kind === "finder") return { path: a.path, want: "any" };
  return null;
}

export async function perform(h: Host, a: Action): Promise<Outcome> {
  try {
    const t = target(a);
    if (t) {
      const kind = await h.kind(t.path);
      if (!kind) return { ok: false, error: `No existe ${t.path}` };
      if (t.want !== "any" && kind !== t.want) return { ok: false, error: `${t.path} no es ${t.want === "dir" ? "una carpeta" : "un fichero"}` };
    }
    const aos = a.kind === "terminal" || a.kind === "file" ? await probe(h) : null;
    const done = aos ? await viaAos(h, aos, a).catch((err) => `AOS ${err instanceof Error ? err.message : "error"}`) : null;
    if (done && typeof done === "object") return done;
    const { argv, via } = argvFor(h, a);
    const r = await h.run(argv);
    return r.exitCode === 0 ? { ok: true, via: done ? `${via} (${done})` : via } : { ok: false, error: r.stderr.trim().split("\n")[0] || `${argv[0]} salió con ${r.exitCode}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
