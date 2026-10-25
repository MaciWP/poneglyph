#!/usr/bin/env bun

/**
 * Skill Activation Hook (UserPromptSubmit)
 *
 * Skill discovery belongs to the prompt router (prompt-router.ts, async): a cheap
 * model reads the prompt against the whole catalog. Keyword skill hints do not belong here:
 * on the held-out eval they hit 0.07 against the router's ~0.8, with false positives.
 * This hook gives only what the router does not:
 *   - a `/flow-lifecycle` line on feature-shaped prompts (a command, not a skill)
 *   - a shape-only model/effort hint (bulk or quick prompts)
 *   - the `<prompt-router-pending>` line, so the main model starts without waiting
 *   - a `/clear` proposal line once the session's context passes CLEAR_HINT_TOKENS
 *
 * Non-human payloads (task notifications, system reminders) and slash commands are
 * skipped, EXCEPT `/goal <task>`: its argument is real work.
 *
 * `skillOverrides` stays exported: the router reads Claude's skill visibility through it.
 *
 * Known caveat: UserPromptSubmit has a reliability gap early-session /
 * post-compaction (issue #17277), best-effort layer, never a sole gate.
 * Exits 0 always; silent (no stdout) when nothing applies.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lastRequest, tail } from "./haiku-context-brake";
import { appendLog } from "./instructions-loaded";
import { claudeConfigDir, learnedLog, projectRoot } from "./lib/paths";
import { readHookStdin } from "./lib/hook-stdin";
import { foldText } from "./lib/language";

interface PromptPayload {
  prompt?: string;
  cwd?: string;
  transcript_path?: string;
  session_id?: string;
  [key: string]: unknown;
}

/** Read settings in increasing precedence. Invalid files provide no routing hints. */
export function skillOverrides(cwd: string, config = claudeConfigDir()): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const file of [join(config, "settings.json"), join(cwd, ".claude", "settings.json"), join(cwd, ".claude", "settings.local.json")]) {
    try {
      const value = JSON.parse(readFileSync(file, "utf8")).skillOverrides;
      if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(result, value);
    } catch { /* Missing or invalid settings cannot authorize an extra hint. */ }
  }
  return result;
}

// Payloads that reach UserPromptSubmit but are NOT typed by the human:
// background-task notifications, system reminders, local-command caveats.
// Matching their content produced hints about the system's own plumbing
// (a task-notification triggered prompt-design/orchestrator).
const NON_PROMPT_PREFIXES = [
  "[SYSTEM NOTIFICATION",
  "<task-notification>",
  "<system-reminder>",
  "Caveat:",
] as const;

export function isNonHumanPayload(prompt: string): boolean {
  const p = prompt.trimStart();
  return NON_PROMPT_PREFIXES.some((prefix) => p.startsWith(prefix));
}

export { foldText }; // moved to lib/language.ts; the held-out eval still imports it from here

// Feature-shape detection: multi-word conservative patterns, a
// feature-shaped ad-hoc prompt gets a /flow-lifecycle line, because the hook only
// discovers SKILLS from disk and /flow-lifecycle is a command it would never propose.
const FEATURE_SHAPE_RES = [
  /\b(?:una?|la)\s+nueva\s+(?:feature|funcionalidad)\b/i,
  /\bnueva\s+(?:feature|funcionalidad)\b/i,
  /\bfeature\s+(?:nueva|completa)\b/i,
  /\bdesarrollar?\s+(?:una?|la)\s+(?:nueva\s+)?(?:feature|funcionalidad)\b/i,
  /\bde\s+principio\s+a\s+fin\b/i,
  /\btodo\s+el\s+ciclo\b/i,
];

export function detectFeatureShape(prompt: string): boolean {
  return FEATURE_SHAPE_RES.some((re) => re.test(prompt));
}

// The second sentence is the tiered context ceiling: 300k by default, 400k when a
// task spans many files. The hook cannot run slash commands; the Lead proposes, Oriol decides.
export const FLOW_HINT_LINE =
  "Feature-shaped task → consider /flow-lifecycle, the full lifecycle (Skill flow: scope→plan→test-plan→build→review→retro). Wide scope → propose `/autocompact 400k` for this session (default ceiling 300k).";

// Model/effort routing by task shape (closes the deployment gap:
// the advisor only fired at /flow-lifecycle boundaries, while 60+ manual /model+/effort
// toggles happened in ad-hoc turns). The hook cannot see session model state →
// suggestions are explicitly SHAPE-ONLY; the user executes /model / /effort.
const BULK_SHAPE_RE =
  /\b(?:barre|barrido|en masa|masivo|todos los ficheros|repo entero|inventaria|renombra todo|sweep mec[aá]nico)\b/i;
