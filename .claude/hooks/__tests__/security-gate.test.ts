import { afterAll, describe, test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  codeLineHasSecret,
  lineHasSecret,
  hasTextExtension,
  isOrchestrationPath,
  isApiSpecDocument,
  shouldSkipStopHook,
  readTurnFacts,
  filesChangedSince,
} from "../security-gate";
import { readTranscriptTail } from "../lib/transcript";

// Fake values built at runtime so no literal secret lives in this file.
const LONG = "x".repeat(20);

describe("hasTextExtension", () => {
  test("accepts scannable text extensions (where real secrets live)", () => {
    for (const f of ["a.ts", "a.js", "a.json", "a.env", "a.yaml", "a.yml"]) {
      expect(hasTextExtension(f)).toBe(true);
    }
  });
  test("does NOT scan .md, docs/examples/reports carry illustrative secrets, not real ones", () => {
    expect(hasTextExtension("README.md")).toBe(false);
    expect(hasTextExtension(".claude/skills/django-architecture/references/service-patterns.md")).toBe(false);
    expect(hasTextExtension("reports/review-pr-body.md")).toBe(false);
    expect(hasTextExtension("README.MD")).toBe(false); // case-insensitive too
  });
  test("rejects binary / non-text extensions", () => {
    for (const f of ["a.png", "a.exe", "a.lock", "a.zip"]) {
      expect(hasTextExtension(f)).toBe(false);
    }
  });
  test("rejects files with no extension", () => {
    expect(hasTextExtension("Makefile")).toBe(false);
    expect(hasTextExtension("LICENSE")).toBe(false);
  });
  test("is case-insensitive on the extension", () => {
    expect(hasTextExtension("config.JSON")).toBe(true);
    expect(hasTextExtension("App.TS")).toBe(true);
  });
});

describe("SECRET_PATTERN: uppercase KEY=value", () => {
  test("flags API_KEY with a 16+ char value", () => {
    expect(lineHasSecret(`API_KEY = "${LONG}"`)).toBe(true);
  });
  test("flags TOKEN with a colon separator", () => {
    expect(lineHasSecret(`TOKEN: "${LONG}"`)).toBe(true);
  });
  test("does NOT flag a short value", () => {
    expect(lineHasSecret("TOKEN=abc")).toBe(false);
  });
});

describe("SECRET_PATTERN_CI: lowercase credentials", () => {
  test("flags password with an 8+ char value", () => {
    expect(lineHasSecret(`password=${"y".repeat(12)}`)).toBe(true);
  });
  test("flags access_token", () => {
    expect(lineHasSecret(`access_token = ${"z".repeat(10)}`)).toBe(true);
  });
  test("does NOT flag a short password", () => {
    expect(lineHasSecret("password = short")).toBe(false);
  });
});

// Measured FP class (a frontend repo's generated types.gen.ts, 2026-08 and prior): SECRET_PATTERN_CI's
// `.{8,}` treats `password: string;` as a credential because ` string;` is ≥8 chars.
// Same shape appears in hand-written interfaces, Zod schemas, and Django field defs,
// not only generated clients. Fix filters type/schema RHS; values stay flagged.
describe("type/schema annotations are NOT secrets (types.gen.ts FP class)", () => {
  test("TS property: password: string;", () => {
    expect(lineHasSecret("    password: string;")).toBe(false);
  });
  test("TS property: old_password: string; (OpenAPI client shape)", () => {
    expect(lineHasSecret("    old_password: string;")).toBe(false);
  });
  test("TS union: password: string | null;", () => {
    expect(lineHasSecret("    password: string | null;")).toBe(false);
  });
  test("named type: access_token: AccessToken;", () => {
    expect(lineHasSecret("    access_token: AccessToken;")).toBe(false);
  });
  test("Zod builder: password: z.string().min(8),", () => {
    expect(lineHasSecret("    password: z.string().min(8),")).toBe(false);
  });
  test("Django field: password: models.CharField(max_length=128),", () => {
    expect(lineHasSecret("    password: models.CharField(max_length=128),")).toBe(false);
  });
  test("quoted literal still flags (value, not type)", () => {
    expect(lineHasSecret(`password = "${"y".repeat(12)}"`)).toBe(true);
  });
  test("bare long token still flags (compose / .env shape)", () => {
    expect(lineHasSecret(`password = ${"y".repeat(12)}`)).toBe(true);
  });
});

