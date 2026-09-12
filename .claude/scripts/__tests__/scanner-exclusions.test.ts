import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test.each([
  "review-patterns/scripts/complexity-report.ts",
  "review-patterns/scripts/find-n-plus-one.ts",
  "security-audit/scripts/scan-secrets.ts",
])("scanner excludes dependency directories: %s", async script => {
  const root = mkdtempSync(join(tmpdir(), "scanner-path-"));
  mkdirSync(join(root, "node_modules"));
  const source = 'for (const item of items) { await db.query(item); }\nconst key = "' + ["AKIA", "Z".repeat(16)].join("") + '";\n';
  writeFileSync(join(root, "app.ts"), source);
  writeFileSync(join(root, "node_modules", "dependency.ts"), source);
  const proc = Bun.spawn([process.execPath, join(import.meta.dir, "../../skills", script), root], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  expect(code).toBe(0);
  expect(err).toBe("");
  expect(out).toContain("app.ts");
  expect(out).not.toContain("dependency.ts");
});
