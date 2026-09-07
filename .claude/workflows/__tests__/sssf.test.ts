import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Same contract-reproduction trick as flow-cycle.test.ts: a Workflow script is not an
// importable module (the runtime injects args/agent/parallel/pipeline/phase/log and wraps
// the body in an async function, which is why top-level `return` is legal). Compiling the
// source with AsyncFunction reproduces that exactly and doubles as a parse check, so the
// deterministic half — gate cross-checks, the fix loop's progress criterion, verdict
// coherence, commit policy — is testable without spawning a single agent.
const SOURCE = readFileSync(join(import.meta.dir, "..", "sssf.js"), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (...a: unknown[]) => Promise<any>;
const runScript = new AsyncFunction(
  "args",
  "agent",
  "parallel",
  "pipeline",
  "phase",
  "log",
  SOURCE.replace(/^export const meta/m, "const meta"),
);

const parallel = async (thunks: Array<() => Promise<unknown>>) => Promise.all(thunks.map((t) => t()));
const pipeline = async () => [];
const noop = () => {};

const REQUEST = {
  run_id: "20260806T101500-abc1234",
  session_dir: "/tmp/sssf/20260806T101500-abc1234",
  check_command: "bun test",
  baseline_path: "/tmp/sssf/20260806T101500-abc1234/baseline.json",
  head: "abc1234",
  completed_phases: [],
};
const PLAN = { summary: "add a health endpoint", artifacts: ["/tmp/sssf/x/plan.md"], steps: ["s1"], acceptance: ["a1"], commit_message: "spec: health endpoint" };
const BUILD = { status: "done", summary: "added it", files_touched: ["src/health.ts"], commit_message: "feat: health endpoint" };
const GATE_OK = { passed: true, exit_code: 0, violations: [], checks_run: 8 };
const GATE_RED = { passed: false, exit_code: 1, violations: ["diff_matches_claims: changed but not declared: sneaky.ts"], checks_run: 8 };
const REVIEW_OK = { approved: true, summary: "matches", blocking: [], findings: [{ requirement: "a1", met: true, evidence: "src/health.ts:4" }] };
const DOC = { summary: "wrote it up", artifacts: ["/tmp/sssf/x/document.md"], steps: [], commit_message: "docs: health endpoint" };

/**
 * Drives the script with a scripted agent. `overrides` maps a label prefix to the value
 * that agent call should return; anything unmatched falls back to a sane default.
 */
function harness(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ label: string; model?: string; prompt: string }> = [];
  const agent = async (prompt: string, opts: any = {}) => {
    const label: string = opts.label ?? "?";
    calls.push({ label, model: opts.model, prompt });
    for (const [prefix, value] of Object.entries(overrides)) {
      if (label === prefix || label.startsWith(prefix)) return typeof value === "function" ? (value as any)(calls) : value;
    }
    if (label.startsWith("request")) return REQUEST;
    if (label.startsWith("gate") || label.startsWith("re-baseline")) return label.startsWith("re-baseline") ? { path: "/tmp/sssf/x/baseline-rev1.json" } : GATE_OK;
    if (label.startsWith("plan")) return PLAN;
    if (label.startsWith("build") || label.startsWith("fix") || label.startsWith("revise")) return BUILD;
    if (label.startsWith("review") || label.startsWith("re-review")) return REVIEW_OK;
    if (label.startsWith("document")) return DOC;
    return null;
  };
  return { agent, calls };
}

const run = (args: unknown, overrides: Record<string, unknown> = {}) => {
  const h = harness(overrides);
  return runScript(args, h.agent, parallel, pipeline, noop, noop).then((r: any) => ({ result: r, calls: h.calls }));
};

describe("args", () => {
  test("refuses to run without a task", async () => {
    await expect(run({})).rejects.toThrow(/args\.task/);
  });

  test("accepts a bare string as the task", async () => {
    const { result } = await run("add a health endpoint");
    expect(result.task).toBe("add a health endpoint");
  });

  test("aborts when the request agent dies — no baseline means no gate is possible", async () => {
    const { result } = await run({ task: "t" }, { request: null });
    expect(result.aborted).toBe(true);
    expect(result.reason).toMatch(/baseline/);
  });
});

