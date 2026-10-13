#!/usr/bin/env bun
// Event adapters only. Command policy, skill routing, the design-file note and secret detection stay shared.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { judgeCommand } from "./headless-model-gate";
import { FLOW_HINT_LINE, ROUTING_LINES, analyzePayload } from "./skill-activation";
import { buildStopResponse, getModifiedFiles, scanFile, shouldSkipStopHook } from "./security-gate";
import { noteOnce, noteOutput } from "./design-file-hint";
import { readHookStdin } from "./lib/hook-stdin";
import { ROUTER_PENDING_LINE, routablePrompt, routerNoteFile, takeRouterNote } from "./prompt-router";

export type NativeHost = "codex" | "grok";
type Payload = Record<string, unknown>;
type HookOutput = {
  decision?: "deny";
  reason?: string;
  systemMessage?: string;
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision?: "deny";
    permissionDecisionReason?: string;
    additionalContext?: string;
  };
};

// The shared hint text is written for Claude: `/flow-lifecycle` is a Claude command prefix and
// `/autocompact` and `/effort` are Claude built-ins. Codex also offers `/model` in its
// interactive CLI, including reasoning selection. Its skill prefix is `$name` and
// compaction uses launch-time `-c` flags. Mapping by
// whole line, so a reworded hint stops matching instead of being half-translated; the suite
// asserts no Claude-only command survives, which is what catches that case.
const CODEX_HINT_LINES: ReadonlyMap<string, string> = new Map([
  [FLOW_HINT_LINE, "Feature-shaped task → consider $flow-lifecycle, the full lifecycle (Skill flow: scope→plan→test-plan→build→review→retro). Wide scope → on Codex the 400k ceiling is a launch-time flag, not an in-session command: start with `codex -c model_auto_compact_token_limit=400000` (default ceiling 300k)."],
  [ROUTING_LINES.bulk, "Bulk/mechanical shape → consider a cheaper model and effort via `/model` in the Codex interactive CLI. Launch alternative: `codex -c model_reasoning_effort=low` (shape-only suggestion, session state unknown, playbook §4)."],
  [ROUTING_LINES.quick, "Quick-lookup shape → consider lower reasoning effort via `/model` in the Codex interactive CLI. Launch alternative: `codex -c model_reasoning_effort=low` (shape-only suggestion, session state unknown, playbook §4)."],
]);

/** Rewrites the shared hint into what the target host actually offers. */
function translateHintForCodex(injection: string): string {
  return injection.split("\n").map(line => CODEX_HINT_LINES.get(line) ?? line).join("\n");
}

/** Paths a Codex patch adds or updates, in patch order. */
export function patchPaths(patch: string): string[] {
  return [...patch.matchAll(/^\*\*\* (?:Add|Update) File: (.+?)\r?$/gm)].map(m => m[1].trim());
}

// The note is best-effort: a malformed patch payload yields no note instead of a hook error.
function codexDesignFileNote(payload: Payload): HookOutput | null {
  const args = payload.tool_input;
  const command = args && typeof args === "object" ? (args as Payload).command : undefined;
  if (typeof command !== "string") return null;
  const note = noteOnce({
    cwd: typeof payload.cwd === "string" ? payload.cwd : process.cwd(),
    session: typeof payload.session_id === "string" ? payload.session_id : "unknown",
    paths: patchPaths(command),
  });
  return note ? noteOutput(note) : null;
}

const sessionOf = (payload: Payload) => {
  const id = payload.session_id ?? payload.sessionId;
  return typeof id === "string" && id ? id : null;
};

// The router runs detached so the prompt is not held for it; its note is taken by the
// first tool call that follows (`takeRouterNote`). A note left from the previous prompt
// is dropped first, so a prompt that is not routed never gets an older answer.
function startRouter(host: NativeHost, payload: Payload, routable: boolean): void {
  const session = sessionOf(payload);
  if (!session) return;
  try {
    rmSync(routerNoteFile(session), { force: true });
    if (!routable) return;
    const child = spawn(process.execPath, [join(import.meta.dir, "prompt-router.ts"), "--host", host], { detached: true, stdio: ["pipe", "ignore", "ignore"] });
    child.on("error", () => { /* best-effort: no note */ });
    child.stdin!.end(JSON.stringify(payload));
    child.unref();
  } catch { /* best-effort: no note */ }
}

