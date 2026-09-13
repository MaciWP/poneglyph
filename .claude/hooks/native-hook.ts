#!/usr/bin/env bun
// Event adapters only. Command policy, skill routing, and secret detection stay shared.
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { judgeCommand } from "./headless-model-gate";
import { FLOW_HINT_LINE, ROUTING_LINES, analyzePayload, loadSkills } from "./skill-activation";
import { buildStopResponse, getModifiedFiles, scanFile, shouldSkipStopHook } from "./security-gate";
import { readHookStdin } from "./lib/hook-stdin";

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

// H43 — the shared hint text is written for Claude: `/flow` is a Claude command prefix and
// `/autocompact` and `/effort` are Claude built-ins. Codex also offers `/model` in its
// interactive CLI, including reasoning selection. Its skill prefix is `$name` and
// compaction uses launch-time `-c` flags. Mapping by
// whole line, so a reworded hint stops matching instead of being half-translated; the suite
// asserts no Claude-only command survives, which is what catches that case.
const CODEX_HINT_LINES: ReadonlyMap<string, string> = new Map([
  [FLOW_HINT_LINE, "Feature-shaped task → consider $flow — the full lifecycle (scope→tech-plan→tdd-design→build→critic→retro). Wide scope → on Codex the 400k ceiling is a launch-time flag, not an in-session command: start with `codex -c model_auto_compact_token_limit=400000` (default ceiling 200k, plan 037)."],
  [ROUTING_LINES.bulk, "Bulk/mechanical shape → consider a cheaper model and effort via `/model` in the Codex interactive CLI; in Orca use its model controls. Launch alternative: `codex -c model_reasoning_effort=low` (shape-only suggestion, session state unknown — playbook §4)."],
  [ROUTING_LINES.quick, "Quick-lookup shape → consider lower reasoning effort via `/model` in the Codex interactive CLI; in Orca use its model controls. Launch alternative: `codex -c model_reasoning_effort=low` (shape-only suggestion, session state unknown — playbook §4)."],
]);

/** Rewrites the shared hint into what the target host actually offers. Skill lines pass
 *  through untouched: skills load on Codex too. */
export function translateHintForCodex(injection: string): string {
  return injection.split("\n").map(line => CODEX_HINT_LINES.get(line) ?? line).join("\n");
}

function object(value: unknown): Payload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an event object.");
  return value as Payload;
}

export async function checkModifiedFiles(cwd: string): Promise<string[]> {
  const files = await getModifiedFiles(cwd);
  return (await Promise.all(files.map(file => scanFile(resolve(cwd, file))))).flat();
}

export async function handleNativeHook(
  host: NativeHost, event: string, input: unknown,
  coreRoot = resolve(import.meta.dir, "../.."),
): Promise<HookOutput | null> {
  const payload = object(input);
  if (event === "PreToolUse") {
    const tool = host === "grok" ? payload.toolName : payload.tool_name;
    if (!["Bash", "exec_command", "shell", "shell_command", "run_shell_command"].includes(String(tool))) return null;
    const args = object(host === "grok" ? payload.toolInput : payload.tool_input);
    const command = args.command ?? args.cmd;
    if (typeof command !== "string") throw new Error("Expected a shell command string.");
    const verdict = judgeCommand(command);
    if (verdict.allow) return null;
    return host === "grok" ? { decision: "deny", reason: verdict.reason } : {
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: verdict.reason },
    };
  }
  // Grok discards passive stdout. Routing and review use the shared runtime rule.
  if (host === "grok") return null;
  if (event === "UserPromptSubmit") {
    if (typeof payload.prompt === "string" && /^\s*\$[a-z][\w-]*(?:\s|$)/i.test(payload.prompt)) return null;
    // Project first, then the shared core (H21): loadSkills keeps the FIRST directory that
    // defines a name, so this order is what lets a project override win. The Claude hook
    // already reads [cwd, ~/.claude]; both loaders now agree on precedence.
    const directories = typeof payload.cwd === "string"
      ? [join(payload.cwd, ".claude", "skills"), join(payload.cwd, ".agents", "skills"), join(coreRoot, ".claude", "skills")]
      : [join(coreRoot, ".claude", "skills")];
    const hint = analyzePayload(JSON.stringify(payload), () => loadSkills(directories, "codex"));
    return hint.injection ? {
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: translateHintForCodex(hint.injection) },
    } : null;
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
