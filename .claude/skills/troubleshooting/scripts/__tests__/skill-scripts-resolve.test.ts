import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Quality review 2026-09-11 — H14: `analyze-error.ts` imports two modules that do not
// exist, so the script a skill advertises cannot run. Checked as a class, not as one
// instance: every relative import of every script a skill ships must resolve on disk.
const skillsRoot = resolve(import.meta.dir, "..", "..", "..");
const IMPORT_RE = /^\s*import[^"']*["'](\.[^"']+)["']/gm;
const CANDIDATES = ["", ".ts", ".js", ".mjs", ".json", "/index.ts", "/index.js"];

function scriptFiles(): string[] {
  const out: string[] = [];
  for (const skill of readdirSync(skillsRoot)) {
    const dir = join(skillsRoot, skill, "scripts");
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) if (/\.(ts|js|mjs)$/.test(f)) out.push(join(dir, f));
  }
  return out;
}

describe("skill scripts have no dead imports (H14)", () => {
  const files = scriptFiles();

  it("finds the scripts that skills ship", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`resolves every relative import of ${file.split(/[\/]/).slice(-3).join("/")}`, () => {
      const source = readFileSync(file, "utf8");
      const missing: string[] = [];
      for (const m of source.matchAll(IMPORT_RE)) {
        const base = resolve(dirname(file), m[1]);
        if (!CANDIDATES.some((ext) => existsSync(base + ext))) missing.push(m[1]);
      }
      expect(missing).toEqual([]);
    });
  }
});
