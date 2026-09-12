import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBrokers, stateDirName } from "../codex-brokers";

describe("stateDirName — must match the plugin's own resolveStateDir", () => {
  it("is the workspace basename plus 16 hex characters", () => {
    const name = stateDirName(join(tmpdir(), "some-workspace"));
    expect(name).toMatch(/^some-workspace-[0-9a-f]{16}$/);
  });

  it("is stable for one path and different for another", () => {
    const a = join(tmpdir(), "alpha-workspace");
    const b = join(tmpdir(), "beta-workspace");
    expect(stateDirName(a)).toBe(stateDirName(a));
    expect(stateDirName(a)).not.toBe(stateDirName(b));
  });

  it("sanitises a basename that is not slug-safe, and never yields a bare hash", () => {
    expect(stateDirName(join(tmpdir(), "we ird@name"))).toMatch(/^we-ird-name-[0-9a-f]{16}$/);
  });

  it("normalises a relative path before hashing, on every platform", () => {
    // The plugin hashes a resolved path. Hashing the string as typed made a path miss its own
    // broker and report that nothing pinned the directory — the opposite of the truth.
    expect(stateDirName("some-workspace")).toBe(stateDirName(join(process.cwd(), "some-workspace")));
  });

  // Backslashes only separate paths on Windows; on POSIX `D:\PYTHON\x` is one file name, so
  // this equivalence is a Windows claim and is asserted only there.
  it.skipIf(process.platform !== "win32")("gives one answer whichever separator was typed", () => {
    expect(stateDirName("D:/PYTHON/some-workspace")).toBe(stateDirName("D:\\PYTHON\\some-workspace"));
    // A directory that no longer exists must still resolve: that is exactly when this is needed.
    expect(stateDirName("D:/PYTHON/deleted-9e1f")).toBe(stateDirName("D:\\PYTHON\\deleted-9e1f"));
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
    writeFileSync(join(dir, "alpha-0123456789abcdef", "broker.json"), JSON.stringify({ pid: process.pid, endpoint: "pipe:test" }));
    const [broker] = readBrokers(dir);
    expect(broker).toMatchObject({ slug: "alpha-0123456789abcdef", pid: process.pid, alive: true, endpoint: "pipe:test" });
  });

  it("skips a directory with no state file and survives a half-written one", () => {
    const dir = root();
    mkdirSync(join(dir, "no-state-dir"));
    mkdirSync(join(dir, "broken-0000000000000000"));
    writeFileSync(join(dir, "broken-0000000000000000", "broker.json"), "{ not json");
    mkdirSync(join(dir, "good-1111111111111111"));
    writeFileSync(join(dir, "good-1111111111111111", "broker.json"), JSON.stringify({ pid: process.pid, endpoint: "pipe:ok" }));
    // The good entry must survive both neighbours: a listing that throws is a listing nobody runs.
    expect(readBrokers(dir).map((b) => b.slug)).toEqual(["good-1111111111111111"]);
  });

  it("sorts running brokers first — they are the ones that pin a directory", () => {
    const dir = root();
    mkdirSync(join(dir, "zzz-dead-0000000000000000"));
    writeFileSync(join(dir, "zzz-dead-0000000000000000", "broker.json"), JSON.stringify({ pid: 2147483646, endpoint: "pipe:dead" }));
    mkdirSync(join(dir, "aaa-live-1111111111111111"));
    writeFileSync(join(dir, "aaa-live-1111111111111111", "broker.json"), JSON.stringify({ pid: process.pid, endpoint: "pipe:live" }));
    const brokers = readBrokers(dir);
    expect(brokers[0].alive).toBe(true);
    expect(brokers[1].alive).toBe(false);
  });
});
