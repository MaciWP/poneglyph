import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { parseCoverage, coverageFor, changedLines } from "../scripts/coverage.mjs";
import { gitSnapshot, fingerprint } from "../scripts/git.mjs";
import { readEvidence, runValidation } from "../scripts/validation.mjs";

const dirs: string[] = [];
afterEach(async () => {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
async function repo() {
  const dir = await mkdtemp(join(tmpdir(), "workboard-test-"));
  dirs.push(dir);
  execFileSync("git", ["init", "-q", "-b", "main", dir]);
  return dir;
}
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd }).toString();
test("changed-line coverage ignores old uncovered lines and never treats a missing file as covered", () => {
  const files = parseCoverage("TN:\nSF:src/a.ts\nDA:1,0\nDA:2,1\nDA:3,0\nend_of_record\n", "lcov");
  const result = coverageFor(files, { "src/a.ts": [2], "src/missing.ts": [1] });
  expect(result.files[0]).toMatchObject({ path: "src/a.ts", covered: 1, total: 1 });
  expect(result.files[0].filePercent).toBeCloseTo(100 / 3, 10);
  expect(result.missing).toEqual(["src/missing.ts"]);
  expect(result.percent).toBeNull();
  expect(result.knownPercent).toBe(100);
});
test("Cobertura coalesces repeated class lines, handles attributes and XML entities", () => {
  const xml =
    '<coverage><packages><package><classes><class filename="src/a&amp;b.py"><lines><line hits="0" number="1"/><line number="2" hits="1"/></lines></class><class filename="src/a&amp;b.py"><lines><line number="1" hits="2"/></lines></class></classes></package></packages></coverage>';
  expect(coverageFor(parseCoverage(xml, "cobertura"), { "src/a&b.py": [1, 2] }).percent).toBe(100);
  expect(() =>
    parseCoverage('<!DOCTYPE x SYSTEM "file:///etc/passwd"><coverage/>', "cobertura"),
  ).toThrow();
  expect(() => parseCoverage("SF:a\nDA:nope,1\nend_of_record", "lcov")).toThrow();
});
test("diff hunks exclude deleted lines and track added line positions", () => {
  expect(
    changedLines("@@ -2,2 +2,3 @@\n-old\n+new\n+extra\n keep\n@@ -9 +10 @@\n-a\n+b\n"),
  ).toEqual([2, 3, 10]);
});
test("unborn checkout, staged plus unstaged changes and filenames with spaces", async () => {
  const cwd = await repo();
  await writeFile(join(cwd, "first file.ts"), "one\ntwo\n");
  const first = await gitSnapshot(cwd);
  expect(first.head).toBeNull();
  expect(first.files[0]).toMatchObject({ path: "first file.ts", kind: "untracked", lines: [1, 2] });
  git(cwd, "add", ".");
  git(
    cwd,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "base",
  );
  git(cwd, "checkout", "-qb", "TEST-123");
  await writeFile(join(cwd, "first file.ts"), "one\nchanged\n");
  git(cwd, "add", ".");
  await writeFile(join(cwd, "first file.ts"), "one\nchanged\nthree\n");
  const next = await gitSnapshot(cwd, "main");
  expect(next.files[0]).toMatchObject({ staged: true, unstaged: true, lines: [2, 3] });
  const before = await fingerprint(cwd);
  await writeFile(join(cwd, "first file.ts"), "one\nCHANGED\nthree\n");
  expect(await fingerprint(cwd)).not.toBe(before);
});
test("committed ticket changes survive a clean working tree and base is a commit", async () => {
  const cwd = await repo();
  await writeFile(join(cwd, "a"), "old\n");
  git(cwd, "add", ".");
  git(
    cwd,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "base",
  );
  git(cwd, "checkout", "-qb", "TEST-1");
  await writeFile(join(cwd, "a"), "new\n");
  git(cwd, "add", ".");
  git(
    cwd,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "change",
  );
  const s = await gitSnapshot(cwd, "main");
  expect(s.files.map((f: { path: string }) => f.path)).toEqual(["a"]);
  expect(s.dirty).toBe(false);
  expect(s.base).toMatch(/^[a-f0-9]{40,64}$/);
});
test("report provenance, no inferred baseline, invalidation after edit and exclusive validation", async () => {
  const cwd = await repo();
  const home = await mkdtemp(join(tmpdir(), "workboard-state-"));
  dirs.push(home);
  await writeFile(join(cwd, "a.ts"), "export const a = 1;\n");
  const config = {
    report: "coverage/lcov.info",
    format: "lcov",
    command: [
      process.execPath,
      "-e",
      "require('fs').mkdirSync('coverage',{recursive:true});require('fs').writeFileSync('coverage/lcov.info','SF:a.ts\\nDA:1,1\\nend_of_record\\n')",
    ],
  };
  await mkdir(join(cwd, "coverage"));
  await writeFile(join(cwd, config.report), "SF:a.ts\nDA:1,1\nend_of_record\n");
  expect((await readEvidence(cwd, config, home)).state).toBe("unverified");
  const result = await runValidation(cwd, config, home);
  expect(result.exitCode).toBe(0);
  expect((await readEvidence(cwd, config, home)).state).toBe("current");
  expect((await readEvidence(cwd, config, home)).baseline).toBeNull();
  await writeFile(join(cwd, "a.ts"), "export const a = 2;\n");
  expect((await readEvidence(cwd, config, home)).state).toBe("stale");
  const slow = { ...config, command: [process.execPath, "-e", "setTimeout(()=>{},250)"] };
  const running = runValidation(cwd, slow, home);
  await new Promise((r) => setTimeout(r, 60));
  await expect(runValidation(cwd, slow, home)).rejects.toThrow(/running|en curso/);
  await running;
  // A command that succeeds without regenerating its report must not bless an old report.
  expect((await readEvidence(cwd, config, home)).state).not.toBe("current");
});

