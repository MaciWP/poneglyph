import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkills } from "../../../hooks/skill-activation";
import { frontmatter, validate } from "../../../scripts/check-config";
import { loadSkillsFromDisk, rank } from "../lib/rank";

const roots: string[] = [];
function directory(): string {
  const root = mkdtempSync(join(tmpdir(), "poneglyph-skill-metadata-"));
  roots.push(root);
  return root;
}
function write(root: string, name: string, content: string): void {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(join(root, name, "SKILL.md"), content, "utf8");
}
const skill = (name: string, description: string, extra = "") =>
  `---\nname: ${name}\ndescription: ${description}\n${extra}---\nRead the source.\n`;
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("disk readers share decoded YAML metadata", () => {
  test.each([
    ["|", "\n", "Primera línea.\nSegunda descripción.\n"],
    [">-", "\r\n", "Primera línea. Segunda descripción."],
  ])("reads complete %s descriptions and wrapped UTF-8 keywords", (style, eol, description) => {
    const root = directory();
    const content = skill("sample", `${style}\n  Primera línea.\n  Segunda descripción.`,
      'metadata:\n  keywords: |\n    Keywords - revisión técnica, review\n    comment, último - "frase de ejemplo"\nwhen_to_use: Never a keyword.\n').replace(/\n/g, eol);
    write(root, "sample", content);
    const keywords = ["revisión técnica", "review comment", "último", "frase de ejemplo"];
    expect(frontmatter(content).fields.description).toBe(description);
    expect(loadSkillsFromDisk([root])).toEqual([{ name: "sample", description, keywords }]);
    expect(loadSkills([root])).toEqual([{ name: "sample", keywords }]);
    expect(rank("segunda descripción", loadSkillsFromDisk([root]))[0]?.name).toBe("sample");
  });

  test.each([
    "'revisión técnica, última frase'",
    ">-\n    revisión técnica,\n    última frase",
    ">\n    Keywords - revisión técnica,\n    última frase",
  ])("prefers metadata.keywords %s over legacy description keywords", value => {
    const root = directory();
    write(root, "sample", skill("sample", "'Legacy. Keywords - obsolete phrase'", `metadata:\n  keywords: ${value}\n`));
    const keywords = ["revisión técnica", "última frase"];
    expect(loadSkillsFromDisk([root])[0].keywords).toEqual(keywords);
    expect(loadSkills([root])).toEqual([{ name: "sample", keywords }]);
  });

  test.each(["''", "null", "42", "[not, a, string]"])("does not fall back when metadata.keywords is present as %s", value => {
    const root = directory();
    write(root, "sample", skill("sample", "'Legacy. Keywords - obsolete phrase'", `metadata:\n  keywords: ${value}\n`));
    expect(loadSkillsFromDisk([root])[0].keywords).toEqual([]);
    expect(loadSkills([root])).toEqual([]);
  });

  test("uses legacy description keywords only when the metadata key is absent", () => {
    const root = directory();
    write(root, "sample", skill("sample", '|\n  Legacy description.\n  Keywords - revisión técnica, review\n  comment', "metadata:\n  author: example\n"));
    const keywords = ["revisión técnica", "review comment"];
    expect(loadSkillsFromDisk([root])[0].keywords).toEqual(keywords);
    expect(loadSkills([root])).toEqual([{ name: "sample", keywords }]);
  });

  test("keeps keyword-free skills valid and ignores body markers", () => {
    const root = directory();
    const content = skill("sample", "'A quoted description: café.'") + "Keywords - body only\n";
    write(root, "sample", content);
    expect(loadSkillsFromDisk([root])).toEqual([{ name: "sample", description: "A quoted description: café.", keywords: [] }]);
    expect(loadSkills([root])).toEqual([]);
    const report = validate({ files: new Map([[".claude/skills/sample/SKILL.md", content]]), links: [] });
    expect(report.findings.filter(f => f.severity === "error")).toEqual([]);
  });

  test("parses frontmatter beyond the old 2500-character cutoff", () => {
    const root = directory();
    write(root, "sample", skill("sample", "Complete description.", `# ${"padding ".repeat(400)}\nmetadata:\n  keywords: final phrase\n`));
    expect(loadSkillsFromDisk([root])).toEqual([{ name: "sample", description: "Complete description.", keywords: ["final phrase"] }]);
    expect(loadSkills([root])).toEqual([{ name: "sample", keywords: ["final phrase"] }]);
  });

  test.each(["---\n[broken\n---\nBody", "---\n- item\n---\nBody", "description: no header"])("skips invalid frontmatter without accepting body keywords", text => {
    const root = directory();
    const content = text + "\nKeywords - body only";
    write(root, "broken", content);
    expect(() => frontmatter(content)).toThrow();
    expect(loadSkillsFromDisk([root])).toEqual([]);
    expect(loadSkills([root])).toEqual([]);
  });

  test("preserves directory precedence, fallback, and directory-based names", () => {
    const local = directory(), global = directory();
    write(local, "sample", skill("another-name", "Local description.", "metadata:\n  keywords: local phrase\n"));
    write(global, "sample", skill("sample", "Global description.", "metadata:\n  keywords: global phrase\n"));
    write(local, "keyword-free", skill("keyword-free", "Local without keywords."));
    write(global, "keyword-free", skill("keyword-free", "Global with keywords.", "metadata:\n  keywords: global fallback\n"));
    write(local, "broken", "---\n[broken\n---\nBody");
    write(global, "broken", skill("broken", "Readable fallback.", "metadata:\n  keywords: valid fallback\n"));
    const dirs = [join(local, "missing"), join(local, "sample", "SKILL.md"), local, global];
    const advisor = loadSkillsFromDisk(dirs), hook = loadSkills(dirs);
    expect(advisor.find(s => s.name === "sample")).toEqual({ name: "sample", description: "Local description.", keywords: ["local phrase"] });
    expect(hook.find(s => s.name === "sample")?.keywords).toEqual(["local phrase"]);
    expect(advisor.find(s => s.name === "keyword-free")?.keywords).toEqual([]);
    expect(hook.find(s => s.name === "keyword-free")).toBeUndefined();
    expect(advisor.find(s => s.name === "broken")?.description).toBe("Readable fallback.");
    expect(hook.find(s => s.name === "broken")?.keywords).toEqual(["valid fallback"]);
  });

  test("the real catalog has complete descriptions and identical keywords in both readers", () => {
    const root = join(import.meta.dir, "../..");
    const entries = readdirSync(root).filter(name => {
      try { return readFileSync(join(root, name, "SKILL.md"), "utf8").length > 0; } catch { return false; }
    });
    // Compare decoded metadata without Claude's separate visibility policy.
    const advisor = loadSkillsFromDisk([root]), hook = loadSkills([root], "codex");
    expect(entries.length).toBeGreaterThan(0);
    expect(advisor.map(s => s.name).sort()).toEqual(entries.sort());
    for (const entry of advisor) {
      const { fields } = frontmatter(readFileSync(join(root, entry.name, "SKILL.md"), "utf8"));
      expect(entry.description).toBe(fields.description);
      expect(entry.description.trim().length).toBeGreaterThan(1);
    }
    expect(hook).toEqual(advisor.filter(s => s.keywords.length > 0).map(({ name, keywords }) => ({ name, keywords })));
  });
});
