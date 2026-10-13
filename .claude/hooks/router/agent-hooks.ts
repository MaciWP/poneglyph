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
 *     runs on Haiku, the router's included.
 * Fail-open: any error → no output and one log line.
 */

import { existsSync, readFileSync } from "node:fs";
import { withBudget } from "../lib/haiku-budget";
import { readHookStdin } from "../lib/hook-stdin";
import { projectRoot } from "../lib/paths";
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
      // One hook owns the Agent input: two PreToolUse hooks returning updatedInput would overwrite each other.
      const updatedInput = withBudget(routed ?? payload.tool_input, cwd) ?? routed;
      if (updatedInput) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput } }));
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
