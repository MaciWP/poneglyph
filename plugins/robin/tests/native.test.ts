import { test, expect, mock } from "claude-code/testing";
import type { On } from "claude-code";

const viewport = { columns: 100, rows: 40, isFullscreen: true };
const ES = "He corregido la página y falta mirarla en el navegador, pero no hay errores en la consola.";
const EN = "I fixed the page and it is ready for review, but the console still has one warning that we should check.";
const OK = `${ES}\n\nROBIN: Página corregida; falta mirarla.`;

function world(on: On, { log = "", deny = [] as string[] } = {}) {
  mock.clock(on, { now: Date.parse("2026-11-15T10:00:00Z") });
  mock.env(on, { HOME: "/home/me" });
  const id = { value: "s1" };
  const rows: string[] = [];
  const context: string[][] = [];
  on("session.id", () => ({ value: id.value }));
  on("fs.exists", () => ({ value: log !== "" }));
  on("fs.read", () => ({ value: log }));
  on("process.run", (_, e) => {
    rows.push(...String(e.init?.stdin ?? "").trim().split("\n").filter(Boolean).map((l) => `${e.argv.at(-1)} ${l}`));
    return { value: { exitCode: 0, stdout: "", stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
  });
  on("prompt.submit", (_, e) => {
    context.push([...(e.context ?? [])]);
    return { text: e.text };
  });
  on("turn.start", (_, e) => ({ turnId: e.turnId }));
  on("turn.complete", (_, e) => ({ text: e.answer }));
  on("tool.call", (_, e) => (deny.includes((e as { tool: string }).tool) ? { deny: "load prompt-design first" } : { result: "ok" }) as never);
  // The engine's own drawing of a message: its text.
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e);
    return Text({ children: e.component === "AssistantMessage" ? `MD:${e.props.text}` : "other" });
  });
  return { id, rows, context };
}

const prompt = ($: { prompt: { submit: (e: never) => Promise<unknown> } }, kind = "composer") =>
  $.prompt.submit({ text: "haz la siguiente tarea del plan", origin: { kind } } as never);
const turn = (answer: string, turnId = "t1", extra: object = {}) => ({ answer, durationMs: 1, isAborted: false, turnId, reason: "answer" as const, ...extra });
const message = (text: string) =>
  ({ plugin: "robin", surface: "terminal" as const, component: "AssistantMessage" as const, requestId: `m-${text.length}`, viewport, props: { text, isFirstOfReply: true, onScreen: null } }) as never;

test("a reply with ROBIN gets a green box that holds the line, and one log row", async ($, on) => {
  const w = world(on);
  await prompt($);
  await $.turn.start({ turnId: "t1" } as never);
  await $.turn.complete(turn(OK));
  const chat = await $.ui.mount(message(OK));
  expect(await chat.find({ text: "ROBIN ✓" })).toBeDefined();
  // The line is markdown, drawn as a reply draws it: its links open on a click.
  expect(await chat.find({ type: "Markdown", text: "Página corregida; falta mirarla." })).toBeDefined();
  expect(await chat.find({ text: "ROBIN:" })).toBeUndefined();
  expect(await chat.find({ text: `MD:${ES}` })).toBeDefined();
  expect(w.rows).toHaveLength(1);
  expect(w.rows[0]).toStartWith("/home/me/.cache/poneglyph/robin/s1.jsonl ");
  expect(JSON.parse(w.rows[0]!.split(" ").slice(1).join(" "))).toMatchObject({ session: "s1", turnId: "t1", verdict: "ok", lang: "es", streak: 0, fail: false });
});

test("a ROBIN line with a link keeps the link's markdown for the engine to draw", async ($, on) => {
  world(on);
  await prompt($);
  await $.turn.start({ turnId: "t1" } as never);
  const answer = `${ES}\nROBIN: Página corregida; detalle en [la guía](https://example.com/guia).`;
  await $.turn.complete(turn(answer));
  const chat = await $.ui.mount(message(answer));
  expect(await chat.find({ type: "Markdown", text: "Página corregida; detalle en [la guía](https://example.com/guia)." })).toBeDefined();
});

test("a missing line draws a red box and tells Claude once, with the next prompt", async ($, on) => {
  const w = world(on);
  await prompt($);
  await $.turn.complete(turn(ES));
  const chat = await $.ui.mount(message(ES));
  expect(await chat.find({ text: "ROBIN ✗ falta" })).toBeDefined();
  expect(await chat.find({ text: `MD:${ES}` })).toBeDefined();
  await prompt($);
  expect(w.context.at(-1)!.join(" ")).toContain("did not end with a `ROBIN:` line");
  await prompt($);
  expect(w.context.at(-1)!.some((l) => l.startsWith("Robin:"))).toBe(false);
});

test("two answers in a row without ROBIN propose /compact", async ($, on) => {
  const w = world(on);
  await prompt($);
  await $.turn.complete(turn(ES, "t1"));
  await prompt($);
  await $.turn.complete(turn("Otra respuesta sin la línea del final, que también falta en este turno.", "t2"));
  const chat = await $.ui.mount(message("Otra respuesta sin la línea del final, que también falta en este turno."));
  expect(await chat.find({ text: "conviene /compact" })).toBeDefined();
  await prompt($);
  expect(w.context.at(-1)!.join(" ")).toContain("/compact");
});

