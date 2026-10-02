import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTokens } from "./tokens.ts";

const TEMPLATES = join(import.meta.dir, "..", "templates");
const REPORT_FAMILY = ["report.template.html", "components.html"];

const canonical = (() => {
  const p = parseTokens(readFileSync(join(TEMPLATES, "tokens.css"), "utf8"));
  return new Set([p.light, p.dark, p.darkMedia, p.print].flatMap((o) => Object.keys(o)));
})();

test.each(REPORT_FAMILY)("T4.1 — no old token name left in %s", (name) => {
  const html = readFileSync(join(TEMPLATES, name), "utf8");
  expect(html.match(/--(color|sev|score|text|font)-[a-z][a-z0-9-]*/g) ?? [], "old token names").toEqual([]);
  expect(html.includes("memo.html"), "memo.html reference").toBe(false);

  // Every var(--name) resolves to a canonical token or to one declared in this file
  // (catches a bad rename such as --ok-bg-bg). Comments are prose, not styles.
  const live = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
  const local = new Set([...live.matchAll(/(?<![\w-])--([A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1]));
  const unresolved = [...new Set([...live.matchAll(/var\(\s*--([A-Za-z0-9_-]+)/g)].map((m) => m[1]))]
    .filter((n) => !canonical.has(n) && !local.has(n));
  expect(unresolved, "unresolved var()").toEqual([]);
});

// Text on a status/accent fill must flip with the scheme: literal white fails AA on the
// light dark-mode fills (#fff on dark --mid = 1.67). --surface is white in light, dark in dark.
test.each(REPORT_FAMILY)("T4.2 — no literal white text in %s", (name) => {
  const live = readFileSync(join(TEMPLATES, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  expect(live.match(/(?<![\w-])color:\s*(#fff\b|#ffffff\b|white\b)/gi) ?? [], "literal white text").toEqual([]);
});

// HTML comments do not nest: an inner "<!--" leaves the outer comment at the first "-->",
// and the rest of the reference markup renders as a second, live copy (a duplicate gauge).
const ALL_TEMPLATES = ["report.template.html", "components.html", "dashboard.template.html", "decision.template.html", "glance.template.html"];
test.each(ALL_TEMPLATES)("T4.3 — no nested HTML comment in %s", (name) => {
  const html = readFileSync(join(TEMPLATES, name), "utf8");
  const nested = [...html.matchAll(/<!--([\s\S]*?)-->/g)]
    .filter((m) => m[1].includes("<!--"))
    .map((m) => html.slice(0, m.index).split("\n").length);
  expect(nested, "lines opening a comment that holds another <!--").toEqual([]);
});
