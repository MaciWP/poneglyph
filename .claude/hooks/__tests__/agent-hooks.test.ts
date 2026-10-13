import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUDGET_LINE } from "../lib/haiku-budget";
import { agentTask, bakedSkills, RETRY_REASON, routerTaskInput } from "../router/agent-hooks";
import { ignoreLearned } from "./learned-fixture";

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
    expect(run({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { subagent_type: "Explore", prompt: "x" } })).toBe("");
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
      return out ? JSON.parse(out).hookSpecificOutput.updatedInput.prompt as string : null;
    };
    expect(task({ subagent_type: "Explore", model: "haiku", prompt: "find x" })).toBe(`find x\n\n${BUDGET_LINE}`);
    expect(task({ subagent_type: "general-purpose", prompt: "find x" }, "haiku")).toBe(`find x\n\n${BUDGET_LINE}`);
    expect(task({ subagent_type: "Explore", model: "sonnet", prompt: "find x" }, "haiku")).toBeNull();
    expect(task({ subagent_type: "fork", prompt: "find x" }, "haiku")).toBeNull();
    // Explore and Plan ignore CLAUDE_CODE_SUBAGENT_MODEL and inherit the parent's model.
    expect(task({ subagent_type: "Explore", prompt: "find x" }, "haiku")).toBeNull();
    expect(task({ subagent_type: "Plan", prompt: "find x" }, "haiku")).toBeNull();
    expect(task({ subagent_type: "Explore", model: "haiku", prompt: `find x\n\n${BUDGET_LINE}` })).toBeNull();
    writeFileSync(agentFile, readFileSync(agentFile, "utf8").replace("name: prompt-router\n", "name: prompt-router\nmodel: haiku\n"));
    const routed = task({ subagent_type: "prompt-router", prompt: "implementa a" })!;
    expect(routed).toEndWith(`</prompt>\n\n${BUDGET_LINE}`);
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
