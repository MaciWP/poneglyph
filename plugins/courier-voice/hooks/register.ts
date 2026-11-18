import type { EngineInterface, Register } from "claude-code";
import { namesOf, senderOf, voiceOf } from "./core.ts";

// Claude Code raises a row's UserMessage beneath the frame of the plugin that submitted it and runs
// none of that plugin's hooks there (re-entry), so courier cannot draw its own rows. This mod
// draws them: courier delivers, courier-voice gives the delivery its voice.

const CALL_MS = 8_000;
const RETRY_MS = 30_000;

type Aos = { origin: string; id: string };

let aos: Aos | undefined;
// Senders by agent id, for the box's title.
const names = new Map<string, string>();
// Ids looked up with an answer, named or not; a failed read is tried again after RETRY_MS.
const looked = new Set<string>();
// Ids asked for while a read is open: that read answers them too.
const wanted = new Set<string>();
let reading = false;
let retryAt = 0;

// AOS_URL and AOS_AGENT_ID are set by Agentic OS for the terminals it runs; only a loopback
// origin is taken, as courier, hud and workboard do.
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

// One read at a time; a row that names an unknown sender asks for it, and the chat redraws once
// the names land.
async function learnNames($: EngineInterface, ids: string[]) {
  ids.forEach((id) => wanted.add(id));
  if (!aos || reading) return;
  reading = true;
  try {
    if ((await $.clock.now()) < retryAt) return;
    const response = await Promise.race([
      $.http.fetch(`${aos.origin}/api/coordination`, { headers: { origin: aos.origin, "x-aos-agent-id": aos.id } }),
      $.clock.sleep(CALL_MS).then(() => null),
    ]);
    if (!response?.ok) throw new Error("names read failed");
    wanted.forEach((id) => looked.add(id));
    wanted.clear();
    let json: unknown;
    try {
      json = JSON.parse(response.text);
    } catch {
      json = undefined;
    }
    for (const [id, name] of namesOf(json)) names.set(id, name);
    $.ui.invalidate("ui.render");
  } catch {
    retryAt = (await $.clock.now()) + RETRY_MS;
  } finally {
    reading = false;
  }
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    aos = await findAos($);
    // Rows of a resumed transcript name their senders from the start; a headless run leaves it to
    // the rows it draws.
    if (e.isInteractive) void learnNames($, []).catch(() => {});
    return r;
  });

  // Courier's rows only (the engine's origin stamp, never a text prefix). `isExpanded` is true
  // for ctrl+o and also for a short body under the engine's speaker label: expanded, the box holds
  // the whole message; folded, one line with its start.
  on("ui.render", { component: "UserMessage" }, async ($, e, next) => {
    const p = e.props;
    const voice = voiceOf(p.origin as { kind: string; name?: string } | undefined, p.text, names);
    if (!voice) return next(e);
    const from = senderOf(p.text);
    if (from && from !== "user" && !names.has(from) && !looked.has(from)) void learnNames($, [from]).catch(() => {});
    const { Box, Text, Markdown } = $.ui.resolve(e);
    const title = Text({ weight: "semibold", color: "permission", wrap: "truncate-end", children: voice.title });
    // Expanded, the body is drawn as a reply draws markdown: its links open on a click. Folded, the
    // first line stays plain text, cut to one row.
    const body = (text: string) => (Markdown ? Markdown({ text }) : Text({ wrap: "wrap", children: text }));
    if (p.isExpanded)
      return Box({ flexDirection: "column", borderStyle: "round", borderColor: "permission", paddingX: 1, children: voice.body ? [title, body(voice.body)] : [title] });
    return Box({
      borderStyle: "round",
      borderColor: "permission",
      paddingX: 1,
      children: [title, Box({ flexShrink: 1, children: Text({ wrap: "truncate-end", children: voice.first ? ` · ${voice.first}` : "" }) })],
    });
  });
};
