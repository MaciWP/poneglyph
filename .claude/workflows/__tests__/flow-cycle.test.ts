import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// A Workflow script is not an importable module: the runtime injects its globals
// (args/agent/parallel/pipeline/phase/log) and wraps the body in an async
// function, which is why top-level `return` is legal there. Compiling the source
// with AsyncFunction reproduces that contract exactly — and doubles as a parse
// check — so the deterministic half (arg validation, DAG waves, file-collision
// serialization, retry budget, verdict) is testable without spawning agents.
const SOURCE = readFileSync(join(import.meta.dir, "..", "flow-cycle.js"), "utf8");
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
const phase = () => {};

type US = { id: string; wave: number; files: string[]; deps?: string[]; oracle?: string };
const us = (id: string, wave: number, files: string[], extra: Partial<US> = {}) => ({
  id,
  title: `t-${id}`,
  wave,
  depends_on: extra.deps ?? [],
  files,
  execution_prompt: "do the thing",
  oracle_mode: extra.oracle ?? "optional",
  oracle_ref: "tests.md §T1",
});

const doneHU = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  status: "done",
  summary: "s",
  files_touched: [`f-${id}.ts`],
  oracle_evidence: "red→green",
  check: "bun test: 10 pass",
  drillme: ["a", "b", "c", "d"],
  docs_sync: "n/a",
  ...over,
});

type StubOpts = {
  ready?: boolean;
  us?: unknown[];
  hu?: (label: string) => unknown;
  checks?: unknown;
  findings?: Record<string, unknown>;
};

/** Records every agent label so the test can assert WHICH agents ran, not just the result. */
function stub({ ready = true, us: stories = [], hu, checks, findings = {} }: StubOpts) {
  const calls: string[] = [];
  const agent = async (_prompt: string, opts: { label: string }) => {
    calls.push(opts.label);
    const l = opts.label;
    if (l.startsWith("preflight")) {
      return ready
        ? {
            ready: true,
            reason: "",
            today: "2026-08-06",
            check_command: "bun test ./.claude/",
            typecheck_command: "",
            lint_command: "",
            oracle_source: "tests.md",
            test_policy: "auxiliary",
            review_level: "standard",
            review_level_reason: "r",
            spec_summary: "s",
            us: stories,
          }
        : { ready: false, reason: "fase 2.5 sin cerrar" };
    }
    if (l.startsWith("build:")) return hu!(l);
    if (l === "review:base-checks")
      return checks ?? { checks: [{ name: "suite", command: "bun test", ok: true, detail: "10 pass" }], diff_stat: "3 files" };
    if (l === "review:fresh-reviewer")
      return { findings: findings.reviewer ?? [], spec_drift: findings.drift ?? "none", spec_drift_note: "" };
    if (l === "review:quality") return { findings: findings.quality ?? [] };
    if (l === "review:performance") return { findings: findings.perf ?? [] };
    if (l === "review:security") return { findings: findings.security ?? [] };
    if (l.startsWith("synthesize")) return { path: ".claude/plans/x/review.md", written: true, summary_line: "ok", notes: "" };
    throw new Error(`label inesperado: ${l}`);
  };
  return { calls, agent };
}

const run = (args: unknown, s: ReturnType<typeof stub>) => runScript(args, s.agent, parallel, pipeline, phase, () => {});

describe("flow-cycle — guardas de entrada", () => {
  test("prosa en vez de slug aborta con una razón accionable", async () => {
    const r = await run("Intenta mejorar este workflow", stub({}));
    expect(r.aborted).toBe(true);
    expect(r.reason).toMatch(/NNN-kebab/);
  });

  test("plan no listo aborta con el motivo del preflight", async () => {
    const r = await run({ slug: "032-x" }, stub({ ready: false }));
    expect(r.aborted).toBe(true);
    expect(r.reason).toBe("fase 2.5 sin cerrar");
  });

  test("only= que no casa con ninguna HU nombra las reales", async () => {
    const s = stub({ us: [us("US1", 1, ["a.ts"])], hu: () => doneHU("US1") });
    const r = await run({ slug: "032-x", only: ["US9"] }, s);
    expect(r.aborted).toBe(true);
    expect(r.reason).toMatch(/US1/);
  });
});

