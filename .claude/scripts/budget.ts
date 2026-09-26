#!/usr/bin/env bun
// bun .claude/scripts/budget.ts [--bodies] [--update | --tighten]
// Prints the always-loaded budget table (and per-skill bodies with --bodies); --update
// rewrites the ratchet snapshot after a deliberate size decision (plan 032/WP4); --tighten
// only lowers it, locking every saving the measurement shows.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compare, loadSnapshot, measure, renderTable, saveSnapshot, slack, tighten } from "./lib/budget";

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

if (args.has("--tighten")) {
  if (!snapshot) {
    console.log("\n🔴 No snapshot to tighten — run with --update to set the ratchet");
    process.exit(1);
  }
  const locked = slack(current, snapshot);
  if (locked.length === 0) {
    console.log("\n🟢 Nothing to tighten");
    process.exit(0);
  }
  for (const v of locked) console.log(`   - ${v.key}: ${v.snapshot} → ${v.current}`);
  console.log(`\nSnapshot tightened: ${saveSnapshot(snapshotDir, tighten(current, snapshot))}`);
  process.exit(0);
}

if (snapshot) {
  const violations = compare(current, snapshot);
  if (violations.length > 0) {
    console.log("\n🔴 Over budget (snapshot, 0 % growth allowed — plan 037):");
    for (const v of violations) console.log(`   - ${v.key}: ${v.snapshot} → ${v.current}`);
    console.log("   Reduce, or ratify the growth with `bun .claude/scripts/budget.ts --update`.");
    process.exit(1);
  }
  const unlocked = slack(current, snapshot);
  if (unlocked.length > 0) {
    console.log("\n🔴 Unlocked savings (the snapshot still allows the old size):");
    for (const v of unlocked) console.log(`   - ${v.key}: ${v.snapshot} → ${v.current}`);
    console.log("   Lock it with `bun .claude/scripts/budget.ts --tighten`.");
    process.exit(1);
  }
  console.log("\n🟢 Within budget");
} else {
  console.log("\n🟡 No snapshot yet — run with --update to set the ratchet");
}
