#!/usr/bin/env bun

/**
 * Router Subagent Hooks (Claude Code only)
 *
 * The main model can launch the `prompt-router` subagent when a work phase starts and no
 * router note covers it. sync-claude writes it to <config>/agents/ with the glossary and the
 * user-level catalog in its system prompt, which stays cached. These hooks give each launch
 * what the UserPromptSubmit router (prompt-router.ts) gets:
 *   PreToolUse (matcher Agent): rewrites the task as the project's catalog skills the agent
 *     file lacks (none in most projects; skills added since the last sync also land here),
 *     the task in <prompt>, then the <past> memory. Not SubagentStart: an additionalContext
 *     over ~10 KB reaches the agent as a 2 KB preview of a saved file (probe, 2026-10-09).
 *   SubagentStop (matcher prompt-router): a subagent has no --json-schema, so the answer is
 *     parsed here; an unreadable one is sent back once, then the run is logged with via=agent.
 *     Skills the session already loaded are dropped here, as in the script.
 *   PreToolUse also appends the Haiku context budget (lib/haiku-budget.ts) to any Agent task that
 *     runs on Haiku, the router's included, and adds a note when a spawn inherits the Lead's model
 *     because nothing named one. A `critic` launch is denied when its brief lacks `MODE`, `GOAL` or
 *     `ARTEFACT`; a valid one gets the user's prompts appended from the transcript and loses any
 *     `model`/`effort` the call passes, since a call argument beats the agent file.
 * Fail-open: any error → no output and one log line.
 */

import { existsSync, readFileSync } from "node:fs";
import { CRITIC_AGENT, is, parseEvents } from "../lib/critic-events";
import { spawnModel, withBudget } from "../lib/haiku-budget";
import { readHookStdin } from "../lib/hook-stdin";
import { projectRoot } from "../lib/paths";
import { questionAnswers } from "../lib/transcript";
import { CATALOG_HEADER, type CatalogEntry, enabledPluginRoots, glossaryFiles, installedRouterAgent, loadCatalog, loadGlossary, log, parseRouterOutput } from "../prompt-router";
import { formatPast, loadMemory, MAX_PROMPT_CHARS, type MemoryEntry, pastFor, sessionSkills } from "./memory";

export const ROUTER_AGENT = "prompt-router";
const PROMPT_TAG = /<prompt>\s*([\s\S]*?)\s*<\/prompt>/;
export const RETRY_REASON = 'Reply again with only the JSON object {"fixes": [...], "process": {...}, "skills": [...]} and nothing else.';

interface HookPayload {
  hook_event_name?: string; session_id?: string; cwd?: string; transcript_path?: string;
  agent_type?: string; agent_transcript_path?: string; last_assistant_message?: string; stop_hook_active?: boolean;
  tool_name?: string; tool_input?: Record<string, unknown>;
}

// The skill names baked into the installed agent file, read back from its catalog block.
export function bakedSkills(agentFile: string): Set<string> {
  const text = existsSync(agentFile) ? readFileSync(agentFile, "utf8") : "";
  const block = text.split(CATALOG_HEADER)[1] ?? "";
  return new Set([...block.matchAll(/^- (\S+): /gm)].map((m) => m[1]));
}

// The Agent tool input as the catalog skills the agent file lacks, then the task in <prompt>
// and the similar past prompts, in the shape the script sends on stdin. Any other agent gets
// null (no output).
export function routerTaskInput(input: Record<string, unknown> | undefined, catalog: CatalogEntry[], baked: Set<string>, memory?: MemoryEntry[]): Record<string, unknown> | null {
  if (!input || input.subagent_type !== ROUTER_AGENT || typeof input.prompt !== "string") return null;
  const raw = input.prompt.trim();
  const text = raw.match(PROMPT_TAG)?.[1] ?? raw;
  const extra = catalog.filter((c) => !baked.has(c.name)).map((c) => `- ${c.name}: ${c.description}`).join("\n");
  const past = formatPast(pastFor(text, new Set(catalog.map((c) => c.name)), memory));
  // ponytail: project plugin glossaries are not added here; add them if a project plugin ships one.
  return { ...input, prompt: `${extra ? `More catalog skills for this project (name: description):\n${extra}\n\n` : ""}<prompt>\n${text.slice(0, MAX_PROMPT_CHARS)}\n</prompt>${past ? `\n${past}` : ""}` };
}

