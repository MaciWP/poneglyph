export type Task = {
  id: string;
  title: string;
  state: "pending" | "running" | "blocked" | "completed" | "failed";
  dependsOn?: string[];
  // A subtask names its feature; features have no parent (one level).
  parent?: string;
};
export type Agent = {
  id: string;
  title: string;
  state: string;
  type?: string;
  parentId?: string;
  teammateId?: string;
  name?: string;
  // How it ran, when known: the model it resolved to, the Agent call's effort, and the time
  // and tokens its turns reported (turn.complete with its agentId).
  model?: string;
  effort?: string;
  tokens?: number;
  durationMs?: number;
  // When it stopped running (finished, failed or vanished from the host's list).
  endedAt?: number;
};
// One communication this session took part in: a message, a reply, an agent launch or an
// Agentic OS consultation. `peer` is the other end's stable key (terminal id, SendMessage
// address or agent id); "?" when the host gives no sender. An "internal" link is a message
// between this session's main loop ("main") and its agents, or between two of them.
export type Link = {
  id: string;
  at: number;
  kind: "sent" | "received" | "spawned" | "consult" | "internal";
  peer: string;
  from?: string;
  to?: string;
  name?: string;
  harness?: string;
  text?: string;
  status?: string;
  // The origin kind a received message carried; `coordinator` marks the session that directs
  // this one (a team lead's mailbox, or a coordinating session's hand-off).
  via?: string;
  source: "native" | "aos";
};
export type Check = {
  id: string;
  title: string;
  state: string;
  at: number;
  source: string;
  revision?: string;
};
export type State = {
  version: 1;
  sessionId: string;
  cwd: string;
  ticket: string | null;
  tasks: Task[];
  agents: Agent[];
  checks: Check[];
  observed: string[];
  initial: string[];
  initialized: boolean;
  working: boolean;
  robin: { text: string; at: number } | null;
  failure: { text: string; at: number } | null;
  links: Link[];
  notice: string | null;
  turn: { at: number; ms: number | null; edits: number; commands: number } | null;
  // Skills this session loaded, newest last: whether it followed the prompt router.
  skills?: { name: string; at: number }[];
};
export const initialState = (sessionId: string, cwd: string): State => ({
  version: 1,
  sessionId,
  cwd,
  ticket: null,
  tasks: [],
  agents: [],
  checks: [],
  observed: [],
  initial: [],
  initialized: false,
  working: false,
  robin: null,
  failure: null,
  links: [],
  notice: null,
  turn: null,
});
export function text(value: unknown, max = 500): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)
  )
    throw Error("Invalid text");
  return value.trim();
}
export const identifier = (v: unknown) => {
  const s = text(v, 100);
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw Error("Invalid id");
  return s;
};
// Which lines sit outside code fences; a fence left open marks everything after it.
function prose(lines: string[]): boolean[] {
  let fence: string | null = null;
  return lines.map((line) => {
    const mark = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (mark) {
      if (!fence) fence = mark;
      else if (mark[0] === fence[0] && mark.length >= fence.length) fence = null;
      return false;
    }
    return !fence;
  });
}
export function extractRobin(value: string): { text: string; body: string } | null {
  const lines = value.trimEnd().split("\n");
  const open = prose(lines);
  let candidate = -1;
  for (let i = 0; i < lines.length; i++)
    if (open[i] && /^(?:\*\*)?ROBIN:(?:\*\*)?\s+\S/.test(lines[i]!)) candidate = i;
  if (candidate !== lines.length - 1 || !open[candidate]) return null;
  return {
    text: lines[candidate]!.replace(/^(?:\*\*)?ROBIN:(?:\*\*)?\s+/, ""),
    body: lines.slice(0, candidate).join("\n").trimEnd(),
  };
}
// A check runs a test, type or lint tool as a command (`bun test`, `npm run lint`,
// `.venv/bin/pytest`), never a word inside another one (`grep test`, `git diff --check`).
// A bare `test` is the shell builtin, so it counts only after a runner.
const RUNNER = String.raw`(?:bunx?|npx|pnpm|yarn|npm|uv|poetry|python3?\s+-m|cargo|go|make|claude\s+plugin)\s+(?:run\s+)?`;
const TOOL = String.raw`(?:pytest|vitest|jest|tsc|eslint|ruff|mypy|biome|playwright|lint|check|typecheck|coverage)`;
const CHECK = new RegExp(
  String.raw`(?:^|[;&|(]\s*)(?:[A-Za-z_]\w*=\S*\s+)*(?:${RUNNER}(?:\S*\/)?(?:tests?|${TOOL})|(?:\S*\/)?${TOOL})(?=[\s:;&|)]|$)`,
);
// Whether a command runs a check, and whether its exit status is the check's own: a pipe
// (without pipefail), `||`, `;` or `&` after the check hands the status to another command.
export function checkExit(command: string): "own" | "hidden" | null {
  const m = CHECK.exec(command);
  if (!m) return null;
  const rest = command.slice(m.index + m[0].length).replace(/\d*>&\d*-?/g, "");
  const hidden =
    /\|\||;|(?:^|[^&])&(?!&)/.test(rest) || (/\|/.test(rest) && !/pipefail/.test(command));
  return hidden ? "hidden" : "own";
}
export function extractNotice(value: string): string | null {
  const lines = value.trimEnd().split("\n");
  const open = prose(lines);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = /^(?:\*\*)?Aviso:(?:\*\*)?\s+(\S.*)$/.exec(lines[i]!);
    if (open[i] && m) return m[1]!.slice(0, 500);
  }
  return null;
}
export function publish(state: State, raw: unknown): State {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Expected update object");
  const input = raw as Record<string, unknown>;
  const next = { ...state };
  if (input.ticket !== undefined) {
    if (
      input.ticket !== null &&
      (typeof input.ticket !== "string" || !/^[A-Z][A-Z0-9_]*-\d+$/.test(input.ticket))
    )
      throw Error("Invalid ticket");
    next.ticket = input.ticket as string | null;
  }
  if (input.replace !== undefined && typeof input.replace !== "boolean")
    throw Error("Invalid replace");
  if (input.tasks !== undefined || input.replace === true) {
    const incoming = input.tasks ?? [];
    if (!Array.isArray(incoming) || incoming.length > 100) throw Error("At most 100 tasks");
    // Tasks merge by id, so an update sends only what changed; replace starts a new plan.
    const base = input.replace === true ? [] : state.tasks;
    const seen = new Set<string>();
    next.tasks = [...base];
    for (const t of incoming as Record<string, unknown>[]) {
      const id = identifier(t.id);
      if (seen.has(id)) throw Error("Duplicate task id");
      seen.add(id);
      const old = base.find((x) => x.id === id);
      if (!old && t.title === undefined) throw Error(`New task ${id} needs a title`);
      if (!old && t.state === undefined) throw Error(`New task ${id} needs a state`);
      const status = t.state === undefined ? old!.state : text(t.state, 20);
      if (!["pending", "running", "blocked", "completed", "failed"].includes(status))
        throw Error("Invalid task state");
      const deps = t.dependsOn === undefined ? (old?.dependsOn ?? []) : t.dependsOn;
      if (!Array.isArray(deps) || deps.length > 100) throw Error("Invalid task dependencies");
      const parent = t.parent === undefined ? old?.parent : identifier(t.parent);
      const task: Task = {
        id,
        title: t.title === undefined ? old!.title : text(t.title),
        state: status as Task["state"],
        dependsOn: deps.map(identifier),
        ...(parent === undefined ? {} : { parent }),
      };
      next.tasks = old ? next.tasks.map((x) => (x.id === id ? task : x)) : [...next.tasks, task];
    }
    if (next.tasks.length > 100) throw Error("At most 100 tasks");
    for (const t of next.tasks) {
      if (t.parent === undefined) continue;
      const parent = next.tasks.find((x) => x.id === t.parent);
      if (!parent || parent.id === t.id) throw Error("Unknown parent task");
      if (parent.parent !== undefined) throw Error("Subtasks cannot have subtasks");
    }
    const visited = new Set<string>();
    const visit = (id: string, path: Set<string>) => {
      if (visited.has(id)) return;
      if (path.has(id)) throw Error("Cyclic task dependencies");
      const t = next.tasks.find((t) => t.id === id);
      if (!t) throw Error("Unknown task dependency");
      for (const d of t.dependsOn ?? []) visit(d, new Set([...path, id]));
      visited.add(id);
    };
    for (const t of next.tasks) visit(t.id, new Set());
  }
  // Questions to the user go through the host's native dialog, never through the board.
  if (input.decisions !== undefined)
    throw Error("Decisions were removed: ask the user with AskUserQuestion");
  return next;
}
// What a plan update tells someone away from the terminal: a task failed or got blocked, or the
// whole plan finished. Only changes count, so resending a state raises nothing.
export function planAlerts(previous: Task[], next: Task[]): string[] {
  const alerts: string[] = [];
  for (const t of next) {
    if (t.state !== "failed" && t.state !== "blocked") continue;
    if (previous.find((p) => p.id === t.id)?.state === t.state) continue;
    alerts.push(`Tarea ${t.state === "failed" ? "fallida" : "bloqueada"}: ${t.title}`);
  }
  const done = (tasks: Task[]) => tasks.length > 0 && tasks.every((t) => t.state === "completed");
  if (done(next) && !done(previous))
    alerts.push(`Plan completado: ${next.length} ${next.length === 1 ? "tarea" : "tareas"}`);
  return alerts;
}
const stopped = (state: string) => ["completed", "failed", "killed", "unknown"].includes(state);
export function reconcileAgents(
  previous: Agent[],
  current: {
    id: string;
    description: string;
    status: string;
    type?: string;
    parentId?: string;
    teammateId?: string;
    name?: string;
  }[],
  now = Date.now(),
): Agent[] {
  const before = new Map(previous.map((a) => [a.id, a]));
  // The first refresh that sees an agent stopped dates it; later ones keep that date.
  const ended = (a: Agent): Agent =>
    stopped(a.state) ? { ...a, endedAt: before.get(a.id)?.endedAt ?? now } : a;
  const byId = new Map<string, Agent>(
    current.map((a) => [
      a.id,
      ended({
        ...agentMeta(before.get(a.id)),
        id: a.id,
        title: a.description,
        state: a.status,
        ...(a.type ? { type: a.type } : {}),
        ...(a.parentId ? { parentId: a.parentId } : {}),
        ...(a.teammateId ? { teammateId: a.teammateId } : {}),
        ...(a.name ? { name: a.name } : {}),
      }),
    ]),
  );
  for (const a of previous)
    if (!byId.has(a.id))
      byId.set(
        a.id,
        ended({
          ...a,
          state: ["completed", "failed", "killed"].includes(a.state) ? a.state : "unknown",
        }),
      );
  return [...byId.values()].slice(-100);
}
const META = ["model", "effort", "tokens", "durationMs"] as const;
const agentMeta = (a?: Agent): Partial<Agent> =>
  Object.fromEntries(META.filter((k) => a?.[k] !== undefined).map((k) => [k, a![k]]));
