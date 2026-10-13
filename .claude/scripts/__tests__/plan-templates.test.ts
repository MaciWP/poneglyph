import { expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// `flow` copies these templates into every plan, and `flow-state.ts` reads the copies'
// frontmatter. A placeholder such as `{NNN}-{slug}` left unquoted is a YAML flow mapping,
// so the copy fails to parse before anyone fills it in.
const dir = resolve(import.meta.dir, "..", "..", "plans", "templates");

it("every plan template has frontmatter that parses as YAML", () => {
  const broken = readdirSync(dir)
    .filter((f) => f.endsWith(".template.md"))
    .flatMap((f) => {
      const fm = readFileSync(join(dir, f), "utf8").match(/^---\n([\s\S]*?)\n---/);
      if (!fm) return [`${f}: no frontmatter`];
      try {
        Bun.YAML.parse(fm[1]);
        return [];
      } catch (e) {
        return [`${f}: ${(e as Error).message}`];
      }
    });
  expect(broken).toEqual([]);
});
