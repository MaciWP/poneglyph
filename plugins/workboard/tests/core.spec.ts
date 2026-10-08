import { expect, test } from "bun:test";
import {
  extractRobin,
  initialState,
  publish,
  answer,
  settle,
  reconcileAgents,
  recentAgents,
  parseEnvelope,
  viewStatus,
  extractAsk,
  extractNotice,
  askFromChat,
  addLinks,
  collaboration,
  annotateAgent,
  type Link,
} from "../hooks/core.ts";

test("ROBIN only extracts a final unquoted standalone line outside fences", () => {
  expect(extractRobin("Answer\n\nROBIN: Finished.")).toEqual({ text: "Finished.", body: "Answer" });
  expect(extractRobin("```text\nROBIN: example\n```\n")).toBeNull();
  expect(extractRobin("> ROBIN: quoted")).toBeNull();
  expect(extractRobin("ROBIN: example\nFurther explanation")).toBeNull();
  expect(extractRobin("Answer\n\n**ROBIN:** Done.")?.text).toBe("Done.");
});
test("decisions are versioned, duplicate clicks refuse and failed deliveries remain retryable", () => {
  let s = initialState("session", "/repo");
  s = publish(s, {
    decisions: [{ id: "d", question: "Which?", options: ["A", "B"], blocking: true }],
  });
  const revision = s.decisions[0]!.revision;
  s = answer(s, "d", revision, "A");
  expect(s.decisions[0]!.state).toBe("queued");
  expect(() => answer(s, "d", revision, "B")).toThrow();
  s = settle(s, "d", revision, false, "offline");
  expect(s.decisions[0]!.state).toBe("failed");
  const changed = publish(s, {
    decisions: [{ id: "d", question: "New question?", options: ["A", "B"], blocking: true }],
  });
  expect(() => answer(changed, "d", revision, "A")).toThrow();
  expect(settle(changed, "d", revision, true).decisions[0]!.state).toBe("pending");
});
test("a completed task does not pass checks and an old ROBIN cannot hide a tool failure", () => {
  const s = publish(initialState("s", "/repo"), {
    tasks: [{ id: "t", title: "Build", state: "completed" }],
  });
  s.robin = { text: "All good", at: 1 };
  s.failure = { text: "Tests failed", at: 2 };
  expect(viewStatus(s)).toContain("Tests failed");
  expect(s.checks).toEqual([]);
});
test("missing agent from a snapshot becomes unknown, not completed", () => {
  const s = initialState("s", "/repo");
  s.agents = [{ id: "a", title: "Worker", state: "running" }];
  expect(reconcileAgents(s.agents, [])[0]?.state).toBe("unknown");
});
test("subtasks name an existing feature, one level deep", () => {
  const s = publish(initialState("s", "/repo"), {
    tasks: [
      { id: "f", title: "Feature", state: "running" },
      { id: "t", title: "Subtask", state: "pending", parent: "f" },
    ],
  });
  expect(s.tasks[1]!.parent).toBe("f");
  expect(() =>
    publish(s, { tasks: [{ id: "t", title: "Orphan", state: "pending", parent: "nope" }] }),
  ).toThrow("Unknown parent task");
  expect(() =>
    publish(s, {
      tasks: [
        { id: "f", title: "Feature", state: "running" },
        { id: "t", title: "Sub", state: "pending", parent: "f" },
        { id: "u", title: "Subsub", state: "pending", parent: "t" },
      ],
    }),
  ).toThrow("Subtasks cannot have subtasks");
});
test("tasks merge by id, new tasks need a title and replace starts a new plan", () => {
  let s = publish(initialState("s", "/repo"), {
    tasks: [
      { id: "f", title: "Feature", state: "running" },
      { id: "t", title: "Subtask", state: "running", parent: "f", dependsOn: ["f"] },
    ],
  });
  s = publish(s, { tasks: [{ id: "t", state: "completed" }] });
  expect(s.tasks).toEqual([
    { id: "f", title: "Feature", state: "running", dependsOn: [] },
    { id: "t", title: "Subtask", state: "completed", parent: "f", dependsOn: ["f"] },
  ]);
  s = publish(s, { tasks: [{ id: "u", title: "Another", state: "pending", parent: "f" }] });
  expect(s.tasks.map((t) => t.id)).toEqual(["f", "t", "u"]);
  expect(() => publish(s, { tasks: [{ id: "v", state: "pending" }] })).toThrow(
    "New task v needs a title",
  );
  expect(() => publish(s, { tasks: [{ id: "v", title: "No state" }] })).toThrow(
    "New task v needs a state",
  );
  expect(() => publish(s, { tasks: [{ id: "t", state: "done" }] })).toThrow("Invalid task state");
  expect(() => publish(s, { tasks: [{ id: "f", dependsOn: ["t"] }] })).toThrow(
    "Cyclic task dependencies",
  );
  expect(() =>
    publish(s, {
      tasks: [
        { id: "t", state: "running" },
        { id: "t", state: "failed" },
      ],
    }),
  ).toThrow("Duplicate task id");
  const many = Array.from({ length: 98 }, (_, i) => ({
    id: `n${i}`,
    title: "N",
    state: "pending",
  }));
  expect(() => publish(s, { tasks: many })).toThrow("At most 100 tasks");
  const fresh = publish(s, {
    replace: true,
    tasks: [{ id: "g", title: "New plan", state: "pending" }],
  });
  expect(fresh.tasks.map((t) => t.id)).toEqual(["g"]);
  expect(publish(s, { replace: true }).tasks).toEqual([]);
  expect(() => publish(s, { replace: true, tasks: [{ id: "t", state: "running" }] })).toThrow(
    "New task t needs a title",
  );
});
test("rich decisions keep context, per-option detail and a valid recommendation", () => {
  const s = publish(initialState("s", "/repo"), {
    decisions: [
      {
        id: "d",
        question: "Which palette?",
        context: "It sets every card colour.",
        options: [{ label: "Cyan", detail: "Matches ROBIN" }, "Amber"],
        recommended: 0,
        blocking: true,
      },
    ],
  });
  expect(s.decisions[0]).toMatchObject({
    options: ["Cyan", "Amber"],
    details: ["Matches ROBIN", null],
    context: "It sets every card colour.",
    recommended: 0,
  });
  expect(() =>
    publish(s, {
      decisions: [{ id: "x", question: "Q?", options: ["A"], recommended: 3, blocking: false }],
    }),
  ).toThrow("Invalid recommended option");
  expect(() =>
    publish(s, { decisions: [{ id: "chat", question: "Q?", options: [], blocking: false }] }),
  ).toThrow("reserved");
});
test("the chat question block and the notice line are read outside fences only", () => {
  const answer =
    "Done.\n\n**Espera tu decisión:** borrar o no `/v1/export`.\nCon detalle.\n\nAviso: rama atrasada.\nROBIN: Hecho.";
  expect(extractAsk(answer)).toBe("borrar o no `/v1/export`.\nCon detalle.");
  expect(extractNotice(answer)).toBe("rama atrasada.");
  expect(extractAsk("```text\nEspera tu decisión: ejemplo\n```\nROBIN: x")).toBeNull();
  expect(extractNotice("Nada que avisar.\nROBIN: x")).toBeNull();
});
test("a chat question becomes the chat decision and a turn without one cancels it", () => {
  let s = askFromChat(initialState("s", "/repo"), "¿Seguimos?");
  expect(s.decisions[0]).toMatchObject({
    id: "chat",
    state: "pending",
    source: "chat",
    revision: 1,
  });
  expect(askFromChat(s, "¿Seguimos?")).toBe(s);
  s = askFromChat(s, null);
  expect(s.decisions[0]).toMatchObject({ state: "cancelled", revision: 2 });
  expect(askFromChat(s, "¿Otra?").decisions[0]).toMatchObject({ state: "pending", revision: 3 });
  // Asked again after an answer was delivered, the same question opens again.
  let d = askFromChat(initialState("s", "/repo"), "¿Seguimos?");
  d = settle(answer(d, "chat", 1, "Sí"), "chat", 1, true);
  expect(askFromChat(d, "¿Seguimos?").decisions[0]).toMatchObject({
    state: "pending",
    revision: 2,
  });
});
test("links upsert by id and collaboration names the mode", () => {
  const msg = (
    id: string,
    peer: string,
    kind: Link["kind"],
    at: number,
    status?: string,
  ): Link => ({
    id,
    at,
    kind,
    peer,
    status,
    source: "aos",
  });
  let links = addLinks([], [msg("m1", "a", "sent", 1, "delivering")]);
  links = addLinks(links, [msg("m1", "a", "sent", 1, "delivered")]);
  expect(links).toHaveLength(1);
  expect(links[0]!.status).toBe("delivered");
  expect(
    addLinks(
      [],
      Array.from({ length: 60 }, (_, i) => msg(`m${i}`, "a", "sent", i)),
    ),
  ).toHaveLength(50);
  expect(collaboration([], [], false).mode).toEqual({ kind: "solo" });
  expect(collaboration([{ id: "x", title: "Explore", state: "running" }], [], false).mode).toEqual({
    kind: "lead",
    count: 1,
  });
  const pair = collaboration([], [msg("1", "a", "sent", 1), msg("2", "a", "received", 2)], false);
  expect(pair.mode.kind).toBe("pair");
  expect(pair.peers[0]).toMatchObject({ sent: 1, received: 1 });
  expect(collaboration([], [msg("1", "a", "sent", 1)], true).mode).toEqual({
    kind: "group",
    sessions: 2,
  });
  expect(
    collaboration([], [msg("1", "a", "sent", 1), msg("2", "b", "sent", 2, "failed")], false),
  ).toMatchObject({
    mode: { kind: "group", sessions: 3 },
    peers: [{ key: "b", status: "failed" }, { key: "a" }],
  });
});
test("agent snapshots keep type, parent and team address", () => {
  expect(
    reconcileAgents(
      [],
      [
        {
          id: "a",
          description: "Find routes",
          status: "running",
          type: "Explore",
          parentId: "p",
          name: "scout",
        },
      ],
    )[0],
  ).toEqual({
    id: "a",
    title: "Find routes",
    state: "running",
    type: "Explore",
    parentId: "p",
    name: "scout",
  });
});
test("a stopped agent keeps its end time and leaves the lead count after 30 minutes", () => {
  const t0 = 1_000_000;
  const run = { id: "a", description: "Find routes", status: "running" };
  let agents = reconcileAgents([], [run], t0);
  expect(agents[0]?.endedAt).toBeUndefined();
  agents = reconcileAgents(agents, [{ ...run, status: "completed" }], t0 + 1000);
  expect(agents[0]?.endedAt).toBe(t0 + 1000);
  agents = reconcileAgents(agents, [], t0 + 5000);
  expect(agents[0]).toMatchObject({ state: "completed", endedAt: t0 + 1000 });
  expect(recentAgents(agents, t0 + 29 * 60000)).toHaveLength(1);
  expect(recentAgents(agents, t0 + 31 * 60000)).toHaveLength(0);
  // An agent that vanished without a final status is dated the same way.
  const lost = reconcileAgents(reconcileAgents([], [run], t0), [], t0 + 2000);
  expect(lost[0]).toMatchObject({ state: "unknown", endedAt: t0 + 2000 });
});
test("coordination links keep only this terminal's traffic and detect peers that talk", async () => {
  const { coordinationLinks } = await import("../scripts/workboard.mjs");
  const msg = (id: string, from: string, to: string) => ({
    id,
    from,
    to,
    status: "delivered",
    createdAt: "2026-10-07T10:00:00Z",
    preview: `hi ${id}`,
  });
  const terminals = [
    { id: "b", harness: "codex", name: null, agent: { title: "review" } },
    { id: "c", harness: "claude", name: "mesa", agent: null },
  ];
  const coordination = {
    messages: [msg("1", "me", "b"), msg("2", "c", "me"), msg("3", "x", "y")],
    consultations: [
      {
        id: "q",
        author: "me",
        createdAt: "2026-10-07T10:00:00Z",
        prompt: "Opinion?",
        attempts: [{ id: "a1", participant: { harness: "grok", model: "g4" }, state: "running" }],
      },
      { id: "other", author: "x", attempts: [{ id: "a2", participant: {}, state: "running" }] },
    ],
  };
  const r = coordinationLinks(coordination, terminals, "me");
  expect(r.links.map((l: { id: string }) => l.id)).toEqual(["aos:m:1", "aos:m:2", "aos:c:q:a1"]);
  expect(r.links[0]).toMatchObject({ kind: "sent", peer: "b", harness: "codex", name: "review" });
  expect(r.links[1]).toMatchObject({ kind: "received", peer: "c", name: "mesa" });
  expect(r.links[2]).toMatchObject({ kind: "consult", name: "grok g4", status: "running" });
  expect(r.peersTalk).toBe(false);
  coordination.messages.push(msg("4", "b", "c"));
  expect(coordinationLinks(coordination, terminals, "me").peersTalk).toBe(true);
});

