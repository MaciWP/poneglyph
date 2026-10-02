import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { knownSkills, loadSkillTurns, parseSkillTurns, renderSkills, skillsRow, summarizeSkills, type SkillTurn } from "../skill-usage";

const human = (content: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({ type: "user", message: { role: "user", content }, ...extra });
const hint = (...skills: string[]) =>
  JSON.stringify({ type: "attachment", attachment: { type: "hook_success", hookEvent: "UserPromptSubmit", content: `<skill-activation-hint>\n${skills.map((s) => `Skill(${s}) — possibly relevant (matched "x y"); load it only if it applies.`).join("\n")}\n</skill-activation-hint>` } });
const call = (skill: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: "t", name: "Skill", input: { skill } }] }, ...extra });
const toolResult = JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t", content: "ok" }] } });

describe("skill-usage — parseSkillTurns", () => {
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

  it("ignores Skill calls from sidechains and lines before the first prompt", () => {
    const turns = parseSkillTurns([call("early"), human("p"), call("sub", { isSidechain: true }), "not json"]);
    expect(turns).toEqual([{ named: [], hinted: [], called: [] }]);
  });
});

describe("skill-usage — summarizeSkills", () => {
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
    expect(s.bySkill).toEqual([{ name: "plugin:x", hinted: 0, followed: 0, autonomous: 0, typed: 1 }]);
  });
});

describe("skill-usage — render and doctor row", () => {
  const known = new Set(["flow", "dev-workflow"]);
  const ignored = Array.from({ length: 10 }, () => ({ named: [], hinted: ["flow"], called: [] }));

  it("warns once hints are frequent and mostly ignored", () => {
    const row = skillsRow(summarizeSkills([...ignored, { named: ["dev-workflow"], hinted: [], called: [] }], known));
    expect(row.status).toBe("🟡");
    expect(row.detail).toContain("followed 0 (0 %)");
    expect(row.detail).toContain("named most: dev-workflow 1");
  });

  it("stays green below the sample size or with a healthy follow rate", () => {
    expect(skillsRow(summarizeSkills(ignored.slice(0, 9), known)).status).toBe("🟢");
    const followed = ignored.map((t, i) => (i < 3 ? { ...t, called: ["flow"] } : t));
    expect(skillsRow(summarizeSkills(followed, known)).status).toBe("🟢");
    expect(skillsRow(summarizeSkills([], known))).toEqual({ status: "🟢", detail: "no prompts in the window" });
  });

  it("names the skills the user types most", () => {
    const out = renderSkills(summarizeSkills([{ named: ["dev-workflow"], hinted: [], called: [] }], known), 14);
    expect(out).toContain("| dev-workflow | 0 | 0 | 0 | 1 |");
    expect(out).toContain("Named most by the user: dev-workflow (1)");
  });
});

describe("skill-usage — IO", () => {
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
});
