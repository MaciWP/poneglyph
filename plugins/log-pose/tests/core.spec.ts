import { describe, expect, test } from "bun:test";
import {
  MATRIX, appendCapped, buildNote, cacheBroke, classifierPrompt, clipDescription, decide, effortNote, floorOf, isContinuation,
  extraGlossary, logLine, mergeGlossaries, parseAgentFile, parseMemory, parseReply, pastFor, phaseHint, routable, settingsEffort, skillFrontmatter, skillsInHistory, soundsLike,
} from "../hooks/core.ts";

const AGENT = `---
name: prompt-router
model: haiku
---
You read one prompt.

Glossary (term: heard variants):
Agentic OS: agentic os, isentic | Codex: codes

Catalog (name: description):
- dev-workflow: The development loop.
- pr-review: Reviews a PR.
- poneglyph-work:commit-message: Writes commits.
`;

const reply = (o: object) => `Here you go:\n\`\`\`json\n${JSON.stringify(o)}\n\`\`\``;
const LABELS = { difficulty: "hard", uncertainty: "some-doubt", continuity: "new" };

describe("decide", () => {
  test("difficulty sets the effort and uncertainty the gauge", () => {
    expect(decide({ difficulty: "easy", uncertainty: "clear", continuity: "new" }, null, null)).toMatchObject({ effort: "low", gauge: 0 });
    expect(decide({ difficulty: "hard", uncertainty: "unclear", continuity: "new" }, null, null)).toMatchObject({ effort: "high", gauge: 3 });
  });

  test("no cell gives xhigh: only a same-task follow-up of a turn that ran high or xhigh escalates", () => {
    for (const row of Object.values(MATRIX)) for (const cell of Object.values(row)) expect(cell.effort).not.toBe("xhigh");
    const hard = { difficulty: "hard", uncertainty: "unclear" } as const;
    expect(decide({ ...hard, continuity: "same" }, null, null, "high").effort).toBe("xhigh");
    expect(decide({ ...hard, continuity: "same" }, null, null, "xhigh").effort).toBe("xhigh");
    expect(decide({ ...hard, continuity: "same" }, null, null, "medium").effort).toBe("high");
    expect(decide({ ...hard, continuity: "new" }, null, null, "xhigh").effort).toBe("high");
    expect(decide({ difficulty: "hard", uncertainty: "some-doubt", continuity: "same" }, null, null, "xhigh").effort).not.toBe("xhigh");
  });

  test("an easy follow-up with some doubt drops to low; a new one stays medium", () => {
    expect(decide({ difficulty: "easy", uncertainty: "some-doubt", continuity: "same" }, null, null).effort).toBe("low");
    expect(decide({ difficulty: "easy", uncertainty: "some-doubt", continuity: "new" }, null, null).effort).toBe("medium");
  });

  test("the mod never goes past xhigh, but a max floor stays max", () => {
    for (const row of Object.values(MATRIX)) for (const cell of Object.values(row)) expect(cell.effort).not.toBe("max");
    expect(decide({ difficulty: "hard", uncertainty: "unclear", continuity: "new" }, null, "max").effort).toBe("max");
    expect(decide({ difficulty: "easy", uncertainty: "clear", continuity: "new" }, null, "high").effort).toBe("high");
  });

  test("an override holds on the same task and clears on a new one", () => {
    expect(decide({ difficulty: "easy", uncertainty: "clear", continuity: "same" }, "high", null)).toMatchObject({ effort: "high", override: "high" });
    expect(decide({ difficulty: "easy", uncertainty: "clear", continuity: "new" }, "high", null)).toMatchObject({ effort: "low", override: null });
  });

  test("the default medium is not a floor", () => {
    expect(floorOf("medium")).toBeNull();
    expect(floorOf("high")).toBe("high");
    expect(floorOf(3)).toBeNull();
  });

  test("a follow-up's level comes from its own labels, which the classifier gives with the last turn in view", () => {
    expect(decide({ difficulty: "easy", uncertainty: "clear", continuity: "same" }, null, null)).toMatchObject({ effort: "low", task: "low" });
    expect(decide({ difficulty: "hard", uncertainty: "unclear", continuity: "same" }, null, null)).toMatchObject({ effort: "high", task: "high" });
  });

  test("before a step names it, the session's level comes from the model's settings, then the global one", () => {
    expect(settingsEffort({ effortLevel: "high", modelSettings: { "claude-opus-5-5": { effortLevel: "xhigh" } } }, "claude-opus-5-5")).toBe("xhigh");
    expect(settingsEffort({ effortLevel: "high", modelSettings: { "claude-haiku-5-5": { effortLevel: "low" } } }, "claude-opus-5-5")).toBe("high");
    expect(settingsEffort({}, "claude-opus-5-5")).toBeNull();
  });
});