test("a native envelope yields its sender and body; plain text passes as body", () => {
  expect(
    parseEnvelope(
      '<cross-session-message from="uds:/tmp/cc-socks/4838.sock" from-name="agentic-os-70" from-mode="bypass">\nHola A\n</cross-session-message>',
    ),
  ).toEqual({ name: "agentic-os-70", from: "uds:/tmp/cc-socks/4838.sock", body: "Hola A" });
  expect(parseEnvelope("Plain text")).toEqual({ body: "Plain text" });
});
test("session aliases map native names to Agentic OS terminals by session id or pid", async () => {
  const { sessionAliases } = await import("../scripts/workboard.mjs");
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(`${tmpdir()}/wb-sessions-`);
  await writeFile(`${dir}/10.json`, JSON.stringify({ pid: 10, sessionId: "s-a", name: "test-a" }));
  await writeFile(`${dir}/20.json`, JSON.stringify({ pid: 20, sessionId: "s-x", name: "by-pid" }));
  await writeFile(
    `${dir}/30.json`,
    JSON.stringify({ pid: 30, sessionId: "s-z", name: "stranger" }),
  );
  await writeFile(`${dir}/40.json`, "{ half written");
  await writeFile(`${dir}/10.secret.key`, "never read");
  const terminals = [
    { id: "t-a", harness: "claude", pid: 99, agent: { sessionId: "s-a", title: "Session A" } },
    { id: "t-b", harness: "codex", pid: 20, name: "Named B" },
  ];
  expect(await sessionAliases(terminals, dir)).toEqual({
    "test-a": { id: "t-a", harness: "claude", name: "Session A" },
    "by-pid": { id: "t-b", harness: "codex", name: "Named B" },
  });
  expect(await sessionAliases(terminals, `${dir}/missing`)).toEqual({});
});

test("an agent keeps how it ran across refreshes, and internal messages never make a partner", () => {
  let agents = annotateAgent([], "a1", { model: "claude-haiku-5-5", title: "Find the routes" });
  expect(agents).toEqual([{ id: "a1", title: "Find the routes", state: "running", model: "claude-haiku-5-5" }]);
  agents = annotateAgent(agents, "a1", { effort: "medium", tokens: 900, durationMs: undefined });
  expect(agents[0]).not.toHaveProperty("durationMs");
  agents = reconcileAgents(agents, [{ id: "a1", description: "Find the routes", status: "completed", type: "Explore" }], 5);
  expect(agents[0]).toMatchObject({ model: "claude-haiku-5-5", effort: "medium", tokens: 900, state: "completed", endedAt: 5 });
  const internal: Link = { id: "i1", at: 1, kind: "internal", peer: "a1", from: "main", to: "a1", source: "native" };
  const { mode, peers } = collaboration(agents.map((a) => ({ ...a, state: "running" })), [internal], false);
  expect(peers).toEqual([]);
  expect(mode).toEqual({ kind: "lead", count: 1 });
});
