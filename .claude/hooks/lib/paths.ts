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

export function learnedLog(cwd: unknown, name: string): string {
  return join(projectRoot(cwd), ".claude", "learned", name);
}
