import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTokens, contrast, checkTemplate, inline, exportDesignSystem } from "./tokens.ts";

const CSS_PATH = join(import.meta.dir, "..", "templates", "tokens.css");
const css = () => readFileSync(CSS_PATH, "utf8");

// V2 fixture: literal copy of the palette in scripts/theme.ts (feature 010, v2)
// taken before feature 039 rewires theme.ts onto tokens.css. Do not import it.
const V2 = {
  light: {
    bg: "#f3f5f9", surface: "#ffffff", "surface-2": "#e9eef5",
    line: "#d9e0ea", "line-strong": "#bcc6d4",
    ink: "#0f1620", "ink-2": "#404a59", "ink-3": "#5d6776",
    accent: "#0d9488", "accent-2": "#0f766e", "accent-bg": "#dcf5f0", link: "#0e7490",
    good: "#16a34a", mid: "#ca8a04", warn: "#ea580c", bad: "#dc2626",
    blocker: "#dc2626", major: "#ea580c", minor: "#ca8a04", nit: "#64748b", ok: "#16a34a",
    track: "rgba(15,22,32,.08)",
    serif: '"Newsreader","Iowan Old Style",Palatino,Georgia,serif',
    sans: '"Geist",ui-sans-serif,-apple-system,"Segoe UI",sans-serif',
    mono: '"Geist Mono",ui-monospace,"SF Mono",Consolas,monospace',
    shadow: "0 1px 2px rgba(17,22,29,.08),0 8px 24px rgba(17,22,29,.10)",
  } as Record<string, string>,
  dark: {
    bg: "#0a0e1a", surface: "#1a2236", "surface-2": "#232e48",
    line: "#33415f", "line-strong": "#475a7e",
    ink: "#eef1f6", "ink-2": "#c4ccda", "ink-3": "#959fb1",
    accent: "#2dd4bf", "accent-2": "#5eead4", "accent-bg": "#0e3330", link: "#38bdf8",
    good: "#34d399", mid: "#fbbf24", warn: "#fb923c", bad: "#f87171",
    blocker: "#f87171", major: "#fb923c", minor: "#fbbf24", nit: "#94a3b8", ok: "#34d399",
    track: "rgba(255,255,255,.06)",
    shadow: "0 1px 2px rgba(0,0,0,.55),0 12px 32px rgba(0,0,0,.5)",
  } as Record<string, string>,
  scale: {
    "t-xs": ".75rem", "t-sm": ".8125rem", "t-base": ".9375rem", "t-md": "1.0625rem",
    "t-lg": "1.375rem", "t-xl": "1.75rem", "t-2xl": "2.25rem",
    "t-3xl": "clamp(2.1rem,5vw,3.2rem)",
  } as Record<string, string>,
};

// The only light tokens allowed to move from v2, and only darker (AC3 as amended).
const MOVABLE = ["accent", "accent-2", "link", "good", "mid", "warn", "bad", "blocker", "major", "minor", "nit", "ok"];
const SURFACE_INK = ["bg", "surface", "surface-2", "line", "line-strong", "ink", "ink-2", "ink-3"];
const TEXT = ["ink", "ink-2", "ink-3", "accent", "accent-2", "link", "good", "mid", "warn", "bad", "blocker", "major", "minor", "nit", "ok"];
const GROUNDS = ["bg", "surface", "surface-2"];
const SEVERITIES = ["blocker", "major", "minor", "nit", "ok"];
const PRINT_SELECTOR = ":root, html[data-theme], html:not([data-theme])";

const luminance = (hex: string): number => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