// Merges what a spawn or an Agent result says about one agent. One the host has not listed
// yet is added as running; the next reconcile keeps the merged fields.
export function annotateAgent(
  agents: Agent[],
  id: string,
  patch: Partial<Omit<Agent, "id">>,
): Agent[] {
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  return agents.some((a) => a.id === id)
    ? agents.map((a) => (a.id === id ? { ...a, ...defined } : a))
    : [...agents, { title: "agente", state: "running", ...defined, id }].slice(-100);
}
// Agents still running, or stopped within the last 30 minutes: who this session leads now.
export const recentAgents = (agents: Agent[], now = Date.now()) =>
  agents.filter(
    (a) => !stopped(a.state) || (a.endedAt !== undefined && now - a.endedAt < 30 * 60000),
  );
// What Agentic OS's /session accepts (shared/workboard.ts in agentic-os): only its known
// fields, so local-only state (links, observed paths) never counts against its 64 KB body cap.
export const bridgeSession = (s: State) => ({
  version: s.version,
  sessionId: s.sessionId,
  cwd: s.cwd,
  ticket: s.ticket,
  tasks: s.tasks.map(({ id, title, state, dependsOn }) => ({ id, title, state, dependsOn })),
  // Agentic OS still requires the array; decisions now live in the native dialog.
  decisions: [],
  checks: s.checks,
  agents: s.agents.map(({ id, title, state }) => ({ id, title, state })),
  working: s.working,
  robin: s.robin,
  failure: s.failure,
});
export const viewStatus = (s: State) =>
  s.failure && (!s.robin || s.failure.at >= s.robin.at)
    ? s.failure.text
    : (s.robin?.text ?? (s.working ? "Trabajo en curso" : "Esperando trabajo"));

