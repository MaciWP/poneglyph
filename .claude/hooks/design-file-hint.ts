#!/usr/bin/env bun

// PreToolUse (Edit|Write|MultiEdit|Bash) — design-file note on the first UI-file contact of a session (plan 041).
//
// Text-only skill changes never produced the extraction offer (039 r1-r4, 041 US1 A/B 0-0):
// skill loading depends on keywords and the reference is not read. This hook adds one
// factual `additionalContext` note on the session's first UI-file contact: the design file in use,
// or that none exists and how the offer is made. It never blocks. PreToolUse is
// best-effort (#6305), so the note reinforces `ui-design` step 0; it does not replace it.
//
// The log line `<ISO ts> <session_id> <found|none> <first found or ->` in
// `<cwd>/.claude/learned/design-file-hints.log` is both the observability record and the
// once-per-session marker. `noteOnce` is host-neutral; `native-hook.ts` reuses it for Codex.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readHookStdin } from "./lib/hook-stdin";
import { appendLog } from "./instructions-loaded";

const UI_EXT_RE = /\.(html|css|scss|tsx|jsx|vue|svelte)$/i;
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);
// Same order as ui-design/references/design-file.md §Lookup order.
export const LOOKUP = ["docs/DESIGN_SYSTEM.md", "DESIGN_SYSTEM.md", "DESIGN.md"];

export function isUiFile(path: string): boolean {
  return UI_EXT_RE.test(path);
}

// Shell commands carry paths as tokens (`sed -i '' … index.html`, `open("src/a.css")` in a
// heredoc). The 041 review saw 2 of 5 live runs edit UI files through Bash, so any Bash call
// that names a UI file counts as contact, even a read. A bare extension (`.css` in prose
// written by a heredoc) has no file name and a URL is not a project file, so neither counts.
// A glob stays: `sed -i … src/*.css` edits real files. Quoted paths with spaces split into
// pieces; the last piece still carries the extension, so the hit survives.
const SHELL_SPLIT_RE = /[\s"'`()<>|;&=,:]+/;
const NAMED_RE = /[^/.]\.\w+$/;

export function commandPaths(command: string): string[] {
  return command.split(SHELL_SPLIT_RE).filter((token) => isUiFile(token) && NAMED_RE.test(token) && !token.includes("//"));
}

export function findDesignFiles(root: string): string[] {
  return LOOKUP.filter((name) => existsSync(join(root, name)));
}

// Factual sentences only: Claude Code docs warn that imperative hook text can trip
// prompt-injection defenses.
export function buildNote(found: string[]): string {
  if (found.length === 0) {
    return `Design file: none found. Checked ${LOOKUP[0]}, ${LOOKUP[1]} and ${LOOKUP[2]} in this repo. The ui-design skill (references/design-file.md) covers extracting docs/DESIGN_SYSTEM.md from the existing code; nothing is written until the user says yes. The extraction offer belongs in the final report on its own **Decide:** line, also when the report carries other decisions.`;
  }
  const [first, ...rest] = found;
  const others = rest.length ? ` Also present: ${rest.join(", ")}.` : "";
  return `Design file: ${first} is the one in use (lookup order ${LOOKUP.join(", ")}).${others} The ui-design skill reads it before UI edits and names it in the report; when code and file disagree, the code wins and the drift is reported.`;
}

export function alreadyNoted(logText: string, session: string): boolean {
  return logText.split("\n").some((line) => line.split(" ")[1] === session);
}

// Host-neutral core: null unless some path is a UI file; otherwise the note, once per
// session per cwd. Logging is best-effort, so an unwritable log may repeat the note.
// The marker is written before the tool runs: if a sibling PreToolUse hook denies the call
// (`bash-output-shaper` on a large `cat`), the note is still spent, and two parallel calls
// can both emit it. Both cost at most one extra or one early note per session.
// ponytail: the root is the caller's (Claude: CLAUDE_PROJECT_DIR; Codex: payload cwd), so a monorepo
// subdirectory with its own design file is missed; walk up from the edited file if that bites.
export function noteOnce({ cwd, session, paths }: { cwd: string; session: string; paths: string[] }): string | null {
  if (!paths.some(isUiFile)) return null;
  const logPath = join(cwd, ".claude", "learned", "design-file-hints.log");
  let logText = "";
  try {
    logText = readFileSync(logPath, "utf8");
  } catch {
    // missing or unreadable log: treat as not yet noted
  }
  if (alreadyNoted(logText, session)) return null;
  const found = findDesignFiles(cwd);
  try {
    appendLog(`${new Date().toISOString()} ${session} ${found.length ? "found" : "none"} ${found[0] ?? "-"}`, logPath);
  } catch {
    // best-effort — the note still goes out
  }
  return buildNote(found);
}

export function noteOutput(note: string): { hookSpecificOutput: { hookEventName: "PreToolUse"; additionalContext: string } } {
  return { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: note } };
}

export interface ClaudeEditPayload {
  session_id?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: { file_path?: unknown; command?: unknown };
}

// Thin Claude Code wrapper: tool_input.file_path for Edit/Write/MultiEdit, the paths in
// tool_input.command for Bash. The payload cwd follows the agent's `cd`; CLAUDE_PROJECT_DIR
// stays at the session's project root, so it decides the lookup and the marker.
export function designFileHint(payload: ClaudeEditPayload): ReturnType<typeof noteOutput> | null {
  const { file_path: file, command } = payload.tool_input ?? {};
  const paths = EDIT_TOOLS.has(payload.tool_name ?? "") && typeof file === "string" ? [file]
    : payload.tool_name === "Bash" && typeof command === "string" ? commandPaths(command)
    : [];
  if (paths.length === 0) return null;
  const note = noteOnce({
    cwd: process.env.CLAUDE_PROJECT_DIR || (typeof payload.cwd === "string" ? payload.cwd : process.cwd()),
    session: payload.session_id ?? "unknown",
    paths,
  });
  return note ? noteOutput(note) : null;
}

if (import.meta.main) {
  try {
    const raw = await readHookStdin();
    const out = designFileHint(JSON.parse(raw) as ClaudeEditPayload);
    if (out) process.stdout.write(JSON.stringify(out) + "\n");
  } catch {
    // best-effort — a broken payload never blocks an edit
  }
  process.exit(0);
}
