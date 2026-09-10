// Which harnesses are installed on this machine (consumed by /sync-poneglyph and doctor).
// "Installed" = the CLI resolves on PATH OR its config home exists. Codex may carry two
// profiles (an account profile in CODEX_HOME plus the default ~/.codex); both are targets.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type HostName = "claude" | "codex" | "grok";

// Dependency order: sync-codex concatenates the style twin that sync-claude regenerates,
// and sync-grok refuses to install without the shared ~/.claude layer.
export const HOST_ORDER: readonly HostName[] = ["claude", "codex", "grok"];

export interface HostProbe {
  which: (binary: string) => string | null;
  exists: (p: string) => boolean;
  home: string;
  env: NodeJS.ProcessEnv;
}

export interface DetectedHost {
  name: HostName;
  cli: string | null;
  /** Config homes the engine writes to. Codex lists one entry per profile. */
  targets: string[];
  installed: boolean;
}

const CLI: Record<HostName, string> = { claude: "claude", codex: "codex", grok: "grok" };

// CODEX_HOME first (the profile an interactive `codex` actually uses when the variable is
// set), then the default profile; de-duplicated when both resolve to the same directory.
// Nothing installed yet → the single default target, so a fresh machine still gets one run.
export function codexTargets(home: string, env: NodeJS.ProcessEnv, exists: HostProbe["exists"]): string[] {
  const candidates = [env.CODEX_HOME ? path.resolve(env.CODEX_HOME) : null, path.join(home, ".codex")]
    .filter((p): p is string => p !== null);
  const unique = candidates.filter((p, i) => candidates.findIndex((q) => samePath(p, q)) === i);
  const existing = unique.filter(exists);
  return existing.length ? existing : [unique[0]];
}

function samePath(a: string, b: string): boolean {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

export function detectHosts(probe: HostProbe): DetectedHost[] {
  return HOST_ORDER.map((name) => {
    const targets = name === "codex"
      ? codexTargets(probe.home, probe.env, probe.exists)
      : [path.join(probe.home, `.${name}`)];
    const cli = probe.which(CLI[name]);
    return { name, cli, targets, installed: cli !== null || targets.some(probe.exists) };
  });
}

export function realProbe(): HostProbe {
  return { which: (binary) => Bun.which(binary), exists: fs.existsSync, home: os.homedir(), env: process.env };
}