describe("prompts", () => {
  test("continuations and short prompts skip the call", () => {
    for (const t of ["sigue", "Continúa.", "ok", "dale!", "Sí", "go on"]) expect(isContinuation(t)).toBe(true);
    expect(isContinuation("sigue con el plan del mod")).toBe(false);
    expect(routable("arregla el typo")).toBeNull();
    expect(routable("/clear")).toBeNull();
    expect(routable("/goal revisa la PR de esta rama y deja comentarios")).toBe("revisa la PR de esta rama y deja comentarios");
  });

  test("the classifier prompt carries the previous request", () => {
    expect(classifierPrompt("x y", "", "", "")).toContain("<previous>(none)</previous>");
    expect(classifierPrompt("x y", "a".repeat(400), "<past>\n</past>", "")).toContain(`<previous>${"a".repeat(300)}</previous>`);
    const last = { level: "xhigh", steps: 152, tools: 140, aborted: false, answer: `${"b".repeat(400)} hecho, tests en verde.` };
    expect(classifierPrompt("x y", "", "", "", last)).not.toContain("<last-turn>");
    const block = classifierPrompt("x y", "arregla el login", "", "", last).split("\n\n").at(-1)!;
    expect(block).toStartWith("<last-turn>Ran at xhigh effort: 152 steps, 140 tool calls. Its answer ended: …");
    expect(block).toEndWith("hecho, tests en verde.</last-turn>");
    expect(block.length).toBeLessThan(420);
    expect(classifierPrompt("x y", "p", "", "", { ...last, level: null, aborted: true, answer: "" })).toContain("Ran at the session's effort: 152 steps, 140 tool calls, interrupted by the user. Its answer ended: (no text)");
  });
});

const SECTIONED = AGENT.replace("You read one prompt.\n", `You read one prompt.

Reply with one JSON object and nothing else. It has two lists, one set of answers and one effort answer.

fixes: misheard terms.
- Return [] when nothing was misheard.

process: four companions.

skills: catalog skills.

effort: deeper reasoning.

Examples:
<prompt>x</prompt>
{"effort": ""}

The glossary and the catalog come in a separate block.
`);

describe("agent file", () => {
  test("reads the catalog names and each glossary term with its variants", () => {
    const a = parseAgentFile(AGENT)!;
    expect([...a.known]).toEqual(["dev-workflow", "pr-review", "poneglyph-work:commit-message"]);
    expect([...a.terms]).toEqual([["agentic os", ["agentic os", "isentic"]], ["codex", ["codes"]]]);
    expect(parseAgentFile("no catalog here")).toBeNull();
  });

  test("keeps the agent's intro, fixes, process and skills, and puts the labels and examples in place of effort", () => {
    const a = parseAgentFile(SECTIONED)!;
    expect(a.kind).toBe("mod");
    const order = ["You read one prompt.", "with its keys in this order: task,", "fixes: misheard terms.", '- "heard" must sound like', "process: four companions.", "skills: catalog skills.", "task: what the request", "difficulty: how much", "Examples:", "Glossary (term: heard variants):", "Catalog (name: description):"];
    expect(order.map((t) => a.system.indexOf(t))).toEqual(order.map((t) => a.system.indexOf(t)).toSorted((x, y) => x - y));
    for (const t of order) expect(a.system).toContain(t);
    for (const gone of ["effort answer", "effort: deeper reasoning", '{"effort": ""}', "come in a separate block"]) expect(a.system).not.toContain(gone);
  });

  test("an agent file without those sections falls back to its body plus the rubric", () => {
    const a = parseAgentFile(AGENT)!;
    expect(a.kind).toBe("fallback");
    expect(a.system.startsWith("You read one prompt.")).toBe(true);
    expect(a.system).toContain('"continuity"');
    expect(parseAgentFile(SECTIONED.replace("\nskills: catalog skills.\n", "\n"))!.kind).toBe("fallback");
  });
});

