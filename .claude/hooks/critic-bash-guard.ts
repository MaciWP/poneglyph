#!/usr/bin/env bun

// PreToolUse (Bash) for the `critic` subagent only: wired from the agent's own frontmatter
// `hooks`, never from settings. The critic reviews; it never changes anything. Its shell is
// read-only git and nothing else: tests run in the Lead's session, where the user sees them.
//
// A denylist cannot make a shell read-only (a test file runs arbitrary code, `git diff
// --output=f` writes a file, `-c core.pager=…` runs a program), so this is an allowlist and
// it fails closed: anything it cannot parse is denied.
import { readHookStdin } from "./lib/hook-stdin";

export type Judgement = { allow: true } | { allow: false; reason: string };

const SUBCOMMANDS = new Set(["diff", "log", "show", "blame", "status", "merge-base", "rev-parse", "ls-files", "grep"]);

// Shell syntax that chains, redirects, substitutes or escapes: none is needed to read git.
const SHELL_SYNTAX = /[><|;&$`()\n\\]/;

// Subcommand options that write a file or run a program. Global options (`-c`, `--git-dir`,
// `-p`…) never reach this check: the global loop admits only the three below, and after the
// subcommand `-p`/`-c`/`-o` mean patch, combined diff and `ls-files --others`.
const UNSAFE_OPTION = /^(--output(=|$)|--ext-diff$|--textconv$|--upload-pack|--receiver?-pack|--open-files-in-pager|-O)/;

// `git status` refreshes the index and takes `.git/index.lock` unless told not to, which can
// collide with the Lead's own `git add` or `git commit` (git-status §BACKGROUND REFRESH).
const NO_LOCKS = "--no-optional-locks";

const ALLOWED = `read-only git only: git [-C <dir>] [--no-pager] [${NO_LOCKS}] ${[...SUBCOMMANDS].join("|")} <args> (status needs ${NO_LOCKS}), with no redirects, pipes, chaining or substitutions. Read files with Read; search with git grep. To see a test run, add the exact command to QUESTIONS for the Lead.`;

// Splits on whitespace outside single or double quotes; returns null on an unclosed quote.
export function splitWords(cmd: string): string[] | null {
  const words: string[] = [];
  let cur = "";
  let quote: string | null = null;
  let started = false;
  for (const ch of cmd) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) words.push(cur);
      cur = "";
      started = false;
    } else {
      cur += ch;
      started = true;
    }
  }
  if (quote) return null;
  if (started) words.push(cur);
  return words;
}

// Pure. One shell command in, a verdict out.
export function judgeCriticCommand(cmd: string): Judgement {
  const deny = (why: string): Judgement => ({ allow: false, reason: `critic shell: ${why}. Allowed: ${ALLOWED}` });
  // Bash expands nothing inside single quotes, so `--grep='feat(gate)'` is plain text.
  if (SHELL_SYNTAX.test(cmd.replace(/'[^'\n]*'/g, "''"))) return deny("shell syntax (redirect, pipe, chaining, substitution or escape) is not allowed");
  const words = splitWords(cmd.trim());
  if (!words || words.length === 0) return deny("the command could not be parsed");
  if (words[0] !== "git") return deny(`\`${words[0]}\` is not git`);
  let i = 1;
  let noLocks = false;
  while (i < words.length && words[i].startsWith("-")) {
    if (words[i] === "-C" && words[i + 1] !== undefined) i += 2;
    else if (words[i] === "--no-pager") i += 1;
    else if (words[i] === NO_LOCKS) {
      noLocks = true;
      i += 1;
    } else return deny(`global option \`${words[i]}\` is not allowed`);
  }
  const sub = words[i];
  if (!sub || !SUBCOMMANDS.has(sub)) return deny(`\`git ${sub ?? ""}\` is not a read-only subcommand on the list`);
  if (sub === "status" && !noLocks) return deny(`\`git status\` writes the index lock; run \`git ${NO_LOCKS} status\``);
  const unsafe = words.slice(i + 1).find((w) => UNSAFE_OPTION.test(w));
  if (unsafe) return deny(`option \`${unsafe}\` can write a file or run a program`);
  return { allow: true };
}

export function buildDenial(reason: string): string {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
  });
}

if (import.meta.main) {
  let verdict: Judgement;
  try {
    const payload = JSON.parse(await readHookStdin()) as { tool_name?: string; tool_input?: { command?: unknown } };
    if (payload.tool_name !== "Bash") process.exit(0);
    const cmd = payload.tool_input?.command;
    verdict = typeof cmd === "string" ? judgeCriticCommand(cmd) : { allow: false, reason: "critic shell: no command string" };
  } catch {
    verdict = { allow: false, reason: "critic shell: the hook payload could not be read, so the command is denied" };
  }
  if (!verdict.allow) process.stdout.write(buildDenial(verdict.reason) + "\n");
  process.exit(0);
}
