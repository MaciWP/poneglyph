import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Quality review 2026-09-11, H50. build and critic each stated their closing report
// twice: once in the numbered step that produces it, once again in a trailing
// "Output format reminder". Two copies of one contract drift apart -- critic's copies
// already had: the reminder listed `review-patterns modes` and `drillme`, the step did
// not. The step that produces the report is the single source; the reminder is gone.
const root = resolve(import.meta.dir, "..", "..", "..", "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const SKILLS = [
  { name: "build", file: ".claude/skills/build/SKILL.md", marker: "HU US{N} closed." },
  { name: "critic", file: ".claude/skills/critic/SKILL.md", marker: "Critic verdict" },
];

describe("closing report is stated once per skill", () => {
  for (const { name, file, marker } of SKILLS) {
    it(`${name} has no trailing Output format reminder`, () => {
      expect(read(file)).not.toMatch(/^##+\s*Output format reminder\s*$/m);
    });

    it(`${name} states its report block exactly once`, () => {
      const hits = read(file).split("\n").filter((l) => l.includes(marker)).length;
      expect(hits).toBe(1);
    });
  }

  // Deleting the reminder must not narrow the contract: critic's only surviving copy
  // carries the two fields that lived exclusively in the deleted block.
  it("critic keeps the fields that only the reminder carried", () => {
    const critic = read(".claude/skills/critic/SKILL.md");
    expect(critic).toContain("review-patterns modes:");
    expect(critic).toContain("drillme:");
  });
});
