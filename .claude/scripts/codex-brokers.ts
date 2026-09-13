#!/usr/bin/env bun
// bun .claude/scripts/codex-brokers.ts [--shutdown <path>]
//
// Lists the Codex companion brokers running on this machine, and shuts one down.
//
// Why this exists: the codex plugin spawns one broker per distinct `--cwd`
// (`scripts/lib/broker-lifecycle.mjs`, `spawn(..., { cwd, detached: true })` then `unref()`).
// On Windows a process holding a directory as its working directory locks that directory
// against deletion, even when it is empty — so a worktree used as `--cwd` cannot be removed
// until the broker dies, and the plugin only shuts brokers down from its session-end hook.
// The failing command is `git worktree remove` or `rm -rf`, which points at the wrong culprit.
//
// The real fix is not to point Codex at a disposable directory in the first place; see the
// `consult` skill. This is the repair for when it already happened.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

export function stateRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.CLAUDE_PLUGIN_DATA ? join(env.CLAUDE_PLUGIN_DATA, "state") : join(tmpdir(), "codex-companion");
}

export interface Broker {
  /** State directory name: `<workspace basename>-<hash>`. */
  slug: string;
  pid: number;
  alive: boolean;
  endpoint: string;
}

/** Use the installed plugin's Git-root, canonical-path and data-directory contract. */
export async function resolveBrokerDirectory(workspaceRoot: string): Promise<string> {
  const lib = lifecycleModule();
  if (!lib) throw new Error("Codex plugin is unavailable; broker lookup is unverified.");
  const { resolveStateDir } = await import(pathToFileURL(join(dirname(lib), "state.mjs")).href);
  return resolveStateDir(workspaceRoot);
}

function localEndpoint(endpoint: unknown): string | null {
  if (typeof endpoint !== "string" || endpoint.includes("\0")) return null;
  if (endpoint.startsWith("pipe:")) {
    const path = endpoint.slice(5);
    const prefix = "\\\\.\\pipe\\";
    return path.startsWith(prefix) && /^[^\\/]+$/.test(path.slice(prefix.length)) ? path : null;
  }
  if (endpoint.startsWith("unix:")) {
    const path = endpoint.slice(5);
    return isAbsolute(path) && !path.startsWith("\\\\") ? path : null;
  }
  return null;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readBrokers(root = stateRoot()): Broker[] {
  if (!existsSync(root)) return [];
  const brokers: Broker[] = [];
  for (const slug of readdirSync(root)) {
    const file = join(root, slug, "broker.json");
    if (!existsSync(file)) continue;
    try {
      const state = JSON.parse(readFileSync(file, "utf8")) as { pid: number; endpoint: string };
      if (!state || !Number.isSafeInteger(state.pid) || state.pid <= 0 || !localEndpoint(state.endpoint)) continue;
      brokers.push({ slug, pid: state.pid, alive: isAlive(state.pid), endpoint: state.endpoint });
    } catch {
      // A half-written state file is not worth failing the listing over.
    }
  }
  return brokers.sort((a, b) => Number(b.alive) - Number(a.alive) || a.slug.localeCompare(b.slug));
}

/** Where Claude Code keeps its configuration. `CLAUDE_CONFIG_DIR` moves it. */
export function claudeConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
}

/**
 * Orders plugin versions numerically. A plain `sort()` is lexicographic, so it ranks `1.0.10`
 * below `1.0.9` and would import the module of an older plugin than the one installed.
 */
export function newestVersion(versions: string[]): string | undefined {
  const parts = (v: string) => v.split(".").map((n) => Number.parseInt(n, 10) || 0);
  return [...versions].sort((a, b) => {
    const [x, y] = [parts(a), parts(b)];
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
    }
    return 0;
  }).pop();
}

/** Newest installed copy of the plugin's lifecycle module, or null when it is not there. */
function lifecycleModule(): string | null {
  const cache = join(claudeConfigDir(), "plugins", "cache", "openai-codex", "codex");
  if (!existsSync(cache)) return null;
  const newest = newestVersion(readdirSync(cache));
  return newest ? join(cache, newest, "scripts", "lib", "broker-lifecycle.mjs") : null;
}

/** Bounded broker protocol. An acknowledgement proves acceptance, not process exit.
 * The plugin helper treats errors as success and has no deadline, so use its wire
 * contract here. Never signal a PID read from a potentially stale state file.
 */
export async function requestShutdown(endpoint: string, timeoutMs = 2000): Promise<boolean> {
  const path = localEndpoint(endpoint);
  if (!path || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return false;
  return new Promise(resolve => {
    const socket = createConnection(path);
    let buffer = "";
    const finish = (accepted: boolean) => {
      clearTimeout(timer);
      socket.destroy();
      resolve(accepted);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write('{"id":1,"method":"broker/shutdown","params":{}}\n'));
    socket.on("error", () => finish(false));
    socket.on("close", () => finish(false));
    socket.on("data", chunk => {
      buffer += chunk;
      if (buffer.length > 65536) return finish(false);
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      try {
        const reply = JSON.parse(buffer.slice(0, end));
        finish(reply?.id === 1 && reply.error === undefined && reply.result !== undefined);
      } catch { finish(false); }
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const target = args[args.indexOf("--shutdown") + 1];

  if (args.includes("--shutdown")) {
    if (!target || target.startsWith("--")) {
      console.error("Usage: --shutdown <path to the directory the broker pins>");
      process.exit(1);
    }
    const directory = await resolveBrokerDirectory(target);
    const broker = readBrokers(dirname(directory)).find((b) => b.slug === basename(directory));
    if (!broker) {
      console.error(`No valid broker record found in ${directory}; filesystem locks are unverified.`);
      process.exitCode = 1;
      return;
    }
    if (!broker.alive) {
      console.log(`The recorded PID ${broker.pid} is absent; filesystem locks are unverified.`);
      return;
    }
    const lib = lifecycleModule()!;
    const { createBrokerEndpoint } = await import(pathToFileURL(join(dirname(lib), "broker-endpoint.mjs")).href);
    if (broker.endpoint !== createBrokerEndpoint(directory)) {
      console.error("Broker endpoint does not match the workspace; shutdown refused.");
      process.exitCode = 1;
      return;
    }
    const accepted = await requestShutdown(broker.endpoint);
    console.log(accepted ? `Broker acknowledged shutdown for ${target}; process exit and filesystem locks remain unverified.` : `Broker shutdown was not acknowledged for ${target}. No process signal was sent.`);
    if (!accepted) process.exitCode = 1;
    return;
  }

  const brokers = readBrokers();
  if (!brokers.length) {
    console.log("No Codex brokers registered on this machine.");
    return;
  }
  console.log("| Workspace | PID | State |");
  console.log("|---|---:|---|");
  for (const b of brokers) console.log(`| ${b.slug} | ${b.pid} | ${b.alive ? "PID exists; broker identity unverified" : "PID absent"} |`);
  // Printed as a resolved path rather than `$HOME/…`: shell variables differ per platform and
  // per shell, and CLAUDE_CONFIG_DIR can move the whole directory.
  console.log("\nA broker may hold its directory open. Request graceful shutdown with:");
  console.log(`  bun ${join(claudeConfigDir(), "scripts", "codex-brokers.ts")} --shutdown <path>`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
