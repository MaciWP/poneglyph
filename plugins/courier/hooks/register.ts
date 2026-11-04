import type { EngineInterface, Register } from "claude-code";

// The server stops pasting into a session for 60 s after each inbox read, so it is read at least
// this often, even while a delivery waits for the session to be idle.
const WAIT_MS = 25_000;
const RACE_MS = 28_000;
const CALL_MS = 8_000;
const BACKOFF_MS = 30_000;

type Aos = { origin: string; id: string };
type Message = { id: string; from: string; text: string; prompt?: unknown };

// One loop per process; /clear and a resume keep the process, so they need no restart.
let started = false;
let aos: Aos | undefined;
let delivering = false;
// A dropped or failed submit holds delivery until the next turn.complete.
let held = false;

// AOS_URL and AOS_AGENT_ID are set by Agentic OS for the terminals it runs; only a loopback
// origin is taken, as hud and workboard do.
async function findAos($: EngineInterface): Promise<Aos | undefined> {
  const [url, id] = [await $.env.get("AOS_URL"), await $.env.get("AOS_AGENT_ID")];
  if (!url || !id) return undefined;
  try {
    const u = new URL(url);
    const loopback = ["127.0.0.1", "localhost", "agentic-os.localhost", "[::1]"].includes(u.hostname);
    if (u.protocol !== "http:" || !loopback || u.username || u.password || u.pathname !== "/" || u.search || u.hash) return undefined;
    return { origin: u.origin, id };
  } catch {
    return undefined;
  }
}

// The host's fetch takes no AbortSignal and caps a call at 30 s, so the wait is raced against a timer.
async function call($: EngineInterface, target: Aos, path: string, body?: object, limitMs = CALL_MS) {
  const response = await Promise.race([
    $.http.fetch(`${target.origin}/api/coordination/${path}`, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", origin: target.origin, "x-aos-agent-id": target.id },
      body: body ? JSON.stringify(body) : undefined,
    }),
    $.clock.sleep(limitMs).then(() => null),
  ]);
  if (!response) throw new Error(`Agentic OS: ${path} timed out`);
  return response;
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function messagesOf(text: string): Message[] {
  const list = (parse(text) as { messages?: unknown } | undefined)?.messages;
  if (!Array.isArray(list)) return [];
  return list.filter((m): m is Message => typeof m?.id === "string" && typeof m.from === "string" && typeof m.text === "string");
}

// The server's own text names aos by its absolute path (a harness may replace the PATH); an
// older server sends none.
const prompt = (m: Message) =>
  typeof m.prompt === "string" ? m.prompt : `[Agentic OS message ${m.id} from ${m.from}]\n${m.text}\n\nReply with: aos message reply ${m.id} --text-file <file>. Use aos help for coordination and file reservations.`;

// Oldest first, one at a time. A message is claimed, submitted and acked once its turn started; a
// submit that dropped or threw hands it back and holds the rest until the next turn.complete.
async function deliver($: EngineInterface, target: Aos, messages: Message[]) {
  delivering = true;
  try {
    for (const m of messages) {
      const id = encodeURIComponent(m.id);
      const claim = await call($, target, `messages/${id}/claim`, {});
      if (!claim.ok) continue; // taken (409) or not ours (403)
      let reason: string;
      try {
        reason = (await $.prompt.submit({ text: prompt(m) }))?.drop ?? "";
      } catch (error) {
        reason = `submit failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      if (!reason) {
        await call($, target, `messages/${id}/ack`, {}).catch(() => {});
        continue;
      }
      await call($, target, `messages/${id}/release`, { reason: reason.slice(0, 500) }).catch(() => {});
      held = true;
      return;
    }
  } catch {
    // Agentic OS went away mid-delivery: a claim left unconfirmed turns uncertain when the
    // session ends, and is never sent again.
  } finally {
    delivering = false;
  }
}

// Reading the inbox is also the heartbeat, so it runs whether or not a delivery is waiting.
async function pump($: EngineInterface, target: Aos) {
  const inbox = await call($, target, "inbox");
  if (!inbox.ok) throw new Error(`Agentic OS: inbox ${inbox.status}`);
  const messages = messagesOf(inbox.text);
  if (messages.length && !delivering && !held) void deliver($, target, messages);
}

async function loop($: EngineInterface, target: Aos) {
  let revision = 0;
  for (;;) {
    try {
      const woke = await call($, target, "wait", { after: revision, timeoutMs: WAIT_MS }, RACE_MS).catch(() => null);
      const next = (parse(woke?.text ?? "") as { revision?: unknown } | undefined)?.revision;
      if (typeof next === "number") revision = next;
      await pump($, target);
    } catch {
      await $.clock.sleep(BACKOFF_MS);
    }
  }
}

async function activate($: EngineInterface) {
  if (started) return;
  aos = await findAos($);
  if (!aos) return;
  started = true;
  void loop($, aos);
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    if (e.isInteractive) await activate($);
    return r;
  });

  on("session.attach", { surface: "desktop" }, async ($, e, next) => {
    const r = await next(e);
    await activate($);
    return r;
  });

  // The retry the docs ask for after a dropped call: the turn that ended may be the user's.
  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId || !held || !aos) return r;
    held = false;
    void pump($, aos).catch(() => {});
    return r;
  });
};
