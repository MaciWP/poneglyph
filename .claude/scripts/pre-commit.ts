#!/usr/bin/env bun
// The same hook can serve the core and an addon. No copied validator in the addon.
import { resolve } from "node:path";
import { check, render } from "./check-config";

try {
  const { report, terms } = check(process.cwd(), true);
  console.log(render(report, terms));
  if (report.findings.some(f => f.severity === "error")) process.exit(1);
  if (report.kind === "core") {
    // Keep the existing project tests. They test working source; check() above
    // independently validates exactly the staged configuration snapshot.
    const tests = Bun.spawnSync([process.execPath, "test", "./.claude/"], { cwd: process.cwd(), stdout: "inherit", stderr: "inherit" });
    if (tests.exitCode !== 0) process.exit(tests.exitCode || 1);
    if (Bun.which("claude")) {
      const validation = Bun.spawnSync(["claude", "plugin", "validate", resolve(".claude")], { stdout: "inherit", stderr: "inherit" });
      if (validation.exitCode !== 0) process.exit(validation.exitCode || 1);
    } else console.warn("Claude CLI unavailable: native plugin validation was not run.");
  }
} catch {
  console.error("Pre-commit validation could not complete. Private details withheld. Commit blocked.");
  process.exitCode = 2;
}
