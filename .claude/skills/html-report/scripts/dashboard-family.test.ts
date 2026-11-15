import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTokens } from "./tokens.ts";

const TEMPLATES_DIR = join(import.meta.dir, "..", "templates");
const FAMILY = ["dashboard.template.html", "glance.template.html", "decision.template.html"];

// Per-element severity colors: generated markup sets them inline (style="--c:var(--blocker)").
const INLINE_LOCAL = ["c", "cc"];

const canonical = () => {
  const p = parseTokens(readFileSync(join(TEMPLATES_DIR, "tokens.css"), "utf8"));
  return new Set([p.light, p.dark, p.darkMedia, p.print].flatMap((o) => Object.keys(o)));
};

test("T5.1b: every colored decision total carries a glyph with a spoken word", () => {
  const html = readFileSync(join(TEMPLATES_DIR, "decision.template.html"), "utf8");
  for (const h of ["good", "mid", "warn", "bad"]) {
    expect(html, `tot.${h} colored`).toContain(`.dmatrix .tot.${h} { color:var(--${h}); }`);
    expect(html, `tot.${h} glyph`).toMatch(new RegExp(`\\.dmatrix \\.tot\\.${h}::before \\{ content:"[^"]+"; content:"[^"]+"/"[^"]+"; \\}`));
  }
});

test.each(FAMILY)("T5.1: %s starts dark and uses canonical surfaces", (name) => {
  const html = readFileSync(join(TEMPLATES_DIR, name), "utf8");

  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
  expect(htmlTag).toContain('data-theme="dark"');
  expect(html).not.toMatch(/--panel/);

  // Every var(--name) resolves to a canonical token one declared in the file itself, or an inline per-element property.
  const known = canonical();
  for (const n of INLINE_LOCAL) known.add(n);
  for (const m of html.matchAll(/(?<![\w-])--([A-Za-z0-9_-]+)\s*:/g)) known.add(m[1]);
  const unresolved = [...new Set([...html.matchAll(/var\(\s*--([A-Za-z0-9_-]+)/g)].map((m) => m[1]))].filter((n) => !known.has(n));
  expect(unresolved).toEqual([]);
});
