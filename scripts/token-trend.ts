#!/usr/bin/env bun
// Comprehensive Claude Code usage report.
// Reads all local JSONL transcripts and produces a structured report:
// 1. Executive summary
// 2. Per-model distribution
// 3. Per-project distribution (top 10)
// 4. Weekly trend
// 5. Cache efficiency + counterfactual savings
// 6. Tool use intensity
// 7. Top 10 most expensive sessions

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const PROJECTS_DIR = join(process.env.USERPROFILE || process.env.HOME!, ".claude", "projects");

// Pricing per 1M tokens (USD, public API rates).
// Cache_creation rates reflect the 1h ephemeral tier (5m is cheaper).
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheCreate: number }> = {
  "claude-opus-4-7":       { input: 15,   output: 75,   cacheRead: 1.5,  cacheCreate: 18.75 },
  "claude-opus-4-6":       { input: 15,   output: 75,   cacheRead: 1.5,  cacheCreate: 18.75 },
  "claude-opus-4-5":       { input: 15,   output: 75,   cacheRead: 1.5,  cacheCreate: 18.75 },
  "claude-sonnet-4-6":     { input: 3,    output: 15,   cacheRead: 0.3,  cacheCreate: 3.75 },
  "claude-sonnet-4-5":     { input: 3,    output: 15,   cacheRead: 0.3,  cacheCreate: 3.75 },
  "claude-haiku-4-5":      { input: 0.8,  output: 4,    cacheRead: 0.08, cacheCreate: 1.0 },
};

function modelKey(rawModel: string): string {
  return rawModel.replace(/-2\d{7}.*$/, "").replace(/-2026\d{4}.*$/, "");
}

function priceFor(model: string) {
  const k = modelKey(model);
  return PRICING[k] ?? PRICING["claude-sonnet-4-6"];
}

type SessionStats = {
  sessionId: string;
  projectDir: string;
  cwd: string | null;
  firstTs: string | null;
  lastTs: string | null;
  userMsgs: number;
  assistantMsgs: number;
  toolUses: Map<string, number>;
  agentInvocations: Map<string, number>;
  skillInvocations: Map<string, number>;
  slashCommands: Map<string, number>;
  toolErrorsByTool: Map<string, number>;
  toolCallsByToolId: Map<string, string>;
  interruptions: number;
  fileReads: Map<string, number>;
  bashExitErrors: number;
  modelTokens: Map<string, { input: number; output: number; cacheRead: number; cacheCreate: number }>;
};

function newSession(sessionId: string, projectDir: string): SessionStats {
  return {
    sessionId,
    projectDir,
    cwd: null,
    firstTs: null,
    lastTs: null,
    userMsgs: 0,
    assistantMsgs: 0,
    toolUses: new Map(),
    agentInvocations: new Map(),
    skillInvocations: new Map(),
    slashCommands: new Map(),
    toolErrorsByTool: new Map(),
    toolCallsByToolId: new Map(),
    interruptions: 0,
    fileReads: new Map(),
    bashExitErrors: 0,
    modelTokens: new Map(),
  };
}

