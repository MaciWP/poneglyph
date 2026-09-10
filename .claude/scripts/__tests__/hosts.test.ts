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

  it("CODEX_HOME first, then ~/.codex, when both profiles exist", () => {
    const orca = path.resolve("/apps/orca/codex-accounts/x/home");
    const targets = codexTargets(HOME, { CODEX_HOME: orca }, exists([orca, path.join(HOME, ".codex")]));
    expect(targets).toEqual([orca, path.join(HOME, ".codex")]);
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
