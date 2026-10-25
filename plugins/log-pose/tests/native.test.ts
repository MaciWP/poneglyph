import { type Engine, expect, mock, test } from "claude-code/testing";
import type { On } from "claude-code";

const start = { cwd: "/work/project", surface: "terminal" as const, isInteractive: true };
const OPUS = "claude-opus-5-5";
const AGENT = "---\nname: prompt-router\n---\nRouter body.\n\nGlossary (term: heard variants):\n(none)\n\nCatalog (name: description):\n- dev-workflow: Loop.\n- pr-review: Reviews.\n- prompt-design: Briefs.\n";
const HARD = JSON.stringify({ fixes: [], process: { "dev-workflow": "build the mod" }, skills: [{ why: "review", name: "pr-review" }], difficulty: "hard", uncertainty: "some-doubt", continuity: "new" });
const EASY_SAME = JSON.stringify({ fixes: [], process: {}, skills: [], difficulty: "easy", uncertainty: "clear", continuity: "same" });
const PROMPT = "revisa la PR de esta rama y monta el mod nuevo";

// `after`: how long the call takes on the test's clock, in ms.
type Reply = string | { isAnswered: false; reason: "aborted" | "api-error"; status?: number; error?: string; after?: number };

function world(on: On, replies: Reply[] = [HARD], shell = true, settings: Record<string, unknown> = {}) {
  let now = Date.parse("2026-10-15T10:00:00Z");
  on("clock.now", () => ({ value: now }));
  mock.env(on, { HOME: "/home/me" });
  const writes = new Map<string, string>();
  const asks: { system?: unknown; prompt: unknown; model: string }[] = [];
  const efforts: unknown[] = [];
  const contexts: (readonly string[] | undefined)[] = [];
  const toasts: unknown[] = [];
  const id = { value: "s1" };
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("session.end", (_, e) => ({ sessionId: e.sessionId }));
  on("session.id", () => ({ value: id.value }));
  on("settings.read", () => ({ value: settings }));
  on("ui.toast", (_, e) => {
    toasts.push(e);
    return { value: undefined };
  });
  on("fs.read", (_, e) => (e.path.endsWith("agents/prompt-router.md") ? { value: AGENT } : writes.has(e.path) ? { value: writes.get(e.path)! } : { deny: "ENOENT" }) as never);
  on("fs.exists", (_, e) => ({ value: e.path === "/work/project/.claude/learned" || writes.has(e.path) }));
  on("fs.list", () => ({ value: [] }));
  on("fs.write", (_, e) => {
    writes.set(e.path, e.text);
    return { value: undefined };
  });
  // git says learned/ is ignored; `sh -c 'cat >> "$1"'` appends its stdin to the last argument.
  on("process.run", (_, e) => {
    if (!shell) return { deny: "no shell" } as never;
    if (e.argv[0] === "sh" || e.argv[0] === "/bin/sh") writes.set(e.argv.at(-1)!, (writes.get(e.argv.at(-1)!) ?? "") + (e.init?.stdin ?? ""));
    return { value: { exitCode: 0, stdout: "", stderr: "", isStdoutTruncated: false, isStderrTruncated: false } } as never;
  });
  on("model.complete", (_, e) => {
    asks.push(e);
    const r = replies[Math.min(asks.length - 1, replies.length - 1)]!;
    if (typeof r !== "string") now += r.after ?? 0;
    return { value: typeof r === "string" ? { isAnswered: true, text: r, usage: { input_tokens: 40, output_tokens: 110, cache_read_input_tokens: 8900, cache_creation_input_tokens: 0 } } : r } as never;
  });
  on("prompt.submit", (_, e) => {
    contexts.push(e.context);
    return { text: e.text };
  });
  on("turn.start", (_, e) => ({ turnId: e.turnId }));
  on("turn.step", async function* (_, e) {
    efforts.push(e.effort);
    return { turnId: e.turnId, index: e.index, answer: "", toolUses: [], stopReason: "end_turn" as const, usage: null };
  });
  on("turn.complete", (_, e) => ({ text: "" }) as never);
  return { writes, asks, efforts, contexts, toasts, id };
}

async function step($: Engine, input: object) {
  const s = $.turn.step({ turnId: "t1", index: 0, model: OPUS, effort: "medium", messageCount: 4, ...input } as never);
  for await (const _ of s);
  return s.result;
}

async function prompt($: Engine, text: string, turnId: string, kind = "composer") {
  await $.prompt.submit({ text, origin: { kind } } as never);
  await $.turn.start({ turnId, text } as never);
}

