#!/usr/bin/env bun
// bun run usage [--days N] [--cap 200000]
//
// The SHAPE of this machine's token spend, read from the local Claude Code transcripts
// (~/.claude/projects/**/*.jsonl), the numbers the context ceiling was decided on: context per assistant
// message (p50/p90 and the share above the ceiling), the top session's share of the total, the
// first-turn floor, and tool output by tool and by Bash command family. Volume by model and day
// lives in `/usage` (official) and in claude-usage; this file answers *why* it is what it is.
// The doctor consumes contextRow() for its "Context (7d)" line.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Status } from "./doctor";
import { CONTEXT_POLICY } from "./lib/host-config";
import { claudeConfigDir } from "../hooks/lib/paths";

export interface MsgStat { model: string; ctx: number; out: number }
export interface ToolStat { tool: string; family: string; chars: number }
// A mid-session turn that re-wrote most of its context into the cache instead of reading it.
export type RewriteCause = "compact" | "pause" | "other";
export interface Rewrite { cause: RewriteCause; tokens: number }
export interface Transcript { messages: MsgStat[]; tools: ToolStat[]; rewrites: Rewrite[] }
const REWRITE_MIN_TOKENS = 30_000;

// `cd X && git status` → "git status"; `VAR=1 cat f` → "cat"; `echo a; ls` → "echo" (the composite habit).
export function bashFamily(command: string): string {
  const stripped = command
    .replace(/^\s*cd\s+(?:"[^"]*"|'[^']*'|\S+)\s*&&\s*/, "")
    .replace(/^(?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S+)\s*(?:&&|;)?\s*)+/, "")
    .trim();
  const words = stripped.split(/\s+/);
  const head = words[0] ?? "?";
  const sub = words[1];
  return /^(git|gh|bun|npx|npm|python|docker|codex|grok)$/.test(head) && sub && !sub.startsWith("-") ? `${head} ${sub}` : head;
}

export function parseTranscript(lines: Iterable<string>): Transcript {
  const messages: MsgStat[] = [];
  const tools: ToolStat[] = [];
  const names = new Map<string, { tool: string; family: string }>();
  // One API response is written as one line per content block, each repeating its usage.
  const seen = new Set<string>();
  const rewrites: Rewrite[] = [];
  let prevTs = 0, compacted = false;
  for (const line of lines) {
    if (line.includes('"compact_boundary"')) { compacted = true; continue; }
    if (!line.includes('"usage"') && !line.includes('"tool_use"') && !line.includes('"tool_result"')) continue;
    let o: any;
    try { o = JSON.parse(line); } catch { continue; }
    const m = o?.message;
    if (!m) continue;
    if (o.type === "assistant") {
      const u = m.usage;
      if (u && m.model !== "<synthetic>" && !(m.id && seen.has(m.id))) {
        const written = u.cache_creation_input_tokens ?? 0;
        messages.push({ model: m.model ?? "?", ctx: (u.input_tokens ?? 0) + written + (u.cache_read_input_tokens ?? 0), out: u.output_tokens ?? 0 });
        const ts = Date.parse(o.timestamp ?? "") || 0;
        const ttlMin = u.cache_creation?.ephemeral_1h_input_tokens ? 60 : 5;
        if (messages.length > 1 && written > REWRITE_MIN_TOKENS && written > (u.cache_read_input_tokens ?? 0)) {
          rewrites.push({ cause: compacted ? "compact" : prevTs && ts - prevTs > ttlMin * 60_000 ? "pause" : "other", tokens: written });
        }
        if (ts) prevTs = ts;
        compacted = false;
      }
      if (m.id) seen.add(m.id);
      for (const p of Array.isArray(m.content) ? m.content : []) {
        if (p.type === "tool_use") names.set(p.id, { tool: p.name, family: p.name === "Bash" && typeof p.input?.command === "string" ? bashFamily(p.input.command) : "" });
      }
    } else if (o.type === "user" && Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p.type !== "tool_result") continue;
        const n = names.get(p.tool_use_id) ?? { tool: "?", family: "" };
        // Base64 image bytes say nothing about their token cost, so they are left out.
        const s = typeof p.content === "string" ? p.content : JSON.stringify(p.content ?? "", (k, v) => (k === "data" && typeof v === "string" ? "" : v));
        tools.push({ tool: n.tool, family: n.family, chars: s.length });
      }
    }
  }
  return { messages, tools, rewrites };
}

export function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  return sortedAsc[Math.min(sortedAsc.length - 1, Math.floor((sortedAsc.length - 1) * p))];
}

export interface ContextSummary {
  sessions: number; messages: number; totalTokens: number;
  p50: number; p90: number;
  overCap: number; overCapShare: number; overCapTokenShare: number;
  topSessionShare: number; floorP50: number;
  rewriteTokens: Record<RewriteCause, number>;
}

