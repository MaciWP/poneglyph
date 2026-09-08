import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as flow from "../flow-state";

const DATE = "2026-09-08";
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const good = { blockers: 0, majors: 0, minors: 0, nits: 0, checks: "passed" as const, coverageMet: true };
const proof = (us = "US1") => ({ us, revision: "fixture:checked-inputs-v1", tests_passed: true,
  checks: [{ name: "behavior", status: "passed" as const, evidence: "fixture:observed expected output" }] });
function initial(): flow.FlowState {
  return { spec_slug: "100-example", mode: "full", current_phase: 1, phases_completed: [],
    gates_approved: { "1->2": false, "2->3": false }, us_completed: [], us_pending: [],
    feature_closed: false, review_verdict: null, retro_status: null, started_at: DATE, updated_at: DATE };
}
const ready = (): flow.FlowState => ({ ...initial(), current_phase: 3, phases_completed: [1, 2, 2.5],
  gates_approved: { "1->2": true, "2->3": true }, us_pending: ["US1"] });
const doc = (fields: string) => `---\r\n${fields}\r\n---\r\nBody: status: closed is an example.\r\n`;
function plan(state = initial()) {
  const dir = mkdtempSync(join(tmpdir(), "flow contract spaces-")); dirs.push(dir);
  mkdirSync(join(dir, "tasks"));
  writeFileSync(join(dir, "state.json"), JSON.stringify(state));
  writeFileSync(join(dir, "spec.md"), doc("id: 100-example\r\nstatus: draft"));
  writeFileSync(join(dir, "tasks/index.md"), doc("total_us: 1\r\nstatus: draft"));
  writeFileSync(join(dir, "tasks/US1.md"), doc("us: US1\r\ndepends_on: []\r\nstatus: draft"));
  writeFileSync(join(dir, "tests.md"), doc("phase: 2.5\r\nstatus: draft"));
  return dir;
}
const stateAt = (dir: string): flow.FlowState => JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
const opts = (dir: string) => ({ planDir: dir, date: DATE });
async function approve(dir: string) {
  await flow.runCommand("complete-phase", ["1"], opts(dir));
  await flow.runCommand("approve-gate", ["1->2"], { ...opts(dir), approval: "user:approved scope" });
  await flow.runCommand("complete-phase", ["2"], opts(dir));
  await flow.runCommand("complete-phase", ["2.5"], opts(dir));
  await flow.runCommand("approve-gate", ["2-3"], { ...opts(dir), approval: "user:approved tasks and oracle" });
}

test("draft package becomes executable and completes a verified lifecycle", async () => {
  const dir = plan();
  await approve(dir);
  expect(stateAt(dir).us_pending).toEqual(["US1"]);
  for (const path of ["spec.md", "tasks/index.md", "tasks/US1.md", "tests.md"]) {
    expect(readFileSync(join(dir, path), "utf8")).toContain("status: approved\r\n");
  }
  const approved = readFileSync(join(dir, "state.json"), "utf8");
  await flow.runCommand("approve-gate", ["2->3"], { ...opts(dir), approval: "user:approved tasks and oracle" });
  expect(readFileSync(join(dir, "state.json"), "utf8")).toBe(approved);
  await flow.runCommand("close-us", ["US1"], { ...opts(dir), verification: proof() });
  await flow.runCommand("verdict", ["APPROVED"], { ...opts(dir), assessment: good });
  await flow.runCommand("retro-status", ["approved"], opts(dir));
  await flow.runCommand("close-feature", [], opts(dir));
  expect(stateAt(dir).feature_closed).toBe(true);
  expect(stateAt(dir).us_history?.[0].verification?.revision).toBe(proof().revision);
  for (const path of ["spec.md", "tasks/index.md", "tasks/US1.md"]) {
    expect(readFileSync(join(dir, path), "utf8")).toContain("status: closed\r\n");
  }
});