// The router note and another note (the Codex design-file note) share one context field.
function withRouterNote(host: NativeHost, payload: Payload, output: HookOutput | null): HookOutput | null {
  const session = sessionOf(payload);
  const note = session ? takeRouterNote(session) : null;
  if (!note) return output;
  const other = output?.hookSpecificOutput?.additionalContext;
  return { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: other ? `${other}\n\n${note}` : note } };
}

function object(value: unknown): Payload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an event object.");
  return value as Payload;
}

async function checkModifiedFiles(cwd: string): Promise<string[]> {
  const files = await getModifiedFiles(cwd);
  return (await Promise.all(files.map(file => scanFile(resolve(cwd, file))))).flat();
}

export async function handleNativeHook(host: NativeHost, event: string, input: unknown): Promise<HookOutput | null> {
  const payload = object(input);
  if (event === "PreToolUse") {
    const tool = host === "grok" ? payload.toolName : payload.tool_name;
    // Codex edits files through apply_patch. A denied call never runs, so the router note
    // waits for the next one.
    if (host === "codex" && tool === "apply_patch") return withRouterNote(host, payload, codexDesignFileNote(payload));
    // Grok names its shell tool run_terminal_command (10-hooks.md, Tool Name Aliases).
    if (!["Bash", "exec_command", "shell", "shell_command", "run_shell_command", "run_terminal_command"].includes(String(tool))) return withRouterNote(host, payload, null);
    const args = object(host === "grok" ? payload.toolInput : payload.tool_input);
    const command = args.command ?? args.cmd;
    if (typeof command !== "string") throw new Error("Expected a shell command string.");
    const verdict = judgeCommand(command);
    if (verdict.allow) return withRouterNote(host, payload, null);
    return host === "grok" ? { decision: "deny", reason: verdict.reason } : {
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: verdict.reason },
    };
  }
  const routable = event === "UserPromptSubmit" && routablePrompt(JSON.stringify(payload), process.env, process.platform, host) !== null;
  if (event === "UserPromptSubmit") startRouter(host, payload, routable);
  // Grok takes no UserPromptSubmit or Stop context. Routing and review use the shared runtime rule.
  if (host === "grok") return null;
  if (event === "UserPromptSubmit") {
    if (typeof payload.prompt === "string" && /^\s*\$[a-z][\w-]*(?:\s|$)/i.test(payload.prompt)) return null;
    const hint = analyzePayload(JSON.stringify(payload));
    const context = [hint.injection ? translateHintForCodex(hint.injection) : "", routable ? ROUTER_PENDING_LINE : ""].filter(Boolean).join("\n");
    return context ? { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context } } : null;
  }
  if (event === "Stop") {
    if (shouldSkipStopHook(payload)) return null;
    if (typeof payload.cwd !== "string") throw new Error("Stop requires the project cwd.");
    const response = buildStopResponse(await checkModifiedFiles(payload.cwd));
    // Stop's systemMessage is a user warning. Do not block to force a model turn,
    // or interpret transcript_path using another vendor's undocumented format.
    return response ? { systemMessage: response.systemMessage } : null;
  }
  throw new Error("Unsupported native event.");
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({ options: {
      host: { type: "string" }, event: { type: "string" },
      check: { type: "boolean" }, cwd: { type: "string" },
    } });
    if (values.check) {
      const response = buildStopResponse(await checkModifiedFiles(resolve(values.cwd ?? process.cwd())));
      console.log(response?.systemMessage ?? "Modified-file secret check passed (heuristic scope; not a full-history scan).");
      process.exit(response ? 1 : 0);
    }
    if (values.host !== "codex" && values.host !== "grok") throw new Error("Select a supported host.");
    const output = await handleNativeHook(values.host, values.event ?? "", JSON.parse(await readHookStdin()));
    if (output) console.log(JSON.stringify(output));
  } catch {
    // Hosts fail open on hook errors; report the failure without echoing payloads.
    console.error("native-hook failed: invalid event or unavailable project scan; verification is incomplete.");
    process.exitCode = 1;
  }
}