export function summarizeContext(transcripts: Transcript[], cap: number = CONTEXT_POLICY.defaultTokens): ContextSummary {
  const ctx: number[] = [];
  const floors: number[] = [];
  let total = 0, overTokens = 0, top = 0, sessions = 0;
  const rewriteTokens: Record<RewriteCause, number> = { compact: 0, pause: 0, other: 0 };
  for (const t of transcripts) {
    if (!t.messages.length) continue;
    sessions++;
    let sessionTotal = 0;
    const first = t.messages.find((m) => m.ctx > 0);
    if (first && t.messages.length >= 3) floors.push(first.ctx);
    for (const m of t.messages) {
      ctx.push(m.ctx);
      total += m.ctx + m.out;
      sessionTotal += m.ctx + m.out;
      if (m.ctx > cap) overTokens += m.ctx;
    }
    if (sessionTotal > top) top = sessionTotal;
    for (const r of t.rewrites) rewriteTokens[r.cause] += r.tokens;
  }
  ctx.sort((a, b) => a - b);
  floors.sort((a, b) => a - b);
  const ctxTotal = ctx.reduce((a, b) => a + b, 0);
  const overCap = ctx.filter((c) => c > cap).length;
  return {
    sessions, messages: ctx.length, totalTokens: total,
    p50: percentile(ctx, 0.5), p90: percentile(ctx, 0.9),
    overCap, overCapShare: ctx.length ? overCap / ctx.length : 0, overCapTokenShare: ctxTotal ? overTokens / ctxTotal : 0,
    topSessionShare: total ? top / total : 0, floorP50: percentile(floors, 0.5),
    rewriteTokens,
  };
}

export function summarizeTools(transcripts: Transcript[]): { byTool: [string, number][]; byFamily: [string, number][] } {
  const tool = new Map<string, number>();
  const fam = new Map<string, number>();
  for (const t of transcripts) for (const r of t.tools) {
    tool.set(r.tool, (tool.get(r.tool) ?? 0) + r.chars);
    if (r.tool === "Bash") fam.set(r.family, (fam.get(r.family) ?? 0) + r.chars);
  }
  const desc = (m: Map<string, number>): [string, number][] => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return { byTool: desc(tool), byFamily: desc(fam) };
}

// Thresholds from the 2026-09-09 baseline (48.7 % of messages above 200k; top session 51.9 %).
const OVER_CAP_WARN = 0.3;
const TOP_SESSION_WARN = 0.4;
const k = (n: number) => `${Math.round(n / 1000)}k`;
const pct = (x: number) => `${Math.round(x * 100)} %`;

export function contextRow(s: ContextSummary, cap: number = CONTEXT_POLICY.defaultTokens): { status: Status; detail: string } {
  if (!s.messages) return { status: "🟢", detail: "no transcripts in the window" };
  const status: Status = s.overCapShare > OVER_CAP_WARN || s.topSessionShare > TOP_SESSION_WARN ? "🟡" : "🟢";
  const detail = `${s.sessions} sessions · ctx/msg p50 ${k(s.p50)} p90 ${k(s.p90)} · ${pct(s.overCapShare)} of msgs above ${k(cap)} carry ${pct(s.overCapTokenShare)} of context · top session ${pct(s.topSessionShare)} · first-turn floor ${k(s.floorP50)} · cache rewrites: pause ${k(s.rewriteTokens.pause)}, compact ${k(s.rewriteTokens.compact)}, other ${k(s.rewriteTokens.other)}`;
  return { status, detail: status === "🟡" ? `${detail}, long sessions are the spend: /clear between tasks, ceiling ${k(cap)}` : detail };
}

// --- IO ---------------------------------------------------------------------------

export function collectTranscripts(projectsDir: string, days: number, now = Date.now()): string[] {
  const since = now - days * 86_400_000;
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: import("node:fs").Dirent[] = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl") && statSync(p).mtimeMs >= since) out.push(p);
    }
  };
  walk(projectsDir);
  return out;
}

export function loadTranscripts(files: string[]): Transcript[] {
  return files.map((f) => {
    try { return parseTranscript(readFileSync(f, "utf8").split("\n")); } catch { return { messages: [], tools: [], rewrites: [] }; }
  });
}

function renderUsage(s: ContextSummary, tools: ReturnType<typeof summarizeTools>, days: number, cap: number): string {
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
  const lines = [
    `## Context shape, transcripts touched in the last ${days} days (${s.sessions} sessions, ${fmt(s.messages)} assistant messages, ${fmt(s.totalTokens)} tokens)`,
    "", "| Measure | Value |", "|---|---|",
    `| ctx per message p50 / p90 | ${fmt(s.p50)} / ${fmt(s.p90)} |`,
    `| messages above ${k(cap)} | ${fmt(s.overCap)} (${pct(s.overCapShare)}) carrying ${pct(s.overCapTokenShare)} of context tokens |`,
    `| top session share of total | ${pct(s.topSessionShare)} |`,
    `| first-turn floor p50 | ${fmt(s.floorP50)} |`,
    `| cache re-written mid-session (pause past TTL / compaction / other) | ${fmt(s.rewriteTokens.pause)} / ${fmt(s.rewriteTokens.compact)} / ${fmt(s.rewriteTokens.other)} |`,
    "", "## Tool output (chars in tool_result)", "", "| Tool | Chars |", "|---|---|",
    ...tools.byTool.slice(0, 10).map(([t, c]) => `| ${t} | ${fmt(c)} |`),
    "", "## Bash families", "", "| Command | Chars |", "|---|---|",
    ...tools.byFamily.slice(0, 12).map(([f, c]) => `| ${f} | ${fmt(c)} |`),
  ];
  return lines.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (flag: string, fallback: number) => { const i = argv.indexOf(flag); return i >= 0 ? Number(argv[i + 1]) || fallback : fallback; };
  const days = arg("--days", 7);
  const cap = arg("--cap", CONTEXT_POLICY.defaultTokens);
  const files = collectTranscripts(join(claudeConfigDir(), "projects"), days);
  const transcripts = loadTranscripts(files);
  const summary = summarizeContext(transcripts, cap);
  console.log(renderUsage(summary, summarizeTools(transcripts), days, cap));
  const row = contextRow(summary, cap);
  console.log(`\n${row.status} ${row.detail}`);
}