describe("happy path", () => {
  test("verified when build gate, review and coherence all pass", async () => {
    const { result } = await run({ task: "t" });
    expect(result.verified).toBe(true);
    expect(result.gate.build.passed).toBe(true);
    expect(result.review.approved).toBe(true);
  });

  test("documents only verified work", async () => {
    const { result } = await run({ task: "t" });
    expect(result.document).not.toBeNull();
  });

  test("model doctrine: planner and reviewer on opus, units on sonnet, gate on haiku", async () => {
    const { calls } = await run({ task: "t" });
    const modelOf = (prefix: string) => calls.find((c) => c.label.startsWith(prefix))?.model;
    expect(modelOf("plan")).toBe("opus");
    expect(modelOf("review")).toBe("opus");
    expect(modelOf("build")).toBe("sonnet");
    expect(modelOf("gate")).toBe("haiku");
  });
});

describe("the gate decides, not the agent", () => {
  test("a red gate blocks verification even when the builder says done", async () => {
    const { result } = await run({ task: "t" }, { "gate:build": GATE_RED });
    expect(result.verified).toBe(false);
    expect(result.gate.build.violations[0]).toMatch(/not declared/);
  });

  test("a self-contradicting gate agent (passed=true, exit=1) is a hard fail — the 'helpful' agent signature", async () => {
    const { result } = await run({ task: "t" }, { "gate:build": { passed: true, exit_code: 1, violations: [], checks_run: 8 } });
    expect(result.verified).toBe(false);
    expect(result.gate.build.violations.join(" ")).toMatch(/se contradice/);
  });

  test("the inverse contradiction (passed=false, exit=0) also fails", async () => {
    const { result } = await run({ task: "t" }, { "gate:build": { passed: false, exit_code: 0, violations: [], checks_run: 8 } });
    expect(result.verified).toBe(false);
  });

  test("a dead gate agent fails closed, never open", async () => {
    const { result } = await run({ task: "t" }, { "gate:build": null });
    expect(result.verified).toBe(false);
    expect(result.gate.build.violations.join(" ")).toMatch(/fail-closed/);
  });

  test("a failed plan gate aborts before any code is written", async () => {
    const { result, calls } = await run({ task: "t" }, { "gate:plan": GATE_RED });
    expect(result.aborted).toBe(true);
    expect(calls.some((c) => c.label.startsWith("build"))).toBe(false);
  });
});

describe("fix loop", () => {
  test("stops early when the gate reports the SAME violations twice (identical-error override)", async () => {
    const { result, calls } = await run({ task: "t" }, { "gate:build": GATE_RED });
    const builderCalls = calls.filter((c) => c.label === "build" || c.label.startsWith("fix"));
    // Attempt 1 + one fix that reproduces the signature = 2, never the full budget of 3.
    expect(builderCalls).toHaveLength(2);
    expect(result.gate.fix_attempts).toBe(1);
  });

  test("spends the full budget while violations keep changing", async () => {
    let n = 0;
    const { calls } = await run({ task: "t" }, { "gate:build": () => ({ passed: false, exit_code: 1, violations: [`distinct failure ${n++}`], checks_run: 8 }) });
    expect(calls.filter((c) => c.label === "build" || c.label.startsWith("fix"))).toHaveLength(3);
  });

  test("feeds the gate's violations verbatim back to the builder", async () => {
    const { calls } = await run({ task: "t" }, { "gate:build": GATE_RED });
    const fix = calls.find((c) => c.label.startsWith("fix"));
    expect(fix?.prompt).toContain("changed but not declared: sneaky.ts");
  });

  test("a blocked builder stops the run with its question instead of guessing", async () => {
    const { result } = await run({ task: "t" }, { build: { ...BUILD, status: "blocked", question: "which auth scheme?" } });
    expect(result.aborted).toBe(true);
    expect(result.question).toBe("which auth scheme?");
  });
});

