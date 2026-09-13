import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import type { DetectedHost } from "../../scripts/lib/hosts";
import { formatDetection, planRuns, selectHosts, type SyncFlags } from "../sync-poneglyph";

const ROOT = path.resolve("/repo");
const host = (name: DetectedHost["name"], installed: boolean, targets = [`/home/u/.${name}`]): DetectedHost =>
  ({ name, installed, cli: installed ? `/bin/${name}` : null, targets });
const flags = (over: Partial<SyncFlags> = {}): SyncFlags => ({ status: false, execute: false, backup: false, noValidate: false, ...over });

describe("selectHosts", () => {
  const detected = [host("claude", true), host("codex", false), host("grok", true)];

  it("defaults to the detected hosts, in dependency order", () => {
    const { selected, notes } = selectHosts(detected);
    expect(selected.map((h) => h.name)).toEqual(["claude", "grok"]);
    expect(notes).toEqual([]);
  });

  it("--hosts grok pulls Claude in because Grok reuses ~/.claude", () => {
    const { selected, notes } = selectHosts(detected, "grok");
    expect(selected.map((h) => h.name)).toEqual(["claude", "grok"]);
    expect(notes).toHaveLength(1);
  });

  it("--hosts all forces the three regardless of detection; unknown names throw", () => {
    expect(selectHosts(detected, "all").selected.map((h) => h.name)).toEqual(["claude", "codex", "grok"]);
    expect(selectHosts(detected, "codex, claude").selected.map((h) => h.name)).toEqual(["claude", "codex"]);
    expect(() => selectHosts(detected, "cursor")).toThrow(/Unknown host/);
  });
});

describe("planRuns", () => {
  const selected = [host("claude", true), host("codex", true, ["/home/u/.codex", "/orca/home"]), host("grok", true)];

  it("one run per host, Codex once per profile with its CODEX_HOME, always --force", () => {
    const runs = planRuns(selected, flags({ execute: true, backup: true }), ROOT);
    expect(runs.map((r) => r.label)).toEqual(["claude", "codex (/home/u/.codex)", "codex (/orca/home)", "grok"]);
    expect(runs.map((r) => r.env)).toEqual([{}, { CODEX_HOME: "/home/u/.codex" }, { CODEX_HOME: "/orca/home" }, {}]);
    for (const run of runs) {
      expect(run.cmd[0]).toBe(process.execPath);
      expect(run.cmd[1].startsWith(ROOT)).toBe(true);
      expect(run.cmd.slice(2)).toEqual(["--execute", "--backup", "--force"]);
    }
    expect(runs[0].cmd[1]).toBe(path.join(ROOT, ".claude", "scripts", "sync-claude.ts"));
  });

  it("--status passes through; --no-validate reaches Claude only; preview sends no mode flag", () => {
    const status = planRuns(selected, flags({ status: true, noValidate: true }), ROOT);
    expect(status[0].cmd.slice(2)).toEqual(["--status", "--force", "--no-validate"]);
    expect(status[1].cmd.slice(2)).toEqual(["--status", "--force"]);
    expect(status[3].cmd.slice(2)).toEqual(["--status", "--force"]);
    expect(planRuns(selected, flags(), ROOT)[0].cmd.slice(2)).toEqual(["--force"]);
  });
});

describe("formatDetection", () => {
  it("marks each host as sync / not selected / not installed", () => {
    const table = formatDetection([host("claude", true), host("codex", true), host("grok", false)], new Set(["claude"]));
    expect(table).toContain("| claude | /bin/claude | /home/u/.claude | sync |");
    expect(table).toContain("| codex | /bin/codex | /home/u/.codex | skip (not selected) |");
    expect(table).toContain("| grok | — | /home/u/.grok | skip (not installed) |");
  });
});

describe("CLI smoke (disposable home, read-only --status)", () => {
  it("reports an empty home as incomplete instead of green", () => {
    const home = mkdtempSync(path.join(tmpdir(), "sync-poneglyph-"));
    const result = Bun.spawnSync(
      [process.execPath, path.resolve(import.meta.dir, "../sync-poneglyph.ts"), "--status", "--hosts", "claude", "--no-validate"],
      { env: { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, ".codex") }, stdin: "ignore" },
    );
    const out = result.stdout.toString() + result.stderr.toString();
    expect(result.exitCode).toBe(1);
    expect(out).toContain("| Host | CLI | Targets | Action |");
    expect(out).toContain(`| claude |`);
    expect(out).toContain("🔴 claude");
    expect(out).not.toContain("▶ codex");
  });

  it("refuses --execute without --force when no terminal is attached", () => {
    const result = Bun.spawnSync(
      [process.execPath, path.resolve(import.meta.dir, "../sync-poneglyph.ts"), "--execute", "--hosts", "claude"],
      { stdin: "ignore" },
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr.toString()).toContain("--force");
  });
});
