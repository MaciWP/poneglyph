import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveVersion, loadVersion, validateRecipe, schedule } from "./store";

const root = mkdtempSync(join(tmpdir(), "poneglyph-store-"));
test("versions preserve previous content and detect tampering", () => {
  const a = saveVersion(root, "prompt", { text: "First" });
  const b = saveVersion(root, "prompt", { text: "Second" });
  expect(a).not.toBe(b);
  expect(loadVersion<{text:string}>(root, "prompt", a)).toEqual({ text: "First" });
  expect(saveVersion(root, "prompt", { text: "First" })).toBe(a);
  writeFileSync(join(root, "objects", "prompt", a + ".json"), "{}");
  expect(() => loadVersion(root, "prompt", a)).toThrow("hash");
  expect(() => loadVersion(root, "prompt", "../escape")).toThrow();
});
const recipe = { version: 1, name: "comparison", host: "claude", model: "explicit-model", mode: "simulation", factor: "profile", seed: 42, trials: 2, scenarios: ["ownership", "creation"], conditions: [{ id: "base", profile: "a".repeat(64), prompt: "b".repeat(64) }, { id: "current", profile: "c".repeat(64), prompt: "b".repeat(64) }], limits: { maxRuns: 8, secondsPerRun: 10, totalSeconds: 100 } };
test("schedules distinct trials reproducibly without exceeding the agreed limits", () => {
  const p = validateRecipe(recipe);
  expect(schedule(p)).toEqual(schedule(p));
  expect(schedule(p)).toHaveLength(8);
  expect(new Set(schedule(p).map(r => r.id)).size).toBe(8);
  for (const invalid of [{ ...recipe, model: "" }, { ...recipe, trials: 0 }, { ...recipe, scenarios: ["../escape"] }, { ...recipe, limits: { ...recipe.limits, maxRuns: 7 } }, { ...recipe, conditions: [recipe.conditions[0], recipe.conditions[0]] }]) expect(() => validateRecipe(invalid)).toThrow();
});
