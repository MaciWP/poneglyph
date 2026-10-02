/**
 * Reader for templates/tokens.css, the single token source of the html-report
 * skill. `parseTokens` maps each theme block to its `--name: value` pairs (names
 * without the leading dashes, values trimmed, rgba()/clamp() kept as strings);
 * `contrast` is the WCAG 2.x ratio the tests use to measure the palette.
 * `checkTemplate` / `inline` keep the copy of that file inside each HTML template
 * (between the tokens:begin / tokens:end markers) identical to the source. CLI:
 * `bun scripts/tokens.ts --check|--write [file...]` (default: templates/*.html).
 * `exportDesignSystem` writes the claude.ai Design System `project/` folder from the
 * same file (`--export-ds <dir>`); the repo file stays the source of truth.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface ParsedTokens {
  light: Record<string, string>;      // every declaration of the top-level :root blocks
  dark: Record<string, string>;       // html[data-theme="dark"]
  darkMedia: Record<string, string>;  // @media (prefers-color-scheme: dark) html:not([data-theme])
  print: Record<string, string>;      // @media print, restating the light values
  scale: Record<string, string>;      // light keys t-* / lh-* / space-* / radius-*
  printSelector: string;              // selector list of the print rule, whitespace-normalised
  order: string[];                    // block kinds in file order (light | dark | darkMedia | print | other)
}

const SCALE_KEY = /^(t-|lh-|space-|radius-)/;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([A-Za-z0-9_-]+)\s*:\s*([^;]+);?/g)) out[m[1]] = m[2].trim();
  return out;
}

/** Split `css` into top-level rules: [prelude, body] where body may hold nested rules. */
function rules(css: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let depth = 0, start = 0, open = -1;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") { if (depth++ === 0) open = i; }
    else if (css[i] === "}" && --depth === 0) {
      out.push([norm(css.slice(start, open)), css.slice(open + 1, i)]);
      start = i + 1;
    }
  }
  return out;
}

export function parseTokens(source: string): ParsedTokens {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const res: ParsedTokens = { light: {}, dark: {}, darkMedia: {}, print: {}, scale: {}, printSelector: "", order: [] };

  for (const [prelude, body] of rules(css)) {
    if (prelude === ":root") {
      Object.assign(res.light, declarations(body));
      res.order.push("light");
    } else if (prelude === 'html[data-theme="dark"]') {
      Object.assign(res.dark, declarations(body));
      res.order.push("dark");
    } else if (/^@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)$/.test(prelude)) {
      for (const [sel, inner] of rules(body)) if (sel === "html:not([data-theme])") Object.assign(res.darkMedia, declarations(inner));
      res.order.push("darkMedia");
    } else if (/^@media\s+print$/.test(prelude)) {
      for (const [sel, inner] of rules(body)) {
        res.printSelector = sel;
        Object.assign(res.print, declarations(inner));
      }
      res.order.push("print");
    } else {
      res.order.push("other");
    }
  }
  for (const [k, v] of Object.entries(res.light)) if (SCALE_KEY.test(k)) res.scale[k] = v;
  return res;
}

function luminance(hex: string): number {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const BEGIN = "/* tokens:begin */";
export const END = "/* tokens:end */";

// The marked block is "\n" + tokens.css without trailing whitespace + "\n".
const expectedBlock = (css: string) => `\n${css.replace(/\s+$/, "")}\n`;

function markers(html: string): [number, number] | null {
  const b = html.indexOf(BEGIN);
  const e = html.indexOf(END, b + BEGIN.length);
  return b === -1 || e === -1 ? null : [b + BEGIN.length, e];
}

const THEME_SELECTOR = /^(:root|html)(\[data-theme[^\]]*\]|:not\(\[data-theme\]\))?$/;

/** Canonical names declared in a theme-selector rule, at any @media depth. */
function themeDeclarations(css: string, canonical: Set<string>): string[] {
  const found: string[] = [];
  for (const [prelude, body] of rules(css)) {
    if (prelude.startsWith("@")) found.push(...themeDeclarations(body, canonical));
    else if (prelude.split(",").some((sel) => THEME_SELECTOR.test(sel.trim())))
      for (const name of Object.keys(declarations(body))) if (canonical.has(name)) found.push(name);
  }
  return found;
}