function addTokens(s: SessionStats, model: string, usage: any) {
  const m = modelKey(model);
  const cur = s.modelTokens.get(m) ?? { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
  cur.input += usage.input_tokens || 0;
  cur.output += usage.output_tokens || 0;
  cur.cacheRead += usage.cache_read_input_tokens || 0;
  cur.cacheCreate += usage.cache_creation_input_tokens || 0;
  s.modelTokens.set(m, cur);
}

function totalCost(s: SessionStats): number {
  let cost = 0;
  for (const [model, t] of s.modelTokens) {
    const p = priceFor(model);
    cost += (t.input * p.input + t.output * p.output + t.cacheRead * p.cacheRead + t.cacheCreate * p.cacheCreate) / 1_000_000;
  }
  return cost;
}

function totalTokens(s: SessionStats): number {
  let total = 0;
  for (const t of s.modelTokens.values()) total += t.input + t.output + t.cacheRead + t.cacheCreate;
  return total;
}

function counterfactualCost(s: SessionStats): number {
  // What it would have cost without cache (cache_read + cache_create treated as plain input).
  let cost = 0;
  for (const [model, t] of s.modelTokens) {
    const p = priceFor(model);
    const inputEquiv = t.input + t.cacheRead + t.cacheCreate;
    cost += (inputEquiv * p.input + t.output * p.output) / 1_000_000;
  }
  return cost;
}

const sessions: SessionStats[] = [];

for (const projDir of readdirSync(PROJECTS_DIR)) {
  const full = join(PROJECTS_DIR, projDir);
  if (!statSync(full).isDirectory()) continue;
  for (const f of readdirSync(full)) {
    if (!f.endsWith(".jsonl")) continue;
    const sessionId = f.replace(/\.jsonl$/, "");
    const s = newSession(sessionId, projDir);
    const filePath = join(full, f);

    let content: string;
    try { content = readFileSync(filePath, "utf8"); } catch { continue; }

    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      let obj: any;
      try { obj = JSON.parse(line); } catch { continue; }

      if (obj.timestamp) {
        if (!s.firstTs || obj.timestamp < s.firstTs) s.firstTs = obj.timestamp;
        if (!s.lastTs || obj.timestamp > s.lastTs) s.lastTs = obj.timestamp;
      }
      if (obj.cwd && !s.cwd) s.cwd = obj.cwd;

      if (obj.type === "user") {
        s.userMsgs++;
        const content = obj.message?.content;
        const text = typeof content === "string" ? content : Array.isArray(content) ? content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n") : "";
        const cmdMatches = text.match(/<command-name>\/?([a-zA-Z0-9_:.\-]+)<\/command-name>/g);
        if (cmdMatches) {
          for (const m of cmdMatches) {
            const name = m.replace(/<\/?command-name>/g, "").replace(/^\//, "");
            s.slashCommands.set(name, (s.slashCommands.get(name) ?? 0) + 1);
          }
        }
        // Tool error detection
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === "tool_result") {
              const txt = typeof block.content === "string" ? block.content : Array.isArray(block.content) ? block.content.map((b: any) => b?.text || "").join("") : "";
              const isErr = block.is_error === true;
              const toolName = s.toolCallsByToolId.get(block.tool_use_id) ?? "?";
              if (isErr) {
                s.toolErrorsByTool.set(toolName, (s.toolErrorsByTool.get(toolName) ?? 0) + 1);
              } else if (toolName === "Bash" && /^Exit code [1-9]/m.test(txt)) {
                s.bashExitErrors++;
              }
              if (/<interrupted/i.test(txt)) s.interruptions++;
            }
          }
        }
      } else if (obj.type === "assistant") {
        s.assistantMsgs++;
        const msg = obj.message;
        if (msg?.usage && msg?.model) addTokens(s, msg.model, msg.usage);
        if (Array.isArray(msg?.content)) {
          for (const block of msg.content) {
            if (block?.type === "tool_use" && block.name) {
              s.toolUses.set(block.name, (s.toolUses.get(block.name) ?? 0) + 1);
              if (block.id) s.toolCallsByToolId.set(block.id, block.name);
              if (block.name === "Agent" && block.input?.subagent_type) {
                const a = block.input.subagent_type;
                s.agentInvocations.set(a, (s.agentInvocations.get(a) ?? 0) + 1);
              } else if (block.name === "Skill" && block.input?.skill) {
                const sk = block.input.skill;
                s.skillInvocations.set(sk, (s.skillInvocations.get(sk) ?? 0) + 1);
              } else if (block.name === "Read" && block.input?.file_path) {
                const fp = block.input.file_path;
                s.fileReads.set(fp, (s.fileReads.get(fp) ?? 0) + 1);
              }
            }
          }
        }
      }
    }

    if (s.userMsgs + s.assistantMsgs > 0) sessions.push(s);
  }
}

