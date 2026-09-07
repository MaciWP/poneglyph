#!/usr/bin/env bun

/**
 * Instructions Loaded Hook (InstructionsLoaded — observability)
 *
 * Logs every instruction file load (CLAUDE.md / .claude/rules/*.md) to
 * `.claude/learned/instructions-loaded.log` — one line per event:
 *   <ISO ts> <session_id> <memory_type> <load_reason> <file_path>
 *
 * Closes the "verify load layer" lesson: grep the log to PROVE which
 * instruction layers actually loaded in a session instead of assuming.
 * Registered async (fire-and-forget): stdout/exit code are ignored.
 * No rotation — the log is plain lines; truncate manually or at retro.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { readHookStdin } from "./lib/hook-stdin";

export interface InstructionsLoadedPayload {
  session_id?: string;
  cwd?: string;
  file_path?: string;
  memory_type?: string;
  load_reason?: string;
  [key: string]: unknown;
}

export function formatLogLine(
  payload: InstructionsLoadedPayload,
  now: Date = new Date(),
): string | null {
  if (typeof payload.file_path !== "string" || !payload.file_path) return null;
  const session = payload.session_id ?? "unknown";
  const type = payload.memory_type ?? "?";
  const reason = payload.load_reason ?? "?";
  return `${now.toISOString()} ${session} ${type} ${reason} ${payload.file_path}`;
}

export function appendLog(line: string, logPath: string): void {
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, line + "\n", "utf8");
}

if (import.meta.main) {
  try {
    const raw = await readHookStdin();
    if (raw.trim()) {
      const payload = JSON.parse(raw) as InstructionsLoadedPayload;
      const line = formatLogLine(payload);
      if (line) {
        const base = typeof payload.cwd === "string" ? payload.cwd : process.cwd();
        appendLog(line, join(base, ".claude", "learned", "instructions-loaded.log"));
      }
    }
  } catch {
    // best-effort — never block
  }
  process.exit(0);
}
