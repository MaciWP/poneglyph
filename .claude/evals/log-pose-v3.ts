#!/usr/bin/env bun
// log-pose eval v3 (plans/044-effort-advisor-mod/eval-v3.md): one call, five decisions.
//
// bun .claude/evals/log-pose-v3.ts --extract [--days 60]
//   Every typed main-session prompt of the last N days, with what its turn really did (tools,
//   edits, errors, questions, advisor calls, duration) and its neighbours, to
//   .claude/evals/private/v3/prompts.jsonl. Later steps classify, sample, judge and score it.
// bun .claude/evals/log-pose-v3.ts --classify [--batch 25] [--parallel 4]
//   Haiku labels each routable prompt's facets (task, domain, dictation noise, difficulty,
//   specificity, language, paste) to facets.jsonl; reruns skip the ones already done.
// bun .claude/evals/log-pose-v3.ts --sample [--n 300] [--seed 1] [--force]
//   Drops machine text and duplicates, draws a stratified sample and freezes it to sample.jsonl.
// bun .claude/evals/log-pose-v3.ts --judge [--model m [--allow-expensive]] [--split tune|test|all] [--limit N]
//   Hindsight gold for the five decisions to judge-<model>.jsonl (resumable). The judge never sees the
//   skills the turn loaded nor the router note: they would favour the hook arm.
// bun .claude/evals/log-pose-v3.ts --label [--n 60] [--port 4391]
//   Freezes 60 test-split cases to label-set.jsonl and serves a local page that saves the user's
//   labels to labels.jsonl. It shows what the judge sees, never the judge's answer.
// bun .claude/evals/log-pose-v3.ts --arm h-low|h-med|h-high|s-none|s-v2|s-mem|hook [--run 1] [--split tune|test|all] [--cases f]
//   Runs one arm over the sample to arms/<arm>-<run>.jsonl. The memory holds the sample itself, so only
//   s-mem reads it, cut per case to the entries live had before that prompt.
//   --cases runs it over another file of {id, text, previous} rows instead, writing beside that file.
// bun .claude/evals/log-pose-v3.ts --dict-judge [--parallel 4]
//   Asks Sonnet, blind to the arm, whether each fix the arms add beyond the gold is real (dictation-sonnet.jsonl).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { claudeConfigDir } from "../hooks/lib/paths";
import { resolveHeadlessModel } from "../scripts/lib/headless";
import { humanPrompt } from "../scripts/skill-usage";
import { collectTranscripts } from "../scripts/usage-profile";

export const V3_DIR = join(import.meta.dir, "private", "v3");
const NAMED_RE = /(?:^|\s)\/([a-z][\w:-]*)/gi;
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

export interface TurnFacts {
  messages: number; // assistant messages in the turn
  tools: Record<string, number>; // tool calls by name
  filesEdited: number;
  toolErrors: number;
  questions: number; // AskUserQuestion calls
  advisor: number;
  skills: string[]; // Skill tool loads
  outputTokens: number;
  durationMs: number;
  interrupted: boolean;
}

export interface V3Prompt {
  id: string;
  project: string;
  session: string;
  entrypoint: string; // `cli` typed by a person; `sdk-cli` is a headless run
  at: number;
  text: string;
  named: string[];
  previous: string; // the prompt before it in the session, capped
  next: string; // the prompt after it, capped: a correction or a continuation
  facts: TurnFacts;
}

const cap = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const emptyFacts = (): TurnFacts => ({ messages: 0, tools: {}, filesEdited: 0, toolErrors: 0, questions: 0, advisor: 0, skills: [], outputTokens: 0, durationMs: 0, interrupted: false });

