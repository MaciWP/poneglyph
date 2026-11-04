/**
 * Shared stdin reader for best-effort hooks.
 *
 * Uses Node-style process.stdin events.
 * Bun.stdin.text() hangs on Windows when the parent is a Bun subprocess feeding
 * stdin via Bun.spawn, the Node-style event API works reliably across platforms.
 * Swallows errors and returns "" so callers can treat "no input" as a no-op.
 * Every hook reads its payload here, so this is also where its run line starts (run-log.ts).
 */
import { startRunLog } from "./run-log";

export function readHookStdin(): Promise<string> {
  return new Promise<string>((resolve) => {
    const chunks: string[] = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => chunks.push(chunk));
    process.stdin.on("end", () => {
      const raw = chunks.join("");
      try {
        startRunLog(raw);
      } catch {
        // the run log never stops a hook: hooks is linked into every live session
      }
      resolve(raw);
    });
    process.stdin.on("error", () => resolve(""));
    process.stdin.resume();
  });
}