test("T1.1 — v2 surfaces, lines, ink and every dark value are kept", () => {
  const p = parseTokens(css());
  for (const k of SURFACE_INK) expect(p.light[k], `light ${k}`).toBe(V2.light[k]);
  for (const [k, v] of Object.entries(V2.dark)) {
    expect(p.dark[k], `dark ${k}`).toBe(v);
    expect(p.darkMedia[k], `darkMedia ${k}`).toBe(v);
  }
  // Non-movable light tokens equal v2; movable ones only get darker.
  for (const [k, v] of Object.entries(V2.light)) {
    if (MOVABLE.includes(k)) {
      expect(luminance(p.light[k]), `light ${k} must not be lighter than v2`).toBeLessThanOrEqual(luminance(v));
    } else {
      expect(p.light[k], `light ${k}`).toBe(v);
    }
  }
  for (const [k, v] of Object.entries(V2.scale)) expect(p.scale[k], `scale ${k}`).toBe(v);
  expect(p.light["maxw"], "--maxw stays per template").toBeUndefined();
});

test("T1.2 — every text token reaches AA on every ground, both schemes", () => {
  const p = parseTokens(css());
  const fails: string[] = [];
  for (const [name, scheme] of [["light", p.light], ["dark", p.dark]] as const) {
    for (const t of TEXT) {
      for (const g of GROUNDS) {
        if (!scheme[t] || !scheme[g]) { fails.push(`${name}/${t}/${g}=undefined`); continue; }
        const r = contrast(scheme[t], scheme[g]);
        if (r < 4.5) fails.push(`${name}/${t}/${g}=${r.toFixed(2)}`);
      }
    }
  }
  expect(fails.join(", ")).toBe("");
});

// Foreground → the tint it is read on: each severity on its own -bg, the info callout's link on --info-bg.
const TINTS: [string, string][] = [...SEVERITIES.map((s): [string, string] => [s, `${s}-bg`]), ["link", "info-bg"]];

test("T1.3 — each tinted foreground reaches AA on its own tint", () => {
  const p = parseTokens(css());
  const fails: string[] = [];
  for (const [name, scheme] of [["light", p.light], ["dark", p.dark]] as const) {
    for (const [f, t] of TINTS) {
      const fg = scheme[f], bg = scheme[t];
      if (!fg || !bg) { fails.push(`${name}/${f}/${t}=undefined`); continue; }
      const r = contrast(fg, bg);
      if (r < 4.5) fails.push(`${name}/${f}/${t}=${r.toFixed(2)}`);
    }
  }
  expect(fails.join(", ")).toBe("");
});

test("T1.4 — duplicated blocks cannot drift", () => {
  const p = parseTokens(css());
  expect(Object.keys(p.dark).length).toBeGreaterThan(0);
  expect(p.darkMedia).toEqual(p.dark);
  // Color keys = the keys the dark scheme redeclares; print restates them from light.
  const colorKeys = Object.keys(p.dark).sort();
  expect(Object.keys(p.print).sort()).toEqual(colorKeys);
  for (const k of colorKeys) expect(p.print[k], `print ${k}`).toBe(p.light[k]);
  expect(p.printSelector).toBe(PRINT_SELECTOR);
  expect(p.order[p.order.length - 1]).toBe("print");
});

test("T1.5 — header names the source and no dead reference", () => {
  const header = css().match(/\/\*[\s\S]*?\*\//)?.[0] ?? "";
  expect(header).toContain("single source");
  expect(header).not.toContain("memo.html");
});

test("T1.6 — contrast() matches known WCAG values", () => {
  expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 2);
  expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  expect(contrast("#fff", "#fff")).toBe(1);
  for (let i = 0; i < 200; i++) {
    const hex = () => "#" + Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0");
    const a = hex(), b = hex();
    const r = contrast(a, b);
    expect(r).toBe(contrast(b, a));
    expect(r).toBeGreaterThanOrEqual(1);
    expect(r).toBeLessThanOrEqual(21);
  }
});

// ---- US2: inliner and divergence check ----
const TEMPLATES_DIR = join(import.meta.dir, "..", "templates");
const BEGIN = "/* tokens:begin */";
const END = "/* tokens:end */";
const page = (block: string, extra = "") =>
  `<!doctype html><html lang="en" data-theme="dark"><head><style>\n${BEGIN}\n${block}\n${END}\n${extra}\n</style></head><body></body></html>`;

