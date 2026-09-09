// Always-loaded token budget for the poneglyph layer (plan 032/WP4 — Cmd IX ratchet).
//
// What Claude Code loads on EVERY turn from this repo: CLAUDE.md, the always-on rules
// (everything in .claude/rules/*.md except path-scoped files and test-policy.md, which
// sync-claude keeps project-only), the active output style, and — for each skill — its
// frontmatter `description` + `when_to_use` (the activation surface; `metadata.keywords`
// is NOT loaded, only the skill-activation hook reads it). SKILL.md bodies load on
// invocation, so they are tracked separately as per-skill sizes.
//
// The snapshot (budget-snapshot.json) is the ratchet: the suite fails when a tracked
// size grows more than TOLERANCE over its snapshot. Lowering is free; raising is a
// deliberate `bun .claude/scripts/budget.ts --update` after a decision.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// 0 since plan 037 (2026-09-09): every byte of always-loaded growth is a decision taken with
// `--update`, never a rounding allowance. 89 % of this machine's tokens went to meta-work on
// the layer itself; the layer does not get to grow by accident.
export const TOLERANCE = 0;
export const SNAPSHOT_FILE = "budget-snapshot.json";

// Rules that never enter the global always-loaded layer (mirrors sync-claude's
// PROJECT_ONLY set for rules; paths/ is path-scoped, loaded only on matching files).
const NON_GLOBAL_RULES = new Set(["test-policy.md"]);

export interface Measurement {
  alwaysLoaded: Record<string, number>; // label → bytes
  skillBodies: Record<string, number>; // skill name → SKILL.md bytes
}

export interface Snapshot extends Measurement {
  takenAt: string;
}

export function frontmatterField(skillMd: string, key: string): string {
  const fm = skillMd.split(/^---\s*$/m)[1] ?? "";
  const m = fm.match(new RegExp(`^${key}:[^\\n]*\\n((?:[ \\t]+[^\\n]*\\n?)*)`, "m"));
  return m ? m[1] : "";
}

function bytes(path: string): number {
  return existsSync(path) ? statSync(path).size : 0;
}

// Installed plugins load their skills' description + when_to_use on every turn too —
// the review of plan 032 (F1) caught the budget reporting −3.7 % while the plugin
// created by the same plan carried the moved surface. Counted from the host's own
// registry so the figure is what THIS machine experiences.
export function measurePluginSurface(homeDir: string): number {
  const registry = join(homeDir, ".claude", "plugins", "installed_plugins.json");
  if (!existsSync(registry)) return 0;
  let plugins: Record<string, Array<{ installPath?: string }>>;
  try {
    plugins = (JSON.parse(readFileSync(registry, "utf8")) as { plugins?: typeof plugins }).plugins ?? {};
  } catch {
    return 0;
  }
  let sum = 0;
  for (const entries of Object.values(plugins)) {
    for (const e of entries) {
      const skillsDir = e.installPath ? join(e.installPath, "skills") : "";
      if (!skillsDir || !existsSync(skillsDir)) continue;
      for (const s of readdirSync(skillsDir)) {
        const file = join(skillsDir, s, "SKILL.md");
        if (!existsSync(file)) continue;
        const text = readFileSync(file, "utf8");
        sum += Buffer.byteLength(frontmatterField(text, "description") + frontmatterField(text, "when_to_use"), "utf8");
      }
    }
  }
  return sum;
}

export function measure(repoRoot: string, homeDir: string = homedir()): Measurement {
  const claude = join(repoRoot, ".claude");
  const alwaysLoaded: Record<string, number> = {
    "CLAUDE.md": bytes(join(repoRoot, "CLAUDE.md")),
    "output-styles/poneglyph.md": bytes(join(claude, "output-styles", "poneglyph.md")),
  };
  const rulesDir = join(claude, "rules");
  if (existsSync(rulesDir)) {
    for (const f of readdirSync(rulesDir).sort()) {
      if (!f.endsWith(".md") || NON_GLOBAL_RULES.has(f)) continue;
      alwaysLoaded[`rules/${f}`] = bytes(join(rulesDir, f));
    }
  }
  const skillBodies: Record<string, number> = {};
  let surface = 0;
  const skillsDir = join(claude, "skills");
  if (existsSync(skillsDir)) {
    for (const s of readdirSync(skillsDir).sort()) {
      const file = join(skillsDir, s, "SKILL.md");
      if (!existsSync(file)) continue;
      const text = readFileSync(file, "utf8");
      skillBodies[s] = Buffer.byteLength(text, "utf8");
      surface += Buffer.byteLength(frontmatterField(text, "description") + frontmatterField(text, "when_to_use"), "utf8");
    }
  }
  alwaysLoaded["skills: description + when_to_use"] = surface;
  alwaysLoaded["installed plugins: description + when_to_use (this machine)"] = measurePluginSurface(homeDir);
  return { alwaysLoaded, skillBodies };
}

export function total(m: Record<string, number>): number {
  return Object.values(m).reduce((a, b) => a + b, 0);
}

export interface Violation {
  key: string;
  snapshot: number;
  current: number;
}

// Pure: every tracked size that grew beyond tolerance, plus files new since the
// snapshot (a new always-loaded piece or a new skill is a budget decision too).
export function compare(current: Measurement, snapshot: Measurement, tolerance = TOLERANCE): Violation[] {
  const out: Violation[] = [];
  const check = (group: Record<string, number>, base: Record<string, number>, prefix: string) => {
    for (const [key, value] of Object.entries(group)) {
      const before = base[key];
      if (before === undefined) {
        out.push({ key: `${prefix}${key} (new)`, snapshot: 0, current: value });
      } else if (value > before * (1 + tolerance)) {
        out.push({ key: `${prefix}${key}`, snapshot: before, current: value });
      }
    }
  };
  check(current.alwaysLoaded, snapshot.alwaysLoaded, "");
  check(current.skillBodies, snapshot.skillBodies, "skill ");
  const totalBefore = total(snapshot.alwaysLoaded);
  const totalNow = total(current.alwaysLoaded);
  if (totalNow > totalBefore * (1 + tolerance)) {
    out.push({ key: "always-loaded TOTAL", snapshot: totalBefore, current: totalNow });
  }
  return out;
}

export function loadSnapshot(dir: string): Snapshot | null {
  const p = join(dir, SNAPSHOT_FILE);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Snapshot;
}

export function saveSnapshot(dir: string, m: Measurement): string {
  const p = join(dir, SNAPSHOT_FILE);
  const snap: Snapshot = { takenAt: new Date().toISOString().slice(0, 10), ...m };
  writeFileSync(p, JSON.stringify(snap, null, 2) + "\n");
  return p;
}

export function renderTable(current: Measurement, snapshot: Snapshot | null): string {
  const rows: string[] = ["| Layer | Bytes | Snapshot | Δ |", "|---|---|---|---|"];
  for (const [k, v] of Object.entries(current.alwaysLoaded)) {
    const s = snapshot?.alwaysLoaded[k];
    rows.push(`| ${k} | ${v} | ${s ?? "—"} | ${s === undefined ? "—" : v - s} |`);
  }
  const t = total(current.alwaysLoaded);
  const ts = snapshot ? total(snapshot.alwaysLoaded) : undefined;
  rows.push(`| **always-loaded TOTAL** | **${t}** | ${ts ?? "—"} | ${ts === undefined ? "—" : t - ts} |`);
  return rows.join("\n");
}
