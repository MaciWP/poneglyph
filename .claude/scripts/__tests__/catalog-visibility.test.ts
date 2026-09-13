import { expect, test } from "bun:test";
import { activationSurface } from "../lib/budget";
const skill = '---\nname: example\ndescription: Useful description\nwhen_to_use: A precise trigger\n---\n';
test("name-only and hidden Claude entries have distinct measured surfaces", () => {
  expect(activationSurface(skill, "name-only")).toBe(Buffer.byteLength("example"));
  expect(activationSurface(skill, "off")).toBe(0);
  expect(activationSurface(skill, "user-invocable-only")).toBe(0);
  expect(activationSurface(skill)).toBeGreaterThan(activationSurface(skill, "name-only"));
});