// CLAUDE.md asks for a model on every spawn. A call that names none, for an agent with no model of
// its own, runs on the Lead's model (Explore and Plan ignore CLAUDE_CODE_SUBAGENT_MODEL). 27 of 352
// spawns in 14 days named none. Warn only; the note reaches the Lead with the result, for its next call.
// A fork inherits by design.
export function modelNudge(input: Record<string, unknown>, cwd: string, envModel?: string): string | null {
  if (input.subagent_type === "fork" || input.subagent_type === CRITIC_AGENT || typeof input.model === "string" || spawnModel(input, cwd, envModel)) return null;
  const type = typeof input.subagent_type === "string" ? input.subagent_type : "general-purpose";
  return `That ${type} Agent call named no model, so it ran on your own model. Name the model on every spawn (CLAUDE.md §Agents and skills): the cheapest tier unless the work is code or security. Pass \`model\` on your next Agent call.`;
}

// The brief blocks the critic reads (dev-workflow references/03-critic-loop.md, agents/critic.md).
export const CRITIC_BRIEF = ["MODE", "GOAL", "DOD", "USER-DECISIONS", "AUTHOR-PROPOSALS", "PATH", "ARTEFACT", "CHECKS"];

// What a critic brief lacks of its three required blocks. A label may carry a qualifier in
// parentheses (`ARTEFACT (working tree):`, 7 of 120 real briefs); content may start on the next line,
// but not at the next block's label.
export function briefGaps(prompt: string): string[] {
  const label = (names: string) => `(?:${names})(?:[ \\t]*\\([^)\\n]*\\))?:`;
  const filled = (block: string) => new RegExp(`^${label(block)}\\s*(?!${label(CRITIC_BRIEF.join("|"))})\\S`, "m").test(prompt);
  return [
    !/^MODE:[ \t]*(?:plan|feature|doubt)(?![\w-])/m.test(prompt) && "`MODE:` as `plan`, `feature` or `doubt`",
    !filled("GOAL") && "`GOAL:` with content",
    !filled("ARTEFACT") && "`ARTEFACT:` with content",
  ].filter((gap): gap is string => !!gap);
}

