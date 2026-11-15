import { expect, test } from "bun:test";
import { prose as logPose } from "../../../plugins/log-pose/hooks/core.ts";
import { prose as robin } from "../../../plugins/robin/hooks/core.ts";
import { prose as workboard } from "../../../plugins/workboard/hooks/core.ts";

// A mod cannot import another, so robin and log-pose carry copies of workboard's `prose()`.
test("the three copies of prose() are the same code", () => {
  expect(robin.toString()).toBe(workboard.toString());
  expect(logPose.toString()).toBe(workboard.toString());
});

test("and agree on fences, nested fences and an open fence", () => {
  const lines = ["a", "```ts", "x", "~~~", "y", "```", "b", "````", "```", "c"];
  for (const copy of [robin, logPose]) expect(copy(lines)).toEqual(workboard(lines));
  expect(workboard(lines)).toEqual([true, false, false, false, false, false, true, false, false, false]);
});
