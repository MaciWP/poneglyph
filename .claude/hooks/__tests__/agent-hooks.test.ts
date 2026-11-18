import { describe, expect, test, setDefaultTimeout } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUDGET_LINE, SONNET_BUDGET_LINE } from "../lib/haiku-budget";
import { agentTask, bakedSkills, briefGaps, CRITIC_BRIEF, capFromEnv, criticSpawn, modelNudge, RETRY_REASON, routerTaskInput, subagentCap } from "../router/agent-hooks";
import { ignoreLearned } from "./learned-fixture";
import { SPAWN_TEST_TIMEOUT_MS } from "./spawn-timeout";

setDefaultTimeout(SPAWN_TEST_TIMEOUT_MS);

const HOOK = join(import.meta.dir, "..", "router", "agent-hooks.ts");
const memory = [{ at: 1, prompt: "revisa la pr de esta rama y deja comentarios", skills: ["pr-review", "gone"] }];

// A project with two skills, an empty config dir, and a Lead transcript where `b` is loaded.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "agent-hooks-"));
  const project = ignoreLearned(join(root, "project"));
  const config = join(root, "config");
  for (const name of ["a", "b"]) {
    mkdirSync(join(project, ".claude", "skills", name), { recursive: true });
    writeFileSync(join(project, ".claude", "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${name} does things\n---\n`);
  }
  mkdirSync(join(config, "agents"), { recursive: true });
  const agentFile = join(config, "agents", "prompt-router.md");
  writeFileSync(agentFile, "---\nname: prompt-router\n---\n\nRoute.\n\nGlossary (term: heard variants):\n- Term: heard\n\nCatalog (name: description):\n- a: a does things\n- plugin:x: x does things\n");
  const lead = join(root, "lead.jsonl");
  writeFileSync(lead, [
    { type: "user", message: { content: "implementa la parte b del plan" } },
    { type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "b" } }] } },
  ].map((o) => JSON.stringify(o)).join("\n") + "\n");
  const agent = join(root, "agent.jsonl");
  writeFileSync(agent, JSON.stringify({ type: "user", timestamp: "2026-10-09T06:26:38.903Z", message: { content: "<prompt>\nimplementa a\n</prompt>\n<past>\n- \"x\" → a\n</past>" } }) + "\n");
  // The default subagent model is pinned: the session running the suite may set it to haiku.
  const run = (payload: Record<string, unknown>, subagentModel = "inherit") => {
    const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ session_id: "sess-123456789", cwd: project, transcript_path: lead, ...payload }), env: { ...process.env, CLAUDE_CONFIG_DIR: config, CLAUDE_PROJECT_DIR: project, CLAUDE_CODE_SUBAGENT_MODEL: subagentModel }, encoding: "utf8" });
    return r.stdout;
  };
  const logFile = join(project, ".claude", "learned", "prompt-router.log");
  return { run, lead, agent, logFile, agentFile };
}