describe("isOrchestrationPath: exclude the .claude/ orchestration tree", () => {
  test("excludes hooks (the self-matching false-positive case)", () => {
    expect(isOrchestrationPath(".claude/hooks/security-gate.ts")).toBe(true);
    expect(isOrchestrationPath(".claude/hooks/__tests__/security-gate.test.ts")).toBe(true);
  });
  test("excludes skills, references, examples, templates (any extension)", () => {
    expect(isOrchestrationPath(".claude/skills/django-architecture/references/service-patterns.md")).toBe(true);
    expect(isOrchestrationPath(".claude/skills/multi-tenant-guardian/examples/auth_token_mixin_pattern.md")).toBe(true);
    expect(isOrchestrationPath(".claude/skills/foo/templates/config.yaml")).toBe(true);
  });
  test("excludes settings (documented tradeoff, tool config, not business code)", () => {
    expect(isOrchestrationPath(".claude/settings.json")).toBe(true);
  });
  test("does NOT exclude business code, detection there is untouched", () => {
    expect(isOrchestrationPath("src/auth/middleware.ts")).toBe(false);
    expect(isOrchestrationPath("acme/settings.py")).toBe(false);
    expect(isOrchestrationPath(".env")).toBe(false);
    expect(isOrchestrationPath("config.yaml")).toBe(false);
  });
  test("does NOT exclude a 'claude' dir that isn't .claude", () => {
    expect(isOrchestrationPath("src/claude/client.ts")).toBe(false);
    expect(isOrchestrationPath("claude.ts")).toBe(false);
  });
});

describe("isApiSpecDocument: API contracts are examples by nature", () => {
  test("recognises an OpenAPI document (unquoted key and version)", () => {
    expect(isApiSpecDocument("openapi: 3.0.3\ninfo:\n  title: Acme API\n")).toBe(true);
  });
  test("recognises a Swagger 2 document (quoted version)", () => {
    expect(isApiSpecDocument('swagger: "2.0"\ninfo:\n  title: legacy\n')).toBe(true);
  });
  test("recognises a JSON-style quoted root key", () => {
    expect(isApiSpecDocument('"openapi": "3.0.3"\n')).toBe(true);
  });

  test("does NOT recognise docker-compose, where a real secret lives", () => {
    const compose = "services:\n  db:\n    environment:\n      POSTGRES_PASSWORD: hunter2verylongvalue\n";
    expect(isApiSpecDocument(compose)).toBe(false);
  });
  test("does NOT recognise a Helm values.yaml", () => {
    expect(isApiSpecDocument("replicaCount: 1\nimage:\n  tag: latest\n")).toBe(false);
  });
  test("does NOT recognise a tooling config pointing AT a spec (path, not version)", () => {
    expect(isApiSpecDocument("openapi: ./contract/spec.yaml\n")).toBe(false);
  });
  test("does NOT recognise an indented key, the spec version is a root key", () => {
    expect(isApiSpecDocument("apis:\n  main:\n    openapi: 3.0.3\n")).toBe(false);
  });

  test("scope changed, detector did NOT: the placeholder line still reads as a secret", () => {
    // Guards the fix from degrading into "we weakened SECRET_PATTERN".
    expect(lineHasSecret("                  token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")).toBe(true);
  });
});

