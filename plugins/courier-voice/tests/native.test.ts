import { test, expect, mock } from "claude-code/testing";
import type { On } from "claude-code";

const start = { cwd: "/work/project", surface: "terminal" as const, isInteractive: true };
const courier = { kind: "plugin", name: "courier" };
const delivered = (id: string, from = "codex-1") => `[Agentic OS message ${id} from ${from}]\nhello ${id}\nsecond line\n\nReply only if the message asks for one: aos message reply ${id}`;
const reply = (body: unknown, status = 200) => ({ value: { status, ok: status < 400, headers: {}, text: JSON.stringify(body) } });

// Agentic OS's agents list; `failures` answers 500 that many times first, and `hold` keeps each
// read open until the test calls `w.release()`.
function world(on: On, failures = 0, hold = false) {
  const clock = mock.clock(on, { now: Date.parse("2026-11-15T10:00:00Z") });
  mock.env(on, { AOS_URL: "http://localhost:4317", AOS_AGENT_ID: "agent-1" });
  let open: () => void = () => {};
  const w = { clock, reads: 0, release: () => open() };
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("http.fetch", async () => {
    w.reads++;
    if (hold) await new Promise<void>((r) => (open = r));
    return failures-- > 0 ? reply({}, 500) : reply({ agents: [{ id: "codex-1", name: "Revisor" }] });
  });
  // The engine's own drawing of a prompt row: its text.
  on("ui.render", ($, e) => $.ui.resolve(e).Text({ children: `ROW:${(e.props as { text: string }).text}` }));
  return w;
}

let rows = 0;
const row = (text: string, origin: object, isExpanded = false) =>
  ({ plugin: "courier-voice", surface: "terminal" as const, component: "UserMessage" as const, requestId: `u-${++rows}`, viewport: { columns: 100, rows: 40, isFullscreen: true }, props: { text, origin, isExpanded, onScreen: null } }) as never;

test("a courier row is folded into one violet line that names its sender", async ($, on) => {
  const w = world(on);
  await $.session.start(start);
  await w.clock.settle();
  const chat = await $.ui.mount(row(`The courier plugin sent a message:\n${delivered("m1")}`, courier));
  expect(await chat.find({ text: "Agentic OS · Revisor" })).toBeDefined();
  expect(await chat.find({ type: "Text", text: " · hello m1" })).toBeDefined();
  expect(await chat.find({ text: "ROW:" })).toBeUndefined();
});

test("expanded, the box holds the whole message without the reply line; other origins keep the engine's row", async ($, on) => {
  world(on);
  const open = await $.ui.mount(row(delivered("m1", "user"), courier, true));
  expect(await open.find({ text: "Agentic OS · tú" })).toBeDefined();
  // Markdown, as a reply draws it, so a link in the message opens on a click.
  expect(await open.find({ type: "Markdown", text: "hello m1\nsecond line" })).toBeDefined();
  expect(await open.find({ text: "Reply only" })).toBeUndefined();
  for (const origin of [{ kind: "composer" }, { kind: "task-notification" }, { kind: "plugin", name: "other" }]) {
    const other = await $.ui.mount(row(delivered("m1"), origin));
    expect(await other.find({ text: `ROW:${delivered("m1")}` })).toBeDefined();
    expect(await other.find({ text: "Agentic OS · " })).toBeUndefined();
  }
});

test("a failed names read leaves the id and is tried again after 30 s by the next row", async ($, on) => {
  const w = world(on, 1);
  await $.session.start(start);
  await w.clock.settle();
  const before = await $.ui.mount(row(delivered("m1"), courier));
  expect(await before.find({ text: "Agentic OS · codex-1" })).toBeDefined();
  await w.clock.settle();
  expect(w.reads).toBe(1);
  await w.clock.advance(30_000);
  await $.ui.mount(row(delivered("m2"), courier));
  await w.clock.settle();
  expect(w.reads).toBe(2);
  const after = await $.ui.mount(row(delivered("m3"), courier));
  expect(await after.find({ text: "Agentic OS · Revisor" })).toBeDefined();
});

test("rows from two unknown senders while a read is open make one read", async ($, on) => {
  const w = world(on, 0, true);
  await $.session.start({ ...start, isInteractive: false });
  await $.ui.mount(row(delivered("m1", "codex-2"), courier));
  await $.ui.mount(row(delivered("m2", "codex-3"), courier));
  expect(w.reads).toBe(1);
  w.release();
  await w.clock.settle();
  expect(w.reads).toBe(1);
});