describe("router subagent hooks", () => {
  test("only the router agent's input is rewritten, with the skills the agent file lacks", () => {
    const catalog = [{ name: "a", description: "does a" }, { name: "b", description: "does b" }, { name: "pr-review", description: "reviews" }];
    expect(routerTaskInput({ subagent_type: "Explore", prompt: "find x" }, catalog, new Set(), [])).toBeNull();
    expect(routerTaskInput(undefined, catalog, new Set(), [])).toBeNull();
    const out = routerTaskInput({ subagent_type: "prompt-router", description: "route", prompt: "revisa la pr de esta rama" }, catalog, new Set(["a", "pr-review"]), memory)!;
    expect(out).toMatchObject({ subagent_type: "prompt-router", description: "route" });
    expect(out.prompt).toBe("More catalog skills for this project (name: description):\n- b: does b\n\n<prompt>\nrevisa la pr de esta rama\n</prompt>\n<past>\n- \"revisa la pr de esta rama y deja comentarios\" → pr-review\n</past>");
    const covered = routerTaskInput({ subagent_type: "prompt-router", prompt: "hola mundo" }, catalog, new Set(["a", "b", "pr-review"]), [])!;
    expect(covered.prompt).toBe("<prompt>\nhola mundo\n</prompt>");
  });

  test("a task already in <prompt> is not wrapped twice", () => {
    const out = routerTaskInput({ subagent_type: "prompt-router", prompt: "<prompt>\nhola mundo\n</prompt>" }, [], new Set(), [])!;
    expect(out.prompt).toBe("<prompt>\nhola mundo\n</prompt>");
  });

  test("the baked skill names are read from the agent file's catalog block only", () => {
    const { agentFile } = fixture();
    expect([...bakedSkills(agentFile)]).toEqual(["a", "plugin:x"]);
    expect(bakedSkills("/nonexistent").size).toBe(0);
  });

  test("the task and start time come from the agent's first user message", () => {
    const { agent } = fixture();
    expect(agentTask(agent)).toEqual({ text: "<prompt>\nimplementa a\n</prompt>\n<past>\n- \"x\" → a\n</past>", at: Date.parse("2026-10-09T06:26:38.903Z") });
    expect(agentTask(undefined)).toEqual({ text: "", at: null });
  });

  test("PreToolUse leaves other agents alone and gives the router only the skills its file lacks", () => {
    const { run } = fixture();
    expect(run({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { subagent_type: "Explore", model: "opus", prompt: "x" } })).toBe("");
    const out = JSON.parse(run({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { subagent_type: "prompt-router", description: "d", prompt: "implementa a" } }));
    expect(out.hookSpecificOutput.updatedInput).toMatchObject({ subagent_type: "prompt-router", description: "d" });
    const prompt = out.hookSpecificOutput.updatedInput.prompt;
    expect(prompt).toStartWith("More catalog skills for this project (name: description):\n- b: b does things\n\n<prompt>\nimplementa a\n</prompt>");
    expect(run({ hook_event_name: "SubagentStart", agent_id: "a2", agent_type: "prompt-router" })).toBe("");
  });

  test("PreToolUse appends the Haiku budget to any Agent task on Haiku, after the router's rewrite", () => {
    const { run, agentFile } = fixture();
    const task = (input: Record<string, unknown>, model?: string) => {
      const out = run({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: input }, model);
      return out ? (JSON.parse(out).hookSpecificOutput.updatedInput?.prompt as string | undefined) ?? null : null;
    };
    expect(task({ subagent_type: "Explore", model: "haiku", prompt: "find x" })).toBe(`find x\n\n${BUDGET_LINE}`);
    expect(task({ subagent_type: "general-purpose", prompt: "find x" }, "haiku")).toBe(`find x\n\n${BUDGET_LINE}`);
    expect(task({ subagent_type: "Explore", model: "sonnet", prompt: "find x" }, "haiku")).toBe(`find x\n\n${SONNET_BUDGET_LINE}`);
    expect(task({ subagent_type: "Explore", model: "sonnet", prompt: `find x\n\n${SONNET_BUDGET_LINE}` })).toBeNull();
    expect(task({ subagent_type: "Explore", model: "opus", prompt: "find x" })).toBeNull();
    expect(task({ subagent_type: "fork", prompt: "find x" }, "haiku")).toBeNull();
    // Explore and Plan ignore CLAUDE_CODE_SUBAGENT_MODEL and inherit the parent's model.
    expect(task({ subagent_type: "Explore", prompt: "find x" }, "haiku")).toBeNull();
    expect(task({ subagent_type: "Plan", prompt: "find x" }, "haiku")).toBeNull();
    expect(task({ subagent_type: "Explore", model: "haiku", prompt: `find x\n\n${BUDGET_LINE}` })).toBeNull();
    writeFileSync(agentFile, readFileSync(agentFile, "utf8").replace("name: prompt-router\n", "name: prompt-router\nmodel: haiku\n"));
    const routed = task({ subagent_type: "prompt-router", prompt: "implementa a" })!;
    expect(routed).toEndWith(`</prompt>\n\n${BUDGET_LINE}`);
  });

  test("a spawn that inherits the Lead's model because nothing named one gets a note, never a block", () => {
    const { run, agentFile } = fixture();
    const cwd = "/nonexistent";
    expect(modelNudge({ subagent_type: "Explore", prompt: "x" }, cwd, "haiku")).toContain("named no model");
    expect(modelNudge({ subagent_type: "Plan", prompt: "x" }, cwd, "haiku")).toContain("Plan Agent call");
    expect(modelNudge({ prompt: "x" }, cwd, "inherit")).toContain("general-purpose Agent call");
    expect(modelNudge({ prompt: "x" }, cwd, "")).toContain("named no model");
    // Named on the call, by the env for a non-Explore agent, or a fork: nothing to say.
    expect(modelNudge({ subagent_type: "Explore", model: "haiku", prompt: "x" }, cwd, "haiku")).toBeNull();
    expect(modelNudge({ subagent_type: "Explore", model: "inherit", prompt: "x" }, cwd, "haiku")).toBeNull();
    expect(modelNudge({ subagent_type: "general-purpose", prompt: "x" }, cwd, "haiku")).toBeNull();
    expect(modelNudge({ subagent_type: "fork", prompt: "x" }, cwd, "")).toBeNull();
    // Through the hook: a note alone carries no permission decision and no rewrite.
    const alone = JSON.parse(run({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { subagent_type: "Explore", prompt: "x" } }, "haiku")).hookSpecificOutput;
    expect(alone).toEqual({ hookEventName: "PreToolUse", additionalContext: modelNudge({ subagent_type: "Explore", prompt: "x" }, cwd, "haiku") });
    // The router's rewrite and the note share one output.
    const both = JSON.parse(run({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { subagent_type: "prompt-router", prompt: "implementa a" } })).hookSpecificOutput;
    expect(both.updatedInput.prompt).toContain("<prompt>\nimplementa a\n</prompt>");
    expect(both.additionalContext).toContain("prompt-router Agent call");
    // The agent file's own model counts as named.
    writeFileSync(agentFile, readFileSync(agentFile, "utf8").replace("name: prompt-router\n", "name: prompt-router\nmodel: haiku\n"));
    expect(JSON.parse(run({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { subagent_type: "prompt-router", prompt: "implementa a" } })).hookSpecificOutput.additionalContext).toBeUndefined();
  });

  test("SubagentStop sends an unreadable answer back once, then logs", () => {
    const { run, agent, logFile } = fixture();
    const stop = { hook_event_name: "SubagentStop", agent_type: "prompt-router", agent_transcript_path: agent, last_assistant_message: "I think you need a." };
    expect(JSON.parse(run(stop))).toEqual({ decision: "block", reason: RETRY_REASON });
    expect(existsSync(logFile)).toBe(false);
    expect(run({ ...stop, stop_hook_active: true })).toBe("");
    expect(readFileSync(logFile, "utf8")).toMatch(/host=claude via=agent session=sess-123 outcome=bad-output ms=\d+ skills=- fixes=0 effort=- past=1\n$/);
  });

  test("SubagentStop logs a valid answer and drops loaded or unknown skills", () => {
    const { run, agent, logFile } = fixture();
    const answer = '```json\n{"fixes": [], "skills": [{"why": "implement a", "name": "a"}, {"why": "x", "name": "b"}, {"why": "y", "name": "zz"}]}\n```';
    expect(run({ hook_event_name: "SubagentStop", agent_type: "prompt-router", agent_transcript_path: agent, last_assistant_message: answer })).toBe("");
    expect(readFileSync(logFile, "utf8")).toMatch(/via=agent session=sess-123 outcome=ok ms=\d+ skills=a fixes=0 effort=- past=1\n$/);
  });
});

