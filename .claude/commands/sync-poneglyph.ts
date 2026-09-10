#!/usr/bin/env bun
// .claude/commands/sync-poneglyph.ts — one sync for every installed harness.
//
// Detects Claude Code, Codex and Grok Build (CLI on PATH or config home present), shows the
// detected set, asks once, then runs the per-host engines in dependency order:
//   sync-claude → sync-codex (one run per profile) → sync-grok
// Engine-only flags (--check --unlink --validate-hooks --method --home-dir) stay on the
// engines: bun .claude/scripts/sync-{claude,codex,grok}.ts --help
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { askConfirmation } from "../scripts/sync-claude";
import { detectHosts, HOST_ORDER, realProbe, type DetectedHost, type HostName } from "../scripts/lib/hosts";

export interface SyncFlags {
  status: boolean;
  execute: boolean;
  backup: boolean;
  noValidate: boolean;
}

export interface Run {
  host: HostName;
  label: string;
  cmd: string[];
  env: Record<string, string>;
}

export const ENGINES: Record<HostName, string> = {
  claude: path.join(".claude", "scripts", "sync-claude.ts"),
  codex: path.join(".claude", "scripts", "sync-codex.ts"),
  grok: path.join(".claude", "scripts", "sync-grok.ts"),
};

// Default = every detected host. `--hosts a,b` overrides detection; `all` forces the three.
// Grok reuses ~/.claude, so selecting it always pulls Claude in.
export function selectHosts(detected: DetectedHost[], hostsFlag?: string): { selected: DetectedHost[]; notes: string[] } {
  const byName = new Map(detected.map((h) => [h.name, h]));
  let names: HostName[];
  if (!hostsFlag) names = detected.filter((h) => h.installed).map((h) => h.name);
  else if (hostsFlag === "all") names = [...HOST_ORDER];
  else {
    names = hostsFlag.split(",").map((s) => s.trim()).filter(Boolean) as HostName[];
    const unknown = names.filter((n) => !byName.has(n));
    if (unknown.length) throw new Error(`Unknown host(s): ${unknown.join(", ")}. Valid: ${HOST_ORDER.join(", ")}, all.`);
  }
  const notes: string[] = [];
  if (names.includes("grok") && !names.includes("claude")) {
    names.push("claude");
    notes.push("Grok reuses the shared Claude layer (~/.claude): Claude is synced first.");
  }
  const selected = HOST_ORDER.filter((n) => names.includes(n)).map((n) => byName.get(n)!);
  return { selected, notes };
}

// Every engine gets --force: the orchestrator already asked (or the caller passed --force).
export function planRuns(selected: DetectedHost[], flags: SyncFlags, projectRoot: string): Run[] {
  const mode = flags.status ? ["--status"] : flags.execute ? ["--execute"] : [];
  const common = [...mode, ...(flags.backup ? ["--backup"] : []), "--force"];
  const runs: Run[] = [];
  for (const host of selected) {
    const script = path.join(projectRoot, ENGINES[host.name]);
    if (host.name === "codex") {
      for (const profile of host.targets) {
        runs.push({ host: "codex", label: `codex (${profile})`, cmd: [process.execPath, script, ...common], env: { CODEX_HOME: profile } });
      }
      continue;
    }
    const extra = host.name === "claude" && flags.noValidate ? ["--no-validate"] : [];
    runs.push({ host: host.name, label: host.name, cmd: [process.execPath, script, ...common, ...extra], env: {} });
  }
  return runs;
}

export function formatDetection(detected: DetectedHost[], selected: ReadonlySet<HostName>): string {
  const action = (h: DetectedHost) => (selected.has(h.name) ? "sync" : h.installed ? "skip (not selected)" : "skip (not installed)");
  return [
    "| Host | CLI | Targets | Action |",
    "|---|---|---|---|",
    ...detected.map((h) => `| ${h.name} | ${h.cli ?? "—"} | ${h.targets.join(", ")} | ${action(h)} |`),
  ].join("\n");
}