// Pure. One main transcript's lines in, one entry per typed prompt out.
export function promptsOf(lines: string[], project: string, session: string): V3Prompt[] {
  const out: V3Prompt[] = [];
  let cur: V3Prompt | null = null;
  let edited = new Set<string>();
  let lastAt = 0;
  const close = () => {
    if (cur) cur.facts.durationMs = Math.max(0, lastAt - cur.at), cur.facts.filesEdited = edited.size;
  };
  for (const line of lines) {
    let o: any;
    try { o = JSON.parse(line); } catch { continue; }
    if (o?.isSidechain) continue;
    const at = Date.parse(o?.timestamp);
    const text = humanPrompt(o);
    if (text !== null && !Number.isNaN(at)) {
      close();
      const prev = out.at(-1);
      if (prev) prev.next = cap(text, 300);
      cur = {
        // The line uuid: a slash command and its local stdout share a timestamp.
        id: createHash("sha1").update(`${session}:${o.uuid ?? at}`).digest("hex").slice(0, 12),
        project, session, entrypoint: String(o.entrypoint ?? ""), at, text: cap(text, 3000),
        named: [...new Set([...text.matchAll(NAMED_RE)].map((m) => m[1]!.toLowerCase()))],
        previous: prev ? cap(prev.text, 300) : "", next: "", facts: emptyFacts(),
      };
      edited = new Set();
      lastAt = at;
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    if (!Number.isNaN(at)) lastAt = Math.max(lastAt, at);
    const f = cur.facts;
    if (o?.type === "assistant" && Array.isArray(o.message?.content)) {
      f.messages++;
      f.outputTokens += o.message.usage?.output_tokens ?? 0;
      for (const b of o.message.content) {
        if (b?.type !== "tool_use" && b?.type !== "server_tool_use") continue;
        f.tools[b.name] = (f.tools[b.name] ?? 0) + 1;
        if (EDIT_TOOLS.has(b.name) && typeof b.input?.file_path === "string") edited.add(b.input.file_path);
        if (b.name === "AskUserQuestion") f.questions++;
        if (b.name === "advisor") f.advisor++;
        if (b.name === "Skill" && typeof b.input?.skill === "string" && !f.skills.includes(b.input.skill)) f.skills.push(b.input.skill);
      }
    }
    if (o?.type === "user" && Array.isArray(o.message?.content)) {
      for (const b of o.message.content) {
        if (b?.type === "tool_result" && b.is_error) f.toolErrors++;
        if (b?.type === "text" && typeof b.text === "string" && b.text.startsWith("[Request interrupted")) f.interrupted = true;
      }
    }
  }
  close();
  return out;
}

function extract(days: number) {
  const projects = join(claudeConfigDir(), "projects");
  const files = collectTranscripts(projects, days).filter((f) => !f.includes("/subagents/"));
  const since = Date.now() - days * 86_400_000;
  const rows: V3Prompt[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    const project = basename(dirname(file));
    // Probe and eval sessions live under temp folders; they are not the user's work.
    if (/private-tmp|scratchpad/.test(project)) continue;
    rows.push(...promptsOf(lines, project, basename(file, ".jsonl")).filter((p) => p.at >= since && p.entrypoint === "cli"));
  }
  rows.sort((a, b) => a.at - b.at);
  mkdirSync(V3_DIR, { recursive: true });
  writeFileSync(join(V3_DIR, "prompts.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`${rows.length} prompts from ${files.length} transcripts → ${join(V3_DIR, "prompts.jsonl")}`);
}

// --- Classify (Haiku, batches): the facets the sample is stratified on ---

const FACETS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: { items: { type: "array", items: { type: "object", additionalProperties: false,
    required: ["n", "task", "domain", "noise", "difficulty", "specific", "lang", "paste"],
    properties: {
      n: { type: "integer" },
      task: { type: "string", enum: ["question", "plan", "build", "fix", "review", "ship", "write", "config", "research", "continue", "other"] },
      domain: { type: "string", enum: ["app-code", "agent-config", "tickets-docs", "infra-git", "design-ui", "other"] },
      noise: { type: "integer", minimum: 0, maximum: 3 },
      difficulty: { type: "string", enum: ["easy", "normal", "hard"] },
      specific: { type: "boolean" },
      lang: { type: "string", enum: ["es", "en", "mixed"] },
      paste: { type: "boolean" },
    } } } },
};

const FACETS_PROMPT = `You label developer prompts typed or dictated to a coding agent, one label set per numbered prompt.
task: what the prompt asks for. continue = only carries on the previous work ("sigue", "dale con eso").
domain: app-code (product code), agent-config (the agent's own skills, hooks, prompts, settings), tickets-docs, infra-git (git, CI, deploys, worktrees), design-ui, other.
noise: misheard or misspelled words from dictation or typing: 0 none, 1 one or two, 2 several, 3 hard to read.
difficulty: easy (a question, lookup or one-line change), normal (a scoped change), hard (design, unknown cause, many files, security, migrations).
specific: true when the goal and its scope are clear without the conversation.
lang: the prompt's language. paste: it carries a pasted block (logs, tickets, code).
Return every n you were given, in order.`;

export type Facets = { task: string; domain: string; noise: number; difficulty: string; specific: boolean; lang: string; paste: boolean };

async function classify(batchSize: number, parallel: number) {
  const rows = readFileSync(join(V3_DIR, "prompts.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as V3Prompt)
    .filter((p) => p.text.trim().split(/\s+/).length >= 6);
  const out = join(V3_DIR, "facets.jsonl");
  const done = new Set<string>();
  try { for (const l of readFileSync(out, "utf8").split("\n")) if (l) done.add(JSON.parse(l).id); } catch { /* first run */ }
  const todo = rows.filter((r) => !done.has(r.id));
  const batches: V3Prompt[][] = [];
  for (let i = 0; i < todo.length; i += batchSize) batches.push(todo.slice(i, i + batchSize));
  const lines: string[] = [];
  let next = 0, failed = 0;
  const bin = process.env.PONEGLYPH_CLAUDE_BIN ?? join(process.env.HOME ?? "", ".local", "bin", "claude");
  await Promise.all(Array.from({ length: parallel }, async () => {
    while (next < batches.length) {
      const batch = batches[next++]!;
      const input = batch.map((p, i) => `<p n="${i}">${p.text.replace(/<pasted_content[\s\S]*?<\/pasted_content[^>]*>/g, "[pasted block]").slice(0, 700)}</p>`).join("\n");
      const proc = Bun.spawn([bin, "-p", "--model", "haiku", "--setting-sources", "", "--settings", JSON.stringify({ disableAllHooks: true, claudeMdExcludes: ["**"] }),
        "--tools", "", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence", "--system-prompt", FACETS_PROMPT,
        "--json-schema", JSON.stringify(FACETS_SCHEMA), "--output-format", "json"], { stdin: new Blob([input]), stdout: "pipe", stderr: "ignore", env: { ...process.env, PONEGLYPH_ROUTER: "1" } });
      const text = await new Response(proc.stdout).text();
      try {
        const items = (JSON.parse(text).structured_output as { items: (Facets & { n: number })[] }).items;
        for (const it of items) { const p = batch[it.n]; if (p) { const { n: _n, ...f } = it; lines.push(JSON.stringify({ id: p.id, ...f })); } }
      } catch { failed++; }
    }
  }));
  if (lines.length) writeFileSync(out, (done.size ? readFileSync(out, "utf8") : "") + lines.join("\n") + "\n");
  console.log(`${lines.length} classified, ${failed} failed batches, ${done.size} already done → ${out}`);
}

// --- Sample: stratified, frozen ---

// Text a person did not type: agent-to-agent messages, dispatches, probes, interrupt markers and
// slash-command wrappers (the router skips these too).
const MACHINE_RE = /^\s*(?:<pasted_content[^>]*>\s*)?(?:\[Agentic OS message|You are working inside Orca|\[Request interrupted|Reply with the single word|<command-(?:message|name)>|<local-command-stdout>|<task-notification|Shared context for the)/i;
export const isMachine = (text: string) => MACHINE_RE.test(text);

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pure. Round-robin over task × noise × difficulty cells so rare cells (dictated hard fixes) are as
// present as common ones; caps keep one project or session from dominating. Oldest 40 % tunes.
export function sample(rows: (V3Prompt & Facets)[], n: number, seed: number) {
  const rand = rng(seed);
  const seen = new Set<string>();
  const pool = rows.filter((r) => {
    if (isMachine(r.text) || r.text.trim().split(/\s+/).length < 6) return false;
    const key = r.text.toLowerCase().replace(/\W+/g, " ").slice(0, 120);
    return !seen.has(key) && seen.add(key);
  });
  const cells = new Map<string, typeof pool>();
  for (const r of pool) {
    const key = `${r.task}|${Math.min(r.noise, 2)}|${r.difficulty}`;
    cells.set(key, [...(cells.get(key) ?? []), r]);
  }
  for (const c of cells.values()) c.sort(() => rand() - 0.5);
  const byProject = new Map<string, number>(), bySession = new Map<string, number>();
  const picked: typeof pool = [];
  while (picked.length < n && [...cells.values()].some((c) => c.length)) {
    for (const c of cells.values()) {
      if (picked.length >= n) break;
      while (c.length) {
        const r = c.pop()!;
        if ((byProject.get(r.project) ?? 0) >= 0.4 * n || (bySession.get(r.session) ?? 0) >= 4) continue;
        byProject.set(r.project, (byProject.get(r.project) ?? 0) + 1);
        bySession.set(r.session, (bySession.get(r.session) ?? 0) + 1);
        picked.push(r);
        break;
      }
    }
  }
  picked.sort((a, b) => a.at - b.at);
  return picked.map((r, i) => ({ ...r, split: i < Math.round(picked.length * 0.4) ? "tune" : "test" }));
}

function freezeSample(n: number, seed: number, force: boolean) {
  const out = join(V3_DIR, "sample.jsonl");
  try { readFileSync(out); if (!force) return console.log(`${out} is frozen; pass --force to redraw it`); } catch { /* not drawn yet */ }
  const facets = new Map(readFileSync(join(V3_DIR, "facets.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => [JSON.parse(l).id, JSON.parse(l)]));
  const rows = readFileSync(join(V3_DIR, "prompts.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as V3Prompt)
    .filter((p) => facets.has(p.id)).map((p) => ({ ...p, ...facets.get(p.id) }));
  const picked = sample(rows, n, seed);
  writeFileSync(out, picked.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`${picked.length} of ${rows.length} prompts (seed ${seed}) → ${out}`);
}

// --- Judge (hindsight gold) ---

const PROCESS = ["dev-workflow", "drillme-clarify", "natural-writing", "changes-verify"];
const JUDGE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["skills", "process", "fixes", "difficulty", "uncertainty", "continuity", "changedCourse", "why"],
  properties: {
    skills: { type: "array", maxItems: 3, items: { type: "string" } },
    process: { type: "array", items: { type: "string", enum: PROCESS } },
    fixes: { type: "array", items: { type: "object", additionalProperties: false, required: ["heard", "meant"], properties: { heard: { type: "string" }, meant: { type: "string" } } } },
    difficulty: { type: "string", enum: ["easy", "normal", "hard"] },
    uncertainty: { type: "string", enum: ["clear", "some-doubt", "unclear"] },
    continuity: { type: "string", enum: ["same", "new"] },
    changedCourse: { type: "boolean" },
    why: { type: "string" },
  },
};

const JUDGE_PROMPT = (rubric: string) => `You build gold labels for a prompt router. A router sees only a developer's prompt; you also see what the turn really did, so judge with hindsight, as the expert who watched the work.

For each case return:
- skills: up to 3 catalog skills (exact names from the catalog below) other than the process skills that a careful agent should have loaded for this prompt; none when nothing fits clearly. process: the process skills it should answer for, from ${PROCESS.join(", ")}. Apply the catalog's own rules for what fits.
- fixes: words misheard by dictation or mistyped whose meaning is a skill, tool, plugin, repo or technical term, as {heard, meant}; never a plain-word typo, style or accents.
- difficulty, uncertainty, continuity: the definitions below, verbatim from the router's rubric. Judge the task, not the agent's effort: many tool calls on an easy task stay easy. Duration marked inflated includes time waiting on the user.
- changedCourse: true when the turn or the next prompt shows the first approach was wrong (errors that forced another way, the user correcting it, the work redone).
- why: one sentence, at most 30 words, naming the evidence for difficulty and uncertainty.

${rubric.replace(/^Also add three keys to the same JSON object:\n/, "")}

The router's instructions and catalog follow; use them as the reference for skills and terms only.`;

function judgeInput(p: V3Prompt): string {
  const f = p.facts;
  const tools = Object.entries(f.tools).filter(([n]) => n !== "Skill").map(([n, c]) => `${n} ${c}`).join(", ") || "none";
  const waited = f.questions > 0 || f.interrupted;
  return [
    p.previous && `<previous>${p.previous}</previous>`,
    `<prompt>${p.text}</prompt>`,
    `<turn>tools: ${tools}; files edited ${f.filesEdited}; tool errors ${f.toolErrors}; questions asked ${f.questions}; advisor calls ${f.advisor}; output tokens ${f.outputTokens}; duration ${Math.round(f.durationMs / 1000)} s${waited ? " (inflated: waited on the user)" : ""}${f.interrupted ? "; interrupted by the user" : ""}</turn>`,
    p.next && `<next>${p.next}</next>`,
  ].filter(Boolean).join("\n");
}

async function judge(model: string, split: string, limit: number, parallel: number) {
  const { RUBRIC } = await import("../../plugins/log-pose/hooks/core");
  const agentFile = readFileSync(join(claudeConfigDir(), "agents", "prompt-router.md"), "utf8").replace(/^---[\s\S]*?\n---\n/, "");
  const system = `${JUDGE_PROMPT(RUBRIC)}\n\n<router>\n${agentFile}\n</router>`;
  const out = join(V3_DIR, `judge-${model}.jsonl`);
  const done = new Set<string>();
  try { for (const l of readFileSync(out, "utf8").split("\n")) if (l) done.add(JSON.parse(l).id); } catch { /* first run */ }
  const todo = readFileSync(join(V3_DIR, "sample.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as V3Prompt & { split: string })
    .filter((p) => (split === "all" || p.split === split) && !done.has(p.id)).slice(0, limit);
  const bin = process.env.PONEGLYPH_CLAUDE_BIN ?? join(process.env.HOME ?? "", ".local", "bin", "claude");
  let next = 0, cost = 0, failed = 0;
  const lines: string[] = [];
  // The first call writes the cached system prompt alone; parallel ones would each write it.
  const worker = (n: number) => async () => {
    while (next < Math.min(n, todo.length)) {
      const p = todo[next++]!;
      const proc = Bun.spawn([bin, "-p", "--model", model, "--setting-sources", "", "--settings", JSON.stringify({ disableAllHooks: true, claudeMdExcludes: ["**"] }),
        "--tools", "", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence", "--system-prompt", system,
        "--json-schema", JSON.stringify(JUDGE_SCHEMA), "--output-format", "json"], { stdin: new Blob([judgeInput(p)]), stdout: "pipe", stderr: "ignore", env: { ...process.env, PONEGLYPH_ROUTER: "1" } });
      try {
        const env = JSON.parse(await new Response(proc.stdout).text());
        cost += env.total_cost_usd ?? 0;
        lines.push(JSON.stringify({ id: p.id, split: p.split, ...env.structured_output, cost: env.total_cost_usd, usage: env.usage }));
      } catch { failed++; }
    }
  };
  await worker(1)();
  await Promise.all(Array.from({ length: parallel }, worker(todo.length)));
  if (lines.length) writeFileSync(out, (done.size ? readFileSync(out, "utf8") : "") + lines.join("\n") + "\n");
  console.log(`${lines.length} judged, ${failed} failed, ${done.size} already done, cost ${cost.toFixed(3)} US$ (${(cost / Math.max(1, lines.length)).toFixed(4)}/case) → ${out}`);
}

// --- User labels (blind: the page never shows the judge) ---

const LABEL_PAGE = (cases: string, rubric: string) => `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Etiquetas v3</title><style>
:root{--bg:#fafaf9;--fg:#1c1917;--mut:#78716c;--card:#fff;--line:#e7e5e4;--acc:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#f5f5f4;--mut:#a8a29e;--card:#292524;--line:#44403c;--acc:#60a5fa}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui;margin:0 auto;max-width:900px;padding:16px}
pre{white-space:pre-wrap;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;max-height:45vh;overflow:auto}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.row b{width:110px}
button{font:inherit;padding:6px 12px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}
button.on{background:var(--acc);color:#fff;border-color:var(--acc)}input{font:inherit;flex:1;min-width:200px;padding:6px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--fg)}
small,details{color:var(--mut)}</style>
<details><summary>Definiciones (las mismas que ve el juez)</summary><pre>${rubric.replace(/</g, "&lt;")}</pre></details>
<p><span id="pos"></span> · <small>Teclas: 1/2/3 dificultad · q/w/e incertidumbre · s/n continuidad · c cambió de rumbo · Intro guardar</small></p>
<pre id="txt"></pre><div id="f"></div>
<div class="row"><b>Dictado</b><input id="fx" placeholder="oído → quería decir; separa con ;"></div>
<div class="row"><button id="save">Guardar y siguiente</button><button id="back">Anterior</button></div>
<script>
const C=${cases};const G=[["difficulty",["easy","normal","hard"],"123"],["uncertainty",["clear","some-doubt","unclear"],"qwe"],["continuity",["same","new"],"sn"],["changedCourse",["no","yes"],"c"]];
let i=0,L={};fetch("labels").then(r=>r.json()).then(d=>{L=d;i=Math.max(0,C.findIndex(c=>!L[c.id]));if(i<0)i=0;show()});
function show(){const c=C[i],l=L[c.id]||{};document.getElementById("pos").textContent=(i+1)+" / "+C.length+" · etiquetados "+Object.keys(L).length;
document.getElementById("txt").textContent=c.input;document.getElementById("fx").value=l.fixes||"";
document.getElementById("f").innerHTML=G.map(([k,vs])=>'<div class="row"><b>'+k+'</b>'+vs.map(v=>'<button data-k="'+k+'" data-v="'+v+'" class="'+(l[k]===v?"on":"")+'">'+v+'</button>').join("")+'</div>').join("");}
function set(k,v){const c=C[i];L[c.id]={...(L[c.id]||{}),[k]:v};show()}
document.addEventListener("click",e=>{const b=e.target.closest("button[data-k]");if(b)set(b.dataset.k,b.dataset.v)});
async function save(){const c=C[i],l={...(L[c.id]||{}),fixes:document.getElementById("fx").value.trim()};if(!l.difficulty||!l.uncertainty||!l.continuity){alert("Faltan etiquetas");return}
l.changedCourse=l.changedCourse||"no";L[c.id]=l;await fetch("label",{method:"POST",body:JSON.stringify({id:c.id,...l})});if(i<C.length-1)i++;show()}
document.getElementById("save").onclick=save;document.getElementById("back").onclick=()=>{if(i>0)i--;show()};
document.addEventListener("keydown",e=>{if(e.target.tagName==="INPUT"){if(e.key==="Enter")save();return}
if(e.key==="Enter")return save();for(const [k,vs,keys] of G){const j=keys.indexOf(e.key);if(j<0)continue;
if(k==="changedCourse")set(k,(L[C[i].id]||{}).changedCourse==="yes"?"no":"yes");else set(k,vs[j])}});
</script></html>`;

async function label(n: number, port: number) {
  const setFile = join(V3_DIR, "label-set.jsonl");
  const labelsFile = join(V3_DIR, "labels.jsonl");
  let set: (V3Prompt & Facets)[];
  try { set = readFileSync(setFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch {
    const test = readFileSync(join(V3_DIR, "sample.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as V3Prompt & Facets & { split: string }).filter((p) => p.split === "test");
    set = sample(test.map(({ split: _s, ...p }) => p), n, 7).map(({ split: _s, ...p }) => p);
    writeFileSync(setFile, set.map((p) => JSON.stringify(p)).join("\n") + "\n");
  }
  const { RUBRIC } = await import("../../plugins/log-pose/hooks/core");
  const cases = JSON.stringify(set.map((p) => ({ id: p.id, input: judgeInput(p) }))).replace(/</g, "\\u003c");
  const page = LABEL_PAGE(cases, RUBRIC);
  const read = () => {
    const out: Record<string, unknown> = {};
    try { for (const l of readFileSync(labelsFile, "utf8").split("\n")) if (l) { const o = JSON.parse(l); out[o.id] = o; } } catch { /* none yet */ }
    return out;
  };
  Bun.serve({
    hostname: "127.0.0.1", port,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/labels") return Response.json(read());
      if (path === "/label" && req.method === "POST") {
        const o = await req.json() as { id?: string };
        if (!set.some((p) => p.id === o.id)) return new Response("unknown id", { status: 400 });
        writeFileSync(labelsFile, (Object.keys(read()).length ? readFileSync(labelsFile, "utf8") : "") + JSON.stringify({ ...o, at: Date.now() }) + "\n");
        return new Response("ok");
      }
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
    },
  });
  console.log(`${set.length} cases, ${Object.keys(read()).length} labelled → http://127.0.0.1:${port}/ (Ctrl+C to stop)`);
}

// --- Arms ---

// name → mod model and effort, or the live hook. Answers go to arms/<name>-<run>.jsonl.
export const ARMS: Record<string, { model: string; effort: string; prompt?: "fallback"; memory?: true } | "hook"> = {
  "h-low": { model: "haiku", effort: "low" }, "h-med": { model: "haiku", effort: "medium" }, "h-high": { model: "haiku", effort: "high" },
  "s-none": { model: "sonnet", effort: "low", prompt: "fallback" }, // the study arm: the agent's body plus the rubric
  "s-v2": { model: "sonnet", effort: "low" }, // the mod's own prompt
  "s-mem": { model: "sonnet", effort: "low", memory: true }, // s-v2 with `<past>` as live had it then
  hook: "hook",
};
// Live rebuilds the memory every 6 h, so a case sees entries from before its prompt minus that.
const MEMORY_LAG_MS = 6 * 3_600_000;

async function runArm(name: string, run: number, limit: number, parallel = 1, split = "all", casesPath = "") {
  const arm = ARMS[name];
  if (!arm) throw new Error(`unknown arm ${name}: ${Object.keys(ARMS).join(", ")}`);
  const cases = readFileSync(casesPath || join(V3_DIR, "sample.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as V3Prompt & { split: string })
    .filter((p) => split === "all" || p.split === split)
    .map((p) => ({ id: p.id, prompt: p.text.slice(0, 3000), previous: p.previous, ...(arm !== "hook" && arm.memory && p.at ? { pastBefore: p.at - MEMORY_LAG_MS } : {}) })).slice(0, limit);
  const dir = casesPath ? dirname(casesPath) : join(V3_DIR, "arms");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${name}-${run}.jsonl`);
  // A generous timeout keeps slow answers; the score applies the live limits to `ms`.
  const timeoutMs = 30_000;
  if (arm === "hook") {
    const { glossaryFiles, loadCatalog, loadGlossary, loadRouterAgent, ROUTER_AGENT_FILE, runRouter } = await import("../hooks/prompt-router");
    const cwd = join(import.meta.dir, "..", "..");
    const agent = loadRouterAgent(ROUTER_AGENT_FILE, loadCatalog(cwd), loadGlossary(glossaryFiles(cwd)));
    // Resumable; with --parallel > 1 the rows are marked, and latency comes from sequential rows only.
    const lines = existsSync(out) ? readFileSync(out, "utf8").split("\n").filter(Boolean) : [];
    const done = new Set(lines.map((l) => JSON.parse(l).id));
    const todo = cases.filter((c) => !done.has(c.id));
    let next = 0;
    await Promise.all(Array.from({ length: parallel }, async () => { while (next < todo.length) {
      const c = todo[next++]!;
      const started = Date.now();
      const r = await runRouter(agent, c.prompt, null, timeoutMs);
      let env: any = null;
      try { env = JSON.parse(r.stdout); } catch { /* timeout or error */ }
      lines.push(JSON.stringify({ id: c.id, outcome: r.outcome, ms: Date.now() - started, stdout: r.stdout, input: env?.usage ? env.usage.input_tokens + env.usage.cache_read_input_tokens + env.usage.cache_creation_input_tokens : null, read: env?.usage?.cache_read_input_tokens ?? null, output: env?.usage?.output_tokens ?? null, cost: env?.total_cost_usd ?? null, ...(parallel > 1 ? { parallel } : {}) }));
      writeFileSync(out, lines.join("\n") + "\n");
    } }));
  } else {
    const casesFile = join(dir, `cases-${name}-${run}.jsonl`); // one per arm and run, so runs can go in parallel
    writeFileSync(casesFile, cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
    const bin = process.env.PONEGLYPH_CLAUDE_BIN ?? join(process.env.HOME ?? "", ".local", "bin", "claude");
    const proc = Bun.spawn([bin, "-p", "--model", "haiku", "--plugin-dir", join(import.meta.dir, "..", "..", "plugins", "log-pose"), "--tools", ""], {
      stdin: new Blob(["x"]), stdout: "ignore", stderr: "inherit",
      env: { ...process.env, LOG_POSE_EVAL: casesFile, LOG_POSE_EVAL_OUT: out, LOG_POSE_MODEL: arm.model, LOG_POSE_EFFORT: arm.effort, LOG_POSE_TIMEOUT: String(timeoutMs), LOG_POSE_PROMPT: arm.prompt ?? "" },
    });
    await proc.exited;
  }
  const n = readFileSync(out, "utf8").split("\n").filter(Boolean).length;
  console.log(`${name} run ${run}: ${n}/${cases.length} answers → ${out}`);
}

// --- Dictation judge ---

// The hindsight judge missed valid fixes ("agent os" → Agentic OS), so the fixes the arms propose
// beyond its gold are checked one by one. The judge sees the prompt and the pair, never the arm.
const DICT_SCHEMA = { type: "object", additionalProperties: false, required: ["ok", "why"], properties: { ok: { type: "boolean" }, why: { type: "string" } } };
const DICT_PROMPT = (glossary: string) => `A developer dictated a prompt, mostly in Spanish, to a coding assistant; speech-to-text often mishears product names and technical terms. You get the prompt, a span "heard" from it and a term "meant" from the glossary below.

Answer ok true only when, in this prompt, the speaker most likely said "meant" and the transcriber wrote "heard". Answer false when "heard" is a right word in its context, names something else, or is only related to "meant" by topic. why: one sentence, at most 20 words.

Glossary (term: heard variants):
${glossary}`;

async function dictJudge(parallel: number) {
  const { foldText } = await import("../hooks/lib/language");
  const { glossaryFiles, loadCatalog, loadGlossary, parseRouterOutput } = await import("../hooks/prompt-router");
  const { soundsLike } = await import("../../plugins/log-pose/hooks/core");
  const cwd = join(import.meta.dir, "..", "..");
  const glossary = loadGlossary(glossaryFiles(cwd));
  const catalog = loadCatalog(cwd);
  const variants = new Map(Object.entries(glossary).map(([t, v]) => [foldText(t), v]));
  const rows = (f: string) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  const text = new Map(rows(join(V3_DIR, "sample.jsonl")).map((p: V3Prompt) => [p.id, p.text.slice(0, 3000)]));
  const fold = (s: string) => foldText(s).replace(/[^a-z0-9]+/g, " ").trim();
  const gold = new Set(rows(join(V3_DIR, "judge-opus.jsonl")).flatMap((j: { id: string; fixes: { heard: string }[] }) => j.fixes.map((f) => `${j.id}|${fold(f.heard)}`)));
  const out = join(V3_DIR, "dictation-sonnet.jsonl");
  const key = (id: string, f: { heard: string; meant: string }) => `${id}|${fold(f.heard)}|${fold(f.meant)}`;
  const done = new Set(rows(out).map((d: { id: string; heard: string; meant: string }) => key(d.id, d)));
  // Every fix today's filter lets through that the gold lacks, from every arm, once.
  const todo = new Map<string, { id: string; heard: string; meant: string }>();
  for (const f of readdirSync(join(V3_DIR, "arms")).filter((f) => !f.startsWith("cases") && f.endsWith(".jsonl"))) {
    for (const r of rows(join(V3_DIR, "arms", f))) {
      const fixes: { heard: string; meant: string }[] = r.stdout !== undefined
        ? (r.outcome === "ok" ? parseRouterOutput(r.stdout, text.get(r.id) ?? "", catalog, { glossary })?.fixes ?? [] : [])
        : (r.fixes ?? []).filter((x: { heard: string; meant: string }) => variants.has(foldText(x.meant)) && soundsLike(x.heard, x.meant, variants.get(foldText(x.meant))!));
      for (const x of fixes) if (!gold.has(`${r.id}|${fold(x.heard)}`) && !done.has(key(r.id, x))) todo.set(key(r.id, x), { id: r.id, heard: x.heard, meant: x.meant });
    }
  }
  const system = DICT_PROMPT(Object.entries(glossary).map(([t, v]) => `${t}: ${v.join(", ")}`).join(" | "));
  const bin = process.env.PONEGLYPH_CLAUDE_BIN ?? join(process.env.HOME ?? "", ".local", "bin", "claude");
  const list = [...todo.values()];
  let next = 0, cost = 0, failed = 0;
  const lines: string[] = [];
  await Promise.all(Array.from({ length: parallel }, async () => { while (next < list.length) {
    const d = list[next++]!;
    const proc = Bun.spawn([bin, "-p", "--model", "sonnet", "--setting-sources", "", "--settings", JSON.stringify({ disableAllHooks: true, claudeMdExcludes: ["**"] }),
      "--tools", "", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence", "--system-prompt", system,
      "--json-schema", JSON.stringify(DICT_SCHEMA), "--output-format", "json"], { stdin: new Blob([`<prompt>${text.get(d.id)}</prompt>\nheard: "${d.heard}"\nmeant: "${d.meant}"`]), stdout: "pipe", stderr: "ignore", env: { ...process.env, PONEGLYPH_ROUTER: "1" } });
    try {
      const env = JSON.parse(await new Response(proc.stdout).text());
      cost += env.total_cost_usd ?? 0;
      lines.push(JSON.stringify({ ...d, ...env.structured_output }));
    } catch { failed++; }
  } }));
  if (lines.length) writeFileSync(out, (done.size ? readFileSync(out, "utf8") : "") + lines.join("\n") + "\n");
  console.log(`${lines.length} pairs judged (${lines.filter((l) => JSON.parse(l).ok).length} ok), ${failed} failed, ${done.size} already done, cost ${cost.toFixed(3)} US$ → ${out}`);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (name: string, fallback: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] ?? fallback : fallback);
  if (argv.includes("--extract")) extract(Number(arg("--days", "60")));
  else if (argv.includes("--classify")) await classify(Number(arg("--batch", "25")), Number(arg("--parallel", "4")));
  else if (argv.includes("--judge")) {
    const { model } = resolveHeadlessModel(argv, "probe");
    await judge(model, arg("--split", "all"), Number(arg("--limit", "1000")), Number(arg("--parallel", "4")));
  } else if (argv.includes("--arm")) await runArm(arg("--arm", ""), Number(arg("--run", "1")), Number(arg("--limit", "1000")), Number(arg("--parallel", "1")), arg("--split", "all"), arg("--cases", ""));
  else if (argv.includes("--dict-judge")) await dictJudge(Number(arg("--parallel", "4")));
  else if (argv.includes("--label")) await label(Number(arg("--n", "60")), Number(arg("--port", "4391")));
  else if (argv.includes("--sample")) freezeSample(Number(arg("--n", "300")), Number(arg("--seed", "1")), argv.includes("--force"));
  else console.log("usage: bun .claude/evals/log-pose-v3.ts --extract [--days 60] | --classify [--batch 25] [--parallel 4] | --sample [--n 300] [--seed 1] [--force] | --judge [--model m [--allow-expensive]] [--split tune|test|all] [--limit N] | --label [--n 60] [--port 4391] | --arm h-low|h-med|h-high|s-none|s-v2|hook [--run 1] [--limit N] [--cases f] | --dict-judge [--parallel 4]");
}
