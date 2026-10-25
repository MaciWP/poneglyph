import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// whats-new keeps one record of how far upstream changes were reviewed. Before it, the
// playbook heading and lookup.md each carried their own stamp, free to drift apart. These
// tests lock the single record: the marks table exists and covers every supported host,
// the skill reads it and stays user-invoked, and the playbook points to it with no stamp.
const root = resolve(import.meta.dir, "..", "..", "..", "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8").replace(/\r\n/g, "\n");

const lookup = read(".claude/skills/harness-config/references/lookup.md");
const skill = read(".claude/skills/whats-new/SKILL.md");
const playbook = read(".claude/docs/model-uplift-playbook.md");

function markRows(): string[][] {
  const section = lookup.split("## Upstream marks")[1];
  if (!section) throw new Error("no §Upstream marks in lookup.md");
  return section
    .split("\n")
    .filter((l) => /^\| `[a-z-]+` \|/.test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}

describe("upstream marks: one record, read by whats-new", () => {
  it("has a filled row for every supported host", () => {
    const rows = markRows();
    const sources = rows.map((r) => r[0].replace(/`/g, ""));
    for (const host of ["claude-code", "codex", "grok"]) expect(sources).toContain(host);
    for (const [, location, mark] of rows) {
      expect(location.length).toBeGreaterThan(0);
      expect(mark.length).toBeGreaterThan(0);
    }
  });

  it("whats-new is user-invoked and reads the marks table", () => {
    expect(skill).toMatch(/^disable-model-invocation: true$/m);
    expect(skill).toContain("lookup.md` §Upstream marks");
  });

  it("the playbook heading points to the marks and keeps no stamp of its own", () => {
    const heading = playbook.split("\n").find((l) => l.startsWith("## 4."));
    expect(heading).toBeDefined();
    expect(heading).toContain("§Upstream marks");
    expect(heading).not.toMatch(/\d+\.\d+\.\d+|\d{4}-\d{2}-\d{2}/);
  });
});
