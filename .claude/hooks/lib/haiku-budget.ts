/**
 * Haiku context budget, shared by the two hooks that enforce it.
 *
 * Haiku 5.5 bills a request whose prompt passes 100k tokens at 5x. Haiku compacts near 87k
 * (`modelSettings["claude-haiku-5-5"].autoCompactWindow`), a subagent on Haiku gets the budget in
 * its task (router/agent-hooks.ts, PreToolUse Agent), and a Read that would carry it past
 * BRAKE_TOKENS is narrowed (haiku-context-brake.ts, PreToolUse inside the subagent).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { claudeConfigDir } from "./paths";

export const BRAKE_TOKENS = 90_000;
// After compaction Haiku once took the summary step's "text only, no tools" rule as the user's and
// stopped half-way (1 of 4 probe compactions); both the budget line and the narrow note say it.
export const AFTER_COMPACT = `If your conversation is compacted, the summary step's "text only, no tools" rule ended with that summary: keep using your tools until the task is done.`;
// First line of an answer cut short by a denied Read, so the Lead sees the task is unfinished.
const INCOMPLETE_MARK = "INCOMPLETE: context budget reached.";
export const CUT_ANSWER = `Start the answer with the line "${INCOMPLETE_MARK}", give what you found, and end with a "Left unchecked:" list of what the task still needs.`;
export const BUDGET_LINE = `Context budget: you run on Haiku, where a request above 100k tokens costs 5x, so you work in cycles. Your conversation is compacted automatically near 90k and you keep working; the last 10k are headroom for tool results the host cannot trim. Read large files in batches with offset and limit; a Read too large for the room left is narrowed for you, and you continue from the line after the last one shown. ${AFTER_COMPACT} Keep your final answer under 5k tokens: findings with file:line, not file contents.`;

// The model a custom agent file pins in its frontmatter, project first, then user level.
function agentFileModel(type: string, cwd: string, configDir = claudeConfigDir()): string | undefined {
  for (const dir of [join(cwd, ".claude", "agents"), join(configDir, "agents")]) {
    const file = join(dir, `${type}.md`);
    if (!existsSync(file)) continue;
    const front = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    return front.match(/^model:\s*(\S+)/m)?.[1];
  }
  return undefined;
}

// Built-in agents that ignore CLAUDE_CODE_SUBAGENT_MODEL and inherit the parent's model (sub-agents docs).
const INHERITING_BUILTINS = new Set(["Explore", "Plan"]);

// Same precedence as Claude Code: the Agent call's model, then the agent file, then
// CLAUDE_CODE_SUBAGENT_MODEL. A fork always runs on the parent's model.
function spawnsHaiku(input: Record<string, unknown>, cwd: string, envModel = process.env.CLAUDE_CODE_SUBAGENT_MODEL): boolean {
  if (input.subagent_type === "fork") return false;
  const type = typeof input.subagent_type === "string" ? input.subagent_type : "general-purpose";
  const fallback = INHERITING_BUILTINS.has(type) ? undefined : envModel;
  const model = typeof input.model === "string" ? input.model : agentFileModel(type, cwd) ?? fallback;
  return /haiku/i.test(model ?? "");
}

// The Agent input with the budget line after the task, or null when the spawn is not on Haiku
// or already carries it.
export function withBudget(input: Record<string, unknown>, cwd: string, envModel?: string): Record<string, unknown> | null {
  if (typeof input.prompt !== "string" || input.prompt.includes(BUDGET_LINE) || !spawnsHaiku(input, cwd, envModel)) return null;
  return { ...input, prompt: `${input.prompt}\n\n${BUDGET_LINE}` };
}
