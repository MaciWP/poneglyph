import { describe, test, expect, afterAll } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { getModifiedFiles, scanFile } from "../security-gate";

// Integration coverage of the security-gate functions exported in-situ.
// Previously these were unexported → untestable by import; only the pure SECRET_PATTERN was covered.

const LONG = "x".repeat(20);
const created: string[] = [];

async function tmpFile(name: string, content: string): Promise<string> {
  const path = join(tmpdir(), `sg-test-${Date.now()}-${name}`);
  await Bun.write(path, content);
  created.push(path);
  return path;
}

afterAll(() => {
  for (const p of created) {
    try {
      unlinkSync(p);
    } catch {
      // best-effort cleanup
    }
  }
});

describe("scanFile (exported in-situ)", () => {
  test("flags a file containing a secret with path:line", async () => {
    const path = await tmpFile("secret.env", `HARMLESS=ok\nAPI_KEY = "${LONG}"\n`);
    const hits = await scanFile(path);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toContain(path);
    expect(hits[0]).toMatch(/:2$/); // secret is on line 2
  });

  test("returns empty for a clean file (env-var indirection)", async () => {
    const path = await tmpFile("clean.ts", "const key = process.env.API_KEY;\n");
    expect(await scanFile(path)).toEqual([]);
  });

  test("returns empty for a non-existent file (best-effort)", async () => {
    expect(await scanFile(join(tmpdir(), "sg-test-does-not-exist-xyz"))).toEqual([]);
  });

  // Regression, not a unit test: this is the exact shape of a work repo's OpenAPI
  // contract (openapi.yaml:95-110), the recurring false positive that motivated the fix.
  test("an OpenAPI contract's example placeholder is not reported", async () => {
    const spec = [
      "openapi: 3.0.3",
      "info:",
      "  title: Acme API",
      "paths:",
      "  /token/verify/:",
      "    post:",
      "      requestBody:",
      "        content:",
      "          application/json:",
      "            examples:",
      "              valid:",
      "                value:",
      "                  token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "",
    ].join("\n");
    const path = await tmpFile("contract.yaml", spec);
    expect(await scanFile(path)).toEqual([]);
  });

  // The other half of the acceptance criterion: excluding specs must not blunt
  // the gate on the files where a real secret actually lives.
  test("a compose file with the same shape IS still reported", async () => {
    const compose = `services:\n  db:\n    environment:\n      POSTGRES_PASSWORD: ${LONG}\n`;
    const path = await tmpFile("compose.yaml", compose);
    const hits = await scanFile(path);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toMatch(/:4$/);
  });

  // types.gen.ts FP class: OpenAPI-generated property types must not fire; a
  // real literal in the same file still must.
  test("generated TS client type fields are not reported; real literals are", async () => {
    const body = [
      "export type TokenRequest = {",
      "  password: string;",
      "  old_password: string;",
      "};",
      `export const leaked = { API_KEY: "${LONG}" };`,
      "",
    ].join("\n");
    const path = await tmpFile("types.gen.ts", body);
    const hits = await scanFile(path);
    expect(hits.length).toBe(1);
    expect(hits[0]).toMatch(/:5$/); // only the API_KEY line
  });
});

describe("getModifiedFiles (exported in-situ)", () => {
  test("returns an array of text-extension paths (no crash on real git state)", async () => {
    const files = await getModifiedFiles();
    expect(Array.isArray(files)).toBe(true);
    // every returned path must be non-empty (function contract)
    for (const f of files) {
      expect(f.length).toBeGreaterThan(0);
    }
  });
});

describe("hook stdin path end-to-end (readHookStdin)", () => {
  // Vehicle: instructions-loaded.ts (auto-approve.ts, the old vehicle, was cut
  // 2026-08-07). Payload without file_path → no log write, pure stdin exercise.
  const stdinHook = join(import.meta.dir, "..", "instructions-loaded.ts");

  async function runWithStdin(input: string): Promise<number> {
    const proc = Bun.spawn(["bun", stdinHook], {
      stdin: new TextEncoder().encode(input),
      stdout: "pipe",
      stderr: "pipe",
    });
    return await proc.exited;
  }

  test("valid JSON payload exits 0 (does not hang)", async () => {
    const code = await runWithStdin(JSON.stringify({ session_id: "s1", memory_type: "User" }));
    expect(code).toBe(0);
  });

  test("empty stdin exits 0 (no-op)", async () => {
    expect(await runWithStdin("")).toBe(0);
  });

  test("malformed JSON exits 0 (handled, no uncaught throw)", async () => {
    expect(await runWithStdin("not-json{{{")).toBe(0);
  });
});

