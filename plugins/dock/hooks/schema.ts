// What the model may send to actions: a short row of buttons, each one local action of a
// fixed kind. The model reads every error, so each one names the field and how to fix it.

export type Harness = "shell" | "claude" | "codex" | "grok";
export type Action =
  | { kind: "file"; label: string; path: string; line?: number }
  | { kind: "folder"; label: string; path: string }
  | { kind: "terminal"; label: string; cwd: string; harness: Harness; prompt?: string }
  | { kind: "url"; label: string; href: string }
  | { kind: "finder"; label: string; path: string };
export type Panel = { title?: string; items: Action[] };

export const CAPS = { items: 6 } as const;
// The prompt stays short: the button shows it whole before it is pressed.
const LEN = { title: 80, label: 28, path: 1024, href: 2048, prompt: 500 };
const HARNESSES: Harness[] = ["shell", "claude", "codex", "grok"];

const str = (maxLength: number, description?: string) => ({ type: "string", minLength: 1, maxLength, ...(description ? { description } : {}) });

// Flat on purpose: one item object whose fields depend on kind, so no oneOf.
export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: str(LEN.title),
    items: {
      type: "array",
      minItems: 1,
      maxItems: CAPS.items,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "kind"],
        properties: {
          label: str(LEN.label, "button text, a few words"),
          kind: { enum: ["file", "folder", "terminal", "url", "finder"] },
          path: str(LEN.path, "file, folder, finder: absolute local path"),
          line: { type: "integer", minimum: 1, description: "file: line to open at" },
          cwd: str(LEN.path, "terminal: absolute folder it starts in"),
          harness: { enum: HARNESSES, description: "terminal: shell (default), claude, codex or grok" },
          prompt: str(LEN.prompt, "terminal with an agent harness: first message"),
          href: str(LEN.href, "url: http or https"),
        },
      },
    },
  },
  required: ["items"],
} as const;

const FIELDS: Record<Action["kind"], string[]> = {
  file: ["label", "kind", "path", "line"],
  folder: ["label", "kind", "path"],
  terminal: ["label", "kind", "cwd", "harness", "prompt"],
  url: ["label", "kind", "href"],
  finder: ["label", "kind", "path"],
};

type Result = { ok: true; panel: Panel } | { ok: false; error: string };

class Invalid extends Error {}
const fail = (msg: string): never => {
  throw new Invalid(msg);
};
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function text(v: unknown, at: string, max: number, optional = false): string | undefined {
  if (v === undefined && optional) return undefined;
  if (typeof v !== "string" || !v.trim()) return fail(`${at} must be a non-empty string`);
  if (v.length > max) return fail(`${at} has ${v.length} characters; keep it to ${max}`);
  return v;
}

function only(o: Record<string, unknown>, at: string, keys: string[]) {
  const extra = Object.keys(o).find((k) => !keys.includes(k));
  if (extra) fail(`${at}${extra} is not a field here; allowed: ${keys.join(", ")}`);
}

// Absolute, with no NUL and no `..` segment: the path reaches argv as it is.
function path(v: unknown, at: string): string {
  const p = text(v, at, LEN.path) as string;
  if (!p.startsWith("/") || p.includes("\0") || p.split("/").includes("..")) fail(`${at} must be an absolute path without .. segments`);
  return p;
}

function item(v: unknown, i: number): Action {
  const at = `items[${i}]`;
  if (!isObject(v)) return fail(`${at} must be an object with label and kind`);
  const kind = v.kind;
  if (typeof kind !== "string" || !(kind in FIELDS)) return fail(`${at}.kind must be file, folder, terminal, url or finder`);
  only(v, `${at}.`, FIELDS[kind as Action["kind"]]);
  const label = text(v.label, `${at}.label`, LEN.label) as string;
  if (kind === "file") {
    const line = v.line;
    if (line !== undefined && (!Number.isInteger(line) || (line as number) < 1)) fail(`${at}.line must be a whole number from 1`);
    return { kind, label, path: path(v.path, `${at}.path`), ...(line === undefined ? {} : { line: line as number }) };
  }
  if (kind === "folder" || kind === "finder") return { kind, label, path: path(v.path, `${at}.path`) };
  if (kind === "url") {
    const href = text(v.href, `${at}.href`, LEN.href) as string;
    let protocol = "";
    try {
      protocol = new URL(href).protocol;
    } catch {}
    if (protocol !== "http:" && protocol !== "https:") fail(`${at}.href must be an http or https URL`);
    return { kind, label, href };
  }
  const harness = (v.harness ?? "shell") as Harness;
  if (!HARNESSES.includes(harness)) fail(`${at}.harness must be shell, claude, codex or grok`);
  const prompt = text(v.prompt, `${at}.prompt`, LEN.prompt, true);
  if (prompt && harness === "shell") fail(`${at}.prompt needs an agent harness; a shell takes none`);
  return { kind: "terminal", label, cwd: path(v.cwd, `${at}.cwd`), harness, ...(prompt ? { prompt } : {}) };
}

// What a press will do, drawn under the buttons before any press: a press is consent only
// when the person sees where it goes, not just the label the model chose.
export function target(a: Action): string {
  if (a.kind === "file") return `fichero ${a.path}${a.line ? `:${a.line}` : ""}`;
  if (a.kind === "folder") return `carpeta ${a.path}`;
  if (a.kind === "finder") return `Finder ${a.path}`;
  if (a.kind === "url") return a.href;
  return `${a.harness} en ${a.cwd}${a.prompt ? ` · «${a.prompt}»` : ""}`;
}

export function validate(input: unknown): Result {
  try {
    if (!isObject(input)) return fail("send an object with items");
    only(input, "", ["title", "items"]);
    const title = text(input.title, "title", LEN.title, true);
    const raw = input.items;
    if (!Array.isArray(raw)) return fail("items must be an array");
    if (raw.length < 1 || raw.length > CAPS.items) return fail(`items has ${raw.length} entries; send 1 to ${CAPS.items}`);
    return { ok: true, panel: { ...(title ? { title } : {}), items: raw.map(item) } };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, error: err.message };
    throw err;
  }
}
