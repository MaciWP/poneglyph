#!/usr/bin/env bun
// .claude/scripts/sync-claude.ts — Claude-layer engine; /sync-poneglyph orchestrates it with sync-codex and sync-grok
// Syncs .claude/ from poneglyph to ~/.claude/ via symlinks
// Supports: Windows (junction/symlink), macOS, Linux

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parseArgs } from "util";
import { $ } from "bun";

// === CONFIGURATION ===

export const LINK_FOLDERS = [
  "skills",
  "commands",
  "hooks",
  "workflows",
  "output-styles",
  // scripts: synced since 027/US2 — synced components (flow.md, retro) instruct
  // `bun .claude/scripts/flow-state.ts`, which only resolved with
  // cwd=poneglyph (sync-trap class RI-1, audit 2026-07-02). evals/ stays NOT synced.
  "scripts",
  // plans/templates ONLY (2026-09-09): scope/tech-plan/tdd-design/critic/retro fall back
  // to ~/.claude/plans/templates/ outside poneglyph. The rest of plans/ stays project-local
  // and ~/.claude/plans itself (Claude Code's plan-mode store) is never replaced.
  "plans/templates",
];

// `rules` and `docs` are NOT whole-folder links (see LINK_FOLDERS): both expand per-entry
// via expandFolderLinks so a project-only entry can be excluded from the global user layer.
// Top-level FILES link individually; subdirectories link as directories.
const RULES_FOLDER = "rules";
const DOCS_FOLDER = "docs";

// Rules specific to the poneglyph PROJECT — they must NOT propagate to the global
// ~/.claude/rules (user layer), or they would wrongly apply to every repo on the machine.
// They stay in the repo's project layer (./.claude/rules/), where the skills Read them by
// their canonical path per-project, and where poneglyph itself loads them as a project rule
// when cwd = poneglyph. `test-policy.md` declares "this repo = auxiliary" — true for poneglyph,
// false as a global default. (021 — companion to the globs→paths fix in the rule files.)
const PROJECT_ONLY_RULES = new Set(["test-policy.md"]);

// docs/local-model/ is a dated snapshot of ONE Windows machine (RTX 5090, D:\llama.cpp
// paths, pi setup) — real and worth keeping in git, but not applicable to every machine
// this repo syncs to. Same shape as PROJECT_ONLY_RULES: stays committed and reachable at
// its repo path, never reaches ~/.claude/docs/ on any machine via the global symlink.
const PROJECT_ONLY_DOCS = new Set(["local-model"]);

const LINK_FILES = [
  { src: "CLAUDE.md", dest: "CLAUDE.md" },
  // Default prompt for a bare `/loop`. ONE generic file linked to ~/.claude/loop.md:
  // poneglyph is the source of the global config, so this same file is both
  // poneglyph's project loop and the user-level default for every other repo.
  // Another repo overrides locally with its own .claude/loop.md.
  { src: ".claude/loop.md", dest: "loop.md" },
];

// settings.json is NOT symlinked: it is GENERATED per-machine as a real file by
// deep-merging the committed base with an optional gitignored machine overlay.
// Why: the user-scope (~/.claude) settings.json applies to every project on every
// OS, but a few keys are irreducibly machine-specific — env.PATH cannot be a single
// cross-OS string, and the macOS GUI app launches with a minimal PATH that needs it.
// Symlinking the cross-OS committed file therefore broke statusLine + hooks on macOS
// outside poneglyph (2026-06-08). The base stays the single source of truth for
// shared keys (regenerated each sync → no drift); the overlay carries machine
// paths and optional private addon activation. Replaces the previous symlink.
const MERGED_SETTINGS = {
  // This is deliberately distinct from .claude/settings.json. Claude Code loads
  // both project and user settings in this repository; registering global hooks in
  // both scopes makes every hook fire twice. The sync source therefore owns the
  // user profile, while settings.json stays project-scoped and hook-free.
  base: ".claude/settings.global.json", // committed, global, cross-OS
  overlay: ".claude/settings.machine.json", // gitignored, per-machine, optional
  dest: "settings.json", // → ~/.claude/settings.json (real file)
};

// The output style IS the SSOT: Oriol edits .claude/output-styles/poneglyph.md
// (his primary document; Claude Code reads it live through the folder symlink).
// The body-only twin .claude/system-prompts/poneglyph-sp.md is GENERATED here by
// stripping the frontmatter, for the hosts that inject raw system-prompt text:
// the ~/.grok/rules symlink, sync-codex's AGENTS.md concat, and compare.ts.
// No provenance marker inside the twin — its body must stay 100% clean for those
// hosts; provenance is documented in docs/system-inventory.md.
const SP_TWIN = {
  source: path.join(".claude", "output-styles", "poneglyph.md"),
  dest: path.join(".claude", "system-prompts", "poneglyph-sp.md"),
};

export function stripFrontmatter(content: string): string {
  // CRLF-tolerant: with core.autocrlf=true the SSOT on disk has CRLF
  // endings, and an LF-only pattern let the whole frontmatter survive
  // into the twin (audit 2026-08-23). Output is LF-normalized: the twin
  // is injected as a raw system prompt by hosts on every OS.
  const m = content.match(/^---(?:\r?\n)[\s\S]*?(?:\r?\n)---(?:\r?\n)+/);
  const body = m ? content.slice(m[0].length) : content;
  return body.replace(/\r\n/g, "\n").trimEnd() + "\n";
}

/** Read-only check of ~/.grok/rules/poneglyph-sp.md — never installs. */
export type GrokTwinKind =
  | "ok"
  | "ok-copy"
  | "stale-copy"
  | "missing"
  | "wrong-target"
  | "not-symlink";

export function classifyGrokTwin(input: {
  exists: boolean;
  isSymlink: boolean;
  resolvedTarget: string | null;
  expected: string;
  /** Regular-file installs (the documented Windows path is a copy, not a symlink):
   * true = content-equal to the generated twin, false = diverged, null = unreadable. */
  contentMatches?: boolean | null;
}): GrokTwinKind {
  if (!input.exists) return "missing";
  if (!input.isSymlink) {
    if (input.contentMatches === true) return "ok-copy";
    if (input.contentMatches === false) return "stale-copy";
    return "not-symlink";
  }
  if (
    !input.resolvedTarget ||
    normalizePath(input.resolvedTarget) !== normalizePath(input.expected)
  ) {
    return "wrong-target";
  }
  return "ok";
}

export function formatGrokTwinLine(kind: GrokTwinKind, detail?: string): string {
  switch (kind) {
    case "ok":
      return "🟢 grok twin: ✓ ~/.grok/rules/poneglyph-sp.md → generated twin (check, not install)";
    case "ok-copy":
      return "🟢 grok twin: ✓ content-equal copy of the generated twin (Windows install; check, not install)";
    case "stale-copy":
      return "🟡 grok twin: copy diverges from the generated twin — recopy .claude/system-prompts/poneglyph-sp.md over it (check, not install)";
    case "missing":
      return "⚪ grok twin: missing ~/.grok/rules/poneglyph-sp.md (ln -sfn <repo>/.claude/system-prompts/poneglyph-sp.md ~/.grok/rules/poneglyph-sp.md)";
    case "not-symlink":
      return "🟡 grok twin: exists but is not a symlink (check, not install)";
    case "wrong-target":
      return `🟡 grok twin: symlink → ${detail ?? "elsewhere"} (expected generated twin; check, not install)`;
  }
}

