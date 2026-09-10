#!/usr/bin/env bun
// bun run doctor [--fast] [--ci] [--md <file>]
//
// One table that says whether the poneglyph layer is ON (plan 032/WP6, audit 010 R2):
// sync status of the Claude layer and the Codex adapter, structural validation of
// .claude, the test suite, the always-loaded budget, and a privacy grep for company
// terms that must not live in this public repo. Exit 1 on any 🔴.
//
//   --fast   skip `bun test ./.claude/` (the slowest check)
//   --ci     skip machine-bound sync/session checks; local privacy terms are optional
//   --md F   also write the table as markdown to F (input for the html-report skill)
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compare, loadSnapshot, measure, total } from "./lib/budget";
import { detectHosts, realProbe } from "./lib/hosts";
import { check, type Report } from "./check-config";
import { collectTranscripts, contextRow, loadTranscripts, summarizeContext } from "./usage-profile";

export type Status = "🟢" | "🟡" | "🔴";
export interface Check {
  name: string;
  status: Status;
  detail: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, "..", "..");

// --- pure helpers (unit-tested) -----------------------------------------------

export function worstOf(statuses: Status[]): Status {
  if (statuses.includes("🔴")) return "🔴";
  if (statuses.includes("🟡")) return "🟡";
  return "🟢";
}

// sync-claude / sync-codex print one status line per item; the worst icon wins.
export function summarizeSyncOutput(output: string): Check["detail"] & string {
  const icons = output.match(/🟢|🟡|🔴|⚪/g) ?? [];
  if (!icons.length) return "no recognized sync inventory";
  const bad = icons.filter((i) => i !== "🟢").length;
  return bad === 0 ? `${icons.length} items 🟢` : `${bad}/${icons.length} items not 🟢`;
}

// Row-anchored on purpose (review of 032, F7): a row STARTS with its status — sync-claude
// prints "🔴 …" / "STALE symlink", sync-codex prints "missing  <path>". The bare word
// "missing" inside a detail sentence must not turn the doctor red.
export function statusFromSyncOutput(output: string, exitCode = 0): Status {
  if (exitCode !== 0 || !/^\s*(?:🟢|🟡|🔴|⚪|linked\s|missing\s|stale\s|conflict\s|local\s)/m.test(output)) return "🔴";
  let worst: Status = "🟢";
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(🔴|missing\b|stale\b|conflict\b|local\b)/.test(line) || /REJECTED|STALE symlink/.test(line)) return "🔴";
    if (/^(🟡|⚪)/.test(line)) worst = "🟡";
  }
  return worst;
}

// A green suite needs three things (review of 032, E13/E17): exit code 0, the runner's own
// "Ran N tests" line (a run that aborted early prints no total), and zero failures.
export function summarizeTests(output: string, exitCode = 0): { status: Status; detail: string } {
  // Parse the runner's contiguous footer, not test names or an earlier run.
  const footer = [...output.matchAll(/^[ \t]*(\d+) pass[ \t]*\r?\n((?:[ \t]*\d+ (?:skip|todo)[ \t]*\r?\n)*)[ \t]*(\d+) fail[ \t]*\r?\n(?:[ \t]*\d+ expect\(\) calls[ \t]*\r?\n)?Ran (\d+) tests?\b[^\r\n]*/gm)].at(-1);
  const pass = Number(footer?.[1] ?? NaN);
  const fail = Number(footer?.[3] ?? NaN);
  const ran = Number(footer?.[4] ?? NaN);
  if (exitCode !== 0) return { status: "🔴", detail: `bun test exited ${exitCode}${fail > 0 ? ` — ${fail} fail / ${pass} pass` : ""}` };
  const lastRun = [...output.matchAll(/^Ran \d+ tests?\b[^\r\n]*/gm)].at(-1);
  if (!lastRun) return { status: "🔴", detail: "no 'Ran N tests' line — the run did not complete" };
  const skipped = [...(footer?.[2] ?? "").matchAll(/(\d+) (?:skip|todo)/g)].reduce((n, m) => n + Number(m[1]), 0);
  if (!footer || footer.index! + footer[0].lastIndexOf("Ran ") !== lastRun.index || !ran || pass + fail + skipped !== ran) return { status: "🔴", detail: "invalid or inconsistent test summary" };
  if (fail > 0) return { status: "🔴", detail: `${fail} fail / ${pass} pass (${ran} tests)` };
  if (!pass) return { status: "🔴", detail: "no tests passed; skipped tests are not verification" };
  return { status: "🟢", detail: `${pass} pass (${ran} tests)` };
}

