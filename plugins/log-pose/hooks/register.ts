import type { EngineInterface, Register } from "claude-code";
import {
  type Decision, type Effort, type LastTurn, LEVELS, type Outcome, type Reply, type StepUsage,
  appendCapped, buildNote, cacheBroke, classifierPrompt, decide, effortNote, extraCatalog, extraGlossary, floorOf, formatPast,
  isContinuation, learnedPath, logLine, mergeGlossaries, parseAgentFile, parseMemory, parseReply, pastFor, PHASE_SKILLS, phaseHint, routable, settingsEffort, skillFrontmatter, skillsInHistory, withFloor,
} from "./core.ts";

// One Sonnet call per typed prompt, before step 0: dictation fixes, skill candidates, effort and
// advisor gauge, in one note. Opus 5.5 main-loop steps then run at that effort.
// Sonnet at low effort, not Haiku: on the held-out router eval (2026-10-15) Haiku without
// thinking trailed the hook by ~7 hits of 64; Haiku at medium matched it at p95 5.3 s; Sonnet
// beat it by 3-6 with the same false positives at p95 2.9 s, about 0.0035 $ a prompt.

const OPUS = "claude-opus-5-5";
const TOOL = "mcp__log-pose__set";
const MODEL = "sonnet";
const TIMEOUT_MS = 8000;
const GAP_MS = 5 * 60_000;
const DESCRIPTION = "Sets the reasoning effort for the rest of this task when log-pose picked the wrong level. `auto` hands the choice back to log-pose. It applies from the next step.";
const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["effort", "reason"],
  properties: {
    effort: { type: "string", enum: ["low", "medium", "high", "xhigh", "auto"] },
    reason: { type: "string", description: "Why, in a few words." },
  },
} as const;

type Step = StepUsage & { model: string; messages: number; at: number; effort: Effort };

let cwd = "";
let config = "";
let logFile = "";
let session = "";
let extra: { name: string; description: string }[] = [];
const loaded = new Set<string>();
const hinted = new Set<string>();
let previous = "";
// The main turn running now and the last one that ended, for the next follow-up's `<last-turn>`.
// Only turns a typed prompt opened count: a task notification's turn is not the work the next
// follow-up continues (`<previous>` stays the last typed prompt).
let ran = { steps: 0, tools: 0, level: null as string | null };
let lastTurn: LastTurn | null = null;
let nextTyped = true;
let typedTurn = true;
let decision: Decision | null = null;
let override: { effort: Effort; reason: string } | null = null;
let pending: Decision | null = null;
const decisions = new Map<string, Decision>();
let mainTurn = "";
let mode: "rewrite" | "steer" = "rewrite";
let breaks = 0;
let last: Step | null = null;
let rewrote = false;
let sessionEffort: unknown = null;
let warned = false;
let seq = 0;
const unwritten: string[] = [];
let writing: Promise<void> = Promise.resolve();

// The decision in force with Opus's override on top: a prompt that is not classified (a
// continuation, another origin, a failed call) keeps the task, so it keeps the override too.
function current(): Decision | null {
  if (!override) return decision;
  return { effort: override.effort, task: decision?.task ?? override.effort, gauge: decision?.gauge ?? 1, labels: decision?.labels ?? null, override: override.effort };
}

// A prompt's row is written at once and steps every FLUSH_STEPS, so a long turn, or a session closed
// before its turn ends, keeps them on disk.
const FLUSH_STEPS = 50;
async function record($: EngineInterface, row: Record<string, unknown>) {
  unwritten.push(JSON.stringify({ at: await $.clock.now(), ...row }));
  if (row.ev === "submit" || unwritten.length >= FLUSH_STEPS) await flush($);
}

// Appended with `>>` as the hook's appendLog does, so parallel sessions never drop a line.
async function append($: EngineInterface, file: string, lines: string) {
  const appended = await $.process.run(["/bin/sh", "-c", 'mkdir -p "$(dirname "$1")" && cat >> "$1"', "sh", file], { stdin: `${lines}\n` })
    .then((r) => r.exitCode === 0, () => false);
  if (appended) return;
  // ponytail: without a shell (Windows, or a guard that denies it) the file is rewritten whole and a line another session wrote meanwhile can be lost; upgrade when `$.fs` gains an append.
  const text = (await $.fs.exists(file).catch(() => false)) ? await $.fs.read(file).catch(() => null) : "";
  // A log that exists but cannot be read is kept, never rewritten as this one line.
  if (text === null) return;
  await $.fs.write(file, appendCapped(String(text), lines)).catch(() => {});
}

