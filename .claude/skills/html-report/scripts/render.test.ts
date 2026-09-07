import { test, expect } from "bun:test";
import { render } from "./render.ts";
import type { ReportData } from "./contract.ts";

const data: ReportData = {
  meta: { title: "T", date: "2026-06-08" },
  sections: [
    { id: "a", title: "Alpha", blocks: [{ type: "prose", html: "<p>hello alpha</p>" }] },
    { id: "b", title: "Beta", blocks: [{ type: "prose", html: "<p>hello beta</p>" }] },
  ],
};

test("T3.1 — self-contained: one <style>, no external script", () => {
  const html = render(data);
  expect((html.match(/<style/g) || []).length).toBe(1);
  expect(html.includes("<!DOCTYPE html>")).toBe(true);
  expect(/<script\s+src=["']https?:/.test(html)).toBe(false);
  expect(html.includes('id="a"')).toBe(true);
  expect(html.includes('id="b"')).toBe(true);
});

test("T3.2 — fallback: content + anchor nav present in static markup", () => {
  const html = render(data);
  const noScript = html.replace(/<script[\s\S]*?<\/script>/g, "");
  expect(noScript.includes("hello alpha")).toBe(true);
  expect(noScript.includes("hello beta")).toBe(true);
  expect(noScript.includes('href="#a"')).toBe(true);
  expect(noScript.includes('href="#b"')).toBe(true);
});

test("T3.3 — edge: empty sections does not throw", () => {
  const html = render({ meta: { title: "Empty", date: "2026-06-08" }, sections: [] });
  expect(html.includes("<!DOCTYPE html>")).toBe(true);
  expect(html.includes("<section")).toBe(false);
});

test("T3.4 — prose md: Markdown field renders + fenced code is copyable", () => {
  const html = render({
    meta: { title: "T", date: "2026-06-08" },
    sections: [{ id: "m", title: "Md", blocks: [{ type: "prose", md: "**bold** and\n\n```ts\nconst x=1;\n```" }] }],
  });
  expect(html).toContain("<strong>bold</strong>");
  expect(html).toContain("copy-btn");        // copyScript/copyCss wired in
  expect(html).toContain("const x=1;");
});

test("T3.5 — comment block with copy: raw md kept for clipboard", () => {
  const html = render({
    meta: { title: "T", date: "2026-06-08" },
    sections: [{ id: "c", title: "C", blocks: [{ type: "comment", data: { md: "review **note**", title: "file.ts:10", copy: true } }] }],
  });
  expect(html).toContain("cmt-src");          // hidden raw-source payload
  expect(html).toContain("review **note**");  // raw md preserved for paste
  expect(html).toContain("file.ts:10");       // label
});
