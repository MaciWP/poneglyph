import { describe, test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  verdictConsistent,
  fileDigest,
  diffDelta,
  claimsVsDelta,
  derivePatterns,
  matchPattern,
  protectedHit,
  outsideAllowlist,
  parseSuite,
  report,
  PHASE_WRITES,
  SELF_PATHS,
  type Envelope,
  type Snapshot,
} from "../gate";

const failed = (checks: ReturnType<typeof verdictConsistent>) => checks.filter((c) => !c.passed).map((c) => c.name);

describe("verdictConsistent", () => {
  test("refutes approved=true that still ships blocking items", () => {
    const env: Envelope = { approved: true, blocking: ["auth is bypassable"] };
    expect(failed(verdictConsistent(env))).toContain("approved vs blocking");
  });

  test("refutes approved=true with unmet findings", () => {
    const env: Envelope = { approved: true, findings: [{ requirement: "AC2", met: false }] };
    expect(failed(verdictConsistent(env))).toContain("approved vs findings");
  });

  test("refutes a rejection that names no problem", () => {
    const env: Envelope = { approved: false, blocking: [], findings: [] };
    expect(failed(verdictConsistent(env))).toContain("rejection names a problem");
  });

  test("refutes approved=true while the suite is red", () => {
    const env: Envelope = { approved: true, blocking: [], findings: [], tests_passed: false };
    expect(failed(verdictConsistent(env))).toContain("approved vs suite");
  });

  test('refutes status="done" with no files touched', () => {
    const env: Envelope = { status: "done", files_touched: [] };
    expect(failed(verdictConsistent(env))).toContain("done vs files_touched");
  });

  test("passes a coherent approval", () => {
    const env: Envelope = { approved: true, blocking: [], findings: [{ requirement: "AC1", met: true }] };
    expect(failed(verdictConsistent(env))).toEqual([]);
  });

  test("passes a coherent rejection", () => {
    const env: Envelope = { approved: false, blocking: ["missing validation"] };
    expect(failed(verdictConsistent(env))).toEqual([]);
  });

  test("does not invent a suite check when tests_passed is absent", () => {
    const env: Envelope = { approved: true, blocking: [], findings: [] };
    expect(verdictConsistent(env).map((c) => c.name)).not.toContain("approved vs suite");
  });

  // Regression: the first smoke run against the real repo failed a healthy build
  // envelope on "rejection names a problem", because a missing `approved` read as
  // false. Verdict checks belong only to envelopes that carry a verdict.
  test("a build envelope carries no verdict, so no verdict check applies to it", () => {
    const env: Envelope = { status: "done", files_touched: ["a.ts"] };
    const names = verdictConsistent(env).map((c) => c.name);
    expect(names).not.toContain("rejection names a problem");
    expect(names).not.toContain("approved vs blocking");
    expect(failed(verdictConsistent(env))).toEqual([]);
  });
});

describe("diffDelta", () => {
  const before: Snapshot = { "a.ts": " M:aaa", "b.ts": "??:bbb" };

  test("reports a newly changed file", () => {
    expect(diffDelta(before, { ...before, "c.ts": "??:ccc" })).toEqual(["c.ts"]);
  });

  test("reports a file whose status changed", () => {
    expect(diffDelta(before, { ...before, "a.ts": "MM:aaa" })).toEqual(["a.ts"]);
  });

  // The dirty-tree failure the smoke run exposed: an already-untracked file edited
  // further keeps the same "??" status code. Without the content digest the delta is
  // empty and the gate calls a real change "never made".
  test("reports a file whose CONTENT changed under an unchanged status code", () => {
    expect(diffDelta(before, { ...before, "b.ts": "??:ZZZ" })).toEqual(["b.ts"]);
  });

  test("a tree at rest yields an empty delta — the dirty-repo case that absolute state would fail", () => {
    const dirty: Snapshot = Object.fromEntries(Array.from({ length: 119 }, (_, i) => [`f${i}.ts`, ` M:h${i}`]));
    expect(diffDelta(dirty, dirty)).toEqual([]);
  });

  test("reports a file that left the porcelain list (reverted)", () => {
    expect(diffDelta(before, { "a.ts": " M:aaa" })).toEqual(["b.ts"]);
  });
});