describe("verdict coherence (inline, never crosses the LLM transport)", () => {
  test("refutes approved=true that ships blocking items", async () => {
    const { result } = await run({ task: "t" }, { review: { approved: true, summary: "s", blocking: ["auth bypass"], findings: [] } });
    expect(result.verified).toBe(false);
    expect(result.verdict_coherence.ok).toBe(false);
    expect(result.verdict_coherence.why).toMatch(/blocking/);
  });

  test("refutes approved=true with unmet requirements", async () => {
    const { result } = await run({ task: "t" }, { review: { approved: true, summary: "s", blocking: [], findings: [{ requirement: "a1", met: false, evidence: "-" }] } });
    expect(result.verdict_coherence.ok).toBe(false);
  });

  test("refutes a rejection that names no problem", async () => {
    const { result } = await run({ task: "t" }, { review: { approved: false, summary: "s", blocking: [], findings: [] } });
    expect(result.verdict_coherence.ok).toBe(false);
    expect(result.verdict_coherence.why).toMatch(/sin nombrar/);
  });

  test("an incoherent verdict short-circuits: no revise cycle is spent on it", async () => {
    const { calls } = await run({ task: "t" }, { review: { approved: true, summary: "s", blocking: ["x"], findings: [] } });
    expect(calls.some((c) => c.label.startsWith("revise"))).toBe(false);
  });
});

describe("revision cycle", () => {
  const REJECTED = { approved: false, summary: "no", blocking: ["missing validation"], findings: [{ requirement: "a1", met: false, evidence: "-" }] };

  test("revises then re-reviews, bounded at 2 rounds", async () => {
    const { calls } = await run({ task: "t" }, { review: REJECTED, "re-review": REJECTED });
    expect(calls.filter((c) => c.label.startsWith("revise"))).toHaveLength(1);
    expect(calls.filter((c) => c.label === "review" || c.label.startsWith("re-review"))).toHaveLength(2);
  });

  test("re-baselines between passes so the builder's work is not billed to the fixer", async () => {
    const { calls } = await run({ task: "t" }, { review: REJECTED, "re-review": REJECTED });
    expect(calls.some((c) => c.label.startsWith("re-baseline"))).toBe(true);
  });

  test("re-baselines BEFORE the fixer runs, not after — otherwise it measures nothing", async () => {
    const { calls } = await run({ task: "t" }, { review: REJECTED, "re-review": REJECTED });
    const labels = calls.map((c) => c.label);
    expect(labels.indexOf("re-baseline:1")).toBeLessThan(labels.indexOf("revise:1"));
  });

  test("the fixer is gated too — a revision is not a way in for unmeasured work", async () => {
    const { calls } = await run({ task: "t" }, { review: REJECTED, "re-review": REJECTED });
    const g = calls.find((c) => c.label === "gate:revise1");
    expect(g).toBeDefined();
    expect(g?.prompt).toContain("--baseline");
  });

  test("a red gate on the revision un-verifies the run", async () => {
    let first = true;
    const { result } = await run(
      { task: "t" },
      {
        review: () => {
          if (first) {
            first = false;
            return REJECTED;
          }
          return REVIEW_OK;
        },
        "gate:revise1": GATE_RED,
      },
    );
    expect(result.verified).toBe(false);
    expect(result.gate.revise.passed).toBe(false);
  });

  test("re-runs the suite after a revision, because the previous green predates the change", async () => {
    let first = true;
    const { result, calls } = await run(
      { task: "t" },
      {
        review: () => {
          if (first) {
            first = false;
            return REJECTED;
          }
          return REVIEW_OK;
        },
      },
    );
    expect(calls.some((c) => c.label === "gate:retest")).toBe(true);
    expect(result.gate.retest).not.toBeNull();
    expect(result.verified).toBe(true);
  });

  // Regression: the retest used to pass --baseline, but its baseline is snapshotted
  // AFTER the work, so the delta is empty and every claimed file lands in `missing` —
  // a red gate on a run that actually succeeded. The retest asks "does it still run",
  // which needs no diff cross-check.
  test("the retest runs the suite WITHOUT a diff cross-check", async () => {
    let first = true;
    const { calls } = await run(
      { task: "t" },
      {
        review: () => {
          if (first) {
            first = false;
            return REJECTED;
          }
          return REVIEW_OK;
        },
      },
    );
    const retest = calls.find((c) => c.label === "gate:retest");
    expect(retest?.prompt).not.toContain("--baseline");
    expect(retest?.prompt).toContain("--check-command");
  });

  test("the build gate, by contrast, always cross-checks the diff", async () => {
    const { calls } = await run({ task: "t" });
    const buildGate = calls.find((c) => c.label === "gate:build");
    expect(buildGate?.prompt).toContain("--baseline");
    expect(buildGate?.prompt).toContain("--check-command");
  });

  test("a red retest un-verifies an approved review", async () => {
    let first = true;
    const { result } = await run(
      { task: "t" },
      {
        review: () => {
          if (first) {
            first = false;
            return REJECTED;
          }
          return REVIEW_OK;
        },
        "gate:retest": GATE_RED,
      },
    );
    expect(result.verified).toBe(false);
  });
});