// ----- AGGREGATIONS -----
const totalSessions = sessions.length;
const totalUserMsgs = sessions.reduce((a, s) => a + s.userMsgs, 0);
const totalAsstMsgs = sessions.reduce((a, s) => a + s.assistantMsgs, 0);
const totalCostAll = sessions.reduce((a, s) => a + totalCost(s), 0);
const totalTokensAll = sessions.reduce((a, s) => a + totalTokens(s), 0);
const totalCounterfactual = sessions.reduce((a, s) => a + counterfactualCost(s), 0);

const allTimestamps = sessions.map(s => s.lastTs).filter(Boolean).sort();
const firstActivity = allTimestamps[0]?.slice(0, 10) ?? "n/a";
const lastActivity = allTimestamps[allTimestamps.length - 1]?.slice(0, 10) ?? "n/a";

// Per-model
type ModelAgg = { input: number; output: number; cacheRead: number; cacheCreate: number; cost: number; sessions: Set<string> };
const byModel = new Map<string, ModelAgg>();
for (const s of sessions) {
  for (const [model, t] of s.modelTokens) {
    const agg = byModel.get(model) ?? { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, cost: 0, sessions: new Set() };
    agg.input += t.input;
    agg.output += t.output;
    agg.cacheRead += t.cacheRead;
    agg.cacheCreate += t.cacheCreate;
    const p = priceFor(model);
    agg.cost += (t.input * p.input + t.output * p.output + t.cacheRead * p.cacheRead + t.cacheCreate * p.cacheCreate) / 1_000_000;
    agg.sessions.add(s.sessionId);
    byModel.set(model, agg);
  }
}

// Per-project (cwd or projectDir fallback)
type ProjAgg = { sessions: number; userMsgs: number; asstMsgs: number; tokens: number; cost: number };
const byProject = new Map<string, ProjAgg>();
for (const s of sessions) {
  const key = s.cwd || s.projectDir;
  const agg = byProject.get(key) ?? { sessions: 0, userMsgs: 0, asstMsgs: 0, tokens: 0, cost: 0 };
  agg.sessions++;
  agg.userMsgs += s.userMsgs;
  agg.asstMsgs += s.assistantMsgs;
  agg.tokens += totalTokens(s);
  agg.cost += totalCost(s);
  byProject.set(key, agg);
}

// Per-week
function isoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

type WeekAgg = { sessions: number; userMsgs: number; asstMsgs: number; tokens: number; cacheRead: number; cacheCreate: number; cost: number };
const byWeek = new Map<string, WeekAgg>();
for (const s of sessions) {
  if (!s.lastTs) continue;
  const w = isoWeek(s.lastTs);
  const agg = byWeek.get(w) ?? { sessions: 0, userMsgs: 0, asstMsgs: 0, tokens: 0, cacheRead: 0, cacheCreate: 0, cost: 0 };
  agg.sessions++;
  agg.userMsgs += s.userMsgs;
  agg.asstMsgs += s.assistantMsgs;
  agg.tokens += totalTokens(s);
  agg.cost += totalCost(s);
  for (const t of s.modelTokens.values()) {
    agg.cacheRead += t.cacheRead;
    agg.cacheCreate += t.cacheCreate;
  }
  byWeek.set(w, agg);
}

// Tool use aggregation
const toolUseTotal = new Map<string, number>();
const agentTotal = new Map<string, number>();
const skillTotal = new Map<string, number>();
const cmdTotal = new Map<string, number>();
const toolErrorTotal = new Map<string, number>();
const fileReReadsTotal = new Map<string, number>();
let totalInterruptions = 0;
let totalBashExitErrors = 0;
for (const s of sessions) {
  for (const [tool, n] of s.toolUses) toolUseTotal.set(tool, (toolUseTotal.get(tool) ?? 0) + n);
  for (const [a, n] of s.agentInvocations) agentTotal.set(a, (agentTotal.get(a) ?? 0) + n);
  for (const [sk, n] of s.skillInvocations) skillTotal.set(sk, (skillTotal.get(sk) ?? 0) + n);
  for (const [c, n] of s.slashCommands) cmdTotal.set(c, (cmdTotal.get(c) ?? 0) + n);
  for (const [t, n] of s.toolErrorsByTool) toolErrorTotal.set(t, (toolErrorTotal.get(t) ?? 0) + n);
  for (const [fp, n] of s.fileReads) {
    if (n > 1) fileReReadsTotal.set(fp, (fileReReadsTotal.get(fp) ?? 0) + (n - 1));
  }
  totalInterruptions += s.interruptions;
  totalBashExitErrors += s.bashExitErrors;
}
const totalToolErrors = Array.from(toolErrorTotal.values()).reduce((a, b) => a + b, 0);
const totalToolCalls = Array.from(toolUseTotal.values()).reduce((a, b) => a + b, 0);
const totalReReads = Array.from(fileReReadsTotal.values()).reduce((a, b) => a + b, 0);

