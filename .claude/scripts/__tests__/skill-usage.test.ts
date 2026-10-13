import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { knownSkills, loadSkillTurns, parseRouterAnswers, parseSkillTurns, renderSkills, skillsRow, summarizeSkills, windowStart, type SkillTurn } from "../skill-usage";

const human = (content: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({ type: "user", message: { role: "user", content }, ...extra });
const hint = (...skills: string[]) =>
  JSON.stringify({ type: "attachment", attachment: { type: "hook_success", hookEvent: "UserPromptSubmit", content: `<skill-activation-hint>\n${skills.map((s) => `Skill(${s}) — possibly relevant (matched "x y"); load it only if it applies.`).join("\n")}\n</skill-activation-hint>` } });
const call = (skill: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: "t", name: "Skill", input: { skill } }] }, ...extra });
const toolResult = JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t", content: "ok" }] } });

describe("skill-usage, parseSkillTurns", () => {
  it("attributes hints and Skill calls to the human prompt they follow", () => {
    const turns = parseSkillTurns([human("revisa el codigo"), hint("flow-review"), call("flow-review"), toolResult, human("otra cosa"), call("consult-model")]);
    expect(turns).toEqual([
      { named: [], hinted: ["flow-review"], called: ["flow-review"] },
      { named: [], hinted: [], called: ["consult-model"] },
    ]);
  });

  it("starts no turn for tool results, meta, compact summaries, sidechains or non-human origins", () => {
    const turns = parseSkillTurns([
      human("real prompt"),
      toolResult,
      human("meta", { isMeta: true }),
      human("summary", { isCompactSummary: true }),
      human("side", { isSidechain: true }),
      human("<task-notification>done</task-notification>", { origin: { kind: "task-notification" } }),
      human("This session is being continued from a previous conversation"),
      call("dev-workflow"),
    ]);
    expect(turns).toEqual([{ named: [], hinted: [], called: ["dev-workflow"] }]);
  });

  it("reads the text blocks of array content and keeps pasted content", () => {
    const turns = parseSkillTurns([
      human([{ type: "image", source: {} }, { type: "text", text: "mira esto /drillme-clarify" }]),
      human("<pasted_content id=1>log</pasted_content> explica", { origin: { kind: "human" } }),
    ]);
    expect(turns.map((t) => t.named)).toEqual([["drillme-clarify"], []]);
  });

  it("reads slash commands and ignores slashes glued to paths", () => {
    const [t] = parseSkillTurns([human("<command-name>/dev-workflow</command-name> mira src/flow y ./x/lessons-learned")]);
    expect(t.named).toEqual(["dev-workflow"]);
  });

  it("reads the router's async note and counts a routed skill the model then calls as followed, not autonomous", () => {
    const note = (skills: string[]) => JSON.stringify({ type: "attachment", attachment: { type: "async_hook_response", hookEvent: "UserPromptSubmit",
      response: { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: `<prompt-router re="x">\n${skills.map((n) => `- Skill(${n}) — why`).join("\n")}\n</prompt-router>` } } } });
    const turns = parseSkillTurns([human("arregla el bug del login"), note(["dev-workflow", "troubleshooting"]), call("dev-workflow")]);
    expect(turns).toEqual([{ named: [], hinted: [], routed: ["dev-workflow", "troubleshooting"], called: ["dev-workflow"] }]);
    const s = summarizeSkills(turns, new Set(["dev-workflow", "troubleshooting"]));
    expect(s).toMatchObject({ routed: 2, routedFollowed: 1, autonomous: 0 });
  });

  it("reads the prompt-router subagent's answer, in the foreground or as a background notification", () => {
    const launch = (id: string, type = "prompt-router") => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Agent", input: { subagent_type: type, prompt: "implementa el export" } }] } });
    const result = (id: string, text: string) => JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: [{ type: "text", text }] }] } });
    const answer = '{"fixes": [], "skills": [{"why": "implement", "name": "dev-workflow"}, {"why": "tests", "name": "changes-verify"}]}';
    const notification = (id: string) => JSON.stringify({ type: "user", message: { content: `<task-notification>\n<tool-use-id>${id}</tool-use-id>\n<status>completed</status>\n<result>${answer}</result>\n</task-notification>` } });
    const foreground = parseSkillTurns([human("implementa el export a csv"), launch("toolu_1"), result("toolu_1", answer), call("dev-workflow")]);
    expect(foreground).toEqual([{ named: [], hinted: [], routed: ["dev-workflow", "changes-verify"], called: ["dev-workflow"] }]);
    const background = parseSkillTurns([human("implementa el export a csv"), launch("toolu_2"), result("toolu_2", "Async agent launched successfully."), notification("toolu_2")]);
    expect(background[0].routed).toEqual(["dev-workflow", "changes-verify"]);
    const other = parseSkillTurns([human("busca el export"), launch("toolu_3", "Explore"), result("toolu_3", answer)]);
    expect(other[0].routed).toBeUndefined();
  });

  it("ignores Skill calls from sidechains and lines before the first prompt", () => {
    const turns = parseSkillTurns([call("early"), human("p"), call("sub", { isSidechain: true }), "not json"]);
    expect(turns).toEqual([{ named: [], hinted: [], called: [] }]);
  });
});