describe("criticSpawn", () => {
  const brief = "MODE: feature\nGOAL: x\nARTEFACT: src/a.ts";
  test("drops model and effort from a critic call and says so", () => {
    const { input, note } = criticSpawn({ subagent_type: "critic", prompt: brief, model: "haiku", effort: "low", description: "d" });
    expect(input).toEqual({ subagent_type: "critic", prompt: brief, description: "d" });
    expect(note).toContain("dropped");
  });
  test("leaves a complete critic call alone when the session has no prompt to append", () => {
    expect(criticSpawn({ subagent_type: "critic", prompt: brief })).toEqual({ input: null, note: null });
    expect(criticSpawn({ subagent_type: "critic", prompt: CRITIC_BRIEF.map((b) => `${b}: ${b === "MODE" ? "plan" : "x"}`).join("\n") }, "/nonexistent.jsonl")).toEqual({ input: null, note: null });
  });
  test("names what the three required blocks lack", () => {
    expect(briefGaps(brief)).toEqual([]);
    expect(briefGaps("MODE: doubt (second round)\nGOAL (verbatim):\n«x»\nARTEFACT (working tree): a.ts")).toEqual([]);
    expect(briefGaps("Review this change, focus on the tests.")).toHaveLength(3);
    expect(briefGaps("MODE: plan\nGOAL: x")).toEqual(["`ARTEFACT:` with content"]);
    expect(briefGaps("MODE: plan\nGOAL:\nARTEFACT: a.ts")).toEqual(["`GOAL:` with content"]);
    expect(briefGaps("MODE: plan\nGOAL:\nDOD tests pass: the user's words\nARTEFACT: a.ts")).toEqual([]);
    expect(briefGaps("MODE: plan\nGOAL:\nDOD (agreed): x\nARTEFACT: a.ts")).toEqual(["`GOAL:` with content"]);
    expect(briefGaps("MODE: feature\nGOAL: x\nARTEFACT:\nPRIOR: feature-1a2b3c4 H1")).toEqual(["`ARTEFACT:` with content"]);
    expect(briefGaps("MODE: finished feature review\nGOAL: x\nARTEFACT: a.ts")[0]).toContain("`MODE:`");
    expect(briefGaps("MODE: feature-ish\nGOAL: x\nARTEFACT: a.ts")[0]).toContain("`MODE:`");
    expect(briefGaps("MODE-extra: plan\nGOAL: x\nARTEFACT: a.ts")[0]).toContain("`MODE:`");
  });
  test("denies a brief with a gap, and the deny wins over the model strip", () => {
    const { input, note, deny } = criticSpawn({ subagent_type: "critic", prompt: "MODE: plan\nGOAL: x", model: "haiku" });
    expect(deny).toContain("`ARTEFACT:` with content");
    expect({ input, note }).toEqual({ input: null, note: null });
  });
  test("appends the first user entry and the last four, each cut, and skips what no person typed", () => {
    const { lead } = fixture();
    const user = (content: string, extra: object = {}) => JSON.stringify({ type: "user", message: { role: "user", content }, ...extra });
    const ask = (id: string, answers: object, prefilled = false) => [
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "AskUserQuestion", input: prefilled ? { answers } : {} }] } }),
      JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: "answered" }] }, toolUseResult: { answers } }),
    ];
    writeFileSync(lead, [
      user("<command-message>dev-workflow</command-message>\n<command-name>/dev-workflow</command-name>\n<command-args>primero</command-args>"),
      ...ask("q0", { "¿Sigo?": "nunca llegó al usuario" }, true), ...ask("q1", { "¿Qué hago?": "reenfoca" }), user("x".repeat(1600)),
      user("The courier plugin sent a message", { origin: { kind: "plugin", name: "courier" } }),
      user("<task-notification>\n<tool-use-id>t1</tool-use-id>\n</task-notification>"),
      user("resumen", { isCompactSummary: true }),
      JSON.stringify({ type: "attachment", attachment: { type: "queued_command", commandMode: "prompt", prompt: "a mitad de turno" } }),
      user("p5"), user("último"),
    ].join("\n"));
    const added = String(criticSpawn({ subagent_type: "critic", prompt: brief }, lead).input?.prompt).slice(brief.length);
    expect(added).toStartWith("\n\nUSER-PROMPTS (appended by the harness");
    expect(added.match(/^\[\d of 6\]/gm)).toEqual(["[1 of 6]", "[3 of 6]", "[4 of 6]", "[5 of 6]", "[6 of 6]"]);
    expect(added).toContain("[1 of 6] /dev-workflow primero\n");
    expect(added).toContain(`[3 of 6] ${"x".repeat(1500)} [cut]\n[4 of 6] a mitad de turno`);
    expect(added).not.toMatch(/reenfoca|nunca llegó|courier|task-notification|resumen/);
    const noted = JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "q2", content: "answered" }] }, toolUseResult: { answers: { "¿Umbral?": "400 €" }, annotations: { "¿Umbral?": { notes: "pero no lo descartes" } } } });
    writeFileSync(lead, [user("primero"), ...ask("q1", { "¿Qué hago?": "reenfoca" }), noted].join("\n"));
    expect(criticSpawn({ subagent_type: "critic", prompt: brief }, lead).input?.prompt).toEndWith("[1 of 3] primero\n[2 of 3] answer to «¿Qué hago?»: reenfoca\n[3 of 3] answer to «¿Umbral?»: 400 € (note: pero no lo descartes)");
  });
  test("the hook denies a free-form critic brief and appends the prompts to a valid one", () => {
    const { run } = fixture();
    const call = (prompt: string) => JSON.parse(run({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { subagent_type: "critic", prompt, model: "haiku" } })).hookSpecificOutput;
    expect(call("Review my change")).toMatchObject({ permissionDecision: "deny", permissionDecisionReason: expect.stringContaining("`MODE:`") });
    expect(call("Review my change").updatedInput).toBeUndefined();
    const ok = call(brief);
    expect(ok.permissionDecision).toBe("allow");
    expect(ok.updatedInput).toEqual({ subagent_type: "critic", prompt: `${brief}\n\nUSER-PROMPTS (appended by the harness from the session transcript, not by the author):\n[1 of 1] implementa la parte b del plan` });
  });
  test("ignores other agents, and the model nudge skips the critic", () => {
    expect(criticSpawn({ subagent_type: "Explore", prompt: "x", model: "haiku" })).toEqual({ input: null, note: null });
    expect(modelNudge({ subagent_type: "critic", prompt: "x" }, "/nonexistent")).toBeNull();
  });
});

