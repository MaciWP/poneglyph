import { describe, expect, it } from "bun:test";
import { DEFAULT_MODEL, ExpensiveModelRefused, resolveHeadlessModel, stripHeadlessFlags } from "../lib/headless";
import { isExpensiveModel } from "../../hooks/lib/headless-models";

describe("resolveHeadlessModel (plan 033 — never an expensive tier by default)", () => {
  it("defaults per kind: cheap for prose/smoke, mid for skill-trigger/probe", () => {
    expect(resolveHeadlessModel([], "style").model).toBe("claude-haiku-4-5-20251001");
    expect(resolveHeadlessModel([], "smoke").model).toBe("claude-haiku-4-5-20251001");
    expect(resolveHeadlessModel([], "skill-trigger").model).toBe("claude-sonnet-5");
    expect(resolveHeadlessModel([], "probe").model).toBe("claude-sonnet-5");
    expect(Object.values(DEFAULT_MODEL).some(isExpensiveModel)).toBe(false);
  });

  it("honours an explicit cheap --model", () => {
    const r = resolveHeadlessModel(["--model", "claude-sonnet-5"], "style");
    expect(r).toEqual({ model: "claude-sonnet-5", explicit: true, dryRun: false });
  });

  it("refuses Fable and Opus without --allow-expensive, by family not by dated id", () => {
    expect(() => resolveHeadlessModel(["--model", "claude-fable-5-1"], "probe")).toThrow(ExpensiveModelRefused);
    expect(() => resolveHeadlessModel(["--model", "claude-opus-5"], "style")).toThrow(/never the default/);
    expect(() => resolveHeadlessModel(["--model", "opus"], "style")).toThrow(ExpensiveModelRefused);
    expect(() => resolveHeadlessModel(["--model", "claude-fable-6"], "style")).toThrow(ExpensiveModelRefused);
  });

  it("allows an expensive tier only with --allow-expensive, and reports dry-run", () => {
    const r = resolveHeadlessModel(["--model", "claude-fable-5-1", "--allow-expensive", "--dry-run"], "probe");
    expect(r).toEqual({ model: "claude-fable-5-1", explicit: true, dryRun: true });
  });

  it("strips its own flags so the caller's argv parsing is untouched", () => {
    expect(stripHeadlessFlags(["cases.jsonl", "--model", "x", "--allow-expensive", "--offline", "dir", "--dry-run"])).toEqual(["cases.jsonl", "--offline", "dir"]);
  });
});
