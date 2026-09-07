import { describe, test, expect } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  closeUs,
  approveGate,
  setVerdict,
  setRetroStatus,
  addBoundaryCheck,
  closeFeature,
  flipUsFrontmatter,
  runCommand,
  findOpenPlans,
  summarizeState,
  type FlowState,
} from "../flow-state";

const DATE = "2026-06-11";

function baseState(): FlowState {
  return {
    spec_slug: "099-fixture",
    mode: "standard",
    current_phase: 3,
    phases_completed: [1, 2, 2.5],
    gates_approved: { "1->2": true, "2->3": false },
    us_completed: [],
    us_pending: ["US1", "US2"],
    feature_closed: false,
    review_verdict: null,
    retro_status: null,
    started_at: DATE,
    updated_at: DATE,
  };
}

describe("closeUs", () => {
  test("moves US from pending to completed and appends history", () => {
    const s = closeUs(baseState(), "US1", { date: DATE, files: ["a.md"] });
    expect(s.us_completed).toContain("US1");
    expect(s.us_pending).not.toContain("US1");
    expect(s.us_history?.at(-1)).toMatchObject({ us: "US1", completed_at: DATE });
  });

  // This assertion used to expect tests_passed: true unconditionally — it certified a
  // hardcode that no measurement backed. The three paths are now distinguishable.
  test("records tests_passed as null when nobody measured it", () => {
    const s = closeUs(baseState(), "US1", { date: DATE });
    expect(s.us_history?.at(-1)?.tests_passed).toBeNull();
  });

  test("records a measured green suite", () => {
    const s = closeUs(baseState(), "US1", { date: DATE, testsPassed: true });
    expect(s.us_history?.at(-1)?.tests_passed).toBe(true);
  });

  test("records a measured red suite instead of silently claiming green", () => {
    const s = closeUs(baseState(), "US1", { date: DATE, testsPassed: false });
    expect(s.us_history?.at(-1)?.tests_passed).toBe(false);
  });

  test("throws on US not in pending", () => {
    expect(() => closeUs(baseState(), "US9", { date: DATE })).toThrow(/not pending/);
  });
});

describe("approveGate", () => {
  test("2->3 sets flag and advances phase to 3", () => {
    const s = approveGate(baseState(), "2->3");
    expect(s.gates_approved["2->3"]).toBe(true);
    expect(s.current_phase).toBe(3);
  });

  test("unknown gate throws", () => {
    // @ts-expect-error invalid gate on purpose
    expect(() => approveGate(baseState(), "3->4")).toThrow(/gate/i);
  });
});

describe("setVerdict / closeFeature", () => {
  test("APPROVED verdict advances to phase 5 and completes phases 3,4", () => {
    const s = setVerdict({ ...baseState(), us_pending: [] }, "APPROVED");
    expect(s.review_verdict).toBe("APPROVED");
    expect(s.current_phase).toBe(5);
    expect(s.phases_completed).toContain(4);
  });

  test("invalid verdict throws", () => {
    expect(() => setVerdict(baseState(), "MAYBE")).toThrow(/verdict/i);
  });

  test("closeFeature flips terminal flags", () => {
    const s = closeFeature(
      { ...baseState(), us_pending: [], review_verdict: "APPROVED", retro_status: "approved" },
      { date: DATE },
    );
    expect(s.feature_closed).toBe(true);
    expect(s.retro_status).toBe("approved");
    expect(s.current_phase).toBe("closed");
    expect(s.phases_completed).toContain(5);
  });

  test("closeFeature refuses without an approving verdict (Cmd IV guard)", () => {
    expect(() => closeFeature({ ...baseState(), us_pending: [] }, { date: DATE })).toThrow(/review_verdict/);
    expect(() =>
      closeFeature({ ...baseState(), us_pending: [], review_verdict: "NEEDS_CHANGES" }, { date: DATE }),
    ).toThrow(/APPROVED/);
    const ok = closeFeature(
      { ...baseState(), us_pending: [], review_verdict: "APPROVED_WITH_WARNINGS", retro_status: "approved" },
      { date: DATE },
    );
    expect(ok.feature_closed).toBe(true);
  });

  test("closeFeature refuses with retro unresolved — no silent auto-approve (029/US12)", () => {
    // retro_status null: closing would stamp a retro that never ran
    expect(() =>
      closeFeature(
        { ...baseState(), us_pending: [], review_verdict: "APPROVED", retro_status: null },
        { date: DATE },
      ),
    ).toThrow(/retro_status/);
  });

  test("closeFeature preserves a justified skip instead of overwriting to approved (029/US12)", () => {
    const skipped = "skipped — feature trivial: 0 lecciones, 0 promotions, 0 drift";
    const s = closeFeature(
      { ...baseState(), us_pending: [], review_verdict: "APPROVED", retro_status: skipped },
      { date: DATE },
    );
    expect(s.feature_closed).toBe(true);
    expect(s.retro_status).toBe(skipped);
  });
});