export type SpTwinStatus = "written" | "up-to-date" | "preview" | "error";

/** One line per status so --status / preview / execute all report the twin truthfully. */
export function formatSpTwinStatusLine(status: SpTwinStatus, message: string): string {
  switch (status) {
    case "up-to-date":
      return "🟢 sp twin: system-prompts/poneglyph-sp.md matches the style SSOT";
    case "preview":
      return "🟡 sp twin: STALE — the style SSOT changed; run --execute to regenerate";
    case "written":
      return "🎨 sp twin: regenerated from the style SSOT";
    case "error":
      return `🔴 sp twin: ${message}`;
  }
}

export function generateSpTwin(
  projectRoot: string,
  execute: boolean,
): { status: SpTwinStatus; message: string } {
  const sourcePath = path.join(projectRoot, SP_TWIN.source);
  const destPath = path.join(projectRoot, SP_TWIN.dest);
  if (!fs.existsSync(sourcePath)) {
    return { status: "error", message: `style SSOT not found: ${sourcePath}` };
  }
  const content = stripFrontmatter(fs.readFileSync(sourcePath, "utf-8"));
  const current = fs.existsSync(destPath) ? fs.readFileSync(destPath, "utf-8") : null;
  // Compare LF-normalized: git checks the twin out with CRLF, so a byte
  // compare against LF content would report STALE forever and rewrite
  // the file on every run.
  if (current !== null && current.replace(/\r\n/g, "\n") === content) {
    return { status: "up-to-date", message: "system-prompts twin already matches the style body" };
  }
  if (!execute) {
    return { status: "preview", message: "would regenerate system-prompts/poneglyph-sp.md from the style SSOT" };
  }
  fs.writeFileSync(destPath, content);
  return { status: "written", message: "regenerated system-prompts/poneglyph-sp.md from the style SSOT" };
}

// External links: src is relative to projectRoot/.claude/, dest is an absolute path outside ~/.claude/
const LINK_EXTERNAL_DIRS = [
  {
    src: "ccstatusline",
    dest: path.join(os.homedir(), ".config", "ccstatusline"),
  },
];

// === TYPES ===

interface LinkInfo {
  source: string;
  dest: string;
  type: "directory" | "file";
  status: "new" | "exists" | "conflict" | "already-linked";
}

interface Config {
  execute: boolean;
  backup: boolean;
  unlink: boolean;
  status: boolean;
  force: boolean;
  check: boolean;
  validateHooks: boolean;
  // Run `claude doctor` on the generated settings.json after writing it (032/WP1).
  // Off only with --no-validate (offline machine, CI without the CLI).
  validate: boolean;
  method: "auto" | "symlink" | "junction" | "copy";
}

interface HookEntry {
  phase: string;
  matcher: string;
  filePath: string;
  exists: boolean;
}

interface SystemInfo {
  os: "windows" | "macos" | "linux" | "unknown";
  osVersion: string;
  isAdmin: boolean;
  canSymlink: boolean;
  canJunction: boolean;
  devModeEnabled: boolean | null;
  homeDir: string;
  shell: string;
  recommendations: string[];
}

// === SYSTEM DETECTION ===

async function getSystemInfo(): Promise<SystemInfo> {
  const platform = process.platform;
  const info: SystemInfo = {
    os:
      platform === "win32"
        ? "windows"
        : platform === "darwin"
          ? "macos"
          : platform === "linux"
            ? "linux"
            : "unknown",
    osVersion: os.release(),
    isAdmin: false,
    canSymlink: false,
    canJunction: false,
    devModeEnabled: null,
    homeDir: os.homedir(),
    shell: process.env.SHELL || process.env.ComSpec || "unknown",
    recommendations: [],
  };

  if (info.os === "windows") {
    await checkWindowsCapabilities(info);
  } else {
    await checkUnixCapabilities(info);
  }

  return info;
}

async function checkWindowsCapabilities(info: SystemInfo): Promise<void> {
  // Check if admin
  try {
    const result = await $`net session 2>&1`.quiet().nothrow();
    info.isAdmin = result.exitCode === 0;
  } catch {
    info.isAdmin = false;
  }

  // Check Developer Mode (Windows 10+)
  try {
    const result =
      await $`reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock" /v AllowDevelopmentWithoutDevLicense 2>&1`
        .quiet()
        .nothrow();
    const output = result.stdout.toString();
    info.devModeEnabled = output.includes("0x1");
  } catch {
    info.devModeEnabled = null;
  }

  // Real symlink test
  const testDir = path.join(os.tmpdir(), `symlink-test-${Date.now()}`);
  const testLink = path.join(os.tmpdir(), `symlink-test-link-${Date.now()}`);

  try {
    fs.mkdirSync(testDir);
    fs.symlinkSync(testDir, testLink, "dir");
    info.canSymlink = true;
    fs.unlinkSync(testLink);
  } catch {
    info.canSymlink = false;
  } finally {
    try {
      fs.rmdirSync(testDir);
    } catch {}
  }

  // Junction test (always works on Windows without special permissions)
  const testJunction = path.join(os.tmpdir(), `junction-test-${Date.now()}`);
  try {
    fs.mkdirSync(testDir);
    fs.symlinkSync(testDir, testJunction, "junction");
    info.canJunction = true;
    fs.unlinkSync(testJunction);
  } catch {
    info.canJunction = false;
  } finally {
    try {
      fs.rmdirSync(testDir);
    } catch {}
  }

  // Recommendations
  if (!info.canSymlink && !info.devModeEnabled) {
    info.recommendations.push(
      "🔧 Enable Developer Mode for symlinks:",
      "   Settings → Privacy & Security → For developers → Developer Mode: ON",
      "   Or run as Administrator",
    );
  }

  if (!info.canSymlink && info.canJunction) {
    info.recommendations.push(
      "💡 Junctions will be used (work without special permissions)",
      "   Junctions are equivalent to symlinks for folders",
    );
  }
}

async function checkUnixCapabilities(info: SystemInfo): Promise<void> {
  // On Unix, symlinks always work for the user
  info.canSymlink = true;
  info.canJunction = false; // Does not exist on Unix

  // Check if root
  info.isAdmin = process.getuid?.() === 0;

  // Check home permissions
  try {
    const testFile = path.join(info.homeDir, `.symlink-test-${Date.now()}`);
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
  } catch {
    info.recommendations.push(
      "⚠️ You do not have write permissions on your home directory",
      `   Check permissions of: ${info.homeDir}`,
    );
    info.canSymlink = false;
  }

  // macOS specific
  if (info.os === "macos") {
    // Check SIP if relevant
    try {
      const result = await $`csrutil status 2>&1`.quiet().nothrow();
      const output = result.stdout.toString();
      if (output.includes("enabled")) {
        info.recommendations.push(
          "ℹ️ SIP is enabled (normal, does not affect ~/.claude)",
        );
      }
    } catch {}
  }
}

