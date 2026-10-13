#!/usr/bin/env bun

/**
 * Prompt Router Hook (UserPromptSubmit, registered with `"async": true`)
 *
 * A cheap model reads each human prompt while the main model already works on it.
 * It returns misheard terms (dictation: "Pone Griff" → Poneglyph) and up to 3
 * skills from the catalog. Claude Code delivers an async hook's additionalContext
 * at the first API request after the hook exits, so the note lands mid-turn
 * (measured 2026-10-08: after the first tool result, never before).
 *
 * Why: skills the user relies on loaded only when named (2026-10-02 → 10-08: 63
 * named, 25 autonomous calls, 2 of 13 keyword hints followed), and voice mangles
 * names. Retrieval then confirmation by the main model is the pattern that
 * measured best (RAG-MCP, Anthropic Tool Search); the raw prompt is never rewritten.
 *
 * Codex and Grok (`--host codex|grok`, started detached by native-hook.ts): neither host
 * takes context from an async UserPromptSubmit, so the note goes to a per-session file and
 * native-hook.ts hands it over once, as PreToolUse context on the next tool call.
 *
 * Fail-open: any error, timeout or bad answer → no output and one log line.
 * Claude Code enforces no timeout on async hooks, so this process kills its own
 * child at ROUTER_TIMEOUT_MS, and a newer prompt in the same session kills the
 * router still running for the previous one (its note would be stale).
 */

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, sep } from "node:path";
import { readHookStdin } from "./lib/hook-stdin";
import { claudeConfigDir } from "./lib/paths";
import { frontmatter } from "../scripts/lib/skill-metadata";
import { foldText, isNonHumanPayload, skillOverrides } from "./skill-activation";
import { formatPast, memoryFile, memoryIsStale, pastFor, sessionSkills } from "./router/memory";

const ROUTER_TIMEOUT_MS = 15_000;
const MIN_WORDS = 6;
const MAX_PROMPT_CHARS = 3000;
const MAX_SKILLS = 3;
const DESCRIPTION_CHARS = 600;

const configDir = () => claudeConfigDir();

export type RouterHost = "claude" | "codex" | "grok";
export interface CatalogEntry { name: string; description: string }
// `effort`: why the task needs more reasoning than the session default ("" = it does not).
export interface RouterResult { fixes: { heard: string; meant: string }[]; skills: { name: string; why: string }[]; effort?: string }

// The prompt text the router should read, or null when it should not run. The env
// checks come first so headless runs and the router's own child never parse stdin.
export function routablePrompt(raw: string, env: Record<string, string | undefined> = process.env, platform = process.platform, host: RouterHost = "claude"): string | null {
  if (env.PONEGLYPH_ROUTER) return null; // "1" in the router's own child, "off" to opt out
  // Codex and Grok mark no headless run. Launched from a Claude session (a consultation or a
  // delegation), they inherit CLAUDECODE, and nobody is typing there.
  if (host !== "claude" && env.CLAUDECODE) return null;
  // ponytail: POSIX only, process-group kill (`kill(-pid)`) does not exist on Windows, so
  // the timeout could not stop the child; port with `taskkill /T` when a Windows machine runs it.
  if (platform === "win32") return null;
  // Headless runs (`claude -p`, SDK, Agentic OS consultations) have nobody to help.
  // Both variables are undocumented; if they change, `-p` teardown still kills the hook.
  if (env.CLAUDE_CODE_SESSION_ATTENDED === "0" || env.CLAUDE_CODE_ENTRYPOINT?.startsWith("sdk")) return null;
  let prompt: unknown;
  try { prompt = (JSON.parse(raw) as { prompt?: unknown }).prompt; } catch { return null; }
  if (typeof prompt !== "string" || isNonHumanPayload(prompt)) return null;
  const goal = prompt.trimStart().match(/^\/goal\s+(.+)/is);
  const text = goal ? goal[1] : prompt;
  // Commands: `/name` everywhere, `$name` in Codex.
  if (!goal && (text.trimStart().startsWith("/") || (host === "codex" && /^\s*\$[a-z]/i.test(text)))) return null;
  if (text.trim().split(/\s+/).length < MIN_WORDS) return null;
  return text.slice(0, MAX_PROMPT_CHARS);
}

interface PluginRoot { name: string; root: string }

