import { closeSync, fstatSync, openSync, readSync } from "node:fs";

// Transcripts grow to many MB, so hooks read only the end. A cut first line is fine:
// every reader skips lines that do not parse.
export function readTranscriptTail(path: string, maxBytes = 256 * 1024): string {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const len = Math.min(size, maxBytes);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, size - len);
    return buf.toString("utf8");
  } finally {
    closeSync(fd);
  }
}

// A message the user types while a turn runs is stored as a queued_command attachment,
// not as a user entry. Task notifications use the same shape with another origin.
export function queuedPromptOf(event: unknown): string | null {
  const e = event as { type?: string; attachment?: { type?: string; prompt?: unknown; commandMode?: string; origin?: { kind?: string } } };
  const a = e?.type === "attachment" ? e.attachment : undefined;
  if (a?.type !== "queued_command" || a.commandMode !== "prompt" || (a.origin?.kind ?? "human") !== "human") return null;
  return typeof a.prompt === "string" && a.prompt.trim() ? a.prompt : null;
}

// The text the human typed, or null when a "user" event is not a prompt: tool results
// come back as user events too, and meta or compaction-summary events are harness text.
// A prompt with an image or a pasted block is an array of text/image blocks, not a string.
export function userPromptOf(event: unknown): string | null {
  const e = event as { type?: string; isMeta?: boolean; isCompactSummary?: boolean; message?: { content?: unknown } };
  if (e?.type !== "user" || e.isMeta || e.isCompactSummary) return null;
  const content = e.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const blocks = content as Array<{ type?: string; text?: unknown }>;
  if (blocks.some((b) => b?.type === "tool_result")) return null;
  const texts = blocks.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text as string);
  return texts.length ? texts.join("\n") : null;
}

// A prompt a person typed: task notifications and agent prompts carry another origin. An event
// with no origin (older transcripts) counts as human.
export const isHumanOrigin = (event: unknown): boolean => {
  const kind = (event as { origin?: { kind?: string } })?.origin?.kind;
  return kind === undefined || kind === "human";
};

// The router note an attachment carries, or null. The prompt-router hook's note is an async hook
// response; the log-pose mod's rides the prompt as a `prompt.submit` context block.
export function routerNoteOf(event: unknown): string | null {
  const e = event as { type?: string; attachment?: { type?: string; content?: unknown; response?: { hookSpecificOutput?: { additionalContext?: unknown } } } };
  if (e?.type !== "attachment") return null;
  const a = e.attachment;
  const raw = a?.type === "async_hook_response" ? a.response?.hookSpecificOutput?.additionalContext
    : a?.type === "hook_additional_context" ? a.content : undefined;
  const text = Array.isArray(raw) ? raw.filter((t) => typeof t === "string").join("\n") : raw;
  return typeof text === "string" && text.includes("<prompt-router ") ? text : null;
}