describe("subagentCap", () => {
  const J = (o: unknown) => JSON.stringify(o);
  const spawn = (id: string, type = "Explore") => J({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Agent", input: { subagent_type: type, prompt: "x" } }] } });
  const denied = (id: string) => J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: true, content: "PreToolUse:Agent hook error: This session may start 3 subagents" }] } });
  const setup = (lines: string[]) => {
    const root = mkdtempSync(join(tmpdir(), "subagent-cap-"));
    const transcript = join(root, "t.jsonl");
    writeFileSync(transcript, lines.join("\n") + "\n");
    return { transcript, dir: join(root, "state") };
  };
  const explore = { subagent_type: "Explore", prompt: "x" };

  test("parallel calls none of which reached the transcript: the fourth is denied", () => {
    const { transcript, dir } = setup([J({ type: "user", message: { content: "do it" } })]);
    for (const id of ["a", "b", "c"]) expect(subagentCap(explore, 3, "s1", transcript, id, dir)).toBeNull();
    expect(subagentCap(explore, 3, "s1", transcript, "d", dir)).toContain("may start 3 subagents per turn");
    // The same call asked again is not counted twice.
    expect(subagentCap(explore, 3, "s1", transcript, "c", dir)).toBeNull();
  });

  test("a room message opens a new turn", () => {
    const lines = [J({ type: "user", message: { content: "do it" } }), spawn("a"), spawn("b"), spawn("c")];
    const { transcript, dir } = setup(lines);
    expect(subagentCap(explore, 3, "s1", transcript, "d", dir)).not.toBeNull();
    writeFileSync(transcript, [...lines, J({ type: "user", message: { content: "<room>@ia go</room>" }, origin: { kind: "peer" } })].join("\n") + "\n");
    expect(subagentCap(explore, 3, "s1", transcript, "d", dir)).toBeNull();
  });

  test("a spawn a hook denied, the critic and the router are not counted", () => {
    const { transcript, dir } = setup([J({ type: "user", message: { content: "do it" } }), spawn("a"), spawn("b"), spawn("x"), denied("x"), spawn("k", "critic"), spawn("r", "prompt-router")]);
    expect(subagentCap(explore, 3, "s1", transcript, "c", dir)).toBeNull();
    expect(subagentCap(explore, 3, "s1", transcript, "d", dir)).not.toBeNull();
    expect(subagentCap({ subagent_type: "critic" }, 3, "s1", transcript, "e", dir)).toBeNull();
  });

  test("a spawn the cap allowed and a later hook denied stops counting", () => {
    const lines = [J({ type: "user", message: { content: "do it" } })];
    const { transcript, dir } = setup(lines);
    for (const id of ["a", "b", "c"]) expect(subagentCap(explore, 3, "s1", transcript, id, dir)).toBeNull();
    writeFileSync(transcript, [...lines, spawn("c"), denied("c")].join("\n") + "\n");
    expect(subagentCap(explore, 3, "s1", transcript, "d", dir)).toBeNull();
  });

  test("a session's first spawn removes cap files untouched for a day", () => {
    const { transcript, dir } = setup([J({ type: "user", message: { content: "do it" } })]);
    mkdirSync(dir, { recursive: true });
    const stale = join(dir, "old.json");
    const fresh = join(dir, "recent.json");
    for (const f of [stale, fresh]) writeFileSync(f, "{}");
    const twoDaysAgo = (Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000;
    utimesSync(stale, twoDaysAgo, twoDaysAgo);
    expect(subagentCap(explore, 3, "s1", transcript, "a", dir)).toBeNull();
    expect([existsSync(stale), existsSync(fresh)]).toEqual([false, true]);
  });

  test("capFromEnv takes a positive integer only", () => {
    expect([capFromEnv("3"), capFromEnv(undefined), capFromEnv(""), capFromEnv("0"), capFromEnv("2.5"), capFromEnv("x")]).toEqual([3, null, null, null, null, null]);
  });

  test("the hook denies past the cap only when PONEGLYPH_SUBAGENT_CAP is set", () => {
    const { transcript, dir } = setup([J({ type: "user", message: { content: "do it" } }), spawn("a"), spawn("b")]);
    const session = `cap-${Date.now()}`;
    const run = (cap: string | undefined) => spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_use_id: "z", session_id: session, transcript_path: transcript, tool_input: { ...explore, model: "haiku" } }),
      // The cap file goes under the test's own temp root, not the machine's.
      env: { ...process.env, TMPDIR: dir, PONEGLYPH_SUBAGENT_CAP: cap ?? "" }, encoding: "utf8",
    }).stdout;
    expect(run(undefined)).not.toContain("deny");
    expect(JSON.parse(run("2")).hookSpecificOutput).toMatchObject({ permissionDecision: "deny" });
  });
});
