import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkills } from "../skill-activation";

function catalog(text: string): string {
  const root = mkdtempSync(join(tmpdir(), "skill-eligibility-"));
  mkdirSync(join(root, "same"));
  writeFileSync(join(root, "same", "SKILL.md"), text);
  return root;
}
const core = catalog('---\nname: same\ndescription: Core skill\nmetadata:\n  keywords: core only phrase\n---\n');
test("an empty valid override reserves its name", () => {
  const local = catalog('---\nname: same\ndescription: Project skill\nmetadata:\n  keywords: ""\n---\n');
  expect(loadSkills([local, core])).toEqual([]);
});
test("a hidden override reserves its name on Claude but its extra key does not disable Codex", () => {
  const local = catalog('---\nname: same\ndescription: Project skill\nmetadata:\n  keywords: local only phrase\ndisable-model-invocation: true\n---\n');
  expect(loadSkills([local, core])).toEqual([]);
  expect(loadSkills([local, core], "codex")[0].keywords).toEqual(["local only phrase"]);
});
test("malformed definitions permit a valid fallback", () => {
  for (const text of ["broken", "---\nname: [\n---\n", "---\nmetadata: {}\n---\n"]) {
    expect(loadSkills([catalog(text), core])[0].keywords).toEqual(["core only phrase"]);
  }
});
test("Claude effective settings hide manual and disabled entries but keep name-only entries", () => {
  for (const mode of ["off", "user-invocable-only"]) {
    expect(loadSkills([core], "claude", { same: mode })).toEqual([]);
  }
  expect(loadSkills([core], "claude", { same: "name-only" })).toHaveLength(1);
});