function printSystemInfo(info: SystemInfo): void {
  console.log("\n🖥️  System Information:\n");

  const osNames: Record<string, string> = {
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    unknown: "Unknown",
  };

  console.log(`   OS:              ${osNames[info.os]} ${info.osVersion}`);
  console.log(`   Home:            ${info.homeDir}`);
  console.log(`   Shell:           ${info.shell}`);
  console.log(`   Admin/Root:      ${info.isAdmin ? "✅ Yes" : "❌ No"}`);

  if (info.os === "windows") {
    console.log(
      `   Developer Mode:  ${info.devModeEnabled === true ? "✅ Enabled" : info.devModeEnabled === false ? "❌ Disabled" : "❓ Not detected"}`,
    );
    console.log(
      `   Symlinks:        ${info.canSymlink ? "✅ Available" : "❌ Not available"}`,
    );
    console.log(
      `   Junctions:       ${info.canJunction ? "✅ Available" : "❌ Not available"}`,
    );
  } else {
    console.log(
      `   Symlinks:        ${info.canSymlink ? "✅ Available" : "❌ Not available"}`,
    );
  }

  // Final capability
  const canLink = info.canSymlink || info.canJunction;
  console.log(`\n   Can link:        ${canLink ? "✅ YES" : "❌ NO"}`);

  if (info.recommendations.length > 0) {
    console.log("\n📋 Recommendations:\n");
    info.recommendations.forEach((r) => console.log(`   ${r}`));
  }
}

// === UTILITIES ===

function getHomeDir(): string {
  return os.homedir();
}

function getProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function getSymlinkTarget(p: string): string | null {
  try {
    return fs.readlinkSync(p);
  } catch {
    return null;
  }
}

