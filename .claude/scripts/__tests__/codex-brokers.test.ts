import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { claudeConfigDir, newestVersion, readBrokers, stateRoot } from "../codex-brokers";

describe("plugin data root", () => {
  it("honours the plugin data override and its fallback", () => {
    expect(stateRoot({ CLAUDE_PLUGIN_DATA: "custom-data" })).toBe(join("custom-data", "state"));
    expect(stateRoot({})).toBe(join(tmpdir(), "codex-companion"));
  });
});

describe("finding the plugin, on any machine", () => {
  it("orders versions numerically, not as text", () => {
    // `sort()` alone ranks 1.0.10 below 1.0.9 and would load an older plugin than the one
    // installed — the module whose shape this script depends on.
    expect(newestVersion(["1.0.6", "1.0.10", "1.0.9"])).toBe("1.0.10");
    expect(newestVersion(["2.0.0", "10.0.0"])).toBe("10.0.0");
    expect(newestVersion(["1.2", "1.2.1"])).toBe("1.2.1");
    expect(newestVersion([])).toBeUndefined();
  });

  it("honours CLAUDE_CONFIG_DIR, and falls back to the home directory", () => {
    const moved = join(tmpdir(), "elsewhere");
    expect(claudeConfigDir({ CLAUDE_CONFIG_DIR: moved } as NodeJS.ProcessEnv)).toBe(moved);
    expect(claudeConfigDir({} as NodeJS.ProcessEnv)).toBe(join(homedir(), ".claude"));
  });
});

describe("readBrokers", () => {
  const root = () => mkdtempSync(join(tmpdir(), "brokers-"));

  it("returns nothing when the state root is absent", () => {
    expect(readBrokers(join(tmpdir(), "definitely-not-here-9e1f"))).toEqual([]);
  });

  it("reads a state file and reports liveness, own pid being alive", () => {
    const dir = root();
    mkdirSync(join(dir, "alpha-0123456789abcdef"));
    writeFileSync(join(dir, "alpha-0123456789abcdef", "broker.json"), JSON.stringify({ pid: process.pid, endpoint: "unix:" + join(tmpdir(), "test.sock") }));
    const [broker] = readBrokers(dir);
    expect(broker).toMatchObject({ slug: "alpha-0123456789abcdef", pid: process.pid, alive: true, endpoint: "unix:" + join(tmpdir(), "test.sock") });
  });

  it("skips a directory with no state file and survives a half-written one", () => {
    const dir = root();
    mkdirSync(join(dir, "no-state-dir"));
    mkdirSync(join(dir, "broken-0000000000000000"));
    writeFileSync(join(dir, "broken-0000000000000000", "broker.json"), "{ not json");
    mkdirSync(join(dir, "good-1111111111111111"));
    writeFileSync(join(dir, "good-1111111111111111", "broker.json"), JSON.stringify({ pid: process.pid, endpoint: "unix:" + join(tmpdir(), "ok.sock") }));
    // The good entry must survive both neighbours: a listing that throws is a listing nobody runs.
    expect(readBrokers(dir).map((b) => b.slug)).toEqual(["good-1111111111111111"]);
  });

  it("sorts existing PIDs first without asserting broker identity", () => {
    const dir = root();
    mkdirSync(join(dir, "zzz-dead-0000000000000000"));
    writeFileSync(join(dir, "zzz-dead-0000000000000000", "broker.json"), JSON.stringify({ pid: 2147483646, endpoint: "unix:" + join(tmpdir(), "dead.sock") }));
    mkdirSync(join(dir, "aaa-live-1111111111111111"));
    writeFileSync(join(dir, "aaa-live-1111111111111111", "broker.json"), JSON.stringify({ pid: process.pid, endpoint: "unix:" + join(tmpdir(), "live.sock") }));
    const brokers = readBrokers(dir);
    expect(brokers[0].alive).toBe(true);
    expect(brokers[1].alive).toBe(false);
  });
});