// Enabled plugins installed for the user, or for the project that contains `cwd`.
export function enabledPluginRoots(cwd: string, config = configDir()): PluginRoot[] {
  const enabled: Record<string, unknown> = {};
  for (const file of [join(config, "settings.json"), join(cwd, ".claude", "settings.json"), join(cwd, ".claude", "settings.local.json")]) {
    try { Object.assign(enabled, JSON.parse(readFileSync(file, "utf8")).enabledPlugins ?? {}); } catch { /* missing or invalid */ }
  }
  let registry: Record<string, { scope?: string; projectPath?: string; installPath?: string }[]> = {};
  try { registry = JSON.parse(readFileSync(join(config, "plugins", "installed_plugins.json"), "utf8")).plugins ?? {}; } catch { return []; }
  const roots: PluginRoot[] = [];
  for (const [key, installs] of Object.entries(registry)) {
    if (enabled[key] !== true) continue;
    const install = installs.find((i) => i.installPath && (i.scope === "user" ||
      (i.projectPath !== undefined && (cwd === i.projectPath || cwd.startsWith(i.projectPath + sep)))));
    if (install?.installPath) roots.push({ name: key.split("@")[0], root: install.installPath });
  }
  return roots;
}

// Skills the main model can load, under the name the Skill tool takes: project and
// user skills bare (project shadows user), plugin skills as `plugin:skill`. Skills the
// model cannot load (`off`, `user-invocable-only`, `disable-model-invocation`) are left
// out. `name-only` skills stay: the main model sees only their names, so the router is
// the one that reads `description` + `when_to_use` for them. Skills synced from claude.ai
// live in <config>/skills/synced/<account>/ and load as `anthropic-skills:<name>`.
// Plugins and synced skills exist only in Claude: other hosts pass `plugins = []`, `synced = false`.
const syncedDirs = (config: string) => {
  try { return readdirSync(join(config, "skills", "synced")).map((d) => join(config, "skills", "synced", d)); } catch { return []; }
};

export function loadCatalog(cwd: string, config = configDir(), plugins = enabledPluginRoots(cwd, config), descriptionChars = DESCRIPTION_CHARS, synced = true): CatalogEntry[] {
  const overrides = skillOverrides(cwd, config);
  const sources = [
    { dir: join(cwd, ".claude", "skills"), prefix: "" },
    { dir: join(config, "skills"), prefix: "" },
    ...plugins.map((p) => ({ dir: join(p.root, "skills"), prefix: `${p.name}:` })),
    ...(synced ? syncedDirs(config) : []).map((dir) => ({ dir, prefix: "anthropic-skills:" })),
  ];
  const byName = new Map<string, CatalogEntry>();
  for (const { dir, prefix } of sources) {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const entry of entries) {
      const name = prefix + entry;
      if (byName.has(name)) continue;
      try {
        const { fields } = frontmatter(readFileSync(join(dir, entry, "SKILL.md"), "utf8"));
        if (typeof fields.description !== "string" || !fields.description.trim()) continue;
        const mode = overrides[name];
        if (fields["disable-model-invocation"] === true || mode === "off" || mode === "user-invocable-only") continue;
        const text = [fields.description, typeof fields.when_to_use === "string" ? fields.when_to_use : ""].join(" ");
        byName.set(name, { name, description: text.replace(/\s+/g, " ").trim().slice(0, descriptionChars) });
      } catch { /* no SKILL.md or invalid YAML */ }
    }
  }
  return [...byName.values()];
}

// Core terms ship with Poneglyph; the user's own terms live in <config>/router-glossary.json
// (outside any repo) and a plugin adds its own in `router-glossary.json` at its root.
// Company names stay out of this public repo.
export function glossaryFiles(cwd: string, config = configDir(), plugins = enabledPluginRoots(cwd, config)): string[] {
  return [join(import.meta.dir, "router", "glossary.json"), join(config, "router-glossary.json"), ...plugins.map((p) => join(p.root, "router-glossary.json"))];
}

export function loadGlossary(files: string[]): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  for (const file of files) {
    try {
      for (const [term, heard] of Object.entries(JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>)) {
        if (Array.isArray(heard)) merged[term] = [...new Set([...(merged[term] ?? []), ...heard.filter((h): h is string => typeof h === "string")])];
      }
    } catch { /* missing or invalid */ }
  }
  return merged;
}

export function buildSystemPrompt(template: string, catalog: CatalogEntry[], glossary: Record<string, string[]>): string {
  const terms = Object.entries(glossary).map(([term, heard]) => `${term}: ${heard.join(", ")}`).join(" | ");
  return template
    .replace("{{glossary}}", terms || "(none)")
    .replace("{{catalog}}", catalog.map((c) => `- ${c.name}: ${c.description}`).join("\n"));
}

