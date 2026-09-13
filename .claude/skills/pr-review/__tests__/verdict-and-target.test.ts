import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Quality review 2026-09-10, finding H55 (same class as H09: the verdict counts majors
// instead of consequences). Two independent defects share the id, so they are locked
// separately: (a) the APPROVE rule contradicts the ticket-trace floor; (b) the gather step
// diffs HEAD even when step 1 resolved a PR or another branch as the target.
const skill = resolve(import.meta.dir, "..");

function read(...parts: string[]): string {
  return readFileSync(join(skill, ...parts), "utf8").replace(/\r\n/g, "\n");
}

const body = read("SKILL.md");
const core = read("references", "01-criteria-core.md");
const trace = read("references", "02-ticket-trace.md");

// H55(a). `02-ticket-trace.md` says a required AC at ✗ forbids a plain APPROVE. Both the
// body and the criteria reference stated APPROVE as "0 critical, ≤2 major", and one
// unimplemented required AC is exactly one Major — so the same review had two verdicts.
describe("the APPROVE rule honours the required-AC floor (H55a)", () => {
  it("finds the ticket-trace floor", () => {
    expect(trace).toMatch(/cannot be plain APPROVE/i);
  });

  // The rule has one owner. Any other file may point at it, but restating the thresholds
  // is what let the two copies drift apart in the first place.
  it("states the APPROVE thresholds in exactly one file", () => {
    const THRESHOLDS = /APPROVE\s*\(0 critical/i;
    const copies = [
      ["SKILL.md", body],
      ["references/01-criteria-core.md", core],
      ["references/02-ticket-trace.md", trace],
    ].filter(([, text]) => THRESHOLDS.test(text as string)).map(([name]) => name);
    expect(copies).toEqual(["references/01-criteria-core.md"]);
  });

  it("the owning file names the required-AC floor next to the thresholds", () => {
    const verdict = core.split("\n").find((l) => /APPROVE\s*\(0 critical/i.test(l)) ?? "";
    const near = core.split("\n");
    const i = near.findIndex((l) => /APPROVE\s*\(0 critical/i.test(l));
    const window = near.slice(Math.max(0, i - 2), i + 4).join(" ");
    expect(verdict).not.toBe("");
    expect(window).toMatch(/\bAC\b/);
    expect(window).toMatch(/required|requisito/i);
  });
});

// H55(b). Step 1 resolves a target that may be a PR number, a PR URL or another branch.
// Step 3 then ran `git log --oneline <base>..HEAD`, which reviews the local checkout
// instead of the resolved target whenever the two differ.
describe("the diff is taken against the resolved target (H55b)", () => {
  const gather = body.split("### 3.")[1]?.split("\n### ")[0] ?? "";

  it("finds the gather step", () => {
    expect(gather).toContain("git log --oneline");
  });

  it("names the resolved target rather than assuming HEAD", () => {
    expect(gather).toMatch(/resolved target|target head|<target|gh pr diff/i);
  });

  it("uses no bare ..HEAD range outside an explicit local-mode statement", () => {
    const offenders = gather
      .split("\n")
      .filter((l) => /\.\.\.?HEAD\b/.test(l) && !/local mode/i.test(l));
    expect(offenders).toEqual([]);
  });
});