describe("soundsLike", () => {
  test("keeps misheard terms and the glossary's own variants", () => {
    for (const [heard, meant, variants] of [["revo", "repo", []], ["pone grip", "Poneglyph", []], ["agent os", "Agentic OS", []], ["agente cost", "Agentic OS", []], ["cloud code", "Claude Code", []], ["glock", "Grok", []], ["jaiku", "Haiku", []], ["senitod", "Sonnet", ["senitod"]]] as const)
      expect([heard, soundsLike(heard, meant, variants)]).toEqual([heard, true]);
  });

  test("drops a word that only fits the topic", () => {
    for (const [heard, meant] of [["astra", "Codex"], ["company", "Opus"], ["high", "Haiku"], ["window", "worktree"], ["workboard", "Agentic OS"], ["orio", "Orca"], ["os", "Agentic OS"]] as const)
      expect([heard, soundsLike(heard, meant, [])]).toEqual([heard, false]);
  });

  test("a sound key of three letters or fewer only matches an identical key", () => {
    expect(soundsLike("PRO", "PR", ["pe erre"])).toBe(false);
    expect(soundsLike("pro", "prompt", ["prom", "pro"])).toBe(true);
    expect(soundsLike("hug", "hook", ["hug"])).toBe(true);
    expect(soundsLike("os", "Agentic OS", [])).toBe(false);
  });
});

describe("live memory", () => {
  test("glossaries merge like the hook's, only terms the agent file lacks go in the prompt, and fixes see every variant", () => {
    const g = mergeGlossaries(['{"Codex": ["codes"], "Haiku": ["jaiku"]}', '{"Haiku": ["jaicu"]}', "not json"]);
    expect(g).toEqual({ Codex: ["codes"], Haiku: ["jaiku", "jaicu"] });
    const extra = extraGlossary(g, new Map([["codex", ["codecs"]]]));
    expect([...extra.terms]).toEqual([["codex", ["codecs", "codes"]], ["haiku", ["jaiku", "jaicu"]]]);
    expect(extra.block).toBe("<extra-glossary>\nHaiku: jaiku, jaicu\n</extra-glossary>");
    expect(extraGlossary(g, new Map([["codex", []], ["haiku", []]])).block).toBe("");
  });

  test("skills loaded earlier come from the session's history", () => {
    const messages = [{ toolUses: [{ tool: "Skill", input: { skill: "pr-review" } }, { tool: "Read", input: { file_path: "x" } }] }, {}, { toolUses: [{ tool: "Skill", input: {} }] }];
    expect(skillsInHistory(messages)).toEqual(["pr-review"]);
  });
});

describe("parseReply", () => {
  const a = parseAgentFile(AGENT)!;
  const prompt = "revisa la PR de isentic y despliega";

  test("reads skills, companions, fixes and labels from fenced JSON", () => {
    const r = parseReply(reply({ fixes: [{ heard: "isentic", meant: "Agentic OS" }], process: { "dev-workflow": "despliega", "drillme-clarify": "\"\"" }, skills: [{ why: "revisa la PR", name: "pr-review" }], ...LABELS }), prompt, a.known, a.terms)!;
    expect(r.skills.map((s) => s.name)).toEqual(["pr-review", "dev-workflow"]);
    expect(r.fixes).toEqual([{ heard: "isentic", meant: "Agentic OS" }]);
    expect(r.labels).toEqual(LABELS as never);
  });

  test("drops fixes that only respell a right word", () => {
    const r = parseReply(reply({ fixes: [{ heard: "isentic", meant: "Agentic OS" }, { heard: "Agentic-OSes", meant: "Agentic OS" }], skills: [], ...LABELS }), `${prompt} en Agentic-OSes`, a.known, a.terms)!;
    expect(r.fixes).toEqual([{ heard: "isentic", meant: "Agentic OS" }]);
  });

  test("drops unknown, loaded and named skills, and fixes off the glossary or off its sound", () => {
    const r = parseReply(JSON.stringify({ fixes: [{ heard: "despliega", meant: "deploy" }, { heard: "despliega", meant: "Codex" }], skills: [{ name: "ghost" }, { name: "pr-review" }, { name: "dev-workflow" }], ...LABELS }), `${prompt} /dev-workflow`, a.known, a.terms, new Set(["pr-review"]))!;
    expect(r.skills).toEqual([]);
    expect(r.fixes).toEqual([]);
  });

  test("a corrected object written after the first one wins", () => {
    const first = JSON.stringify({ fixes: [{ heard: "isentic", meant: "Agentic OS" }], skills: [], ...LABELS });
    const second = JSON.stringify({ fixes: [], skills: [{ why: "revisa la PR", name: "pr-review" }], ...LABELS });
    const r = parseReply(`${first}\n\nCorrection: the first fix is not real.\n\n${second}`, prompt, a.known, a.terms)!;
    expect(r.fixes).toEqual([]);
    expect(r.skills.map((s) => s.name)).toEqual(["pr-review"]);
  });

  test("the same fix said twice is kept once", () => {
    const text = "el log pos falla y el log pos no avisa";
    const fixes = [{ heard: "log pos", meant: "Log Pose" }, { heard: "Log Pos", meant: "log pose" }];
    expect(parseReply(JSON.stringify({ fixes, skills: [], ...LABELS }), text, a.known, new Map([["log pose", ["log pos"]]]))!.fixes).toEqual([{ heard: "log pos", meant: "Log Pose" }]);
  });

  test("a fix may land on a catalog name when it sounds like one of its parts", () => {
    const known = new Set([...a.known, "drillme-clarify"]);
    const text = "usa trillme antes de tocar nada en el plan";
    const fixes = [{ heard: "trillme", meant: "drillme-clarify" }, { heard: "trillme", meant: "dev-workflow" }, { heard: "plan", meant: "pr-review" }];
    expect(parseReply(JSON.stringify({ fixes, skills: [], ...LABELS }), text, known, a.terms)!.fixes).toEqual([{ heard: "trillme", meant: "drillme-clarify" }]);
  });

  test("bad labels give null labels, no JSON gives null", () => {
    expect(parseReply(JSON.stringify({ skills: [], difficulty: "huge" }), prompt, a.known, null)!.labels).toBeNull();
    expect(parseReply("I cannot help with that", prompt, a.known, null)).toBeNull();
    expect(parseReply('{"skills": [', prompt, a.known, null)).toBeNull();
  });
});