const QUICK_SHAPE_RE = /\b(?:pregunta|duda|consulta)\s+r[aá]pida\b|\bsolo dime\b/i;

function detectRoutingShape(prompt: string): "bulk" | "quick" | null {
  if (BULK_SHAPE_RE.test(prompt)) return "bulk";
  if (QUICK_SHAPE_RE.test(prompt)) return "quick";
  return null;
}

// Exported so a host adapter can swap a Claude-only command for its own.
export const ROUTING_LINES: Record<"bulk" | "quick", string> = {
  bulk: "Bulk/mechanical shape → consider a cheaper tier via `/model` + `/effort low` (shape-only suggestion, session state unknown, playbook §4).",
  quick: "Quick-lookup shape → consider `/effort low` (shape-only suggestion, session state unknown, playbook §4).",
};

// A long session that starts unrelated work drags its whole context along. The hook knows the
// size, the main model knows whether the prompt is related; only the user can run /clear.
export const CLEAR_HINT_TOKENS = 100_000;

function clearHintLine(context: number): string {
  return `Context at ~${Math.round(context / 1000)}k tokens. If this prompt starts work unrelated to this session, say so in one line and propose /clear (or /compact <focus>) before starting; otherwise carry on.`;
}

// Claude only: reads the Claude JSONL transcript, so host adapters never call it.
export function clearHint(raw: string): { line: string; context: number } | null {
  try {
    const payload = JSON.parse(raw) as PromptPayload;
    const prompt = typeof payload.prompt === "string" ? payload.prompt.trimStart() : "";
    if (!prompt || isNonHumanPayload(prompt) || prompt.startsWith("/") || typeof payload.transcript_path !== "string") return null;
    const last = lastRequest(tail(payload.transcript_path));
    return last && last.context >= CLEAR_HINT_TOKENS ? { line: clearHintLine(last.context), context: last.context } : null;
  } catch {
    return null;
  }
}

export interface HintAnalysis {
  injection: string;
  flowHint: boolean;
  routingHint: boolean;
}

// Full pure pipeline: raw stdin → injection + emitted-hint metadata.
// `/goal <task>` is processed (its arg is real work); other slash commands are
// skipped (they self-route). SILENT unless a shape matched.
export function analyzePayload(raw: string): HintAnalysis {
  const none: HintAnalysis = { injection: "", flowHint: false, routingHint: false };
  if (!raw.trim()) return none;
  let payload: PromptPayload;
  try {
    payload = JSON.parse(raw) as PromptPayload;
  } catch {
    return none;
  }
  const rawPrompt = typeof payload.prompt === "string" ? payload.prompt : "";
  if (!rawPrompt.trim()) return none;
  if (isNonHumanPayload(rawPrompt)) return none;
  const goalMatch = rawPrompt.trimStart().match(/^\/goal\s+(.+)/is);
  const prompt = goalMatch ? goalMatch[1] : rawPrompt;
  if (!goalMatch && prompt.trimStart().startsWith("/")) return none;
  const flowHint = detectFeatureShape(prompt);
  const routingShape = detectRoutingShape(prompt);
  const lines = [
    ...(flowHint ? [FLOW_HINT_LINE] : []),
    ...(routingShape ? [ROUTING_LINES[routingShape]] : []),
  ];
  return {
    injection: lines.length ? ["<skill-activation-hint>", ...lines, "</skill-activation-hint>"].join("\n") : "",
    flowHint,
    routingHint: routingShape !== null,
  };
}

if (import.meta.main) {
  try {
    const raw = await readHookStdin();
    const analysis = analyzePayload(raw);
    // Claude only: prompt-router.ts runs as an async hook and its note arrives
    // mid-turn; this line tells the main model to start without waiting for it.
    const router = await import("./prompt-router");
    const payload0 = JSON.parse(raw) as PromptPayload & { session_id?: unknown };
    const routed = router.routablePrompt(raw) !== null &&
      !router.modRoutes(projectRoot(payload0.cwd), claudeConfigDir(), typeof payload0.session_id === "string" ? payload0.session_id : "");
    const pending = routed ? router.ROUTER_PENDING_LINE : "";
    const clear = clearHint(raw);
    if (clear) {
      const payload = JSON.parse(raw) as PromptPayload;
      try {
        appendLog(`${new Date().toISOString()} ${String(payload.session_id ?? "").slice(0, 8)} ${clear.context}`, learnedLog(payload.cwd, "clear-hint.log"));
      } catch { /* best-effort */ }
    }
    const out = [analysis.injection, pending, clear?.line ?? ""].filter(Boolean).join("\n");
    if (out) process.stdout.write(out + "\n");
  } catch {
    // best-effort, never block the prompt
  }
  process.exit(0);
}