const LOG = "/work/project/.claude/learned/prompt-router.log";
const rows = (w: { writes: Map<string, string> }, sid = "s1") => (w.writes.get(`/home/me/.cache/poneglyph/log-pose/${sid}.jsonl`) ?? "").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
const complete = ($: Engine, turnId: string) => $.turn.complete({ turnId, reason: "end_turn", isAborted: false, answer: "" } as never);

test("one call before step 0 gives the note, and every main Opus step runs at its effort", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  expect(w.asks).toHaveLength(1);
  expect(w.asks[0]?.model).toBe("sonnet");
  const note = w.contexts.at(-1)?.at(-1) ?? "";
  expect(note).toContain("- Skill(pr-review): review");
  expect(note).toContain("- Skill(dev-workflow): build the mod");
  expect(note).toContain("Effort: high for this prompt (hard, some doubt). Advisor gauge 3");
  await step($, {});
  await step($, { index: 1 });
  await step($, { agentId: "a1" });
  await step($, { model: "claude-sonnet-5-5" });
  await step($, { effort: 3 });
  expect(w.efforts).toEqual(["high", "high", "medium", "medium", 3]);
  expect(w.writes.get(LOG)).toMatch(/host=claude via=mod session=s1 outcome=ok ms=\d+ skills=pr-review,dev-workflow fixes=0 effort=high floor=- past=0 .* read=8900 write=0 in=8940 out=110 sid=s1\n$/);
});

test("the user's /effort is a floor, and a max floor stays max", async ($, on) => {
  const w = world(on, [JSON.stringify({ skills: [], difficulty: "easy", uncertainty: "clear", continuity: "new" })]);
  await $.session.start(start);
  await prompt($, "qué hace esta función de aquí exactamente", "t1");
  await step($, {});
  await step($, { effort: "high", index: 1 });
  await step($, { effort: "max", index: 2 });
  expect(w.efforts).toEqual(["low", "high", "max"]);
});

test("continuations, short prompts and other origins reuse the decision without a call", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  await prompt($, "sigue", "t2");
  await prompt($, "from claude -p, a long enough prompt here", "t3", "sdk");
  expect(w.asks).toHaveLength(1);
  await step($, { turnId: "t2" });
  await step($, { turnId: "t3" });
  expect(w.efforts).toEqual(["high", "high"]);
});

test("a failed call adds no skills and keeps the previous effort", async ($, on) => {
  const w = world(on, [HARD, { isAnswered: false, reason: "aborted" }]);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  await prompt($, "ahora otra tarea distinta que no tiene nada que ver", "t2");
  const note = w.contexts.at(-1)?.at(-1) ?? "";
  expect(note).not.toContain("Skill(");
  expect(note).toContain("Effort: high");
  await step($, { turnId: "t2" });
  expect(w.efforts).toEqual(["high"]);
  expect(w.writes.get(LOG)).toContain("outcome=superseded");
  expect(rows(w).at(-1)).toMatchObject({ outcome: "superseded", why: "aborted" });
});

test("an aborted call that ran to the time limit is a timeout, and an API error keeps its status", async ($, on) => {
  const w = world(on, [{ isAnswered: false, reason: "aborted", after: 60_000 }, { isAnswered: false, reason: "api-error", status: 529, error: "overloaded" }]);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  await prompt($, "ahora otra tarea distinta que no tiene nada que ver", "t2");
  expect(rows(w).filter((r) => r.ev === "submit").map((r) => [r.outcome, r.why])).toEqual([["timeout", "aborted"], ["error", "api-error 529 overloaded"]]);
});

test("a call that a newer prompt overtook still gets its row and log line, as superseded", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await Promise.all([$.prompt.submit({ text: PROMPT, origin: { kind: "composer" } } as never), $.prompt.submit({ text: "ahora otra tarea distinta que no tiene nada que ver", origin: { kind: "composer" } } as never)]);
  expect(w.asks).toHaveLength(2);
  expect(rows(w).filter((r) => r.ev === "submit").map((r) => r.outcome).sort()).toEqual(["ok", "superseded"]);
  expect(w.writes.get(LOG)).toContain("outcome=superseded");
});