describe("skill-usage, summarizeSkills", () => {
  const known = new Set(["dev-workflow", "flow", "consult-model"]);
  const turn = (named: string[], hinted: string[], called: string[]): SkillTurn => ({ named, hinted, called });

  it("splits followed hints, autonomous calls and calls the user asked for", () => {
    const s = summarizeSkills([
      turn([], ["flow"], ["flow"]), // followed
      turn([], ["flow"], []), // ignored
      turn([], [], ["consult-model"]), // autonomous
      turn(["dev-workflow"], ["dev-workflow"], ["dev-workflow"]), // typed: neither followed nor autonomous
      turn(["clear"], [], []), // unknown slash command
    ], known);
    expect({ hints: s.hints, followed: s.followed, autonomous: s.autonomous, typed: s.typed, prompts: s.prompts }).toEqual({ hints: 3, followed: 1, autonomous: 1, typed: 1, prompts: 5 });
    const by = Object.fromEntries(s.bySkill.map((x) => [x.name, x]));
    expect(by.flow).toMatchObject({ hinted: 2, followed: 1, autonomous: 0, typed: 0 });
    expect(by["dev-workflow"]).toMatchObject({ hinted: 1, followed: 0, autonomous: 0, typed: 1 });
    expect(by.clear).toBeUndefined();
  });

  it("counts an unknown name as typed when the model then called it", () => {
    const s = summarizeSkills([turn(["plugin:x"], [], ["plugin:x"])], known);
    expect(s.bySkill).toEqual([{ name: "plugin:x", hinted: 0, followed: 0, routed: 0, routedFollowed: 0, yes: 0, no: 0, autonomous: 0, typed: 1 }]);
  });
});

describe("skill-usage, Router answers", () => {
  it("reads each candidate's sí or no and its reason, however the host names the skill", () => {
    expect(parseRouterAnswers("Leo la nota.\nRouter: deep-research sí (trae el método de fuentes); `Skill(natural-writing)` no (no es prosa para terceros); $flow si, plan largo; /x NO.")).toEqual([
      { name: "deep-research", yes: true, why: "trae el método de fuentes" },
      { name: "natural-writing", yes: false, why: "no es prosa para terceros" },
      { name: "flow", yes: true, why: "plan largo" },
      { name: "x", yes: false, why: "" },
    ]);
    expect(parseRouterAnswers("Sin línea de router; deep-research sí")).toEqual([]);
  });

  it("counts answers per routed candidate, keeps the reasons for a no, and ignores answers about skills not routed", () => {
    const say = (text: string) => JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text }] } });
    const note = JSON.stringify({ type: "attachment", attachment: { type: "async_hook_response", hookEvent: "UserPromptSubmit",
      response: { hookSpecificOutput: { additionalContext: '<prompt-router re="x">\n- Skill(a) — w\n- Skill(b) — w\n- Skill(c) — w\n</prompt-router>' } } } });
    const turns = parseSkillTurns([human("implementa el export de informes"), note, say("Router: a sí (cambia el plan); b no (solo coincide el tema); z no (no sugerida)"), call("a")]);
    expect(turns[0].answers).toHaveLength(3);
    const s = summarizeSkills(turns, new Set(["a", "b", "c"]));
    expect(s).toMatchObject({ routed: 3, routedFollowed: 1, yes: 1, no: 1, noReasons: ["b: solo coincide el tema"] });
    const out = renderSkills(s, 7);
    expect(out).toContain("answered sí 1 / no 1 / none 1");
    expect(out).toContain("| a | 0 | 0 | 1 | 1 | 0 | 1 | 0 | 0 |");
    expect(out).toContain("- b: solo coincide el tema");
    expect(skillsRow(s).detail).toContain("unanswered 1");
  });
});

