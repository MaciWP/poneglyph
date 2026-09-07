import { describe, expect, it } from "bun:test";
import { exitCodeFor, renderChecks, summarizeConfig, statusFromSyncOutput, summarizeSessions, summarizeSyncOutput, summarizeTests, summarizeValidate, worstOf } from "../doctor";

describe("doctor — sessions today (plan 033)", () => {
  it("is green for a handful of cheap sessions", () => {
    const r = summarizeSessions(["claude-sonnet-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"]);
    expect(r.status).toBe("🟢");
    expect(r.detail).toBe("3 sessions today (sonnet-5 2 · haiku-4-5 1)");
  });
  it("warns above the daily threshold", () => {
    expect(summarizeSessions(Array(25).fill("claude-sonnet-5")).status).toBe("🟡");
  });
  it("warns when expensive tiers show up in more than a few sessions", () => {
    expect(summarizeSessions([...Array(5).fill("claude-sonnet-5"), "claude-fable-5-1"]).status).toBe("🟡");
    expect(summarizeSessions(["claude-fable-5-1", "claude-fable-5-1"]).status).toBe("🟢"); // the interactive session itself
  });
  it("reproduces the 2026-09-03 day as a warning", () => {
    const day = [...Array(44).fill("claude-opus-5"), ...Array(29).fill("claude-fable-5-1"), ...Array(5).fill("claude-sonnet-5"), ...Array(4).fill("claude-haiku-4-5-20251001")];
    const r = summarizeSessions(day);
    expect(r.status).toBe("🟡");
    expect(r.detail).toContain("82 sessions today (opus-5 44 · fable-5-1 29");
  });
});

describe("doctor — pure summaries", () => {
  it("does not reuse an earlier footer when the final run is incomplete", () => {
    expect(summarizeTests(' 2 pass\n 0 fail\nRan 2 tests across 1 file.\nRan 4 tests across 1 file.').status).toBe("🔴");
  });
  it("does not call an entirely skipped suite a verified pass", () => {
    expect(summarizeTests(' 0 pass\n 2 skip\n 0 fail\nRan 2 tests across 1 file.').status).toBe("🔴");
  });
  it("ignores test names and earlier runner summaries", () => {
    const out = ' 2 pass\n 1 fail\nRan 3 tests across 1 file.\n(pass) parser handles 2 pass + 1 fail\n 8 pass\n 0 fail\n 10 expect() calls\nRan 8 tests across 2 files. [1ms]';
    expect(summarizeTests(out)).toEqual({ status: "🟢", detail: "8 pass (8 tests)" });
  });
  it("rejects empty, inconsistent and incomplete counters", () => {
    for (const out of [' 0 pass\n 0 fail\nRan 0 tests across 0 files.', ' 3 pass\n 0 fail\nRan 4 tests across 1 file.', 'Ran 2 tests across 1 file.']) expect(summarizeTests(out).status).toBe("🔴");
    expect(summarizeTests(' 3 pass\r\n 1 skip\r\n 1 todo\r\n 0 fail\r\nRan 5 tests across 1 file.').status).toBe("🟢");
  });
  it("does not report missing inventory or failed native processes as green", () => {
    for (const out of ["", "unrecognized output"]) expect(statusFromSyncOutput(out)).toBe("🔴");
    expect(statusFromSyncOutput("🟢 skills: linked", 1)).toBe("🔴");
    expect(statusFromSyncOutput("linked  target", 0)).toBe("🟢");
    expect(statusFromSyncOutput("local  target", 0)).toBe("🔴");
    expect(summarizeValidate("Validation passed", 1).status).toBe("🔴");
    expect(summarizeValidate("PRIVATE-SENTINEL", 1).detail).not.toContain("PRIVATE-SENTINEL");
  });
  it("reads bun test summaries: green needs exit 0 + a 'Ran N tests' total + zero failures (E13/E17)", () => {
    expect(summarizeTests(" 382 pass\n 0 fail\nRan 382 tests across 22 files.", 0)).toEqual({ status: "🟢", detail: "382 pass (382 tests)" });
    expect(summarizeTests(" 380 pass\n 2 fail\nRan 382 tests across 22 files.", 1).status).toBe("🔴");
    expect(summarizeTests(" 2 pass\n 0 fail", 0)).toEqual({ status: "🔴", detail: "no 'Ran N tests' line — the run did not complete" });
    expect(summarizeTests(" 397 pass\n 0 fail\nRan 397 tests across 23 files.", 137).detail).toContain("exited 137");
    expect(summarizeTests("bun: command not found", 127).status).toBe("🔴");
  });

  it("reads claude plugin validate", () => {
    expect(summarizeValidate("Validating components in: x\n\n✔ Validation passed\n").status).toBe("🟢");
    expect(summarizeValidate("✘ 2 errors\n  - bad frontmatter").status).toBe("🔴");
  });

  it("derives the sync status from row-leading icons, not from words inside prose (F7)", () => {
    expect(statusFromSyncOutput("🟢 skills: ✓\n🟢 settings.json: accepted")).toBe("🟢");
    expect(statusFromSyncOutput("🟢 skills: ✓\n🟡 grok twin: stale copy")).toBe("🟡");
    expect(statusFromSyncOutput("🟢 skills\n🔴 settings.json: REJECTED by claude doctor")).toBe("🔴");
    expect(statusFromSyncOutput("missing  C:\\Users\\x\\.codex\\AGENTS.md")).toBe("🔴");
    expect(statusFromSyncOutput("🟢 docs: linked (a file named missing-piece.md is fine)")).toBe("🟢");
    expect(summarizeSyncOutput("🟢 a\n🟢 b\n🟡 c")).toBe("1/3 items not 🟢");
  });

  it("summarizes the shared privacy gate without exposing paths or content", () => {
    const report = { kind: "core" as const, skills: 1, files: 2, findings: [{ path: "PRIVATE.md", rule: "privacy.term", message: "PRIVATE", severity: "error" as const }] };
    expect(summarizeConfig(report).status).toBe("🔴");
    expect(summarizeConfig(report).detail).not.toContain("PRIVATE");
    expect(summarizeConfig({ ...report, findings: [{ path: "policy", rule: "privacy.unchecked", message: "Missing", severity: "warning" }] }).detail).toContain("corporate privacy unchecked");
  });

  it("renders one pipe table and exits 1 only on 🔴", () => {
    const checks = [
      { name: "A", status: "🟢" as const, detail: "ok" },
      { name: "B", status: "🟡" as const, detail: "skipped" },
    ];
    expect(renderChecks(checks).split("\n")).toHaveLength(4);
    expect(exitCodeFor(checks)).toBe(0);
    expect(exitCodeFor([...checks, { name: "C", status: "🔴", detail: "x" }])).toBe(1);
    expect(worstOf(["🟢", "🟡"])).toBe("🟡");
  });
});