describe("fileDigest", () => {
  test("distinguishes two different contents", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gate-"));
    const a = join(dir, "a.txt");
    writeFileSync(a, "one");
    const first = await fileDigest(a);
    writeFileSync(a, "two");
    expect(await fileDigest(a)).not.toBe(first);
  });

  test("is stable for unchanged content", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gate-"));
    const a = join(dir, "a.txt");
    writeFileSync(a, "same");
    expect(await fileDigest(a)).toBe(await fileDigest(a));
  });

  test("reports a missing file as absent rather than throwing", async () => {
    expect(await fileDigest("/definitely/not/here.txt")).toBe("absent");
  });
});

describe("claimsVsDelta", () => {
  test("catches a file claimed but never touched", () => {
    expect(claimsVsDelta(["a.ts", "b.ts"], ["a.ts"]).missing).toEqual(["b.ts"]);
  });

  test("catches a file touched but not declared — sssf's blind spot", () => {
    expect(claimsVsDelta(["a.ts"], ["a.ts", "sneaky.ts"]).undeclared).toEqual(["sneaky.ts"]);
  });

  test("clean when claims and delta agree", () => {
    const r = claimsVsDelta(["a.ts", "b.ts"], ["b.ts", "a.ts"]);
    expect(r.missing).toEqual([]);
    expect(r.undeclared).toEqual([]);
  });

  test("ignores the run's own session directory so the gate does not poison itself", () => {
    const r = claimsVsDelta(["a.ts"], ["a.ts", ".sssf/run1/envelope.json"], [".sssf/"]);
    expect(r.undeclared).toEqual([]);
  });
});

describe("derivePatterns", () => {
  const settings = {
    permissions: { deny: ["Bash(rm -rf /)", "Read(./.env)", "Edit(.env)", "Write(*.pem)", "Edit(*credentials*)"] },
    autoMode: { soft_deny: ["$defaults", "Edit(.claude/settings.json)", "Write(.claude/settings.json)"] },
  };

  test("extracts only write-shaped rules", () => {
    const p = derivePatterns(settings);
    expect(p).toContain(".env");
    expect(p).toContain("*.pem");
    expect(p).toContain(".claude/settings.json");
  });

  test("ignores Bash and Read rules — they bound running and reading, not mutating", () => {
    const p = derivePatterns(settings);
    expect(p).not.toContain("rm -rf /");
    expect(p.some((x) => x.includes("rm -rf"))).toBe(false);
  });

  test("survives an empty or malformed settings object", () => {
    expect(derivePatterns({})).toEqual([]);
    expect(derivePatterns(null)).toEqual([]);
  });

  test("deduplicates a pattern denied in both lists", () => {
    const p = derivePatterns({ permissions: { deny: ["Edit(.env)"] }, autoMode: { soft_deny: ["Edit(.env)"] } });
    expect(p.filter((x) => x === ".env")).toHaveLength(1);
  });

  test("unions user and project protection sources", () => {
    expect(
      derivePatterns([
        { autoMode: { soft_deny: ["Edit(.claude/settings.global.json)"] } },
        { permissions: { deny: ["Write(.env)"] } },
      ]),
    ).toEqual([".claude/settings.global.json", ".env"]);
  });
});