// The measured false positives of a TS web app (2026-10-05), one per class, and the code
// leaks that must still be reported.
describe("secrets in TS/JS code", () => {
  test("dataflow is not a value: identifiers, member access, calls, signatures", () => {
    for (const line of [
      "else env.ANTHROPIC_API_KEY = auth.key;",
      "    accessToken: t.access_token,",
      '  const clientSecret = await getSecret("atlassian.client_secret");',
      "        refresh_token: bundle.refreshToken,",
      "export async function listResources(accessToken: string): Promise<Resource[]> {",
      '  return JSON.stringify({ accessToken: access, refreshToken: refresh, expiresAt, scope: "" });',
      '  put(join(claude, "auth.json"), \'{"secret": true}\');',
      '    throw new Error("Missing anthropic.api_key: run `bun run secrets:set anthropic.api_key`");',
    ])
      expect([line, codeLineHasSecret(line)]).toEqual([line, false]);
  });

  test("decoys, key names and short templates are not credentials", () => {
    for (const line of [
      'process.env.ANTHROPIC_API_KEY = "sk-ant-decoy-must-not-be-used";',
      'const TOKEN = "gho_FAKE_TOKEN_never_shown";',
      '  process.env.ANTHROPIC_API_KEY = "fake-parent-key";',
      '  const name = auth === "subscription" ? "claude.oauth_token" : "anthropic.api_key";',
      "      access_token: `a${rotation}`,",
    ])
      expect([line, codeLineHasSecret(line)]).toEqual([line, false]);
  });

  test("a literal credential in code is still reported", () => {
    const key = `sk-ant-api03-${"Ab3".repeat(10)}`;
    for (const line of [
      `const API_KEY = "${key}";`,
      `  password: '${"Summer2026!x"}',`,
      `headers.TOKEN = "ghp_${"Zq9".repeat(12)}";`,
      `export const leaked = { API_KEY: "${LONG}" };`,
      // Joined words are a password as much as a name, unless they name a credential.
      'const password = "synthetic-fixture-value";',
      '  process.env.ANTHROPIC_API_KEY = "parent-conflict";',
      // An unterminated literal still counts: the value runs to the end of the line.
      `const SECRET = \`${key}`,
    ])
      expect([line, codeLineHasSecret(line)]).toEqual([line, true]);
  });

  test("outside code the line rule is unchanged: an unquoted value is the value", () => {
    expect(lineHasSecret("ANTHROPIC_API_KEY=parent-conflict")).toBe(true);
  });
});

describe("clean code", () => {
  test("no detection for env-var indirection", () => {
    expect(lineHasSecret("const key = process.env.API_KEY")).toBe(false);
  });
  test("stateful /g regex resets between calls", () => {
    const line = `SECRET = "${LONG}"`;
    expect(lineHasSecret(line)).toBe(true);
    // Would be false on the 2nd call if lastIndex were not reset, guards the gotcha.
    expect(lineHasSecret(line)).toBe(true);
  });
});

describe("readTurnFacts: when the turn started and whether it ends waiting", () => {
  const user = (content: string, timestamp = "2026-10-09T10:00:00.000Z") => JSON.stringify({ type: "user", timestamp, message: { content } });
  const call = (name: string, input: object = {}) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });

  test("takes the timestamp of the turn's prompt, not an earlier one", () => {
    const jsonl = [user("old", "2026-10-09T09:00:00.000Z"), call("Agent"), user("new"), call("Bash", { command: "ls" })].join("\n");
    expect(readTurnFacts(jsonl)).toEqual({ startedAt: Date.parse("2026-10-09T10:00:00.000Z"), waiting: false });
  });

  test("a turn that launched an agent, a workflow or a background command ends waiting", () => {
    for (const c of [call("Agent"), call("Workflow"), call("Bash", { command: "bun test", run_in_background: true })]) {
      expect(readTurnFacts([user("revisa"), c].join("\n")).waiting).toBe(true);
    }
  });

  test("a task-notification turn ends waiting; tool results and subagent events do not start a turn", () => {
    const toolResult = JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", content: "x" }] } });
    const sidechain = JSON.stringify({ type: "user", isSidechain: true, message: { content: "sub prompt" } });
    expect(readTurnFacts([user("<task-notification>\n<status>completed</status>"), toolResult, sidechain].join("\n")).waiting).toBe(true);
  });

  test("a prompt outside the tail gives an unknown start", () => {
    expect(readTurnFacts(["{cut line", call("Bash", { command: "ls" })].join("\n"))).toEqual({ startedAt: null, waiting: false });
  });
});

