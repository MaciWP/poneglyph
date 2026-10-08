import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mkdir,
  realpath,
  writeFile,
  chmod,
  open,
  readFile,
  readdir,
  lstat,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { root, run, git, gitSnapshot, contained, sha } from "./git.mjs";
import {
  atomic,
  excluded,
  jsonRead,
  projectConfig,
  readEvidence,
  runValidation,
  validationConfig,
} from "./validation.mjs";

const SCRIPT = fileURLToPath(import.meta.url);
export const dataHome = () =>
  process.env.WORKBOARD_HOME ||
  join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "workboard");
export function localUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "agentic-os.localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error("Agentic OS must be a local HTTP origin");
  return url.origin;
}
export async function aosRequest(origin, path, body, actor, fetcher = fetch) {
  const base = localUrl(origin);
  const response = await fetcher(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin: base,
      "content-type": "application/json",
      ...(actor ? { "x-aos-agent-id": actor } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.detail || data.error || `Agentic OS HTTP ${response.status}`);
  return data;
}
export async function configure(cwd, raw, home) {
  cwd = await root(cwd);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Configuration must be an object");
  const config = { cwd };
  if (raw.coverage) config.coverage = validationConfig(raw.coverage);
  if (raw.base !== undefined) {
    if (
      typeof raw.base !== "string" ||
      !raw.base ||
      raw.base.startsWith("-") ||
      /[\u0000-\u001f]/.test(raw.base)
    )
      throw Error("Invalid base");
    config.base = raw.base;
  }
  if (raw.ticket != null) {
    if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(raw.ticket)) throw Error("Invalid ticket");
    config.ticket = raw.ticket;
  }
  if (raw.linked !== undefined) {
    if (!Array.isArray(raw.linked) || raw.linked.length > 20)
      throw Error("At most 20 explicitly linked repositories");
    config.linked = await Promise.all(raw.linked.map((p) => root(p)));
  }
  const path = join(home, "projects", `${sha(cwd)}.json`);
  const old = await jsonRead(path, {});
  await atomic(path, { ...old, ...config });
  return { configured: cwd };
}
export async function githubSnapshot(cwd, branch, home, repo, runner = run) {
  const path = join(home, "github", `${sha(cwd + ":" + branch)}.json`);
  const previous = await jsonRead(path).catch(() => null);
  if (previous && Date.now() - previous.at < 60000) return previous.value;
  let value;
  try {
    const args = [
      "gh",
      "pr",
      "view",
      ...(branch ? [branch] : []),
      ...(repo ? ["--repo", repo] : []),
      "--json",
      "number,url,headRefOid,baseRefName,reviewDecision,statusCheckRollup,isDraft,state,mergeStateStatus",
    ];
    const result = await runner(args, cwd, { timeout: 8000 });
    if (result.code) {
      if (/no pull requests? found|no pull requests? associated/i.test(result.err))
        value = { state: "none", at: Date.now() };
      else throw Error(result.err.trim() || `gh exited ${result.code}`);
    } else {
      const p = JSON.parse(result.out);
      if (
        !Number.isSafeInteger(p.number) ||
        !/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(p.url) ||
        !/^[a-f0-9]{40,64}$/.test(p.headRefOid) ||
        !Array.isArray(p.statusCheckRollup)
      )
        throw Error("Invalid GitHub response");
      value = {
        state: "loaded",
        at: Date.now(),
        number: p.number,
        url: p.url,
        head: p.headRefOid,
        base: p.baseRefName,
        approval: p.reviewDecision || "UNKNOWN",
        draft: p.isDraft === true,
        prState: p.state,
        mergeState: p.mergeStateStatus,
        checks: p.statusCheckRollup.map((c) => ({
          name: String(c.name ?? c.context ?? "Check").slice(0, 200),
          state: c.conclusion || c.status || c.state || "UNKNOWN",
          url: /^https:\/\//.test(c.detailsUrl ?? c.targetUrl ?? "")
            ? (c.detailsUrl ?? c.targetUrl)
            : null,
        })),
      };
    }
  } catch (e) {
    value = {
      state: "error",
      error: e.message.slice(0, 1000),
      at: Date.now(),
      previous: previous?.value?.state === "loaded" ? previous.value : null,
    };
  }
  await atomic(path, { at: Date.now(), value });
  return value;
}
// Only what links this terminal to others: its own messages, the consultations it started,
// and whether two of its peers also talk to each other. Other terminals' traffic stays out.
export function coordinationLinks(coordination, terminals, me) {
  const names = new Map(
    terminals.map((t) => [t.id, { harness: t.harness, name: t.name ?? t.agent?.title ?? null }]),
  );
  const at = (v) => Date.parse(v) || 0;
  const peer = (id) => ({
    peer: id,
    harness: names.get(id)?.harness,
    name: names.get(id)?.name ?? undefined,
  });
  const links = [];
  for (const m of coordination.messages ?? []) {
    if (m.from !== me && m.to !== me) continue;
    const sent = m.from === me;
    links.push({
      id: `aos:m:${m.id}`,
      at: at(m.createdAt),
      kind: sent ? "sent" : "received",
      ...peer(sent ? m.to : m.from),
      text: typeof m.preview === "string" ? m.preview.slice(0, 160) : undefined,
      status: m.status,
      source: "aos",
    });
  }
  for (const q of coordination.consultations ?? []) {
    if (q.author !== me) continue;
    for (const a of q.attempts ?? [])
      links.push({
        id: `aos:c:${q.id}:${a.id}`,
        at: at(a.startedAt ?? q.createdAt),
        kind: "consult",
        peer: `consult:${q.id}`,
        harness: a.participant?.harness,
        name: [a.participant?.harness, a.participant?.model].filter(Boolean).join(" "),
        text: typeof q.prompt === "string" ? q.prompt.slice(0, 160) : undefined,
        status: a.state,
        source: "aos",
      });
  }
  const peers = new Set(links.filter((l) => l.kind !== "consult").map((l) => l.peer));
  const peersTalk = (coordination.messages ?? []).some(
    (m) => m.from !== m.to && peers.has(m.from) && peers.has(m.to),
  );
  return { links: links.slice(0, 60), peersTalk };
}
// Native SendMessage names a session ("workboard-test-a"); Agentic OS names its terminal by id.
// Claude Code's own registry (<config>/sessions/<pid>.json, undocumented) links the two through
// the session id or pid, so one partner is not counted twice. Missing or changed files only lose
// the merge. The .key files beside them are never read.
export async function sessionAliases(
  terminals,
  dir = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "sessions"),
) {
  const aliases = {};
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => /^\d+\.json$/.test(f));
  } catch {
    return aliases;
  }
  for (const file of files) {
    // A file mid-write or of another shape is skipped, never an error.
    const s = await jsonRead(join(dir, file), null).catch(() => null);
    if (!s || typeof s.name !== "string" || !s.name) continue;
    const t = terminals.find(
      (t) => (s.sessionId && t.agent?.sessionId === s.sessionId) || (s.pid && t.pid === s.pid),
    );
    if (t)
      aliases[s.name.slice(0, 200)] = {
        id: t.id,
        harness: t.harness,
        name: t.name ?? t.agent?.title ?? undefined,
      };
  }
  return aliases;
}
// A ticket environment folder (bjenv) is not a repository: it holds one checkout per repository.
export async function childRepos(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const found = [];
  for (const e of entries) {
    if (found.length === 20) break;
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    const path = join(directory, e.name);
    if (
      await lstat(join(path, ".git")).then(
        () => true,
        () => false,
      )
    )
      found.push(await realpath(path));
  }
  return found.sort();
}
export async function snapshot(directory, home, options = {}) {
  let cwd;
  let workspace = [];
  try {
    cwd = await root(directory);
  } catch (e) {
    workspace = await childRepos(directory);
    if (!workspace.length) throw e;
    cwd = await realpath(directory);
  }
  const config = await projectConfig(home, cwd);
  let current = workspace.length
    ? null
    : await gitSnapshot(cwd, config.base, config.coverage ? excluded(config.coverage) : []);
  const branch =
    current?.branch ??
    (workspace.length
      ? (await run(["git", "branch", "--show-current"], workspace[0])).out.trim()
      : "");
  const ticket =
    options.ticket ||
    config.ticket ||
    /(?:^|[^A-Za-z0-9])([A-Z][A-Z0-9_]*-\d+)(?![A-Za-z0-9])/i.exec(branch)?.[1]?.toUpperCase() ||
    null;
  let bridge = { state: "offline", error: null, sessions: [], published: [] };
  let candidates = [];
  if (options.aos) {
    try {
      const data = await aosRequest(
        options.aos,
        `/api/workboard/context?cwd=${encodeURIComponent(cwd)}${ticket ? "&ticket=" + encodeURIComponent(ticket) : ""}`,
      );
      if (
        data.version !== 1 ||
        !Array.isArray(data.context?.repos) ||
        !Array.isArray(data.context?.sessions) ||
        !Array.isArray(data.published)
      )
        throw Error("Incompatible Agentic OS workboard API");
      candidates = data.context.repos
        .filter((r) => typeof r.cwd === "string" && typeof r.location === "string")
        .slice(0, 20);
      bridge = {
        state: "connected",
        sessions: data.context.sessions,
        published: data.published,
        errors: data.context.errors ?? [],
        links: [],
        peersTalk: false,
        aliases: {},
      };
      // Links need this terminal's identity (AOS_AGENT_ID); a session outside AOS has none.
      if (options.actor)
        try {
          const [coordination, list] = await Promise.all([
            aosRequest(options.aos, "/api/coordination"),
            aosRequest(options.aos, "/api/terminals"),
          ]);
          Object.assign(
            bridge,
            coordinationLinks(coordination, list.terminals ?? [], options.actor),
            { aliases: await sessionAliases(list.terminals ?? []) },
          );
        } catch (e) {
          bridge.errors.push(`Coordinación: ${e.message.slice(0, 200)}`);
        }
    } catch (e) {
      bridge.error = e.message.slice(0, 500);
    }
  }
  const candidatesByPath = new Map(
    (workspace.length ? workspace : [cwd]).map((p) => [
      p,
      { cwd: p, ...candidates.find((r) => r.cwd === p) },
    ]),
  );
  for (const c of candidates) candidatesByPath.set(c.cwd, c);
  for (const p of config.linked ?? []) candidatesByPath.set(p, { cwd: p });
  const candidatesList = [...candidatesByPath.values()];
  const repos = [];
  for (let offset = 0; offset < candidatesList.length; offset += 4) {
    const batch = await Promise.all(
      candidatesList.slice(offset, offset + 4).map(async (candidate) => {
        try {
          const cfg = candidate.cwd === cwd ? config : await projectConfig(home, candidate.cwd);
          let s =
            candidate.cwd === cwd
              ? current
              : await gitSnapshot(
                  candidate.cwd,
                  cfg.base,
                  cfg.coverage ? excluded(cfg.coverage) : [],
                );
          const pr = await githubSnapshot(s.cwd, s.branch, home, candidate.github);
          if (!cfg.base && pr.state === "loaded" && pr.base !== s.baseLabel)
            s = await gitSnapshot(s.cwd, pr.base, cfg.coverage ? excluded(cfg.coverage) : []);
          const coverage = await readEvidence(s.cwd, cfg.coverage, home, s);
          return {
            ...s,
            location: candidate.location ?? null,
            pr: { ...pr, appliesToLocal: pr.state === "loaded" && !s.dirty && pr.head === s.head },
            coverage,
            canRecalculate: Boolean(cfg.coverage?.command),
          };
        } catch (e) {
          return {
            cwd: candidate.cwd,
            location: candidate.location ?? null,
            error: e.message.slice(0, 1000),
            files: [],
          };
        }
      }),
    );
    repos.push(...batch);
  }
  const changed = repos.filter((r) => r.error || r.files.length);
  return {
    version: 1,
    cwd,
    ticket,
    at: Date.now(),
    repos: changed.length
      ? changed
      : repos.filter((r) => r.cwd === cwd || workspace.includes(r.cwd)),
    allRepos: repos.map((r) => ({ cwd: r.cwd, location: r.location })),
    bridge,
  };
}
export async function fileDiff(cwd, file, base) {
  const s = await gitSnapshot(cwd, base);
  const changed = s.files.find((f) => f.path === file);
  if (!changed || changed.binary) throw Error("No text change available for this file");
  let source;
  if (changed.kind === "untracked" || !s.head)
    source = await readFile(await contained(s.cwd, file), "utf8");
  else
    source = await git(s.cwd, [
      "--literal-pathspecs",
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      "--unified=3",
      s.base ?? s.head,
      "--",
      file,
    ]);
  source = source.replace(
    /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
    " ",
  );
  return { path: file, source: source.slice(0, 9000), truncated: source.length > 9000 };
}
export const quoteShell = (s) => "'" + String(s).replaceAll("'", "'\\''") + "'";
export async function launchValidation(cwd, home, options = {}) {
  cwd = await root(cwd);
  const config = await projectConfig(home, cwd);
  const coverage = validationConfig(config.coverage);
  if (!coverage.command) throw Error("Configure a coverage command first");
  if (!(options.aos && options.location) && process.platform !== "darwin")
    throw Error("Standalone coverage terminal currently requires macOS; use Agentic OS");
  const runPath = join(home, "runs", `${sha(cwd)}.json`);
  await mkdir(dirname(runPath), { recursive: true, mode: 0o700 });
  const token = randomUUID();
  let lock;
  try {
    lock = await open(`${runPath}.lock`, "wx", 0o600);
  } catch (e) {
    if (e.code === "EEXIST")
      throw Error(
        "Validation already launched or running; inspect its terminal before clearing the lock",
      );
    throw e;
  }
  await lock.writeFile(JSON.stringify({ state: "launching", cwd, token, startedAt: Date.now() }));
  await lock.close();
  const scriptDir = join(home, "launches");
  await mkdir(scriptDir, { recursive: true, mode: 0o700 });
  const script = join(scriptDir, `${randomUUID()}.command`);
  // All interpolated values are single shell arguments; only the configured argv runs.
  await writeFile(
    script,
    `#!/bin/sh\nexport WORKBOARD_HOME=${quoteShell(home)}\n${quoteShell(process.execPath)} ${quoteShell(SCRIPT)} run --cwd ${quoteShell(cwd)} --token ${quoteShell(token)}\nresult=$?\nprintf '\\nCoverage exit: %s\\n' "$result"\nexit "$result"\n`,
    { mode: 0o700 },
  );
  await chmod(script, 0o700);
  if (options.aos && options.location) {
    const created = await aosRequest(
      options.aos,
      "/api/terminals",
      { harness: "shell", location: options.location },
      options.actor,
    );
    const terminal = created.terminal ?? created;
    if (typeof terminal.id !== "string")
      throw Error("Coverage terminal creation uncertain; inspect Agentic OS before retrying");
    try {
      await aosRequest(
        options.aos,
        `/api/terminals/${encodeURIComponent(terminal.id)}/send`,
        { text: `/bin/sh ${quoteShell(script)}`, enter: true },
        options.actor,
      );
    } catch (e) {
      throw Error(
        `Terminal ${terminal.id}: command delivery uncertain. Inspect it before retrying: ${e.message}`,
      );
    }
    return { terminal: terminal.id, message: "Cobertura lanzada en Agentic OS" };
  }
  if (process.platform !== "darwin")
    throw Error("Standalone coverage terminal currently requires macOS; use Agentic OS");
  const result = await run(["open", "-a", "Terminal", script], cwd);
  if (result.code) throw Error(result.err || "Could not open coverage terminal");
  return { terminal: null, message: "Cobertura lanzada en Terminal" };
}
export async function main(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i].startsWith("--") || rest[i + 1] === undefined)
      throw Error("Expected --name value");
    flags[rest[i].slice(2)] = rest[i + 1];
  }
  const cwd = flags.cwd || process.cwd();
  const home = dataHome();
  const options = {
    aos: flags.aos,
    ticket: flags.ticket,
    location: flags.location,
    actor: process.env.AOS_AGENT_ID,
  };
  if (command === "configure") return configure(cwd, JSON.parse(flags.json), home);
  if (command === "diff") return fileDiff(cwd, flags.file, flags.base);
  if (command === "snapshot") return snapshot(cwd, home, options);
  if (command === "launch") return launchValidation(cwd, home, options);
  if (command === "run") {
    const directory = await root(cwd);
    const config = await projectConfig(home, directory);
    const result = await runValidation(directory, config.coverage, home, flags.token);
    process.exitCode = result.exitCode;
    return result;
  }
  throw Error(
    "Commands: snapshot, diff --file <path>, configure --json <object>, launch, run; all take --cwd <path>",
  );
}
if (
  process.argv[1] &&
  (await realpath(process.argv[1]).catch(() => "")) === (await realpath(SCRIPT))
) {
  main(process.argv.slice(2))
    .then((value) => console.log(JSON.stringify(value)))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
