/**
 * Tests for comments.ts — markdown interpretation + copy-to-clipboard
 * (dynamic-mode content authoring without hand-written HTML).
 */
import { test, expect } from "bun:test";
import { mdToHtml, copyable, copyCss, copyScript } from "./comments.ts";

// ---- mdToHtml: inline formatting ------------------------------------------

test("bold (** only) / italic (*) / inline code", () => {
  expect(mdToHtml("**b**")).toContain("<strong>b</strong>");
  expect(mdToHtml("*i*")).toContain("<em>i</em>");
  expect(mdToHtml("`c`")).toContain("<code>c</code>");
});

test("code-safe: dunders / snake_case / *args / **kwargs survive verbatim", () => {
  // bare code identifiers must NOT be turned into emphasis (code-review content)
  const dunder = mdToHtml("el cambio de __str__ y __init__");
  expect(dunder).not.toContain("<strong>");
  expect(dunder).not.toContain("<em>");
  expect(dunder).toContain("__str__");

  const args = mdToHtml("acepta *args y **kwargs aqui");
  expect(args).not.toContain("<em>");
  expect(args).not.toContain("<strong>");
  expect(args).toContain("*args");
  expect(args).toContain("**kwargs");

  expect(mdToHtml("var snake_case_name")).toContain("snake_case_name");
  // underscore emphasis is intentionally unsupported → stays literal
  expect(mdToHtml("_i_")).not.toContain("<em>");
});

test("links — safe schemes only", () => {
  expect(mdToHtml("[t](https://x.io)")).toContain('<a href="https://x.io">t</a>');
  expect(mdToHtml("[rel](#sec)")).toContain('<a href="#sec">rel</a>');
  // javascript: and other dangerous schemes are neutralized (no href injection)
  const evil = mdToHtml("[x](javascript:alert(1))");
  expect(evil).not.toContain("javascript:alert");
});

test("no inline formatting INSIDE inline code", () => {
  // the ** inside backticks must stay literal, not become <strong>
  const html = mdToHtml("`a**b**c`");
  expect(html).toContain("<code>a**b**c</code>");
  expect(html).not.toContain("<strong>");
});

// ---- mdToHtml: blocks ------------------------------------------------------

test("unordered + ordered lists", () => {
  expect(mdToHtml("- a\n- b")).toContain("<ul><li>a</li><li>b</li></ul>");
  expect(mdToHtml("1. a\n2. b")).toContain("<ol><li>a</li><li>b</li></ol>");
});

test("headings + paragraphs", () => {
  expect(mdToHtml("### H")).toContain("<h4");
  const p = mdToHtml("line one\n\nline two");
  expect((p.match(/<p>/g) || []).length).toBe(2);
});

// ---- mdToHtml: safety (escape untrusted HTML) -----------------------------

test("HTML in source is escaped, not injected", () => {
  const html = mdToHtml("a <script>alert(1)</script> b");
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
});

test("ampersand and angle brackets escaped in text", () => {
  expect(mdToHtml("a & b < c")).toContain("a &amp; b &lt; c");
});

// ---- fenced code blocks are copyable --------------------------------------

test("fenced code block renders <pre><code> + copy button + raw source", () => {
  const html = mdToHtml("```ts\nconst x = 1;\n```");
  expect(html).toContain("<pre");
  expect(html).toContain("<code");
  expect(html).toContain("const x = 1;");
  expect(html).toContain("copy-btn");          // a copy affordance
  expect(html).toContain("cmt-src");            // hidden raw source for the JS to copy
});

test("code fence content is NOT markdown-formatted", () => {
  const html = mdToHtml("```\n**not bold**\n```");
  expect(html).not.toContain("<strong>");
  expect(html).toContain("**not bold**");
});

// ---- copyable wrapper ------------------------------------------------------

test("copyable wraps body + hidden source + button", () => {
  const html = copyable("<p>rendered</p>", "raw **source**", "snippet");
  expect(html).toContain("copy-btn");
  expect(html).toContain("<p>rendered</p>");
  expect(html).toContain("cmt-src");
  // the raw source is preserved (escaped) for the clipboard payload
  expect(html).toContain("raw **source**");
  expect(html).toContain("snippet");            // label
});

test("copyable escapes the source payload (no markup injection)", () => {
  const html = copyable("<p>x</p>", "</pre><script>evil</script>");
  expect(html).not.toContain("<script>evil");
  expect(html).toContain("&lt;script&gt;");
});

// ---- self-contained assets (no external deps) -----------------------------

test("copyScript uses clipboard API with a fallback, no network", () => {
  expect(copyScript).toContain("clipboard");
  expect(copyScript).toContain("execCommand");  // fallback path
  expect(copyScript).not.toContain("http");
});

test("copyCss is non-empty and styles the copy button", () => {
  expect(copyCss.length).toBeGreaterThan(0);
  expect(copyCss).toContain(".copy-btn");
});