function isWindows(): boolean {
  return process.platform === "win32";
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

// === MERGED SETTINGS (machine-specific, generated — not symlinked) ===

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Recursive deep-merge: nested plain objects merge per-key (so `env` keeps base
// keys + overlay PATH); arrays and scalars are replaced by the overlay. The one
// exception is `hooks` — generateSettings routes it through mergeHookEvents.
function deepMerge(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const existing = out[key];
    out[key] =
      isPlainObject(value) && isPlainObject(existing)
        ? deepMerge(existing, value)
        : value;
  }
  return out;
}

type HookGroup = {
  matcher?: string;
  hooks: Array<{ command: string } & Record<string, unknown>>;
};

// Plan 038 — `hooks.<event>` UNIONS instead of replacing: base groups first, then the
// overlay's; a handler whose `command` already appeared in that event is dropped (the
// base wins) and a group left empty disappears. Before this, an event the machine
// overlay also defined masked every base handler (bash-output-shaper, 2026-09-09).
// Anything that is not two plain objects keeps deepMerge's rule (overlay wins).
export function mergeHookEvents(base: unknown, overlay: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay ?? base;
  const out: Record<string, unknown> = { ...base };
  for (const [event, groups] of Object.entries(overlay)) {
    const seen = new Set<string>();
    const all = [...((base[event] as HookGroup[] | undefined) ?? []), ...(groups as HookGroup[])];
    // The identity of a registration is matcher + command: the same script deliberately
    // registered under `Bash` and under `Write` is two hooks, and de-duplicating on the
    // command alone silently dropped the second one (H32, quality review 2026-09-11).
    out[event] = all.flatMap((group) => {
      const matcher = typeof group.matcher === "string" ? group.matcher : "";
      const hooks = group.hooks.filter((h) => {
        const key = `${matcher}::${h.command}`;
        return !seen.has(key) && !!seen.add(key);
      });
      return hooks.length ? [{ ...group, hooks }] : [];
    });
  }
  return out;
}

interface SettingsResult {
  status: "written" | "preview" | "error";
  overlayApplied: boolean;
  message: string;
  // Real-file copy of the previous settings.json (only with --backup and only when
  // the previous one was a real file) — what the validation step restores on reject.
  backupPath?: string;
}

// Generates ~/.claude/settings.json as a REAL file = deepMerge(base, machine overlay),
// with `hooks` unioned per event (mergeHookEvents). With config.execute=false it only
// previews. Replaces any prior symlink in place.
export function generateSettings(
  projectRoot: string,
  homeDir: string,
  config: Pick<Config, "execute" | "backup">,
): SettingsResult {
  const basePath = path.join(projectRoot, MERGED_SETTINGS.base);
  const overlayPath = path.join(projectRoot, MERGED_SETTINGS.overlay);
  const destPath = path.join(homeDir, ".claude", MERGED_SETTINGS.dest);

  if (!fs.existsSync(basePath)) {
    return {
      status: "error",
      overlayApplied: false,
      message: `base not found: ${basePath}`,
    };
  }

  let merged: Record<string, unknown>;
  let overlayApplied = false;
  try {
    const base = JSON.parse(fs.readFileSync(basePath, "utf-8")) as Record<
      string,
      unknown
    >;
    if (fs.existsSync(overlayPath)) {
      const overlay = JSON.parse(fs.readFileSync(overlayPath, "utf-8")) as Record<
        string,
        unknown
      >;
      merged = deepMerge(base, overlay);
      if ("hooks" in overlay) merged.hooks = mergeHookEvents(base.hooks, overlay.hooks);
      overlayApplied = true;
    } else {
      merged = base;
    }
  } catch (error) {
    return {
      status: "error",
      overlayApplied: false,
      message: `parse error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!config.execute) {
    return {
      status: "preview",
      overlayApplied,
      message: overlayApplied
        ? "would merge base + machine overlay → real file"
        : "would copy base → real file (no machine overlay found)",
    };
  }

  // Backup + remove existing (symlink OR real file) before writing.
  let backupPath: string | undefined;
  if (fs.existsSync(destPath) || isSymlink(destPath)) {
    if (config.backup) {
      const backupDir = path.join(
        homeDir,
        ".claude.backup",
        new Date().toISOString().split("T")[0],
      );
      fs.mkdirSync(backupDir, { recursive: true });
      const candidate = path.join(backupDir, MERGED_SETTINGS.dest);
      if (isSymlink(destPath)) {
        fs.writeFileSync(
          candidate + ".symlink",
          getSymlinkTarget(destPath) || "unknown",
        );
      } else {
        fs.copyFileSync(destPath, candidate);
        backupPath = candidate;
      }
    }
    fs.unlinkSync(destPath); // unlinkSync removes both symlinks and regular files
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, JSON.stringify(merged, null, 2) + "\n");

  return {
    status: "written",
    overlayApplied,
    backupPath,
    message: overlayApplied
      ? "merged base + machine overlay → ~/.claude/settings.json"
      : "copied base → ~/.claude/settings.json (no machine overlay)",
  };
}

// === GENERATED SETTINGS VALIDATION (032/WP1) ===
//
// Evidence (2026-09-03): `claude -p` with a broken settings file answers normally
// (exit 0, empty stderr) — headless mode never surfaces "Settings Error". The
// channel that does, without a session or an API call, is `claude doctor`: it
// prints an "Invalid settings" section listing `<path> › <key>: <reason>` for
// every rejected file, user-level included, and exits 0 regardless — so the
// OUTPUT is parsed, never the exit code.

// Pure: the lines under the "Invalid settings" heading (up to the next blank
// line), without the leading "- ". [] when the section is absent.
export function parseDoctorInvalidSettings(output: string): string[] {
  const lines = output.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*invalid settings\s*$/i.test(l));
  if (start === -1) return [];
  const problems: string[] = [];
  for (const raw of lines.slice(start + 1)) {
    if (!raw.trim()) break;
    problems.push(raw.trim().replace(/^-\s*/, ""));
  }
  return problems;
}

// Pure: the problems that name `filePath` — case-insensitive and separator-
// agnostic, because doctor prints native Windows paths. Problems in OTHER
// settings files (a project's .claude/settings.json) are not this script's.
export function problemsForFile(problems: string[], filePath: string): string[] {
  const norm = (p: string) => p.toLowerCase().replace(/\\/g, "/");
  const target = norm(filePath);
  return problems.filter((p) => norm(p).includes(target));
}

export interface SettingsValidation {
  ok: boolean;
  problems: string[];
  skipped?: string; // why the check could not run, as a human sentence
  // Machine-readable form of the same fact. A timeout and a missing CLI both leave the
  // layer UNVERIFIED, but only one of them means the validation is worth retrying, and no
  // caller could tell them apart from free text (H36, quality review 2026-09-11).
  reason?: "cli-unavailable" | "timeout";
}

// Pure builders so the two skip paths have one spelling and are testable without spawning.
export function timeoutValidation(timeoutMs: number): SettingsValidation {
  return { ok: true, problems: [], skipped: `claude doctor exceeded ${timeoutMs / 1000}s`, reason: "timeout" };
}

export function cliUnavailableValidation(detail: string): SettingsValidation {
  return { ok: true, problems: [], skipped: `claude CLI not runnable (${detail})`, reason: "cli-unavailable" };
}

// `--status` printed the rejection and returned 0, so every caller that reads exit codes
// instead of parsing icons — /sync-poneglyph, CI, an agent — saw a broken layer as success
// (H63, quality review 2026-09-11). A skipped validation is not a failure: it is unknown,
// and exit 2 preserves that uncertainty for callers.
export function statusExitCode(v: SettingsValidation): number {
  return v.skipped ? 2 : v.ok ? 0 : 1;
}

export function classifySettingsValidation(output: string, code: number, destPath: string): SettingsValidation {
  const problems = problemsForFile(parseDoctorInvalidSettings(output), destPath);
  if (problems.length) return { ok: false, problems };
  return code === 0 ? { ok: true, problems: [] }
    : { ok: true, problems: [], skipped: `claude doctor exited ${code}; settings acceptance is unknown` };
}

export function formatSettingsValidationLine(v: SettingsValidation): string {
  if (v.skipped) return `🟡 settings.json: not validated — ${v.skipped}`;
  if (v.ok) return "🟢 settings.json: accepted by claude doctor";
  return [
    "🔴 settings.json: REJECTED by claude doctor — Claude Code would skip this file entirely",
    ...v.problems.map((p) => `   - ${p}`),
  ].join("\n");
}

async function validateGeneratedSettings(
  destPath: string,
  timeoutMs = 90_000,
): Promise<SettingsValidation> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(["claude", "doctor"], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return cliUnavailableValidation(detail);
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);
  const [out, err] = await Promise.all([
    new Response(proc.stdout as ReadableStream).text(),
    new Response(proc.stderr as ReadableStream).text(),
  ]);
  const code = await proc.exited;
  clearTimeout(timer);
  if (timedOut) {
    return timeoutValidation(timeoutMs);
  }
  return classifySettingsValidation(`${out}\n${err}`, code, destPath);
}

// === LINK DETECTION ===

// Pure: given the top-level entries of a source dir (rules or docs), compute which
// per-entry links should exist under `dest`. Files and directories alike are skipped when
// named in `projectOnly` (a directory used to bypass this check — bug found 2026-08-24
// wiring docs/local-model through this same function; PROJECT_ONLY_RULES only ever held a
// file, so it went unnoticed). Status is filled in by the caller. Kept pure (entries passed
// in, no fs) so it is unit-testable.
export function expandFolderLinks(
  source: string,
  dest: string,
  entries: { name: string; isDirectory: boolean }[],
  projectOnly: Set<string>,
): { source: string; dest: string; type: "directory" | "file" }[] {
  const out: { source: string; dest: string; type: "directory" | "file" }[] =
    [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue; // skip .DS_Store and other dotfiles
    if (projectOnly.has(e.name)) continue; // project-only entry → stays out of the global layer
    out.push({
      source: path.join(source, e.name),
      dest: path.join(dest, e.name),
      type: e.isDirectory ? "directory" : "file",
    });
  }
  return out;
}

function computeLinkStatus(source: string, dest: string): LinkInfo["status"] {
  if (!fs.existsSync(dest) && !isSymlink(dest)) return "new";
  if (isSymlink(dest)) {
    const target = getSymlinkTarget(dest);
    const resolvedTarget = target
      ? path.resolve(path.dirname(dest), target)
      : null;
    if (
      normalizePath(target || "") === normalizePath(source) ||
      normalizePath(resolvedTarget || "") === normalizePath(source)
    ) {
      return "already-linked";
    }
    return "conflict";
  }
  return "exists";
}

function detectLinks(projectRoot: string, homeDir: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  const srcBase = path.join(projectRoot, ".claude");
  const destBase = path.join(homeDir, ".claude");

  for (const folder of LINK_FOLDERS) {
    const source = path.join(srcBase, folder);
    const dest = path.join(destBase, folder);

    if (!fs.existsSync(source)) continue;

    let status: LinkInfo["status"] = "new";

    if (fs.existsSync(dest)) {
      if (isSymlink(dest)) {
        const target = getSymlinkTarget(dest);
        const resolvedTarget = target
          ? path.resolve(path.dirname(dest), target)
          : null;

        if (
          normalizePath(target || "") === normalizePath(source) ||
          normalizePath(resolvedTarget || "") === normalizePath(source)
        ) {
          status = "already-linked";
        } else {
          status = "conflict";
        }
      } else {
        status = "exists";
      }
    }

    links.push({ source, dest, type: "directory", status });
  }

  for (const file of LINK_FILES) {
    const source = path.join(projectRoot, file.src);
    const dest = path.join(destBase, file.dest);

    if (!fs.existsSync(source)) continue;

    let status: LinkInfo["status"] = "new";

    if (fs.existsSync(dest)) {
      if (isSymlink(dest)) {
        const target = getSymlinkTarget(dest);
        const resolvedTarget = target
          ? path.resolve(path.dirname(dest), target)
          : null;

        if (
          normalizePath(target || "") === normalizePath(source) ||
          normalizePath(resolvedTarget || "") === normalizePath(source)
        ) {
          status = "already-linked";
        } else {
          status = "conflict";
        }
      } else {
        status = "exists";
      }
    }

    links.push({ source, dest, type: "file", status });
  }

  for (const ext of LINK_EXTERNAL_DIRS) {
    const source = path.join(srcBase, ext.src);
    const dest = ext.dest;

    if (!fs.existsSync(source)) continue;

    let status: LinkInfo["status"] = "new";

    if (fs.existsSync(dest)) {
      if (isSymlink(dest)) {
        const target = getSymlinkTarget(dest);
        const resolvedTarget = target
          ? path.resolve(path.dirname(dest), target)
          : null;

        if (
          normalizePath(target || "") === normalizePath(source) ||
          normalizePath(resolvedTarget || "") === normalizePath(source)
        ) {
          status = "already-linked";
        } else {
          status = "conflict";
        }
      } else {
        status = "exists";
      }
    }

    links.push({ source, dest, type: "directory", status });
  }

  // `rules` expanded per-entry so PROJECT_ONLY_RULES never reach the global ~/.claude/rules.
  const rulesSource = path.join(srcBase, RULES_FOLDER);
  const rulesDest = path.join(destBase, RULES_FOLDER);
  if (fs.existsSync(rulesSource)) {
    const entries = fs
      .readdirSync(rulesSource, { withFileTypes: true })
      .map((d) => ({ name: d.name, isDirectory: d.isDirectory() }));
    for (const r of expandFolderLinks(
      rulesSource,
      rulesDest,
      entries,
      PROJECT_ONLY_RULES,
    )) {
      links.push({ ...r, status: computeLinkStatus(r.source, r.dest) });
    }
  }

  // `docs` expanded per-entry so PROJECT_ONLY_DOCS (machine-specific notes) never reach
  // the global ~/.claude/docs shared across every machine this repo syncs to.
  const docsSource = path.join(srcBase, DOCS_FOLDER);
  const docsDest = path.join(destBase, DOCS_FOLDER);
  if (fs.existsSync(docsSource)) {
    const entries = fs
      .readdirSync(docsSource, { withFileTypes: true })
      .map((d) => ({ name: d.name, isDirectory: d.isDirectory() }));
    for (const r of expandFolderLinks(
      docsSource,
      docsDest,
      entries,
      PROJECT_ONLY_DOCS,
    )) {
      links.push({ ...r, status: computeLinkStatus(r.source, r.dest) });
    }
  }

  return links;
}

// === PREVIEW ===

function printPreview(links: LinkInfo[], method: string): void {
  console.log("\n📋 Symlink preview:\n");
  console.log(`   Method: ${method}\n`);

  const grouped = {
    new: links.filter((l) => l.status === "new"),
    exists: links.filter((l) => l.status === "exists"),
    conflict: links.filter((l) => l.status === "conflict"),
    linked: links.filter((l) => l.status === "already-linked"),
  };

  if (grouped.linked.length) {
    console.log("✅ Already linked:");
    grouped.linked.forEach((l) =>
      console.log(`   ${path.basename(l.dest)} → ${l.source}`),
    );
  }

  if (grouped.new.length) {
    console.log("\n🆕 New (will be created):");
    grouped.new.forEach((l) =>
      console.log(`   + ${path.basename(l.dest)} → ${l.source}`),
    );
  }

  if (grouped.exists.length) {
    console.log("\n⚠️  Existing (will be replaced with --backup):");
    grouped.exists.forEach((l) => console.log(`   ~ ${l.dest}`));
  }

  if (grouped.conflict.length) {
    console.log("\n❌ Conflicts (symlink points elsewhere):");
    grouped.conflict.forEach((l) => {
      const target = getSymlinkTarget(l.dest);
      console.log(`   ! ${l.dest} → ${target}`);
    });
  }

  const toCreate =
    grouped.new.length + grouped.exists.length + grouped.conflict.length;
  console.log(
    `\n📊 Summary: ${grouped.linked.length} already linked, ${toCreate} to create/update`,
  );
}

// === SYMLINK CREATION ===

function determineLinkMethod(
  info: SystemInfo,
  config: Config,
): "symlink" | "junction" | "copy" {
  if (config.method !== "auto") {
    return config.method === "symlink"
      ? "symlink"
      : config.method === "junction"
        ? "junction"
        : "copy";
  }

  if (info.os === "windows") {
    if (info.canSymlink) return "symlink";
    if (info.canJunction) return "junction";
    return "copy";
  }

  return info.canSymlink ? "symlink" : "copy";
}

// Returns the number of links that failed: the caller turns it into exit 1 so an
// orchestrator (sync-poneglyph) never reads a partial Claude layer as success.
async function createSymlinks(
  links: LinkInfo[],
  config: Config,
  info: SystemInfo,
): Promise<number> {
  let failed = 0;
  const homeDir = getHomeDir();
  const destBase = path.join(homeDir, ".claude");
  const backupDir = path.join(
    homeDir,
    ".claude.backup",
    new Date().toISOString().split("T")[0],
  );

  const method = determineLinkMethod(info, config);

  if (!fs.existsSync(destBase)) {
    fs.mkdirSync(destBase, { recursive: true });
    console.log(`📁 Created ${destBase}`);
  }

  console.log(`\n🔗 Link method: ${method}\n`);

  // BLINDAJE (021): pre-021 the whole `rules` folder was one dir-symlink. In the per-entry model
  // ~/.claude/rules must be a REAL directory, or `mkdirSync(dirname(dest))` below would resolve
  // through the leftover symlink and create per-file links INSIDE the repo source (corruption).
  // Replace any leftover dir-symlink with a real directory before creating rule links.
  const rulesDest = path.join(destBase, RULES_FOLDER);
  if (isSymlink(rulesDest)) {
    fs.unlinkSync(rulesDest);
    fs.mkdirSync(rulesDest, { recursive: true });
    console.log(
      `📁 Normalized ${rulesDest} (dir-symlink → real dir for per-file rules)`,
    );
  }

  // Same BLINDAJE for `docs`: it was a whole-folder dir-symlink until PROJECT_ONLY_DOCS
  // (2026-08-24) moved it to the per-entry model to keep docs/local-model/ out of the
  // global layer. A leftover dir-symlink here would corrupt per-entry docs links exactly
  // like the rules case above.
  const docsDest = path.join(destBase, DOCS_FOLDER);
  if (isSymlink(docsDest)) {
    fs.unlinkSync(docsDest);
    fs.mkdirSync(docsDest, { recursive: true });
    console.log(
      `📁 Normalized ${docsDest} (dir-symlink → real dir for per-file docs)`,
    );
  }

  for (const link of links) {
    if (link.status === "already-linked") {
      console.log(`⏭️  Skipping ${path.basename(link.dest)} (already linked)`);
      continue;
    }

    // Backup if exists. Guard on actual presence: the rules/docs-dir normalization above can
    // remove a leftover dir-symlink whose children were detected as "exists" (they resolved
    // THROUGH it); once it is gone those dests no longer exist, so a blind rename would crash
    // (ENOENT).
    if (
      (link.status === "exists" || link.status === "conflict") &&
      config.backup &&
      (fs.existsSync(link.dest) || isSymlink(link.dest))
    ) {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const backupPath = path.join(backupDir, path.basename(link.dest));

      if (isSymlink(link.dest)) {
        const target = getSymlinkTarget(link.dest);
        fs.writeFileSync(backupPath + ".symlink", target || "unknown");
      } else {
        fs.renameSync(link.dest, backupPath);
      }
      console.log(`💾 Backup: ${link.dest} → ${backupPath}`);
    }

    // Remove existing
    if (fs.existsSync(link.dest) || isSymlink(link.dest)) {
      if (isSymlink(link.dest)) {
        fs.unlinkSync(link.dest);
      } else if (!config.backup) {
        fs.rmSync(link.dest, { recursive: true, force: true });
      }
    }

    // Ensure parent directory exists (required for external links outside ~/.claude/)
    fs.mkdirSync(path.dirname(link.dest), { recursive: true });

    // Create link according to method
    try {
      switch (method) {
        case "symlink":
          if (isWindows()) {
            fs.symlinkSync(
              link.source,
              link.dest,
              link.type === "directory" ? "dir" : "file",
            );
          } else {
            fs.symlinkSync(link.source, link.dest);
          }
          break;

        case "junction":
          if (link.type === "directory") {
            fs.symlinkSync(link.source, link.dest, "junction");
          } else {
            // Junction does not support files, use hardlink or copy
            fs.copyFileSync(link.source, link.dest);
            console.log(`   ⚠️ File copied (junction does not support files)`);
          }
          break;

        case "copy":
          if (link.type === "directory") {
            fs.cpSync(link.source, link.dest, { recursive: true });
          } else {
            fs.copyFileSync(link.source, link.dest);
          }
          console.log(
            `   ⚠️ Copied (not linked - changes will not be synced)`,
          );
          break;
      }

      const icon = method === "copy" ? "📄" : "🔗";
      console.log(
        `${icon} Created: ${path.basename(link.dest)} → ${link.source}`,
      );
    } catch (error) {
      failed++;
      if (error instanceof Error) {
        if (error.message.includes("EPERM")) {
          console.error(
            `❌ Permission error creating ${path.basename(link.dest)}`,
          );
          printPermissionHelp(info);
        } else {
          console.error(`❌ Error: ${error.message}`);
        }
      }
    }
  }
  return failed;
}

function printPermissionHelp(info: SystemInfo): void {
  if (info.os === "windows") {
    console.log("\n💡 Solutions for Windows:");
    console.log("   1. Enable Developer Mode:");
    console.log(
      "      Settings → Privacy & Security → For developers → Developer Mode: ON",
    );
    console.log("   2. Or run terminal as Administrator");
    console.log(
      "   3. Or use --method junction (does not require special permissions)",
    );
  } else if (info.os === "macos") {
    console.log("\n💡 Solutions for macOS:");
    console.log("   1. Check your home permissions: ls -la ~");
    console.log("   2. If using FileVault, ensure it is unlocked");
  } else {
    console.log("\n💡 Solutions for Linux:");
    console.log("   1. Check permissions: ls -la ~/.claude");
    console.log("   2. If needed: sudo chown -R $USER ~/.claude");
  }
}

// === UNLINK ===

function unlinkAll(links: LinkInfo[]): void {
  for (const link of links) {
    if (isSymlink(link.dest)) {
      fs.unlinkSync(link.dest);
      console.log(`🗑️  Removed symlink: ${link.dest}`);
    }
  }
}

// === STATUS ===

function printStatus(links: LinkInfo[]): void {
  console.log("\n📊 Current state of ~/.claude:\n");

  const homeDir = getHomeDir();
  const destBase = path.join(homeDir, ".claude");

  if (!fs.existsSync(destBase)) {
    console.log("❌ ~/.claude does not exist");
    return;
  }

  for (const link of links) {
    const exists = fs.existsSync(link.dest) || isSymlink(link.dest);
    const isLink = isSymlink(link.dest);
    const target = isLink ? getSymlinkTarget(link.dest) : null;

    if (!exists) {
      console.log(`⚪ ${path.basename(link.dest)}: does not exist`);
    } else if (isLink) {
      const resolvedTarget = target
        ? path.resolve(path.dirname(link.dest), target)
        : null;
      const pointsToProject =
        normalizePath(target || "") === normalizePath(link.source) ||
        normalizePath(resolvedTarget || "") === normalizePath(link.source);

      if (pointsToProject) {
        console.log(`🟢 ${path.basename(link.dest)}: ✓ linked to poneglyph`);
      } else {
        console.log(`🟡 ${path.basename(link.dest)}: symlink to ${target}`);
      }
    } else {
      console.log(`🔵 ${path.basename(link.dest)}: local folder/file`);
    }
  }

  // settings.json is a generated real file (not a symlink) — report it explicitly.
  const settingsDest = path.join(destBase, "settings.json");
  const overlayPath = path.join(getProjectRoot(), MERGED_SETTINGS.overlay);
  if (!fs.existsSync(settingsDest) && !isSymlink(settingsDest)) {
    console.log(`⚪ settings.json: does not exist (run --execute)`);
  } else if (isSymlink(settingsDest)) {
    console.log(
      `🟡 settings.json: STALE symlink — should be a generated real file, run --execute`,
    );
  } else {
    console.log(
      `🟢 settings.json: generated real file ${fs.existsSync(overlayPath) ? "(base + machine overlay)" : "(base only — no machine overlay)"}`,
    );
  }

  const twin = generateSpTwin(getProjectRoot(), false);
  console.log(formatSpTwinStatusLine(twin.status, twin.message));
  console.log(inspectGrokTwinLine(getProjectRoot(), homeDir));
}

function inspectGrokTwinLine(projectRoot: string, homeDir: string): string {
  const dest = path.join(homeDir, ".grok", "rules", "poneglyph-sp.md");
  const expected = path.join(
    projectRoot,
    ".claude",
    "system-prompts",
    "poneglyph-sp.md",
  );
  const exists = fs.existsSync(dest) || isSymlink(dest);
  const linked = isSymlink(dest);
  const raw = linked ? getSymlinkTarget(dest) : null;
  const resolved = raw ? path.resolve(path.dirname(dest), raw) : null;
  let contentMatches: boolean | null = null;
  if (exists && !linked) {
    try {
      contentMatches = fs.readFileSync(dest, "utf-8") === fs.readFileSync(expected, "utf-8");
    } catch {
      contentMatches = null;
    }
  }
  return formatGrokTwinLine(
    classifyGrokTwin({
      exists,
      isSymlink: linked,
      resolvedTarget: resolved,
      expected,
      contentMatches,
    }),
    raw ?? undefined,
  );
}

// === VALIDATE HOOKS ===

function extractBunFilePath(command: string): string | null {
  // Matches: bun <file>, bun run <file>, bunx <file>
  const match = command.match(/\bbun(?:x| run)?\s+(\S+\.ts\b)/);
  return match ? match[1] : null;
}

function expandHome(p: string): string {
  if (p.startsWith("$HOME")) {
    return path.join(os.homedir(), p.slice(5));
  }
  if (p.startsWith("~")) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

function collectHookEntries(settings: Record<string, unknown>): HookEntry[] {
  const entries: HookEntry[] = [];
  const hooks = settings.hooks as Record<string, unknown> | undefined;

  if (hooks && typeof hooks === "object") {
    for (const [phase, phaseValue] of Object.entries(hooks)) {
      if (!Array.isArray(phaseValue)) continue;
      for (const hookGroup of phaseValue) {
        if (typeof hookGroup !== "object" || hookGroup === null) continue;
        const group = hookGroup as Record<string, unknown>;
        const matcher =
          typeof group.matcher === "string" && group.matcher !== ""
            ? group.matcher
            : "(all)";
        const hooksList = Array.isArray(group.hooks) ? group.hooks : [];
        for (const hook of hooksList) {
          if (typeof hook !== "object" || hook === null) continue;
          const h = hook as Record<string, unknown>;
          const command = typeof h.command === "string" ? h.command : null;
          if (!command) continue;
          const rawPath = extractBunFilePath(command);
          if (!rawPath) continue;
          const filePath = expandHome(rawPath);
          entries.push({
            phase,
            matcher,
            filePath,
            exists: fs.existsSync(filePath),
          });
        }
      }
    }
  }

  const statusLine = settings.statusLine as Record<string, unknown> | undefined;
  if (statusLine && typeof statusLine === "object") {
    const command =
      typeof statusLine.command === "string" ? statusLine.command : null;
    if (command) {
      const rawPath = extractBunFilePath(command);
      if (rawPath) {
        const filePath = expandHome(rawPath);
        entries.push({
          phase: "statusLine",
          matcher: "-",
          filePath,
          exists: fs.existsSync(filePath),
        });
      }
    }
  }

  return entries;
}

function validateHooks(): void {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  console.log(
    `\n[validate-hooks] Checking hooks in ~/.claude/settings.json...\n`,
  );

  if (!fs.existsSync(settingsPath)) {
    console.log(`❌ Not found: ${settingsPath}`);
    process.exit(1);
  }

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  } catch {
    console.log(`❌ Error parsing settings.json`);
    process.exit(1);
  }

  const entries = collectHookEntries(settings);

  if (entries.length === 0) {
    console.log("  No hooks with bun commands found in settings.json");
    process.exit(0);
  }

  // Column widths
  const colPhase = Math.max(
    "Phase".length,
    ...entries.map((e) => e.phase.length),
  );
  const colMatcher = Math.max(
    "Matcher".length,
    ...entries.map((e) => e.matcher.length),
  );
  const colPath = Math.max(
    "Path".length,
    ...entries.map((e) => e.filePath.length),
  );

  const pad = (s: string, n: number) => s.padEnd(n);

  console.log(
    `  ${pad("Phase", colPhase)}  ${pad("Matcher", colMatcher)}  ${pad("Path", colPath)}  Exists`,
  );
  console.log(
    `  ${"─".repeat(colPhase)}  ${"─".repeat(colMatcher)}  ${"─".repeat(colPath)}  ${"─".repeat(6)}`,
  );

  for (const e of entries) {
    const icon = e.exists ? "✓" : "✗";
    console.log(
      `  ${pad(e.phase, colPhase)}  ${pad(e.matcher, colMatcher)}  ${pad(e.filePath, colPath)}  ${icon}`,
    );
  }

  const ok = entries.filter((e) => e.exists).length;
  const total = entries.length;
  const missing = total - ok;

  console.log("");
  if (missing === 0) {
    console.log(`  Result: ${ok}/${total} hooks OK ✓`);
    process.exit(0);
  } else {
    console.log(`  Result: ${missing} hooks MISSING (${ok}/${total} OK)`);
    process.exit(1);
  }
}

// === CONFIRMATION ===

export async function askConfirmation(message: string): Promise<boolean> {
  const rl = await import("readline");
  const readline = rl.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question(`\n${message} (y/N): `, (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

// === MAIN ===

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      execute: { type: "boolean", default: false },
      backup: { type: "boolean", default: false },
      unlink: { type: "boolean", default: false },
      status: { type: "boolean", default: false },
      check: { type: "boolean", default: false },
      "validate-hooks": { type: "boolean", default: false },
      "no-validate": { type: "boolean", default: false },
      force: { type: "boolean", short: "f", default: false },
      method: { type: "string", default: "auto" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(`
sync-claude - Syncs .claude/ from poneglyph to ~/.claude/ via symlinks

Usage:
  bun .claude/scripts/sync-claude.ts [options]

Options:
  --check           Verify system and permissions (recommended first)
  --status          Show current state of ~/.claude
  --validate-hooks  Verify all hooks in settings.json are accessible
  --no-validate     Skip the 'claude doctor' check of the generated settings.json
  --execute         Create the symlinks (without this only shows preview)
  --backup          Save existing content before replacing
  --unlink          Remove the symlinks (does not delete the source)
  --method          Link method: auto, symlink, junction, copy
  --force           Do not ask for confirmation
  -h, --help        Show this help

Link methods:
  auto        Detects the best available method (default)
  symlink     Real symlinks (requires permissions on Windows)
  junction    Windows junctions (folders only, no special permissions)
  copy        Copies files (does not sync changes)

Examples:
  bun .claude/scripts/sync-claude.ts --check           # Verify system first
  bun .claude/scripts/sync-claude.ts                   # Preview
  bun .claude/scripts/sync-claude.ts --status          # See current state
  bun .claude/scripts/sync-claude.ts --execute         # Create symlinks
  bun .claude/scripts/sync-claude.ts --execute --backup  # With backup
  bun .claude/scripts/sync-claude.ts --method junction --execute  # Force junction
  bun .claude/scripts/sync-claude.ts --unlink          # Remove symlinks
  bun .claude/scripts/sync-claude.ts --validate-hooks  # Verify hook accessibility

Requirements per OS:
  Windows:  Developer Mode enabled, or use junction, or Admin
  macOS:    Normal user permissions
  Linux:    Normal user permissions
`);
    return;
  }

  const config: Config = {
    execute: values.execute ?? false,
    backup: values.backup ?? false,
    unlink: values.unlink ?? false,
    status: values.status ?? false,
    check: values.check ?? false,
    validateHooks: values["validate-hooks"] ?? false,
    validate: !(values["no-validate"] ?? false),
    force: values.force ?? false,
    method: (values.method as Config["method"]) ?? "auto",
  };

  // Non-interactive guard: askConfirmation() blocks forever without a TTY (e.g.
  // launched by an agent or in CI), which reads as "the command failed". Fail
  // fast with guidance instead of hanging.
  if (
    (config.execute || config.unlink) &&
    !config.force &&
    !process.stdin.isTTY
  ) {
    console.error(
      "\n❌ No interactive terminal and --force not set — this would hang on the\n" +
        "   confirmation prompt. Re-run non-interactively with --force:\n" +
        "     bun .claude/commands/sync-poneglyph.ts --execute --backup --force\n",
    );
    process.exit(2);
  }

  const projectRoot = getProjectRoot();
  const homeDir = getHomeDir();

  console.log(`\n🔧 Sync Claude Config`);
  console.log(`   Source:  ${path.join(projectRoot, ".claude")}`);
  console.log(`   Target:  ${path.join(homeDir, ".claude")}`);

  // Get system info
  const systemInfo = await getSystemInfo();

  // --check: only show system info
  if (config.check) {
    printSystemInfo(systemInfo);

    const canLink = systemInfo.canSymlink || systemInfo.canJunction;
    if (canLink) {
      console.log("\n✅ System ready for sync");
      console.log("   Run without --check to see preview of changes");
    } else {
      console.log("\n❌ System CANNOT create links");
      console.log("   Review the recommendations above");
    }
    return;
  }

  if (config.validateHooks) {
    validateHooks();
    return;
  }

  const links = detectLinks(projectRoot, homeDir);

  if (config.status) {
    printStatus(links);
    // Status tells the truth about acceptance too, not just file presence (032/WP1).
    if (config.validate) {
      const destPath = path.join(homeDir, ".claude", MERGED_SETTINGS.dest);
      if (fs.existsSync(destPath) && !isSymlink(destPath)) {
        const validation = await validateGeneratedSettings(destPath);
        console.log(formatSettingsValidationLine(validation));
        // The exit code carries the verdict too: /sync-poneglyph --status and CI read it
        // instead of parsing the icons (H63).
        process.exitCode = statusExitCode(validation);
      } else {
        console.log(formatSettingsValidationLine({ ok: true, problems: [], skipped: "generated settings file unavailable" }));
        process.exitCode = 2;
      }
    } else {
      console.log(formatSettingsValidationLine({ ok: true, problems: [], skipped: "--no-validate" }));
      process.exitCode = 2;
    }
    return;
  }

  if (config.unlink) {
    if (!config.force) {
      const confirmed = await askConfirmation("Remove all symlinks?");
      if (!confirmed) {
        console.log("❌ Cancelled");
        return;
      }
    }
    unlinkAll(links);
    console.log("\n✅ Symlinks removed");
    return;
  }

  // Check capability before continuing
  const canLink = systemInfo.canSymlink || systemInfo.canJunction;
  if (!canLink && config.method !== "copy") {
    console.log("\n⚠️  Cannot create symlinks/junctions on this system");
    printSystemInfo(systemInfo);
    console.log("\n💡 Options:");
    console.log("   1. Follow the recommendations above");
    console.log("   2. Use --method copy to copy (does not sync changes)");
    return;
  }

  const method = determineLinkMethod(systemInfo, config);
  printPreview(links, method);

  // settings.json is generated (merged), not linked — preview it alongside.
  const settingsPreview = generateSettings(projectRoot, homeDir, {
    ...config,
    execute: false,
  });
  console.log(
    `\n⚙️  settings.json (generated real file, not linked): ${settingsPreview.message}`,
  );

  const twinPreview = generateSpTwin(projectRoot, false);
  console.log(formatSpTwinStatusLine(twinPreview.status, twinPreview.message));
  console.log(inspectGrokTwinLine(projectRoot, homeDir));

  if (!config.execute) {
    console.log("\n💡 Use --execute to create the symlinks");
    console.log("   Use --backup to save existing content");
    console.log("   Use --check to verify system permissions");
    return;
  }

  const toModify = links.filter((l) => l.status !== "already-linked");

  if (!config.force) {
    const hasExisting = links.some(
      (l) => l.status === "exists" || l.status === "conflict",
    );
    const message = hasExisting
      ? `Create ${toModify.length} links + regenerate settings.json? (existing content will be replaced${config.backup ? ", with backup" : ""})`
      : `Create ${toModify.length} links + regenerate settings.json?`;

    const confirmed = await askConfirmation(message);
    if (!confirmed) {
      console.log("❌ Cancelled");
      return;
    }
  }

  const failedLinks = toModify.length > 0 ? await createSymlinks(links, config, systemInfo) : 0;
  if (toModify.length === 0) console.log("\n✅ All symlinks already linked correctly");

  // Regenerate the body-only twin from the style SSOT (grok/codex/compare consume it).
  const twinResult = generateSpTwin(projectRoot, true);
  console.log(formatSpTwinStatusLine(twinResult.status, twinResult.message));

  // Always (re)generate the merged settings.json — per-machine, never symlinked.
  const settingsResult = generateSettings(projectRoot, homeDir, config);
  const sIcon =
    settingsResult.status === "written"
      ? "⚙️ "
      : settingsResult.status === "error"
        ? "❌"
        : "📄";
  console.log(`${sIcon} settings.json: ${settingsResult.message}`);
  if (settingsResult.status === "error") {
    console.error("❌ settings.json was not regenerated — the Claude layer is incomplete (exit 1).");
    process.exit(1);
  }

  // Acceptance check, not a file check (audit 010 regression: a boolean where the
  // schema wants a string made Claude Code drop the WHOLE user profile while this
  // script reported success). `claude doctor` validates every settings file
  // without a session or an API call; any problem naming the generated file
  // fails the sync and puts the previous file back when a backup exists.
  if (config.validate) {
    const destPath = path.join(homeDir, ".claude", MERGED_SETTINGS.dest);
    const verdict = await validateGeneratedSettings(destPath);
    console.log(formatSettingsValidationLine(verdict));
    process.exitCode = statusExitCode(verdict);
    if (!verdict.ok) {
      if (settingsResult.backupPath && fs.existsSync(settingsResult.backupPath)) {
        fs.copyFileSync(settingsResult.backupPath, destPath);
        console.log(`↩️  Restored previous settings.json from ${settingsResult.backupPath}`);
      } else {
        console.log(
          "⚠️  No backup to restore — the invalid file stays in place. Fix .claude/settings.global.json and re-run with --backup.",
        );
      }
      process.exit(1);
    }
  } else {
    console.log(formatSettingsValidationLine({ ok: true, problems: [], skipped: "--no-validate" }));
    process.exitCode = 2;
  }

  if (failedLinks > 0) {
    console.error(`\n❌ ${failedLinks} link(s) failed — see the errors above (exit 1).`);
    process.exit(1);
  }

  console.log("\n✅ Sync completed");

  if (config.backup) {
    console.log(`💾 Backup saved in ~/.claude.backup/`);
  }

  // Verify result
  console.log("\n📋 Final verification:");
  const updatedLinks = detectLinks(projectRoot, homeDir);
  const successCount = updatedLinks.filter(
    (l) => l.status === "already-linked",
  ).length;
  console.log(
    `   ${successCount}/${updatedLinks.length} folders linked correctly`,
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