test("Opus's override applies from the next step of the running turn and auto hands back the prompt's own level", async ($, on) => {
  const w = world(on, [HARD, EASY_SAME, EASY_SAME]);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  await step($, { turnId: "t1" });
  const set = await $.tool.call({ tool: "mcp__log-pose__set", effort: "xhigh", reason: "race condition" } as never);
  expect(set).toMatchObject({ result: "Applies from the next step." });
  await step($, { turnId: "t1", index: 1 });
  await complete($, "t1");
  await prompt($, "ahora aplica el cambio en el fichero de config", "t2");
  expect(w.contexts.at(-1)?.at(-1)).toContain("(your override: race condition)");
  await $.tool.call({ tool: "mcp__log-pose__set", effort: "auto", reason: "done" } as never);
  await step($, { turnId: "t2" });
  await complete($, "t2");
  await prompt($, "y ahora aplica el mismo cambio en el otro", "t3");
  await step($, { turnId: "t3" });
  // auto mid-turn takes t2 back to its own labels' level; t3 too: its labels already weighed the last turn.
  expect(w.efforts).toEqual(["high", "xhigh", "low", "low"]);
  expect(await $.tool.call({ tool: "mcp__log-pose__set", effort: "max", reason: "x" } as never)).toMatchObject({ isError: true });
});

test("Opus's override holds on a continuation and after a failed call", async ($, on) => {
  const w = world(on, [EASY_SAME, { isAnswered: false, reason: "aborted" }]);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  await $.tool.call({ tool: "mcp__log-pose__set", effort: "xhigh", reason: "race condition" } as never);
  await prompt($, "sigue", "t2");
  await prompt($, "ahora otra tarea distinta que no tiene nada que ver", "t3");
  await step($, { turnId: "t2" });
  await step($, { turnId: "t3" });
  expect(w.efforts).toEqual(["xhigh", "xhigh"]);
});

test("the note names the level the steps run at, with the user's floor", async ($, on) => {
  const easy = JSON.stringify({ skills: [], difficulty: "easy", uncertainty: "clear", continuity: "new" });
  const w = world(on, [easy, easy]);
  await $.session.start(start);
  await prompt($, "qué hace esta función de aquí exactamente", "t1");
  await step($, { effort: "high" });
  await prompt($, "y qué hace esta otra función de aquí", "t2");
  expect(w.contexts.at(-1)?.at(-1)).toContain("Effort: high for this prompt");
});

test("the router log is appended, never rewritten, so a line written meanwhile survives", async ($, on) => {
  const w = world(on, [HARD, HARD]);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  w.writes.set(LOG, `${w.writes.get(LOG)}other session line\n`);
  await prompt($, "ahora otra tarea distinta que no tiene nada que ver", "t2");
  expect(w.writes.get(LOG)!.split("\n").filter(Boolean)).toHaveLength(3);
});

test("without a shell the log goes where the hook's learnedLog puts it for a project that does not ignore learned/", async ($, on) => {
  const w = world(on, [HARD], false);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  expect(w.writes.get("/home/me/.claude/learned/-work-project/prompt-router.log")).toContain("outcome=ok");
});

test("a skill already loaded this session is not suggested again", async ($, on) => {
  const w = world(on, [HARD, HARD]);
  on("tool.call", { tool: "Skill" }, () => ({ result: "loaded" }) as never);
  await $.session.start(start);
  await $.tool.call({ tool: "Skill", skill: "pr-review" } as never);
  await prompt($, PROMPT, "t1");
  expect(w.contexts.at(-1)?.at(-1)).not.toContain("Skill(pr-review)");
  expect(w.contexts.at(-1)?.at(-1)).toContain("Skill(dev-workflow)");
});

test("a resumed session's loaded skills and a glossary term added since the sync are honoured", async ($, on) => {
  const w = world(on, [JSON.stringify({ fixes: [{ heard: "jaicu", meant: "Haiku" }], process: {}, skills: [{ why: "review", name: "pr-review" }, { why: "build", name: "dev-workflow" }], difficulty: "normal", uncertainty: "clear", continuity: "new" })]);
  on("session.messages", () => ({ value: [{ role: "assistant", text: "", toolUses: [{ tool_use_id: "u1", tool: "Skill", input: { skill: "pr-review" } }] }] }) as never);
  w.writes.set("/home/me/.claude/router-glossary.json", '{"Haiku": ["jaicu"]}');
  await $.session.start(start);
  await prompt($, "revisa la PR y monta el router con jaicu ya", "t1");
  const note = w.contexts.at(-1)?.at(-1) ?? "";
  expect(note).not.toContain("Skill(pr-review)");
  expect(note).toContain("Skill(dev-workflow)");
  expect(note).toContain("jaicu");
  expect(String(w.asks[0]?.prompt)).toContain("<extra-glossary>\nHaiku: jaicu\n</extra-glossary>");
});

