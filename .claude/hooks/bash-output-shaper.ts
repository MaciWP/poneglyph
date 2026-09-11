#!/usr/bin/env bun

// PreToolUse (Bash) — keeps whole-file dumps and unbounded listings out of the context (plan 037, WP3).
//
// Measured 2026-09-09 over 14 days of this machine's transcripts: tool results were 56 % of the
// conversation context, and after echo-composites the heaviest Bash families were `cat` (365k
// chars — the same 28 KB plan read four times in one session) and `sed -n` (273k). Official
// pattern (code.claude.com/docs/en/costs, "Offload processing to hooks and skills"): a PreToolUse
// hook rewrites or refuses a command before its output ever reaches the model.
//
//   deny     `cat` / `sed -n` on a file above BIG_FILE_BYTES with no pipe → Read (offset/limit) or Grep
//   rewrite  `git log` without a bound → `--oneline -n 30` · `ls -R` / `find` / `tree` with no pipe → `| head -n 200`
//   never    tests, `git diff`, anything piped, redirections/heredocs (writes), or a command ending in `# raw`
//
// Best-effort like every PreToolUse hook (#6305): silent (exit 0, no output) unless a rule fires.
import { existsSync, statSync } from "node:fs";
import { posix, win32 } from "node:path";
import { readHookStdin } from "./lib/hook-stdin";

export const BIG_FILE_BYTES = 12 * 1024;
export type Shape = { action: "allow" } | { action: "deny"; reason: string } | { action: "rewrite"; command: string };
export type FileSize = (absolutePath: string) => number | null;

// Splits on command separators and keeps them (odd indexes) so the line can be rebuilt verbatim.
const SEPARATOR_RE = /(\s*(?:&&|\|\||;|\r?\n)\s*)/;
const GIT_LOG_BOUND_RE = /^(-n|-\d+|--oneline|--max-count(=.*)?|--since(=.*)?|--after(=.*)?|-p|--patch|--stat|--format(=.*)?|--pretty(=.*)?)$/;

function unquote(token: string): string {
  return token.replace(/^(["'])(.*)\1$/, "$2");
}

function tokens(segment: string): string[] {
  return segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
}

export function realFileSize(absolutePath: string): number | null {
  try {
    if (!existsSync(absolutePath)) return null;
    const st = statSync(absolutePath);
    return st.isFile() ? st.size : null;
  } catch {
    return null;
  }
}

// bun resolves paths with whichever separator the host shell uses, so a Windows cwd (backslashes,
// drive letter) joined to a forward-slash relative path must be tried both ways — the hook runs on
// every OS and the Bash tool's cwd is native.
function isAbs(p: string): boolean {
  return win32.isAbsolute(p) || posix.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p);
}
function joinPath(dir: string, seg: string): string {
  if (isAbs(seg)) return seg;
  return /\\/.test(dir) || /^[A-Za-z]:/.test(dir) ? win32.join(dir, seg) : posix.join(dir, seg);
}
function sizeOf(file: string, dir: string, fileSize: FileSize): number | null {
  if (isAbs(file)) return fileSize(file);
  return fileSize(win32.join(dir, file)) ?? fileSize(posix.join(dir.replace(/\\/g, "/"), file));
}

function denial(cmd: string, file: string, size: number): string {
  return `\`${cmd}\` would dump ${file} (${Math.round(size / 1024)} KB) whole into the context; tool output is already 56 % of it and the same 28 KB file was catted four times in one session (plan 037, H6). Use Read with offset/limit, or Grep the section you need. Append \`# raw\` to bypass.`;
}

// Pure. One Bash command line (plus the session cwd) in, a verdict out.
// A heredoc body is DATA the shell feeds to a command, not a list of commands. The line
// splitter below runs before any per-segment check, so a body line reading `cat plan.md`
// used to be shaped as if the user had typed it (H22, quality review 2026-09-11). The whole
// command line is left alone whenever a heredoc opens it: a heredoc is a write.
export function hasHeredoc(command: string): boolean {
  return /<<-?\s*['"]?\w+/.test(command);
}

export function shapeCommand(command: string, cwd: string, fileSize: FileSize = realFileSize): Shape {
  if (/#\s*raw\s*$/.test(command.trim())) return { action: "allow" };
  if (hasHeredoc(command)) return { action: "allow" };
  const parts = command.split(SEPARATOR_RE);
  let dir = cwd;
  let rewritten = false;
  for (let i = 0; i < parts.length; i += 2) {
    const segment = parts[i].trim();
    if (!segment) continue;
    const toks = tokens(segment);
    const cmd = toks[0];
    if (cmd === "cd" && toks[1]) {
      dir = joinPath(dir, unquote(toks[1]));
      continue;
    }
    // Heredoc or a STDOUT redirect (`> f`, `>> f`, `1> f`) is a write, not a dump — skip it.
    // `2>/dev/null` / `2>&1` only move stderr: the file still lands in the context, so keep checking.
    if (/<<|(^|[^0-9&])>|(^|\s)1>/.test(segment)) continue;
    const piped = segment.includes("|");
    if (piped) continue; // a consumer (head, grep, wc…) already bounds the output

    if (cmd === "cat" || (cmd === "sed" && toks.includes("-n"))) {
      // sed's file operand comes last; cat may name several files.
      const files = cmd === "sed" ? [unquote(toks[toks.length - 1])] : toks.slice(1).filter((t) => !t.startsWith("-")).map(unquote);
      for (const f of files) {
        const size = sizeOf(f, dir, fileSize);
        if (size !== null && size > BIG_FILE_BYTES) return { action: "deny", reason: denial(cmd, f, size) };
      }
    }

    if (cmd === "git" && toks[1] === "log" && !toks.some((t) => GIT_LOG_BOUND_RE.test(t))) {
      const dash = segment.indexOf(" -- ");
      const bounded = dash >= 0 ? `${segment.slice(0, dash)} --oneline -n 30${segment.slice(dash)}` : `${segment} --oneline -n 30`;
      parts[i] = parts[i].replace(segment, bounded);
      rewritten = true;
    }

    if ((cmd === "ls" && toks.some((t) => /^-[a-zA-Z]*R/.test(t))) || cmd === "find" || cmd === "tree") {
      parts[i] = parts[i].replace(segment, `${segment} | head -n 200`);
      rewritten = true;
    }
  }
  return rewritten ? { action: "rewrite", command: parts.join("") } : { action: "allow" };
}

export function buildOutput(shape: Shape, toolInput: Record<string, unknown>): string | null {
  if (shape.action === "allow") return null;
  if (shape.action === "deny") {
    return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: shape.reason } });
  }
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { ...toolInput, command: shape.command } } });
}

if (import.meta.main) {
  try {
    const raw = await readHookStdin();
    const payload = JSON.parse(raw) as { tool_name?: string; tool_input?: { command?: unknown }; cwd?: string };
    if (payload.tool_name === "Bash" && typeof payload.tool_input?.command === "string") {
      const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
      const out = buildOutput(shapeCommand(payload.tool_input.command, cwd), payload.tool_input as Record<string, unknown>);
      if (out) process.stdout.write(out + "\n");
    }
  } catch {
    // best-effort — a broken payload never blocks a command
  }
  process.exit(0);
}