describe("note", () => {
  const d = decide({ difficulty: "hard", uncertainty: "some-doubt", continuity: "new" }, null, null);

  test("keeps the hook's shape and adds the effort line", () => {
    const note = buildNote({ fixes: [], skills: [{ name: "dev-workflow", why: "build it" }], labels: null }, "diseña el \"mod\" nuevo con todos sus tests y docs ya", effortNote(d));
    expect(note.startsWith('<prompt-router re="diseña el &quot;mod&quot; nuevo con todos sus tests …">')).toBe(true);
    expect(note).toContain("- Skill(dev-workflow): build it");
    expect(note).toContain("go much deeper");
    expect(note).toContain("Effort: high for this prompt (hard, some doubt). Advisor gauge 3:");
    expect(note.endsWith("</prompt-router>")).toBe(true);
  });

  test("a floor above the mod's level names both, and the override applies from the next step", () => {
    expect(effortNote(d, undefined, "xhigh")).toContain("Effort: xhigh for this prompt (the session's own level, a floor over Log Pose's high: hard, some doubt).");
    expect(effortNote(d, undefined, "medium")).toContain("Effort: high for this prompt (hard, some doubt).");
    expect(effortNote(d)).toContain("it applies from the next step.");
  });

  test("an override names itself and how to clear it", () => {
    const o = decide({ difficulty: "easy", uncertainty: "clear", continuity: "same" }, "xhigh", null);
    expect(effortNote(o, "race condition")).toContain("(your override: race condition)");
    expect(effortNote(o)).toContain("Send auto when the task changes.");
  });

  test("nothing to say gives no note", () => {
    expect(buildNote({ fixes: [], skills: [], labels: null }, "x", "")).toBe("");
  });
});