test("a subagent's turn does not take the prompt's decision, and the session row names the prompt kind", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await $.prompt.submit({ text: PROMPT, origin: { kind: "composer" } } as never);
  await $.turn.start({ turnId: "sub1", text: "", agentId: "a1" } as never);
  await $.turn.start({ turnId: "t1", text: PROMPT } as never);
  await step($, { turnId: "sub1" });
  await step($, { turnId: "t1" });
  expect(w.efforts).toEqual(["medium", "high"]);
  await $.turn.complete({ turnId: "t1", reason: "end_turn", isAborted: false, answer: "" } as never);
  expect(w.writes.get("/home/me/.cache/poneglyph/log-pose/s1.jsonl")).toContain('"ev":"session"');
  expect(w.writes.get("/home/me/.cache/poneglyph/log-pose/s1.jsonl")).toContain('"prompt":"fallback"');
});

test("after /clear the mod logs under the new id and forgets the old conversation's skills, decision and override", async ($, on) => {
  const w = world(on, [HARD, EASY_SAME, HARD]);
  on("tool.call", { tool: "Skill" }, () => ({ result: "loaded" }) as never);
  await $.session.start(start);
  await $.tool.call({ tool: "Skill", skill: "pr-review" } as never);
  await prompt($, PROMPT, "t1");
  expect(w.contexts.at(-1)?.at(-1)).not.toContain("Skill(pr-review)");
  await $.tool.call({ tool: "mcp__log-pose__set", effort: "xhigh", reason: "race" } as never);
  await complete($, "t1");
  await $.session.end({ reason: "clear", sessionId: "s1", resume: {} } as never);
  w.id.value = "s2";
  await prompt($, "dime qué hace la función de arriba del todo", "t2");
  await step($, { turnId: "t2" });
  await complete($, "t2");
  // A follow-up of nothing: its own easy level, no override and no hard task carried over.
  expect(w.efforts).toEqual(["low"]);
  await prompt($, PROMPT, "t3");
  expect(w.contexts.at(-1)?.at(-1)).toContain("Skill(pr-review)");
  expect(w.writes.get(LOG)!.trim().split("\n").map((l) => l.split(" sid=")[1])).toEqual(["s1", "s2", "s2"]);
  expect(rows(w, "s1").map((r) => r.ev)).toEqual(["session", "submit", "override", "complete", "end"]);
  expect(rows(w, "s2")[0]).toMatchObject({ ev: "session", switched: true });
});

test("a prompt typed over a running turn keeps the turn's level, suggests no skills and still fixes dictation", async ($, on) => {
  const mid = JSON.stringify({ fixes: [{ heard: "jaicu", meant: "Haiku" }], process: {}, skills: [{ why: "x", name: "pr-review" }], difficulty: "easy", uncertainty: "clear", continuity: "same" });
  const w = world(on, [HARD, mid]);
  w.writes.set("/home/me/.claude/router-glossary.json", '{"Haiku": ["jaicu"]}');
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  await $.prompt.submit({ text: "y prueba también con jaicu en el otro lado", origin: { kind: "composer" }, turnId: "t1" } as never);
  const note = w.contexts.at(-1)?.at(-1) ?? "";
  expect(note).toContain('"jaicu" → Haiku');
  expect(note).not.toContain("Skill(");
  expect(note).not.toContain("Effort:");
  await step($, { turnId: "t1", index: 1 });
  // Queued behind the turn instead, it starts its own turn at the same level.
  await $.turn.start({ turnId: "t2", text: "" } as never);
  await step($, { turnId: "t2" });
  expect(w.efforts).toEqual(["high", "high"]);
  await complete($, "t2");
  expect(rows(w).filter((r) => r.ev === "submit").map((r) => r.fixes)).toEqual([[], [{ heard: "jaicu", meant: "Haiku" }]]);
});

test("a level in the settings is a floor from the first prompt: the note names both and one toast says so", async ($, on) => {
  const easy = JSON.stringify({ skills: [], difficulty: "easy", uncertainty: "clear", continuity: "new" });
  const w = world(on, [easy, easy], true, { effortLevel: "high", modelSettings: { [OPUS]: { effortLevel: "xhigh" } } });
  await $.session.start(start);
  await prompt($, "qué hace esta función de aquí exactamente", "t1");
  expect(w.contexts.at(-1)?.at(-1)).toContain("Effort: xhigh for this prompt (the session's own level, a floor over Log Pose's low: easy, clear).");
  await prompt($, "y qué hace esta otra función de aquí", "t2");
  expect(w.toasts).toHaveLength(1);
  expect(w.writes.get(LOG)).toContain(" effort=low floor=xhigh ");
});

