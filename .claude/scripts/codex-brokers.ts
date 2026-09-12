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
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const STATE_ROOT = join(tmpdir(), "codex-companion");

export interface Broker {
  /** State directory name: `<workspace basename>-<hash>`. */
  slug: string;
  pid: number;
  alive: boolean;
  endpoint: string;
}

/**
 * Mirrors `resolveStateDir` in the plugin: the workspace basename, then 16 hex characters of
 * the sha256 of its canonical path. Reimplemented rather than imported because the plugin
 * path carries its version number, and a pinned path is a dead reference waiting to happen.
 */
export function stateDirName(workspaceRoot: string): string {
  // `resolve` first, always: the plugin hashes a native path, so on Windows the separators
  // must be backslashes. Hashing the string as typed (`D:/PYTHON/x`) yields a different digest
  // and the lookup silently reports that nothing pins the directory — the exact opposite of
  // the truth, and it only shows up once the directory is gone and realpath can no longer fix it.
  let canonical = resolve(workspaceRoot);
  try {
    canonical = realpathSync.native(canonical);
  } catch {
    // A directory that no longer exists still has a broker registered; the resolved path stands.
  }
  // The basename comes from the resolved path too, so both halves of the name agree about
  // where the separators are.
  const slug = basename(canonical).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
  return `${slug}-${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readBrokers(root = STATE_ROOT): Broker[] {
  if (!existsSync(root)) return [];
  const brokers: Broker[] = [];
  for (const slug of readdirSync(root)) {
    const file = join(root, slug, "broker.json");
    if (!existsSync(file)) continue;
    try {
      const state = JSON.parse(readFileSync(file, "utf8")) as { pid: number; endpoint: string };
      brokers.push({ slug, pid: state.pid, alive: isAlive(state.pid), endpoint: state.endpoint });
    } catch {
      // A half-written state file is not worth failing the listing over.
    }
  }
  return brokers.sort((a, b) => Number(b.alive) - Number(a.alive) || a.slug.localeCompare(b.slug));
}

/** Newest installed copy of the plugin's lifecycle module, or null when it is not there. */
function lifecycleModule(): string | null {
  const cache = join(homedir(), ".claude", "plugins", "cache", "openai-codex", "codex");
  if (!existsSync(cache)) return null;
  const newest = readdirSync(cache).sort().pop();
  return newest ? join(cache, newest, "scripts", "lib", "broker-lifecycle.mjs") : null;
}

/** Graceful first: the plugin's own `broker/shutdown`. Falls back to a signal. */
async function shutdown(broker: Broker): Promise<boolean> {
  try {
    const lib = lifecycleModule();
    if (!lib) throw new Error("plugin not installed");
    const { sendBrokerShutdown } = await import(`file://${lib.replace(/\\/g, "/")}`);
    await sendBrokerShutdown(broker.endpoint);
    await Bun.sleep(800);
  } catch {
    // The plugin moved or is not installed: the broker is a detached daemon, so a signal is
    // the honest fallback. Its task is finished by the time anyone runs this.
    try {
      process.kill(broker.pid);
      await Bun.sleep(300);
    } catch {
      return false;
    }
  }
  return !isAlive(broker.pid);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const target = args[args.indexOf("--shutdown") + 1];

  if (args.includes("--shutdown")) {
    if (!target || target.startsWith("--")) {
      console.error("Usage: --shutdown <path to the directory the broker pins>");
      process.exit(1);
    }
    const wanted = stateDirName(target);
    const broker = readBrokers().find((b) => b.slug === wanted);
    if (!broker) {
      console.log(`No broker is registered for ${target}. Nothing pins it.`);
      return;
    }
    if (!broker.alive) {
      console.log(`The broker for ${target} (pid ${broker.pid}) is already stopped.`);
      return;
    }
    console.log(await shutdown(broker) ? `Stopped the broker for ${target} (pid ${broker.pid}).` : `Could not stop pid ${broker.pid}; stop it by hand.`);
    return;
  }

  const brokers = readBrokers();
  if (!brokers.length) {
    console.log("No Codex brokers registered on this machine.");
    return;
  }
  console.log("| Workspace | PID | State |");
  console.log("|---|---:|---|");
  for (const b of brokers) console.log(`| ${b.slug} | ${b.pid} | ${b.alive ? "running — pins its directory" : "stopped"} |`);
  console.log("\nA running broker holds its directory open. Shut it down before removing that directory:");
  console.log("  bun $HOME/.claude/scripts/codex-brokers.ts --shutdown <path>");
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