test.each([undefined, { ...proof(), tests_passed: false }, { ...proof(), checks: [] }, proof("US2"),
  { ...proof(), revision: "" }, { ...proof(), checks: [{ name: "runtime", status: "not_run", evidence: "unavailable" }] },
  { ...proof(), checks: [{ name: "runtime", status: "failed", evidence: "wrong output" }] },
  { ...proof(), checks: [{ name: "runtime", status: "not_applicable", evidence: "no runtime" }] },
])("invalid verification changes neither state nor documents: %j", async verification => {
  const dir = plan(); await approve(dir);
  const before = readFileSync(join(dir, "state.json"), "utf8");
  const task = readFileSync(join(dir, "tasks/US1.md"), "utf8");
  await expect(flow.runCommand("close-us", ["US1"], { ...opts(dir), verification: verification as any })).rejects.toThrow();
  expect(readFileSync(join(dir, "state.json"), "utf8")).toBe(before);
  expect(readFileSync(join(dir, "tasks/US1.md"), "utf8")).toBe(task);
});

test("validation-only closure records observed checks without inventing a suite", () => {
  const s = flow.closeUs(ready(), "US1", { date: DATE, verification: { ...proof(), tests_passed: null } });
  expect(s.us_history?.[0].tests_passed).toBeNull();
  expect(s.us_history?.[0].verification?.checks).toHaveLength(1);
});

test("missing approvals and incomplete phases cannot become completion", () => {
  expect(() => flow.closeUs(initial(), "US1", { date: DATE, verification: proof() })).toThrow(/approval/);
  expect(() => flow.approveGate(initial(), "1->2", { date: DATE, reference: "" })).toThrow();
  expect(() => flow.completePhase(ready(), 3)).toThrow(/pending/);
  expect(() => flow.setVerdict(ready(), "APPROVED", good)).toThrow(/pending/);
  expect(() => flow.setVerdict({ ...ready(), us_pending: [], us_completed: ["US1"] }, "APPROVED", good)).toThrow(/verification/);
});

test("an empty package or a cyclic DAG cannot be approved", async () => {
  for (const cyclic of [false, true]) {
    const dir = plan({ ...initial(), phases_completed: [1, 2, 2.5], gates_approved: { "1->2": true, "2->3": false } });
    if (cyclic) writeFileSync(join(dir, "tasks/US1.md"), doc("us: US1\r\ndepends_on: [US1]\r\nstatus: draft"));
    else rmSync(join(dir, "tasks/US1.md"));
    await expect(flow.runCommand("approve-gate", ["2-3"], { ...opts(dir), approval: "user:package" })).rejects.toThrow();
    expect(stateAt(dir).gates_approved["2->3"]).toBe(false);
  }
});

test("a sequential DAG is valid and dependencies gate closure", async () => {
  const dir = plan();
  writeFileSync(join(dir, "tasks/index.md"), doc("total_us: 2\r\nstatus: draft"));
  writeFileSync(join(dir, "tasks/US2.md"), doc("us: US2\r\ndepends_on: [US1]\r\nstatus: draft"));
  await approve(dir);
  await expect(flow.runCommand("close-us", ["US2"], { ...opts(dir), verification: proof("US2") })).rejects.toThrow(/depend/);
  await flow.runCommand("close-us", ["US1"], { ...opts(dir), verification: proof() });
  await flow.runCommand("close-us", ["US2"], { ...opts(dir), verification: proof("US2") });
  expect(stateAt(dir).us_completed).toEqual(["US1", "US2"]);
});

test("BLOCKED can only resume through an authorized reopen, including direct functions", async () => {
  const blocked = flow.setVerdict(ready(), "BLOCKED", { ...good, checks: "not_run" });
  expect(() => flow.setVerdict(blocked, "NEEDS_CHANGES", { ...good, majors: 1 })).toThrow(/BLOCKED/);
  expect(() => flow.completePhase(blocked, 2)).toThrow(/BLOCKED/);
  expect(() => flow.reopenUs(blocked, "US1", "runtime restored", DATE)).toThrow(/approval/);
  const resumed = flow.reopenUs(blocked, "US1", "runtime restored", DATE, "user:resume");
  expect(flow.closeUs(resumed, "US1", { date: DATE, verification: proof() }).us_completed).toEqual(["US1"]);
  const closed = flow.closeUs(ready(), "US1", { date: DATE, verification: proof() });
  const blockedReview = flow.setVerdict(closed, "BLOCKED", { ...good, blockers: 1 });
  expect(() => flow.setVerdict(blockedReview, "APPROVED", good)).toThrow(/BLOCKED/);
});