test("T2.1 — one changed value in the block fails the check", () => {
  const source = css();
  expect(checkTemplate("ok.html", page(source.trimEnd()), source)).toEqual([]);
  const mutated = source.replace("--bg:#f3f5f9", "--bg:#f3f5fa");
  expect(mutated).not.toBe(source);
  const problems = checkTemplate("x.html", page(mutated.trimEnd()), source);
  expect(problems).toHaveLength(1);
  expect(problems[0].file).toBe("x.html");
  expect(problems[0].problem).toContain("block differs");
});

test("T2.2 — canonical token redeclared outside the block fails, print included", () => {
  const source = css();
  const block = source.trimEnd();
  const print = checkTemplate("p.html", page(block, "@media print { :root { --bg:#fff } }"), source);
  expect(print.some((p) => p.problem.includes("--bg"))).toBe(true);
  const dark = checkTemplate("d.html", page(block, 'html[data-theme="dark"]{--ink:#fff}'), source);
  expect(dark.some((p) => p.problem.includes("--ink"))).toBe(true);
  const media = checkTemplate("m.html", page(block, "@media (prefers-color-scheme: dark){ html:not([data-theme]) { --line: #000 } }"), source);
  expect(media.some((p) => p.problem.includes("--line"))).toBe(true);
  const local = checkTemplate("l.html", page(block, ":root { --maxw: 1080px; --c: red } .card { --bg: #000 }"), source);
  expect(local).toEqual([]);
});

test("T2.3 — missing markers fail", () => {
  const source = css();
  const bare = `<html><head><style>${source}</style></head></html>`;
  expect(checkTemplate("n.html", bare, source)).toEqual([{ file: "n.html", problem: "missing tokens block" }]);
  const reversed = `<style>\n${END}\n${source}\n${BEGIN}\n</style>`;
  expect(checkTemplate("r.html", reversed, source)[0].problem).toBe("missing tokens block");
});

const TEMPLATE_FILES = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".html")).sort();

test.each(TEMPLATE_FILES)("T2.4 — %s carries the block verbatim", (name) => {
  const html = readFileSync(join(TEMPLATES_DIR, name), "utf8");
  expect(checkTemplate(name, html, css())).toEqual([]);
});

test("T2.5 — write is idempotent", () => {
  const source = css();
  const stale = page("--bg:#000;\n/* stale */", "body{margin:0}\n$& $1 keep");
  const once = inline(stale, source);
  expect(inline(once, source)).toBe(once);
  expect(checkTemplate("i.html", once, source)).toEqual([]);
  expect(once).toContain("body{margin:0}\n$& $1 keep");
  expect(() => inline("<style></style>", source)).toThrow("missing tokens block");
});

// ---- US8: Design System Artifact export ----

type DsToken = { name: string; value: string | { light: string; dark: string }; usage: string };