// A native message from another session arrives wrapped by the host (measured on 2.1.292):
// <cross-session-message from="uds:…" from-name="agentic-os-70" …>body</cross-session-message>
export function parseEnvelope(value: string): { name?: string; from?: string; body: string } {
  const m =
    /^\s*<cross-session-message\b([^>]*)>\n?([\s\S]*?)(?:<\/cross-session-message>\s*)?$/.exec(
      value,
    );
  if (!m) return { body: value };
  const attr = (key: string) => new RegExp(`\\b${key}="([^"]*)"`).exec(m[1]!)?.[1] || undefined;
  return { name: attr("from-name"), from: attr("from"), body: m[2]!.trim() };
}
// Upsert by id (a later status wins), newest last, bounded.
export function addLinks(previous: Link[], events: Link[]): Link[] {
  const byId = new Map(previous.map((l) => [l.id, l]));
  for (const e of events) byId.set(e.id, { ...byId.get(e.id), ...e });
  return [...byId.values()].sort((a, b) => a.at - b.at).slice(-50);
}
export type Peer = {
  key: string;
  name?: string;
  harness?: string;
  sent: number;
  received: number;
  last: number;
  status: "ok" | "waiting" | "failed";
};
export type Collaboration =
  | { kind: "solo" }
  | { kind: "lead"; count: number }
  | { kind: "pair"; peer: Peer }
  | { kind: "group"; sessions: number }
  | { kind: "worker"; lead: Peer };
