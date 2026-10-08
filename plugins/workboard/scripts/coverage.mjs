import { existsSync } from "node:fs";
import { extname, isAbsolute, join, relative } from "node:path";

export function changedLines(diff) {
  const added = [];
  let line = 0;
  let hunk = false;
  for (const row of diff.split("\n")) {
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
    if (match) {
      line = Number(match[1]);
      hunk = true;
      continue;
    }
    if (!hunk) continue;
    if (row.startsWith("+")) added.push(line++);
    else if (row.startsWith(" ")) line++;
  }
  return [...new Set(added)];
}
const xmlText = (s) =>
  s.replace(
    /&(?:amp|lt|gt|quot|apos);/g,
    (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[m],
  );
const attr = (s, name) => {
  const m = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`).exec(s);
  return m ? xmlText(m[2]) : null;
};
export function parseCoverage(raw, format, cwd = "") {
  if (typeof raw !== "string" || raw.length > 32 * 1024 * 1024)
    throw Error("Coverage report too large");
  const out = Object.create(null);
  const key = (name) => {
    const p = (cwd && isAbsolute(name) ? relative(cwd, name) : name)
      .replaceAll("\\", "/")
      .replace(/^\.\//, "");
    if (!p || p.startsWith("../") || isAbsolute(p) || p.includes("\0"))
      throw Error("Coverage path outside repository");
    return p;
  };
  const put = (path, line, hits) => {
    if (!Number.isSafeInteger(line) || line < 1 || !Number.isFinite(hits) || hits < 0)
      throw Error("Invalid coverage line");
    out[path] ??= Object.create(null);
    out[path][line] = Math.max(out[path][line] ?? 0, hits);
  };
  if (format === "lcov") {
    let file = null;
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith("SF:")) {
        file = key(line.slice(3));
        out[file] ??= Object.create(null);
      } else if (line.startsWith("DA:")) {
        if (!file) throw Error("Coverage line before file");
        const [n, count] = line.slice(3).split(",");
        if (!n || !count) throw Error("Missing coverage line attributes");
        put(file, Number(n), Number(count));
      } else if (line === "end_of_record") file = null;
    }
  } else if (format === "cobertura") {
    if (/<!DOCTYPE|<!ENTITY/i.test(raw) || !/<coverage\b/.test(raw) || !/<\/coverage>/.test(raw))
      throw Error("Invalid Cobertura XML");
    // coverage.py writes each filename relative to one of its <source> directories.
    const sources = cwd
      ? [...raw.matchAll(/<source>([^<]*)<\/source>/g)]
          .map((m) => xmlText(m[1]).trim())
          .map((dir) => (isAbsolute(dir) ? dir : join(cwd, dir)))
          .filter((dir) => !relative(cwd, dir).startsWith(".."))
      : [];
    const resolve = (name) => {
      if (isAbsolute(name) || !sources.length) return name;
      const found =
        sources.length === 1
          ? sources[0]
          : (sources.find((dir) => existsSync(join(dir, name))) ?? sources[0]);
      return join(found, name);
    };
    for (const match of raw.matchAll(/<class\b([^>]*)>([\s\S]*?)<\/class>/g)) {
      const name = attr(match[1], "filename");
      if (!name) throw Error("Missing coverage filename");
      const file = key(resolve(name));
      out[file] ??= Object.create(null);
      for (const l of match[2].matchAll(/<line\b([^>]*?)(?:\/>|>)/g)) {
        const number = attr(l[1], "number"),
          hits = attr(l[1], "hits");
        if (!number || hits === null || !hits.trim())
          throw Error("Missing coverage line attributes");
        put(file, Number(number), Number(hits));
      }
    }
  } else throw Error("Unsupported coverage format");
  if (!Object.keys(out).length) throw Error("No coverage files in report");
  return out;
}
export function coverageFor(report, changed) {
  const files = [];
  const missing = [];
  let covered = 0;
  let total = 0;
  // A changed file of a kind the report never measures (a .json beside .py files) is not code
  // this report could cover, so it does not count as missing.
  const kinds = new Set(Object.keys(report).map((p) => extname(p).toLowerCase()));
  for (const [path, lines] of Object.entries(changed)) {
    const file = report[path];
    if (!file) {
      if (lines.length && kinds.has(extname(path).toLowerCase())) missing.push(path);
      continue;
    }
    const executable = lines.filter((n) => Object.hasOwn(file, n));
    const hit = executable.filter((n) => file[n] > 0).length;
    const all = Object.values(file);
    covered += hit;
    total += executable.length;
    files.push({
      path,
      covered: hit,
      total: executable.length,
      percent: executable.length ? (hit / executable.length) * 100 : null,
      filePercent: all.length ? (all.filter((n) => n > 0).length / all.length) * 100 : null,
    });
  }
  const knownPercent = total ? (covered / total) * 100 : null;
  return {
    files,
    missing,
    covered,
    total,
    knownPercent,
    percent: missing.length ? null : knownPercent,
  };
}
