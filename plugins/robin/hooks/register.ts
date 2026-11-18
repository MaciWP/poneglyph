import type { EngineInterface, Register, RenderElement } from "claude-code";
import { boxOf, check, contextLine, extractRobin, remember, streakFromLog, turnOf, type Check, type Turn } from "./core.ts";

// Tools whose work outlives the turn: a turn that called one ends before its result, so a missing
// ROBIN line there is an interim note, not a lost canary (the Stop hook's BACKGROUND_TOOLS plus
// Workflow).
const BACKGROUND = new Set(["Agent", "Task", "Monitor", "ScheduleWakeup", "Workflow"]);
const TONE = { ok: "success", wait: "inactive", bad: "error" } as const;

let session = "";
let streak = 0;
let last: Check | null = null;
let turns: Turn[] = [];
let waiting = false;
let notified = false;
let working = false;

async function logFile($: EngineInterface, id: string): Promise<string | null> {
  const home = await $.env.get("HOME");
  return home && id ? `${home}/.cache/poneglyph/robin/${id}.jsonl` : null;
}

// Appended with `>>` as log-pose's append does, so parallel sessions never drop a line.
async function append($: EngineInterface, file: string, line: string) {
  const appended = await $.process.run(["/bin/sh", "-c", 'mkdir -p "$(dirname "$1")" && cat >> "$1"', "sh", file], { stdin: `${line}\n` })
    .then((r) => r.exitCode === 0, () => false);
  if (appended) return;
  // ponytail: without a shell the file is rewritten whole and a line another session wrote meanwhile can be lost; upgrade when `$.fs` gains an append.
  const text = (await $.fs.exists(file).catch(() => false)) ? await $.fs.read(file).catch(() => null) : "";
  if (text === null) return;
  await $.fs.write(file, `${String(text)}${line}\n`).catch(() => {});
}

// After /clear or a resume the process goes on under another id with no `session.start`: the
// streak starts again from what that session's log left, and its rows go to its own file.
async function follow($: EngineInterface) {
  const id = await $.session.id();
  if (id === session) return;
  session = id;
  last = null;
  const file = await logFile($, id);
  const text = file && (await $.fs.exists(file).catch(() => false)) ? await $.fs.read(file).catch(() => "") : "";
  streak = streakFromLog(String(text ?? ""));
}

export const register: Register = (on) => {
  // The line Claude reads after a failed turn; nothing on any other prompt.
  on("prompt.submit", async ($, e, next) => {
    // A notification opens the next turn, or joins the running one.
    if (e.origin.kind === "task-notification") {
      if (working) waiting = true;
      else notified = true;
    }
    const line = last ? contextLine(last) : null;
    if (!line) return next(e);
    last = null;
    return next({ ...e, context: [...(e.context ?? []), line] });
  });

  on("turn.start", async ($, e, next) => {
    // Subagents' turns reach this hook too, with `agentId` (the local types predate it).
    // Each main turn starts clean, with or without a prompt before it (a wake-up, a delivery).
    if (!(e as { agentId?: string }).agentId) {
      working = true;
      waiting = notified;
      notified = false;
    }
    return next(e);
  });

  on("tool.call", async ($, e, next) => {
    const call = e as unknown as { tool: string; agentId?: string; run_in_background?: unknown };
    const r = await next(e);
    // A denied or failed call launched nothing.
    const out = r as { deny?: unknown; isError?: unknown } | undefined;
    if (!call.agentId && !out?.deny && !out?.isError && (BACKGROUND.has(call.tool) || call.run_in_background === true)) waiting = true;
    return r;
  });

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId) return r;
    working = false;
    if (e.isAborted) return r;
    try {
      await follow($);
      const c = check(e.answer, { streak, waiting, answered: e.reason === "answer" });
      streak = c.streak;
      last = c;
      turns = remember(turns, e.answer, c);
      const file = await logFile($, session);
      if (file)
        await append($, file, JSON.stringify({ at: new Date(await $.clock.now()).toISOString(), session, turnId: e.turnId, verdict: c.verdict, lang: c.lang, es: c.es, en: c.en, words: c.words, streak: c.streak, lost: c.lost, fail: c.fail }));
      $.ui.invalidate("ui.render");
    } catch {
      // A failed check leaves the answer as the engine drew it.
    }
    return r;
  });

  // The reply's last piece gets the box under it; with ROBIN found, the line moves into the box.
  // Matched by the answer's text, so a reply vista split around a table, or the redraw at every
  // turn's end, keeps each turn's own box.
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    const p = e.props;
    if (p.isSummary || !e.viewport) return next(e);
    const turn = turnOf(turns, p.text);
    const box = turn && boxOf(turn.check);
    if (!turn || !box) return next(e);
    const found = extractRobin(p.text);
    const moved = found && found.text === turn.check.robin;
    const { Box, Text, Markdown } = $.ui.resolve(e);
    const color = TONE[box.tone];
    // The ROBIN line is the model's markdown: drawn as a reply draws it, its links open on a click
    // and its code spans lose their backticks. The fixed lines are this mod's own plain text.
    const line = (l: string) => (l === turn.check.robin && Markdown ? Markdown({ text: l }) : Text({ wrap: "wrap", children: l }));
    const frame = Box({
      flexDirection: "column",
      borderStyle: "round",
      borderColor: color,
      paddingX: 1,
      children: [Text({ weight: "semibold", color, children: box.title }), ...box.lines.map(line)],
    });
    // The terminal draws the reply's ⏺ bullet in a 2-cell gutter; the box lines up with the text.
    const placed = e.surface === "terminal" ? Box({ paddingLeft: 2, children: frame }) : frame;
    if (moved && !found.body.trim()) return placed;
    const text = (await next(moved ? { ...e, props: { ...p, text: found.body } } : e)) as RenderElement;
    return Box({ flexDirection: "column", rowGap: 1, children: [text, placed] });
  });
};