describe("memory, cache and logs", () => {
  test("past prompts keep only known skills", () => {
    const memory = parseMemory('{"at":1,"prompt":"revisa la PR del router de skills","skills":["pr-review","gone"]}\nbroken\n{"at":2,"prompt":"otra cosa distinta","skills":["gone"]}');
    expect(memory).toHaveLength(2);
    expect(pastFor("revisa la PR del router", new Set(["pr-review"]), memory).map((e) => e.skills)).toEqual([["pr-review"]]);
  });

  test("a break is a step-0 read under 90 % of the previous prefix", () => {
    expect(cacheBroke({ input: 10, read: 90_000, write: 1_000 }, { input: 10, read: 85_000, write: 500 })).toBe(false);
    expect(cacheBroke({ input: 10, read: 90_000, write: 1_000 }, { input: 9_000, read: 2_000, write: 80_000 })).toBe(true);
    expect(cacheBroke({ input: 0, read: 0, write: 0 }, { input: 1, read: 0, write: 0 })).toBe(false);
  });

  test("the router log line matches the hook's fields", () => {
    const line = logLine("2026-10-15T10:00:00.000Z", { session: "abc-123-def-456", outcome: "ok", ms: 912.4, skills: ["pr-review"], fixes: 1, effort: "medium", floor: "xhigh", past: 2, input: 9000, output: 120, read: 8800, write: 150 });
    expect(line).toBe("2026-10-15T10:00:00.000Z host=claude via=mod session=abc-123- outcome=ok ms=912 skills=pr-review fixes=1 effort=medium floor=xhigh past=2 attended=1 entry=cli cost=- read=8800 write=150 in=9000 out=120 sid=abc-123-def-456");
    expect(logLine("t", { session: "s", outcome: "timeout", ms: 1, skills: [], fixes: 0, effort: "-", past: 0 })).toBe("t host=claude via=mod session=s outcome=timeout ms=1 skills=- fixes=0 effort=- floor=- past=0 attended=1 entry=cli cost=- read=- write=- in=- out=- sid=s");
  });

  test("appending keeps whole lines under the cap", () => {
    expect(appendCapped("", "a")).toBe("a\n");
    expect(appendCapped("a", "b")).toBe("a\nb\n");
    expect(appendCapped("1111\n2222\n", "3333", 12)).toBe("2222\n3333\n");
  });
});

describe("catalog", () => {
  test("a long description is cut at a sentence end and keeps its not-for sentence", () => {
    const text = `Builds spreadsheets. ${"Also reads and cleans tabular files of every kind. ".repeat(12)}Do NOT trigger when the deliverable is a Word document.`;
    const out = clipDescription(text, 300);
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out.startsWith("Builds spreadsheets. Also reads")).toBe(true);
    expect(out.endsWith(". Do NOT trigger when the deliverable is a Word document.")).toBe(true);
    expect(clipDescription("Short one.\n  Two.", 300)).toBe("Short one. Two.");
    expect(clipDescription(`docs ${"word ".repeat(80)}`, 50)).toMatch(/^docs( word)+…$/);
    expect(clipDescription(`docs ${"word ".repeat(80)}`, 50).length).toBeLessThanOrEqual(50);
  });

  test("a project skill reads folded values and when_to_use, and one the model cannot load is left out", () => {
    expect(skillFrontmatter("---\nname: jira\ndescription: >-\n  Reads tickets\n  of JRV.\nwhen_to_use: For a ticket id.\n---\nbody")).toEqual({ name: "jira", description: "Reads tickets of JRV. For a ticket id." });
    expect(skillFrontmatter("---\nname: \"x\"\ndescription: 'One line.'\n---\n")).toEqual({ name: "x", description: "One line." });
    expect(skillFrontmatter("---\nname: hidden\ndescription: Internal.\ndisable-model-invocation: true\n---\n")).toBeNull();
    expect(skillFrontmatter("---\nname: bare\n---\n")).toBeNull();
  });
});

describe("phase hints", () => {
  const known = new Set(["prompt-design", "natural-writing"]);
  const none = new Set<string>();
  test("an agent launch or a published page without its skill gets the hint once a session", () => {
    expect(phaseHint("Agent", {}, none, known, none)).toEqual({ skill: "prompt-design", text: "Log Pose: Skill(prompt-design) is not loaded; load it and brief the agent with it, then repeat this call; the repeat is not blocked." });
    expect(phaseHint("Artifact", { file_path: "page.html" }, none, known, none)?.skill).toBe("natural-writing");
    expect(phaseHint("Artifact", { action: "publish" }, none, known, none)?.skill).toBe("natural-writing");
  });

  test("no hint once loaded or hinted, off the catalog, for a read or for another tool", () => {
    expect(phaseHint("Agent", {}, new Set(["prompt-design"]), known, none)).toBeNull();
    expect(phaseHint("Agent", {}, new Set(["poneglyph:prompt-design"]), known, none)).toBeNull();
    expect(phaseHint("Agent", {}, none, known, new Set(["prompt-design"]))).toBeNull();
    expect(phaseHint("Agent", {}, none, none, none)).toBeNull();
    expect(phaseHint("Artifact", { action: "read" }, none, known, none)).toBeNull();
    expect(phaseHint("Bash", {}, none, known, none)).toBeNull();
    expect(phaseHint("Agent", { subagent_type: "prompt-router" }, none, known, none)).toBeNull();
    expect(phaseHint("Agent", { subagent_type: "Explore" }, none, known, none)?.skill).toBe("prompt-design");
  });
});
