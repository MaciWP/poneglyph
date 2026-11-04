import { test, expect, mock } from "claude-code/testing";
import type { On } from "claude-code";

const start = { cwd: "/work/project", surface: "terminal" as const, isInteractive: true };
const complete = { turnId: "t1", answer: "", durationMs: 1, isAborted: false, usage: null } as never;
const msg = (id: string) => ({ id, from: "codex-1", to: "me", text: `hello ${id}`, status: "pending" });
const reply = (body: unknown, status = 200) => ({ value: { status, ok: status < 400, headers: {}, text: JSON.stringify(body) } });

// Agentic OS holds `inbox` until a read hands it out; /wait answers at once for after 0 and then
// blocks like a long poll until the test moves the clock. `claims` maps an id to a claim status.
function world(on: On, opts: { env?: Record<string, string>; claims?: Record<string, number>; drops?: string[]; hold?: boolean } = {}) {
  const clock = mock.clock(on, { now: Date.parse("2026-10-27T10:00:00Z") });
  mock.env(on, opts.env ?? { AOS_URL: "http://localhost:4317", AOS_AGENT_ID: "agent-1" });
  const log: string[] = [];
  const headers: Record<string, string>[] = [];
  const bodies: Record<string, unknown> = {};
  const w = { clock, log, headers, bodies, inbox: [] as (ReturnType<typeof msg> & { prompt?: string })[], reads: 0, submitted: [] as string[], pending: [] as (() => void)[] };
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("session.attach", (_, e) => ({ clientId: e.clientId }));
  on("turn.complete", () => ({ text: "" }));
  on("http.fetch", async (_, e) => {
    const path = e.url.replace("http://localhost:4317/api/coordination/", "");
    log.push(`${e.init?.method ?? "GET"} ${path}`);
    headers.push(e.init?.headers as Record<string, string>);
    if (e.init?.body) bodies[path] = JSON.parse(String(e.init.body));
    if (path === "wait") {
      if ((bodies[path] as { after: number }).after !== 0) await clock.sleep(25_000);
      return reply({ revision: 1 });
    }
    if (path === "inbox") {
      w.reads++;
      const messages = w.inbox;
      w.inbox = [];
      return reply({ messages });
    }
    if (path.endsWith("/claim")) return reply({}, opts.claims?.[path.split("/")[1] ?? ""] ?? 200);
    return reply({});
  });
  on("prompt.submit", async (_, e) => {
    w.submitted.push(e.text);
    if (opts.hold) await new Promise<void>((resolve) => w.pending.push(resolve));
    const drop = opts.drops?.shift();
    if (drop === "throw") throw new Error("host exploded");
    return drop ? { drop } : { text: e.text };
  });
  return w;
}

const mutations = (log: string[]) => log.filter((l) => l.startsWith("POST messages/"));

test("without AOS_URL and AOS_AGENT_ID no request is made", async ($, on) => {
  const w = world(on, { env: {} });
  await $.session.start(start);
  await w.clock.advance(60_000);
  expect(w.log).toEqual([]);
});

test("a non-loopback AOS_URL does nothing", async ($, on) => {
  const w = world(on, { env: { AOS_URL: "http://example.com:4317", AOS_AGENT_ID: "agent-1" } });
  await $.session.start(start);
  await w.clock.advance(60_000);
  expect(w.log).toEqual([]);
});

test("a message is claimed, submitted with the sender's name and acked, in that order", async ($, on) => {
  const w = world(on);
  w.inbox = [msg("m1")];
  await $.session.start(start);
  await w.clock.settle();
  expect(mutations(w.log)).toEqual(["POST messages/m1/claim", "POST messages/m1/ack"]);
  expect(w.submitted).toEqual([
    "[Agentic OS message m1 from codex-1]\nhello m1\n\nReply with: aos message reply m1 --text-file <file>. Use aos help for coordination and file reservations.",
  ]);
  expect(w.headers[0]).toEqual({ "content-type": "application/json", origin: "http://localhost:4317", "x-aos-agent-id": "agent-1" });
});

test("the server's prompt is submitted as it comes", async ($, on) => {
  const w = world(on);
  w.inbox = [{ ...msg("m1"), prompt: "from the server: /abs/bin/aos message reply m1" }];
  await $.session.start(start);
  await w.clock.settle();
  expect(w.submitted).toEqual(["from the server: /abs/bin/aos message reply m1"]);
});

test("a 409 claim is skipped and the next message goes through", async ($, on) => {
  const w = world(on, { claims: { m1: 409 } });
  w.inbox = [msg("m1"), msg("m2")];
  await $.session.start(start);
  await w.clock.settle();
  expect(mutations(w.log)).toEqual(["POST messages/m1/claim", "POST messages/m2/claim", "POST messages/m2/ack"]);
  expect(w.submitted).toHaveLength(1);
});

test("a dropped submit is released with the reason and retried after turn.complete", async ($, on) => {
  const w = world(on, { drops: ["the prompt was removed from the queue before it ran"] });
  w.inbox = [msg("m1")];
  await $.session.start(start);
  await w.clock.settle();
  expect(mutations(w.log)).toEqual(["POST messages/m1/claim", "POST messages/m1/release"]);
  expect(w.bodies["messages/m1/release"]).toEqual({ reason: "the prompt was removed from the queue before it ran" });
  // Held: a new inbox read does not deliver until the turn ends.
  w.inbox = [msg("m1")];
  await w.clock.advance(25_000);
  expect(mutations(w.log)).toHaveLength(2);
  w.inbox = [msg("m1")];
  await $.turn.complete(complete);
  await w.clock.settle();
  expect(mutations(w.log).slice(2)).toEqual(["POST messages/m1/claim", "POST messages/m1/ack"]);
});

// A stub that throws is skipped, so the mod's call rejects: the same path as a host error.
test("a submit that rejects is released too", async ($, on) => {
  const w = world(on, { drops: ["throw"] });
  w.inbox = [msg("m1")];
  await $.session.start(start);
  await w.clock.settle();
  expect(w.bodies["messages/m1/release"]).toMatchObject({ reason: expect.stringContaining("submit failed:") });
});

test("the inbox keeps being read while a submit waits", async ($, on) => {
  // The submit stays pending, as it does behind a running turn, until the test lets it go.
  const w = world(on, { hold: true });
  w.inbox = [msg("m1")];
  await $.session.start(start);
  await w.clock.settle();
  const before = w.reads;
  expect(mutations(w.log)).toEqual(["POST messages/m1/claim"]);
  await w.clock.advance(25_000);
  await w.clock.advance(25_000);
  expect(w.reads).toBeGreaterThanOrEqual(before + 2);
  expect(mutations(w.log)).toEqual(["POST messages/m1/claim"]);
  w.pending[0]?.();
  await w.clock.settle();
  expect(mutations(w.log)).toEqual(["POST messages/m1/claim", "POST messages/m1/ack"]);
});