function usage(): void {
  console.log(`
sync-poneglyph - sync Poneglyph into every installed harness (Claude Code, Codex, Grok Build)

Usage:
  bun .claude/commands/sync-poneglyph.ts [--status|--execute] [--backup] [--force] [--hosts LIST] [--no-validate]

Options:
  (none)          Preview: detect hosts and show what each engine would change
  --status        Show the current state of every detected host
  --execute       Apply changes (asks once; add --force to skip the prompt)
  --backup        Save existing content before replacing (required by Codex/Grok when a target exists)
  --force         No confirmation prompt; required without an interactive terminal
  --hosts LIST    Override detection: comma list of claude,codex,grok — or "all"
  --no-validate   Skip the 'claude doctor' acceptance check of the generated settings.json (Claude only)
  -h, --help      Show this help

Detection: a host counts as installed when its CLI resolves on PATH or its config home exists
(~/.claude · ~/.codex and $CODEX_HOME · ~/.grok). Codex runs once per existing profile, ~/.codex first.
Order: claude → codex → grok (Codex embeds the style twin Claude regenerates; Grok reuses ~/.claude).

Per-host engines keep their own flags (--check, --unlink, --validate-hooks, --method, --home-dir):
  bun .claude/scripts/sync-claude.ts --help
  bun .claude/scripts/sync-codex.ts --help
  bun .claude/scripts/sync-grok.ts --help
`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      status: { type: "boolean", default: false },
      execute: { type: "boolean", default: false },
      backup: { type: "boolean", default: false },
      force: { type: "boolean", short: "f", default: false },
      hosts: { type: "string" },
      "no-validate": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) return usage();
  if (values.status && values.execute) throw new Error("--status and --execute are exclusive.");
  const flags: SyncFlags = {
    status: values.status ?? false,
    execute: values.execute ?? false,
    backup: values.backup ?? false,
    noValidate: values["no-validate"] ?? false,
  };
  if (flags.execute && !values.force && !process.stdin.isTTY) {
    console.error(
      "\n❌ No interactive terminal and --force not set — this would hang on the\n" +
        "   confirmation prompt. Re-run non-interactively with --force:\n" +
        "     bun .claude/commands/sync-poneglyph.ts --execute --backup --force\n",
    );
    process.exit(2);
  }

  // Resolve through the ~/.claude junction so the engines sync from the real checkout.
  const projectRoot = fs.realpathSync.native(path.resolve(import.meta.dir, "../.."));
  const detected = detectHosts(realProbe());
  const { selected, notes } = selectHosts(detected, values.hosts);

  console.log(`\n🔧 Sync Poneglyph\n   Source: ${projectRoot}\n`);
  console.log(formatDetection(detected, new Set(selected.map((h) => h.name))));
  for (const note of notes) console.log(`ℹ️  ${note}`);
  if (!selected.length) {
    console.log("\nNo harness detected. Install Claude Code, Codex or Grok Build, or pass --hosts.");
    return;
  }

  const runs = planRuns(selected, flags, projectRoot);
  if (flags.execute && !values.force) {
    const ok = await askConfirmation(`Sync ${runs.length} target(s): ${runs.map((r) => r.label).join(", ")}?`);
    if (!ok) {
      console.log("❌ Cancelled");
      return;
    }
  }

  // Sequential and fail-fast: a later engine depends on the earlier one's output.
  const exitCodes = new Map<string, number>();
  for (const run of runs) {
    console.log(`\n▶ ${run.label}`);
    const proc = Bun.spawn(run.cmd, {
      cwd: projectRoot,
      env: { ...process.env, ...run.env },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const code = await proc.exited;
    exitCodes.set(run.label, code);
    if (code !== 0) break;
  }

  console.log("\nSummary:");
  for (const run of runs) {
    const code = exitCodes.get(run.label);
    const icon = code === undefined ? "⚪" : code === 0 ? "🟢" : "🔴";
    const suffix = code === undefined ? " (not run)" : code === 0 ? "" : ` (exit ${code})`;
    console.log(`  ${icon} ${run.label}${suffix}`);
  }
  const failed = [...exitCodes.values()].find((code) => code !== 0);
  if (failed !== undefined) process.exit(failed);
  if (!flags.execute && !flags.status) {
    console.log("\n💡 Preview only. Use --execute to sync (add --backup when a target already exists).");
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`sync-poneglyph failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