// What the user typed, prompts and AskUserQuestion answers in order, for the critic to hold the
// author's `GOAL` and `USER-DECISIONS` against: the author writes every other block. "" when the
// transcript has none or cannot be read. A slash command shows as `/name args`.
// ponytail: the first entry and the last four, 1,500 characters each; widen when the critic reports a goal it could not find.
export function userPromptsBlock(transcript: string | undefined): string {
  if (!transcript) return "";
  try {
    const records = readFileSync(transcript, "utf8").split("\n");
    const prompts = parseEvents(records).filter(is("prompt")).map((e) => {
      const text = e.text ?? "";
      const command = text.match(/<command-name>(\/[\w:-]+)<\/command-name>/)?.[1];
      return { idx: e.idx, text: (command ? `${command} ${text.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1] ?? ""}` : text).trim() };
    });
    const answered = questionAnswers();
    const answers = records.flatMap((line, i) => {
      if (!line.includes("AskUserQuestion") && !line.includes('"answers"')) return [];
      try {
        return answered(JSON.parse(line)).map(([question, answer, note]) => ({ idx: i + 1, text: `answer to «${question}»: ${answer}${note && ` (note: ${note})`}` }));
      } catch {
        return [];
      }
    });
    const all = [...prompts, ...answers].filter((p) => p.text).sort((a, b) => a.idx - b.idx);
    if (!all.length) return "";
    const lines = all.map(({ text }, i) => `[${i + 1} of ${all.length}] ${text.length > 1500 ? `${text.slice(0, 1500)} [cut]` : text}`).filter((_, i) => i === 0 || i >= all.length - 4);
    return `\n\nUSER-PROMPTS (appended by the harness from the session transcript, not by the author):\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

// A critic launch needs the three required brief blocks: a brief without them is free-form, the
// kind that tells the critic what to check, and is denied before the transcript is read. A valid
// one gets the user's prompts appended and runs on its agent file's model and effort
// (claude-opus-5-5, medium) whatever the call passes; the critic gates also check the model it
// really ran on.
export function criticSpawn(input: Record<string, unknown>, transcript?: string): { input: Record<string, unknown> | null; note: string | null; deny?: string } {
  if (input.subagent_type !== CRITIC_AGENT) return { input: null, note: null };
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  const gaps = briefGaps(prompt);
  if (gaps.length) return { input: null, note: null, deny: `Critic brief refused: it needs ${gaps.join(", ")}, each label at the start of a line. Send the brief from dev-workflow references/03-critic-loop.md.` };
  const { model, effort, ...rest } = input;
  const stripped = model !== undefined || effort !== undefined;
  const asked = userPromptsBlock(transcript);
  return {
    input: stripped || asked ? { ...rest, prompt: prompt + asked } : null,
    note: stripped ? "The critic call's `model`/`effort` were dropped: it runs on claude-opus-5-5 at medium from its agent file." : null,
  };
}

// The subagent's first user message (the task, <past> included) and when it started.
export function agentTask(transcript: string | undefined): { text: string; at: number | null } {
  if (!transcript) return { text: "", at: null };
  try {
    for (const line of readFileSync(transcript, "utf8").split("\n")) {
      if (!line) continue;
      const entry = JSON.parse(line) as { type?: string; timestamp?: string; message?: { content?: unknown } };
      if (entry.type !== "user") continue;
      const content = entry.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => (c as { text?: string }).text ?? "").join("\n") : "";
      const at = Date.parse(entry.timestamp ?? "");
      return { text, at: Number.isNaN(at) ? null : at };
    }
  } catch { /* unreadable */ }
  return { text: "", at: null };
}

if (import.meta.main) {
  const started = Date.now();
  let cwd = projectRoot(undefined);
  try {
    const payload = JSON.parse(await readHookStdin()) as HookPayload;
    cwd = projectRoot(payload.cwd);
    const plugins = enabledPluginRoots(cwd);
    const catalog = () => loadCatalog(cwd, undefined, plugins);
    const glossary = () => loadGlossary(glossaryFiles(cwd, undefined, plugins));
    const event = payload.hook_event_name;
    if (event === "PreToolUse" && payload.tool_name === "Agent" && payload.tool_input) {
      // PONEGLYPH_ROUTER_MEMORY: another memory file, so an eval can hide prompts newer than its case.
      const memoryOverride = process.env.PONEGLYPH_ROUTER_MEMORY;
      const routed = payload.tool_input.subagent_type === ROUTER_AGENT
        ? routerTaskInput(payload.tool_input, catalog(), bakedSkills(installedRouterAgent()), memoryOverride ? loadMemory(memoryOverride) : undefined)
        : null;
      const critic = criticSpawn(payload.tool_input, payload.transcript_path);
      // One hook owns the Agent input: two PreToolUse hooks returning updatedInput would overwrite each other.
      const changed = routed ?? critic.input;
      const updatedInput = withBudget(changed ?? payload.tool_input, cwd) ?? changed;
      const nudge = [modelNudge(payload.tool_input, cwd), critic.note].filter(Boolean).join("\n") || null;
      const decision = critic.deny ? { permissionDecision: "deny", permissionDecisionReason: critic.deny } : updatedInput && { permissionDecision: "allow", updatedInput };
      if (decision || nudge) process.stdout.write(JSON.stringify({ hookSpecificOutput: {
        hookEventName: "PreToolUse", ...decision, ...(nudge && { additionalContext: nudge }),
      } }));
    } else if (event === "SubagentStop" && payload.agent_type === ROUTER_AGENT) {
      const run = agentTask(payload.agent_transcript_path);
      const task = run.text.match(PROMPT_TAG)?.[1] ?? run.text;
      const result = parseRouterOutput(JSON.stringify({ result: payload.last_assistant_message ?? "" }), task, catalog(),
        { glossary: glossary(), loaded: await sessionSkills(payload.transcript_path) });
      if (!result && !payload.stop_hook_active) {
        process.stdout.write(JSON.stringify({ decision: "block", reason: RETRY_REASON }));
      } else {
        log(cwd, {
          host: "claude", via: "agent", session: (payload.session_id ?? "").replace(/[^\w-]/g, "").slice(0, 8),
          outcome: result ? (result.skills.length || result.fixes.length ? "ok" : "empty") : "bad-output", ms: Date.now() - (run.at ?? started),
          skills: result?.skills.map((s) => s.name).join(",") || "-", fixes: result?.fixes.length ?? 0, effort: result?.effort ? "high" : "-", past: (run.text.split("<past>")[1]?.match(/^- "/gm) ?? []).length,
        });
      }
    }
  } catch {
    log(cwd, { host: "claude", via: "agent", outcome: "error", ms: Date.now() - started });
  }
  process.exit(0);
}
