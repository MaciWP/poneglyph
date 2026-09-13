import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Quality review 2026-09-10, findings H19, H30 and H53. Three contradictions between the
// /flow-lifecycle phase skills. Each one is a pair of rules that a single real case cannot satisfy,
// so each is locked here as a text invariant on the doctrine files themselves.
const root = resolve(import.meta.dir, "..", "..", "..", "..");
const claude = join(root, ".claude");

function read(...parts: string[]): string {
  return readFileSync(join(claude, ...parts), "utf8").replace(/\r\n/g, "\n");
}

const scope = read("skills", "flow-scope", "SKILL.md");
const techPlan = read("skills", "flow-plan", "SKILL.md");
const tddDesign = read("skills", "flow-test-plan", "SKILL.md");
const testPolicy = read("rules", "test-policy.md");
const bank = read("skills", "drillme-clarify", "references", "03-phase-questions.md");

// H19. scope forbade naming any technology in spec.md; flow-plan reopened Phase 1 whenever
// a library was not already in spec.md Constraints. A new library satisfied neither rule:
// it could not be recorded in Phase 1 and it could not be introduced in Phase 2.
describe("a new library can satisfy scope and flow-plan at once (H19)", () => {
  it("finds the scope rule about technology in spec.md", () => {
    expect(scope).toContain("No technology in spec.md");
  });

  it("lets scope record a technology constraint the user actually imposes", () => {
    const rule = scope.split("\n").find((l) => l.includes("No technology in spec.md")) ?? "";
    expect(rule).toMatch(/constraint/i);
  });

  // The offending shape is "absent from Constraints -> reopen scope". Reopening because the
  // plan CONTRADICTS a recorded constraint stays legitimate and is not matched here.
  it("never routes a library back to Phase 1 merely for being absent from Constraints", () => {
    const ABSENCE = /(without (it )?being in|not (justified )?(by|in)|absent from|missing from)[^|\n]{0,60}\bconstraints?\b/i;
    const REOPEN = /reopen\s+(scope|phase\s*1)/i;
    const offenders = techPlan
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => ABSENCE.test(line) && REOPEN.test(line))
      .map(({ line, n }) => `flow-plan/SKILL.md:${n}  ${line.trim().slice(0, 90)}`);
    expect(offenders).toEqual([]);
  });

  it("gives flow-plan the other half of the contract: justify the new library in the plan", () => {
    expect(techPlan).toMatch(/justif\w*[^.|\n]*\bin the plan\b/i);
  });
});

// H30. `03-phase-questions.md` declares itself the canonical bank and forbids phase skills
// from duplicating it. Three of them copied it anyway and drifted: flow-plan announced 5
// questions and listed 6, flow-test-plan copied 3 of 4.
// The phase skills now cite the same bank, including retro and its location category.
describe("phase skills cite the canonical drillme-clarify bank instead of copying it (H30)", () => {
  function phase(heading: string): { titles: string[]; tags: string[] } {
    const section = bank.split(`## ${heading}`)[1]?.split("\n## ")[0] ?? "";
    const rows = [...section.matchAll(/^\|\s*\d+\s*\|\s*\*\*([^*]+)\*\*[^|]*\|\s*`(\[[a-z]+\])`\s*\|/gm)];
    return { titles: rows.map((m) => m[1].trim()), tags: rows.map((m) => m[2]) };
  }

  const p1 = phase("Phase 1 — Scope (scope)");
  const p2 = phase("Phase 2 — Plan (flow-plan)");
  const p25 = phase("Phase 2.5 — TDD design (flow-test-plan)");

  it("parses the canonical bank", () => {
    expect(p1.titles).toHaveLength(5);
    expect(p2.titles).toHaveLength(6);
    expect(p25.titles).toHaveLength(4);
  });

  const CITATION = /03-phase-questions\.md/;

  it("flow-plan cites the canonical file", () => {
    expect(techPlan).toMatch(CITATION);
  });

  it("flow-test-plan cites the canonical file", () => {
    expect(tddDesign).toMatch(CITATION);
  });

  it("flow-plan does not re-list the Phase 2 questions", () => {
    expect(p2.titles.filter((t) => techPlan.includes(t))).toEqual([]);
  });

  it("flow-test-plan does not re-list the Phase 2.5 questions", () => {
    expect(p25.titles.filter((t) => tddDesign.includes(t))).toEqual([]);
  });

  // A stated count that disagrees with the bank is the drift itself (flow-plan said 5 for a
  // bank of 6). A skill that states no count is fine; one that states a wrong count is not.
  it("no phase skill announces a question count the bank contradicts", () => {
    const stated = (body: string) => /(\d+)\s+phase-specific questions/i.exec(body);
    const wrong: string[] = [];
    for (const [name, body, expected] of [
      ["flow-plan", techPlan, p2.titles.length],
      ["flow-test-plan", tddDesign, p25.titles.length],
    ] as const) {
      const m = stated(body);
      if (m && Number(m[1]) !== expected) wrong.push(`${name}: says ${m[1]}, bank has ${expected}`);
    }
    expect(wrong).toEqual([]);
  });

  // scope keeps an inline copy that has NOT drifted and already points at the canonical
  // file. It is pinned here so a future edit cannot repeat the flow-plan drift silently.
  it("scope's inline Phase 1 copy still matches the bank, title and tag", () => {
    expect(scope).toMatch(CITATION);
    const mismatched = p1.titles.filter((t, i) => {
      const line = scope.split("\n").find((l) => l.includes(`**${t}**`));
      return !line || !line.includes(`\`${p1.tags[i]}\``);
    });
    expect(mismatched).toEqual([]);
  });
});

// H53. test-policy.md called itself the single source of the project's test policy while
// flow-test-plan added a /flow-lifecycle default (`tdd: forced` for behaviour-changing HUs, auxiliary
// code included). Two files decided the effective policy and only one admitted it.
describe("the flow test-policy escalation has one owner (H53)", () => {
  const ESCALATION = /tdd:\s*forced/;
  const flowLines = (text: string) =>
    text.split("\n").filter((l) => /\bflow\b/i.test(l)).join(" ");

  it("test-policy states the flow escalation", () => {
    expect(flowLines(testPolicy)).toMatch(ESCALATION);
  });

  it("flow-test-plan cites the rule instead of restating it", () => {
    const cited = flowLines(tddDesign);
    expect(cited).toContain("test-policy.md");
    expect(cited).not.toMatch(ESCALATION);
  });

  it("makes no unqualified claim of being the only source", () => {
    const bad = testPolicy
      .split("\n")
      .filter((l) => /single source/i.test(l) && !/flow|override/i.test(l));
    expect(bad).toEqual([]);
  });
});
