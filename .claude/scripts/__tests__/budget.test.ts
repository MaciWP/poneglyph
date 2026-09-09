import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compare, frontmatterField, loadSnapshot, measure, total } from "../lib/budget";

const REPO = join(import.meta.dir, "..", "..", "..");
const SNAPSHOT_DIR = join(import.meta.dir, "..", "lib");

describe("frontmatterField", () => {
  const skill = ["---", "name: x", "description: |", "  first line", "  second line", "metadata:", "  keywords: >", "    kw", "when_to_use: |", "  \"a\", \"b\"", "---", "# body"].join("\n");
  it("returns the indented block of a multi-line field and nothing else", () => {
    expect(frontmatterField(skill, "description")).toBe("  first line\n  second line\n");
    expect(frontmatterField(skill, "when_to_use")).toBe('  "a", "b"\n');
    expect(frontmatterField(skill, "keywords")).toBe(""); // nested under metadata — not a top-level field
  });
});

describe("compare (ratchet)", () => {
  const base = { alwaysLoaded: { "CLAUDE.md": 1000, "skills: description + when_to_use": 2000 }, skillBodies: { dev: 500 } };
  it("is silent when sizes are equal or shrink (ratchet 0 %, plan 037)", () => {
    expect(compare({ alwaysLoaded: { "CLAUDE.md": 1000, "skills: description + when_to_use": 1500 }, skillBodies: { dev: 400 } }, base)).toEqual([]);
  });
  it("flags a file, a skill body and the total on any growth", () => {
    const v = compare({ alwaysLoaded: { "CLAUDE.md": 1001, "skills: description + when_to_use": 2000 }, skillBodies: { dev: 501 } }, base);
    expect(v.map((x) => x.key)).toEqual(["CLAUDE.md", "skill dev", "always-loaded TOTAL"]);
  });
  it("still honours an explicit tolerance", () => {
    expect(compare({ alwaysLoaded: { "CLAUDE.md": 1040, "skills: description + when_to_use": 2000 }, skillBodies: { dev: 500 } }, base, 0.05)).toEqual([]);
  });
  it("flags new always-loaded pieces and new skills as budget decisions (and the total they grow)", () => {
    const v = compare({ alwaysLoaded: { ...base.alwaysLoaded, "rules/new.md": 10 }, skillBodies: { ...base.skillBodies, shiny: 10 } }, base);
    expect(v.map((x) => x.key)).toEqual(["rules/new.md (new)", "skill shiny (new)", "always-loaded TOTAL"]);
  });
});

describe("measure", () => {
  it("counts CLAUDE.md, the style, global rules and the skills' activation surface — never keywords or bodies", () => {
    const root = mkdtempSync(join(tmpdir(), "budget-"));
    mkdirSync(join(root, ".claude", "rules", "paths"), { recursive: true });
    mkdirSync(join(root, ".claude", "output-styles"), { recursive: true });
    mkdirSync(join(root, ".claude", "skills", "a"), { recursive: true });
    writeFileSync(join(root, "CLAUDE.md"), "12345");
    writeFileSync(join(root, ".claude", "output-styles", "poneglyph.md"), "1234");
    writeFileSync(join(root, ".claude", "rules", "error-recovery.md"), "123");
    writeFileSync(join(root, ".claude", "rules", "test-policy.md"), "project-only, excluded");
    writeFileSync(join(root, ".claude", "skills", "a", "SKILL.md"), ["---", "name: a", "description: |", "  ab", "metadata:", "  keywords: >", "    not-loaded", "when_to_use: |", "  cd", "---", "BODY".repeat(10)].join("\n"));
    const home = mkdtempSync(join(tmpdir(), "budget-home-"));
    const m = measure(root, home);
    expect(m.alwaysLoaded["CLAUDE.md"]).toBe(5);
    expect(m.alwaysLoaded["output-styles/poneglyph.md"]).toBe(4);
    expect(m.alwaysLoaded["rules/error-recovery.md"]).toBe(3);
    expect(m.alwaysLoaded["rules/test-policy.md"]).toBeUndefined();
    expect(m.alwaysLoaded["skills: description + when_to_use"]).toBe("  ab\n".length + "  cd\n".length);
    expect(m.alwaysLoaded["installed plugins: description + when_to_use (this machine)"]).toBe(0); // no registry
    expect(m.skillBodies.a).toBeGreaterThan(40);
    expect(total(m.alwaysLoaded)).toBe(5 + 4 + 3 + 10);
  });

  it("counts installed plugin skills' description + when_to_use (F1 — the moved surface still loads)", () => {
    const home = mkdtempSync(join(tmpdir(), "budget-home-"));
    const pluginDir = join(home, ".claude", "plugins", "cache", "m", "p", "1.0.0");
    mkdirSync(join(pluginDir, "skills", "x"), { recursive: true });
    writeFileSync(join(pluginDir, "skills", "x", "SKILL.md"), ["---", "name: x", "description: |", "  desc", "when_to_use: |", "  wtu", "---", "body"].join("\n"));
    writeFileSync(join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins: { "p@m": [{ scope: "user", installPath: pluginDir }] } }));
    const root = mkdtempSync(join(tmpdir(), "budget-"));
    mkdirSync(join(root, ".claude"), { recursive: true });
    expect(measure(root, home).alwaysLoaded["installed plugins: description + when_to_use (this machine)"]).toBe("  desc\n".length + "  wtu\n".length);
  });
});

describe("the real layer stays within its snapshot (ratchet — Cmd IX)", () => {
  it("no always-loaded piece, skill body or total grew since the last ratified snapshot", () => {
    const snapshot = loadSnapshot(SNAPSHOT_DIR);
    expect(snapshot, "budget-snapshot.json missing — run `bun .claude/scripts/budget.ts --update`").not.toBeNull();
    const violations = compare(measure(REPO), snapshot!);
    expect(violations, violations.map((v) => `${v.key}: ${v.snapshot} → ${v.current}`).join("; ")).toEqual([]);
  });
});
