#!/usr/bin/env bun
// bun .claude/scripts/budget.ts [--update]
// Prints the always-loaded budget table (and per-skill bodies with --bodies); --update
// rewrites the ratchet snapshot after a deliberate size decision (plan 032/WP4).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compare, loadSnapshot, measure, renderTable, saveSnapshot } from "./lib/budget";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const snapshotDir = join(here, "lib");

const args = new Set(process.argv.slice(2));
const current = measure(repoRoot);
const snapshot = loadSnapshot(snapshotDir);

console.log(renderTable(current, snapshot));

if (args.has("--bodies")) {
  console.log("\n| Skill | SKILL.md bytes | Snapshot |\n|---|---|---|");
  for (const [k, v] of Object.entries(current.skillBodies).sort((a, b) => b[1] - a[1])) {
    console.log(`| ${k} | ${v} | ${snapshot?.skillBodies[k] ?? "—"} |`);
  }
}

if (args.has("--update")) {
  console.log(`\nSnapshot written: ${saveSnapshot(snapshotDir, current)}`);
  process.exit(0);
}

if (snapshot) {
  const violations = compare(current, snapshot);
  if (violations.length > 0) {
    console.log("\n🔴 Over budget (snapshot + 5 %):");
    for (const v of violations) console.log(`   - ${v.key}: ${v.snapshot} → ${v.current}`);
    console.log("   Reduce, or ratify the growth with `bun .claude/scripts/budget.ts --update`.");
    process.exit(1);
  }
  console.log("\n🟢 Within budget");
} else {
  console.log("\n🟡 No snapshot yet — run with --update to set the ratchet");
}