describe("matchPattern", () => {
  test("matches an exact path", () => {
    expect(matchPattern(".claude/settings.json", ".claude/settings.json")).toBe(true);
  });

  test("matches a bare filename anywhere in the tree", () => {
    expect(matchPattern("some/dir/.env", ".env")).toBe(true);
  });

  test("matches a basename glob in a subdirectory", () => {
    expect(matchPattern("certs/server.pem", "*.pem")).toBe(true);
  });

  test("matches a substring glob", () => {
    expect(matchPattern("config/my-credentials-file.ts", "*credentials*")).toBe(true);
  });

  test("does not match an unrelated path", () => {
    expect(matchPattern("src/index.ts", "*.pem")).toBe(false);
  });

  test("matches a recursive glob", () => {
    expect(matchPattern("docs/nested/page.md", "**/*.md")).toBe(true);
  });
});

describe("protectedHit", () => {
  test("flags a protected path in the delta", () => {
    expect(protectedHit(["src/a.ts", ".claude/settings.json"], [".claude/settings.json"])).toEqual([".claude/settings.json"]);
  });

  test("clean delta yields no hit", () => {
    expect(protectedHit(["src/a.ts"], [".env", "*.pem"])).toEqual([]);
  });
});

describe("outsideAllowlist", () => {
  test("null allowlist lets everything through", () => {
    expect(outsideAllowlist(["src/a.ts"], PHASE_WRITES.build)).toEqual([]);
  });

  test("empty allowlist makes a phase read-only — a reviewer that cannot fix cannot quietly fix", () => {
    expect(outsideAllowlist(["src/a.ts"], PHASE_WRITES.review)).toEqual(["src/a.ts"]);
  });

  test("the documenter may write markdown but not source", () => {
    expect(outsideAllowlist(["docs/x.md"], PHASE_WRITES.document)).toEqual([]);
    expect(outsideAllowlist(["src/index.ts"], PHASE_WRITES.document)).toEqual(["src/index.ts"]);
  });
});

describe("parseSuite", () => {
  test("zero tests is RED — a suite that did not run is not a green suite", () => {
    expect(parseSuite(0, "Ran 0 tests across 0 files.").ok).toBe(false);
  });

  test("non-zero exit is RED even when the output looks fine", () => {
    expect(parseSuite(1, "178 pass\n0 fail").ok).toBe(false);
  });

  test("exit 0 with parsed failures is RED — contradictory signals", () => {
    expect(parseSuite(0, "170 pass\n8 fail").ok).toBe(false);
  });

  test("green when exit code and counts agree", () => {
    const r = parseSuite(0, "232 pass\n 0 fail\nRan 232 tests across 16 files.");
    expect(r.ok).toBe(true);
    expect(r.pass).toBe(232);
    expect(r.ran).toBe(232);
  });
});

describe("report", () => {
  test("any failed check fails the gate (fail-closed)", () => {
    const r = report("build", [
      { name: "ok one", passed: true, note: "" },
      { name: "bad one", passed: false, note: "boom" },
    ]);
    expect(r.passed).toBe(false);
    expect(r.violations).toEqual(["bad one: boom"]);
  });

  test("all green passes and records what it verified", () => {
    const r = report("build", [{ name: "ok", passed: true, note: "checked" }]);
    expect(r.passed).toBe(true);
    expect(r.checks).toHaveLength(1);
  });

  test("an empty check list passes — the caller decides which gates apply", () => {
    expect(report("plan", []).passed).toBe(true);
  });
});

describe("SELF_PATHS", () => {
  test("the gate protects its own source — a builder that edits its grader invalidates every gate", () => {
    expect(SELF_PATHS).toContain(".claude/scripts/gate.ts");
    expect(SELF_PATHS).toContain(".claude/workflows/sssf.js");
  });

  // Protecting only the graders leaves the obvious way around them open: gut the
  // assertions and the suite goes green without either grader being touched.
  test("it protects the graders' TESTS too, not just the graders", () => {
    expect(SELF_PATHS).toContain(".claude/scripts/__tests__/gate.test.ts");
    expect(SELF_PATHS).toContain(".claude/workflows/__tests__/sssf.test.ts");
  });
});
