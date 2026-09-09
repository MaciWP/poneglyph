import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import { hookFilePlan, installHookFile, mergeNativeHooks, nativeHookConfig } from "../lib/native-hooks";
import { grokConfigPlan } from "../sync-grok";

describe("host-owned configuration preservation", () => {
  it("preserves foreign handlers and group metadata through repeated sync", () => {
    const foreign = { description: "User settings", hooks: {
      PreToolUse: [{ matcher: "Bash", timeout: 42, hooks: [{ type: "command", command: "local-integration" }] }],
      SessionStart: [{ hooks: [{ type: "command", command: "session-integration" }] }],
    } };
    const desired = nativeHookConfig("codex", "/source with spaces/poneglyph");
    const result = mergeNativeHooks(foreign, desired);
    expect(result.hooks.PreToolUse[0]).toEqual(foreign.hooks.PreToolUse[0]);
    expect(result.hooks.SessionStart).toEqual(foreign.hooks.SessionStart);
    expect(result.description).toBe(foreign.description);
    expect(mergeNativeHooks(result, desired)).toEqual(result);
    const removed = mergeNativeHooks(result, desired, false);
    expect(removed.hooks.PreToolUse).toEqual(foreign.hooks.PreToolUse);
    expect(removed.hooks.SessionStart).toEqual(foreign.hooks.SessionStart);
    expect(removed.hooks.Stop).toEqual([]);
    expect(foreign.hooks.PreToolUse).toHaveLength(1);
  });

  it("rejects malformed settings and a previous core's hook before overwriting", () => {
    const desired = nativeHookConfig("codex", "/new-core");
    expect(() => mergeNativeHooks({ hooks: { Stop: {} } }, desired)).toThrow();
    expect(() => mergeNativeHooks(nativeHookConfig("codex", "/old-core"), desired)).toThrow("different Poneglyph");
    expect(() => nativeHookConfig("codex", "/unsafe$root")).toThrow("quoted");
  });

  it("writes a native hook file once and preserves its bytes on subsequent sync", () => {
    const dir = mkdtempSync(join(tmpdir(), "native-hook-config-"));
    const file = join(dir, "hooks.json");
    const desired = nativeHookConfig("grok", "/source");
    expect(hookFilePlan(file, desired).status).toBe("missing");
    installHookFile(file, desired);
    const before = readFileSync(file, "utf8");
    expect(Object.keys(JSON.parse(before).hooks)).toEqual(["PreToolUse"]);
    expect(hookFilePlan(file, desired).status).toBe("linked");
    installHookFile(file, desired);
    expect(readFileSync(file, "utf8")).toBe(before);
    writeFileSync(file, "{broken");
    expect(() => installHookFile(file, desired)).toThrow();
    expect(readFileSync(file, "utf8")).toBe("{broken");
  });

  it("owns Grok's inherited-hook flag and the context policy, preserves the rest, and becomes byte-stable", () => {
    const original = '[permissions]\nmode = "ask"\n[compat.claude]\nskills = true\nhooks = true\n[plugins]\npaths = ["custom"]\n';
    const result = grokConfigPlan(original);
    expect(result.changed).toBe(true);
    const before = parse(original) as any;
    before.compat.claude.hooks = false;
    before.models = { default_reasoning_effort: "high" };
    before.model = { "grok-4.6": { context_window: 500000 } };
    before.session = { auto_compact_threshold_percent: 40 };
    expect(parse(result.content)).toEqual(before);
    expect(grokConfigPlan(result.content)).toEqual({ changed: false, content: result.content });
  });
});