// The session's rows, appended at each prompt (see `record`) and when a turn or the session ends:
// one shell per prompt and turn, not one per step. Chained, so writes that overlap keep their order.
// ponytail: a session's file grows without a cap (~300 bytes a step); cap it when one passes a few MB.
function flush($: EngineInterface): Promise<void> {
  if (!session || !unwritten.length) return writing;
  const file = session, lines = unwritten.splice(0).join("\n");
  writing = writing.then(async () => {
    const home = await $.env.get("HOME");
    if (home) await append($, `${home}/.cache/poneglyph/log-pose/${file}.jsonl`, lines);
  }).catch(() => {});
  return writing;
}

// The router log the hook writes too, at the same path; Agentic OS and workboard read it.
async function routerLog($: EngineInterface, fields: Parameters<typeof logLine>[1]) {
  if (logFile) await append($, logFile, logLine(new Date(await $.clock.now()).toISOString(), fields));
}

// After /clear or a resume the process goes on under another id, and no `session.start` fires:
// the old conversation's skills, prompt, decision and override stay behind with its rows.
async function follow($: EngineInterface) {
  const id = await $.session.id();
  if (id === session) return;
  await flush($);
  session = id;
  loaded.clear();
  hinted.clear();
  for (const name of skillsInHistory(await $.session.messages().catch(() => []))) loaded.add(name);
  previous = "";
  lastTurn = null;
  nextTyped = typedTurn = true;
  decision = null;
  override = null;
  pending = null;
  decisions.clear();
  mainTurn = "";
  last = null;
  breaks = 0;
  await record($, { ev: "session", mode, switched: true });
}

async function skillsIn($: EngineInterface, dir: string, prefix = "") {
  const out: { name: string; description: string }[] = [];
  const entries = await $.fs.list(dir).catch(() => []);
  for (const entry of entries) {
    if (entry.kind !== "dir" && !entry.isLink) continue;
    const text = await $.fs.read(`${dir}/${entry.name}/SKILL.md`).catch(() => "");
    const fm = typeof text === "string" ? skillFrontmatter(text) : null;
    if (fm) out.push({ ...fm, name: prefix + fm.name });
  }
  return out;
}

const readJson = async ($: EngineInterface, file: string) => {
  try { return JSON.parse(String(await $.fs.read(file))) as Record<string, unknown>; } catch { return {}; }
};

// The project's own skills and those of plugins enabled for this project only: the synced agent
// file lists the user-level ones (enabledPluginRoots in prompt-router.ts picks the same installs).
// `skillOverrides` drops the ones the model cannot load, as the hook's loadCatalog does.
async function projectSkills($: EngineInterface, dir: string) {
  const out = await skillsIn($, `${dir}/.claude/skills`);
  const enabled: Record<string, unknown> = {};
  for (const f of [`${dir}/.claude/settings.json`, `${dir}/.claude/settings.local.json`]) Object.assign(enabled, (await readJson($, f)).enabledPlugins ?? {});
  const registry = ((await readJson($, `${config}/plugins/installed_plugins.json`)).plugins ?? {}) as Record<string, { projectPath?: string; installPath?: string }[]>;
  for (const [key, installs] of Object.entries(registry)) {
    if (enabled[key] !== true) continue;
    const install = installs.find((i) => i.installPath && i.projectPath !== undefined && (dir === i.projectPath || dir.startsWith(`${i.projectPath}/`)));
    if (install?.installPath) out.push(...(await skillsIn($, `${install.installPath}/skills`, `${key.split("@")[0]}:`)));
  }
  const settings: Readonly<Record<string, unknown>> = await $.settings.read().catch(() => ({}));
  const overrides = (settings.skillOverrides ?? {}) as Record<string, unknown>;
  return out.filter((s) => overrides[s.name] !== "off" && overrides[s.name] !== "user-invocable-only");
}

