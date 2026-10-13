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