export interface RouterAgent { name: string; definition: Record<string, unknown> }

// The glossary and catalog block that follows the agent body in the system prompt.
export const CATALOG_HEADER = "Catalog (name: description):";
export function routerContext(catalog: CatalogEntry[], glossary: Record<string, string[]>): string {
  return buildSystemPrompt(`Glossary (term: heard variants):\n{{glossary}}\n\n${CATALOG_HEADER}\n{{catalog}}`, catalog, glossary);
}

export const ROUTER_AGENT_FILE = join(import.meta.dir, "router", "prompt-router.md");
// The registered subagent sync-claude writes: the agent file with the glossary and the
// user-level catalog baked in. A catalog sent with the task is never cached (~3x the cost).
export const installedRouterAgent = (config = configDir()) => join(config, "agents", "prompt-router.md");
export function routerAgentFile(file: string, catalog: CatalogEntry[], glossary: Record<string, string[]>): string {
  return `${readFileSync(file, "utf8").trimEnd()}\n\n${routerContext(catalog, glossary)}\n`;
}

// The router is a Claude Code agent: `router/prompt-router.md` holds its model and effort
// (frontmatter) and its system prompt (body). The main model can launch it as a registered
// subagent (hooks/router/agent-hooks.ts feeds it); this script passes it with `--agents`
// for one call. `tools` and `omitClaudeMd` serve the subagent only: `tools` (like
// `maxTurns`) removes the structured-output turn, so this call drops them.
export function loadRouterAgent(file: string, catalog: CatalogEntry[], glossary: Record<string, string[]>): RouterAgent {
  const { fields, body } = frontmatter(readFileSync(file, "utf8"));
  const { name, tools: _tools, omitClaudeMd: _omit, ...definition } = fields;
  if (typeof name !== "string" || !name) throw new Error(`${file}: agent needs a name`);
  return { name, definition: { ...definition, prompt: `${body.trim()}\n\n${routerContext(catalog, glossary)}` } };
}

// The skills that load alongside the main one. A list answer picked them in under half the
// cases; an answer for each, in the same call, raised user-label hits with little precision
// cost (held-out even half, 2026-10-09). The answer is the reason (empty = no), because the
// main model sees only skill names. parseRouterOutput adds each one after the list.
const PROCESS_SKILLS = ["dev-workflow", "drillme-clarify", "natural-writing", "changes-verify"];
// CLAUDE.md summarises these two, and the main model kept declining them because of that summary.
const DEEP_SKILLS = ["dev-workflow", "drillme-clarify"];
export const DEEP_SKILLS_LINE = "`dev-workflow` and `drillme-clarify` go much deeper than the summary in your instructions; that summary is never a reason for no.";

// Only the user can raise effort; the hook cannot see the session's level, so the main model
// proposes it once. Opus runs `medium` by default (host-config.ts); Codex and Grok run `high`.
const EFFORT_CALL: Record<RouterHost, string> = {
  claude: "`/effort high`",
  codex: "a restart with `-c model_reasoning_effort=xhigh`",
  grok: "a restart with `--effort xhigh`",
};
export function effortLine(why: string, host: RouterHost = "claude"): string {
  return `Hard task (${why}): unless this session already runs at a higher effort, propose ${EFFORT_CALL[host]} to the user in one line before you start; the user decides.`;
}

// `--json-schema` makes the CLI validate the answer; `why` comes before `name` so the
// model states the matching part of the request before it picks a skill.
const ROUTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fixes", "process", "skills", "effort"],
  properties: {
    fixes: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["heard", "meant"], properties: { heard: { type: "string" }, meant: { type: "string" } } } },
    process: { type: "object", additionalProperties: false, required: PROCESS_SKILLS, properties: Object.fromEntries(PROCESS_SKILLS.map((n) => [n, { type: "string" }])) },
    skills: { type: "array", maxItems: MAX_SKILLS, items: { type: "object", additionalProperties: false, required: ["why", "name"], properties: { why: { type: "string" }, name: { type: "string" } } } },
    effort: { type: "string" },
  },
};

