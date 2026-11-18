// Pure: what courier's box says for one of the rows it delivered. No engine calls, so bun tests it.

export type Origin = { kind: string; name?: string };
export type Voice = { title: string; first: string; body: string };

// `deliveryText` in Agentic OS (server/features/coordination/messages.ts) and this mod's own
// `prompt()`: a header naming the message and its sender, the text, then how to reply.
const HEAD = /^\[Agentic OS message (\S+) from (\S+)\]\n?/;
const TAIL = /\n+(?:Reply only if the message asks for one|Reply with): [^\n]*$/;
const FRAME = /^The courier plugin sent a message:\s*/;

// Each responsible mod draws its own voice: courier only the rows it submitted. The origin is the
// engine's stamp, never a text prefix, so another sender cannot borrow this box.
export function voiceOf(origin: Origin | undefined, text: string, names: ReadonlyMap<string, string> = new Map()): Voice | null {
  if (origin?.kind !== "plugin" || origin.name !== "courier") return null;
  const raw = text.replace(FRAME, "").trim();
  const head = HEAD.exec(raw);
  const body = head ? raw.slice(head[0].length).replace(TAIL, "").trim() : raw;
  const from = head?.[2];
  const sender = !from ? null : (names.get(from) ?? (from === "user" ? "tú" : from.slice(0, 8)));
  return {
    title: sender ? `Agentic OS · ${sender}` : "Agentic OS",
    first: body.split("\n").find((l) => l.trim())?.trim() ?? "",
    body,
  };
}

// The agent id a delivered row's header names, so an unknown sender can be looked up.
export function senderOf(text: string): string | undefined {
  return HEAD.exec(text.replace(FRAME, "").trim())?.[2];
}

// `GET /api/coordination`'s agents, as id → name, for the senders a header names by id.
export function namesOf(json: unknown): Map<string, string> {
  const agents = (json as { agents?: unknown } | null)?.agents;
  const names = new Map<string, string>();
  if (!Array.isArray(agents)) return names;
  for (const a of agents) if (typeof a?.id === "string" && typeof a.name === "string" && a.name.trim()) names.set(a.id, a.name.replace(/[\u0000-\u001f\u007f]/g, "").trim());
  return names;
}
