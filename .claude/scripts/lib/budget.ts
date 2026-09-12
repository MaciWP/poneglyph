// Source-byte estimate of the Claude listing and shared instruction surface.
// This is not a token measurement or proof of the native prompt on every turn.
// Full skills contribute description + when_to_use; source skillOverrides select
// name-only, off or user-invocable-only. Project/managed overrides and host framing
// are outside this estimate. Codex and Grok do not inherit these savings.
// SKILL.md body sizes are tracked separately. Extracted references still cost bytes
// when loaded. The legacy row key stays stable for historical comparisons.
//
// The snapshot (budget-snapshot.json) is the ratchet: the suite fails when a tracked
// size grows more than TOLERANCE over its snapshot. Lowering is free; raising is a
// deliberate `bun .claude/scripts/budget.ts --update` after a decision.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { frontmatter } from "./skill-metadata";

// 0 since plan 037 (2026-09-09): every byte of always-loaded growth is a decision taken with
// `--update`, never a rounding allowance. 89 % of this machine's tokens went to meta-work on
// the layer itself; the layer does not get to grow by accident.
export const TOLERANCE = 0;
export const SNAPSHOT_FILE = "budget-snapshot.json";

// Rules that never enter the global always-loaded layer (mirrors sync-claude's
// PROJECT_ONLY set for rules; paths/ is path-scoped, loaded only on matching files).
const NON_GLOBAL_RULES = new Set(["test-policy.md"]);

export interface Measurement {
  alwaysLoaded: Record<string, number>; // label → bytes; the ratcheted layer
  skillBodies: Record<string, number>; // skill name → SKILL.md bytes
  // Measured and printed, never ratcheted: what the host loads from INSTALLED PLUGINS is a
  // property of this machine, not of this repository, so a laptop with more plugins must not
  // turn the guard red where CI is green (H35, quality review 2026-09-11).
  informative?: Record<string, number>;
}

export const PLUGIN_SURFACE_LABEL = "installed plugins: description + when_to_use (this machine)";

export interface Snapshot extends Measurement {
  takenAt: string;
}

// Logical UTF-8 size with LF newlines. `statSync().size` follows the checkout
// (CRLF on Windows autocrlf), so the ratchet would fail CI while Ubuntu passed.
function readSource(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function utf8Len(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function bytes(path: string): number {
  return existsSync(path) ? utf8Len(readSource(path)) : 0;
}

// One decoder for the whole layer. A private regex reader here duplicated
// `lib/skill-metadata.frontmatter` and measured YAML punctuation instead of the value the
// host actually loads (H35, quality review 2026-09-11). A SKILL.md can also come from an
// installed plugin, which `check:config` never validates, so a parse failure reads as an
// absent field instead of aborting the whole measurement.
function fieldsOf(skillMd: string): Record<string, unknown> {
  try {
    return frontmatter(skillMd).fields;
  } catch {
    return {};
  }
}

const stringField = (fields: Record<string, unknown>, key: string): string =>
  typeof fields[key] === "string" ? (fields[key] as string) : "";

export function frontmatterField(skillMd: string, key: string): string {
  return stringField(fieldsOf(skillMd), key);
}

// Estimate a Claude listing entry from source policy; native activation remains unverified.
export function activationSurface(skillMd: string, visibility?: unknown): number {
  const fields = fieldsOf(skillMd);
  if (fields["disable-model-invocation"] === true || visibility === "off" || visibility === "user-invocable-only") return 0;
  if (visibility === "name-only") return utf8Len(stringField(fields, "name"));
  return utf8Len(stringField(fields, "description") + stringField(fields, "when_to_use"));
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
        sum += activationSurface(readSource(file));
      }
    }
  }
  return sum;
}

export function measure(repoRoot: string, homeDir: string = homedir()): Measurement {
  const claude = join(repoRoot, ".claude");
  const settings = join(claude, "settings.global.json");
  const overrides = existsSync(settings) ? JSON.parse(readSource(settings)).skillOverrides ?? {} : {};
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
      const text = readSource(file);
      skillBodies[s] = utf8Len(text);
      surface += activationSurface(text, overrides[s]);
    }
  }
  alwaysLoaded["skills: description + when_to_use"] = surface;
  return { alwaysLoaded, skillBodies, informative: { [PLUGIN_SURFACE_LABEL]: measurePluginSurface(homeDir) } };
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
// Pure: the snapshot rows that the current measurement still tracks.
const trackedOnly = (base: Record<string, number>, current: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(base).filter(([k]) => k in current));

/**
 * What the snapshot allows today: its total over the rows the current measurement still
 * ratchets. Every caller that SHOWS a snapshot total must use this one, or the report
 * announces headroom the guard would never grant.
 */
export function ratchetedSnapshotTotal(current: Measurement, snapshot: Measurement): number {
  return total(trackedOnly(snapshot.alwaysLoaded, current.alwaysLoaded));
}

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
  // Only the rows the current measurement still ratchets. A retired key (the machine-
  // dependent plugin surface, H35) is then neutral instead of a phantom shrink that would
  // buy that many bytes of unnoticed growth everywhere else.
  const totalBefore = ratchetedSnapshotTotal(current, snapshot);
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
  const rows: string[] = ["Claude source-byte estimate; not measured tokens or Codex/Grok savings.\n", "| Layer | Bytes | Snapshot | Δ |", "|---|---|---|---|"];
  for (const [k, v] of Object.entries(current.alwaysLoaded)) {
    const s = snapshot?.alwaysLoaded[k];
    rows.push(`| ${k} | ${v} | ${s ?? "—"} | ${s === undefined ? "—" : v - s} |`);
  }
  const t = total(current.alwaysLoaded);
  const ts = snapshot ? ratchetedSnapshotTotal(current, snapshot) : undefined;
  rows.push(`| **always-loaded TOTAL** | **${t}** | ${ts ?? "—"} | ${ts === undefined ? "—" : t - ts} |`);
  for (const [k, v] of Object.entries(current.informative ?? {})) {
    rows.push(`| _${k} — informative, outside the ratchet_ | ${v} | — | — |`);
  }
  return rows.join("\n");
}
