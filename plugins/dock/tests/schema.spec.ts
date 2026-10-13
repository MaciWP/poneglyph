import { expect, test } from "bun:test";
import { CAPS, target, validate } from "../hooks/schema.ts";

const error = (input: unknown) => {
  const r = validate(input);
  return r.ok ? "ok" : r.error;
};

test("every kind comes through as sent, and a terminal defaults to a shell", () => {
  const items = [
    { label: "Abrir", kind: "file", path: "/repo/a.ts", line: 12 },
    { label: "Carpeta", kind: "folder", path: "/repo" },
    { label: "Claude", kind: "terminal", cwd: "/repo", harness: "claude", prompt: "Revisa a.ts" },
    { label: "Docs", kind: "url", href: "https://example.com/x" },
    { label: "Finder", kind: "finder", path: "/repo/a.ts" },
  ];
  expect(validate({ title: "Siguiente", items })).toEqual({ ok: true, panel: { title: "Siguiente", items: items as never } });
  expect(validate({ items: [{ label: "Shell", kind: "terminal", cwd: "/repo" }] })).toEqual({
    ok: true,
    panel: { items: [{ label: "Shell", kind: "terminal", cwd: "/repo", harness: "shell" }] },
  });
});

test("paths, URLs and prompts that could reach a command are refused with the field to fix", () => {
  expect(error({ items: [{ label: "x", kind: "file", path: "repo/a.ts" }] })).toBe("items[0].path must be an absolute path without .. segments");
  expect(error({ items: [{ label: "x", kind: "file", path: "/repo/../etc/passwd" }] })).toBe("items[0].path must be an absolute path without .. segments");
  expect(error({ items: [{ label: "x", kind: "url", href: "file:///etc/passwd" }] })).toBe("items[0].href must be an http or https URL");
  expect(error({ items: [{ label: "x", kind: "url", href: "javascript:alert(1)" }] })).toBe("items[0].href must be an http or https URL");
  expect(error({ items: [{ label: "x", kind: "terminal", cwd: "/r", harness: "bash" }] })).toBe("items[0].harness must be shell, claude, codex or grok");
  expect(error({ items: [{ label: "x", kind: "terminal", cwd: "/r", prompt: "ls" }] })).toBe("items[0].prompt needs an agent harness; a shell takes none");
  expect(error({ items: [{ label: "x", kind: "file", path: "/r", line: 0 }] })).toBe("items[0].line must be a whole number from 1");
  // The prompt is drawn whole before the press, so it stays short.
  expect(error({ items: [{ label: "x", kind: "terminal", cwd: "/r", harness: "claude", prompt: "a".repeat(501) }] })).toBe("items[0].prompt has 501 characters; keep it to 500");
});

test("the shape is checked: kinds, fields per kind and the item count", () => {
  expect(error({ items: [] })).toBe(`items has 0 entries; send 1 to ${CAPS.items}`);
  expect(error({ items: Array(CAPS.items + 1).fill({ label: "x", kind: "url", href: "https://a.b" }) })).toBe(`items has ${CAPS.items + 1} entries; send 1 to ${CAPS.items}`);
  expect(error({ items: [{ label: "x", kind: "run", path: "/r" }] })).toBe("items[0].kind must be file, folder, terminal, url or finder");
  expect(error({ items: [{ label: "x", kind: "url", href: "https://a.b", path: "/r" }] })).toBe("items[0].path is not a field here; allowed: label, kind, href");
  expect(error({ items: [{ kind: "url", href: "https://a.b" }] })).toBe("items[0].label must be a non-empty string");
  expect(error({ title: "t", items: [{ label: "x", kind: "url", href: "https://a.b" }], kind: "x" })).toBe("kind is not a field here; allowed: title, items");
});

test("the target names what a press opens, for every kind", () => {
  expect(target({ kind: "file", label: "a", path: "/r/a.ts", line: 3 })).toBe("fichero /r/a.ts:3");
  expect(target({ kind: "folder", label: "a", path: "/r" })).toBe("carpeta /r");
  expect(target({ kind: "finder", label: "a", path: "/r/a.ts" })).toBe("Finder /r/a.ts");
  expect(target({ kind: "url", label: "a", href: "https://x.y/z" })).toBe("https://x.y/z");
  expect(target({ kind: "terminal", label: "a", cwd: "/r", harness: "shell" })).toBe("shell en /r");
  expect(target({ kind: "terminal", label: "a", cwd: "/r", harness: "codex", prompt: "hola" })).toBe("codex en /r · «hola»");
});

test("a prompt that would reach argv as a flag is refused", () => {
  const terminal = (extra: object) => ({ items: [{ label: "x", kind: "terminal", cwd: "/r", harness: "claude", ...extra }] });
  expect(error(terminal({ prompt: "--dangerously-skip-permissions" }))).toBe('items[0].prompt must not start with "-"; begin with a word');
  expect(error(terminal({ prompt: "  -p hola" }))).toBe('items[0].prompt must not start with "-"; begin with a word');
  expect(error(terminal({ prompt: "revisa -p" }))).toBe("ok");
});

test("control and bidirectional characters are refused in prompt, cwd and href", () => {
  const msg = "must not hold control or bidirectional characters";
  expect(error({ items: [{ label: "x", kind: "terminal", cwd: "/r", harness: "claude", prompt: "hola‮adios" }] })).toContain(msg);
  expect(error({ items: [{ label: "x", kind: "terminal", cwd: "/r\u001b[31m" }] })).toContain(msg);
  expect(error({ items: [{ label: "x", kind: "url", href: "https://a.com/⁦" }] })).toContain(msg);
  expect(error({ items: [{ label: "x", kind: "terminal", cwd: "/r", harness: "claude", prompt: "uno\ndos" }] })).toBe("ok");
});