test("coverage exclusions never hide neighbouring source, missing XML hits are refused", async () => {
  const cwd = await repo();
  await mkdir(join(cwd, "src"));
  await writeFile(join(cwd, "src/a.ts"), "before\n");
  const config = { report: "src/lcov.info", format: "lcov" };
  const { excluded, validationConfig } = await import("../scripts/validation.mjs");
  const before = await fingerprint(cwd, excluded(config));
  await writeFile(join(cwd, "src/a.ts"), "after\n");
  expect(await fingerprint(cwd, excluded(config))).not.toBe(before);
  expect(() => validationConfig({ ...config, exclude: ["./"] })).toThrow();
  expect(() =>
    parseCoverage(
      '<coverage><class filename="a"><line number="1"/></class></coverage>',
      "cobertura",
    ),
  ).toThrow();
});

test("missing base keeps local evidence and Git pathspec-looking names are literal", async () => {
  const cwd = await repo();
  await writeFile(join(cwd, ":(glob)*.ts"), "old\n");
  await writeFile(join(cwd, "other.ts"), "old\n");
  git(cwd, "add", ".");
  git(
    cwd,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "base",
  );
  await writeFile(join(cwd, ":(glob)*.ts"), "new\n");
  await writeFile(join(cwd, "other.ts"), "old\nsecond\n");
  const s = await gitSnapshot(cwd, "not-fetched");
  expect(s.base).toBeNull();
  expect(s.baseError).toBeTruthy();
  expect(s.files.find((f: { path: string }) => f.path === ":(glob)*.ts").lines).toEqual([1]);
});

test("coverage failure and a source edit during execution cannot produce current evidence", async () => {
  const cwd = await repo(),
    home = await mkdtemp(join(tmpdir(), "workboard-run-"));
  dirs.push(home);
  await writeFile(join(cwd, "a.ts"), "old\n");
  const config = {
    report: "lcov.info",
    format: "lcov",
    command: [
      process.execPath,
      "-e",
      "require('fs').writeFileSync('lcov.info','SF:a.ts\\nDA:1,1\\nend_of_record\\n');require('fs').writeFileSync('a.ts','new\\n')",
    ],
  };
  await runValidation(cwd, config, home);
  expect((await readEvidence(cwd, config, home)).state).toBe("stale");
  await runValidation(
    cwd,
    { ...config, command: [process.execPath, "-e", "process.exit(1)"] },
    home,
  );
  expect((await readEvidence(cwd, config, home)).state).toBe("failed");
});

