#!/usr/bin/env bun

// PreToolUse (Bash|PowerShell|Monitor) — remote git actions run only when Oriol asked for them
// this turn. Contract and logic: ./lib/remote-git.ts.
//
// This entrypoint has no static imports on purpose. A hook that exits with any code other than
// 0 or 2, or that times out, does not block the call (code.claude.com/docs/en/hooks), and a
// failed static import exits 1 before any code runs (a partial sync that ships this file without
// its library). So stdin is read first, the logic is imported lazily, and every failure path —
// import error, throw, unhandled rejection or the internal deadline — blocks with exit 2 when the
// payload looks remote. The deadline sits below the hook's 15 s timeout in settings.global.json.
const REMOTE_HINT = /\bpush\b|\bgh(?:\.exe)?\b[\s\S]*\bpr\b/i;
const FAILURE_REASON = "The remote-git gate could not judge this command, so it blocks anything that looks like a push or a gh pr call. Do not retry it in another form; tell Oriol the gate failed and let him run it himself.";
const DEADLINE_MS = 10_000;

let raw = "";

function failClosed(): never {
  if (REMOTE_HINT.test(raw)) {
    process.stderr.write(FAILURE_REASON + "\n");
    process.exit(2);
  }
  process.exit(0);
}

// Same Node-style reader as lib/hook-stdin.ts, inlined so that no import can fail before stdin is
// read (Bun.stdin.text() hangs on Windows when a Bun parent feeds stdin).
function readStdin(): Promise<string> {
  return new Promise<string>((resolve) => {
    const chunks: string[] = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", () => resolve(chunks.join("")));
    process.stdin.resume();
  });
}

process.on("uncaughtException", failClosed);
process.on("unhandledRejection", failClosed);

raw = await readStdin();
setTimeout(failClosed, DEADLINE_MS).unref();
try {
  const { gateVerdict } = await import("./lib/remote-git");
  const reason = await gateVerdict(raw);
  if (reason) {
    process.stderr.write(reason + "\n");
    process.exit(2);
  }
  process.exit(0);
} catch {
  failClosed();
}