test("an English answer fails even with its ROBIN line", async ($, on) => {
  const w = world(on);
  const answer = `${EN}\n\nROBIN: Page fixed.`;
  await prompt($);
  await $.turn.complete(turn(answer));
  const chat = await $.ui.mount(message(answer));
  expect(await chat.find({ text: "ROBIN ✗ idioma" })).toBeDefined();
  expect(await chat.find({ type: "Markdown", text: "Page fixed." })).toBeDefined();
  // The fixed lines are the mod's own plain text.
  expect(await chat.find({ type: "Text", text: "La respuesta está en inglés." })).toBeDefined();
  await prompt($);
  expect(w.context.at(-1)!.join(" ")).toContain("in English");
});

test("a turn that launched background work is waiting: grey box, no streak, no line for Claude", async ($, on) => {
  const w = world(on);
  await prompt($);
  await $.turn.start({ turnId: "t1" } as never);
  await $.tool.call({ tool: "Agent", prompt: "x" } as never);
  await $.turn.complete(turn("Espero al agente para seguir con el plan."));
  const chat = await $.ui.mount(message("Espero al agente para seguir con el plan."));
  expect(await chat.find({ text: "ROBIN · esperando" })).toBeDefined();
  await prompt($);
  expect(w.context.at(-1)!.some((l) => l.startsWith("Robin:"))).toBe(false);
  expect(JSON.parse(w.rows[0]!.split(" ").slice(1).join(" "))).toMatchObject({ verdict: "wait", streak: 0 });
});

test("a task notification's turn is waiting too; the next turn starts clean even without a prompt", async ($, on) => {
  const w = world(on);
  await prompt($, "task-notification");
  await $.turn.start({ turnId: "t1" } as never);
  await $.turn.complete(turn("El primer agente ha terminado; espero al segundo.", "t1"));
  await $.turn.start({ turnId: "t2" } as never);
  await $.turn.complete(turn("Retomo el plan sin la línea del final, que aquí sí falta.", "t2"));
  expect(w.rows.map((r) => JSON.parse(r.split(" ").slice(1).join(" ")).verdict)).toEqual(["wait", "miss"]);
});

test("a denied background call launches nothing, so the turn is not waiting", async ($, on) => {
  const w = world(on, { deny: ["Agent"] });
  await prompt($);
  await $.turn.start({ turnId: "t1" } as never);
  await $.tool.call({ tool: "Agent", prompt: "x" } as never);
  await $.turn.complete(turn("No he podido lanzar el agente y no cierro con la línea.", "t1"));
  expect(JSON.parse(w.rows[0]!.split(" ").slice(1).join(" "))).toMatchObject({ verdict: "miss" });
});

test("subagent and interrupted turns are ignored; filler is skipped without a box", async ($, on) => {
  const w = world(on);
  await prompt($);
  await $.turn.complete(turn(ES, "a1", { agentId: "agent-1" }));
  await $.turn.complete(turn(ES, "t2", { isAborted: true, reason: "aborted" }));
  expect(w.rows).toHaveLength(0);
  await $.turn.complete(turn("No response requested.", "t3"));
  const chat = await $.ui.mount(message("No response requested."));
  expect(await chat.find({ text: "ROBIN" })).toBeUndefined();
  expect(JSON.parse(w.rows[0]!.split(" ").slice(1).join(" "))).toMatchObject({ verdict: "skip" });
});

test("an interim message gets no box, and a turn's box survives the next turn's redraw", async ($, on) => {
  world(on);
  await prompt($);
  const interim = await $.ui.mount(message("Leo el fichero y sigo."));
  await $.turn.complete(turn(OK, "t1"));
  await interim.redraw();
  expect(await interim.find({ text: "ROBIN" })).toBeUndefined();
  const first = await $.ui.mount(message(OK));
  await prompt($);
  await $.turn.complete(turn(ES, "t2"));
  await first.redraw();
  expect(await first.find({ text: "ROBIN ✓" })).toBeDefined();
});

test("a reply vista split gets the box on its last piece only", async ($, on) => {
  world(on);
  const answer = `${ES}\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nROBIN: Página corregida; falta mirarla.`;
  await prompt($);
  await $.turn.complete(turn(answer));
  const head = await $.ui.mount(message(ES));
  expect(await head.find({ text: "ROBIN" })).toBeUndefined();
  const tail = await $.ui.mount(message("ROBIN: Página corregida; falta mirarla."));
  expect(await tail.find({ text: "ROBIN ✓" })).toBeDefined();
  expect(await tail.find({ text: "MD:" })).toBeUndefined();
});

test("a new session id after /clear restarts the streak from that session's log", async ($, on) => {
  const w = world(on, { log: '{"streak":1}\n' });
  await prompt($);
  await $.turn.complete(turn(ES, "t1"));
  expect(JSON.parse(w.rows[0]!.split(" ").slice(1).join(" "))).toMatchObject({ session: "s1", streak: 2, lost: true });
  w.id.value = "s2";
  await prompt($);
  await $.turn.complete(turn(ES, "t2"));
  expect(w.rows[1]).toStartWith("/home/me/.cache/poneglyph/robin/s2.jsonl ");
  expect(JSON.parse(w.rows[1]!.split(" ").slice(1).join(" "))).toMatchObject({ session: "s2", streak: 2 });
});
