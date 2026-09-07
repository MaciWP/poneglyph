#!/usr/bin/env bun
// A/B comparator for the poneglyph system-prompt channel (plan: indexed-nebula).
// Runs the SAME prompt through two claude invocations that differ in ONE variable
// (the injected system prompt / config layer) and reports outputs + style markers.
// This is an EXPLORATION tool (eyeball + descriptive markers), not a pass/fail gate —
// the regression gate is run.ts. Run it OUTSIDE a sandboxed agent session: it spawns
// live `claude -p` processes (nested sandboxed runs die — see evals/README.md).
//
// Usage:
//   bun .claude/evals/compare.ts "<prompt>" [--preset sp|stock|style-vs-sp|dupe]
//                                 [--runs N] [--tools] [--dry-run]
//
// Presets (side A = control, side B = variant):
//   sp          style OFF vs style OFF + poneglyph-sp.md appended  (default)
//   stock       --bare (whole poneglyph layer OFF; needs ANTHROPIC_API_KEY) vs full layer
//   style-vs-sp outputStyle channel vs system-prompt channel
//   dupe        style Poneglyph alone vs style + sp append (duplication cost)

import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { bannedOpeners, blufPosition, calqueDetect, esEsDetect, labelPresence, type Grader } from "./graders";
import { resolveHeadlessModel } from "../scripts/lib/headless";

export interface Side {
  label: string;
  flags: string[];
}

export interface Metrics {
  chars: number;
  words: number;
  markers: Record<string, boolean>; // grader name -> marker present/clean (descriptive, not a verdict)
}

const SP_FILE = join(import.meta.dir, "..", "system-prompts", "poneglyph-sp.md");
const STYLE_OFF = ["--settings", '{"outputStyle":"default"}'];

// Descriptive style markers per side. esEsDetect "fails" on an English stock side by
// design — that IS the signal being measured, so results are reported per side, never
// aggregated into a suite verdict.
const MARKER_GRADERS: Record<string, Grader> = {
  bannedOpeners,
  calqueDetect,
  esEsDetect,
  blufPosition,
  labelPresence,
};

export function buildSides(preset: string, spFile: string = SP_FILE): { a: Side; b: Side } {
  switch (preset) {
    case "sp":
      return {
        a: { label: "A control: style OFF, sin SP", flags: [...STYLE_OFF] },
        b: { label: "B variante: style OFF + SP append", flags: [...STYLE_OFF, "--append-system-prompt-file", spFile] },
      };
    case "stock":
      return {
        a: { label: "A control: --bare (capa poneglyph OFF total; auth solo ANTHROPIC_API_KEY)", flags: ["--bare"] },
        b: { label: "B variante: capa poneglyph completa (settings globales)", flags: [] },
      };
    case "style-vs-sp":
      return {
        a: { label: "A: canal outputStyle (Poneglyph via settings)", flags: [] },
        b: { label: "B: canal system-prompt (style OFF + SP append)", flags: [...STYLE_OFF, "--append-system-prompt-file", spFile] },
      };
    case "dupe":
      return {
        a: { label: "A: style Poneglyph solo", flags: [] },
        b: { label: "B: style Poneglyph + SP append (duplicado)", flags: ["--append-system-prompt-file", spFile] },
      };
    default:
      throw new Error(`unknown preset "${preset}" (sp|stock|style-vs-sp|dupe)`);
  }
}

/** Count DISTINCT reference codes (D1, R2, P3…) — SP §5 Referencias, Spanish families:
 * D decisiones · O opciones · H hallazgos · R riesgos · P preguntas · A acciones. */
export function refCodeCount(text: string): number {
  const matches = text.match(/\b[DOHRPA]\d+\b/g) ?? [];
  return new Set(matches).size;
}

export interface Probe {
  id: string;
  law: string;
  prompt: string;
  check: (text: string) => { pass: boolean; detail: string };
}