test("real launch HTTP uses shell send endpoint, reserves once, and the token runs the configured argv", async () => {
  const { configure, launchValidation } = await import("../scripts/workboard.mjs");
  const { recordPath, jsonRead } = await import("../scripts/validation.mjs");
  const { root } = await import("../scripts/git.mjs");
  const cwd = await root(await repo()),
    home = await mkdtemp(join(tmpdir(), "workboard-launch-"));
  dirs.push(home);
  await writeFile(join(cwd, "a.ts"), "one\n");
  const coverage = {
    report: "lcov.info",
    format: "lcov",
    command: [
      process.execPath,
      "-e",
      "require('fs').writeFileSync('lcov.info','SF:a.ts\\nDA:1,1\\nend_of_record\\n')",
    ],
  };
  await configure(cwd, { coverage }, home);
  const calls: { path: string; body: unknown }[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const path = new URL(req.url).pathname,
        body = await req.json();
      calls.push({ path, body });
      if (path === "/api/terminals")
        return Response.json({ terminal: { id: "coverage-terminal" } });
      if (path === "/api/terminals/coverage-terminal/send") return Response.json({ sent: true });
      return new Response("wrong endpoint", { status: 404 });
    },
  });
  try {
    const options = { aos: `http://127.0.0.1:${server.port}`, location: "repo:test" };
    expect((await launchValidation(cwd, home, options)).terminal).toBe("coverage-terminal");
    expect(calls[1]?.body).toMatchObject({ enter: true, text: expect.stringContaining("/bin/sh") });
    await expect(launchValidation(cwd, home, options)).rejects.toThrow(/already/);
    expect(calls).toHaveLength(2);
    const lease = await jsonRead(recordPath(home, cwd) + ".lock");
    await expect(runValidation(cwd, coverage, home, "wrong-token")).rejects.toThrow();
    const slow = {
      ...coverage,
      command: [process.execPath, "-e", `setTimeout(() => { ${coverage.command[2]} }, 150)`],
    };
    const first = runValidation(cwd, slow, home, lease.token);
    await new Promise((r) => setTimeout(r, 30));
    await expect(runValidation(cwd, slow, home, lease.token)).rejects.toThrow(/already/);
    expect((await first).exitCode).toBe(0);
    expect((await readEvidence(cwd, coverage, home)).state).toBe("current");
  } finally {
    server.stop(true);
  }
});

test("on-demand file detail stays within the checkout and shell quoting preserves metacharacters", async () => {
  const { fileDiff, quoteShell } = await import("../scripts/workboard.mjs");
  const cwd = await repo();
  await writeFile(join(cwd, "a.ts"), "new file\n");
  expect((await fileDiff(cwd, "a.ts")).source).toBe("new file\n");
  await expect(fileDiff(cwd, "../elsewhere")).rejects.toThrow();
  const hostile = "path with ' quotes $(echo wrong) `echo wrong`";
  const actual = execFileSync("/bin/sh", ["-c", `printf %s ${quoteShell(hostile)}`]).toString();
  expect(actual).toBe(hostile);
});

test("GitHub separates no PR, provider failure and missing approval; it preserves the published head", async () => {
  const { githubSnapshot } = await import("../scripts/workboard.mjs");
  const home = await mkdtemp(join(tmpdir(), "workboard-gh-"));
  dirs.push(home);
  const none = await githubSnapshot("/repo", "no-pr", home, null, async () => ({
    code: 1,
    err: "no pull requests found for branch",
    out: "",
  }));
  expect(none.state).toBe("none");
  const denied = await githubSnapshot("/repo", "no-auth", home, null, async () => ({
    code: 1,
    err: "authentication required",
    out: "",
  }));
  expect(denied.state).toBe("error");
  const loaded = await githubSnapshot("/repo", "pr", home, null, async () => ({
    code: 0,
    err: "",
    out: JSON.stringify({
      number: 7,
      url: "https://github.com/example/repo/pull/7",
      headRefOid: "a".repeat(40),
      baseRefName: "main",
      reviewDecision: "",
      statusCheckRollup: [{ name: "Tests", conclusion: "FAILURE" }],
    }),
  }));
  expect(loaded.approval).toBe("UNKNOWN");
  expect(loaded.head).toBe("a".repeat(40));
  expect(loaded.checks[0].state).toBe("FAILURE");
});

