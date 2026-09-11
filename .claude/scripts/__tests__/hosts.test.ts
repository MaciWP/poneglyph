import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { codexTargets, detectHosts, HOST_ORDER, type HostProbe } from "../lib/hosts";

const HOME = path.resolve("/home/u");
const probe = (over: Partial<HostProbe> & { bins?: string[]; dirs?: string[] } = {}): HostProbe => {
  const bins = new Set(over.bins ?? []);
  const dirs = new Set((over.dirs ?? []).map((d) => path.resolve(d)));
  return {
    which: (b) => (bins.has(b) ? `/usr/bin/${b}` : null),
    exists: (p) => dirs.has(path.resolve(p)),
    home: HOME,
    env: over.env ?? {},
  };
};

describe("detectHosts", () => {
  it("returns the three hosts in dependency order, none installed on a bare machine", () => {
    const hosts = detectHosts(probe());
    expect(hosts.map((h) => h.name)).toEqual([...HOST_ORDER]);
    expect(hosts.every((h) => !h.installed)).toBe(true);
    expect(hosts.map((h) => h.targets)).toEqual([[path.join(HOME, ".claude")], [path.join(HOME, ".codex")], [path.join(HOME, ".grok")]]);
  });

  it("a CLI on PATH counts as installed even without a config home", () => {
    const [claude, codex, grok] = detectHosts(probe({ bins: ["claude"] }));
    expect(claude).toMatchObject({ installed: true, cli: "/usr/bin/claude" });
    expect(codex.installed).toBe(false);
    expect(grok.installed).toBe(false);
  });

  it("a config home counts as installed even without the CLI on PATH", () => {
    const hosts = detectHosts(probe({ dirs: [path.join(HOME, ".codex"), path.join(HOME, ".grok")] }));
    expect(hosts.map((h) => h.installed)).toEqual([false, true, true]);
    expect(hosts[1].cli).toBeNull();
  });
});

describe("codexTargets (one run per profile)", () => {
  const exists = (dirs: string[]) => (p: string) => dirs.map((d) => path.resolve(d)).includes(path.resolve(p));

  it("shared ~/.codex first, then CODEX_HOME, when both profiles exist (account links may point at the shared AGENTS.md)", () => {
    const orca = path.resolve("/apps/orca/codex-accounts/x/home");
    const targets = codexTargets(HOME, { CODEX_HOME: orca }, exists([orca, path.join(HOME, ".codex")]));
    expect(targets).toEqual([path.join(HOME, ".codex"), orca]);
  });

  it("de-duplicates when CODEX_HOME is the default profile", () => {
    const dflt = path.join(HOME, ".codex");
    expect(codexTargets(HOME, { CODEX_HOME: dflt }, exists([dflt]))).toEqual([dflt]);
  });

  it("only existing profiles are targets", () => {
    const orca = path.resolve("/apps/orca/home");
    expect(codexTargets(HOME, { CODEX_HOME: orca }, exists([orca]))).toEqual([orca]);
  });

  it("nothing installed yet → the single default target (CODEX_HOME when set)", () => {
    expect(codexTargets(HOME, {}, () => false)).toEqual([path.join(HOME, ".codex")]);
    const orca = path.resolve("/apps/orca/home");
    expect(codexTargets(HOME, { CODEX_HOME: orca }, () => false)).toEqual([orca]);
  });
});

// Quality review 2026-09-11, finding H67. sync-codex concatenates the style twin that the
// Claude engine regenerates, so a Codex-only run can install a stale twin. Grok already
// pulls Claude in for the same reason; Codex must too.
import { selectHosts } from "../../commands/sync-poneglyph";
describe("host selection respects the twin dependency (H67)", () => {
  const detected = [
    { name: "claude" as const, cli: "claude", targets: ["/h/.claude"], installed: true },
    { name: "codex" as const, cli: "codex", targets: ["/h/.codex"], installed: true },
    { name: "grok" as const, cli: "grok", targets: ["/h/.grok"], installed: true },
  ];

  it("pulls Claude in when only Codex is selected", () => {
    const { selected, notes } = selectHosts(detected, "codex");
    expect(selected.map((h) => h.name)).toEqual(["claude", "codex"]);
    expect(notes.join(" ")).toMatch(/twin|Claude/i);
  });

  it("still pulls Claude in when only Grok is selected", () => {
    expect(selectHosts(detected, "grok").selected.map((h) => h.name)).toEqual(["claude", "grok"]);
  });

  it("does not duplicate Claude when it is already selected", () => {
    expect(selectHosts(detected, "claude,codex").selected.map((h) => h.name)).toEqual(["claude", "codex"]);
  });
});