test("a late failure invalidates the old verdict and needs a new verified closure", async () => {
  const dir = plan(); await approve(dir);
  await flow.runCommand("close-us", ["US1"], { ...opts(dir), verification: proof() });
  await flow.runCommand("verdict", ["NEEDS_CHANGES"], { ...opts(dir), assessment: { ...good, majors: 1 } });
  await flow.runCommand("reopen-us", ["US1"], { ...opts(dir), note: "AC1: wrong output" });
  expect(stateAt(dir).review_verdict).toBeNull();
  expect(stateAt(dir).retro_status).toBeNull();
  await expect(flow.runCommand("verdict", ["APPROVED"], { ...opts(dir), assessment: good })).rejects.toThrow(/pending/);
  await expect(flow.runCommand("close-us", ["US1"], opts(dir))).rejects.toThrow(/verification/);
  await flow.runCommand("close-us", ["US1"], { ...opts(dir), verification: { ...proof(), revision: "fixture:fixed-v2" } });
  await flow.runCommand("verdict", ["APPROVED"], { ...opts(dir), assessment: good });
  expect(stateAt(dir).gate_history).toHaveLength(2);
});

test("sync-artifacts repairs interrupted projection without changing evidence or approvals", async () => {
  const dir = plan(); await approve(dir);
  await flow.runCommand("close-us", ["US1"], { ...opts(dir), verification: proof() });
  writeFileSync(join(dir, "tasks/US1.md"), doc("us: US1\r\ndepends_on: []\r\nstatus: draft"));
  writeFileSync(join(dir, "tests.md"), doc("phase: 2.5\r\nstatus: draft"));
  const before = readFileSync(join(dir, "state.json"), "utf8");
  await flow.runCommand("sync-artifacts", [], opts(dir));
  await flow.runCommand("sync-artifacts", [], opts(dir));
  expect(readFileSync(join(dir, "state.json"), "utf8")).toBe(before);
  expect(readFileSync(join(dir, "tasks/US1.md"), "utf8")).toContain("status: closed\r\n");
  expect(readFileSync(join(dir, "tests.md"), "utf8")).toContain("status: approved\r\n");
});

test("overlapping writers are rejected without losing the successful transition", async () => {
  const dir = plan(); await approve(dir);
  const first = flow.runCommand("close-us", ["US1"], { ...opts(dir), verification: proof() });
  await expect(flow.runCommand("boundary-check", ["3", "second writer"], opts(dir))).rejects.toThrow(/locked/);
  await first;
  expect(stateAt(dir).us_completed).toEqual(["US1"]);
  mkdirSync(join(dir, ".flow-state.lock"));
  await expect(flow.runCommand("sync-artifacts", [], opts(dir))).rejects.toThrow(/locked/);
});

test("review classification is disjoint and rejects invalid evidence", async () => {
  const { classifyReview } = await import("../lib/flow-contract");
  for (const majors of [1, 2, 3]) expect(classifyReview({ ...good, majors })).toBe("NEEDS_CHANGES");
  expect(classifyReview(good)).toBe("APPROVED");
  expect(classifyReview({ ...good, nits: 1 })).toBe("APPROVED_WITH_WARNINGS");
  expect(classifyReview({ ...good, checks: "not_run" })).toBe("BLOCKED");
  expect(classifyReview({ ...good, checks: "failed" })).toBe("NEEDS_CHANGES");
  expect(classifyReview({ ...good, coverageMet: false })).toBe("NEEDS_CHANGES");
  for (const majors of [-1, .5, NaN]) expect(() => classifyReview({ ...good, majors })).toThrow();
  expect(() => flow.setVerdict(ready(), "APPROVED_WITH_WARNINGS", { ...good, majors: 1 })).toThrow(/contradict/);
});

