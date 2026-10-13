import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

/** Where Claude Code keeps its configuration. `CLAUDE_CONFIG_DIR` moves it; empty counts as unset. */
export function claudeConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
}

// The payload cwd follows the agent's `cd`; CLAUDE_PROJECT_DIR stays at the project root, so a
// log keyed on cwd alone scatters `.claude/learned/` copies into subdirectories.
export function projectRoot(cwd: unknown): string {
  return process.env.CLAUDE_PROJECT_DIR || (typeof cwd === "string" && cwd ? cwd : process.cwd());
}

// One `git check-ignore` per project root and process. A non-git directory, or no git at all,
// counts as not ignored.
const ignoredRoots = new Map<string, boolean>();

function learnedIsIgnored(root: string): boolean {
  let ignored = ignoredRoots.get(root);
  if (ignored === undefined) {
    ignored = spawnSync("git", ["-C", root, "check-ignore", "-q", ".claude/learned/x.log"], { stdio: "ignore" }).status === 0;
    ignoredRoots.set(root, ignored);
  }
  return ignored;
}

// Hook logs hold session ids and prompt fragments: inside the project only when the project
// git-ignores them, so a `git add .` cannot publish them. Otherwise they live under the
// config dir, one folder per project.
export function learnedLog(cwd: unknown, name: string): string {
  const root = projectRoot(cwd);
  if (learnedIsIgnored(root)) return join(root, ".claude", "learned", name);
  return join(claudeConfigDir(), "learned", root.replace(/[^\w.-]+/g, "-"), name);
}
