/**
 * One JSONL line per hook run, for the usage view in Agentic OS: how long each hook takes, how it
 * ends and how much it hands back to the model, on every host. `readHookStdin` starts it, so every
 * hook that reads its payload through it is counted with no change of its own.
 *
 * Counts, sizes and times only: never a path, a prompt, a command or the output itself. Session
 * ids join the line to the usage the transcripts record.
 *
 * `ms` is the time since the process started (Bun's `performance.now()`), so it holds Bun's own
 * start and the module loads, but not the host's spawn. A hook the host kills on timeout writes
 * nothing: timeouts stay in the transcript (Claude) and in Grok's `hook_execution` records.
 *
 * Off under `bun test` (it sets NODE_ENV=test and the spawned hooks inherit it) unless
 * PONEGLYPH_RUN_LOG_DIR names a folder, so a test run never writes into the real config dir.
 * ponytail: one file per month, never pruned; drop old months when the folder passes ~500 MB.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { claudeConfigDir } from "./paths";

export type RunOutcome = "ok" | "block" | "error";

export interface RunRecord {
  at: string;
  host: string;
  session?: string;
  hook: string;
  event?: string;
  tool?: string;
  ms: number;
  exit: number;
  outcome: RunOutcome;
  out: number; // bytes written to stdout: what the host hands the model or the user
  [extra: string]: unknown;
}

export function runLogDir(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.PONEGLYPH_RUN_LOG_DIR) return env.PONEGLYPH_RUN_LOG_DIR;
  return env.NODE_ENV === "test" ? null : join(claudeConfigDir(env), "learned", "hook-runs");
}

const DENY = /"(?:permissionDecision|decision)"\s*:\s*"(?:deny|block)"/;

export function outcomeOf(exit: number, stdout: string): RunOutcome {
  if (exit === 2 || DENY.test(stdout)) return "block";
  return exit === 0 ? "ok" : "error";
}

// The top-level keys come first in every host's payload; a tool's input or output never does.
const HEAD = 2048;
const field = (head: string, keys: string) => head.match(new RegExp(`"(?:${keys})"\\s*:\\s*"([^"]{1,128})"`))?.[1];
const arg = (argv: string[], name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

/** Who ran and on what, read from the argv and the head of the raw payload. */
export function runContext(raw: string, argv: string[] = process.argv): Pick<RunRecord, "host" | "session" | "hook" | "event" | "tool"> {
  const head = raw.slice(0, HEAD);
  return {
    host: arg(argv, "--host") ?? "claude",
    session: field(head, "session_id|sessionId"),
    hook: basename(argv[1] ?? "unknown"),
    event: arg(argv, "--event") ?? field(head, "hook_event_name|hookEventName"),
    tool: field(head, "tool_name|toolName"),
  };
}

let extra: Record<string, unknown> | null = null;

/** Adds fields to this run's line, such as a size or the kind of a reminder. No-op when off. */
export function noteRun(fields: Record<string, unknown>): void {
  if (extra) Object.assign(extra, fields);
}

/** Starts the line for this process; written once, on exit. */
export function startRunLog(raw: string, env: NodeJS.ProcessEnv = process.env): void {
  const dir = runLogDir(env);
  if (!dir || extra) return;
  extra = {};
  const context = runContext(raw);
  // Bun's console.log does not go through process.stdout.write, so both are counted.
  let out = "";
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    out += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return (write as (...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stdout.write;
  const log = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    out += args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ") + "\n";
    log(...args);
  };
  process.on("exit", (code) => {
    try {
      const exit = code ?? Number(process.exitCode ?? 0);
      const record: RunRecord = {
        at: new Date().toISOString(),
        ...context,
        ms: Math.round(performance.now() * 10) / 10,
        exit,
        outcome: outcomeOf(exit, out),
        out: Buffer.byteLength(out),
        ...extra,
      };
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, `${record.at.slice(0, 7)}.jsonl`), JSON.stringify(record) + "\n");
    } catch {
      // best-effort: the log never changes how a hook ends
    }
  });
}
