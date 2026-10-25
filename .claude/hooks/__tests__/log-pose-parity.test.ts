import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { buildRouterNote, clipDescription, modFailing, modRoutes, parseRouterOutput, ROUTER_AGENT_FILE, routerAgentFile, routerContext, soundsLike } from "../prompt-router";
import { formatPast, pastFor, similarPast } from "../router/memory";
import { routerNoteOf } from "../lib/transcript";
import { claudeConfigDir, learnedLog } from "../lib/paths";
import { buildNote, clipDescription as modClipDescription, EXAMPLES, formatPast as modFormatPast, learnedPath, parseAgentFile, parseReply, pastFor as modPastFor, similarPast as modSimilarPast, soundsLike as modSoundsLike } from "../../../plugins/log-pose/hooks/core.ts";

// log-pose cannot import this repo's hooks (a mod loads only its own files), so it carries
// copies of the router's parsing, note and memory code. These cases keep the two equal.

const catalog = [
  { name: "dev-workflow", description: "The development loop." },
  { name: "pr-review", description: "Reviews a PR." },
  { name: "natural-writing", description: "Prose for people." },
  { name: "poneglyph-work:commit-message", description: "Writes commits." },
  { name: "drillme-clarify", description: "Asks first." },
];
const glossary = { "Agentic OS": ["agentic os", "isentic"], Codex: ["codes"] };
const agent = parseAgentFile(`---\nname: prompt-router\n---\nBody.\n\n${routerContext(catalog, glossary)}\n`)!;

// Replies as Haiku wrote them in the 2026-10-15 probe, plus the edge cases the parser guards.
const CASES: { prompt: string; reply: object | string; loaded?: string[] }[] = [
  { prompt: "revisa la PR de esta rama y deja los comentarios sin publicar", reply: { fixes: [], process: { "dev-workflow": "", "drillme-clarify": "", "natural-writing": "", "changes-verify": "" }, skills: [{ why: "revisa la PR de esta rama", name: "pr-review" }], effort: "" } },
  { prompt: "implementa la exportación a CSV del listado y sus tests", reply: { fixes: [], process: { "dev-workflow": "implement the CSV export and its tests", "natural-writing": "\"\"" }, skills: [], effort: "" } },
  { prompt: "escribe el mensaje para el canal del equipo sobre isentic", reply: { fixes: [{ heard: "isentic", meant: "Agentic OS" }, { heard: "canal", meant: "channel" }], process: { "natural-writing": "write the team channel message" }, skills: [{ why: "x", name: "ghost" }], effort: "" } },
  { prompt: "haz el commit con /dev-workflow y revisa la PR que abrimos", reply: { fixes: [], process: { "dev-workflow": "yes" }, skills: [{ why: "commit", name: "poneglyph-work:commit-message" }, { why: "PR", name: "pr-review" }], effort: "" }, loaded: ["pr-review"] },
  { prompt: "sin JSON en la respuesta del modelo para nada", reply: "I can't decide." },
  // Sonnet in the eval v3 test split: an object, a correction in prose, then the corrected object.
  // A fix onto a catalog name, by the sound of one of its parts.
  { prompt: "usa trillme y luego haz el comit del cambio", reply: { fixes: [{ heard: "trillme", meant: "drillme-clarify" }, { heard: "comit", meant: "poneglyph-work:commit-message" }, { heard: "luego", meant: "pr-review" }], skills: [] } },
  { prompt: "revisa la PR de codes y deja los comentarios", reply: `${JSON.stringify({ fixes: [{ heard: "codes", meant: "Codex" }], skills: [] })}\n\nCorrection: the fix is not real.\n\n${JSON.stringify({ fixes: [], skills: [{ why: "revisa la PR", name: "pr-review" }] })}` },
];

