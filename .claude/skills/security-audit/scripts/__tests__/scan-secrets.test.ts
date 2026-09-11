import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Quality review 2026-09-11, findings H17 and H54. Black-box: the script exports nothing,
// so the contract is exercised through its real CLI, exactly as the skill advertises it.
// The fixture value is assembled at runtime so no literal secret lives in this file.
const VALUE = ["AKIA", "Z".repeat(12), "0123456789"].join("");
const SCRIPT = join(import.meta.dir, "..", "scan-secrets.ts");

const root = mkdtempSync(join(tmpdir(), "scan-secrets-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

async function scan(dir: string): Promise<{ stdout: string; code: number }> {
  const proc = Bun.spawn(["bun", SCRIPT, dir], { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { stdout: stdout + stderr, code: await proc.exited };
}

describe("scan-secrets CLI", () => {
  it("H54 — scans a .env file, which is where real secrets live", async () => {
    const dir = join(root, "env-case");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".env"), `API_KEY=${VALUE}\n`, "utf8");
    const { stdout } = await scan(dir);
    expect(stdout).toContain(".env");
  });

  it("H54 — scans a dotted .env variant (.env.local)", async () => {
    const dir = join(root, "env-local-case");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".env.local"), `API_KEY=${VALUE}\n`, "utf8");
    const { stdout } = await scan(dir);
    expect(stdout).toContain(".env.local");
  });

  it("H17 — never prints the matched secret value", async () => {
    const dir = join(root, "redaction-case");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.ts"), `const API_KEY = "${VALUE}";\n`, "utf8");
    const { stdout } = await scan(dir);
    expect(stdout).toContain("config.ts");
    expect(stdout).not.toContain(VALUE);
  });

  it("H17 — still reports the finding type and location after redaction", async () => {
    const dir = join(root, "shape-case");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.ts"), `\nconst API_KEY = "${VALUE}";\n`, "utf8");
    const { stdout } = await scan(dir);
    expect(stdout).toMatch(/config\.ts/);
    expect(stdout).toMatch(/\b2\b/);
  });
});
