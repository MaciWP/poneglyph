import { afterAll, describe, test, expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatLogLine, appendLog } from "../instructions-loaded";

describe("formatLogLine", () => {
  const now = new Date("2026-08-05T12:00:00.000Z");

  test("full payload formats one space-separated line", () => {
    const line = formatLogLine(
      { session_id: "s1", memory_type: "project", load_reason: "startup", file_path: "/x/CLAUDE.md" },
      now,
    );
    expect(line).toBe("2026-08-05T12:00:00.000Z s1 project startup /x/CLAUDE.md");
  });

  test("missing optional fields fall back to placeholders", () => {
    const line = formatLogLine({ file_path: "/x/rules/a.md" }, now);
    expect(line).toBe("2026-08-05T12:00:00.000Z unknown ? ? /x/rules/a.md");
  });

  test("missing or empty file_path yields null (nothing to log)", () => {
    expect(formatLogLine({}, now)).toBeNull();
    expect(formatLogLine({ file_path: "" }, now)).toBeNull();
    expect(formatLogLine({ file_path: 42 as unknown as string }, now)).toBeNull();
  });
});

describe("appendLog", () => {
  const scratch = mkdtempSync(join(tmpdir(), "poneglyph-log-test-"));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));
  test("creates parent dirs and appends lines", () => {
    const logPath = join(scratch, "nested", "instructions-loaded.log");
    appendLog("line one", logPath);
    appendLog("line two", logPath);
    expect(readFileSync(logPath, "utf8")).toBe("line one\nline two\n");
  });
});
