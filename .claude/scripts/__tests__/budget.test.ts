import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PLUGIN_SURFACE_LABEL, activationSurface, compare, loadSnapshot, measure, ratchetedSnapshotTotal, total } from "../lib/budget";

const REPO = join(import.meta.dir, "..", "..", "..");
const SNAPSHOT_DIR = join(import.meta.dir, "..", "lib");

describe("activationSurface", () => {
  const skill = ["---", "name: x", "description: |", "  first line", "  second line", "metadata:", "  keywords: >", "    kw", "when_to_use: |", "  \"a\", \"b\"", "---", "# body"].join("\n");
  it("counts the decoded description and when_to_use, never metadata.keywords or the body", () => {
    // The indentation of a block scalar is YAML syntax, not value; `metadata.keywords` is
    // read only by the activation hook, and the body loads on invocation.
    expect(activationSurface(skill)).toBe("first line\nsecond line\n".length + '"a", "b"\n'.length);
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
    expect(m.alwaysLoaded["skills: description + when_to_use"]).toBe("ab\n".length + "cd\n".length);
    expect(m.informative?.[PLUGIN_SURFACE_LABEL]).toBe(0); // no registry
    expect(m.alwaysLoaded[PLUGIN_SURFACE_LABEL]).toBeUndefined(); // machine-dependent — outside the ratchet
    expect(m.skillBodies.a).toBeGreaterThan(40);
    expect(total(m.alwaysLoaded)).toBe(5 + 4 + 3 + 6);
  });

  it("counts installed plugin skills' description + when_to_use (F1 — the moved surface still loads)", () => {
    const home = mkdtempSync(join(tmpdir(), "budget-home-"));
    const pluginDir = join(home, ".claude", "plugins", "cache", "m", "p", "1.0.0");
    mkdirSync(join(pluginDir, "skills", "x"), { recursive: true });
    writeFileSync(join(pluginDir, "skills", "x", "SKILL.md"), ["---", "name: x", "description: |", "  desc", "when_to_use: |", "  wtu", "---", "body"].join("\n"));
    writeFileSync(join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins: { "p@m": [{ scope: "user", installPath: pluginDir }] } }));
    const root = mkdtempSync(join(tmpdir(), "budget-"));
    mkdirSync(join(root, ".claude"), { recursive: true });
    expect(measure(root, home).informative?.[PLUGIN_SURFACE_LABEL]).toBe("desc\n".length + "wtu\n".length);
  });

  it("counts CRLF and LF checkouts as the same source size", () => {
    const skill = ["---", "name: a", "description: |", "  ab", "when_to_use: |", "  cd", "---", "BODY"].join("\n");
    const writeTree = (nl: string) => {
      const root = mkdtempSync(join(tmpdir(), "budget-eol-"));
      mkdirSync(join(root, ".claude", "rules"), { recursive: true });
      mkdirSync(join(root, ".claude", "output-styles"), { recursive: true });
      mkdirSync(join(root, ".claude", "skills", "a"), { recursive: true });
      writeFileSync(join(root, "CLAUDE.md"), "hello\nworld".replace(/\n/g, nl));
      writeFileSync(join(root, ".claude", "output-styles", "poneglyph.md"), "style\n".replace(/\n/g, nl));
      writeFileSync(join(root, ".claude", "rules", "error-recovery.md"), "rule\n".replace(/\n/g, nl));
      writeFileSync(join(root, ".claude", "skills", "a", "SKILL.md"), skill.replace(/\n/g, nl));
      return root;
    };
    const home = mkdtempSync(join(tmpdir(), "budget-home-"));
    const lf = measure(writeTree("\n"), home);
    const crlf = measure(writeTree("\r\n"), home);
    expect(crlf.alwaysLoaded["CLAUDE.md"]).toBe(lf.alwaysLoaded["CLAUDE.md"]);
    expect(crlf.alwaysLoaded["rules/error-recovery.md"]).toBe(lf.alwaysLoaded["rules/error-recovery.md"]);
    expect(crlf.alwaysLoaded["skills: description + when_to_use"]).toBe(lf.alwaysLoaded["skills: description + when_to_use"]);
    expect(crlf.skillBodies.a).toBe(lf.skillBodies.a);
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

// Quality review 2026-09-11 — H74. The ratchet measures the activation surface, but
// `frontmatterField` returned only the INDENTED continuation of a block scalar, so a
// one-line `description: "..."` counted as zero bytes and the guard could not see it
// grow. `measure` also counted skills Claude Code never lists.
describe("activation surface is measured as the host loads it (H74)", () => {
  it("counts a single-line description", () => {
    expect(activationSurface("---\ndescription: a short one-liner\n---\nbody\n")).toBe("a short one-liner".length);
  });

  it("still counts a block description", () => {
    expect(activationSurface("---\ndescription: |\n  first line\n  second line\n---\nbody\n")).toBe("first line\nsecond line\n".length);
  });

  it("returns nothing for a key that is absent", () => {
    expect(activationSurface("---\nname: x\n---\nbody\n")).toBe(0);
  });

  it("excludes a skill the model never sees from the listing surface", () => {
    const root = mkdtempSync(join(tmpdir(), "budget-surface-"));
    const skill = (name: string, extra: string) => {
      mkdirSync(join(root, ".claude", "skills", name), { recursive: true });
      writeFileSync(join(root, ".claude", "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${"d".repeat(100)}\n${extra}---\nbody\n`, "utf8");
    };
    skill("listed", "");
    skill("hidden", "disable-model-invocation: true\n");
    expect(measure(root).alwaysLoaded["skills: description + when_to_use"]).toBe(100);
  });
});

describe("activation surface is decoded, not sliced (H35)", () => {
  const tree = (skill: string) => {
    const root = mkdtempSync(join(tmpdir(), "budget-h35-"));
    mkdirSync(join(root, ".claude", "skills", "a"), { recursive: true });
    writeFileSync(join(root, ".claude", "skills", "a", "SKILL.md"), skill, "utf8");
    return root;
  };
  const pluginHome = (skills: Record<string, string>) => {
    const home = mkdtempSync(join(tmpdir(), "budget-h35-home-"));
    const dir = join(home, ".claude", "plugins", "cache", "m", "p", "1.0.0");
    for (const [name, text] of Object.entries(skills)) {
      mkdirSync(join(dir, "skills", name), { recursive: true });
      writeFileSync(join(dir, "skills", name, "SKILL.md"), text, "utf8");
    }
    writeFileSync(join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins: { "p@m": [{ scope: "user", installPath: dir }] } }));
    return home;
  };

  it("counts the decoded value of a quoted description, not its YAML punctuation", () => {
    const root = tree('---\nname: a\ndescription: "abcde"\n---\nbody\n');
    expect(measure(root, mkdtempSync(join(tmpdir(), "h35-empty-"))).alwaysLoaded["skills: description + when_to_use"]).toBe(5);
  });

  it("applies disable-model-invocation to plugin skills too, not only to local ones", () => {
    const home = pluginHome({
      listed: "---\nname: listed\ndescription: abcde\n---\nbody\n",
      hidden: "---\nname: hidden\ndescription: abcde\ndisable-model-invocation: true\n---\nbody\n",
    });
    const root = tree("---\nname: a\ndescription: x\n---\nbody\n");
    expect(measure(root, home).informative?.[PLUGIN_SURFACE_LABEL]).toBe(5);
  });

  it("reports a plugin skill with broken frontmatter as zero instead of throwing", () => {
    const home = pluginHome({ broken: "no frontmatter at all\n" });
    const root = tree("---\nname: a\ndescription: x\n---\nbody\n");
    expect(measure(root, home).informative?.[PLUGIN_SURFACE_LABEL]).toBe(0);
  });
});

describe("the ratchet is machine-independent (H35)", () => {
  it("never fails because this machine installed more plugins", () => {
    const snapshot = { alwaysLoaded: { "CLAUDE.md": 1000 }, skillBodies: {}, informative: { [PLUGIN_SURFACE_LABEL]: 100 } };
    const current = { alwaysLoaded: { "CLAUDE.md": 1000 }, skillBodies: {}, informative: { [PLUGIN_SURFACE_LABEL]: 9999 } };
    expect(compare(current, snapshot)).toEqual([]);
  });

  it("does not let a key that left the ratchet loosen the total", () => {
    const snapshot = { alwaysLoaded: { "CLAUDE.md": 1000, "retired-row": 5000 }, skillBodies: {} };
    const current = { alwaysLoaded: { "CLAUDE.md": 1100 }, skillBodies: {} };
    expect(compare(current, snapshot).map((v) => v.key)).toEqual(["CLAUDE.md", "always-loaded TOTAL"]);
  });
});

// Quality review 2026-09-12, coordinator pass on H35. `compare` stopped counting the
// retired plugin row, but `doctor.ts` still printed `total(snapshot.alwaysLoaded)` in its
// detail line, so the report read "48672 B <= snapshot 52200 B" and announced 3,528 bytes
// of headroom that the ratchet would never grant. The verdict was right and the number was
// not. One exported function now answers "what does the snapshot allow today".
describe("the snapshot total a reader is shown matches the one enforced (H35)", () => {
  it("ignores snapshot rows the measurement no longer tracks", () => {
    const snapshot = { alwaysLoaded: { "CLAUDE.md": 1000, "retired-row": 5000 }, skillBodies: {} };
    const current = { alwaysLoaded: { "CLAUDE.md": 1000 }, skillBodies: {} };
    expect(ratchetedSnapshotTotal(current, snapshot)).toBe(1000);
  });

  it("agrees with compare on the real repository", () => {
    const snapshot = loadSnapshot(SNAPSHOT_DIR);
    if (!snapshot) throw new Error("no snapshot to compare against");
    const current = measure(REPO);
    const allowed = ratchetedSnapshotTotal(current, snapshot);
    // No violation means the measured total is within what the snapshot allows. The number
    // shown must carry the same meaning, so it can never exceed the enforced allowance.
    expect(compare(current, snapshot).some((v) => v.key === "always-loaded TOTAL")).toBe(false);
    expect(total(current.alwaysLoaded)).toBeLessThanOrEqual(allowed);
  });
});
