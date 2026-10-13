import { describe, test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCases } from "../router-heldout";

describe("loadCases", () => {
  const dir = mkdtempSync(join(tmpdir(), "router-heldout-"));
  const cases = join(dir, "cases.jsonl");
  const judged = join(dir, "judged.jsonl");
  writeFileSync(cases, [
    JSON.stringify({ prompt: "a", expected: ["x"], source: "typed" }),
    JSON.stringify({ prompt: "b", expected: [], source: "negative" }),
  ].join("\n") + "\n");
  writeFileSync(judged, [JSON.stringify(["y"]), JSON.stringify(["z"])].join("\n") + "\n");

  test("merges judge labels by line into the gold set", () => {
    const [a, b] = loadCases(cases, judged);
    expect(a.expected).toEqual(["x", "y"]);
    expect(b).toMatchObject({ expected: ["z"], source: "autonomous" });
  });

  test("without a judged file (--cases) the labels stay as written", () => {
    const [a, b] = loadCases(cases, null);
    expect(a.expected).toEqual(["x"]);
    expect(b).toMatchObject({ expected: [], source: "negative" });
  });
});