/** Problems that keep `html` from carrying `css` as its only token definition. */
export function checkTemplate(file: string, html: string, css: string): { file: string; problem: string }[] {
  const at = markers(html);
  if (!at) return [{ file, problem: "missing tokens block" }];
  const problems: { file: string; problem: string }[] = [];
  if (html.slice(at[0], at[1]) !== expectedBlock(css)) problems.push({ file, problem: "block differs from tokens.css" });

  const p = parseTokens(css);
  const canonical = new Set([p.light, p.dark, p.darkMedia, p.print].flatMap((o) => Object.keys(o)));
  const outside = html.slice(0, at[0] - BEGIN.length) + html.slice(at[1] + END.length);
  const styles = [...outside.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const seen = new Set(themeDeclarations(styles.replace(/\/\*[\s\S]*?\*\//g, ""), canonical));
  for (const name of seen) problems.push({ file, problem: `--${name} redeclared outside the tokens block` });
  return problems;
}

/** Replace the marked block of `html` with `css`; idempotent. */
export function inline(html: string, css: string): string {
  const at = markers(html);
  if (!at) throw new Error("missing tokens block");
  return html.slice(0, at[0]) + expectedBlock(css) + html.slice(at[1]);
}

// ---- Design System Artifact export (claude.ai "Design System" type) ----

const TOKENS_CSS = join(import.meta.dir, "..", "templates", "tokens.css");
const REPO_SOURCE = ".claude/skills/html-report/templates/tokens.css";
const DS_COLOR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|oklch)\([^()]*\))$/i; // no named colors, var(), color-mix(), aliases

const SEVERITY_USAGE: Record<string, string> = {
  blocker: "a finding that must be fixed before shipping",
  major: "a finding that should be fixed soon",
  minor: "a small finding",
  nit: "a stylistic remark",
  ok: "a passed check",
};
const COLOR_USAGE: Record<string, string> = {
  bg: "Page background.",
  surface: "Cards and panels on the page background.",
  "surface-2": "Nested or raised surfaces: table headers, code blocks, wells.",
  line: "Default borders and dividers.",
  "line-soft": "Hairlines inside a card.",
  "line-strong": "Emphasised borders and control outlines.",
  ink: "Primary text.",
  "ink-2": "Secondary text.",
  "ink-3": "Tertiary text: captions, metadata.",
  accent: "Brand accent: links-as-actions, key figures, focus.",
  "accent-2": "Stronger accent for text on light grounds and hover states.",
  "accent-bg": "Tint behind accent text and selected rows.",
  "accent-bd": "Border of an accent-tinted surface.",
  link: "Inline links, and the text and mark of an info callout.",
  "info-bg": "Tint behind an info callout.",
  "info-bd": "Border of an info callout.",
  good: "Score tag: a good number.",
  mid: "Score tag: a middling number.",
  warn: "Score tag: a number to watch.",
  bad: "Score tag: a bad number.",
  track: "Empty track of meters and bars.",
};
const SCALE_USAGE: Record<string, string> = {
  "t-xs": "Captions and fine print.", "t-sm": "Table cells and metadata.", "t-base": "Body text.",
  "t-md": "Lead paragraphs.", "t-lg": "Section headings.", "t-xl": "Page subheadings.",
  "t-2xl": "Page titles.", "t-3xl": "Hero title; fluid in code as clamp(2.1rem,5vw,3.2rem), exported at its maximum.",
  "lh-tight": "Line height for large headings.", "lh-snug": "Line height for small headings.",
  "lh-normal": "Line height for running text.",
  "space-1": "Tightest gap: icon to label.", "space-2": "Small gap inside controls.", "space-3": "Gap between related items.",
  "space-4": "Card padding.", "space-5": "Gap between blocks.", "space-6": "Gap between sections.",
  "space-7": "Large section spacing.", "space-8": "Page-level spacing.",
  "radius-sm": "Chips, inputs and code.", "radius-md": "Buttons and small cards.", "radius-lg": "Cards and panels.",
  "radius-full": "Pills and dots.",
  shadow: "Resting elevation of cards.", "shadow-hover": "Raised elevation on hover.",
};

function colorUsage(name: string): string {
  if (COLOR_USAGE[name]) return COLOR_USAGE[name];
  const m = name.match(/^(blocker|major|minor|nit|ok)(-bg|-bd)?$/);
  if (!m) return "Poneglyph palette color.";
  const what = SEVERITY_USAGE[m[1]];
  return m[2] === "-bg" ? `Tint behind a ${m[1]} tag: ${what}.` : m[2] === "-bd" ? `Border of a ${m[1]} tag: ${what}.` : `Severity tag text and mark for ${what}.`;
}

const listOf = (rec: Record<string, string>, prefix: string, usage: (n: string) => string) =>
  Object.entries(rec).filter(([k]) => k.startsWith(prefix)).map(([name, value]) => ({ name, value, usage: usage(name) }));

/** claude.ai Design System `tokens.json`, built from the parsed source. */
function designTokens(p: ParsedTokens) {
  const colorNames = Object.keys(p.dark).filter((k) => !k.startsWith("shadow"));
  const color = colorNames.map((name) => {
    const value = { light: p.light[name], dark: p.dark[name] };
    for (const [theme, v] of Object.entries(value)) {
      if (!DS_COLOR.test(v ?? "")) throw new Error(`--${name} (${theme}): "${v}" is not a plain color value the Design System type reads`);
    }
    return { name, value, usage: colorUsage(name) };
  });
  const lineHeight = (size: string) => (["t-xl", "t-2xl", "t-3xl"].includes(size) ? p.scale["lh-tight"] : size === "t-lg" ? p.scale["lh-snug"] : p.scale["lh-normal"]);
  // The type reads fixed lengths only: a fluid clamp() exports its maximum.
  const fixed = (v: string) => v.match(/^clamp\([^,]+,[^,]+,([^)]+)\)$/)?.[1] ?? v;
  const styles = Object.keys(p.scale).filter((k) => k.startsWith("t-")).map((name) => ({ name, fontSize: fixed(p.scale[name]), lineHeight: lineHeight(name), usage: SCALE_USAGE[name] }));
  const usage = (n: string) => SCALE_USAGE[n] ?? "Poneglyph scale token.";
  return {
    name: "Poneglyph",
    version: 1,
    color: { themes: [{ id: "light", name: "Light" }, { id: "dark", name: "Dark" }], tokens: color },
    type: {
      fonts: [], // Newsreader, Geist and Geist Mono are Google-hosted: named in families, no files
      families: { serif: p.light.serif, sans: p.light.sans, mono: p.light.mono },
      groups: [{ name: "Scale", family: "sans", styles }],
    },
    spacing: { tokens: listOf(p.scale, "space-", usage) },
    radius: { tokens: listOf(p.scale, "radius-", usage) },
    leading: { tokens: listOf(p.scale, "lh-", usage) },
    shadow: {
      tokens: ["shadow", "shadow-hover"].map((name) => ({ name, value: { light: p.light[name], dark: p.dark[name] }, usage: usage(name) })),
    },
  };
}

function designReadme(): string {
  return `# Poneglyph

The design system behind Poneglyph's HTML outputs: reports, dashboards, glance pages, decision pages and inline SVG diagrams. Cool-neutral surfaces, deep-teal accent, serif headings over a sans body, light and dark themes.

## Source of truth

The file \`${REPO_SOURCE}\` in the Poneglyph repo is the source of truth. This Artifact is a published copy of it: when the file changes, the copy is republished by hand, so a value here can lag behind the repo. When they disagree, the repo file wins.

## Visual foundations

- **Themes.** Every color token carries a light and a dark value. Reports follow the system preference; dashboards, glance and decision pages start dark. Print always uses the light values.
- **Surfaces.** \`bg\` is the page, \`surface\` a card on it, \`surface-2\` a nested surface. Borders use \`line\`, \`line-soft\` and \`line-strong\`.
- **Text.** \`ink\`, \`ink-2\` and \`ink-3\` step down in emphasis. Every text token reaches WCAG AA 4.5:1 on \`bg\`, \`surface\` and \`surface-2\` in both themes; light accent and status colors are darkened only as far as AA requires.
- **Accent.** \`accent\` marks what to act on or read first; \`accent-bg\` and \`accent-bd\` tint its surfaces.
- **Type.** Newsreader (serif) for headings, Geist (sans) for body, Geist Mono for code; all Google-hosted. The \`t-*\` scale runs from caption to a fluid hero title, paired with three line heights.
- **Space and shape.** Eight spacing steps (\`space-1\` to \`space-8\`) and four radii (\`radius-sm\` to \`radius-full\`). Two shadows, \`shadow\` and \`shadow-hover\`, each with a light and a dark value.

## Usage rules

- Two status scales, never interchangeable. **Severity** (\`blocker\`, \`major\`, \`minor\`, \`nit\`, \`ok\`, each with \`-bg\` and \`-bd\`) tags findings. **Score** (\`bad\`, \`warn\`, \`mid\`, \`good\`) tags numbers.
- Never hard-code a hex value; use the token so both themes stay correct.
- Never pair a status color with a ground it was not measured on: text tokens are measured on \`bg\`, \`surface\` and \`surface-2\`, and each severity on its own \`-bg\` tint.
- Layout width is not a token; each template sets its own.
`;
}

function designCover(): string {
  // Colors are token classes: the page preloads its generated tokens.css, so the cover follows the theme.
  return `<!-- @dsCard height=288 -->
<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; height: 288px; overflow: hidden; background: var(--bg); }
  svg { position: absolute; inset: 0; }
  .accent { fill: var(--accent); rx: var(--radius-lg); }
  .ink { fill: var(--ink); rx: var(--radius-md); }
  .tint { fill: var(--accent-bd); rx: var(--radius-md); }
  .signal { fill: var(--mid); rx: var(--radius-sm); }
  .rule { stroke: var(--line-strong); stroke-width: 1; }
  .name { position: absolute; left: 48px; bottom: 40px; max-width: 440px; margin: 0; }
  h1 { margin: 0 0 12px; font: 600 88px/.95 var(--font-serif); color: var(--ink); }
  p { margin: 0; font: 400 14px/1.4 var(--font-sans); color: var(--ink-2); }
</style>
<svg width="960" height="288" viewBox="0 0 960 288" aria-hidden="true">
  <!-- blocks: accent 224x224 radius-lg, ink 160x128 radius-md, accent-bd 96x64 radius-md, mid 64x32 radius-sm -->
  <!-- arrangement: flush modular grid on a 32px step (space-6) right of x=512; accent bleeds off the top, ink off the right -->
  <!-- pattern: editorial row, four line-strong hairlines as a baseline grid, because the system is serif headings over reports that inscribe findings -->
  <!-- scales: space-6 (32px) sides and pitch, space-7 (48px) inset; radius-sm, radius-md, radius-lg -->
  <rect class="accent" x="608" y="-32" width="224" height="224"/>
  <rect class="ink" x="832" y="128" width="160" height="128"/>
  <rect class="tint" x="512" y="192" width="96" height="64"/>
  <rect class="signal" x="608" y="224" width="64" height="32"/>
  <line class="rule" x1="512" y1="48" x2="960" y2="48"/>
  <line class="rule" x1="512" y1="112" x2="960" y2="112"/>
  <line class="rule" x1="512" y1="176" x2="960" y2="176"/>
  <line class="rule" x1="512" y1="240" x2="960" y2="240"/>
</svg>
<div class="name">
  <h1>Poneglyph</h1>
  <p>The design system behind Poneglyph's HTML outputs.</p>
</div>
`;
}

/**
 * Write the Design System `project/` folder under `dir` from `css` (default: the repo
 * tokens.css). The index goes last, as the type requires. Returns the written paths,
 * relative to `dir`. Throws when a color is not a plain value the type can read.
 */
export function exportDesignSystem(dir: string, css: string = readFileSync(TOKENS_CSS, "utf8")): string[] {
  const p = parseTokens(css);
  const files: Array<[string, string]> = [
    ["project/tokens.json", JSON.stringify(designTokens(p), null, 2) + "\n"],
    ["project/README.md", designReadme()],
    ["project/components/Cover/preview.html", designCover()],
    [
      "project/design-system.json",
      JSON.stringify(
        {
          v: 3, layout: "files", createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, "Z") },
          title: "Poneglyph", namespace: "Poneglyph", libraries: [], sections: {}, groups: [], assetGroups: {}, blobs: {},
          docs: { readme: "project/README.md", sections: [] },
          lastChange: { by: "Claude", at: new Date().toISOString(), via: "html-report scripts/tokens.ts --export-ds", note: "Exported from tokens.css" },
        },
        null,
        2,
      ) + "\n",
    ],
  ];
  for (const [rel, body] of files) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return files.map(([rel]) => rel);
}

