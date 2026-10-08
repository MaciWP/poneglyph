import type { EngineInterface, Register } from "claude-code";
import {
  addLinks,
  answer,
  askFromChat,
  bridgeSession,
  collaboration,
  extractAsk,
  extractNotice,
  extractRobin,
  initialState,
  parseEnvelope,
  publish,
  reconcileAgents,
  annotateAgent,
  recentAgents,
  settle,
  viewStatus,
  type Decision,
  type Link,
  type State,
  type Task,
} from "./core.ts";
import {
  diffView,
  paneView,
  type PaneAgents,
  type PaneDecision,
  type PaneFeature,
  type Tone,
} from "./view.ts";

const PANE = "workboard";
const TOOL = "mcp__workboard__progress";
const clean = (v: unknown, max = 500) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
    .slice(0, max);
const percent = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(1)}%` : "sin datos";
const tail = (path: string) => path.split("/").filter(Boolean).slice(-2).join("/");
// A provider error keeps its cause visible in the band, never an empty-looking "no data".
const github = (pr: Repo["pr"]) =>
  pr?.state === "loaded"
    ? `PR #${pr.number}: ${pr.approval}${pr.appliesToLocal ? "" : " (revisión publicada)"}`
    : pr?.state === "none"
      ? "sin PR"
      : pr?.state === "error"
        ? /no git remotes/i.test(pr.error ?? "")
          ? "GitHub: sin remoto"
          : /auth|log ?in|credential/i.test(pr.error ?? "")
            ? "GitHub: sin sesión en gh"
            : "GitHub: error"
        : "GitHub sin datos";