test("ticket scope shows changed linked repositories, then current checkout when none changed", async () => {
  const { configure, githubSnapshot, snapshot } = await import("../scripts/workboard.mjs");
  const { root } = await import("../scripts/git.mjs");
  const home = await mkdtemp(join(tmpdir(), "workboard-scope-"));
  dirs.push(home);
  const current = await root(await repo()),
    linked = await root(await repo());
  for (const cwd of [current, linked]) {
    await writeFile(join(cwd, "a.ts"), "old\n");
    git(cwd, "add", ".");
    git(
      cwd,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "base",
    );
    await githubSnapshot(cwd, "main", home, null, async () => ({
      code: 1,
      err: "no pull requests found",
      out: "",
    }));
  }
  await configure(current, { linked: [linked], ticket: "ABC-12" }, home);
  expect((await snapshot(current, home)).repos.map((r: { cwd: string }) => r.cwd)).toEqual([
    current,
  ]);
  await writeFile(join(linked, "a.ts"), "changed\n");
  const active = await snapshot(current, home);
  expect(active.repos.map((r: { cwd: string }) => r.cwd)).toEqual([linked]);
  expect(active.ticket).toBe("ABC-12");
  expect(active.bridge.state).toBe("offline");
});

test("a ticket environment folder shows its checkouts instead of failing as a non-repository", async () => {
  const { githubSnapshot, snapshot } = await import("../scripts/workboard.mjs");
  const { realpath } = await import("node:fs/promises");
  const home = await mkdtemp(join(tmpdir(), "workboard-env-home-"));
  const env = await realpath(await mkdtemp(join(tmpdir(), "workboard-env-")));
  dirs.push(home, env);
  await mkdir(join(env, ".claude"));
  await mkdir(join(env, "notes"));
  const repos = ["backend", "contract"].map((name) => join(env, name));
  for (const cwd of repos) {
    execFileSync("git", ["init", "-q", "-b", "feature/abc-7-disconnect", cwd]);
    await writeFile(join(cwd, "a.ts"), "old\n");
    git(cwd, "add", ".");
    git(
      cwd,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "base",
    );
    await githubSnapshot(cwd, "feature/abc-7-disconnect", home, null, async () => ({
      code: 1,
      err: "no pull requests found",
      out: "",
    }));
  }
  const clean = await snapshot(env, home);
  expect(clean.cwd).toBe(env);
  expect(clean.ticket).toBe("ABC-7");
  expect(clean.repos.map((r: { cwd: string }) => r.cwd)).toEqual(repos);
  await writeFile(join(repos[1], "a.ts"), "changed\n");
  const active = await snapshot(env, home);
  expect(
    active.repos.map((r: { cwd: string; files: unknown[] }) => [r.cwd, r.files.length]),
  ).toEqual([[repos[1], 1]]);
  await expect(snapshot(join(env, "notes"), home)).rejects.toThrow(/not a git repository/);
});

test("whole-file comparison requires the exact declared baseline; legacy gaps do not lower changed-line coverage", async () => {
  const cwd = await repo(),
    home = await mkdtemp(join(tmpdir(), "workboard-baseline-"));
  dirs.push(home);
  await writeFile(join(cwd, "a.ts"), "legacy\nold\n");
  git(cwd, "add", ".");
  git(
    cwd,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "base",
  );
  const revision = git(cwd, "rev-parse", "HEAD").trim();
  git(cwd, "checkout", "-qb", "ABC-12");
  await writeFile(join(cwd, "a.ts"), "legacy\nnew\n");
  await writeFile(join(cwd, "before.info"), "SF:a.ts\nDA:1,0\nDA:2,1\nend_of_record\n");
  const config = {
    report: "lcov.info",
    format: "lcov",
    baseline: { report: "before.info", revision },
    command: [
      process.execPath,
      "-e",
      "require('fs').writeFileSync('lcov.info','SF:a.ts\\nDA:1,0\\nDA:2,1\\nend_of_record\\n')",
    ],
  };
  await runValidation(cwd, config, home);
  const evidence = await readEvidence(cwd, config, home);
  expect(evidence.state).toBe("current");
  expect(evidence.coverage.percent).toBe(100);
  expect(evidence.coverage.files[0].filePercent).toBe(50);
  expect(evidence.baseline).toEqual([{ path: "a.ts", percent: 50 }]);
  expect(
    (
      await readEvidence(
        cwd,
        { ...config, baseline: { ...config.baseline, revision: "a".repeat(40) } },
        home,
      )
    ).baseline,
  ).toBeNull();
});

