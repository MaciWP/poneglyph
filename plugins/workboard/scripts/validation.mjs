import { mkdir, readFile, writeFile, rename, open, unlink, stat } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { contained, fingerprint, git, gitSnapshot, safeRelative, sha } from "./git.mjs";
import { parseCoverage, coverageFor } from "./coverage.mjs";

export async function jsonRead(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}
export async function atomic(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(tmp, path);
}
export const recordPath = (home, cwd) => join(home, "runs", `${sha(cwd)}.json`);
export const excluded = (config) => [
  ...new Set([config.report, config.baseline?.report, ...(config.exclude ?? [])].filter(Boolean)),
];
export function validationConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Configure a coverage report first");
  const report = safeRelative(raw.report);
  if (!["lcov", "cobertura"].includes(raw.format)) throw Error("Format must be lcov or cobertura");
  if (
    raw.command !== undefined &&
    (!Array.isArray(raw.command) ||
      raw.command.length === 0 ||
      raw.command.length > 100 ||
      raw.command.some((x) => typeof x !== "string" || !x || x.includes("\0") || x.length > 8000))
  )
    throw Error("Command must be an argv array");
  if (
    raw.baseline &&
    (typeof raw.baseline.revision !== "string" || !/^[a-f0-9]{40,64}$/.test(raw.baseline.revision))
  )
    throw Error("Baseline needs its exact commit SHA");
  if (raw.baseline) {
    safeRelative(raw.baseline.report);
    if (!["lcov", "cobertura"].includes(raw.baseline.format ?? raw.format))
      throw Error("Invalid baseline format");
  }
  if (
    raw.exclude !== undefined &&
    (!Array.isArray(raw.exclude) ||
      raw.exclude.length > 30 ||
      raw.exclude.some((p) => {
        safeRelative(p);
        return p.replaceAll("./", "").replaceAll("/", "") === "";
      }))
  )
    throw Error("Exclude must contain explicit output paths");
  return {
    report,
    format: raw.format,
    ...(raw.exclude ? { exclude: raw.exclude } : {}),
    ...(raw.command ? { command: raw.command } : {}),
    ...(raw.baseline
      ? {
          baseline: {
            report: raw.baseline.report,
            revision: raw.baseline.revision,
            format: raw.baseline.format ?? raw.format,
          },
        }
      : {}),
  };
}
// pytest-cov writing Cobertura XML, read from where pytest reads its options.
const PYTEST_FILES = [
  ["pytest.ini", "pytest"],
  ["pyproject.toml", "tool.pytest.ini_options"],
  ["setup.cfg", "tool:pytest"],
  ["tox.ini", "pytest"],
];
export async function detectCoverage(cwd) {
  for (const [file, section] of PYTEST_FILES) {
    const raw = await readFile(join(cwd, file), "utf8").catch(() => null);
    const header = raw?.match(
      new RegExp(`^\\[${section.replace(/[.:]/g, "\\$&")}\\][^\\n]*$`, "m"),
    );
    if (!raw || !header) continue;
    const rest = raw.slice(header.index + header[0].length);
    const end = rest.search(/^\[/m);
    const options = end < 0 ? rest : rest.slice(0, end);
    const m = /--cov-report[= ]["']?xml(?::([^\s"',\]]+))?/.exec(options);
    if (!m || (m[1] && isAbsolute(m[1]))) return null;
    const venv = join(cwd, ".venv", "bin", "pytest");
    const local = await stat(venv).then(
      () => true,
      () => false,
    );
    return {
      report: m[1] ?? "coverage.xml",
      format: "cobertura",
      command: [local ? venv : "pytest"],
    };
  }
  return null;
}
// The repository's saved configuration; without a coverage entry, the detected one.
export async function projectConfig(home, cwd) {
  const config = await jsonRead(join(home, "projects", `${sha(cwd)}.json`), {});
  if (config.coverage) return config;
  const coverage = await detectCoverage(cwd);
  return coverage ? { ...config, coverage } : config;
}
async function readReport(cwd, config) {
  const path = await contained(cwd, config.report);
  const s = await stat(path);
  if (s.size > 32 * 1024 * 1024) throw Error("Coverage report too large");
  const content = await readFile(path, "utf8");
  return {
    report: parseCoverage(content, config.format, cwd),
    digest: sha(content),
    mtime: s.mtimeMs,
  };
}
// A report Workboard did not produce: when it was written and how many changes came after it.
async function external(cwd, files, mtime) {
  const newer = await Promise.all(
    files
      .filter((f) => f.kind !== "deleted")
      .slice(0, 100)
      .map((f) =>
        stat(join(cwd, f.path)).then(
          (x) => x.mtimeMs > mtime,
          () => false,
        ),
      ),
  );
  return { reportAt: mtime, changedAfter: newer.filter(Boolean).length };
}
export async function readEvidence(cwd, config, home, snapshot) {
  if (!config)
    return {
      state: "missing",
      detail: "Configura un informe de cobertura",
      baseline: null,
      coverage: null,
      run: null,
    };
  config = validationConfig(config);
  const s = snapshot ?? (await gitSnapshot(cwd, undefined, excluded(config)));
  const run = await jsonRead(recordPath(home, cwd));
  let parsed;
  try {
    parsed = await readReport(cwd, config);
  } catch (e) {
    return {
      state: run?.state === "running" ? "running" : e.code === "ENOENT" ? "missing" : "error",
      detail: e.message,
      baseline: null,
      coverage: null,
      run,
    };
  }
  const coverage = coverageFor(
    parsed.report,
    Object.fromEntries(
      s.files.filter((f) => !f.binary && f.kind !== "deleted").map((f) => [f.path, f.lines]),
    ),
  );
  const provenance =
    run?.report === config.report &&
    run?.reportDigest === parsed.digest &&
    run?.regenerated === true;
  const current =
    provenance &&
    run.state === "completed" &&
    run.exitCode === 0 &&
    run.startFingerprint === s.fingerprint &&
    run.endFingerprint === s.fingerprint;
  let baseline = null;
  if (config.baseline && s.base === config.baseline.revision) {
    try {
      const before = await readReport(cwd, config.baseline);
      baseline = coverageFor(
        before.report,
        Object.fromEntries(s.files.map((f) => [f.old ?? f.path, []])),
      ).files.map((f) => ({ path: f.path, percent: f.filePercent }));
    } catch {
      baseline = null;
    }
  }
  return {
    state:
      run?.state === "running"
        ? "running"
        : run?.state === "failed" || (run?.state === "completed" && run.exitCode !== 0)
          ? "failed"
          : current
            ? coverage.missing.length
              ? "partial"
              : "current"
            : provenance
              ? "stale"
              : "unverified",
    detail: current ? null : "El informe no acredita el código actual",
    coverage,
    baseline,
    run,
    ...(provenance ? {} : await external(cwd, s.files, parsed.mtime)),
  };
}
export async function runValidation(cwd, raw, home, token) {
  const config = validationConfig(raw);
  if (!config.command) throw Error("No coverage command configured");
  const path = recordPath(home, cwd);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  let lock, claim;
  try {
    if (token) {
      // A terminal script can itself be opened twice; consume its lease exclusively.
      claim = await open(`${path}.claim`, "wx", 0o600);
      lock = await open(`${path}.lock`, "r+");
      const lease = JSON.parse(await lock.readFile("utf8"));
      if (lease.token !== token || lease.state !== "launching") {
        await lock.close();
        lock = null;
        throw Error("Invalid validation launch token");
      }
      await lock.truncate(0);
    } else lock = await open(`${path}.lock`, "wx", 0o600);
  } catch (e) {
    if (lock) await lock.close();
    if (claim) {
      await claim.close();
      await unlink(`${path}.claim`);
    }
    if (e.code === "EEXIST")
      throw Error(
        "Validation already running; inspect the recorded process before clearing its lock",
      );
    throw e;
  }
  const startedAt = Date.now();
  let record = {
    state: "running",
    startedAt,
    pid: process.pid,
    command: config.command,
    report: config.report,
    startFingerprint: null,
    endFingerprint: null,
    exitCode: null,
    reportDigest: null,
    regenerated: false,
    endedAt: null,
  };
  try {
    await lock.write(
      JSON.stringify({ pid: process.pid, cwd, startedAt, state: "running" }),
      0,
      "utf8",
    );
    record.startFingerprint = await fingerprint(cwd, excluded(config));
    const before = await readReport(cwd, config).catch(() => null);
    await atomic(path, record);
    console.error(`Coverage: ${config.command.join(" ")}\nDirectory: ${cwd}`);
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(config.command[0], config.command.slice(1), {
        cwd,
        stdio: "inherit",
        shell: false,
      });
      child.on("error", reject);
      child.on("exit", (code, signal) => resolve(code ?? (signal ? 128 : 1)));
    });
    record = {
      ...record,
      exitCode,
      endFingerprint: await fingerprint(cwd, excluded(config)),
      state: "completed",
      endedAt: Date.now(),
    };
    const report = await readReport(cwd, config).catch(() => null);
    if (report) {
      record.reportDigest = report.digest;
      record.regenerated = report.mtime >= startedAt && (!before || before.mtime !== report.mtime);
    }
    await atomic(path, record);
    return record;
  } catch (e) {
    await atomic(path, { ...record, state: "failed", error: e.message, endedAt: Date.now() });
    throw e;
  } finally {
    await lock.close();
    await unlink(`${path}.lock`);
    if (claim) {
      await claim.close();
      await unlink(`${path}.claim`);
    }
  }
}
