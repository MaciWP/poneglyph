import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  isLiveOrcaVerdictFile,
  isOrcaScanNoise,
  scanDir,
} from "../sync-orca.ts";

describe("isOrcaScanNoise", () => {
  it("flags backups and last-status", () => {
    expect(isOrcaScanNoise("orca-data.json.bak")).toBe(true);
    expect(isOrcaScanNoise("orca-data.json.bak.3")).toBe(true);
    expect(isOrcaScanNoise("last-status.json")).toBe(true);
  });

  it("lets the live profile through", () => {
    expect(isOrcaScanNoise("orca-data.json")).toBe(false);
  });
});

describe("isLiveOrcaVerdictFile", () => {
  it("only orca-data.json decides the semaphore", () => {
    expect(isLiveOrcaVerdictFile("/profiles/local/orca-data.json")).toBe(true);
    expect(isLiveOrcaVerdictFile("/agent-hooks/last-status.json")).toBe(false);
    expect(isLiveOrcaVerdictFile("/profiles/local/orca-data.json.bak.0")).toBe(
      false,
    );
  });
});

describe("scanDir ignores noise even when they contain the flag", () => {
  const flag = "--append-system-prompt-file";
  const expected = `${flag} /tmp/poneglyph-sp.md`;

  it("live clean + bak dirty → no hits", () => {
    const root = join(tmpdir(), `orca-scan-${Date.now()}-clean`);
    mkdirSync(join(root, "profiles", "local"), { recursive: true });
    writeFileSync(join(root, "profiles", "local", "orca-data.json"), '{"ok":1}');
    writeFileSync(
      join(root, "profiles", "local", "orca-data.json.bak.0"),
      expected,
    );
    writeFileSync(join(root, "last-status.json"), expected);
    const hits = scanDir(root, expected, flag);
    expect(hits).toEqual([]);
  });

  it("live dirty → one hit on the live file only", () => {
    const root = join(tmpdir(), `orca-scan-${Date.now()}-dirty`);
    mkdirSync(join(root, "profiles", "local"), { recursive: true });
    const live = join(root, "profiles", "local", "orca-data.json");
    writeFileSync(live, `args: ${expected}`);
    writeFileSync(
      join(root, "profiles", "local", "orca-data.json.bak.1"),
      expected,
    );
    const hits = scanDir(root, expected, flag);
    expect(hits).toEqual([{ file: live, exact: true }]);
  });
});