export function summarizeValidate(output: string, exitCode = 0): { status: Status; detail: string } {
  return exitCode === 0 && /Validation passed/.test(output)
    ? { status: "🟢", detail: "claude plugin validate .claude passed" }
    : { status: "🔴", detail: "Native plugin validation failed or returned no recognized result." };
}

export function summarizeConfig(report: Report): { status: Status; detail: string } {
  const errors = report.findings.filter(f => f.severity === "error").length;
  const warnings = report.findings.length - errors;
  const privacyUnchecked = report.findings.some(f => f.rule === "privacy.unchecked");
  return {
    status: errors ? "🔴" : warnings ? "🟡" : "🟢",
    detail: `${report.skills} skills, ${errors} errors, ${warnings} warnings; ${privacyUnchecked ? "corporate privacy unchecked" : "local privacy policy checked"}. Run bun run check:config for redacted details.`,
  };
}

// Sessions started today under this project, grouped by the first model seen in each
// transcript (plan 033, D3). 82 in one day — 44 Opus + 29 Fable — is what this row exists
// to make visible before the quota does.
export const SESSIONS_PER_DAY_WARN = 20;
export function summarizeSessions(models: string[], warnAt = SESSIONS_PER_DAY_WARN): { status: Status; detail: string } {
  const counts = new Map<string, number>();
  for (const m of models) counts.set(m, (counts.get(m) ?? 0) + 1);
  const expensive = [...counts.entries()].filter(([m]) => /fable|opus/i.test(m)).reduce((a, [, n]) => a + n, 0);
  const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m.replace(/^claude-/, "").replace(/-\d{8}$/, "")} ${n}`);
  const detail = `${models.length} sessions today${parts.length ? ` (${parts.join(" · ")})` : ""}`;
  const status: Status = models.length > warnAt || (expensive > 0 && models.length > 5) ? "🟡" : "🟢";
  return { status, detail: status === "🟡" ? `${detail} — headless runs are spawns: cheap tier + permission (lessons G13)` : detail };
}

export function renderChecks(checks: Check[]): string {
  return ["| Check | Estado | Detalle |", "|---|---|---|", ...checks.map((c) => `| ${c.name} | ${c.status} | ${c.detail} |`)].join("\n");
}

export function exitCodeFor(checks: Check[]): number {
  return checks.some((c) => c.status === "🔴") ? 1 : 0;
}

// --- runners ------------------------------------------------------------------

async function run(cmd: string[], cwd = REPO, env: Record<string, string> = {}): Promise<{ out: string; code: number }> {
  try {
    const proc = Bun.spawn(cmd, { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
    const [o, e] = await Promise.all([new Response(proc.stdout as ReadableStream).text(), new Response(proc.stderr as ReadableStream).text()]);
    const code = await proc.exited;
    return { out: `${o}\n${e}`, code };
  } catch (error) {
    return { out: `not runnable: ${error instanceof Error ? error.message : String(error)}`, code: 127 };
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const fast = argv.includes("--fast");
  const ci = argv.includes("--ci");
  const mdIdx = argv.indexOf("--md");
  const mdFile = mdIdx >= 0 ? argv[mdIdx + 1] : undefined;
  const checks: Check[] = [];

  // Same detector as /sync-poneglyph: a host that is not installed is skipped, not red.
  const hosts = new Map(detectHosts(realProbe()).map((h) => [h.name, h]));
  const skipped = (name: string): Check => ({ name, status: "🟡", detail: "not installed on this machine — skipped" });
  if (!ci) {
    if (hosts.get("claude")!.installed) {
      const sc = await run(["bun", ".claude/scripts/sync-claude.ts", "--status"]);
      checks.push({ name: "Claude layer (sync-claude --status)", status: statusFromSyncOutput(sc.out, sc.code), detail: summarizeSyncOutput(sc.out) });
    } else checks.push(skipped("Claude layer (sync-claude --status)"));
    const codex = hosts.get("codex")!;
    if (codex.installed) {
      for (const profile of codex.targets) {
        const cx = await run(["bun", ".claude/scripts/sync-codex.ts", "--status"], REPO, { CODEX_HOME: profile });
        const cxBad = (cx.out.match(/missing|stale|conflict/gi) ?? []).length;
        checks.push({ name: `Codex adapter (${profile})`, status: statusFromSyncOutput(cx.out, cx.code), detail: cxBad ? `${cxBad} entries not linked` : `${(cx.out.match(/linked/g) ?? []).length} linked` });
      }
    } else checks.push(skipped("Codex adapter (sync-codex --status)"));
    if (hosts.get("grok")!.installed) {
      const gx = await run(["bun", ".claude/scripts/sync-grok.ts", "--status"]);
      checks.push({ name: "Grok adapter (configuration)", status: statusFromSyncOutput(gx.out, gx.code), detail: "Style, native hook configuration, and Claude compatibility; no model or MCP connection." });
    } else checks.push(skipped("Grok adapter (configuration)"));
    checks.push({ name: "Native execution evidence", status: "🟡", detail: "Configuration checks do not establish Codex hook trust, model activation, or MCP connectivity; inspect the native UI and report those gates separately." });
  }

  if (hosts.get("claude")!.cli) {
    const v = await run(["claude", "plugin", "validate", ".claude"]);
    checks.push({ name: "Structure (claude plugin validate)", ...summarizeValidate(v.out, v.code) });
  } else checks.push({ name: "Structure (claude plugin validate)", status: "🟡", detail: "claude CLI not on PATH — structural validation skipped" });

  if (!fast) {
    const t = await run(["bun", "test", "./.claude/"]);
    checks.push({ name: "Suite (bun test ./.claude/)", ...summarizeTests(t.out, t.code) });
  } else {
    checks.push({ name: "Suite (bun test ./.claude/)", status: "🟡", detail: "skipped (--fast)" });
  }

  const snapshot = loadSnapshot(join(here, "lib"));
  const m = measure(REPO);
  if (!snapshot) {
    checks.push({ name: "Always-loaded budget", status: "🟡", detail: `${total(m.alwaysLoaded)} B, no snapshot — bun .claude/scripts/budget.ts --update` });
  } else {
    const viol = compare(m, snapshot);
    checks.push({ name: "Always-loaded budget", status: viol.length ? "🔴" : "🟢", detail: viol.length ? viol.map((x) => `${x.key} ${x.snapshot}→${x.current}`).join("; ") : `${total(m.alwaysLoaded)} B ≤ snapshot ${total(snapshot.alwaysLoaded)} B (ratchet 0 %, plan 037)` });
  }

  try {
    checks.push({ name: "Configuration and privacy", ...summarizeConfig(check(REPO).report) });
  } catch {
    checks.push({ name: "Configuration and privacy", status: "🔴", detail: "Validation could not complete; private details withheld." });
  }

  if (!ci) {
    // ~/.claude/projects/<slug>/ where slug = the repo path with separators and ':' as '-'.
    const slug = REPO.replace(/[\\/:]/g, "-");
    const projDir = join(homedir(), ".claude", "projects", slug);
    const models: string[] = [];
    if (existsSync(projDir)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const f of readdirSync(projDir)) {
        if (!f.endsWith(".jsonl")) continue;
        const p = join(projDir, f);
        if (statSync(p).mtimeMs < today.getTime()) continue;
        const head = readFileSync(p, { encoding: "utf8", flag: "r" }).slice(0, 256 * 1024);
        models.push(head.match(/"model":"(claude-[a-z0-9-]+)"/)?.[1] ?? "unknown");
      }
    }
    checks.push({ name: "Sessions today (this project)", ...summarizeSessions(models) });
    // Shape of the spend across every project on this machine (plan 037): the ceiling is 200k by
    // default (`autoCompactWindow`), so messages above it are the sessions that cost.
    const transcripts = loadTranscripts(collectTranscripts(join(homedir(), ".claude", "projects"), 7));
    checks.push({ name: "Context (7d, this machine)", ...contextRow(summarizeContext(transcripts)) });
  }

  const table = renderChecks(checks);
  console.log(table);
  if (mdFile) {
    writeFileSync(mdFile, `# poneglyph doctor — ${new Date().toISOString().slice(0, 10)}\n\n${table}\n`);
    console.log(`\nmarkdown → ${mdFile}`);
  }
  process.exit(exitCodeFor(checks));
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
