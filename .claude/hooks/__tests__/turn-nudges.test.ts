import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { dueNudges, endsWithTextQuestion, isConfigPath, isEnglishNote, NUDGE_TEXT, noteMatches, readTail } from "../turn-nudges";
import { ignoreLearned } from "./learned-fixture";

const HOOK = resolve(import.meta.dir, "../turn-nudges.ts");
const IMPERATIVE = /^(Read|Ask|You must|Do not|Never|Answer|Load)\b/m;

const prompt = (text: string, ts: string) => ({ type: "user", timestamp: ts, message: { content: text } });
const say = (text: string) => ({ type: "assistant", message: { content: [{ type: "text", text }] } });
const tool = (name: string, input: Record<string, unknown> = {}) => ({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
const routerNote = (re: string) => ({
  type: "attachment",
  attachment: {
    type: "async_hook_response",
    response: { hookSpecificOutput: { additionalContext: `<prompt-router re="${re}">\nCandidate skills: answer each one now.\n- Skill(dev-workflow): why` } },
  },
});
const jsonl = (...events: object[]) => events.map((e) => JSON.stringify(e)).join("\n");

const PROMPT = "arregla el bug del export cuando el fichero viene vacío por favor";
const RE = "arregla el bug del export cuando el fichero viene …";

describe("turn-nudges: pure parts", () => {
  it("matches a router note to its own prompt only", () => {
    expect(noteMatches(`<prompt-router re="${RE}">`, PROMPT)).toBe(true);
    expect(noteMatches(`<prompt-router re="otra cosa distinta">`, PROMPT)).toBe(false);
    expect(noteMatches(`<prompt-router re="&lt;pasted&gt; hola">`, "<pasted> hola")).toBe(true);
    expect(noteMatches(`<prompt-router re="${RE}">`, `<pasted_content id="1">log</pasted_content>\n${PROMPT}`)).toBe(true);
  });

  it("tracks the router note, the Router: answer, asks and skills per turn", () => {
    const tail = readTail(
      jsonl(prompt("antes", "t0"), tool("Skill", { skill: "harness-config" }), prompt(PROMPT, "t1"), routerNote(RE), say("Miro el fichero."), tool("AskUserQuestion")),
    );
    expect(tail.current?.key).toBe("t1");
    expect(tail.current?.routerNote).toBe(true);
    expect(tail.current?.routerAnswered).toBe(false);
    expect(tail.current?.asks).toBe(1);
    expect(tail.skills.has("harness-config")).toBe(true);
    const answered = readTail(jsonl(prompt(PROMPT, "t1"), routerNote(RE), say("**Router:** dev-workflow sí (bug).")));
    expect(answered.current?.routerAnswered).toBe(true);
  });

  it("a message sent mid-turn opens its own turn; a queued task notification does not", () => {
    const queued = (text: string, ts: string, kind = "human") => ({
      type: "attachment",
      timestamp: ts,
      attachment: { type: "queued_command", prompt: text, commandMode: kind === "human" ? "prompt" : kind, origin: { kind } },
    });
    const tail = readTail(jsonl(prompt("antes", "t0"), say("**Router:** x no (nada)."), queued(PROMPT, "t1"), routerNote(RE), tool("Read")));
    expect(tail.current?.key).toBe("t1");
    expect(tail.current?.routerNote).toBe(true);
    expect(tail.current?.routerAnswered).toBe(false);
    expect(dueNudges({ event: "PostToolUse", tail }).map((d) => d.kind)).toContain("router");
    const notice = readTail(jsonl(prompt(PROMPT, "t1"), queued("<task-notification>done</task-notification>", "t2", "task-notification")));
    expect(notice.current?.key).toBe("t1");
  });

  it("a late note for an earlier prompt does not count", () => {
    const tail = readTail(jsonl(prompt(PROMPT, "t1"), prompt("otra petición distinta de seis palabras", "t2"), routerNote(RE)));
    expect(tail.current?.routerNote).toBe(false);
  });

  it("flags English notes, ignoring code and short lines", () => {
    expect(isEnglishNote("The failure causes match and it is the same for all of the controls.")).toBe(true);
    expect(isEnglishNote("Los fallos coinciden y es el mismo para todos los controles de la lista.")).toBe(false);
    expect(isEnglishNote("Ejecuto `the test of the thing that is for the one with it`.")).toBe(false);
    expect(isEnglishNote("The end.")).toBe(false);
  });

  it("detects a text question closing the answer, before ROBIN", () => {
    expect(endsWithTextQuestion("**Hecho.**\n¿Borramos `/v1/export`?\nROBIN: hecho.")).toBe(true);
    expect(endsWithTextQuestion("**Hecho.**\nROBIN: ¿seguro?")).toBe(false);
    expect(endsWithTextQuestion("**Hecho.**\nROBIN: listo.")).toBe(false);
  });

  it("recognises Poneglyph config paths", () => {
    expect(isConfigPath("/r/.claude/skills/x/SKILL.md")).toBe(true);
    expect(isConfigPath("/r/CLAUDE.md")).toBe(true);
    expect(isConfigPath("/r/.claude/settings.global.json")).toBe(true);
    expect(isConfigPath("/u/.claude/projects/p/memory/x.md")).toBe(false);
    expect(isConfigPath("/r/src/app.ts")).toBe(false);
  });

  it("config nudge only on edits without harness-config loaded", () => {
    const tail = readTail(jsonl(prompt(PROMPT, "t1")));
    expect(dueNudges({ event: "PostToolUse", tail, toolName: "Edit", filePath: "/r/CLAUDE.md" }).map((d) => d.kind)).toEqual(["config"]);
    expect(dueNudges({ event: "PostToolUse", tail, toolName: "Read", filePath: "/r/CLAUDE.md" })).toEqual([]);
    const loaded = readTail(jsonl(tool("Skill", { skill: "harness-config" }), prompt(PROMPT, "t1")));
    expect(dueNudges({ event: "PostToolUse", tail: loaded, toolName: "Edit", filePath: "/r/CLAUDE.md" })).toEqual([]);
  });

  it("question nudge judges the finished turn, not the new prompt", () => {
    const tail = readTail(jsonl(prompt("uno", "t1"), say("**Hecho.**\n¿Borramos el endpoint?\nROBIN: hecho."), prompt("sí, bórralo", "t2")));
    expect(dueNudges({ event: "UserPromptSubmit", tail, prompt: "sí, bórralo" })).toEqual([{ kind: "question", key: "t1" }]);
    const asked = readTail(jsonl(prompt("uno", "t1"), tool("AskUserQuestion"), say("**Hecho.**\n¿Borramos?\nROBIN: hecho.")));
    expect(dueNudges({ event: "UserPromptSubmit", tail: asked, prompt: "sí" })).toEqual([]);
  });

  it("every reminder is a factual sentence", () => {
    for (const text of Object.values(NUDGE_TEXT)) expect(text).not.toMatch(IMPERATIVE);
  });
});

describe("turn-nudges: hook process", () => {
  function setup(events: object[]) {
    const dir = ignoreLearned(mkdtempSync(join(tmpdir(), "turn-nudges-")));
    const transcript = join(dir, "t.jsonl");
    writeFileSync(transcript, jsonl(...events));
    return { dir, transcript };
  }
  function run(dir: string, payload: object): string {
    const proc = Bun.spawnSync([process.execPath, HOOK], { stdin: Buffer.from(JSON.stringify(payload)), env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
    expect(proc.exitCode).toBe(0);
    return proc.stdout.toString().trim();
  }

  it("reminds once per turn and logs it", () => {
    const { dir, transcript } = setup([prompt(PROMPT, "t1"), routerNote(RE), say("Miro el fichero.")]);
    const payload = { hook_event_name: "PostToolUse", session_id: "s1", transcript_path: transcript, tool_name: "Read", tool_input: {} };
    const out = JSON.parse(run(dir, payload));
    expect(out.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    expect(out.hookSpecificOutput.additionalContext).toBe(NUDGE_TEXT.router);
    expect(run(dir, payload)).toBe("");
    expect(readFileSync(join(dir, ".claude", "learned", "turn-nudges.log"), "utf8")).toMatch(/ s1 router t1\n$/);
  });

  it("stays silent inside a subagent and leaves the main thread's marker unspent", () => {
    const { dir, transcript } = setup([prompt(PROMPT, "t1"), routerNote(RE), say("Miro el fichero.")]);
    const base = { hook_event_name: "PostToolUse", session_id: "s1", transcript_path: transcript, tool_name: "Read", tool_input: {} };
    expect(run(dir, { ...base, agent_id: "a1" })).toBe("");
    expect(JSON.parse(run(dir, base)).hookSpecificOutput.additionalContext).toBe(NUDGE_TEXT.router);
  });

  it("stays silent and exits 0 on a broken payload", () => {
    const { dir } = setup([]);
    expect(run(dir, { hook_event_name: "PostToolUse", transcript_path: "/nope.jsonl" })).toBe("");
  });
});