describe("log-pose mirrors the router hook", () => {
  for (const c of CASES) {
    test(c.prompt, () => {
      const text = typeof c.reply === "string" ? c.reply : JSON.stringify(c.reply);
      const hook = parseRouterOutput(JSON.stringify({ result: text }), c.prompt, catalog, { glossary, loaded: new Set(c.loaded ?? []) });
      const mod = parseReply(text, c.prompt, agent.known, agent.terms, new Set(c.loaded ?? []));
      expect(mod === null).toBe(hook === null);
      if (!hook || !mod) return;
      expect(mod.skills).toEqual(hook.skills);
      expect(mod.fixes).toEqual(hook.fixes);
      // Same candidate, fix and deep-skill lines; the frame differs on purpose (no late-note line).
      const body = (note: string) => note.split("\n").filter((l) => /^(- Skill\(|Probable dictation|`dev-workflow`|Candidate skills|<prompt-router re=)/.test(l));
      expect(body(buildNote(mod, c.prompt, ""))).toEqual(body(buildRouterNote({ ...hook, effort: "" }, c.prompt)));
    });
  }

  test("memory search and its block", () => {
    const memory = [
      { at: 1, prompt: "revisa la PR del router de skills y comenta", skills: ["pr-review"] },
      { at: 2, prompt: "escribe el mensaje del canal sobre el router", skills: ["natural-writing"] },
      { at: 3, prompt: "otra cosa sin relación alguna", skills: ["dev-workflow"] },
      { at: 4, prompt: "investiga en los logs del router por qué falla", skills: [], declined: ["pr-review", "ghost"] },
    ];
    const known = new Set(["pr-review", "natural-writing", "dev-workflow"]);
    for (const q of ["revisa la PR del router", "mensaje del canal router skills", "logs del router fallan", "nada"]) {
      expect(modSimilarPast(q, memory)).toEqual(similarPast(q, memory));
      expect(modFormatPast(modSimilarPast(q, memory))).toBe(formatPast(similarPast(q, memory)));
      expect(modFormatPast(modPastFor(q, known, memory))).toBe(formatPast(pastFor(q, known, memory)));
    }
    expect(formatPast(pastFor("logs del router fallan", known, memory))).toContain("→ declined: pr-review\n");
  });
});

describe("the mod's prompt from the real router agent", () => {
  const real = parseAgentFile(routerAgentFile(ROUTER_AGENT_FILE, catalog, glossary))!;
  const examples = (text: string) => [...text.replace(/\r\n/g, "\n").matchAll(/<prompt>(.*)<\/prompt>\n(?:<previous>.*<\/previous>\n)?(\{.*\})/g)]
    .map((m) => { const o = JSON.parse(m[2]!); return { prompt: m[1], fixes: o.fixes, process: o.process, skills: o.skills }; });

  test("is built from the agent's sections, not the fallback", () => {
    expect(real.kind).toBe("mod");
    expect(real.system).not.toContain("effort answer");
    expect(real.system).not.toContain("\neffort: ");
  });

  test("a CRLF copy of the agent file still builds the mod's prompt", () => {
    const crlf = parseAgentFile(routerAgentFile(ROUTER_AGENT_FILE, catalog, glossary).replace(/\r?\n/g, "\r\n"))!;
    expect(crlf.kind).toBe("mod");
    expect(crlf.system).toBe(real.system);
  });

  test("its examples keep the agent's prompts, fixes, process and skills", () => {
    expect(examples(EXAMPLES)).toHaveLength(5);
    expect(examples(EXAMPLES)).toEqual(examples(readFileSync(ROUTER_AGENT_FILE, "utf8")));
  });

  test("clipDescription is the hook's", () => {
    const long = `Builds spreadsheets. ${"Also reads and cleans tabular files. ".repeat(20)}Do NOT trigger for a Word document. No es para informes.`;
    for (const [text, max] of [[long, 600], [long, 120], [`docs ${"word ".repeat(200)}`, 600], ["Short.", 600], ["No es para nada. Y algo más.", 10]] as const) {
      expect(modClipDescription(text, max)).toBe(clipDescription(text, max));
    }
  });

  test("soundsLike is the hook's", () => {
    const pairs = [["revo", "repo"], ["pone grip", "Poneglyph"], ["agente coast", "Agentic OS"], ["astra", "Codex"], ["company", "Opus"], ["claudia", "Claude Code"], ["bro", "Grok"], ["", "Opus"]] as const;
    for (const [heard, meant] of pairs) for (const variants of [[], ["claud call", "grog"]]) expect(modSoundsLike(heard, meant, variants)).toBe(soundsLike(heard, meant, variants));
  });
});

describe("log path", () => {
  test("learnedPath joins with backslashes when the config dir is a Windows path", () => {
    expect(learnedPath("C:\\repo", "C:\\Users\\u\\.claude", false, "x.log")).toBe("C:\\Users\\u\\.claude\\learned\\C-repo\\x.log");
    expect(learnedPath("/repo", "/home/u/.claude", true, "x.log")).toBe("/repo/.claude/learned/x.log");
  });

  test("learnedPath matches the hook's learnedLog for a project that does not ignore learned/", () => {
    const saved = process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_PROJECT_DIR;
    try {
      const root = mkdtempSync(join(tmpdir(), "log-pose-root-"));
      expect(learnedPath(root, claudeConfigDir(), false, "prompt-router.log")).toBe(learnedLog(root, "prompt-router.log"));
    } finally {
      if (saved !== undefined) process.env.CLAUDE_PROJECT_DIR = saved;
    }
  });
});

describe("router note in a transcript", () => {
  const note = '<prompt-router re="x">\nCandidate skills: …\n</prompt-router>';

  test("reads the hook's async response and the mod's context block", () => {
    expect(routerNoteOf({ type: "attachment", attachment: { type: "async_hook_response", response: { hookSpecificOutput: { additionalContext: note } } } })).toBe(note);
    expect(routerNoteOf({ type: "attachment", attachment: { type: "hook_additional_context", hookName: "prompt.submit", content: ["Workboard: …", note] } })).toBe(`Workboard: …\n${note}`);
    expect(routerNoteOf({ type: "attachment", attachment: { type: "hook_additional_context", content: ["Workboard: …"] } })).toBeNull();
    expect(routerNoteOf({ type: "user", message: { content: note } })).toBeNull();
  });
});

describe("modRoutes", () => {
  test("is true only while log-pose is enabled and installed", () => {
    const config = mkdtempSync(join(tmpdir(), "log-pose-"));
    mkdirSync(join(config, "plugins"), { recursive: true });
    writeFileSync(join(config, "plugins", "installed_plugins.json"), JSON.stringify({ plugins: { "log-pose@poneglyph": [{ scope: "user", installPath: "/p/log-pose" }] } }));
    writeFileSync(join(config, "settings.json"), JSON.stringify({ enabledPlugins: { "log-pose@poneglyph": false } }));
    expect(modRoutes("/work", config)).toBe(false);
    writeFileSync(join(config, "settings.json"), JSON.stringify({ enabledPlugins: { "log-pose@poneglyph": true } }));
    expect(modRoutes("/work", config)).toBe(false); // no synced router agent for the mod to read
    mkdirSync(join(config, "agents"));
    writeFileSync(join(config, "agents", "prompt-router.md"), "---\nname: prompt-router\n---\n");
    const saved = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = config;
    try {
      expect(modRoutes("/work", config)).toBe(false); // no mod line in the log: the mod may not run at all
      const log = learnedLog("/work", "prompt-router.log");
      mkdirSync(dirname(log), { recursive: true });
      writeFileSync(log, "2026-10-15T10:00:00.000Z host=claude via=mod session=s1 outcome=ok ms=1 sid=s1\r\n");
      expect(modRoutes("/work", config)).toBe(true);
      expect(modRoutes("/work", config, "s1")).toBe(true);
    } finally {
      if (saved === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = saved;
    }
  });

  test("modFailing: the mod's last three calls in this session failed", () => {
    const line = (outcome: string, sid = "s1", via = "via=mod ") => `2026-10-15T10:00:00.000Z host=claude ${via}session=${sid} outcome=${outcome} ms=1 skills=- fixes=0 effort=- past=0 attended=1 entry=cli cost=- in=- out=- sid=${sid}`;
    const log = (...l: string[]) => l.join("\n");
    expect(modFailing(log(line("error"), line("timeout"), line("bad-output")), "s1")).toBe(true);
    expect(modFailing(log(line("error"), line("ok"), line("error"), line("error")), "s1")).toBe(false);
    expect(modFailing(log(line("error"), line("error"), line("error", "s2"), line("ok", "s1", "")), "s1")).toBe(false); // other session, hook line
    expect(modFailing(log(line("error"), line("error"), line("error")), "")).toBe(false);
  });
});
