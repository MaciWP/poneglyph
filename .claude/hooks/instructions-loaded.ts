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
 * No rotation, the log is plain lines; truncate manually or at retro.
 */

import { appendFileSync, mkdirSync, statSync } from "node:fs";
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

export function appendLog(line: string, logPath: string): void {
  mkdirSync(dirname(logPath), { recursive: true });
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