test("a follow-up's call carries how the last main turn ran and ended; a subagent's steps do not count", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  expect(String(w.asks[0]?.prompt)).not.toContain("<last-turn>");
  await step($, { turnId: "t1" });
  await step($, { turnId: "t1", index: 1 });
  await step($, { turnId: "t1", agentId: "a1" });
  await $.turn.complete({ turnId: "t1", reason: "end_turn", isAborted: false, answer: "Listo: el fallo era la caché." } as never);
  await prompt($, "y ahora revisa que los tests sigan pasando bien", "t2");
  expect(String(w.asks[1]?.prompt)).toContain("<last-turn>Ran at high effort: 2 steps, 0 tool calls. Its answer ended: Listo: el fallo era la caché.</last-turn>");
});

test("a task notification's turn leaves the last typed turn for the next follow-up", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  await step($, { turnId: "t1" });
  await $.turn.complete({ turnId: "t1", reason: "end_turn", isAborted: false, answer: "Listo: el fallo era la caché." } as never);
  await prompt($, "a task notification with enough words in it", "t2", "notification");
  await step($, { turnId: "t2" });
  await step($, { turnId: "t2", index: 1 });
  await $.turn.complete({ turnId: "t2", reason: "end_turn", isAborted: false, answer: "El agente terminó." } as never);
  await prompt($, "y ahora revisa que los tests sigan pasando bien", "t3");
  expect(String(w.asks.at(-1)?.prompt)).toContain("<last-turn>Ran at high effort: 1 steps, 0 tool calls. Its answer ended: Listo: el fallo era la caché.</last-turn>");
});

test("a prompt's row reaches the disk before its turn ends, and steps do every 50", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  expect(rows(w).map((r) => r.ev)).toEqual(["session", "submit"]);
  for (let i = 0; i < 49; i++) await step($, { index: i });
  expect(rows(w)).toHaveLength(2);
  await step($, { index: 49 });
  expect(rows(w)).toHaveLength(52);
});

test("each skipped prompt names why, and another origin gets a row of its own", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await prompt($, "sigue", "t1");
  await prompt($, "/compact", "t2");
  await prompt($, "dos palabras", "t3");
  await prompt($, "a task notification with enough words in it", "t4", "notification");
  await complete($, "t4");
  expect(rows(w).filter((r) => r.ev !== "session" && r.ev !== "complete").map((r) => r.skip ?? r.ev)).toEqual(["continuation", "command", "short", "other"]);
});

test("the first agent launch without prompt-design is refused once with the hint; its repeat and a subagent's launch pass", async ($, on) => {
  const w = world(on);
  on("tool.call", { tool: "Agent" }, () => ({ result: "done" }) as never);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  expect(await $.tool.call({ tool: "Agent", prompt: "x", agentId: "a1" } as never)).toMatchObject({ result: "done" });
  expect(await $.tool.call({ tool: "Agent", subagent_type: "prompt-router", prompt: "x" } as never)).toMatchObject({ result: "done" });
  expect(await $.tool.call({ tool: "Agent", prompt: "x" } as never)).toMatchObject({ deny: "Log Pose: Skill(prompt-design) is not loaded; load it and brief the agent with it, then repeat this call; the repeat is not blocked." });
  expect(await $.tool.call({ tool: "Agent", prompt: "x" } as never)).toMatchObject({ result: "done" });
  await complete($, "t1");
  expect(rows(w).filter((r) => r.ev === "hint")).toMatchObject([{ skill: "prompt-design", tool: "Agent", blocked: true }]);
});

test("no hint once the session loaded the skill", async ($, on) => {
  world(on);
  on("tool.call", { tool: "Agent" }, () => ({ result: "done" }) as never);
  on("tool.call", { tool: "Skill" }, () => ({ result: "loaded" }) as never);
  await $.session.start(start);
  await prompt($, PROMPT, "t1");
  await $.tool.call({ tool: "Skill", skill: "prompt-design" } as never);
  expect(await $.tool.call({ tool: "Agent", prompt: "x" } as never)).toMatchObject({ result: "done" });
});