test("historical HUs can be reopened progressively without inventing evidence for their siblings", async () => {
  const dir = plan({ ...ready(), us_completed: ["US1", "US2"], us_pending: [], current_phase: 4 });
  writeFileSync(join(dir, "tasks/US1.md"), doc("us: US1\r\ndepends_on: []\r\nstatus: closed"));
  writeFileSync(join(dir, "tasks/US2.md"), doc("us: US2\r\ndepends_on: []\r\nstatus: closed"));
  const sibling = readFileSync(join(dir, "tasks/US2.md"), "utf8");
  await flow.runCommand("reopen-us", ["US1"], { ...opts(dir), note: "reverify historical work" });
  expect(stateAt(dir).us_pending).toEqual(["US1"]);
  expect(readFileSync(join(dir, "tasks/US2.md"), "utf8")).toBe(sibling);
  await flow.runCommand("close-us", ["US1"], { ...opts(dir), verification: proof() });
  await expect(flow.runCommand("verdict", ["APPROVED"], { ...opts(dir), assessment: good })).rejects.toThrow(/verification/);
  await flow.runCommand("reopen-us", ["US2"], { ...opts(dir), note: "reverify second historical HU" });
  await flow.runCommand("close-us", ["US2"], { ...opts(dir), verification: proof("US2") });
  await flow.runCommand("verdict", ["APPROVED"], { ...opts(dir), assessment: good });
  expect(stateAt(dir).review_verdict).toBe("APPROVED");
});

test("approval flags without prepared phases do not authorize closure", () => {
  expect(() => flow.closeUs({ ...ready(), phases_completed: [] }, "US1", { date: DATE, verification: proof() })).toThrow(/phase/);
});

test("recovery repairs a stale closure date even when status already says closed", async () => {
  const dir = plan(); await approve(dir);
  await flow.runCommand("close-us", ["US1"], { ...opts(dir), verification: proof() });
  writeFileSync(join(dir, "tasks/US1.md"), doc("us: US1\r\ndepends_on: []\r\nstatus: closed\r\nclosed: 2020-01-01"));
  await flow.runCommand("sync-artifacts", [], opts(dir));
  expect(readFileSync(join(dir, "tasks/US1.md"), "utf8")).toContain(`closed: ${DATE}\r\n`);
});

test("real CLI reads a report from a path with spaces and rejects missing reports", async () => {
  const dir = plan();
  const report = join(dir, "verification report.json"); writeFileSync(report, JSON.stringify(proof()));
  const run = async (args: string[]) => {
    const p = Bun.spawn([process.execPath, resolve(import.meta.dir, "../flow-state.ts"), ...args, "--plan", dir], { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
    return { stdout, stderr, code };
  };
  for (const args of [["complete-phase", "1"], ["approve-gate", "1->2", "--approval", "user: scope approved"],
    ["complete-phase", "2"], ["complete-phase", "2.5"], ["approve-gate", "2->3", "--approval", "user: joint package approved"]]) {
    expect(await run(args)).toMatchObject({ code: 0, stderr: "" });
  }
  expect((await run(["close-us", "US1"])).code).toBe(1);
  expect(await run(["close-us", "US1", "--verification", report])).toMatchObject({ code: 0, stderr: "" });
  expect(stateAt(dir).us_completed).toEqual(["US1"]);
  const assessment = join(dir, "review assessment.json"); writeFileSync(assessment, JSON.stringify(good));
  expect(await run(["verdict", "APPROVED", "--review", assessment])).toMatchObject({ code: 0, stderr: "" });
  expect(await run(["retro-status", "skipped — synthetic fixture has no promotion decisions"])).toMatchObject({ code: 0, stderr: "" });
  expect(await run(["close-feature"])).toMatchObject({ code: 0, stderr: "" });
  expect(stateAt(dir).feature_closed).toBe(true);
});
