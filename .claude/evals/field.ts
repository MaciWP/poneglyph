#!/usr/bin/env bun
// bun .claude/evals/field.ts [--days 14] [--split YYYY-MM-DD]
//
// Field read, not a gate: the case-free deterministic graders run over the FINAL text of every
// real interactive turn in this machine's transcripts (~/.claude/projects/**/*.jsonl). It
// answers whether a grader that passes on synthetic cases tracks what the sessions actually
// show, and how often long tool runs stay silent (no text before the last tool call).
// Privacy floor (field data on the work machine): the output is counts and percentages only —
// never a grader `detail`, a line of text or a project name.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { collectTranscripts, percentile } from "../scripts/usage-profile";
import { bannedOpeners, blufPosition, calqueDetect, cardSeparators, esEsDetect, proseLength, type Grader } from "./graders";

export interface FieldTurn { at: string; model: string; tools: number; interim: number; final: string }

// ponytail: fixed threshold, recalibrate when the median tools per turn moves.
export const LONG_TURN_TOOLS = 8;

export const FIELD_GRADERS: [string, Grader][] = [
  ["openers", bannedOpeners],
  ["calques", calqueDetect],
  ["es-ES", esEsDetect],
  ["BLUF", blufPosition],
  ["separators", cardSeparators],
  ["prose≤15", (t) => proseLength(t, { expected: "concise" })],
];

// One turn = the lines that share a promptId (the user prompt and its tool results carry it;
// assistant lines do not, so they belong to the last one seen). Subagent lines and headless
// (`sdk-cli`) sessions are not the interactive voice and are left out.
export function extractTurns(lines: Iterable<string>): FieldTurn[] {
  const turns: FieldTurn[] = [];
  let promptId: string | undefined;
  let cur: { at: string; model: string; events: (string | null)[] } | null = null;
  const close = () => {
    if (!cur || !cur.model) return;
    const lastTool = cur.events.lastIndexOf(null);
    const texts = (from: number, to: number) => cur!.events.slice(from, to).filter((e): e is string => e !== null);
    turns.push({
      at: cur.at,
      model: cur.model,
      tools: cur.events.filter((e) => e === null).length,
      interim: lastTool < 0 ? 0 : texts(0, lastTool).length,
      final: texts(lastTool + 1, cur.events.length).join("\n\n").trim(),
    });
  };
  for (const line of lines) {
    if (!line) continue;
    let o: any;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.entrypoint === "sdk-cli") return [];
    if (o.isSidechain === true || (o.type !== "user" && o.type !== "assistant")) continue;
    if (o.type === "user") {
      if (o.promptId && o.promptId !== promptId) {
        close();
        promptId = o.promptId;
        cur = { at: o.timestamp ?? "", model: "", events: [] };
      }
      continue;
    }
    if (!cur || o.message?.model === "<synthetic>") continue;
    cur.model = o.message?.model ?? cur.model;
    for (const p of Array.isArray(o.message?.content) ? o.message.content : []) {
      if (p.type === "tool_use" || p.type === "server_tool_use") cur.events.push(null);
      else if (p.type === "text" && typeof p.text === "string" && p.text.trim()) cur.events.push(p.text);
    }
  }
  close();
  return turns;
}

export interface FieldRow {
  group: string;
  turns: number;
  noFinal: number;
  pass: Record<string, number>; // grader → share of turns with final text that pass
  long: number;
  longSilent: number; // share of long turns with no text before the last tool call
  longInterimP50: number;
}

export function summarize(turns: FieldTurn[], groupOf: (t: FieldTurn) => string): FieldRow[] {
  const groups = new Map<string, FieldTurn[]>();
  for (const t of turns) groups.set(groupOf(t), [...(groups.get(groupOf(t)) ?? []), t]);
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([group, ts]) => {
    const graded = ts.filter((t) => t.final);
    const long = ts.filter((t) => t.tools >= LONG_TURN_TOOLS);
    const share = (n: number, of: number) => (of ? n / of : 0);
    return {
      group,
      turns: ts.length,
      noFinal: ts.length - graded.length,
      pass: Object.fromEntries(FIELD_GRADERS.map(([name, g]) => [name, share(graded.filter((t) => g(t.final).pass).length, graded.length)])),
      long: long.length,
      longSilent: share(long.filter((t) => t.interim === 0).length, long.length),
      longInterimP50: percentile(long.map((t) => t.interim).sort((a, b) => a - b), 0.5),
    };
  });
}

export function renderField(rows: FieldRow[], days: number): string {
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const names = FIELD_GRADERS.map(([n]) => n);
  return [
    `## Field read — interactive turns in transcripts touched in the last ${days} days`,
    "",
    `Graders: share of turns with final text that pass. Long turn: ≥${LONG_TURN_TOOLS} tool calls; silent: no text before the last one.`,
    "",
    `| Group | Turns | No final text | ${names.join(" | ")} | Long turns | Silent long | Interim p50 (long) |`,
    `|---|---|---|${names.map(() => "---|").join("")}---|---|---|`,
    ...rows.map((r) => `| ${r.group} | ${r.turns} | ${r.noFinal} | ${names.map((n) => pct(r.pass[n])).join(" | ")} | ${r.long} | ${pct(r.longSilent)} | ${r.longInterimP50} |`),
  ].join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (flag: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const days = Number(arg("--days")) || 14;
  const split = arg("--split");
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const turns = collectTranscripts(join(homedir(), ".claude", "projects"), days)
    .flatMap((f) => { try { return extractTurns(readFileSync(f, "utf8").split("\n")); } catch { return []; } })
    .filter((t) => t.at >= since);
  const groupOf = (t: FieldTurn) => (split ? `${t.model} · ${t.at < split ? "before" : "after"} ${split}` : t.model);
  console.log(renderField(summarize(turns, groupOf), days));
}