test("pytest-cov writing XML is detected from pytest's own option files", async () => {
  const { detectCoverage } = await import("../scripts/validation.mjs");
  const dir = await mkdtemp(join(tmpdir(), "workboard-detect-"));
  dirs.push(dir);
  expect(await detectCoverage(dir)).toBeNull();
  await writeFile(join(dir, "pytest.ini"), "[pytest]\naddopts = --cov=apps --cov-report=xml -q\n");
  expect(await detectCoverage(dir)).toEqual({
    report: "coverage.xml",
    format: "cobertura",
    command: ["pytest"],
  });
  await mkdir(join(dir, ".venv", "bin"), { recursive: true });
  await writeFile(join(dir, ".venv", "bin", "pytest"), "");
  expect((await detectCoverage(dir))?.command).toEqual([join(dir, ".venv", "bin", "pytest")]);
  await writeFile(
    join(dir, "pytest.ini"),
    "[pytest]\naddopts = --cov=apps\n[other]\nx = --cov-report=xml\n",
  );
  expect(await detectCoverage(dir)).toBeNull();
  await rm(join(dir, "pytest.ini"));
  await writeFile(
    join(dir, "pyproject.toml"),
    '[project]\nname = "x"\n\n[tool.pytest.ini_options]\naddopts = [\n  "--cov=src",\n  "--cov-report=xml:out/cov.xml",\n]\n',
  );
  expect((await detectCoverage(dir))?.report).toBe("out/cov.xml");
  await writeFile(
    join(dir, "pyproject.toml"),
    '[tool.pytest.ini_options]\naddopts = "--cov-report=xml:/tmp/abs.xml"\n',
  );
  expect(await detectCoverage(dir)).toBeNull();
});

test("Cobertura filenames resolve against their <source> directories inside the repository", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workboard-sources-"));
  dirs.push(dir);
  await mkdir(join(dir, "apps", "assets"), { recursive: true });
  await mkdir(join(dir, "tests_app"), { recursive: true });
  await writeFile(join(dir, "apps", "assets", "models.py"), "");
  await writeFile(join(dir, "tests_app", "test_models.py"), "");
  const xml = (sources: string[], names: string[]) =>
    `<coverage><sources>${sources.map((s) => `<source>${s}</source>`).join("")}</sources><packages><package><classes>${names
      .map((n) => `<class filename="${n}"><lines><line number="1" hits="1"/></lines></class>`)
      .join("")}</classes></package></packages></coverage>`;
  const report = parseCoverage(
    xml([join(dir, "apps"), join(dir, "tests_app")], ["assets/models.py", "test_models.py"]),
    "cobertura",
    dir,
  );
  expect(Object.keys(report).sort()).toEqual(["apps/assets/models.py", "tests_app/test_models.py"]);
  // A source outside the repository is ignored; an absolute filename outside it is refused.
  expect(Object.keys(parseCoverage(xml(["/elsewhere"], ["a.py"]), "cobertura", dir))).toEqual([
    "a.py",
  ]);
  expect(() => parseCoverage(xml([], ["/elsewhere/a.py"]), "cobertura", dir)).toThrow(
    "Coverage path outside repository",
  );
});

test("changed files of a kind the report never measures do not block the total", () => {
  const report = parseCoverage("TN:\nSF:app/a.py\nDA:1,1\nDA:2,0\nend_of_record\n", "lcov");
  const result = coverageFor(report, {
    "app/a.py": [1],
    "fixtures/data.json": [3],
    "locale/es.po": [1],
    "conftest.py": [1],
  });
  expect(result.missing).toEqual(["conftest.py"]);
  expect(result.knownPercent).toBe(100);
  expect(result.percent).toBeNull();
});

test("a report Workboard did not produce is external, with its time and the changes after it", async () => {
  const { utimes } = await import("node:fs/promises");
  const cwd = await repo(),
    home = await mkdtemp(join(tmpdir(), "workboard-external-"));
  dirs.push(home);
  await writeFile(join(cwd, "a.py"), "x = 1\n");
  git(cwd, "add", ".");
  git(
    cwd,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "base",
  );
  await writeFile(join(cwd, "a.py"), "x = 1\ny = 2\n");
  await writeFile(
    join(cwd, "coverage.xml"),
    '<coverage><packages><package><classes><class filename="a.py"><lines><line number="2" hits="1"/></lines></class></classes></package></packages></coverage>',
  );
  const old = new Date(Date.now() - 60_000);
  await utimes(join(cwd, "coverage.xml"), old, old);
  const config = { report: "coverage.xml", format: "cobertura", exclude: ["coverage.xml"] };
  const evidence = await readEvidence(cwd, config, home);
  expect(evidence.state).toBe("unverified");
  expect(evidence.coverage.percent).toBe(100);
  expect(evidence.reportAt).toBe(old.getTime());
  expect(evidence.changedAfter).toBe(1);
});