describe("filesChangedSince: the secret scan covers this turn's writes only", () => {
  const dir = mkdtempSync(join(tmpdir(), "poneglyph-since-test-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test("keeps files written after the turn start, drops older, missing and >1 MB files", async () => {
    const [old, fresh, big] = ["old.ts", "fresh.ts", "big.json"].map((f) => join(dir, f));
    await Bun.write(old, "x");
    const start = Date.now() + 2000;
    await Bun.write(fresh, "x");
    await Bun.write(big, "x".repeat(1024 * 1024 + 1));
    const { utimesSync } = await import("node:fs");
    utimesSync(fresh, new Date(start + 1000), new Date(start + 1000));
    utimesSync(big, new Date(start + 1000), new Date(start + 1000));
    expect(await filesChangedSince([old, fresh, big, join(dir, "gone.ts")], start)).toEqual([fresh]);
  });

  test("an unknown turn start keeps every dirty file under the size cap", async () => {
    const f = join(dir, "any.ts");
    await Bun.write(f, "x");
    expect(await filesChangedSince([f], null)).toEqual([f]);
  });
});

describe("stop_hook_active re-entry guard", () => {
  test("active stop-hook continuation is skipped", () => {
    expect(shouldSkipStopHook({ stop_hook_active: true })).toBe(true);
  });

  test("normal Stop payloads are processed", () => {
    expect(shouldSkipStopHook({ stop_hook_active: false })).toBe(false);
    expect(shouldSkipStopHook({})).toBe(false);
    expect(shouldSkipStopHook(null)).toBe(false);
    expect(shouldSkipStopHook("not-an-object")).toBe(false);
  });
});

describe("readTranscriptTail: bounded read, never the whole file", () => {
  const dir = mkdtempSync(join(tmpdir(), "poneglyph-transcript-test-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test("large file: returns at most maxBytes, keeping the end", async () => {
    const path = `${dir}/sg-tail-large.jsonl`;
    const filler = `${"x".repeat(99)}\n`.repeat(3000); // ~300KB
    await Bun.write(path, filler + "LAST_LINE_MARKER\n");
    const tail = await readTranscriptTail(path, 64 * 1024);
    expect(tail.length).toBeLessThanOrEqual(64 * 1024);
    expect(tail).toContain("LAST_LINE_MARKER");
    expect(tail.length).toBeGreaterThan(63 * 1024); // actually read the window, not a sliver
  });

  test("small file: returns the whole content", async () => {
    const path = `${dir}/sg-tail-small.jsonl`;
    await Bun.write(path, "only line\n");
    expect(await readTranscriptTail(path, 64 * 1024)).toBe("only line\n");
  });
});

describe("secret detection: key shapes and file shapes", () => {
  const SECRET = "y".repeat(24);

  test("matches a quoted JSON key, which .json files always use", () => {
    expect(lineHasSecret(`  "password": "${SECRET}",`)).toBe(true);
  });

  test("matches a quoted YAML/JSON api_key", () => {
    expect(lineHasSecret(`  "api_key": "${SECRET}"`)).toBe(true);
  });

  test("still matches the unquoted env form", () => {
    expect(lineHasSecret(`API_KEY=${SECRET}`)).toBe(true);
  });

  test("still ignores a line with no credential", () => {
    expect(lineHasSecret(`  "timeout": 30000,`)).toBe(false);
  });

  test("accepts dotted .env variants", () => {
    for (const f of [".env.local", ".env.production", "app/.env.development"]) {
      expect(hasTextExtension(f)).toBe(true);
    }
  });
});
