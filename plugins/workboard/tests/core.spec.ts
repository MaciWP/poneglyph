import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import {
  extractRobin,
  initialState,
  publish,
  reconcileAgents,
  recentAgents,
  parseEnvelope,
  viewStatus,
  extractNotice,
  bridgeSession,
  checkExit,
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
test("decisions were removed: the tool refuses them and the bridge gets an empty list", () => {
  const s = initialState("s", "/repo");
  expect(() =>
    publish(s, { decisions: [{ id: "d", question: "Which?", options: ["A"], blocking: true }] }),
  ).toThrow("Decisions were removed: ask the user with AskUserQuestion");
  expect(bridgeSession(s).decisions).toEqual([]);
  expect("decisions" in s).toBe(false);
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
test("the notice line is read outside fences only", () => {
  const answer =
    "Done.\n\n**Espera tu decisión:** borrar o no `/v1/export`.\n\nAviso: rama atrasada.\nROBIN: Hecho.";
  expect(extractNotice(answer)).toBe("rama atrasada.");
  expect(extractNotice("```text\nAviso: ejemplo\n```\nROBIN: x")).toBeNull();
  expect(extractNotice("Nada que avisar.\nROBIN: x")).toBeNull();
});
test("a local check runs a test, type or lint tool, never a word inside another command", () => {
  for (const command of [
    "bun test plugins/workboard",
    "npm run lint",
    "cd app && uv run pytest -q",
    ".venv/bin/pytest",
    "bunx tsc --noEmit",
    "CI=1 npx vitest run",
    "claude plugin test plugins/workboard",
  ])
    expect(checkExit(command)).toBe("own");
  for (const command of [
    "grep -n test src",
    "git diff --check",
    "test -f x && echo ok",
    "cat src/check.ts",
    "ls tests/",
  ])
    expect(checkExit(command)).toBeNull();
  // Without pipefail the last command of a pipe, `||` or `;` decides the exit status.
  for (const command of [
    "bun test 2>&1 | tail -5",
    "bun test || true",
    "bun test; echo done",
    "bun test &",
  ])
    expect(checkExit(command)).toBe("hidden");
  expect(checkExit("set -o pipefail; cd a && bun test 2>&1 | tail -5")).toBe("own");
  expect(checkExit("bun test 2>&1 && echo ok")).toBe("own");
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
test("collaboration ranks partners: a coordinator directs, a led teammate is no peer", () => {
  const link = (id: string, peer: string, kind: "sent" | "received", via?: string) => ({
    id,
    at: Number(id),
    kind,
    peer,
    ...(via ? { via } : {}),
    source: "native" as const,
  });
  const team = [{ id: "t1", title: "scout", state: "running", teammateId: "scout@crew", name: "scout" }];
  const links = [
    link("1", "lead", "received", "coordinator"),
    link("2", "mate", "received", "peer"),
    link("3", "scout", "received", "peer"),
    link("4", "scout@crew", "sent"),
  ];
  const r = collaboration(team, links, false);
  expect(r.leads.map((p) => p.key)).toEqual(["lead"]);
  expect(r.peers.map((p) => p.key)).toEqual(["mate"]);
  expect(r.mode).toMatchObject({ kind: "worker", lead: { key: "lead" } });
  // Without a coordinator the same peers keep the old modes.
  expect(collaboration(team, links.slice(1), false).mode).toMatchObject({ kind: "pair" });
});
test("the router run of this session is the latest claude line with its session prefix", async () => {
  const { routerRun } = await import("../scripts/workboard.mjs");
  const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(`${tmpdir()}/wb-router-`);
  await mkdir(`${dir}/.claude/learned`, { recursive: true });
  await writeFile(
    `${dir}/.claude/learned/prompt-router.log`,
    [
      "2026-10-08T17:00:00.000Z host=claude session=abcdef12 outcome=empty ms=3000 skills=- fixes=0",
      "2026-10-08T17:01:00.000Z host=claude session=abcdef12 outcome=ok ms=5141 skills=dev-workflow,ui-design fixes=1",
      "2026-10-08T17:02:00.000Z host=codex session=abcdef12 outcome=ok ms=4000 skills=flow fixes=0",
      "2026-10-08T17:03:00.000Z host=claude session=99999999 outcome=ok ms=4000 skills=flow fixes=0",
      "",
    ].join("\n"),
  );
  expect(await routerRun(dir, "abcdef12-0000-4000-8000-000000000000")).toEqual({
    at: Date.parse("2026-10-08T17:01:00.000Z"),
    ms: 5141,
    outcome: "ok",
    skills: ["dev-workflow", "ui-design"],
    fixes: 1,
  });
  expect(await routerRun(dir, "11111111-x")).toBeNull();
  expect(await routerRun(`${dir}/missing`, "abcdef12")).toBeNull();
});

// A plugin installs alone, so each of these four loopback checks carries its own copy of the
// allowlist; they must stay the same set.
test("the loopback allowlists of hud, dock and workboard match", () => {
  const files = ["../../hud/hooks/register.ts", "../../dock/hooks/backends.ts", "../hooks/register.ts", "../scripts/workboard.mjs"];
  const sets = files.map((f) => {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    const list = /\[((?:\s*"[^"]+",?)+\s*)\]\.includes\(\s*u(?:rl)?\.hostname/.exec(src)?.[1];
    expect(list, f).toBeDefined();
    return [...(list as string).matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  });
  expect(sets[0]).toEqual(["127.0.0.1", "[::1]", "agentic-os.localhost", "localhost"]);
  for (const s of sets) expect(s).toEqual(sets[0]);
});