describe("commit policy", () => {
  test("never commits: suggestions are returned as data", async () => {
    const { result, calls } = await run({ task: "t" });
    expect(result.suggested_commits.map((c: any) => c.phase)).toEqual(["plan", "build", "docs"]);
    expect(calls.every((c) => !/git commit|git push/i.test(c.prompt) || /Do NOT git commit/i.test(c.prompt))).toBe(true);
  });

  test("commit:true still does not commit — it only records the request", async () => {
    const { result } = await run({ task: "t", commit: true });
    expect(result.commit_requested).toBe(true);
    expect(result.next).toMatch(/no commitea/);
  });

  test("unverified work suggests only the plan commit — the spec is a real artifact either way", async () => {
    const { result } = await run({ task: "t" }, { "gate:build": GATE_RED });
    expect(result.suggested_commits.map((c: any) => c.phase)).toEqual(["plan"]);
  });

  test("each commit message is the words of the agent that produced it", async () => {
    const { result } = await run({ task: "t" });
    expect(result.suggested_commits.find((c: any) => c.phase === "plan").message).toBe(PLAN.commit_message);
    expect(result.suggested_commits.find((c: any) => c.phase === "build").message).toBe(BUILD.commit_message);
    expect(result.suggested_commits.find((c: any) => c.phase === "docs").message).toBe(DOC.commit_message);
  });
});

describe("run identity and isolation", () => {
  test("honours a caller-supplied runId, which is how resume works", async () => {
    const { calls } = await run({ task: "t", runId: "20260101T000000-deadbee" });
    expect(calls[0].prompt).toContain('use EXACTLY "20260101T000000-deadbee"');
  });

  test("keeps the session dir outside the repo so the gate cannot poison itself", async () => {
    const { calls } = await run({ task: "t" });
    expect(calls[0].prompt).toMatch(/OUTSIDE the repo/);
    const gate = calls.find((c) => c.label.startsWith("gate"));
    expect(gate?.prompt).toContain(`--ignore ${REQUEST.session_dir}`);
  });

  test("forbids agents from editing their own grader", async () => {
    const { calls } = await run({ task: "t" });
    const builder = calls.find((c) => c.label === "build");
    expect(builder?.prompt).toMatch(/gate\.ts/);
    expect(builder?.prompt).toMatch(/invalidates the run/);
  });

  test("unverified runs leave the tree dirty on purpose and say so", async () => {
    const { result } = await run({ task: "t" }, { "gate:build": GATE_RED });
    expect(result.document).toBeNull();
    expect(result.next).toMatch(/NO verificado/);
  });
});