/** Runs the exporter into a temp dir and returns the parsed files. */
function exported(source?: string) {
  const dir = mkdtempSync(join(tmpdir(), "ds-export-"));
  try {
    exportDesignSystem(dir, source);
    const read = (p: string) => readFileSync(join(dir, "project", p), "utf8");
    return {
      tokens: JSON.parse(read("tokens.json")),
      readme: read("README.md"),
      index: JSON.parse(read("design-system.json")),
      cover: read("components/Cover/preview.html"),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const DS_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

test("T8.1 — export equals the source", () => {
  const p = parseTokens(css());
  const { tokens } = exported();

  const colorNames = Object.keys(p.dark).filter((k) => !k.startsWith("shadow"));
  const colors: DsToken[] = tokens.color.tokens;
  expect(colors.map((t) => t.name).sort()).toEqual([...colorNames].sort());
  for (const t of colors) {
    const v = t.value as { light: string; dark: string };
    expect(v.light).toBe(p.light[t.name]);
    expect(v.dark).toBe(p.dark[t.name]);
  }
  expect(tokens.color.themes.map((t: { id: string }) => t.id)).toEqual(["light", "dark"]);

  const scaleOf = (fam: DsToken[], prefix: string) =>
    Object.fromEntries(fam.filter((t) => t.name.startsWith(prefix)).map((t) => [t.name, t.value]));
  const want = (prefix: string) => Object.fromEntries(Object.entries(p.scale).filter(([k]) => k.startsWith(prefix)));
  expect(scaleOf(tokens.spacing.tokens, "space-")).toEqual(want("space-"));
  expect(scaleOf(tokens.radius.tokens, "radius-")).toEqual(want("radius-"));
  expect(scaleOf(tokens.leading.tokens, "lh-")).toEqual(want("lh-"));

  // The type reads fixed lengths only: a fluid clamp() exports its maximum.
  const fixed = (v: string) => v.match(/^clamp\([^,]+,[^,]+,([^)]+)\)$/)?.[1] ?? v;
  const styles: { name: string; fontSize: string }[] = tokens.type.groups.flatMap((g: { styles: never[] }) => g.styles);
  expect(Object.fromEntries(styles.map((s) => [s.name, s.fontSize]))).toEqual(
    Object.fromEntries(Object.entries(want("t-")).map(([k, v]) => [k, fixed(v)])),
  );
  for (const f of ["serif", "sans", "mono"]) expect(tokens.type.families[f]).toBe(p.light[f]);

  const shadows = Object.fromEntries((tokens.shadow.tokens as DsToken[]).map((t) => [t.name, t.value]));
  expect(shadows).toEqual({
    shadow: { light: p.light.shadow, dark: p.dark.shadow },
    "shadow-hover": { light: p.light["shadow-hover"], dark: p.dark["shadow-hover"] },
  });
});

test("T8.2 — export obeys the Design System type contract", () => {
  const { tokens, readme, index, cover } = exported();

  expect(JSON.stringify(tokens)).not.toMatch(/var\(|color-mix\(/);
  const COLOR_VALUE = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|oklch)\([^()]*\))$/i; // excludes named colors, var(), aliases
  for (const t of tokens.color.tokens as DsToken[]) {
    const v = t.value as { light: string; dark: string };
    expect(v.light).toMatch(COLOR_VALUE);
    expect(v.dark).toMatch(COLOR_VALUE);
  }

  const all: DsToken[] = ["color", "spacing", "radius", "shadow", "leading"].flatMap((f) => tokens[f].tokens);
  const names = all.map((t) => t.name);
  for (const n of names) expect(n).toMatch(DS_NAME);
  expect(new Set(names).size).toBe(names.length);
  for (const t of all) expect(t.usage.trim().length).toBeGreaterThan(0);

  expect(readme).toContain(".claude/skills/html-report/templates/tokens.css");
  expect(index.v).toBe(3);
  expect(index.layout).toBe("files");
  expect(index.title).toBe("Poneglyph");
  expect(index.createdOnFiles).toMatchObject({ v: 1 });
  expect(new Date(index.createdOnFiles.at).toString()).not.toBe("Invalid Date");
  const LENGTH = /^(\d*\.?\d+(px|rem|em|%)|0)$/;
  for (const g of tokens.type.groups) for (const s of g.styles) expect(s.fontSize).toMatch(LENGTH);

  // Cover contract (type reference cover.md): bare marker 240–360 high, one SVG, token-bound colors only.
  expect(cover.split("\n")[0]).toMatch(/^<!-- @dsCard height=(2[4-9]\d|3[0-5]\d|360) -->$/);
  expect(cover.match(/<svg/g)?.length).toBe(1);
  expect(cover).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  expect(cover).toContain(">Poneglyph<");

  // A source value the type cannot read is refused, not exported.
  expect(() => exported(css().replace("--bg:#f3f5f9", "--bg:var(--x)"))).toThrow(/--bg/);
  expect(() => exported(css().replace("--ink:#eef1f6", "--ink:white"))).toThrow(/--ink/);
});
