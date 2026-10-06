import { afterAll, describe, test, expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatLogLine, appendLog } from "../instructions-loaded";

describe("post-compaction language reminder", () => {
  const script = join(import.meta.dir, "..", "instructions-loaded.ts");
  const payload = {
    session_id: "compact-session",
    transcript_path: "/project/transcript.jsonl",
    cwd: "/project",
    permission_mode: "default",
    hook_event_name: "SessionStart",
    source: "compact",
  };

  function run(input: unknown) {
    return Bun.spawnSync([process.execPath, script], {
      stdin: Buffer.from(JSON.stringify(input)),
      stdout: "pipe",
      stderr: "pipe",
    });
  }

  test("SessionStart compact emits exactly the documented context envelope", () => {
    const result = run(payload);
    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toBe("");
    expect(result.stdout.toString()).toBe(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "Follow the language rule in .claude/output-styles/poneglyph.md: every user-visible text must be in es-ES de España.",
      },
    }) + "\n");
  });

  test("other sources and events inject nothing", () => {
    for (const input of [
      ...["startup", "resume", "clear", "fork", undefined].map(source => ({ ...payload, source })),
      { ...payload, hook_event_name: "InstructionsLoaded", load_reason: "compact" },
      { ...payload, hook_event_name: "PostCompact" },
      { source: "compact" },
    ]) {
      const result = run(input);
      expect(result.exitCode).toBe(0);
      expect(result.stderr.toString()).toBe("");
      expect(result.stdout.toString()).toBe("");
    }
  });

  test("global settings register the compact reminder without making telemetry synchronous", () => {
    const settings = JSON.parse(readFileSync(join(import.meta.dir, "../../settings.global.json"), "utf8"));
    const command = 'bun "$HOME/.claude/hooks/instructions-loaded.ts"';
    expect(settings.hooks.SessionStart).toEqual([
      { matcher: "compact", hooks: [{ type: "command", command, timeout: 10 }] },
    ]);
    expect(settings.hooks.InstructionsLoaded[0].hooks[0].async).toBe(true);
  });
});

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