describe("skill-usage, mid-turn messages", () => {
  it("a human message queued mid-turn is its own turn and owns the router note that follows it", () => {
    const queued = (text: string, kind = "human") =>
      JSON.stringify({ type: "attachment", attachment: { type: "queued_command", prompt: text, commandMode: kind === "human" ? "prompt" : kind, origin: { kind } } });
    const note = JSON.stringify({ type: "attachment", attachment: { type: "async_hook_response", response: { hookSpecificOutput: { additionalContext: '<prompt-router re="y">\n- Skill(a) — w\n</prompt-router>' } } } });
    const turns = parseSkillTurns([human("primera petición larga"), call("b"), queued("y además revisa esto otro"), note, queued("<task-notification>x</task-notification>", "task-notification")]);
    expect(turns).toHaveLength(2);
    expect(turns[0].routed).toBeUndefined();
    expect(turns[1].routed).toEqual(["a"]);
  });
});

describe("skill-usage, render and doctor row", () => {
  const known = new Set(["flow", "dev-workflow"]);
  const ignored = Array.from({ length: 10 }, () => ({ named: [], hinted: [], routed: ["flow"], called: [] }));

  it("warns once router candidates are frequent and mostly unanswered", () => {
    const row = skillsRow(summarizeSkills([...ignored, { named: ["dev-workflow"], hinted: [], called: [] }], known));
    expect(row.status).toBe("🟡");
    expect(row.detail).toContain("followed 0 (0 %), unanswered 10");
    expect(row.detail).toContain("named most: dev-workflow 1");
  });

  it("stays green below the sample size, or when most candidates get an answer, even a no", () => {
    expect(skillsRow(summarizeSkills(ignored.slice(0, 9), known)).status).toBe("🟢");
    const declined = ignored.map((t, i) => (i < 5 ? { ...t, answers: [{ name: "flow", yes: false, why: "solo el tema" }] } : t));
    expect(skillsRow(summarizeSkills(declined, known)).status).toBe("🟢");
    expect(skillsRow(summarizeSkills([], known))).toEqual({ status: "🟢", detail: "no prompts in the window" });
  });

  it("names the skills the user types most", () => {
    const out = renderSkills(summarizeSkills([{ named: ["dev-workflow"], hinted: [], called: [] }], known), 14);
    expect(out).toContain("| dev-workflow | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |");
    expect(out).toContain("Named most by the user: dev-workflow (1)");
  });
});

describe("skill-usage, IO", () => {
  it("skips eval sandboxes under a scratchpad and lists skills that have a SKILL.md", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-usage-"));
    mkdirSync(join(root, "scratchpad"));
    writeFileSync(join(root, "real.jsonl"), [human("a"), call("flow")].join("\n"));
    writeFileSync(join(root, "scratchpad", "eval.jsonl"), [human("b"), call("flow")].join("\n"));
    expect(loadSkillTurns([join(root, "real.jsonl"), join(root, "scratchpad", "eval.jsonl"), join(root, "missing.jsonl")])).toHaveLength(1);

    mkdirSync(join(root, "skills", "Flow"), { recursive: true });
    mkdirSync(join(root, "skills", "empty"));
    writeFileSync(join(root, "skills", "Flow", "SKILL.md"), "");
    expect([...knownSkills([join(root, "skills"), join(root, "nope")])]).toEqual(["flow"]);
  });

  it("windows by the prompt's timestamp, not the file's mtime", () => {
    const root = mkdtempSync(join(tmpdir(), "skill-usage-"));
    const now = Date.parse("2026-10-08T12:00:00Z");
    writeFileSync(join(root, "long.jsonl"), [
      human("old", { timestamp: "2026-09-20T10:00:00Z" }), hint("flow"),
      human("new", { timestamp: "2026-10-07T10:00:00Z" }), call("dev-workflow"),
      human("no timestamp"),
    ].join("\n"));
    const turns = loadSkillTurns([join(root, "long.jsonl")], windowStart(7, now));
    expect(turns.map((t) => [t.hinted, t.called])).toEqual([[[], ["dev-workflow"]], [[], []]]);
    expect(turns[0].at).toBe(Date.parse("2026-10-07T10:00:00Z"));
  });
});
