// Which tool calls only read, and how long a run of them is. One definition for the reads reminder
// (hooks/turn-nudges.ts), the compliance rule C-READS and the usage measurements.

// `cd X && git status` → "git status"; `VAR=1 cat f` → "cat"; `echo a; ls` → "echo" (the composite habit).
export function bashFamily(command: string): string {
  const stripped = command
    .replace(/^\s*cd\s+(?:"[^"]*"|'[^']*'|\S+)\s*&&\s*/, "")
    .replace(/^(?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S+)\s*(?:&&|;)?\s*)+/, "")
    .trim();
  const words = stripped.split(/\s+/);
  const head = words[0] ?? "?";
  const sub = words[1];
  return /^(git|gh|bun|npx|npm|python|docker|codex|grok)$/.test(head) && sub && !sub.startsWith("-") ? `${head} ${sub}` : head;
}

/** The run length at which the Lead is reminded to hand reads to `Explore`. */
export const READ_STREAK = 6;

const READ_TOOLS = new Set(["Read", "Grep", "Glob"]);
const READ_FAMILIES = new Set(["cat", "head", "tail", "rg", "grep", "ls", "find", "wc", "tree", "jq", "git diff", "git log", "git show", "git status", "git grep", "git blame"]);
/** Whether a tool call launches the read-only agent. */
export const launchesExplore = (name: string, input: Record<string, unknown> | undefined): boolean => (name === "Agent" || name === "Task") && input?.subagent_type === "Explore";

// A Code Mode script's inner calls are logged as their own tool calls (ids `repl_…`) before the
// `REPL` call that ran them, so the script and its `Poll` neither add to a run nor end it.
const CARRIERS = new Set(["REPL", "Poll"]);

/** How many reads a tool call makes; 0 for a call that does anything else. */
export function readsIn(name: string, input: Record<string, unknown> | undefined): number {
  if (READ_TOOLS.has(name)) return 1;
  if (name === "Bash") return typeof input?.command === "string" && READ_FAMILIES.has(bashFamily(input.command)) ? 1 : 0;
  return 0;
}

/** The run of consecutive reads after one more tool call: it grows on a read and restarts on anything else. */
export function nextReadStreak(streak: number, name: string, input: Record<string, unknown> | undefined): number {
  if (CARRIERS.has(name)) return streak;
  const n = readsIn(name, input);
  return n ? streak + n : 0;
}
