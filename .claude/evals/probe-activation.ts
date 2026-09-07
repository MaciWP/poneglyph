#!/usr/bin/env bun
// Activation probe (plan 032/WP4, D11 → repo tool since plan 033): which `Skill()` each real
// prompt fires. Runs `claude -p` per prompt in plan permission mode with 2 turns and reads
// the stream-json tool_use blocks. Compare two labels (before/after a skill edit) on the
// SAME model — deltas, not absolutes.
//
//   bun .claude/evals/probe-activation.ts <label> [--only id1,id2] [--repeat N≤2]
//                                          [--model X] [--allow-expensive] [--dry-run] [--out <dir>]
//
// Model: resolved by scripts/lib/headless.ts (kind "probe" → Sonnet 5 by default). Fable/Opus
// are refused without --allow-expensive — 29 Fable probe sessions on 2026-09-03 were the cost
// lesson (lessons G13). Results land in <out>/<label>.json (default: the working directory).
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveHeadlessModel, stripHeadlessFlags } from "../scripts/lib/headless";

const rawArgs = process.argv.slice(2);
const { model, dryRun } = resolveHeadlessModel(rawArgs, "probe");
const args = stripHeadlessFlags(rawArgs);
const label = args.find((a) => !a.startsWith("--")) ?? "run";
const repo = resolve(import.meta.dir, "..", "..");
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? resolve(args[outIdx + 1]) : process.cwd();
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",")) : null;
const repIdx = args.indexOf("--repeat");
const repeat = Math.min(repIdx >= 0 ? Number(args[repIdx + 1]) || 1 : 1, 2); // D4: at most one rerun

const evalPrompts = readFileSync(join(repo, ".claude/evals/cases.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l) as { id: string; prompt: string; expected: string; type: string })
  .filter((c) => c.type === "skill-trigger")
  .map((c) => ({ id: c.id, prompt: c.prompt, expected: c.expected }));

const extra = [
  { id: "probe-tech-plan", prompt: "descompón esto en tareas: añadir exportación CSV al listado de usuarios", expected: "tech-plan" },
  { id: "probe-tdd-design", prompt: "diseña los tests de esta HU antes de implementarla", expected: "tdd-design" },
  { id: "probe-critic", prompt: "revisa el feature end-to-end y dame el veredicto", expected: "critic" },
  { id: "probe-retro", prompt: "haz la retro del feature que acabamos de cerrar", expected: "retro" },
  { id: "probe-scope", prompt: "define el alcance de esta feature: quiero notificaciones por email", expected: "scope" },
  { id: "probe-orchestrator", prompt: "delego o inline? cómo orquesto esto: revisar 40 ficheros de tests", expected: "orchestrator-protocol" },
  { id: "probe-dev", prompt: "aplica el bucle dev a este cambio: renombrar la función parseConfig", expected: "dev" },
];

const selected = [...evalPrompts, ...extra].filter((c) => !only || only.has(c.id));
const cases = Array.from({ length: repeat }, (_, i) => selected.map((c) => ({ ...c, id: repeat > 1 ? `${c.id}#${i + 1}` : c.id }))).flat();
const results: Record<string, unknown>[] = [];

for (const c of cases) {
  const cmd = ["claude", "-p", c.prompt, "--output-format", "stream-json", "--verbose", "--max-turns", "2", "--permission-mode", "plan", "--model", model];
  if (dryRun) {
    console.log(`DRY  ${c.id.padEnd(24)} ${cmd.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
    continue;
  }
  const proc = Bun.spawn(cmd, { cwd: repo, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  const skills: string[] = [];
  const tools: string[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    let ev: { message?: { content?: Array<{ type?: string; name?: string; input?: { skill?: string; name?: string } }> } };
    try { ev = JSON.parse(line); } catch { continue; }
    for (const b of ev?.message?.content ?? []) {
      if (b?.type === "tool_use") {
        tools.push(b.name ?? "?");
        if (b.name === "Skill") skills.push(String(b.input?.skill ?? b.input?.name ?? "?"));
      }
    }
  }
  const hit = skills.includes(c.expected);
  results.push({ id: c.id, expected: c.expected, model, skills, tools, hit });
  console.log(`${hit ? "OK " : "-- "} ${c.id.padEnd(24)} expected=${c.expected.padEnd(22)} skills=[${skills.join(", ")}] tools=[${tools.join(", ")}]`);
}

if (dryRun) {
  console.log(`\n${cases.length} probes would run on ${model} (dry-run, nothing executed)`);
} else {
  const file = join(outDir, `${label}.json`);
  writeFileSync(file, JSON.stringify(results, null, 2));
  console.log(`\n${results.filter((r) => r.hit).length}/${results.length} hit on ${model} → ${file}`);
}