// `why`: what left the call without a reply, for the session log only (the router log's schema is Agentic OS's).
type Classified = { outcome: Outcome; ms: number; reply: Reply | null; past: number; raw?: string; input?: number; output?: number; read?: number; write?: number; why?: string };

// The one model call. Never throws: any failure is an outcome.
// `arm` swaps model, effort and timeout for the eval only.
type Arm = { model: string; effort: "low" | "medium" | "high" | "xhigh"; timeoutMs: number; fallback?: boolean };
const LIVE: Arm = { model: MODEL, effort: "low", timeoutMs: TIMEOUT_MS };

// `pastBefore`: only memory entries older than this epoch ms reach `<past>`; 0 means none.
async function classify($: EngineInterface, text: string, prev: string, pastBefore = Infinity, arm: Arm = LIVE, turn: LastTurn | null = null): Promise<Classified> {
  const started = await $.clock.now();
  const elapsed = async () => (await $.clock.now()) - started;
  const file = await $.fs.read(`${config}/agents/prompt-router.md`).catch(() => "");
  const agent = typeof file === "string" ? parseAgentFile(file, arm.fallback) : null;
  if (!agent) return { outcome: "error", ms: await elapsed(), reply: null, past: 0, why: "agent file missing or without a catalog" };
  const memory = pastBefore > 0 ? parseMemory(String(await $.fs.read(`${config}/router-memory.jsonl`).catch(() => ""))).filter((e) => e.at < pastBefore) : [];
  const past = pastFor(text, agent.known, memory);
  const known = new Set([...agent.known, ...extra.map((e) => e.name)]);
  // The hook reads the glossaries live; terms added since the last sync go in the prompt.
  const glossary = mergeGlossaries(await Promise.all([`${config}/hooks/router/glossary.json`, `${config}/router-glossary.json`].map(async (f) => String(await $.fs.read(f).catch(() => "")))));
  const newTerms = extraGlossary(glossary, agent.terms);
  const terms = newTerms.terms;
  try {
    const r = await $.model.complete({
      model: arm.model,
      system: [{ text: agent.system, cache: true }],
      prompt: classifierPrompt(text, prev, formatPast(past), [extraCatalog(extra, agent.known), newTerms.block].filter(Boolean).join("\n\n"), turn),
      effort: arm.effort,
      maxTokens: 600,
      timeoutMs: arm.timeoutMs,
    });
    const ms = await elapsed();
    // `aborted` is the timeout or a cancel (escape, a newer prompt): cancels of 1.2-2 s were logged
    // as timeouts and counted toward the hook's `modFailing` (10-22, 10-23). `superseded` is the
    // hook's own word for a cancelled run, and Agentic OS reads it.
    if (!r.isAnswered) {
      const why = r.reason === "api-error" ? `api-error ${r.status ?? "-"} ${r.error}` : r.reason;
      return { outcome: r.reason !== "aborted" ? "error" : ms >= arm.timeoutMs - 100 ? "timeout" : "superseded", ms, reply: null, past: past.length, why };
    }
    const reply = parseReply(r.text, text, known, terms.size ? terms : null, loaded);
    const u = r.usage;
    return {
      outcome: !reply ? "bad-output" : reply.skills.length || reply.fixes.length ? "ok" : "empty",
      ms, reply, past: past.length, raw: r.text.slice(0, 2000),
      input: u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens, output: u.output_tokens, read: u.cache_read_input_tokens, write: u.cache_creation_input_tokens,
    };
  } catch (err) {
    return { outcome: "error", ms: await elapsed(), reply: null, past: past.length, why: String((err as Error)?.message ?? err).slice(0, 120) };
  }
}

