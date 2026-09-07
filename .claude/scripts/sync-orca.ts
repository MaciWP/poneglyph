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
// Exit codes: 0 = ran (🟢 clean or 🟡 live append still set) · 2 = environment.

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

interface ScanHit {
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

if (import.meta.main) {
  const verbose = process.argv.includes("--verbose");

  if (!existsSync(SP_FILE)) {
    console.log(`🔴 SP file missing: ${SP_FILE}`);
    process.exit(2);
  }

  const dirs = orcaConfigDirs(platform(), homedir(), process.env.APPDATA).filter(existsSync);
  if (dirs.length === 0) {
    console.log("🔴 No Orca config dir found on this machine — is Orca installed?");
    process.exit(2);
  }

  const scanned = dirs.flatMap((d) => scanDir(d, EXPECTED, FLAG));
  const hits = scanned.filter((h) => isLiveOrcaVerdictFile(h.file));
  const noise = scanned.filter((h) => !isLiveOrcaVerdictFile(h.file));

  // Decision 2026-08-18: expected state is NO append in live Argumentos.
  if (hits.length === 0) {
    console.log("🟢 Orca: correcto — sin append en orca-data.json. Las sesiones heredan el outputStyle vía settings.");
    if (verbose && noise.length > 0) {
      console.log("   (ignorados — bak/status, no votan)");
      for (const h of noise) console.log(`   ~ ${h.file}`);
    }
    process.exit(0);
  }

  console.log("🟡 Orca: hay un --append-system-prompt en la config viva — doble carga con el outputStyle.");
  console.log("   Medido 2026-08-18: inocua pero inútil (~10K extra/sesión). Quítalo de Argumentos.");
  for (const h of hits) console.log(`   ${h.exact ? "(SP poneglyph)" : "(otra ruta)"} ${h.file}`);
  if (verbose && noise.length > 0) {
    console.log("   (ignorados — bak/status, no votan)");
    for (const h of noise) console.log(`   ~ ${h.file}`);
  }
  process.exit(0);
}
