import { describe, expect, it } from "bun:test";
import { lintEstate, summarizeEstate, VOLATILE_SHAPE, VOLATILE_STATUS } from "../lib/memory-estate";

const good = (name: string, extra = "") =>
  `---\nname: ${name}\ndescription: Why the thing is the way it is\nmetadata:\n  type: project\n---\n\nBody.${extra}\n`;

const index = (...stems: string[]) => stems.map((s) => `- [${s}](${s}.md) — a hook`).join("\n") + "\n";

const errors = (r: { findings: { level: string; message: string; file: string }[] }) => r.findings.filter((f) => f.level === "error");

describe("lintEstate — the invariants a grader can actually prove", () => {
  it("passes a conforming estate and counts the index in UTF-8 bytes", () => {
    const report = lintEstate(index("alpha", "beta"), [
      { name: "alpha.md", text: good("alpha") },
      { name: "beta.md", text: good("beta") },
    ]);
    expect(report.findings).toEqual([]);
    expect(report.entries).toBe(2);
    expect(summarizeEstate(report).status).toBe("🟢");

    // Multibyte: an em dash is 3 bytes, so a length in characters would under-report.
    const oneLine = "- [alpha](alpha.md) — a hook\n";
    expect(lintEstate(oneLine, [{ name: "alpha.md", text: good("alpha") }]).indexBytes).toBe(Buffer.byteLength(oneLine, "utf8"));
    expect(Buffer.byteLength(oneLine, "utf8")).toBeGreaterThan(oneLine.length);
  });

  it("catches both directions of the index/file bijection, and duplicate entries", () => {
    const orphanFile = lintEstate(index("alpha"), [
      { name: "alpha.md", text: good("alpha") },
      { name: "beta.md", text: good("beta") },
    ]);
    expect(orphanFile.findings).toContainEqual({ level: "error", file: "beta.md", message: "file has no entry in MEMORY.md" });

    const orphanEntry = lintEstate(index("alpha", "ghost"), [{ name: "alpha.md", text: good("alpha") }]);
    expect(orphanEntry.findings.some((f) => f.message.includes("missing file: ghost.md"))).toBe(true);

    // Two entries for one file is not a bijection, and a Set used to swallow it.
    const twice = `- [alpha](alpha.md) — a hook\n- [Alpha again](alpha.md) — another hook\n`;
    expect(errors(lintEstate(twice, [{ name: "alpha.md", text: good("alpha") }])).some((f) => f.message.includes("2 entries point at"))).toBe(true);

    // A target that drops the extension resolved by accident before.
    const noExt = `- [alpha](alpha) — a hook\n`;
    expect(errors(lintEstate(noExt, [{ name: "alpha.md", text: good("alpha") }])).some((f) => f.message.includes("missing file: alpha"))).toBe(true);
  });

  it("catches a wikilink that resolves to no file, and one that is malformed", () => {
    const dangling = lintEstate(index("alpha"), [{ name: "alpha.md", text: good("alpha", " See [[removed-file]].") }]);
    expect(dangling.findings).toContainEqual({ level: "error", file: "alpha.md", message: "[[removed-file]] resolves to no file" });

    // These matched no slug pattern and used to vanish from the analysis entirely.
    for (const bad of ["Missing", "missing_file"]) {
      const report = lintEstate(index("alpha"), [{ name: "alpha.md", text: good("alpha", ` See [[${bad}]].`) }]);
      expect(report.findings).toContainEqual({ level: "error", file: "alpha.md", message: `[[${bad}]] is not a valid memory slug` });
    }
  });

  it("does not mistake prose about links for links, in either fence style", () => {
    const text = good("alpha", " Checks that every `[[link]]` resolves.\n\n```\n[[fenced-example]]\n```\n\n~~~\n[[tilde-example]]\n~~~\n");
    expect(lintEstate(index("alpha"), [{ name: "alpha.md", text }]).findings).toEqual([]);
  });

  it("rejects a name that does not match its file, and a type outside the enum", () => {
    const renamed = lintEstate(index("alpha"), [{ name: "alpha.md", text: good("older-slug") }]);
    expect(renamed.findings.some((f) => f.message.includes("does not match the file name"))).toBe(true);

    const badType = good("alpha").replace("type: project", "type: journal");
    expect(lintEstate(index("alpha"), [{ name: "alpha.md", text: badType }]).findings.some((f) => f.message.includes('type "journal" is not one of'))).toBe(true);
  });

  it("errors on tokens that name a moment, and only warns on status words", () => {
    // Each of these rotted in the real estate.
    for (const shape of ["2026-09-10", "PR #12", "d7fad55", "D:/PYTHON/poneglyph-main", "/home/oriol/project/config"]) {
      expect(VOLATILE_SHAPE.test(shape)).toBe(true);
    }
    // Shapes that look volatile and are not. A `reference` memory exists to carry links, so a
    // URL flagged as a Windows path would have made the contract unusable for its own type.
    for (const safe of [
      "Where the platform documentation lives: https://docs.example.com/memory",
      "the dashboard at http://localhost:3000",
      "the old value was effaced by the rewrite",
      "Why consult stays the routing layer over the vendor bridges",
    ]) {
      expect(VOLATILE_SHAPE.test(safe)).toBe(false);
    }

    // Status words are ambiguous: a subject can contain one, so they never block.
    expect(VOLATILE_STATUS.test("Handling closed connections")).toBe(true);
    const withStatus = good("alpha").replace("Why the thing is the way it is", "Handling closed connections");
    const report = lintEstate(index("alpha"), [{ name: "alpha.md", text: withStatus }]);
    expect(errors(report)).toEqual([]);
    expect(report.findings).toContainEqual({ level: "warn", file: "alpha.md", message: "description may be asserting a status" });

    const inDescription = good("alpha").replace("Why the thing is the way it is", "Served from D:/PYTHON/poneglyph-main");
    expect(lintEstate(index("alpha"), [{ name: "alpha.md", text: inDescription }]).findings).toContainEqual({
      level: "error",
      file: "alpha.md",
      message: "description carries a token that names a moment",
    });
  });

  it("reports legacy metadata keys as warnings, never as errors", () => {
    const legacy = good("alpha").replace("  type: project", "  node_type: memory\n  type: project\n  originSessionId: abc");
    const report = lintEstate(index("alpha"), [{ name: "alpha.md", text: legacy }]);
    expect(report.findings.every((f) => f.level === "warn")).toBe(true);
    expect(report.findings.map((f) => f.message).sort()).toEqual([
      'unknown metadata key "node_type"',
      'unknown metadata key "originSessionId"',
    ]);
    expect(summarizeEstate(report).status).toBe("🟡");
  });

  it("keeps analysing the files after one with unreadable frontmatter", () => {
    // The earlier version of this test passed even if the lint stopped at the bad file, because
    // it only asserted that `beta` produced nothing. `beta` now carries its own defect.
    const report = lintEstate(index("alpha", "beta"), [
      { name: "alpha.md", text: "no frontmatter here\n" },
      { name: "beta.md", text: good("beta", " See [[gone]].") },
    ]);
    expect(report.findings).toContainEqual({ level: "error", file: "beta.md", message: "[[gone]] resolves to no file" });
    expect(report.findings.some((f) => f.file === "alpha.md" && f.message.startsWith("frontmatter unreadable"))).toBe(true);
  });
});