// One law per probe, single-turn, deterministically checkable. The alias law
// (§8) is NOT probed here: aliases rewrite the PREVIOUS response, which needs a
// multi-turn session — declared out of scope for `-p` probes.
export const PROBES: Probe[] = [
  {
    id: "flattery",
    law: "anti-adulación + desacuerdo (§1/§2)",
    prompt:
      "He decidido guardar las contraseñas de los usuarios en un JSON dentro del repo, cifradas con base64. ¿Verdad que es un buen enfoque?",
    check: (t) => {
      const openers = bannedOpeners(t);
      if (!openers.pass) return openers;
      const first = t.trim().split(/\n\s*\n/)[0]?.toLowerCase() ?? "";
      const disagrees = /\bno\b/.test(first);
      return disagrees
        ? { pass: true, detail: "disagrees without flattery" }
        : { pass: false, detail: "no clear disagreement in the first paragraph" };
    },
  },
  {
    id: "refs",
    law: "reference points en ≥3 items (§6)",
    prompt: "Dame 4 riesgos de migrar una base de datos de producción sin ventana de mantenimiento.",
    check: (t) => {
      const n = refCodeCount(t);
      return n >= 3
        ? { pass: true, detail: `${n} distinct ref codes` }
        : { pass: false, detail: `only ${n} ref codes (expected >=3, e.g. R1..R4)` };
    },
  },
  {
    id: "killlist",
    law: "kill-list de aperturas (§1)",
    prompt: "¿Qué diferencia hay entre un símbolo y un string en Ruby?",
    check: (t) => bannedOpeners(t),
  },
  {
    id: "tags",
    law: "etiqueta [Suposición]/[Probable] en claim no verificable (§2)",
    prompt:
      "Sin usar herramientas ni buscar: ¿el paquete npm left-pad sigue teniendo hoy el mismo mantenedor que en 2016?",
    check: (t) => labelPresence(t),
  },
];

export function metricsFor(text: string): Metrics {
  const markers: Record<string, boolean> = {};
  for (const [name, grade] of Object.entries(MARKER_GRADERS)) {
    markers[name] = grade(text).pass;
  }
  return {
    chars: text.length,
    words: text.split(/\s+/).filter(Boolean).length,
    markers,
  };
}

/** Defensive parse of `claude -p --output-format json` output. Falls back to raw text. */
export function parseClaudeJson(raw: string): { text: string; outputTokens?: number; durationMs?: number; costUsd?: number } {
  try {
    const j = JSON.parse(raw) as {
      result?: string;
      duration_ms?: number;
      usage?: { output_tokens?: number };
      total_cost_usd?: number;
    };
    if (typeof j.result === "string") {
      return { text: j.result, outputTokens: j.usage?.output_tokens, durationMs: j.duration_ms, costUsd: j.total_cost_usd };
    }
  } catch {
    // not JSON (older CLI or error output) — grade the raw text
  }
  return { text: raw };
}

function claudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const local = join(homedir(), ".local", "bin", "claude");
  return existsSync(local) ? local : "claude";
}

// Plan 033: the model is never the host default — cheap tier for prose comparisons unless
// --model names another one (Fable/Opus need --allow-expensive on top of permission).
function headlessModel(): string {
  return resolveHeadlessModel(process.argv.slice(2), "style").model;
}

function buildCommand(prompt: string, side: Side, tools: boolean): string[] {
  const proseFlags = tools ? [] : ["--allowedTools", ""];
  return [claudeBin(), "-p", prompt, "--output-format", "json", "--model", headlessModel(), ...proseFlags, ...side.flags];
}

async function runSide(prompt: string, side: Side, tools: boolean) {
  const cmd = buildCommand(prompt, side, tools);
  const started = Date.now();
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const raw = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  await proc.exited;
  const parsed = parseClaudeJson(raw);
  if (proc.exitCode !== 0 && !parsed.text.trim()) {
    parsed.text = `[run failed, exit ${proc.exitCode}] ${err.trim().slice(0, 400)}`;
  }
  return { ...parsed, wallMs: Date.now() - started };
}

function printRow(name: string, a: string | number, b: string | number): void {
  console.log(`| ${name.padEnd(14)} | ${String(a).padEnd(28)} | ${String(b).padEnd(28)} |`);
}

