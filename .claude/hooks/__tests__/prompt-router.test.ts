import { describe, expect, spyOn, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildRouterNote,
  DEEP_SKILLS_LINE,
  effortLine,
  buildSystemPrompt,
  enabledPluginRoots,
  glossaryFiles,
  killPrevious,
  loadCatalog,
  loadGlossary,
  loadRouterAgent,
  parseRouterOutput,
  routablePrompt,
  ROUTER_AGENT_FILE,
  routerArgs,
  routerContext,
  routerNoteFile,
  runRouter,
  takeRouterNote,
} from "../prompt-router";
import { frontmatter } from "../../scripts/lib/skill-metadata";

const attended = { CLAUDE_CODE_SESSION_ATTENDED: "1", CLAUDE_CODE_ENTRYPOINT: "cli" };
const payload = (prompt: string) => JSON.stringify({ prompt, session_id: "s1", cwd: "/x" });
const LONG = "revisa la pr de esta rama y deja comentarios sin publicar";

function skill(dir: string, name: string, extra = "") {
  mkdirSync(join(dir, name), { recursive: true });
  writeFileSync(join(dir, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${name} does   things\n${extra}---\n# ${name}\n`);
}

describe("prompt-router: routablePrompt (gate)", () => {
  test("passes an attended human prompt of six words or more", () => {
    expect(routablePrompt(payload(LONG), attended, "darwin")).toBe(LONG);
  });

  test("skips short replies, slash commands, non-human payloads and malformed input", () => {
    for (const p of ["sigue", "sí, hazlo así por favor", "/dev-workflow arregla el bug del login de la app", "<task-notification>done and more words here ok</task-notification>"]) {
      expect(routablePrompt(payload(p), attended)).toBeNull();
    }
    expect(routablePrompt("not json", attended)).toBeNull();
  });

  test("reads the task of /goal", () => {
    expect(routablePrompt(payload(`/goal ${LONG}`), attended, "darwin")).toBe(LONG);
  });

  test("skips its own child, an explicit opt-out and headless sessions", () => {
    expect(routablePrompt(payload(LONG), { ...attended, PONEGLYPH_ROUTER: "1" })).toBeNull();
    expect(routablePrompt(payload(LONG), { ...attended, PONEGLYPH_ROUTER: "off" })).toBeNull();
    expect(routablePrompt(payload(LONG), { CLAUDE_CODE_SESSION_ATTENDED: "0", CLAUDE_CODE_ENTRYPOINT: "cli" })).toBeNull();
    expect(routablePrompt(payload(LONG), { CLAUDE_CODE_ENTRYPOINT: "sdk-cli" })).toBeNull();
  });

  test("in Codex and Grok, skips runs launched from a Claude session and Codex $commands", () => {
    expect(routablePrompt(payload(LONG), attended, "darwin", "codex")).toBe(LONG);
    expect(routablePrompt(payload(LONG), { ...attended, CLAUDECODE: "1" }, "darwin", "codex")).toBeNull();
    expect(routablePrompt(payload(LONG), { ...attended, CLAUDECODE: "1" }, "darwin", "grok")).toBeNull();
    expect(routablePrompt(payload(LONG), { ...attended, CLAUDECODE: "1" }, "darwin")).toBe(LONG);
    expect(routablePrompt(payload(`$flow ${LONG}`), attended, "darwin", "codex")).toBeNull();
    expect(routablePrompt(payload(`$flow ${LONG}`), attended, "darwin")).toBe(`$flow ${LONG}`);
  });

  test("does not run on Windows", () => {
    expect(routablePrompt(payload(LONG), attended, "win32")).toBeNull();
  });

  test("caps the text sent to the router", () => {
    expect(routablePrompt(payload(`${LONG} ${"x".repeat(5000)}`), attended, "darwin")!.length).toBe(3000);
  });
});

describe("prompt-router: catalog", () => {
  const root = mkdtempSync(join(tmpdir(), "router-catalog-"));
  const config = join(root, "config");
  const cwd = join(root, "project");
  skill(join(cwd, ".claude", "skills"), "dev-workflow");
  skill(join(config, "skills"), "dev-workflow", "disable-model-invocation: true\n"); // shadowed by the project copy
  skill(join(config, "skills"), "flow", "when_to_use: plan a feature\n");
  skill(join(config, "skills"), "manual", "disable-model-invocation: true\n");
  skill(join(config, "skills"), "personal");
  skill(join(config, "skills"), "gone");
  skill(join(config, "skills", "synced", "account-1"), "pdf");
  skill(join(root, "work"), "team-lessons");
  skill(join(root, "other"), "hidden");
  skill(join(root, "elsewhere"), "foreign");
  writeFileSync(join(config, "settings.json"), JSON.stringify({
    skillOverrides: { flow: "name-only", personal: "user-invocable-only", gone: "off" },
    enabledPlugins: { "work@market": true, "other@market": false, "elsewhere@market": true },
  }));
  mkdirSync(join(config, "plugins"), { recursive: true });
  writeFileSync(join(config, "plugins", "installed_plugins.json"), JSON.stringify({ plugins: {
    "work@market": [{ scope: "user", installPath: root + "/work-root" }],
    "other@market": [{ scope: "user", installPath: root + "/other-root" }],
    "elsewhere@market": [{ scope: "project", projectPath: "/some/other/project", installPath: root + "/elsewhere-root" }],
  } }));
  for (const [plugin, name] of [["work-root", "work"], ["other-root", "other"], ["elsewhere-root", "elsewhere"]]) {
    mkdirSync(join(root, plugin), { recursive: true });
    Bun.spawnSync(["cp", "-R", join(root, name), join(root, plugin, "skills")]);
  }

  test("keeps only enabled plugins installed for the user or this project", () => {
    expect(enabledPluginRoots(cwd, config).map((p) => p.name)).toEqual(["work"]);
  });

  test("names plugin skills plugin:skill and drops skills the model cannot load", () => {
    const names = loadCatalog(cwd, config).map((c) => c.name).sort();
    expect(names).toEqual(["anthropic-skills:pdf", "dev-workflow", "flow", "work:team-lessons"]);
    expect(loadCatalog(cwd, config).find((c) => c.name === "dev-workflow")!.description).toBe("dev-workflow does things");
  });

  test("keeps name-only skills with description and when_to_use, since only the router reads them", () => {
    expect(loadCatalog(cwd, config).find((c) => c.name === "flow")!.description).toBe("flow does things plan a feature");
  });
});

describe("prompt-router: glossary and agent", () => {
  test("merges glossary files and ignores missing or invalid ones", () => {
    const dir = mkdtempSync(join(tmpdir(), "router-glossary-"));
    writeFileSync(join(dir, "a.json"), JSON.stringify({ Poneglyph: ["pone grif"], Haiku: ["Jaiku"] }));
    writeFileSync(join(dir, "b.json"), JSON.stringify({ Poneglyph: ["Pone Griff", "pone grif"], bad: "x" }));
    writeFileSync(join(dir, "c.json"), "{");
    expect(loadGlossary([join(dir, "a.json"), join(dir, "b.json"), join(dir, "c.json"), join(dir, "none.json")]))
      .toEqual({ Poneglyph: ["pone grif", "Pone Griff"], Haiku: ["Jaiku"] });
  });

  test("fills the template", () => {
    const out = buildSystemPrompt("G: {{glossary}}\nC:\n{{catalog}}", [{ name: "a", description: "does a" }], { X: ["ex"] });
    expect(out).toBe("G: X: ex\nC:\n- a: does a");
  });

  test("the shipped agent gets the catalog and drops the subagent-only fields for --agents", () => {
    const { fields } = frontmatter(readFileSync(ROUTER_AGENT_FILE, "utf8"));
    expect(fields).toMatchObject({ name: "prompt-router", tools: "Read", omitClaudeMd: true });
    const agent = loadRouterAgent(ROUTER_AGENT_FILE, [{ name: "a", description: "does a" }], { X: ["ex"] });
    expect(agent.name).toBe("prompt-router");
    expect(agent.definition).toMatchObject({ model: expect.any(String), description: expect.any(String) });
    expect(agent.definition).not.toHaveProperty("tools");
    expect(agent.definition).not.toHaveProperty("omitClaudeMd");
    expect(agent.definition).not.toHaveProperty("maxTurns");
    expect(agent.definition.prompt).toEndWith(routerContext([{ name: "a", description: "does a" }], { X: ["ex"] }));
    expect(agent.definition.prompt).toContain("- a: does a");
    expect(agent.definition.prompt).toContain("X: ex");
    expect(agent.definition.prompt).not.toContain("{{");
    expect(Object.keys(loadGlossary([join(import.meta.dir, "..", "router", "glossary.json")])).length).toBeGreaterThan(5);
  });

  test("reads the core, the user's own and each plugin's glossary", () => {
    const files = glossaryFiles("/nowhere", "/cfg");
    expect(files[0]).toEndWith(join("router", "glossary.json"));
    expect(files[1]).toBe(join("/cfg", "router-glossary.json"));
  });

  test("runs the agent with no tools and a JSON schema", () => {
    const args = routerArgs({ name: "r", definition: { prompt: "p" } });
    expect(args[args.indexOf("--tools") + 1]).toBe("");
    expect(args[args.indexOf("--agent") + 1]).toBe("r");
    expect(JSON.parse(args[args.indexOf("--agents") + 1])).toEqual({ r: { prompt: "p" } });
    expect(JSON.parse(args[args.indexOf("--json-schema") + 1]).properties.skills.maxItems).toBe(3);
    expect(args).not.toContain("--system-prompt");
  });
});

describe("prompt-router: parseRouterOutput", () => {
  const catalog = [{ name: "dev-workflow", description: "" }, { name: "pr-review", description: "" }, { name: "work:team-lessons", description: "" }];
  const envelope = (result: string, extra = {}) => JSON.stringify({ type: "result", result, ...extra });
  const prompt = "revisa la pr en pone grif y usa /pr-review con cuidado";

  test("reads a fenced answer and validates it against the catalog and the prompt", () => {
    const answer = {
      fixes: [{ heard: "Pone Grif", meant: "Poneglyph" }, { heard: "invented", meant: "X" }, { heard: "la pr", meant: "la pr" }],
      skills: [{ name: "pr-review", why: "named" }, { name: "dev-workflow", why: "  plan\nthe fix " }, { name: "made-up" }, { name: "dev-workflow" }, { name: "work:team-lessons", why: "company rules" }],
    };
    expect(parseRouterOutput(envelope("```json\n" + JSON.stringify(answer) + "\n```"), prompt, catalog)).toEqual({
      fixes: [{ heard: "Pone Grif", meant: "Poneglyph" }],
      skills: [{ name: "dev-workflow", why: "plan the fix" }, { name: "work:team-lessons", why: "company rules" }],
      effort: "",
    });
  });

  test("with a glossary, keeps only fixes that land on a glossary term", () => {
    const answer = { fixes: [{ heard: "pone grif", meant: "Poneglyph" }, { heard: "con cuidado", meant: "con cuidao" }], skills: [] };
    expect(parseRouterOutput(envelope(JSON.stringify(answer)), prompt, catalog, { glossary: { Poneglyph: ["pone grif"] } })!.fixes)
      .toEqual([{ heard: "pone grif", meant: "Poneglyph" }]);
  });

  test("drops skills the session already loaded", () => {
    const answer = { fixes: [], skills: [{ name: "dev-workflow" }, { name: "work:team-lessons" }] };
    expect(parseRouterOutput(envelope(JSON.stringify(answer)), prompt, catalog, { loaded: new Set(["dev-workflow"]) })!.skills.map((s) => s.name))
      .toEqual(["work:team-lessons"]);
  });

  test("adds a process reason after the list, once and within the cap", () => {
    const answer = { fixes: [], process: { "dev-workflow": "build the export", "pr-review": "review it", "work:team-lessons": "" }, skills: [{ name: "pr-review", why: "w" }] };
    expect(parseRouterOutput(envelope(JSON.stringify(answer)), "p", catalog)!.skills).toEqual([{ name: "pr-review", why: "w" }, { name: "dev-workflow", why: "build the export" }]);
  });

  test("reads an empty, 'none' or 'N/A' process answer as no, and a legacy true as yes", () => {
    const answer = { fixes: [], process: { "dev-workflow": " None. ", "pr-review": true, "work:team-lessons": "N/A", "changes-verify": "  " }, skills: [] };
    expect(parseRouterOutput(envelope(JSON.stringify(answer)), "p", catalog)!.skills).toEqual([{ name: "pr-review", why: "" }]);
  });

  test("prefers the schema-checked structured_output", () => {
    const out = JSON.stringify({ type: "result", result: "ignored", structured_output: { fixes: [], skills: [{ why: "w", name: "pr-review" }] } });
    expect(parseRouterOutput(out, "p", catalog)).toEqual({ fixes: [], skills: [{ name: "pr-review", why: "w" }], effort: "" });
  });

  test("returns null on CLI errors and off-contract text", () => {
    expect(parseRouterOutput("not json", prompt, catalog)).toBeNull();
    expect(parseRouterOutput(envelope("{}", { is_error: true }), prompt, catalog)).toBeNull();
    expect(parseRouterOutput(envelope("I cannot help"), prompt, catalog)).toBeNull();
    expect(parseRouterOutput(envelope("{bad json}"), prompt, catalog)).toBeNull();
  });

  test("reads the effort answer: a reason is kept and trimmed, an empty or 'no' answer is none", () => {
    const parse = (effort: unknown) => parseRouterOutput(envelope(JSON.stringify({ fixes: [], skills: [], effort })), "p", catalog)!.effort;
    expect(parse("  race between concurrent\ntoken refreshes ")).toBe("race between concurrent token refreshes");
    expect(parse("")).toBe("");
    expect(parse(" None. ")).toBe("");
    expect(parse('""')).toBe("");
    expect(parse(undefined)).toBe("");
  });

  test("caps skills at three", () => {
    const many = { skills: ["a", "b", "c", "d"].map((name) => ({ name })) };
    const cat = ["a", "b", "c", "d"].map((name) => ({ name, description: "" }));
    expect(parseRouterOutput(envelope(JSON.stringify(many)), "p", cat)!.skills.map((s) => s.name)).toEqual(["a", "b", "c"]);
  });
});

describe("prompt-router: buildRouterNote", () => {
  test("is empty when the router found nothing", () => {
    expect(buildRouterNote({ fixes: [], skills: [] }, "x")).toBe("");
  });

  test("names the prompt it belongs to, escaped, and lists fixes and skills", () => {
    const note = buildRouterNote(
      { fixes: [{ heard: "Jaiku", meant: "Haiku" }], skills: [{ name: "dev-workflow", why: "fix plan" }] },
      'arregla "esto" <ya> con Jaiku antes de que se rompa todo otra vez',
    );
    expect(note).toStartWith('<prompt-router re="arregla &quot;esto&quot; &lt;ya&gt; con Jaiku antes de que …">');
    expect(note).toContain('"Jaiku" → Haiku');
    expect(note).toContain("- Skill(dev-workflow): fix plan");
    expect(note).toContain("`Router: <skill> sí (<why>); <skill> no (<why>)`, then load the yes ones with the Skill tool.");
    expect(note).not.toContain("Advisory");
    expect(note).toEndWith("</prompt-router>");
  });

  test("warns that the CLAUDE.md summary is no reason to decline dev-workflow or drillme-clarify", () => {
    const prompt = "revisa la PR del login antes de mergear hoy";
    expect(buildRouterNote({ fixes: [], skills: [{ name: "drillme-clarify", why: "" }] }, prompt)).toContain(DEEP_SKILLS_LINE);
    expect(buildRouterNote({ fixes: [], skills: [{ name: "pr-review", why: "" }] }, prompt)).not.toContain(DEEP_SKILLS_LINE);
  });

  test("asks the main model to propose a higher effort, per host, even with no skills", () => {
    const prompt = "arregla la carrera entre refrescos de token concurrentes";
    const note = buildRouterNote({ fixes: [], skills: [], effort: "token refresh race" }, prompt);
    expect(note).toContain(effortLine("token refresh race"));
    expect(note).toContain("propose `/effort high` to the user in one line");
    expect(effortLine("x", "codex")).toContain("`-c model_reasoning_effort=xhigh`");
    expect(effortLine("x", "grok")).toContain("`--effort xhigh`");
    expect(buildRouterNote({ fixes: [], skills: [{ name: "pr-review", why: "" }], effort: "" }, prompt)).not.toContain("Hard task");
  });

  test("names skills the way each host invokes them", () => {
    const result = { fixes: [], skills: [{ name: "dev-workflow", why: "fix" }] };
    expect(buildRouterNote(result, "p", "codex")).toContain("- $dev-workflow: fix");
    expect(buildRouterNote(result, "p", "codex")).toContain("SKILL.md");
    expect(buildRouterNote(result, "p", "grok")).toContain("- /dev-workflow: fix");
  });
});

describe("prompt-router: takeRouterNote (Codex and Grok delivery)", () => {
  const dir = mkdtempSync(join(tmpdir(), "router-note-"));

  test("hands a fresh note over once", () => {
    writeFileSync(routerNoteFile("s-1", dir), "note");
    expect(takeRouterNote("s-1", dir)).toBe("note");
    expect(takeRouterNote("s-1", dir)).toBeNull();
  });

  test("drops a note older than ten minutes", () => {
    const file = routerNoteFile("s-2", dir);
    writeFileSync(file, "old");
    expect(takeRouterNote("s-2", dir, Date.now() + 11 * 60_000)).toBeNull();
    expect(existsSync(file)).toBe(false);
  });

  test("keeps the session id inside the note directory", () => {
    expect(routerNoteFile("../../etc/x", dir)).toBe(join(dir, "etcx.note"));
  });
});

// POSIX only: the router kills its process group, so routablePrompt turns it off on win32.
describe.skipIf(process.platform === "win32")("prompt-router: runRouter", () => {
  const dir = mkdtempSync(join(tmpdir(), "router-run-"));
  const agent = { name: "r", definition: { prompt: "sys" } };
  const fake = (name: string, body: string) => {
    const file = join(dir, name);
    writeFileSync(file, `#!/bin/bash\n${body}\n`);
    chmodSync(file, 0o755);
    return file;
  };

  test("passes the prompt on stdin, marks the child and clears its pidfile", async () => {
    process.env.PONEGLYPH_CLAUDE_BIN = fake("ok.sh", 'cat > "$(dirname "$0")/stdin.txt"; echo "$PONEGLYPH_ROUTER" > "$(dirname "$0")/env.txt"; echo \'{"result":"{}"}\'');
    const pidFile = join(dir, "s.pid");
    const run = await runRouter(agent, "-hola", pidFile);
    expect(run).toEqual({ outcome: "ok", stdout: '{"result":"{}"}\n' });
    expect(readFileSync(join(dir, "stdin.txt"), "utf8")).toBe("<prompt>\n-hola\n</prompt>");
    await runRouter(agent, "hola", null, undefined, "<past>\n- x\n</past>");
    expect(readFileSync(join(dir, "stdin.txt"), "utf8")).toBe("<prompt>\nhola\n</prompt>\n<past>\n- x\n</past>");
    expect(readFileSync(join(dir, "env.txt"), "utf8").trim()).toBe("1");
    expect(existsSync(pidFile)).toBe(false);
  });

  test("kills a slow router at the timeout", async () => {
    process.env.PONEGLYPH_CLAUDE_BIN = fake("slow.sh", "sleep 5; echo late");
    const started = Date.now();
    const run = await runRouter(agent, "p", null, 300);
    expect(run.outcome).toBe("timeout");
    expect(Date.now() - started).toBeLessThan(3000);
  });

  test("kills the previous router only while its pidfile is fresh", async () => {
    const child = Bun.spawn(["sleep", "30"], { detached: true } as any);
    const fresh = join(dir, "fresh.pid");
    writeFileSync(fresh, String(child.pid));
    killPrevious(fresh);
    expect(await child.exited).not.toBe(0);

    const survivor = Bun.spawn(["sleep", "30"], { detached: true } as any);
    const stale = join(dir, "stale.pid");
    writeFileSync(stale, String(survivor.pid));
    const old = (Date.now() - 60_000) / 1000;
    utimesSync(stale, old, old);
    killPrevious(stale);
    expect(existsSync(stale)).toBe(false);
    expect(survivor.killed).toBe(false);
    expect(survivor.exitCode).toBeNull();
    survivor.kill();
  });

  test("never signals pid 1 or below: kill(-1) would reach every process of the user", () => {
    const kill = spyOn(process, "kill").mockImplementation(() => true);
    try {
      for (const pid of ["1", "0", "-1", "abc"]) {
        const file = join(dir, `bad-${pid}.pid`);
        writeFileSync(file, pid);
        killPrevious(file);
        expect(existsSync(file)).toBe(false);
      }
      expect(kill).not.toHaveBeenCalled();
    } finally {
      kill.mockRestore();
    }
  });

  test("reports a missing binary as an error", async () => {
    process.env.PONEGLYPH_CLAUDE_BIN = join(dir, "missing");
    expect((await runRouter(agent, "p", null)).outcome).toBe("error");
    delete process.env.PONEGLYPH_CLAUDE_BIN;
  });
});