describe("setRetroStatus (029/US12 — skip requires justification)", () => {
  test("accepts approved and pending", () => {
    expect(setRetroStatus(baseState(), "approved").retro_status).toBe("approved");
    expect(setRetroStatus(baseState(), "pending").retro_status).toBe("pending");
  });

  test("accepts a justified skip", () => {
    const v = "skipped — lifecycle atascado desde junio, sin lecciones nuevas";
    expect(setRetroStatus(baseState(), v).retro_status).toBe(v);
  });

  test("rejects bare skipped — justification is mandatory", () => {
    expect(() => setRetroStatus(baseState(), "skipped")).toThrow(/justif/i);
  });

  test("rejects a too-short justification (>=10 chars)", () => {
    expect(() => setRetroStatus(baseState(), "skipped — corto")).toThrow(/justif/i);
  });

  test("rejects arbitrary values", () => {
    expect(() => setRetroStatus(baseState(), "maybe")).toThrow(/retro/i);
  });
});

describe("flipUsFrontmatter", () => {
  const doc = ["---", "us: US1", "status: approved", "---", "", "# US1"].join("\n");

  test("approved → closed with closed date", () => {
    const out = flipUsFrontmatter(doc, DATE);
    expect(out).toContain("status: closed");
    expect(out).toContain(`closed: ${DATE}`);
  });

  test("already closed → unchanged", () => {
    const closed = flipUsFrontmatter(doc, DATE);
    expect(flipUsFrontmatter(closed, "2026-12-31")).toBe(closed);
  });
});

describe("findOpenPlans (US1)", () => {
  function plansRootWith(specs: Array<{ name: string; content: string | null }>): string {
    const root = mkdtempSync(join(tmpdir(), "plans-root-"));
    for (const s of specs) {
      const dir = join(root, s.name);
      mkdirSync(dir);
      if (s.content !== null) writeFileSync(join(dir, "state.json"), s.content);
    }
    return root;
  }

  test("T1.1 lists only open plans (feature_closed:false), excludes closed", () => {
    const open1 = JSON.stringify({ ...baseState(), spec_slug: "100-a", feature_closed: false });
    const open2 = JSON.stringify({ ...baseState(), spec_slug: "101-b", feature_closed: false });
    const closed = JSON.stringify({ ...baseState(), spec_slug: "102-c", feature_closed: true });
    const root = plansRootWith([
      { name: "100-a", content: open1 },
      { name: "101-b", content: open2 },
      { name: "102-c", content: closed },
    ]);
    const got = findOpenPlans(root);
    expect(got.map((p) => p.slug).sort()).toEqual(["100-a", "101-b"]);
    expect(got.every((p) => p.state !== null)).toBe(true);
  });

  test("T1.3 malformed state.json marked illegible, missing state.json skipped, no throw (AC2)", () => {
    const valid = JSON.stringify({ ...baseState(), spec_slug: "200-ok", feature_closed: false });
    const root = plansRootWith([
      { name: "200-ok", content: valid },
      { name: "201-bad", content: "{not json" },
      { name: "202-nostate", content: null },
    ]);
    let got: ReturnType<typeof findOpenPlans> = [];
    expect(() => { got = findOpenPlans(root); }).not.toThrow();
    expect(got.find((p) => p.slug === "200-ok")?.state).not.toBeNull();
    expect(got.find((p) => p.slug === "201-bad")?.state).toBeNull(); // illegible, surfaced
    expect(got.find((p) => p.slug === "202-nostate")).toBeUndefined(); // not a flow plan
  });

  test("absent plans root → [] (best-effort, no throw)", () => {
    expect(findOpenPlans(join(tmpdir(), "does-not-exist-xyz"))).toEqual([]);
  });
});

