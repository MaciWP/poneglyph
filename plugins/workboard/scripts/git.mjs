import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { readFile, lstat, readlink, realpath } from "node:fs/promises";
import { join, relative, isAbsolute } from "node:path";
import { changedLines } from "./coverage.mjs";
const exec = promisify(execFile);
export async function run(argv, cwd, options = {}) {
  try {
    const r = await exec(argv[0], argv.slice(1), {
      cwd,
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    });
    return { out: r.stdout, err: r.stderr, code: 0 };
  } catch (e) {
    if (typeof e.code === "number" && !e.killed)
      return { out: String(e.stdout ?? ""), err: String(e.stderr ?? ""), code: e.code };
    throw e;
  }
}
export async function git(cwd, args, allowed = [0]) {
  const r = await run(["git", ...args], cwd);
  if (!allowed.includes(r.code)) throw Error(r.err.trim() || `git exited ${r.code}`);
  return r.out;
}
export async function root(cwd) {
  return realpath((await git(cwd, ["rev-parse", "--show-toplevel"])).trim());
}
export const sha = (s) => createHash("sha256").update(s).digest("hex");
export function safeRelative(path) {
  if (
    typeof path !== "string" ||
    !path ||
    path.includes("\0") ||
    isAbsolute(path) ||
    path.split(/[\\/]/).includes("..")
  )
    throw Error("Path must stay within repository");
  return path;
}
export async function contained(cwd, path) {
  safeRelative(path);
  const actual = await realpath(join(cwd, path));
  const rel = relative(await realpath(cwd), actual);
  if (rel.startsWith("../") || isAbsolute(rel)) throw Error("Symlink escapes repository");
  return actual;
}
const diffFlags = ["--no-ext-diff", "--no-textconv", "--no-color"];
export async function fingerprint(cwd, exclude = []) {
  const ignored = (p) => exclude.some((x) => p === x || p.startsWith(x.replace(/\/$/, "") + "/"));
  const head = (await git(cwd, ["rev-parse", "--verify", "HEAD"], [0, 128])).trim();
  const paths = [".", ...exclude.map((x) => `:(exclude,literal)${x}`)];
  const chunks = [
    head,
    await git(cwd, ["diff", ...diffFlags, "--binary", ...(head ? ["HEAD"] : []), "--", ...paths]),
    await git(cwd, ["diff", "--cached", ...diffFlags, "--binary", "--", ...paths]),
  ];
  const untracked = (await git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]))
    .split("\0")
    .filter((p) => p && !ignored(p))
    .sort();
  if (untracked.length > 2000) throw Error("Too many untracked files for verified fingerprint");
  for (const p of untracked) {
    safeRelative(p);
    const file = join(cwd, p);
    const info = await lstat(file);
    if (info.size > 16 * 1024 * 1024)
      throw Error("Untracked file too large for verified fingerprint");
    chunks.push(
      p,
      String(info.mode),
      info.isSymbolicLink() ? await readlink(file) : sha(await readFile(file)),
    );
  }
  return sha(chunks.join("\0"));
}
export async function gitSnapshot(directory, baseRef, exclude = []) {
  const cwd = await root(directory);
  const head = (await git(cwd, ["rev-parse", "--verify", "HEAD"], [0, 128])).trim() || null;
  const branch =
    (await git(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"], [0, 1])).trim() || null;
  let base = null;
  let baseError = null;
  let baseLabel = baseRef ?? null;
  if (head) {
    if (!baseLabel)
      baseLabel =
        (
          await git(
            cwd,
            ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
            [0, 1, 128],
          )
        ).trim() || null;
    if (!baseLabel)
      for (const guess of ["main", "master"])
        if ((await run(["git", "rev-parse", "--verify", `${guess}^{commit}`], cwd)).code === 0) {
          baseLabel = guess;
          break;
        }
    if (baseLabel) {
      if (baseLabel.startsWith("-") || /[\u0000-\u001f]/.test(baseLabel))
        throw Error("Invalid base revision");
      try {
        const resolved = (
          await git(cwd, ["rev-parse", "--verify", "--end-of-options", `${baseLabel}^{commit}`])
        ).trim();
        base = (await git(cwd, ["merge-base", "HEAD", resolved])).trim();
      } catch (e) {
        baseError = e.message;
      }
    }
  }
  const records = (
    await git(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"])
  ).split("\0");
  const changes = new Map();
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (!row) continue;
    const x = row[0],
      y = row[1];
    const path = row.slice(3);
    const old = /[RC]/.test(x + y) ? records[++i] : null;
    changes.set(path, {
      path,
      old,
      staged: x !== " " && x !== "?",
      unstaged: y !== " ",
      kind:
        x === "?"
          ? "untracked"
          : /U/.test(x + y) || x + y === "AA"
            ? "conflict"
            : /D/.test(x + y)
              ? "deleted"
              : old
                ? "renamed"
                : "changed",
    });
  }
  const dirty = changes.size > 0;
  if (base)
    for (const path of (await git(cwd, ["diff", ...diffFlags, "--name-only", "-z", base, "--"]))
      .split("\0")
      .filter(Boolean))
      if (!changes.has(path))
        changes.set(path, { path, old: null, staged: false, unstaged: false, kind: "committed" });
  if (changes.size > 2000) throw Error("Too many changed files");
  const files = [];
  for (const f of changes.values()) {
    if (exclude.some((p) => f.path === p || f.path.startsWith(p.replace(/\/$/, "") + "/")))
      continue;
    safeRelative(f.path);
    let lines = [];
    let binary = false;
    if (f.kind !== "deleted") {
      const info = await lstat(join(cwd, f.path)).catch(() => null);
      if (!info?.isFile()) {
        files.push({ ...f, lines, binary: true });
        continue;
      }
      if (f.kind === "untracked" || !head) {
        if (info.size > 2 * 1024 * 1024) binary = true;
        else {
          const content = await readFile(join(cwd, f.path), "utf8");
          binary = content.includes("\0");
          if (!binary)
            lines = Array.from(
              { length: content.split("\n").length - (content.endsWith("\n") ? 1 : 0) },
              (_, i) => i + 1,
            );
        }
      } else {
        const diff = await git(cwd, [
          "--literal-pathspecs",
          "diff",
          ...diffFlags,
          "--unified=0",
          base ?? head,
          "--",
          f.path,
        ]);
        binary = /^Binary files /m.test(diff);
        lines = changedLines(diff);
      }
    }
    files.push({ ...f, lines, binary });
  }
  return {
    cwd,
    branch,
    head,
    base,
    baseLabel,
    baseError,
    dirty,
    files,
    fingerprint: await fingerprint(cwd, exclude),
  };
}