// Origin kinds of a message from whoever directs this session.
export const DIRECTS = ["coordinator", "projects-relay"];
// The sessions this one exchanged messages with, split by rank, and how it collaborates.
// A sender whose message came as a coordinator's hand-off directs this session (`leads`); a
// teammate this session leads is one of its agents, never a peer. Everyone else is a peer.
// `peersTalk` says whether two of those peers also message each other (Agentic OS sees that;
// this session does not).
export function collaboration(
  agents: Agent[],
  links: Link[],
  peersTalk: boolean,
): { mode: Collaboration; peers: Peer[]; leads: Peer[] } {
  const team = new Set(
    agents
      .filter((a) => a.teammateId)
      .flatMap((a) => [a.teammateId!, a.teammateId!.split("@")[0]!, a.name ?? ""])
      .filter(Boolean),
  );
  const byKey = new Map<string, Peer>();
  const directs = new Set<string>();
  for (const l of links) {
    if ((l.kind !== "sent" && l.kind !== "received") || team.has(l.peer)) continue;
    if (l.kind === "received" && DIRECTS.includes(l.via ?? "")) directs.add(l.peer);
    const p = byKey.get(l.peer) ?? {
      key: l.peer,
      sent: 0,
      received: 0,
      last: 0,
      status: "ok" as Peer["status"],
    };
    p.name = l.name ?? p.name;
    p.harness = l.harness ?? p.harness;
    if (l.kind === "sent") p.sent++;
    else p.received++;
    p.last = Math.max(p.last, l.at);
    if (l.status === "failed") p.status = "failed";
    else if (["pending", "delivering", "uncertain"].includes(l.status ?? "") && p.status === "ok")
      p.status = "waiting";
    byKey.set(l.peer, p);
  }
  const all = [...byKey.values()].sort((a, b) => b.last - a.last);
  const leads = all.filter((p) => directs.has(p.key));
  const peers = all.filter((p) => !directs.has(p.key));
  const charge =
    agents.length + new Set(links.filter((l) => l.kind === "consult").map((l) => l.peer)).size;
  const mode: Collaboration = leads.length
    ? { kind: "worker", lead: leads[0]! }
    : peers.length >= 2 || (peers.length === 1 && peersTalk)
      ? { kind: "group", sessions: peers.length + 1 }
      : peers.length === 1
        ? { kind: "pair", peer: peers[0]! }
        : charge
          ? { kind: "lead", count: charge }
          : { kind: "solo" };
  return { mode, peers, leads };
}