describe("flow-cycle — build por waves", () => {
  test("HUs con ficheros colisionando se serializan y quedan etiquetadas", async () => {
    const stories = [us("US1", 1, ["a.ts"]), us("US2", 1, ["a.ts"]), us("US3", 2, ["b.ts"], { deps: ["US1"] })];
    const s = stub({ us: stories, hu: (l) => doneHU(l.replace("build:", "").replace("(seq)", "")) });
    const r = await run({ slug: "032-x" }, s);
    expect(r.done).toEqual(["US1", "US2", "US3"]);
    expect(s.calls).toContain("build:US2(seq)");
    expect(s.calls).toContain("build:US1");
  });

  test("una HU con dependencia abierta no se ejecuta y se reporta como violación del DAG", async () => {
    const stories = [us("US1", 1, ["a.ts"]), us("US2", 2, ["b.ts"], { deps: ["US1"] })];
    const s = stub({
      us: stories,
      hu: (l) =>
        l.includes("US1")
          ? { id: "US1", status: "blocked", summary: "s", files_touched: [], oracle_evidence: "-", check: "-", drillme: [], questions: ["¿qué formato?"] }
          : doneHU("US2"),
    });
    const r = await run({ slug: "032-x" }, s);
    expect(s.calls).not.toContain("build:US2");
    expect(r.blocked.map((b: { id: string }) => b.id)).toEqual(["US1", "US2"]);
    expect(r.retro_inputs.hu_questions.join()).toMatch(/formato/);
  });

  test("el mismo error dos veces gasta 1 reintento y para (identical-error override)", async () => {
    const s = stub({
      us: [us("US1", 1, ["a.ts"])],
      hu: () => ({ id: "US1", status: "failed", summary: "s", files_touched: [], oracle_evidence: "-", check: "-", drillme: [], error: "TypeError: x is not a function" }),
    });
    const r = await run({ slug: "032-x" }, s);
    expect(s.calls.filter((c) => c.startsWith("build:")).length).toBe(2);
    expect(r.failed[0].error).toMatch(/identical-error override/);
  });
});

describe("flow-cycle — fase 4 y veredicto", () => {
  test("todo verde → APPROVED, review.md escrito y boundary checks devueltos", async () => {
    const s = stub({ us: [us("US1", 1, ["a.ts"])], hu: () => doneHU("US1") });
    const r = await run({ slug: "032-x" }, s);
    expect(r.verdict_proposed).toBe("APPROVED");
    expect(r.review_written).toBe(true);
    expect(r.boundary_checks.length).toBe(5);
  });

  test("level standard sin área crítica no gasta performance ni security", async () => {
    const s = stub({ us: [us("US1", 1, ["a.ts"])], hu: () => doneHU("US1") });
    await run({ slug: "032-x" }, s);
    expect(s.calls).not.toContain("review:performance");
    expect(s.calls).not.toContain("review:security");
  });

  test("path crítico dispara security-audit y un BLOCKER fuerza BLOCKED", async () => {
    const s = stub({
      us: [us("US1", 1, ["src/auth/session.ts"])],
      hu: () => doneHU("US1", { files_touched: ["src/auth/session.ts"] }),
      findings: { security: [{ severity: "BLOCKER", summary: "secret hardcodeado", locus: "src/auth/session.ts:12", recommendation: "mover a env" }] },
    });
    const r = await run({ slug: "032-x", level: "full" }, s);
    expect(s.calls).toContain("review:security");
    expect(s.calls).toContain("review:performance");
    expect(r.verdict_proposed).toBe("BLOCKED");
    expect(r.findings[0].source).toBe("security-audit");
  });

  test("una HU fallida impide el APPROVED aunque los checks estén verdes", async () => {
    const s = stub({
      us: [us("US1", 1, ["a.ts"])],
      hu: () => ({ id: "US1", status: "failed", summary: "s", files_touched: [], oracle_evidence: "-", check: "-", drillme: [], error: "boom" }),
    });
    const r = await run({ slug: "032-x" }, s);
    expect(r.verdict_proposed).toBe("NEEDS_CHANGES");
  });

  test("spec_drift scope_creep degrada el veredicto", async () => {
    const s = stub({ us: [us("US1", 1, ["a.ts"])], hu: () => doneHU("US1"), findings: { drift: "scope_creep" } });
    const r = await run({ slug: "032-x" }, s);
    expect(r.verdict_proposed).toBe("NEEDS_CHANGES");
    expect(r.verdict_reason).toMatch(/spec_drift/);
  });

  test("el veredicto es PROPUESTO: el handback manda ratificarlo al humano", async () => {
    const s = stub({ us: [us("US1", 1, ["a.ts"])], hu: () => doneHU("US1") });
    const r = await run({ slug: "032-x" }, s);
    expect(r).not.toHaveProperty("verdict");
    expect(r.next).toMatch(/flow-state verdict/);
  });
});