describe("summarizeState (US1)", () => {
  test("T1.2 includes slug, phase, gates and us counts (AC1)", () => {
    const s: FlowState = {
      ...baseState(),
      spec_slug: "300-sum",
      current_phase: 3,
      gates_approved: { "1->2": true, "2->3": true },
      us_completed: ["US1"],
      us_pending: ["US2"],
    };
    const line = summarizeState(s);
    expect(line).toContain("300-sum");
    expect(line).toContain("3");
    expect(line).toContain("US1");
    expect(line).toContain("US2");
  });
});

describe("runCommand (integration, tmpdir)", () => {
  test("close-us updates state.json and US frontmatter on disk", async () => {
    const plan = mkdtempSync(join(tmpdir(), "flow-state-"));
    mkdirSync(join(plan, "tasks"));
    writeFileSync(join(plan, "state.json"), JSON.stringify(baseState(), null, 2));
    writeFileSync(join(plan, "tasks", "US1.md"), ["---", "us: US1", "status: approved", "---"].join("\n"));

    await runCommand("close-us", ["US1"], { planDir: plan, date: DATE });

    const state = JSON.parse(readFileSync(join(plan, "state.json"), "utf8"));
    expect(state.us_completed).toContain("US1");
    expect(state.updated_at).toBe(DATE);
    expect(readFileSync(join(plan, "tasks", "US1.md"), "utf8")).toContain("status: closed");
  });

  test("approve-gate refreshes updated_at on disk (RI-5)", async () => {
    const plan = mkdtempSync(join(tmpdir(), "flow-state-gate-"));
    writeFileSync(join(plan, "state.json"), JSON.stringify(baseState(), null, 2));
    const LATER = "2026-07-02";
    await runCommand("approve-gate", ["2-3"], { planDir: plan, date: LATER });
    const state = JSON.parse(readFileSync(join(plan, "state.json"), "utf8"));
    expect(state.gates_approved["2->3"]).toBe(true);
    expect(state.updated_at).toBe(LATER);
  });

  test("malformed state.json fails loudly", async () => {
    const plan = mkdtempSync(join(tmpdir(), "flow-state-bad-"));
    writeFileSync(join(plan, "state.json"), "{not json");
    await expect(runCommand("close-us", ["US1"], { planDir: plan, date: DATE })).rejects.toThrow();
  });
});

describe("complete-phase (028/US6-D6)", () => {
  test("T6.1 marks phase completed and refreshes updated_at", async () => {
    const plan = mkdtempSync(join(tmpdir(), "flow-state-phase-"));
    writeFileSync(join(plan, "state.json"), JSON.stringify({ ...baseState(), current_phase: 2 }, null, 2));
    await runCommand("complete-phase", ["2.5"], { planDir: plan, date: "2026-07-08" });
    const state = JSON.parse(readFileSync(join(plan, "state.json"), "utf8"));
    expect(state.phases_completed).toContain(2.5);
    expect(state.updated_at).toBe("2026-07-08");
  });

  test("T6.2 invalid phase → typed error listing valid phases", async () => {
    const plan = mkdtempSync(join(tmpdir(), "flow-state-phase-bad-"));
    writeFileSync(join(plan, "state.json"), JSON.stringify(baseState(), null, 2));
    await expect(runCommand("complete-phase", ["7"], { planDir: plan, date: "2026-07-08" })).rejects.toThrow(/2\.5/);
  });
});

describe("addBoundaryCheck (029/US17 — measurable boundary compliance)", () => {
  test("appends a check entry for a valid phase", () => {
    const s = addBoundaryCheck(baseState(), "3", "phase skill invoked (build)", { date: DATE });
    expect(s.boundary_checks?.at(-1)).toMatchObject({ phase: "3", item: "phase skill invoked (build)", at: DATE });
  });

  test("accumulates entries across boundaries", () => {
    let s = addBoundaryCheck(baseState(), "2", "artifact exists (tasks/)", { date: DATE });
    s = addBoundaryCheck(s, "2.5", "oracle produced", { date: DATE });
    expect(s.boundary_checks?.length).toBe(2);
  });

  test("rejects an invalid phase", () => {
    expect(() => addBoundaryCheck(baseState(), "7", "x", { date: DATE })).toThrow(/phase/);
  });

  test("rejects an empty item", () => {
    expect(() => addBoundaryCheck(baseState(), "3", "  ", { date: DATE })).toThrow(/item/);
  });
});