// ----- OUTPUT -----
function fmt(n: number): string { return n.toLocaleString("es-ES"); }
function pct(n: number, total: number): string { return total > 0 ? ((n / total) * 100).toFixed(1) + "%" : "0%"; }

function printTable(rows: (string | number)[][], align: ("l" | "r")[] = []) {
  const str = rows.map(r => r.map(c => String(c)));
  const widths = str[0].map((_, i) => Math.max(...str.map(r => (r[i] ?? "").length)));
  for (const row of str) {
    console.log(row.map((c, i) => (align[i] === "l" ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  "));
  }
}

console.log("\n========================================================");
console.log("  CLAUDE CODE — INFORME DE USO");
console.log("========================================================\n");

console.log("## 1. Resumen ejecutivo\n");
const cacheReads = Array.from(byModel.values()).reduce((a, m) => a + m.cacheRead, 0);
const cacheCreates = Array.from(byModel.values()).reduce((a, m) => a + m.cacheCreate, 0);
const freshInputs = Array.from(byModel.values()).reduce((a, m) => a + m.input, 0);
const outputs = Array.from(byModel.values()).reduce((a, m) => a + m.output, 0);

printTable([
  ["Periodo cubierto",       firstActivity + " → " + lastActivity],
  ["Sesiones",               fmt(totalSessions)],
  ["Mensajes (user)",        fmt(totalUserMsgs)],
  ["Mensajes (assistant)",   fmt(totalAsstMsgs)],
  ["Tokens totales",         fmt(totalTokensAll)],
  ["  - Input fresh",        fmt(freshInputs) + "  (" + pct(freshInputs, totalTokensAll) + ")"],
  ["  - Cache read",         fmt(cacheReads) + "  (" + pct(cacheReads, totalTokensAll) + ")"],
  ["  - Cache create",       fmt(cacheCreates) + "  (" + pct(cacheCreates, totalTokensAll) + ")"],
  ["  - Output",             fmt(outputs) + "  (" + pct(outputs, totalTokensAll) + ")"],
  ["Coste USD equiv. API",   "$" + totalCostAll.toFixed(2)],
  ["Sin cache costaría",     "$" + totalCounterfactual.toFixed(2)],
  ["Ahorro por cache",       "$" + (totalCounterfactual - totalCostAll).toFixed(2) + "  (" + pct(totalCounterfactual - totalCostAll, totalCounterfactual) + ")"],
  ["Avg tokens / sesión",    totalSessions > 0 ? fmt(Math.round(totalTokensAll / totalSessions)) : "n/a"],
  ["Avg tokens / msg",       (totalUserMsgs + totalAsstMsgs) > 0 ? fmt(Math.round(totalTokensAll / (totalUserMsgs + totalAsstMsgs))) : "n/a"],
  ["Avg msgs / sesión",      totalSessions > 0 ? ((totalUserMsgs + totalAsstMsgs) / totalSessions).toFixed(1) : "n/a"],
], ["l", "l"]);

console.log("\n## 2. Distribución por modelo\n");
const modelRows: (string | number)[][] = [["Modelo", "Sesiones", "Input", "Cache R", "Cache C", "Output", "Tokens", "% gasto", "USD"]];
const modelSorted = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
for (const [model, agg] of modelSorted) {
  const tot = agg.input + agg.output + agg.cacheRead + agg.cacheCreate;
  modelRows.push([
    model,
    agg.sessions.size,
    fmt(agg.input),
    fmt(agg.cacheRead),
    fmt(agg.cacheCreate),
    fmt(agg.output),
    fmt(tot),
    pct(agg.cost, totalCostAll),
    "$" + agg.cost.toFixed(2),
  ]);
}
printTable(modelRows, ["l"]);

console.log("\n## 3. Top 10 proyectos por gasto\n");
const projSorted = [...byProject.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, 10);
const projRows: (string | number)[][] = [["Proyecto", "Sess", "User msgs", "Asst msgs", "Tokens", "% gasto", "USD"]];
for (const [proj, agg] of projSorted) {
  const short = proj.length > 50 ? "..." + proj.slice(-47) : proj;
  projRows.push([short, agg.sessions, fmt(agg.userMsgs), fmt(agg.asstMsgs), fmt(agg.tokens), pct(agg.cost, totalCostAll), "$" + agg.cost.toFixed(2)]);
}
printTable(projRows, ["l"]);

console.log("\n## 4. Tendencia semanal\n");
const weekSorted = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const weekRows: (string | number)[][] = [["Semana", "Sess", "User", "Asst", "Tokens", "Tok/msg", "Cache%", "USD"]];
for (const [w, agg] of weekSorted) {
  const totalMsgs = agg.userMsgs + agg.asstMsgs;
  weekRows.push([
    w,
    agg.sessions,
    fmt(agg.userMsgs),
    fmt(agg.asstMsgs),
    fmt(agg.tokens),
    totalMsgs > 0 ? fmt(Math.round(agg.tokens / totalMsgs)) : "n/a",
    pct(agg.cacheRead, agg.tokens),
    "$" + agg.cost.toFixed(2),
  ]);
}
printTable(weekRows, ["l"]);

console.log("\n## 5. Top 15 tool uses\n");
const toolSorted = [...toolUseTotal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
const toolTotal = Array.from(toolUseTotal.values()).reduce((a, b) => a + b, 0);
const toolRows: (string | number)[][] = [["Tool", "Llamadas", "%"]];
for (const [t, n] of toolSorted) toolRows.push([t, fmt(n), pct(n, toolTotal)]);
toolRows.push(["TOTAL", fmt(toolTotal), "100%"]);
printTable(toolRows, ["l"]);

console.log("\n## 6. Subagentes invocados\n");
const agentSorted = [...agentTotal.entries()].sort((a, b) => b[1] - a[1]);
const agentTotalCount = Array.from(agentTotal.values()).reduce((a, b) => a + b, 0);
if (agentSorted.length === 0) console.log("(ningún subagente invocado)");
else {
  const agentRows: (string | number)[][] = [["Subagent", "Invocaciones", "%"]];
  for (const [a, n] of agentSorted) agentRows.push([a, fmt(n), pct(n, agentTotalCount)]);
  agentRows.push(["TOTAL", fmt(agentTotalCount), "100%"]);
  printTable(agentRows, ["l"]);
}

console.log("\n## 7. Skills invocadas\n");
const skillSorted = [...skillTotal.entries()].sort((a, b) => b[1] - a[1]);
const skillTotalCount = Array.from(skillTotal.values()).reduce((a, b) => a + b, 0);
if (skillSorted.length === 0) console.log("(ninguna skill invocada)");
else {
  const skillRows: (string | number)[][] = [["Skill", "Invocaciones", "%"]];
  for (const [sk, n] of skillSorted) skillRows.push([sk, fmt(n), pct(n, skillTotalCount)]);
  skillRows.push(["TOTAL", fmt(skillTotalCount), "100%"]);
  printTable(skillRows, ["l"]);
}

console.log("\n## 8. Slash commands lanzados\n");
const cmdSorted = [...cmdTotal.entries()].sort((a, b) => b[1] - a[1]);
const cmdTotalCount = Array.from(cmdTotal.values()).reduce((a, b) => a + b, 0);
if (cmdSorted.length === 0) console.log("(ningún slash command detectado)");
else {
  const cmdRows: (string | number)[][] = [["Comando", "Veces", "%"]];
  for (const [c, n] of cmdSorted) cmdRows.push(["/" + c, fmt(n), pct(n, cmdTotalCount)]);
  cmdRows.push(["TOTAL", fmt(cmdTotalCount), "100%"]);
  printTable(cmdRows, ["l"]);
}

console.log("\n## 9. Errores y desperdicio de tokens\n");
const wasteApproxCost = totalCostAll * (totalToolErrors / Math.max(totalToolCalls, 1));
printTable([
  ["Tool calls totales",        fmt(totalToolCalls)],
  ["Tool errors (is_error=true)", fmt(totalToolErrors) + "  (" + pct(totalToolErrors, totalToolCalls) + ")"],
  ["Bash con exit code != 0",   fmt(totalBashExitErrors)],
  ["Mensajes interrumpidos",    fmt(totalInterruptions)],
  ["Re-lecturas mismo file (>1x)", fmt(totalReReads)],
  ["Coste-desperdicio aprox.",  "$" + wasteApproxCost.toFixed(2) + "  (" + pct(totalToolErrors, totalToolCalls) + " del coste)"],
], ["l", "l"]);

console.log("\n### Errores por tool\n");
const errSorted = [...toolErrorTotal.entries()].sort((a, b) => b[1] - a[1]);
if (errSorted.length === 0) console.log("(sin errores registrados)");
else {
  const errRows: (string | number)[][] = [["Tool", "Errores", "Total calls", "Tasa error"]];
  for (const [t, n] of errSorted) {
    const calls = toolUseTotal.get(t) ?? 0;
    errRows.push([t, fmt(n), fmt(calls), pct(n, calls)]);
  }
  printTable(errRows, ["l"]);
}

console.log("\n### Top 10 ficheros más re-leídos en la misma sesión\n");
const reReadsSorted = [...fileReReadsTotal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
if (reReadsSorted.length === 0) console.log("(sin re-lecturas detectadas)");
else {
  const rrRows: (string | number)[][] = [["Re-lecturas", "Fichero"]];
  for (const [fp, n] of reReadsSorted) {
    const short = fp.length > 70 ? "..." + fp.slice(-67) : fp;
    rrRows.push([fmt(n), short]);
  }
  printTable(rrRows);
}

console.log("\n### Top 10 sesiones con más errores\n");
const errSessSorted = [...sessions]
  .map(s => ({ s, errors: Array.from(s.toolErrorsByTool.values()).reduce((a, b) => a + b, 0) }))
  .filter(x => x.errors > 0)
  .sort((a, b) => b.errors - a.errors)
  .slice(0, 10);
if (errSessSorted.length === 0) console.log("(sin sesiones con errores)");
else {
  const esRows: (string | number)[][] = [["Fecha", "Errores", "Interrup.", "USD", "Proyecto"]];
  for (const { s, errors } of errSessSorted) {
    const proj = (s.cwd || s.projectDir).split(/[\\/]/).pop() || "?";
    esRows.push([(s.lastTs ?? "").slice(0, 10), fmt(errors), fmt(s.interruptions), "$" + totalCost(s).toFixed(2), proj]);
  }
  printTable(esRows, ["l"]);
}

console.log("\n## 10. Top 10 sesiones más caras\n");
const sessSorted = [...sessions].sort((a, b) => totalCost(b) - totalCost(a)).slice(0, 10);
const sessRows: (string | number)[][] = [["Fecha", "User", "Asst", "Tokens", "USD", "Proyecto"]];
for (const s of sessSorted) {
  const proj = (s.cwd || s.projectDir).split(/[\\/]/).pop() || "?";
  sessRows.push([
    (s.lastTs ?? "").slice(0, 10),
    fmt(s.userMsgs),
    fmt(s.assistantMsgs),
    fmt(totalTokens(s)),
    "$" + totalCost(s).toFixed(2),
    proj,
  ]);
}
printTable(sessRows, ["l"]);

console.log("\n========================================================\n");