// LOG_POSE_EVAL=<cases.jsonl> (one {"id", "prompt", "previous"?, "pastBefore"?} per line): classifies every
// case through the same call and writes {"id", "outcome", "ms", "raw", ...} lines to LOG_POSE_EVAL_OUT.
// The memory holds the eval prompts themselves, so a case sees it only up to its own `pastBefore`.
// LOG_POSE_MODEL, LOG_POSE_EFFORT, LOG_POSE_TIMEOUT and LOG_POSE_PROMPT=fallback pick the arm.
async function evaluate($: EngineInterface, cases: string, out: string) {
  const arm: Arm = {
    model: (await $.env.get("LOG_POSE_MODEL")) || LIVE.model,
    effort: ((await $.env.get("LOG_POSE_EFFORT")) || LIVE.effort) as Arm["effort"],
    timeoutMs: Number(await $.env.get("LOG_POSE_TIMEOUT")) || LIVE.timeoutMs,
    fallback: (await $.env.get("LOG_POSE_PROMPT")) === "fallback",
  };
  const lines: string[] = [];
  for (const line of String(await $.fs.read(cases)).split("\n")) {
    if (!line.trim()) continue;
    const c = JSON.parse(line) as { id: string; prompt: string; previous?: string; pastBefore?: number; last?: LastTurn };
    const r = await classify($, c.prompt, c.previous ?? "", c.pastBefore ?? 0, arm, c.last ?? null);
    lines.push(JSON.stringify({ id: c.id, outcome: r.outcome, ms: r.ms, past: r.past, raw: r.raw ?? null, labels: r.reply?.labels ?? null, skills: r.reply?.skills ?? [], fixes: r.reply?.fixes ?? [], input: r.input ?? null, read: r.read ?? null, output: r.output ?? null }));
    await $.fs.write(out, `${lines.join("\n")}\n`);
  }
}

