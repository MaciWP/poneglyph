#!/usr/bin/env bun
// sync-orca — verifies Orca does NOT append poneglyph-sp.md (plan: indexed-nebula).
// Decision 2026-08-18: spawned Claude already inherits outputStyle Poneglyph;
// append is a measured-useless double-load. This script cannot write the UI;
// it only reports live profile files (orca-data.json). Backups and hook
// telemetry do not vote.
//
//   bun .claude/scripts/sync-orca.ts             # verify
//   bun .claude/scripts/sync-orca.ts --verbose   # also list ignored noise hits
//
// Also one `doctor` row, through checkOrca() (H47) — this script is no longer something
// you have to remember to run.
//
// Exit codes: 0 = ran (🟢 clean · 🟡 live append still set, or Orca not installed on this
// machine) · 2 = the repository's own system-prompt twin is missing.

import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { basename, join } from "node:path";

const SP_FILE = join(import.meta.dir, "..", "system-prompts", "poneglyph-sp.md");
const FLAG = "--append-system-prompt-file";
const EXPECTED = `${FLAG} ${SP_FILE}`;

// App-storage areas that legitimately hold settings. Caches and terminal
// transcripts are excluded — a spawned `claude --append-system-prompt-file`
// command echoed in terminal-history would false-positive the check
// (lesson: `lessons` G1 — greps that separate the cases before counting).
const EXCLUDE_DIRS = new Set([
  "terminal-history",
  "Cache",
  "Code Cache",
  "GPUCache",
  "DawnGraphiteCache",
  "DawnWebGPUCache",
  "blob_storage",
  "logs",
  "Crashpad",
  "codex-runtime-home",
  "codex-session-backfill",
  "cookie-import-staging",
]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Backups and hook telemetry — they echo old Argumentos; they are not the UI. */
export function isOrcaScanNoise(name: string): boolean {
  if (name === "last-status.json") return true;
  return /\.bak(?:\.|$)/i.test(name);
}

/** Live profile payload. Other matches (logs, status) do not decide the semaphore. */
export function isLiveOrcaVerdictFile(filePath: string): boolean {
  return basename(filePath) === "orca-data.json";
}

export function orcaConfigDirs(plat: string = platform(), home: string = homedir(), appData?: string): string[] {
  const dirs: string[] = [];
  if (plat === "darwin") dirs.push(join(home, "Library", "Application Support", "orca"));
  else if (plat === "win32" && appData) dirs.push(join(appData, "orca"));
  else dirs.push(join(home, ".config", "orca"));
  dirs.push(join(home, ".orca"));
  return dirs;
}

export interface ScanHit {
  file: string;
  exact: boolean; // matched the full expected "flag + path", not just the bare flag
}

export function scanDir(root: string, expected: string, flag: string): ScanHit[] {
  const hits: ScanHit[] = [];
  const expectedBuf = Buffer.from(expected);
  const flagBuf = Buffer.from(flag);
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (EXCLUDE_DIRS.has(name) || isOrcaScanNoise(name)) continue;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile() && st.size > 0 && st.size <= MAX_FILE_BYTES) {
        let buf: Buffer;
        try {
          buf = readFileSync(full);
        } catch {
          continue;
        }
        if (buf.includes(expectedBuf)) hits.push({ file: full, exact: true });
        else if (buf.includes(flagBuf)) hits.push({ file: full, exact: false });
      }
    }
  };
  walk(root);
  return hits;
}

export interface OrcaCheck {
  status: "🟢" | "🟡" | "🔴";
  detail: string;
}

// Decision 2026-08-18: the expected state is NO append in the live Argumentos.
// A machine without Orca is SKIPPED, not red — `doctor` exits 1 on any 🔴 and this is a
// machine-bound check, the same rule the host-adapter rows already follow (H47).
export function orcaVerdict(spExists: boolean, dirs: string[], hits: ScanHit[]): OrcaCheck {
  if (!spExists) return { status: "🔴", detail: `system-prompt twin missing: ${SP_FILE}` };
  if (dirs.length === 0) return { status: "🟡", detail: "Orca not installed on this machine — skipped" };
  if (hits.length === 0) return { status: "🟢", detail: "no --append-system-prompt in the live profile; sessions inherit the outputStyle" };
  return {
    status: "🟡",
    detail: `${hits.length} live --append-system-prompt — double load with the outputStyle (~10K extra per session, measured 2026-08-18); remove it from Argumentos`,
  };
}

/** The verdict plus the scan behind it. One entry point for the CLI and the doctor row. */
export function checkOrca(): OrcaCheck & { hits: ScanHit[]; noise: ScanHit[] } {
  const spExists = existsSync(SP_FILE);
  const dirs = spExists ? orcaConfigDirs(platform(), homedir(), process.env.APPDATA).filter(existsSync) : [];
  const scanned = dirs.flatMap((d) => scanDir(d, EXPECTED, FLAG));
  const hits = scanned.filter((h) => isLiveOrcaVerdictFile(h.file));
  return { ...orcaVerdict(spExists, dirs, hits), hits, noise: scanned.filter((h) => !isLiveOrcaVerdictFile(h.file)) };
}

if (import.meta.main) {
  const verbose = process.argv.includes("--verbose");
  const result = checkOrca();
  console.log(`${result.status} Orca: ${result.detail}`);
  for (const h of result.hits) console.log(`   ${h.exact ? "(poneglyph SP)" : "(another path)"} ${h.file}`);
  if (verbose && result.noise.length > 0) {
    console.log("   (ignored — backups and status files; they do not vote)");
    for (const h of result.noise) console.log(`   ~ ${h.file}`);
  }
  process.exit(result.status === "🔴" ? 2 : 0);
}