const clockTime = (at: number) =>
  new Date(at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
const coverage = (c: Repo["coverage"]) => {
  const label =
    c?.state === "unverified" && typeof c.reportAt === "number"
      ? `informe externo · ${clockTime(c.reportAt)}${c.changedAfter ? ` · ${c.changedAfter} ficheros cambiados después` : ""}`
      : (labels[c?.state ?? "missing"] ?? "");
  const value = c?.coverage?.percent;
  const known = c?.coverage?.knownPercent;
  if (typeof value === "number" && Number.isFinite(value)) return `${percent(value)} ${label}`;
  return typeof known === "number" && Number.isFinite(known)
    ? `${percent(known)} de lo medido · ${c?.coverage?.missing.length ?? 0} sin medir · ${label}`
    : label;
};
const labels: Record<string, string> = {
  pending: "pendiente",
  running: "en curso",
  working: "trabajando",
  blocked: "bloqueada",
  completed: "terminada",
  failed: "fallida",
  unknown: "sin señal",
  killed: "cancelado",
  needs_you: "te necesita",
  queued: "respuesta pendiente de entrega",
  delivered: "respuesta entregada",
  cancelled: "cancelada",
  stale: "desactualizada",
  current: "vigente",
  missing: "sin datos",
  unverified: "revisión no verificada",
  partial: "informe parcial",
  error: "error",
};
type Repo = {
  cwd: string;
  location: string | null;
  error?: string;
  branch?: string;
  head?: string;
  base?: string;
  dirty?: boolean;
  fingerprint?: string;
  baseError?: string;
  files: { path: string; lines: number[]; staged: boolean; unstaged: boolean; kind: string }[];
  pr?: {
    state: string;
    number?: number;
    url?: string;
    approval?: string;
    head?: string;
    appliesToLocal?: boolean;
    error?: string;
    checks?: { name: string; state: string; url?: string }[];
  };
  coverage?: {
    state: string;
    detail?: string;
    run?: { exitCode?: number; state?: string; endedAt?: number };
    coverage?: {
      percent: number | null;
      files: { path: string; percent: number | null; filePercent: number | null }[];
      missing: string[];
      knownPercent?: number | null;
    };
    baseline?: { path: string; percent: number | null }[];
    reportAt?: number;
    changedAfter?: number;
  };
  canRecalculate?: boolean;
};
type Snapshot = {
  version: 1;
  cwd: string;
  ticket: string | null;
  at: number;
  repos: Repo[];
  allRepos: { cwd: string; location: string | null }[];
  bridge: {
    state: string;
    error?: string;
    errors?: string[];
    sessions: {
      id: string;
      sessionId: string | null;
      title: string;
      state: string;
      cwd: string;
      harness: string;
    }[];
    published: (State & { updatedAt: number; decisions: (Decision & { requestId?: string })[] })[];
    // This terminal's Agentic OS messages and consultations, already filtered by its actor.
    links?: Link[];
    peersTalk?: boolean;
    // Native session name → its Agentic OS terminal, so one partner is one peer.
    aliases?: Record<string, { id: string; harness?: string; name?: string }>;
  };
};

let state = initialState("pending", "");
let active = false,
  paneHealthy = false,
  paneFaulted = false,
  history = false,
  bandExpanded = false,
  refreshing = false;
let diff: { path: string; source: string; truncated: boolean } | null = null;
let snapshot: Snapshot | null = null;
let error: string | null = null;
let aos = "http://127.0.0.1:4317",
  actor: string | undefined;
let peersTalk = false;
// Whether this mod has the pane open: the band's button reads it as «Cerrar panel».
let paneOpen = false;
// Internal messages an agent sent to an address no agent holds, waiting for main's copy.
let unplaced: { id: string; text: string; at: number }[] = [];
let saved: Promise<unknown> = Promise.resolve();
const drafts = new Map<string, string>();
const delivering = new Set<string>();
const launching = new Set<string>();
const redraw = ($: EngineInterface) => $.ui.invalidate("ui.render");
const save = ($: EngineInterface) => {
  const copy = JSON.parse(JSON.stringify(state));
  saved = saved.catch(() => undefined).then(() => $.store.set(`session:${copy.sessionId}`, copy));
  return saved;
};
const fail = ($: EngineInterface, err: unknown) => {
  error = clean(err instanceof Error ? err.message : err, 1000);
  redraw($);
};
const api = async ($: EngineInterface, path: string, body: unknown) => {
  const response = await $.http.fetch(`${aos}/api/workboard${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: aos,
      ...(actor ? { "x-aos-agent-id": actor } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw Error(`Agentic OS: ${response.status} ${clean(response.text, 200)}`);
};
const helper = async ($: EngineInterface, command: string, extra: string[] = []) => {
  const result = await $.process.run(
    ["node", `${$.plugin.root}/scripts/workboard.mjs`, command, "--cwd", state.cwd, ...extra],
    { timeoutMs: 60000 },
  );
  if (result.exitCode) throw Error(result.stderr.trim() || `Workboard: exit ${result.exitCode}`);
  return JSON.parse(result.stdout);
};
const persist = async ($: EngineInterface) => {
  await save($);
  redraw($);
};
const deliver = ($: EngineInterface, decision: Decision & { requestId?: string }) => {
  const key = `${decision.id}:${decision.revision}`;
  if (state.working || delivering.has(key) || !decision.response) return;
  delivering.add(key);
  const message = `Workboard decision ${decision.id} revision ${decision.revision}. The user answered in the panel.\nQuestion: ${decision.question}\nAnswer: ${decision.response}\nApply only to this decision; this is not blanket permission for tools, agents or Git operations.`;
  // Do not await inside a running turn: prompt.submit waits for the session to be idle.
  void $.prompt
    .submit({ text: message })
    .then(async (result) => {
      const delivered = !("drop" in result && result.drop);
      state = settle(
        state,
        decision.id,
        decision.revision,
        delivered,
        delivered ? undefined : "El host rechazó la respuesta",
      );
      await persist($);
      if (decision.requestId && actor)
        await api($, "/ack", {
          sessionId: state.sessionId,
          decisionId: decision.id,
          revision: decision.revision,
          requestId: decision.requestId,
          delivered,
        });
    })
    .catch(async (err) => {
      state = settle(state, decision.id, decision.revision, false, clean(err));
      await persist($);
      fail($, err);
    })
    .finally(() => delivering.delete(key));
};
// The panel answers only this session's decisions; other sessions answer in their own panel.
const respond = async ($: EngineInterface, decision: Decision, response: string) => {
  try {
    state = answer(state, decision.id, decision.revision, response);
    await persist($);
    deliver(
      $,
      state.decisions.find((d) => d.id === decision.id)!,
    );
  } catch (err) {
    fail($, err);
  }
};
// True once the snapshot is in, false when it failed, undefined when another refresh runs.
const refresh = async ($: EngineInterface): Promise<boolean | undefined> => {
  if (!active || refreshing) return undefined;
  refreshing = true;
  try {
    const next = (await helper($, "snapshot", [
      "--aos",
      aos,
      ...(state.ticket ? ["--ticket", state.ticket] : []),
    ])) as Snapshot;
    if (
      next.version !== 1 ||
      !Array.isArray(next.repos) ||
      !next.bridge ||
      !Array.isArray(next.bridge.published)
    )
      throw Error("Invalid workboard snapshot");
    snapshot = next;
    error = null;
    if (!state.ticket && next.ticket) state.ticket = next.ticket;
    if (!state.initialized) {
      state.initial = next.repos.find((r) => r.cwd === state.cwd)?.files.map((f) => f.path) ?? [];
      state.initialized = true;
    }
    state.agents = reconcileAgents(state.agents, await $.agent.list());
    state.links = addLinks(state.links, next.bridge.links ?? []);
    peersTalk = next.bridge.peersTalk === true;
    const remote = next.bridge.published.find((s) => s.sessionId === state.sessionId);
    if (remote)
      for (const d of remote.decisions) {
        const own = state.decisions.find((x) => x.id === d.id);
        if (
          own?.revision === d.revision &&
          own.state === "failed" &&
          own.error?.startsWith("Entrega incierta") &&
          d.state === "queued" &&
          d.requestId &&
          actor
        )
          await api($, "/ack", {
            sessionId: state.sessionId,
            decisionId: d.id,
            revision: d.revision,
            requestId: d.requestId,
            delivered: false,
            error: own.error,
          });
        if (
          own?.revision === d.revision &&
          d.state === "queued" &&
          ["pending", "queued"].includes(own.state)
        ) {
          state = {
            ...state,
            decisions: state.decisions.map((x) => (x.id === d.id ? { ...d } : x)),
          };
          deliver($, d);
        }
      }
    for (const d of state.decisions) if (d.state === "queued") deliver($, d);
    if (next.bridge.state === "connected" && actor) await api($, "/session", bridgeSession(state));
    await persist($);
    return true;
  } catch (err) {
    fail($, err);
    return false;
  } finally {
    refreshing = false;
    redraw($);
  }
};
const openPane = async ($: EngineInterface) => {
  await $.ui.open({ id: PANE, title: "Trabajo y agentes", columns: 48, rows: 12 });
  paneOpen = true;
  redraw($);
};
const togglePane = async ($: EngineInterface) => {
  if ((await $.ui.panes()).some((p) => p.id === PANE && p.isShown)) {
    paneHealthy = false;
    paneOpen = false;
    await $.ui.close({ id: PANE });
    redraw($);
  } else await openPane($);
};
const inspectFile = async ($: EngineInterface, repo: Repo, path: string) => {
  try {
    const result = await $.process.run(
      [
        "node",
        `${$.plugin.root}/scripts/workboard.mjs`,
        "diff",
        "--cwd",
        repo.cwd,
        "--file",
        path,
        ...(repo.base ? ["--base", repo.base] : []),
      ],
      { timeoutMs: 30000 },
    );
    if (result.exitCode) throw Error(result.stderr);
    diff = JSON.parse(result.stdout);
    await openPane($);
  } catch (err) {
    fail($, err);
  }
};
const recalculate = async ($: EngineInterface, repo: Repo) => {
  if (launching.has(repo.cwd)) return;
  launching.add(repo.cwd);
  redraw($);
  try {
    const r = await $.process.run(
      [
        "node",
        `${$.plugin.root}/scripts/workboard.mjs`,
        "launch",
        "--cwd",
        repo.cwd,
        ...(snapshot?.bridge.state === "connected" && repo.location
          ? ["--aos", aos, "--location", repo.location]
          : []),
      ],
      { timeoutMs: 15000 },
    );
    if (r.exitCode) throw Error(r.stderr);
    $.ui.toast("Cobertura en otra terminal; el resultado aparecerá al terminar");
    $.clock.after(3000, () => {
      launching.delete(repo.cwd);
      void refresh($);
    });
  } catch (err) {
    launching.delete(repo.cwd);
    fail($, err);
  }
};

const ago = (at: number) => {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  return s < 60
    ? `hace ${s} s`
    : s < 3600
      ? `hace ${Math.round(s / 60)} min`
      : `hace ${Math.round(s / 3600)} h`;
};
const duration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
};
const turnDetail = (s: State) =>
  s.turn
    ? `${s.turn.ms === null ? "Turno en curso" : `Turno de ${duration(s.turn.ms)}`} · ${s.turn.edits} ${s.turn.edits === 1 ? "edición" : "ediciones"} · ${s.turn.commands} ${s.turn.commands === 1 ? "comando" : "comandos"}`
    : null;
// Features are tasks without parent; their progress counts their subtasks.
const planModel = (tasks: Task[]) => {
  const view = (t: Task) => ({
    title: clean(t.title),
    state: t.state,
    label: labels[t.state] ?? t.state,
  });
  const features: PaneFeature[] = tasks
    .filter((t) => t.parent === undefined)
    .map((f) => {
      const subtasks = tasks.filter((t) => t.parent === f.id);
      return {
        ...view(f),
        done: subtasks.filter((t) => t.state === "completed").length,
        total: subtasks.length,
        subtasks: subtasks.map(view),
      };
    })
    // A finished task without subtasks moves to the history.
    .filter((f) => f.total > 0 || f.state !== "completed");
  const leaves = tasks.filter((t) => !tasks.some((x) => x.parent === t.id));
  return {
    done: leaves.filter((t) => t.state === "completed").length,
    total: leaves.length,
    features,
  };
};
const linkStatus: Record<string, string> = {
  delivered: "entregado",
  delivering: "entregando",
  pending: "pendiente",
  uncertain: "incierto",
  answered: "respondido",
  failed: "falló",
};
const linkTone = (status?: string): Tone =>
  status === "failed"
    ? "fail"
    : ["pending", "delivering", "uncertain"].includes(status ?? "")
      ? "warn"
      : "muted";
const peerName = (l: { peer: string; name?: string; harness?: string }) =>
  l.peer === "?"
    ? "otra sesión"
    : `${l.harness ? `${l.harness} · ` : ""}${clean(l.name || l.peer.slice(0, 8), 80)}`;
const finished = (s: string) => ["completed", "failed", "killed", "exited"].includes(s);
// "claude-haiku-5-5" → "haiku 5.5"; an alias stays as it is.
const shortModel = (m: string) =>
  m.replace(/^claude-/, "").replace(/-(\d+)-(\d+)(?:-\d{8})?$/, " $1.$2").replace(/-(\d+)$/, " $1");
const tokens = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K tok` : `${n} tok`);
const runTime = (ms: number) =>
  ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60000)} min`;
// Only sessions linked to this one: its agents, its consultations and whom it messages.
const agentsModel = (
  s: State,
  talk: boolean,
  aliases: NonNullable<Snapshot["bridge"]["aliases"]> = {},
): PaneAgents => {
  const agents = recentAgents(s.agents);
  // A native name that Agentic OS knows as a terminal becomes that terminal, and every link
  // to it carries one label: the terminal's title, else the session's native name.
  const terminal = new Map<string, { harness?: string; name: string }>();
  for (const [native, a] of Object.entries(aliases))
    terminal.set(a.id, { harness: a.harness, name: a.name ?? native });
  const links = s.links.map((l) => {
    const id = Object.hasOwn(aliases, l.peer) ? aliases[l.peer]!.id : l.peer;
    const t = terminal.get(id);
    return t ? { ...l, peer: id, harness: t.harness ?? l.harness, name: t.name } : l;
  });
  const { mode, peers } = collaboration(agents, links, talk);
  const depth = (a: { parentId?: string }, n = 0): number => {
    const parent = a.parentId && s.agents.find((x) => x.id === a.parentId);
    return parent && n < 3 ? depth(parent, n + 1) : n;
  };
  const consults = new Map<string, Link>();
  for (const l of s.links) if (l.kind === "consult") consults.set(l.peer, l);
  // Internal messages, oldest first: an agent waits when its latest one went to main and main
  // has not written back since.
  const internal = s.links.filter((l) => l.kind === "internal").sort((a, b) => a.at - b.at);
  const agentName = (id?: string) => {
    if (!id || id === "main") return "principal";
    const a = s.agents.find((x) => x.id === id);
    return clean(a?.name || a?.type || a?.title || id.slice(0, 8), 40);
  };
  const charge = [
    ...[...agents]
      .sort((a, b) => Number(finished(a.state)) - Number(finished(b.state)))
      .map((a) => {
        const mine = internal.filter((l) => l.from === a.id || l.to === a.id);
        const last = mine.at(-1);
        return {
          title: clean(a.title),
          state: a.state,
          label: labels[a.state] ?? a.state,
          kind: a.type ? clean(a.type, 40) : undefined,
          depth: depth(a),
          detail: [
            a.model ? shortModel(a.model) : "",
            a.effort ?? "",
            a.tokens !== undefined ? tokens(a.tokens) : "",
            a.durationMs !== undefined ? runTime(a.durationMs) : "",
          ]
            .filter(Boolean)
            .join(" · "),
          last: last?.text
            ? `${last.from === a.id ? `→ ${agentName(last.to)}` : `← ${agentName(last.from)}`} «${last.text}»`
            : undefined,
          waiting: !finished(a.state) && last?.from === a.id && last.to === "main",
        };
      }),
    ...[...consults.values()].map((l) => ({
      title: clean(l.text ?? "consulta", 160),
      state: l.status ?? "unknown",
      label: labels[l.status ?? "unknown"] ?? clean(l.status, 40),
      kind: `consulta · ${clean(l.name, 60)}`,
      depth: 0,
    })),
  ];
  const label =
    mode.kind === "solo"
      ? "Trabaja sola"
      : mode.kind === "lead"
        ? `Dirige ${mode.count}`
        : mode.kind === "pair"
          ? `De tú a tú · ${peerName({ peer: mode.peer.key, name: mode.peer.name, harness: mode.peer.harness })}`
          : `En grupo · ${mode.sessions} sesiones`;
  const events = [...links]
    .sort((a, b) => b.at - a.at)
    .slice(0, 4)
    .map((l) => {
      // The partner list already names the harness; events keep the width for the message.
      const who = peerName({ ...l, harness: undefined });
      const quote = l.text ? ` «${l.text}»` : "";
      const text =
        l.kind === "sent"
          ? `${who}${quote}`
          : l.kind === "received"
            ? l.peer === "?"
              ? `mensaje recibido de otra sesión${quote}`
              : `${who}${quote || " respondió"}`
            : l.kind === "spawned"
              ? `lanzó ${clean(l.name, 60)}${quote}`
              : l.kind === "internal"
                ? `${agentName(l.from)} → ${agentName(l.to)}${quote}`
                : `consulta a ${clean(l.name, 60)}${quote}`;
      const status = l.status
        ? (linkStatus[l.status] ?? labels[l.status] ?? clean(l.status, 30))
        : "";
      return {
        icon: { sent: "→", received: "←", spawned: "⇢", consult: "◆", internal: "⇄" }[l.kind],
        text,
        trail: [status, ago(l.at)].filter(Boolean).join(" · "),
        fresh: Date.now() - l.at < 60000,
        tone: linkTone(l.status),
      };
    });
  return {
    mode: mode.kind,
    label,
    charge,
    peers: peers.map((p) => ({
      name: peerName({ peer: p.key, name: p.name, harness: p.harness }),
      counts: [p.sent ? `→${p.sent}` : "", p.received ? `←${p.received}` : ""]
        .filter(Boolean)
        .join(" "),
      ago: p.status === "failed" ? "falló" : p.status === "waiting" ? "sin respuesta" : ago(p.last),
      tone: p.status === "failed" ? "fail" : p.status === "waiting" ? "warn" : "ok",
    })),
    events,
  };
};

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    if (!e.isInteractive || e.surface !== "terminal") return result;
    active = true;
    paneHealthy = false;
    paneOpen = false;
    unplaced = [];
    history = false;
    bandExpanded = false;
    diff = null;
    snapshot = null;
    error = null;
    aos = "http://127.0.0.1:4317";
    drafts.clear();
    delivering.clear();
    launching.clear();
    peersTalk = false;
    state = initialState(await $.session.id(), e.cwd);
    const stored = await $.store.get(`session:${state.sessionId}`);
    if (
      stored &&
      typeof stored === "object" &&
      (stored as State).version === 1 &&
      (stored as State).sessionId === state.sessionId &&
      (stored as State).cwd === e.cwd &&
      Array.isArray((stored as State).tasks) &&
      Array.isArray((stored as State).decisions)
    ) {
      // State saved before a field existed gets its default; an explicit value stays.
      state = { ...state, ...(stored as State) };
      // A reload loses the pending host promise: retry only after a human inspects it.
      state.decisions = state.decisions.map((d) =>
        d.state === "queued"
          ? {
              ...d,
              state: "failed",
              error: "Entrega incierta tras reanudar; comprueba el chat antes de reintentar",
            }
          : d,
      );
    }
    actor = (await $.env.get("AOS_AGENT_ID")) || undefined;
    const configured = await $.env.get("AOS_URL");
    if (configured) {
      const u = new URL(configured);
      if (
        u.protocol !== "http:" ||
        !["127.0.0.1", "localhost", "agentic-os.localhost"].includes(u.hostname) ||
        u.username ||
        u.password ||
        u.pathname !== "/" ||
        u.search ||
        u.hash
      )
        throw Error("AOS_URL must be a loopback HTTP origin");
      aos = u.origin;
    }
    await $.command.register({
      name: "workboard",
      description: "Mostrar u ocultar trabajo y agentes",
      immediate: true,
    });
    await $.command.register({
      name: "workboard-config",
      description: "Configurar cobertura, base y repos vinculados con JSON",
      argumentHint: "<JSON>",
      immediate: true,
    });
    await $.tool.register({
      name: "progress",
      description:
        "Publish the explicit work plan and decision requests to the user's workboard. Shape the plan as 2-6 features (tasks without parent), each with 2-6 subtasks (parent: the feature id) that end in something checkable. Publish it before the first other tool call when the task will edit files or needs more than two tool calls; update when a feature closes or something blocks or fails, and close everything at the end. Tasks merge by id: send only the ones that change, as {id, state}; replace: true starts a new plan. Tasks are declarations, never proof of passing tests. A blocking decision must stop dependent work; nonblocking questions permit independent work. Do not manufacture approvals. A decision may add context (why it matters), options as {label, detail} and recommended (the index of the option you advise). Responses arrive in later Workboard messages. Keep the final ROBIN line in your answer; the mod relocates only its drawing.",
      inputSchema: {
        type: "object",
        properties: {
          update: {
            type: "object",
            properties: {
              ticket: { type: ["string", "null"] },
              replace: { type: "boolean" },
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    state: { enum: ["pending", "running", "blocked", "completed", "failed"] },
                    dependsOn: { type: "array", items: { type: "string" } },
                    parent: { type: "string" },
                  },
                  required: ["id"],
                },
              },
              decisions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    question: { type: "string" },
                    context: { type: "string" },
                    options: {
                      type: "array",
                      items: {
                        anyOf: [
                          { type: "string" },
                          {
                            type: "object",
                            properties: { label: { type: "string" }, detail: { type: "string" } },
                            required: ["label"],
                          },
                        ],
                      },
                    },
                    recommended: { type: "integer" },
                    blocking: { type: "boolean" },
                    cancel: { type: "boolean" },
                  },
                  required: ["id"],
                },
              },
            },
          },
        },
        required: ["update"],
      },
    });
    await openPane($);
    void refresh($);
    $.clock.every(15000, () => {
      void refresh($);
    });
    return result;
  });
  on("command.run", { command: "workboard" }, async ($) => {
    await togglePane($);
    return {};
  });
  on("command.run", { command: "workboard-config" }, async ($, e) => {
    if (e.origin.kind !== "composer")
      return { text: "Configura Workboard desde el prompt de Claude." };
    try {
      const config = JSON.parse(e.args);
      await helper($, "configure", ["--json", JSON.stringify(config)]);
      void refresh($);
      return { text: "Configuración de Workboard guardada para este repositorio." };
    } catch (err) {
      return { text: `No se ha configurado: ${clean(err)}` };
    }
  });
  on("tool.call", { tool: TOOL }, async ($, e) => {
    try {
      state = publish(state, (e as unknown as { update: unknown }).update);
      await persist($);
      void refresh($);
      // A mod tool answers with text or content blocks; core rejects a plain object.
      const open = state.decisions
        .filter((d) => ["pending", "queued", "failed"].includes(d.state))
        .map(({ id, state, revision }) => ({ id, state, revision }));
      return { result: JSON.stringify({ accepted: true, open }) };
    } catch (err) {
      return { result: clean(err), isError: true };
    }
  });
  // Claude Code defers a mod's mcp__ tool behind ToolSearch, where the model never sees it
  // unless it searches by name. Keep its schema in the prompt; the answer is stable, so the
  // prompt cache holds. Only this tool is touched, and only while the mod is loaded.
  on("tool.describe", { tool: TOOL }, async ($, e, next) => ({
    ...(await next(e)),
    isDeferred: false,
  }));
  on("prompt.submit", async ($, e, next) => {
    if (!active) return next(e);
    return next({
      ...e,
      context: [
        ...(e.context ?? []),
        "Workboard is visible. When the task will edit files or needs more than two tool calls, publish its plan with mcp__workboard__progress (loaded, no ToolSearch) before any other tool call.",
      ],
    });
  });
  on("turn.start", async ($, e, next) => {
    if (active) {
      state.working = true;
      state.turn = { at: Date.now(), ms: null, edits: 0, commands: 0 };
      redraw($);
    }
    return next(e);
  });
  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (!active) return r;
    // A subagent's run ends here, background ones included: add its time, tokens and model.
    // Engine forks (compaction, memory) carry ids no agent list names, so they are skipped.
    if (e.agentId) {
      const a = state.agents.find((x) => x.id === e.agentId);
      if (!a) return r;
      const u = e.usage;
      const used = u
        ? u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
        : 0;
      state.agents = annotateAgent(state.agents, a.id, {
        durationMs: (a.durationMs ?? 0) + e.durationMs,
        tokens: u ? (a.tokens ?? 0) + used : a.tokens,
        model: u?.model ? clean(u.model, 60) : undefined,
      });
      void persist($);
      return r;
    }
    state.working = false;
    if (state.turn) state.turn = { ...state.turn, ms: Date.now() - state.turn.at };
    const robin = extractRobin(e.answer);
    if (robin) state.robin = { text: clean(robin.text, 4000), at: Date.now() };
    if (!e.isAborted) {
      const notice = extractNotice(e.answer);
      state.notice = notice ? clean(notice) : null;
      const ask = extractAsk(e.answer);
      state = askFromChat(state, ask ? clean(ask, 1500).trim() || null : null);
    }
    if (e.reason === "error" || e.reason === "refusal")
      state.failure = {
        text: `Turno ${e.reason === "error" ? "fallido" : "rechazado"}`,
        at: Date.now(),
      };
    await persist($);
    for (const d of state.decisions) if (d.state === "queued") deliver($, d);
    void refresh($);
    return r;
  });
  on("tool.call", async ($, e, next) => {
    const r = await next(e);
    if (!active || e.tool === TOOL) return r;
    const input = e as unknown as {
      file_path?: string;
      command?: string;
      description?: string;
      subagent_type?: string;
      effort?: string;
    };
    const ok = !r.deny && !r.isError;
    // Subagents' calls count too: their work is part of this turn.
    if (state.turn && ok && ["Edit", "Write", "NotebookEdit"].includes(e.tool)) state.turn.edits++;
    if (state.turn && ok && e.tool === "Bash") state.turn.commands++;
    // The launch moment; the agent itself comes from $.agent.list().
    if (ok && ["Agent", "Task"].includes(e.tool))
      state.links = addLinks(state.links, [
        {
          id: `spawn:${e.tool_use_id}`,
          at: Date.now(),
          kind: "spawned",
          peer: `spawn:${e.tool_use_id}`,
          name: clean(input.subagent_type || "agente", 60),
          text: clean(input.description, 160),
          source: "native",
        },
      ]);
    // Show the launched agent now rather than at the next refresh, with the call's effort;
    // its time and tokens arrive with its turn.complete.
    if (ok && ["Agent", "Task"].includes(e.tool)) {
      const run = r.result as { agentId?: string } | undefined;
      if (run?.agentId && input.effort)
        state.agents = annotateAgent(state.agents, run.agentId, { effort: clean(input.effort, 20) });
      state.agents = reconcileAgents(state.agents, await $.agent.list());
    }
    if (r.deny || r.isError)
      state.failure = {
        text: `${clean(e.tool)}: ${r.deny ? "denegado" : "falló"}`,
        at: Date.now(),
      };
    if (
      !r.deny &&
      !r.isError &&
      ["Edit", "Write", "NotebookEdit"].includes(e.tool) &&
      typeof input.file_path === "string"
    )
      state.observed = [...new Set([...state.observed, input.file_path])].slice(-2000);
    if (
      e.tool === "Bash" &&
      typeof input.command === "string" &&
      /\b(test|pytest|vitest|jest|tsc|lint|check|coverage)\b/.test(input.command)
    )
      state.checks = [
        ...state.checks,
        {
          id: e.tool_use_id,
          title: clean(input.description || input.command, 200),
          state: r.deny ? "denied" : r.isError ? "failed" : "reported",
          at: Date.now(),
          source: "tool.call (sin revisión verificada)",
        },
      ].slice(-30);
    await persist($);
    return r;
  });
  // The model a spawn resolved to, known before the agent runs (background ones included).
  on("agent.spawn", async ($, e, next) => {
    const r = await next(e);
    if (!active || e.workflow || r.deny || !r.agentId) return r;
    state.agents = annotateAgent(state.agents, r.agentId, {
      title: clean(e.description),
      model: clean(r.model, 60),
      ...(e.parentAgentId ? { parentId: e.parentAgentId } : {}),
    });
    void persist($);
    return r;
  });
  // Observe-only: the message passes unchanged and nothing here waits on the prompt, which
  // would hang a delivery that lands inside a turn. A message between this session's main loop
  // and its agents, or between two of them, is internal: it never makes the agent a partner.
  on("session.send", async ($, e, next) => {
    const r = await next(e);
    if (!active) return r;
    try {
      const own = await $.agent.list();
      const target = own.find((a) => a.id === e.to || a.name === e.to);
      const text = clean(e.text, 160);
      const status = r.isDelivered ? "delivered" : "failed";
      const id = `send:${crypto.randomUUID()}`;
      if (e.agentId || target) {
        const to = target?.id ?? clean(e.to, 200);
        state.links = addLinks(state.links, [
          { id, at: Date.now(), kind: "internal", peer: to, from: e.agentId ?? "main", to, text, status, source: "native" },
        ]);
        // An agent writing to an address no agent holds is most likely writing to main; the
        // delivery that reaches main (session.receive) confirms it and is not logged again.
        if (e.agentId && !target)
          unplaced = [...unplaced.filter((u) => Date.now() - u.at < 60000), { id, text, at: Date.now() }];
      } else
        state.links = addLinks(state.links, [
          { id, at: Date.now(), kind: "sent", peer: clean(e.to, 200), name: clean(e.to, 80), text, status, source: "native" },
        ]);
      void persist($);
    } catch {}
    return r;
  });
  on("session.receive", async ($, e, next) => {
    const r = await next(e);
    if (!active || e.agentId || "consumed" in r) return r;
    try {
      const origin = e.origin as { kind: string; teammate?: string };
      if (["peer", "coordinator", "peer-send-message"].includes(origin.kind)) {
        // A team mailbox stamps the teammate; another session signs its envelope.
        const envelope = parseEnvelope(e.text);
        // Main's copy of an agent's internal message: point that link at main instead.
        const body = clean(envelope.body, 2000);
        const echo = unplaced.find(
          (u) => u.text && Date.now() - u.at < 60000 && body.includes(u.text.replace(/…$/, "")),
        );
        if (echo) {
          unplaced = unplaced.filter((u) => u !== echo);
          state.links = state.links.map((l) =>
            l.id === echo.id ? { ...l, peer: "main", to: "main" } : l,
          );
          void persist($);
          return r;
        }
        const sender = origin.teammate ?? envelope.name;
        const from = sender ? clean(sender, 80) : null;
        state.links = addLinks(state.links, [
          {
            id: `receive:${crypto.randomUUID()}`,
            at: Date.now(),
            kind: "received",
            peer: from ?? "?",
            ...(from ? { name: from } : {}),
            text: clean(envelope.body, 160),
            source: "native",
          },
        ]);
        void persist($);
      }
    } catch {}
    return r;
  });
  on("ui.close", async ($, e, next) => {
    const r = await next(e);
    if (e.id === PANE) {
      paneHealthy = false;
      paneOpen = false;
      redraw($);
    }
    return r;
  });
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    if (!active || !paneHealthy || !state.robin) return next(e);
    const robin = extractRobin(e.props.text);
    if (!robin || robin.text !== state.robin.text) return next(e);
    const visible = (await $.ui.panes()).some((p) => p.id === PANE && p.isShown && p.isPlaced);
    return visible ? next({ ...e, props: { ...e.props, text: robin.body } }) : next(e);
  });
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const theirs = await next(e);
    if (!active || e.surface !== "terminal" || e.props.hasSurvey) return theirs;
    const { Box, Text, Button, Link } = $.ui.resolve(e);
    const repos = snapshot?.repos ?? [];
    const count = repos.reduce((n, r) => n + r.files.length, 0);
    const pending = state.decisions.filter((d) => d.state === "pending").length;
    const nodes = [
      Box({
        flexDirection: "row",
        columnGap: 1,
        children: [
          Button({
            key: "workboard-details",
            label: `${state.ticket ?? repos[0]?.branch ?? "Trabajo"} · ${repos.length || 1} repo · ${count} ficheros`,
            plain: true,
            onPress: () => {
              bandExpanded = !bandExpanded;
              redraw($);
            },
          }),
          Button({
            key: "workboard-open",
            label: `${paneOpen ? "Cerrar panel" : "Panel"}${pending ? ` (${pending})` : ""}`,
            hotkey: "p",
            onPress: () => {
              void togglePane($);
            },
          }),
          Button({
            key: "workboard-refresh",
            label: refreshing ? "Actualizando" : "Actualizar",
            hotkey: "a",
            onPress: () => {
              void refresh($).then((ok) =>
                $.ui.toast(
                  ok === undefined
                    ? "Ya se está actualizando"
                    : ok
                      ? "Actualizado"
                      : `No se ha podido actualizar: ${error ?? "error desconocido"}`,
                ),
              );
            },
          }),
        ],
      }),
    ];
    for (const repo of bandExpanded ? repos : repos.slice(0, 2)) {
      const pr = repo.pr;
      const checks = pr?.checks ?? [];
      const failures = checks.filter((c) =>
        ["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED"].includes(c.state),
      ).length;
      const ci = failures
        ? `CI: ${failures} fallos`
        : checks.length
          ? `CI: ${checks.filter((c) => ["SUCCESS", "NEUTRAL", "SKIPPED"].includes(c.state)).length}/${checks.length}`
          : "CI sin datos";
      nodes.push(
        Text({
          children: clean(
            `${tail(repo.cwd)} · ${repo.branch ?? "sin rama"} · ${repo.files.length} cambios · ${github(pr)} · ${ci} · cobertura ${coverage(repo.coverage)}`,
          ),
          wrap: "truncate",
        }),
      );
      if (bandExpanded) {
        if (repo.baseError)
          nodes.push(
            Text({ color: "yellow", children: "Base no disponible; se muestran cambios locales" }),
          );
        if (repo.error) nodes.push(Text({ color: "red", children: clean(repo.error) }));
        if (pr?.error) nodes.push(Text({ color: "yellow", children: clean(pr.error) }));
        if (pr?.url)
          nodes.push(Link({ href: pr.url, label: `PR #${pr.number} · ${pr.head?.slice(0, 8)}` }));
        for (const check of pr?.checks ?? [])
          nodes.push(Text({ children: clean(`CI: ${check.name} · ${check.state}`) }));
        for (const file of repo.files.slice(0, 100)) {
          const cov = repo.coverage?.coverage?.files.find((x) => x.path === file.path);
          const before = repo.coverage?.baseline?.find((x) => x.path === file.path);
          const observed = state.observed.some(
            (p) => p === file.path || p === `${repo.cwd}/${file.path}`,
          );
          nodes.push(
            Text({
              children: clean(
                `${file.path} · ${file.kind}${observed ? " · edición observada" : state.initial.includes(file.path) && repo.cwd === state.cwd ? " · preexistente" : " · atribución desconocida"}${cov ? ` · líneas Δ ${percent(cov.percent)} · fichero ${before ? percent(before.percent) : "sin referencia"} → ${percent(cov.filePercent)}` : ""}`,
              ),
              wrap: "truncate",
            }),
          );
          nodes.push(
            Button({
              key: `file-${repo.cwd}-${file.path}`,
              label: "Ver cambio",
              plain: true,
              onPress: () => inspectFile($, repo, file.path),
            }),
          );
        }
        if (repo.files.length > 100)
          nodes.push(
            Text({
              children: `${repo.files.length - 100} ficheros más; consulta Git para el detalle completo`,
            }),
          );
        nodes.push(
          Button({
            key: `coverage-${repo.cwd}`,
            label: repo.canRecalculate
              ? launching.has(repo.cwd) || repo.coverage?.state === "running"
                ? "Cobertura en curso"
                : "Recalcular cobertura"
              : "Configurar cobertura: /workboard-config",
            onPress: () => {
              if (repo.canRecalculate) void recalculate($, repo);
              else
                $.ui.toast(
                  'Ejemplo: /workboard-config {"coverage":{"report":"coverage/lcov.info","format":"lcov","command":["bun","test","--coverage"]}}',
                );
            },
          }),
        );
      }
    }
    if (!bandExpanded && repos.length > 2)
      nodes.push(Text({ children: `${repos.length - 2} repos más · desplegar para verlos` }));
    if (error) nodes.push(Text({ color: "red", children: error }));
    nodes.push(theirs as (typeof nodes)[number]);
    return Box({ flexDirection: "column", children: nodes });
  });
  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e, next) => {
    if (e.surface !== "terminal" || !active) return next(e);
    paneHealthy = false;
    const ui = $.ui.resolve(e);
    // ROBIN remains in the chat while a file replaces its panel.
    if (diff)
      return diffView(ui, { ...diff, path: clean(diff.path) }, () => {
        diff = null;
        redraw($);
      });
    const decisions: PaneDecision[] = state.decisions
      .filter((d) => !["delivered", "cancelled"].includes(d.state))
      .map((d) => {
        const key = `${state.sessionId}-${d.id}-${d.revision}`;
        return {
          key,
          question: clean(d.question, 2000).trim(),
          blocking: d.blocking,
          // Open buttons already say "pending"; only a later state needs words.
          status: d.state === "pending" ? "" : (labels[d.state] ?? d.state),
          error: d.error ? clean(d.error) : undefined,
          context: d.context ? clean(d.context, 400) : undefined,
          options: d.options.map((o, i) => ({
            label: clean(o, 200),
            ...(d.details?.[i] ? { detail: clean(d.details[i], 300) } : {}),
          })),
          recommended: d.recommended,
          chat: d.source === "chat",
          open: ["pending", "failed"].includes(d.state),
          draft: drafts.get(key) ?? "",
          onAnswer: (value) => respond($, d, value),
          onDraft: (value) => {
            drafts.set(key, value);
          },
        };
      });
    const quality = (snapshot?.repos ?? []).slice(0, 2).map((repo, _, all) => {
      const checks = repo.pr?.checks ?? [];
      const failures = checks.filter((c) =>
        ["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED"].includes(c.state),
      ).length;
      const passed = checks.filter((c) =>
        ["SUCCESS", "NEUTRAL", "SKIPPED"].includes(c.state),
      ).length;
      const value = repo.coverage?.coverage?.percent;
      return {
        heading:
          all.length > 1
            ? clean(
                `${tail(repo.cwd)} · ${repo.branch ?? "sin rama"} · ${repo.files.length} cambios`,
              )
            : null,
        rows: [
          {
            label: "GitHub",
            value: clean(github(repo.pr).replace(/^GitHub:? /, "")),
            tone: (repo.pr?.state === "error" && !/no git remotes/i.test(repo.pr.error ?? "")
              ? "fail"
              : repo.pr?.state === "loaded"
                ? "info"
                : "muted") as Tone,
          },
          {
            label: "CI",
            value: failures
              ? `${failures} fallos`
              : checks.length
                ? `${passed}/${checks.length}`
                : "sin datos",
            tone: (failures ? "fail" : checks.length ? "ok" : "muted") as Tone,
            ratio: checks.length ? passed / checks.length : null,
          },
          {
            label: "Cobertura",
            value: coverage(repo.coverage),
            tone: (typeof value === "number" ? "info" : "muted") as Tone,
            ratio: typeof value === "number" && Number.isFinite(value) ? value / 100 : null,
          },
        ],
      };
    });
    const local = state.checks.slice(-3).map((check) => ({
      label: "Local",
      value: clean(
        `${check.title} · ${check.state === "reported" ? "comando terminado; revisión no verificada" : (labels[check.state] ?? check.state)}`,
      ),
      tone: (check.state === "failed" ? "fail" : "muted") as Tone,
    }));
    if (local.length) quality.push({ heading: null, rows: local });
    const tree = paneView(ui, {
      title: clean(state.ticket ?? snapshot?.repos[0]?.branch ?? tail(state.cwd), 80),
      working: state.working,
      cols: e.props.bodyColumns,
      robin: {
        text: clean(state.robin?.text ?? viewStatus(state), 2000),
        at: state.robin?.at ?? null,
        detail: turnDetail(state),
        notice: state.notice,
      },
      failure: state.failure ? clean(state.failure.text) : null,
      error,
      decisions,
      plan: planModel(state.tasks),
      quality,
      agents: agentsModel(state, peersTalk, snapshot?.bridge.aliases),
      history: {
        open: history,
        // Features fold in the plan; finished tasks and agents that left the Agents card land here.
        items: [
          ...state.tasks.filter((t) => t.state === "completed"),
          ...state.agents.filter((a) => !recentAgents([a]).length),
        ].map((x) => ({ title: clean(x.title), label: labels[x.state] ?? x.state })),
        onToggle: () => {
          history = !history;
          redraw($);
        },
      },
      bridge: {
        connected: snapshot?.bridge.state === "connected",
        age: snapshot ? Math.max(0, Math.round((Date.now() - snapshot.at) / 1000)) : null,
        issues:
          snapshot?.bridge.state === "connected"
            ? (snapshot.bridge.errors ?? []).map((x) => clean(x))
            : [],
      },
    });
    paneHealthy = true;
    paneFaulted = false;
    return tree;
  }).catch(($, e, next) => {
    paneHealthy = false;
    if (!paneFaulted) {
      paneFaulted = true;
      redraw($);
    }
    return next(e);
  });
};