if (import.meta.main) {
  const [mode, ...files] = process.argv.slice(2);
  if (mode === "--export-ds") {
    if (files.length !== 1) { console.error("usage: bun scripts/tokens.ts --export-ds <dir>"); process.exit(2); }
    for (const rel of exportDesignSystem(files[0])) console.log(`written: ${join(files[0], rel)}`);
    process.exit(0);
  }
  if (mode !== "--check" && mode !== "--write") {
    console.error("usage: bun scripts/tokens.ts --check|--write [file...] | --export-ds <dir>");
    process.exit(2);
  }
  const dir = join(import.meta.dir, "..", "templates");
  const source = readFileSync(join(dir, "tokens.css"), "utf8");
  const targets = files.length ? files : readdirSync(dir).filter((f) => f.endsWith(".html")).sort().map((f) => join(dir, f));
  let failed = 0;
  for (const file of targets) {
    const html = readFileSync(file, "utf8");
    if (mode === "--write") {
      try {
        const next = inline(html, source);
        if (next !== html) writeFileSync(file, next);
        console.log(`${next === html ? "unchanged" : "written"}: ${file}`);
      } catch (err) {
        failed++;
        console.error(`${file}: ${(err as Error).message}`);
      }
    } else {
      for (const { problem } of checkTemplate(file, html, source)) { failed++; console.error(`${file}: ${problem}`); }
    }
  }
  process.exit(failed ? 1 : 0);
}
