#!/usr/bin/env bun

// PreToolUse (Read), narrows a Read that would carry a Haiku subagent past 90k of context.
//
// Haiku 5.5 bills a request whose prompt passes 100k tokens at 5x, and 13 % of the Haiku
// subagent requests over 14 days went past it (max 248k). Haiku now compacts near 87k
// (`modelSettings["claude-haiku-5-5"].autoCompactWindow`), so the agent keeps working instead of
// stopping. Compaction runs between requests, and one full Read added ~33k on the live probe
// (74.5k → 99.5k), so inside a subagent (the payload carries `agent_id`) this hook reads the
// context of the subagent's last request from its transcript and, when the model is Haiku and the
// estimated Read would carry it past BRAKE_TOKENS, cuts the Read's `limit` to the lines that fit
// (also under the host's Read cap, which alone narrows a Read the host would reject), with a
// note on where to continue. Only when fewer than
// MIN_LINES fit is the Read denied, with a reason that asks for Grep or the answer.
//
// Main session: exits at once. Fail-open: any error lets the tool run.
// Log: `<ISO ts> <session> <agent_type> <narrow|read|miss> <model> <context>` in
// `<project>/.claude/learned/haiku-brake.log`; `miss` means no subagent transcript was found.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { appendLog } from "./instructions-loaded";
import { readTranscriptTail } from "./lib/transcript";
import { learnedLog } from "./lib/paths";
import { AFTER_COMPACT, BRAKE_TOKENS, CUT_ANSWER } from "./lib/haiku-budget";
import { readHookStdin } from "./lib/hook-stdin";

const TAIL_BYTES = 512 * 1024;
// Read output measured on the probe: 1.9-2.3 bytes per token, line numbers included.
const BYTES_PER_TOKEN = 2;
const MEDIA_RE = /\.(png|jpe?g|gif|webp|bmp|ico|pdf)$/i;
// Below this many lines a narrowed Read is not worth it: deny and ask for Grep or the answer.
const MIN_LINES = 20;
// A narrowed Read must also fit the host's Read cap, or the host rejects it; 10 % margin for the estimate.
const READ_ROOM = 0.9 * (Number(process.env.CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS) || 25_000);
// The host rejects a Read without `limit` on a file over 256 KB, whatever the offset (probe).
const HOST_FILE_BYTES = 256 * 1024;

interface BrakePayload {
  session_id?: string; transcript_path?: string; agent_id?: string; agent_type?: string; cwd?: string;
  tool_name?: string; tool_input?: { file_path?: unknown; offset?: unknown; limit?: unknown; [key: string]: unknown };
}

interface Usage { input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }

// The subagent's own transcript: `<main transcript without .jsonl>/subagents/agent-<id>.jsonl`.
export function agentTranscript(p: BrakePayload): string | null {
  if (!p.agent_id || !p.transcript_path) return null;
  if (p.transcript_path.includes("/subagents/")) return p.transcript_path;
  const id = p.agent_id.startsWith("agent-") ? p.agent_id : `agent-${p.agent_id}`;
  // The folder takes the transcript's stem, not session_id: the two can differ after a continued session.
  const file = join(p.transcript_path.replace(/\.jsonl$/, ""), "subagents", `${id}.jsonl`);
  return existsSync(file) ? file : null;
}

export const tail = (file: string): string => readTranscriptTail(file, TAIL_BYTES);

// Tokens of the tool results written after the last request. When the hook runs, the request
// that issued this tool call may not be in the transcript yet (probe: a Read at 83k was seen at
// 72.9k), so the previous result must be added to the last known context.
export function pendingTokens(text: string): number {
  const lines = text.split("\n");
  let bytes = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"type":"user"') && !lines[i].includes('"usage"')) continue;
    try {
      const entry = JSON.parse(lines[i]) as { type?: string; message?: { usage?: unknown; content?: unknown } };
      if (entry.type === "assistant" && entry.message?.usage) break;
      if (entry.type === "user") bytes += Buffer.byteLength(JSON.stringify(entry.message?.content ?? ""));
    } catch {
      // a cut first line or a malformed entry
    }
  }
  return Math.round(bytes / BYTES_PER_TOKEN);
}

// Model and prompt size of the last real request in a transcript chunk.
export function lastRequest(text: string): { model: string; context: number } | null {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"usage"')) continue;
    try {
      const entry = JSON.parse(lines[i]) as { type?: string; message?: { model?: string; usage?: Usage } };
      const { model, usage } = entry.message ?? {};
      if (entry.type !== "assistant" || !usage || !model || model === "<synthetic>") continue;
      return { model, context: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) };
    } catch {
      // a cut first line or a malformed entry
    }
  }
  return null;
}