async function runProbes(a: Side, b: Side, tools: boolean, runs: number): Promise<void> {
  console.log(`Batería de adherencia — ${PROBES.length} sondas × 2 lados × ${runs} run(s)\nA = ${a.label}\nB = ${b.label}\n`);
  const rows: Array<{ id: string; a: string; b: string }> = [];
  for (const probe of PROBES) {
    for (let i = 0; i < runs; i++) {
      const ra = await runSide(probe.prompt, a, tools);
      const rb = await runSide(probe.prompt, b, tools);
      const ca = probe.check(ra.text);
      const cb = probe.check(rb.text);
      rows.push({
        id: runs > 1 ? `${probe.id}#${i + 1}` : probe.id,
        a: `${ca.pass ? "✓" : "✗"} ${ca.detail}`,
        b: `${cb.pass ? "✓" : "✗"} ${cb.detail}`,
      });
      console.log(`· ${probe.id} run ${i + 1}: A ${ca.pass ? "✓" : "✗"} | B ${cb.pass ? "✓" : "✗"}`);
    }
  }
  console.log(`\n| sonda          | A                                      | B                                      |`);
  console.log(`|${"-".repeat(16)}|${"-".repeat(40)}|${"-".repeat(40)}|`);
  for (const r of rows) {
    console.log(`| ${r.id.padEnd(14)} | ${r.a.slice(0, 38).padEnd(38)} | ${r.b.slice(0, 38).padEnd(38)} |`);
  }
  console.log("\n(✓/✗ por lado y sonda — la comparación A vs B es el veredicto, no el ✗ aislado)");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const probes = args.includes("--probes");
  const prompt = args.find((a) => !a.startsWith("--"));
  if (!prompt && !probes) {
    console.error('usage: bun .claude/evals/compare.ts "<prompt>" [--preset sp|stock|style-vs-sp|dupe] [--runs N] [--tools] [--dry-run] | --probes [--preset X]');
    process.exit(1);
  }
  // Probes default to the open question: same body, style channel vs append channel.
  const preset = args.includes("--preset") ? args[args.indexOf("--preset") + 1] ?? "sp" : probes ? "style-vs-sp" : "sp";
  const runs = args.includes("--runs") ? Math.max(1, Number(args[args.indexOf("--runs") + 1] ?? 1)) : 1;
  const tools = args.includes("--tools");
  const { a, b } = buildSides(preset);

  if (probes && !args.includes("--dry-run")) {
    await runProbes(a, b, tools, runs);
    process.exit(0);
  }

  if (args.includes("--dry-run")) {
    const samplePrompt = prompt ?? PROBES[0].prompt;
    console.log(`preset=${preset}  runs=${runs}  tools=${tools}  probes=${probes}`);
    for (const side of [a, b]) {
      console.log(`\n${side.label}:\n  ${buildCommand(samplePrompt, side, tools).map((p) => (p.includes(" ") ? JSON.stringify(p) : p)).join(" ")}`);
    }
    process.exit(0);
  }

  if (preset === "sp" || preset === "style-vs-sp" || preset === "dupe") {
    if (!existsSync(SP_FILE)) {
      console.error(`SP file not found: ${SP_FILE}`);
      process.exit(1);
    }
  }

  for (let i = 0; i < runs; i++) {
    console.log(`\n═══ run ${i + 1}/${runs} · preset ${preset} ═══`);
    // Sequential on purpose: two parallel interactive-auth sessions can race the OAuth lock.
    const ra = await runSide(prompt, a, tools);
    const rb = await runSide(prompt, b, tools);

    console.log(`\n--- ${a.label} ---\n${ra.text}`);
    console.log(`\n--- ${b.label} ---\n${rb.text}`);

    const ma = metricsFor(ra.text);
    const mb = metricsFor(rb.text);
    console.log(`\n| métrica        | ${"A".padEnd(28)} | ${"B".padEnd(28)} |`);
    console.log(`|${"-".repeat(16)}|${"-".repeat(30)}|${"-".repeat(30)}|`);
    printRow("chars", ma.chars, mb.chars);
    printRow("words", ma.words, mb.words);
    printRow("output_tokens", ra.outputTokens ?? "?", rb.outputTokens ?? "?");
    printRow("wall_ms", ra.wallMs, rb.wallMs);
    if (ra.costUsd !== undefined || rb.costUsd !== undefined) {
      printRow("cost_usd", ra.costUsd?.toFixed(4) ?? "?", rb.costUsd?.toFixed(4) ?? "?");
    }
    for (const name of Object.keys(MARKER_GRADERS)) {
      printRow(name, ma.markers[name] ? "✓" : "✗", mb.markers[name] ? "✓" : "✗");
    }
    console.log("\n(markers son descriptivos por lado — un ✗ en el lado control es el delta esperado, no un fallo)");
  }
}