// `claude -p --output-format json` puts the schema-checked answer in `.structured_output`;
// without it, the model's text in `.result` (maybe fenced) is parsed. Anything off-contract
// is dropped: unknown skills, skills the prompt already names or the session already
// loaded (`loaded`), fixes whose "heard" text is not in the prompt. With a glossary, a fix
// must also land on a glossary term: the model corrects ordinary spelling otherwise.
export function parseRouterOutput(stdout: string, prompt: string, catalog: CatalogEntry[], opts: { glossary?: Record<string, string[]>; loaded?: Set<string> } = {}): RouterResult | null {
  let text: string;
  try {
    const envelope = JSON.parse(stdout) as { result?: unknown; structured_output?: unknown; is_error?: boolean };
    if (envelope.is_error) return null;
    if (envelope.structured_output && typeof envelope.structured_output === "object") text = JSON.stringify(envelope.structured_output);
    else if (typeof envelope.result === "string") text = envelope.result;
    else return null;
  } catch { return null; }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let answer: { fixes?: unknown; skills?: unknown; process?: unknown; effort?: unknown };
  try { answer = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  const folded = foldText(prompt);
  const known = new Set(catalog.map((c) => c.name));
  const terms = opts.glossary ? new Set(Object.keys(opts.glossary).map(foldText)) : null;
  const fixes = (Array.isArray(answer.fixes) ? answer.fixes : [])
    .filter((f): f is { heard: string; meant: string } => typeof f?.heard === "string" && typeof f?.meant === "string")
    .map((f) => ({ heard: f.heard.trim(), meant: f.meant.trim() }))
    .filter((f) => f.heard && f.meant && f.heard.length <= 60 && f.meant.length <= 60 &&
      foldText(f.heard) !== foldText(f.meant) && folded.includes(foldText(f.heard)) && (!terms || terms.has(foldText(f.meant))))
    .slice(0, 5);
  // `process` ({skill: reason}): a non-empty reason is one more candidate after the list.
  // `true` is still read, for an answer written before the reason existed.
  // Haiku sometimes writes the empty answer as a literal `""`, so quotes around a no are dropped.
  const isNo = (v: string) => /^(?:|no|none|false|n\/a|not needed|-|—)$/i.test(v.trim().replace(/^["'`]+|["'`]+$/g, "").trim().replace(/\.$/, ""));
  const companions = answer.process && typeof answer.process === "object"
    ? Object.entries(answer.process)
      .filter(([, v]) => v === true || (typeof v === "string" && !isNo(v)))
      .map(([name, v]) => ({ name, why: typeof v === "string" ? v : "" })) : [];
  const seen = new Set<string>();
  const skills = [...(Array.isArray(answer.skills) ? answer.skills : []), ...companions]
    .filter((s): s is { name: string; why?: unknown } => typeof s?.name === "string")
    .filter((s) => known.has(s.name) && !folded.includes(`/${s.name}`) && !folded.includes(`$${s.name}`) && !opts.loaded?.has(s.name) && !seen.has(s.name) && seen.add(s.name))
    .slice(0, MAX_SKILLS)
    .map((s) => ({ name: s.name, why: typeof s.why === "string" ? s.why.replace(/\s+/g, " ").trim().slice(0, 100) : "" }));
  const effort = typeof answer.effort === "string" && !isNo(answer.effort) ? answer.effort.replace(/\s+/g, " ").trim().slice(0, 100) : "";
  return { fixes, skills, effort };
}

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// How each host's model loads a skill.
const SKILL_CALL: Record<RouterHost, { line: (name: string) => string; how: string }> = {
  claude: { line: (n) => `Skill(${n})`, how: "load the yes ones with the Skill tool" },
  codex: { line: (n) => `$${n}`, how: "read and follow the SKILL.md of the yes ones" },
  grok: { line: (n) => `/${n}`, how: "load the yes ones" },
};

// The note names the prompt it belongs to: when the main model answers without a
// tool call, the note only rides the next prompt and must be recognisable as late.
export function buildRouterNote(result: RouterResult, prompt: string, host: RouterHost = "claude"): string {
  if (!result.fixes.length && !result.skills.length && !result.effort) return "";
  const words = prompt.replace(/\s+/g, " ").trim().split(" ");
  const re = escapeAttr(words.slice(0, 8).join(" ") + (words.length > 8 ? " …" : ""));
  const lines = [`<prompt-router re="${re}">`, "A cheap model read the user's prompt while you started."];
  if (result.fixes.length) lines.push(`Probable dictation fixes: ${result.fixes.map((f) => `"${f.heard}" → ${f.meant}`).join("; ")}.`);
  if (result.skills.length) {
    lines.push(`Candidate skills: answer each one now in one progress line, \`Router: <skill> sí (<why>); <skill> no (<why>)\`, then ${SKILL_CALL[host].how}.`);
    lines.push(...result.skills.map((s) => `- ${SKILL_CALL[host].line(s.name)}${s.why ? `: ${s.why}` : ""}`));
    if (result.skills.some((s) => DEEP_SKILLS.includes(s.name))) lines.push(DEEP_SKILLS_LINE);
  }
  if (result.effort) lines.push(effortLine(result.effort, host));
  lines.push("If you already answered that prompt, ignore this note.", "</prompt-router>");
  return lines.join("\n");
}

// One line in the main model's context when the router will run, so it starts at once
// and expects the note (the user asked for that contract). Printed by skill-activation.ts.
export const ROUTER_PENDING_LINE =
  "<prompt-router-pending>A cheap model is reading this prompt; term fixes and skill candidates may arrive mid-turn as <prompt-router>. Start now, do not wait for it.</prompt-router-pending>";

// --- IO ---------------------------------------------------------------------------

const routerDir = () => join(tmpdir(), "poneglyph-router");
const NOTE_TTL_MS = 10 * 60_000;
export const routerNoteFile = (session: string, dir = routerDir()) => join(dir, `${session.replace(/[^\w-]/g, "")}.note`);

// Codex and Grok: the first tool call after the router finished takes the note, once.
// A note older than NOTE_TTL_MS belongs to a prompt the model has long answered.
export function takeRouterNote(session: string, dir = routerDir(), now = Date.now()): string | null {
  const file = routerNoteFile(session, dir);
  try {
    const fresh = now - statSync(file).mtimeMs < NOTE_TTL_MS;
    const note = fresh ? readFileSync(file, "utf8") : null;
    unlinkSync(file);
    return note || null;
  } catch { return null; }
}

const claudeBin = () => process.env.PONEGLYPH_CLAUDE_BIN ?? Bun.which("claude") ?? join(homedir(), ".local", "bin", "claude");

// `--tools ""` belongs here, not in the agent file: without it the model reaches for git
// and the call takes several turns; in the agent file it also blocks the schema answer.
export function routerArgs(agent: RouterAgent): string[] {
  return ["-p", "--setting-sources", "", "--settings", JSON.stringify({ disableAllHooks: true, claudeMdExcludes: ["**"] }),
    "--agents", JSON.stringify({ [agent.name]: agent.definition }), "--agent", agent.name,
    "--no-session-persistence", "--tools", "", "--strict-mcp-config", "--disable-slash-commands",
    "--json-schema", JSON.stringify(ROUTER_SCHEMA), "--output-format", "json"];
}

type Outcome = "ok" | "empty" | "bad-output" | "error" | "timeout" | "superseded";

// Runs the router CLI in its own process group so a timeout or a newer prompt can kill
// the whole tree. The prompt goes through stdin: a prompt starting with "-" is not a flag.
// `context` (the <past> block) follows the prompt there, so the system prompt stays cached.
export function runRouter(agent: RouterAgent, prompt: string, pidFile: string | null, timeoutMs = ROUTER_TIMEOUT_MS, context = ""): Promise<{ outcome: Outcome; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn(claudeBin(), routerArgs(agent), { detached: true, stdio: ["pipe", "pipe", "ignore"], env: { ...process.env, PONEGLYPH_ROUTER: "1" } });
    let stdout = "";
    let timedOut = false;
    const killGroup = () => { try { process.kill(-child.pid!, "SIGKILL"); } catch { /* already gone */ } };
    const timer = setTimeout(() => { timedOut = true; killGroup(); }, timeoutMs);
    if (pidFile && child.pid) try { writeFileSync(pidFile, String(child.pid)); } catch { /* best-effort */ }
    child.stdout!.on("data", (chunk) => { stdout += chunk; });
    child.on("error", () => { clearTimeout(timer); resolve({ outcome: "error", stdout }); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (pidFile) try { if (readFileSync(pidFile, "utf8") === String(child.pid)) unlinkSync(pidFile); } catch { /* replaced or gone */ }
      resolve({ outcome: timedOut ? "timeout" : signal ? "superseded" : code === 0 ? "ok" : "error", stdout });
    });
    child.stdin!.end(`<prompt>\n${prompt}\n</prompt>${context ? `\n${context}` : ""}`);
  });
}

// A router still running for this session's previous prompt would deliver a stale note.
// Only a pidfile younger than the timeout can name a live router: an older one was left
// by a session that closed mid-run, and its pid may now belong to an unrelated process.
export function killPrevious(pidFile: string, now = Date.now()): void {
  try {
    const fresh = now - statSync(pidFile).mtimeMs < ROUTER_TIMEOUT_MS + 5_000;
    const pid = Number(readFileSync(pidFile, "utf8"));
    if (fresh && pid > 0) process.kill(-pid, "SIGKILL");
    else unlinkSync(pidFile);
  } catch { /* none running */ }
}

// A stale index is rebuilt by a detached child, so this hook exits (and delivers its
// note) at once. The lock keeps prompts in quick succession from starting several builds.
function refreshMemory(cwd: string): void {
  const lock = `${memoryFile()}.lock`;
  if (!memoryIsStale() || Date.now() - (statSafe(lock) ?? 0) < 600_000) return;
  try {
    writeFileSync(lock, String(process.pid));
    spawn(process.execPath, [join(import.meta.dir, "router", "memory.ts"), "--build", cwd], { detached: true, stdio: "ignore" }).unref();
  } catch { /* best-effort */ }
}

const statSafe = (file: string) => { try { return statSync(file).mtimeMs; } catch { return null; } };

export function log(cwd: string, fields: Record<string, string | number>): void {
  const dir = join(cwd, ".claude", "learned");
  if (!existsSync(join(cwd, ".claude"))) return;
  try {
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "prompt-router.log"), `${new Date().toISOString()} ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(" ")}\n`);
  } catch { /* best-effort */ }
}