// Lines a Read returns: from `offset` (1-based), `limit` lines or to the end.
function readSlice(input: BrakePayload["tool_input"]): string[] | null {
  const file = input?.file_path;
  if (typeof file !== "string" || MEDIA_RE.test(file) || statSync(file).size > 20 * 1024 * 1024) return null;
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  if (text.endsWith("\n")) lines.pop();
  const start = Math.max(0, (typeof input?.offset === "number" ? input.offset : 1) - 1);
  return lines.slice(start, typeof input?.limit === "number" ? start + input.limit : undefined);
}

function fileBytes(input: BrakePayload["tool_input"]): number {
  try {
    return typeof input?.file_path === "string" ? statSync(input.file_path).size : 0;
  } catch {
    return 0;
  }
}

// Tokens a Read would add, from the bytes of the lines it returns. Media, huge and unreadable
// files give 0, so the check never acts on a guess it cannot make.
export function readEstimate(input: BrakePayload["tool_input"]): number {
  try {
    const slice = readSlice(input);
    return slice ? Math.round(Buffer.byteLength(slice.join("\n")) / BYTES_PER_TOKEN) : 0;
  } catch {
    return 0;
  }
}

// The Read input with `limit` cut to the lines that fit in `room` tokens, measured on the lines
// it would return, or null when the file cannot be measured or fewer than MIN_LINES fit. A short
// tail is taken whole, and an offset past the end gets limit 1, so the host answers "end of file".
export function narrowRead(input: BrakePayload["tool_input"], room: number): Record<string, unknown> | null {
  try {
    const slice = readSlice(input);
    if (!slice) return null;
    let bytes = 0;
    let fit = 0;
    for (const line of slice) {
      bytes += Buffer.byteLength(line) + 1;
      if (bytes > room * BYTES_PER_TOKEN) break;
      fit++;
    }
    return fit >= Math.min(MIN_LINES, slice.length) ? { ...input, limit: Math.max(fit, 1) } : null;
  } catch {
    return null;
  }
}

export function narrowNote(limit: number): string {
  return `This Read was narrowed to ${limit} lines so the conversation stays under 90k tokens (above 100k every call costs 5x). Continue from the line after the last one shown; older context may be compacted between Reads, and you keep working. ${AFTER_COMPACT}`;
}

export function readReason(context: number, estimate: number): string {
  return `This Read would add ~${Math.round(estimate / 1000)}k tokens to a conversation at ~${Math.round(context / 1000)}k, near 100k where every call costs 5x, and not even 20 lines fit. Use Grep for what you still need, or answer now. If you stop here: ${CUT_ANSWER}`;
}

type HookOutput = { hookSpecificOutput: { hookEventName: "PreToolUse"; permissionDecision: "allow" | "deny"; permissionDecisionReason?: string; updatedInput?: Record<string, unknown>; additionalContext?: string } };

function haikuBrake(payload: BrakePayload, log: (line: string) => void = () => {}): HookOutput | null {
  if (!payload.agent_id || payload.tool_name !== "Read") return null;
  const stamp = `${new Date().toISOString()} ${(payload.session_id ?? "").slice(0, 8)} ${payload.agent_type ?? "-"}`;
  const file = agentTranscript(payload);
  if (!file) {
    log(`${stamp} miss - -`);
    return null;
  }
  const text = tail(file);
  const last = lastRequest(text);
  if (!last || !/haiku/i.test(last.model)) return null;
  const context = last.context + pendingTokens(text);
  const estimate = readEstimate(payload.tool_input);
  // Also a Read the host would reject: over its token cap, or without `limit` on a file over 256 KB.
  const hostRejects = estimate > READ_ROOM || (typeof payload.tool_input?.limit !== "number" && fileBytes(payload.tool_input) > HOST_FILE_BYTES);
  if (context + estimate < BRAKE_TOKENS && !hostRejects) return null;
  const narrowed = narrowRead(payload.tool_input, Math.min(BRAKE_TOKENS - context, READ_ROOM));
  if (narrowed) {
    log(`${stamp} narrow ${last.model} ${context}+${estimate} limit=${narrowed.limit}`);
    return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: narrowed, additionalContext: narrowNote(narrowed.limit as number) } };
  }
  log(`${stamp} read ${last.model} ${context}+${estimate}`);
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: readReason(context, estimate) } };
}

if (import.meta.main) {
  try {
    const payload = JSON.parse(await readHookStdin()) as BrakePayload;
    const logPath = learnedLog(payload.cwd, "haiku-brake.log");
    const out = haikuBrake(payload, (line) => {
      try { appendLog(line, logPath); } catch { /* best-effort */ }
    });
    if (out) process.stdout.write(JSON.stringify(out) + "\n");
  } catch {
    // fail-open, a broken payload never blocks a tool
  }
  process.exit(0);
}