const isMain = (e: { agentId?: string; model: string; effort?: unknown }) => !e.agentId && e.model === OPUS && typeof e.effort === "string";

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    cwd = e.cwd;
    const home = (await $.env.get("HOME")) ?? "";
    config = (await $.env.get("CLAUDE_CONFIG_DIR")) || `${home}/.claude`;
    session = await $.session.id();
    // The hook's projectRoot and learnedLog: the project dir, and its learned/ only when git ignores it.
    const root = (await $.env.get("CLAUDE_PROJECT_DIR")) || cwd;
    const ignored = await $.process.run(["git", "-C", root, "check-ignore", "-q", ".claude/learned/x.log"]).then((r) => r.exitCode === 0, () => false);
    logFile = learnedPath(root, config, ignored, "prompt-router.log");
    extra = await projectSkills($, cwd);
    // A resumed session already loaded skills; the hook read them from the transcript.
    for (const name of skillsInHistory(await $.session.messages().catch(() => []))) loaded.add(name);
    // Without the per-message effort beta a rewrite would reset the cache: steer with words instead.
    if (await $.env.get("CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS")) mode = "steer";
    // The first prompt's floor, before a step names the session's level.
    sessionEffort = settingsEffort(await $.settings.read().catch(() => ({})), OPUS);
    // A session without built-in tools (`--tools ""`) refuses it; routing still works without the override tool.
    await $.tool.register({ name: "set", description: DESCRIPTION, inputSchema: INPUT_SCHEMA }).catch(() => {});
    // `prompt`: whether the agent file still has the sections the mod's prompt is built from.
    const agent = parseAgentFile(String(await $.fs.read(`${config}/agents/prompt-router.md`).catch(() => "")));
    await record($, { ev: "session", interactive: e.isInteractive, surface: e.surface, mode, extra: extra.length, prompt: agent?.kind ?? "missing" });
    return r;
  });

  // /clear, a resume or the exit: the ending session's rows go to its own file.
  // A remote surface (the desktop app) joins after `session.start`, which saw no surface: the row
  // dates when it joined against the first prompt, the order the drawing mods depend on.
  on("session.attach", async ($, e, next) => {
    const r = await next(e);
    await record($, { ev: "attach", surface: e.surface, client: e.clientId });
    return r;
  });

  on("session.end", async ($, e, next) => {
    await record($, { ev: "end", reason: e.reason });
    await flush($);
    return next(e);
  });

  on("tool.describe", { tool: TOOL as never }, async ($, e, next) => ({ ...(await next(e)), isDeferred: false }));

  // From the next step of the running turn: a level change between steps kept the cache (probe S1,
  // read 0.95-1.00), and waiting for the next prompt left the turn that needed it at the old level.
  on("tool.call", { tool: TOOL as never }, async ($, e) => {
    const input = e as unknown as { effort?: string; reason?: string };
    if (input.effort === "auto") {
      override = null;
      // The decision held the override as its level; back to the task's own.
      if (decision?.override) decision = { ...decision, effort: decision.task, override: null };
    } else if ((LEVELS as readonly string[]).includes(input.effort ?? "") && input.effort !== "max") override = { effort: input.effort as Effort, reason: String(input.reason ?? "").slice(0, 80) };
    else return { result: "effort must be low, medium, high, xhigh or auto.", isError: true };
    await record($, { ev: "override", effort: input.effort, reason: input.reason ?? "" });
    pending = current();
    if (mainTurn) {
      if (pending) decisions.set(mainTurn, pending);
      else decisions.delete(mainTurn);
    }
    return { result: "Applies from the next step." };
  });

  // Skills already in context are never suggested again.
  on("tool.call", { tool: "Skill" }, async ($, e, next) => {
    const name = (e as unknown as { skill?: unknown }).skill;
    if (typeof name === "string") loaded.add(name);
    return next(e);
  });

  // A skill for the phase the call opens (an agent brief, a page for other people): the session's
  // first such call is refused with the hint, and its repeat passes.
  for (const tool of Object.keys(PHASE_SKILLS)) {
    on("tool.call", { tool: tool as never }, async ($, e, next) => {
      if (e.agentId) return next(e);
      const file = await $.fs.read(`${config}/agents/prompt-router.md`).catch(() => "");
      const known = (typeof file === "string" ? parseAgentFile(file)?.known : null) ?? new Set<string>();
      const hint = phaseHint(tool, e as unknown as Record<string, unknown>, loaded, known, hinted);
      if (!hint) return next(e);
      hinted.add(hint.skill);
      await record($, { ev: "hint", skill: hint.skill, tool, blocked: true });
      return { deny: hint.text };
    });
  }

  on("prompt.submit", async ($, e, next) => {
    const evalCases = await $.env.get("LOG_POSE_EVAL");
    const evalOut = await $.env.get("LOG_POSE_EVAL_OUT");
    if (evalCases && evalOut) {
      await evaluate($, evalCases, evalOut);
      return next(e);
    }
    await follow($);
    // A prompt typed over a running turn joins its task: it keeps the turn's level and suggests no
    // skills, which would ask for a second `Router:` line about the same work; its fixes still count.
    const mid = e.turnId !== undefined;
    const kept = () => (mid ? decisions.get(e.turnId!) ?? current() : current());
    const origin = e.origin.kind;
    if (!mid) nextTyped = origin === "composer" || origin === "bridge";
    if (origin !== "composer" && origin !== "bridge") {
      pending = kept();
      await record($, { ev: "other", origin, effort: pending?.effort ?? null });
      return next(e);
    }
    const text = routable(e.text);
    if (!text || isContinuation(e.text)) {
      pending = kept();
      await record($, { ev: "submit", origin, call: false, skip: isContinuation(e.text) ? "continuation" : e.text.trimStart().startsWith("/") ? "command" : "short", effort: pending?.effort ?? null, mid });
      return next(e);
    }
    const mine = ++seq;
    const r = await classify($, text, previous, Infinity, LIVE, lastTurn);
    // A newer prompt already decided; its call still cost, so both logs keep it.
    if (mine !== seq) {
      await record($, { ev: "submit", origin, call: true, outcome: "superseded", ms: r.ms, mid, why: "a newer prompt" });
      await routerLog($, { session, outcome: "superseded", ms: r.ms, skills: [], fixes: 0, effort: "-", past: r.past, input: r.input, output: r.output, read: r.read, write: r.write });
      return next(e);
    }
    if (!mid) {
      previous = text;
      if (r.reply?.labels) {
        decision = decide(r.reply.labels, override?.effort ?? null, null, lastTurn?.level ?? null);
        if (!decision.override) override = null;
      }
    }
    pending = kept();
    const floor = floorOf(sessionEffort);
    const shown = pending && withFloor(pending, floor);
    if (shown && shown.effort !== pending!.effort && !warned) {
      warned = true;
      try { await $.ui.toast(`log-pose: the session runs at ${floor}, a floor over every level log-pose picks; /effort medium hands the level back.`); } catch { /* no UI */ }
    }
    const steer = mode === "steer" && shown ? (shown.effort === "low" ? " Answer directly without deliberating." : shown.effort === "medium" ? "" : " Please think hard before responding.") : "";
    const skills = mid ? [] : r.reply?.skills ?? [];
    const note = buildNote({ fixes: r.reply?.fixes ?? [], skills, labels: null }, text, pending && !mid ? effortNote(pending, override?.reason, floor) + steer : "");
    await record($, { ev: "submit", origin, call: true, outcome: r.outcome, ms: r.ms, labels: r.reply?.labels ?? null, skills: skills.map((s) => s.name), fixes: r.reply?.fixes ?? [], effort: decision?.effort ?? null, floor, gauge: decision?.gauge ?? null, override: override?.effort ?? null, mode, mid, read: r.read ?? null, write: r.write ?? null, why: r.why ?? null });
    await routerLog($, { session, outcome: r.outcome, ms: r.ms, skills: skills.map((s) => s.name), fixes: r.reply?.fixes.length ?? 0, effort: decision?.effort ?? "-", floor: floor ?? "-", past: r.past, input: r.input, output: r.output, read: r.read, write: r.write });
    return next(note ? { ...e, context: [...(e.context ?? []), note] } : e);
  });

  on("turn.start", async ($, e, next) => {
    // Since 2.1.299 subagents' and teammates' turns reach this hook too, with `agentId` (the
    // 2.1.296 types lack it); only the main loop's turns get a decision.
    if (!(e as { agentId?: string }).agentId) {
      mainTurn = e.turnId;
      typedTurn = nextTyped;
      nextTyped = true;
      if (typedTurn) ran = { steps: 0, tools: 0, level: null };
      if (pending) decisions.set(e.turnId, pending);
    }
    return next(e);
  });

  on("turn.step", async function* ($, e, next) {
    if (!isMain(e)) return yield* next(e);
    const d = decisions.get(e.turnId);
    sessionEffort = e.effort;
    // Once the mod has written a level, every main step names one: a per-message level holds
    // until changed. Without a decision, or in steer mode, that is the session's own level.
    const reset = rewrote ? (e.effort as Effort) : undefined;
    const effort = mode === "rewrite" && d ? withFloor(d, floorOf(e.effort)).effort : reset;
    if (effort && effort !== e.effort) rewrote = true;
    const r = yield* next(effort ? { ...e, effort } : e);
    const u = r.usage;
    const now = await $.clock.now();
    const step: Step | null = u ? { input: u.input_tokens, read: u.cache_read_input_tokens, write: u.cache_creation_input_tokens, model: e.model, messages: e.messageCount, at: now, effort: effort ?? (e.effort as Effort) } : null;
    // Cache guard: step 0 of a prompt whose level changed, against the previous main step.
    if (step && last && e.index === 0 && step.effort !== last.effort && step.model === last.model && step.messages >= last.messages && now - last.at <= GAP_MS) {
      if (cacheBroke(last, step)) breaks++;
      else breaks = 0;
      if (breaks >= 2 && mode === "rewrite") {
        mode = "steer";
        await $.ui.toast("log-pose: the cache broke twice on an effort change; it now steers with words instead.");
      }
    }
    if (step) last = step;
    if (typedTurn) ran = { steps: ran.steps + 1, tools: ran.tools + r.toolUses.length, level: effort ?? (typeof e.effort === "string" ? e.effort : ran.level) };
    await record($, {
      ev: "step", turnId: e.turnId, index: e.index, effortIn: e.effort, effortOut: effort ?? null, stop: r.stopReason, tools: r.toolUses.length,
      advisor: (r.serverToolUses ?? []).filter((s) => s.name === "advisor").length, usage: u && { input: u.input_tokens, read: u.cache_read_input_tokens, write: u.cache_creation_input_tokens, output: u.output_tokens },
    });
    return r;
  });

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (!e.agentId) {
      if (mainTurn === e.turnId && typedTurn) lastTurn = { ...ran, aborted: e.isAborted, answer: e.answer ?? "" };
      decisions.delete(e.turnId);
      if (mainTurn === e.turnId) mainTurn = "";
    }
    await record($, { ev: "complete", turnId: e.turnId, agent: e.agentId ?? null, reason: e.reason, aborted: e.isAborted });
    await flush($);
    return r;
  });
};