if (import.meta.main) {
  const started = Date.now();
  const hostArg = process.argv[process.argv.indexOf("--host") + 1];
  const host: RouterHost = hostArg === "codex" || hostArg === "grok" ? hostArg : "claude";
  let cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    const raw = await readHookStdin();
    const prompt = routablePrompt(raw, process.env, process.platform, host);
    if (prompt !== null) {
      const payload = JSON.parse(raw) as { session_id?: string; cwd?: string; transcript_path?: string };
      if (typeof payload.cwd === "string" && (host !== "claude" || !process.env.CLAUDE_PROJECT_DIR)) cwd = payload.cwd;
      const session = typeof payload.session_id === "string" ? payload.session_id.replace(/[^\w-]/g, "") : "";
      mkdirSync(routerDir(), { recursive: true });
      const pidFile = session ? join(routerDir(), `${session}.pid`) : null;
      if (pidFile) killPrevious(pidFile);
      const plugins = host === "claude" ? enabledPluginRoots(cwd) : [];
      const catalog = loadCatalog(cwd, configDir(), plugins, DESCRIPTION_CHARS, host === "claude");
      const glossary = loadGlossary(glossaryFiles(cwd, configDir(), plugins));
      const agent = loadRouterAgent(ROUTER_AGENT_FILE, catalog, glossary);
      const past = pastFor(prompt, new Set(catalog.map((c) => c.name)));
      // Only a Claude transcript is parsed: never read another host's transcript as Claude JSONL.
      const loading = host === "claude" ? sessionSkills(payload.transcript_path) : Promise.resolve(new Set<string>());
      const run = await runRouter(agent, prompt, pidFile, ROUTER_TIMEOUT_MS, formatPast(past));
      const result = run.outcome === "ok" ? parseRouterOutput(run.stdout, prompt, catalog, { glossary, loaded: await loading }) : null;
      const note = result ? buildRouterNote(result, prompt, host) : "";
      log(cwd, {
        host, session: session.slice(0, 8), outcome: run.outcome === "ok" ? (result ? (note ? "ok" : "empty") : "bad-output") : run.outcome,
        ms: Date.now() - started, skills: result?.skills.map((s) => s.name).join(",") || "-", fixes: result?.fixes.length ?? 0, effort: result?.effort ? "high" : "-", past: past.length,
        attended: process.env.CLAUDE_CODE_SESSION_ATTENDED ?? "-", entry: process.env.CLAUDE_CODE_ENTRYPOINT ?? "-",
      });
      if (note && host === "claude") process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: note } }));
      else if (note && session) writeFileSync(routerNoteFile(session), note);
      refreshMemory(cwd);
    }
  } catch {
    log(cwd, { outcome: "error", ms: Date.now() - started });
  }
  process.exit(0);
}
