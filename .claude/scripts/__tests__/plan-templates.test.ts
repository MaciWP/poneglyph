import { expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { frontmatter } from "../lib/skill-metadata";

// `flow` copies these templates into every plan, and `flow-state.ts` reads the copies'
// frontmatter. A placeholder such as `{NNN}-{slug}` left unquoted is a YAML flow mapping,
// so the copy fails to parse before anyone fills it in.
const dir = resolve(import.meta.dir, "..", "..", "plans", "templates");

it("every plan template has frontmatter that parses as YAML", () => {
  const broken = readdirSync(dir)
    .filter((f) => f.endsWith(".template.md"))
    .flatMap((f) => {
      try {
        frontmatter(readFileSync(join(dir, f), "utf8"));
        return [];
      } catch (e) {
        return [`${f}: ${(e as Error).message}`];
      }
    });
  expect(broken).toEqual([]);
});

it("parses a template saved with CRLF line endings", () => {
  const first = readdirSync(dir).find((f) => f.endsWith(".template.md"))!;
  const crlf = readFileSync(join(dir, first), "utf8").replace(/\r?\n/g, "\r\n");
  expect(() => frontmatter(crlf)).not.toThrow();
});