// US4 (plan 028): the Stop response must reach the MODEL (additionalContext),
// not only the user (systemMessage) — CG-05.
import { buildStopResponse } from "../security-gate";

describe("buildStopResponse (028/US4)", () => {
  test("T4.1 hits → systemMessage AND hookSpecificOutput.additionalContext with locus + action", () => {
    const res = buildStopResponse(["src/config.ts:12", ".env.example:3"]);
    expect(res).not.toBeNull();
    expect(res!.systemMessage).toContain("src/config.ts:12");
    expect(res!.hookSpecificOutput.hookEventName).toBe("Stop");
    expect(res!.hookSpecificOutput.additionalContext).toContain("src/config.ts:12");
    expect(res!.hookSpecificOutput.additionalContext.toLowerCase()).toMatch(/verify|redact/);
  });

  test("T4.2 zero hits → null (clean silence, no additionalContext)", () => {
    expect(buildStopResponse([])).toBeNull();
  });
});

import { buildCanaryWarning, checkCanary, extractFinalAssistantText } from "../security-gate";

describe("degradation canary (2026-09-24)", () => {
  const user = (content: string) => JSON.stringify({ type: "user", message: { content } });
  const assistant = (...blocks: object[]) => JSON.stringify({ type: "assistant", message: { content: blocks } });
  const text = (t: string) => ({ type: "text", text: t });
  const tool = { type: "tool_use", name: "Bash", input: { command: "ls" } };

  test("an answer whose last line starts with ROBIN: is ok, whitespace allowed", () => {
    expect(checkCanary("ROBIN: Hecho.")).toBe("ok");
    expect(checkCanary("Pasan los tests.\n  ROBIN: Hecho.\n\n")).toBe("ok");
  });

  test("a missing, early, lowercased or decorated closing line is a miss", () => {
    expect(checkCanary("Hecho.")).toBe("miss");
    expect(checkCanary("ROBIN: Hecho.\nY un detalle más.")).toBe("miss");
    expect(checkCanary("Detalle.\noriol: Hecho.")).toBe("miss");
    expect(checkCanary("Detalle.\n**ROBIN:** Hecho.")).toBe("miss");
    expect(checkCanary("Hecho. ROBIN:")).toBe("miss");
  });

  test("no text this turn yields no verdict", () => {
    expect(checkCanary(null)).toBeNull();
    expect(checkCanary("   ")).toBeNull();
  });

  test("the final text block of the current turn is the one checked", () => {
    const jsonl = [user("old"), assistant(text("ROBIN: old answer")), user("new"), assistant(text("interim")), assistant(tool), assistant(text("final"))].join("\n");
    expect(extractFinalAssistantText(jsonl)).toBe("final");
  });

  test("a tool-only turn never reads the previous turn's answer", () => {
    const jsonl = [user("old"), assistant(text("ROBIN: old answer")), user("new"), assistant(tool)].join("\n");
    expect(extractFinalAssistantText(jsonl)).toBeNull();
  });

  test("tool_result user entries do not end the turn; malformed lines are skipped", () => {
    const toolResult = JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", content: "x" }] } });
    const jsonl = [user("new"), assistant(text("ROBIN: final")), "{not json", toolResult].join("\n");
    expect(extractFinalAssistantText(jsonl)).toBe("ROBIN: final");
  });

  test("the warning reaches the user only and carries the transcript size", () => {
    const w = buildCanaryWarning(812);
    expect(w.systemMessage).toContain("ROBIN:");
    expect(w.systemMessage).toContain("812 KB");
    expect(Object.keys(w)).toEqual(["systemMessage"]);
  });
});
