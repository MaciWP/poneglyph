#!/usr/bin/env bun

/**
 * Instructions Loaded Hook (InstructionsLoaded / SessionStart)
 *
 * Logs every instruction file load (CLAUDE.md / .claude/rules/*.md) to
 * `.claude/learned/instructions-loaded.log`, one line per event:
 *   <ISO ts> <session_id> <memory_type> <load_reason> <file_path>
 *
 * Closes the "verify load layer" lesson: grep the log to PROVE which
 * instruction layers actually loaded in a session instead of assuming.
 * InstructionsLoaded is async (fire-and-forget): stdout/exit code are ignored.
 * SessionStart(compact) adds a language reminder before Claude continues.
 * https://code.claude.com/docs/en/hooks#sessionstart-decision-control
 * Over LOG_CAP_BYTES (1 MB) appendLog drops the older half; see appendLog.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { readHookStdin } from "./lib/hook-stdin";
import { learnedLog } from "./lib/paths";
import { noteRun } from "./lib/run-log";

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

/** The file's name inside `.claude/` (`rules/x.md`), else its base name: never the project path. */
export function instructionName(path: string): string {
  const p = path.replaceAll("\\", "/");
  const i = p.lastIndexOf("/.claude/");
  return i >= 0 ? p.slice(i + "/.claude/".length) : basename(p);
}

// Every learned log goes through here. Over the cap the older half goes, so a 7- or 30-day reader keeps its
// window: the largest, instructions-loaded.log, reached 364 KB in 65 days. A line written by a parallel hook
// during the trim can be lost; these logs are best-effort.
const LOG_CAP_BYTES = 1_000_000;

export function appendLog(line: string, logPath: string, cap = LOG_CAP_BYTES): void {
  mkdirSync(dirname(logPath), { recursive: true });
  if (existsSync(logPath) && statSync(logPath).size > cap) {
    const text = readFileSync(logPath, "utf8");
    const cut = text.indexOf("\n", text.length >> 1);
    writeFileSync(logPath, cut < 0 ? "" : text.slice(cut + 1), "utf8");
  }
  appendFileSync(logPath, line + "\n", "utf8");
}

if (import.meta.main) {
  try {
    const raw = await readHookStdin();
    if (raw.trim()) {
      const payload = JSON.parse(raw) as InstructionsLoadedPayload;
      if (payload.hook_event_name === "SessionStart") {
        if (payload.source === "compact") {
          console.log(JSON.stringify({
            hookSpecificOutput: {
              hookEventName: "SessionStart",
              additionalContext: "Follow the language rule in .claude/output-styles/poneglyph.md: every user-visible text must be in es-ES de España.",
            },
          }));
        }
        process.exit(0);
      }
      const line = formatLogLine(payload);
      if (line) {
        // The run log keeps the name and size only, so the usage view can sum what loads.
        try {
          noteRun({ file: instructionName(payload.file_path!), type: payload.memory_type ?? "?", bytes: statSync(payload.file_path!).size });
        } catch {
          // a file gone before the stat: no size
        }
        appendLog(line, learnedLog(payload.cwd, "instructions-loaded.log"));
      }
    }
  } catch {
    // best-effort, never block
  }
  process.exit(0);
}
