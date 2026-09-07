import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check, frontmatter, privacyMatches, readSource, render, validate, type Source } from "../check-config";

const skill = (name = "sample", description = "A valid task-specific description.", extra = "", body = "Read the relevant source.") => `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n${extra}---\n${body}\n`;
const source = (entries: Record<string, string> = {}): Source => ({ files: new Map(Object.entries({ ".claude/skills/sample/SKILL.md": skill(), ...entries })), links: [] });
const errors = (s: Source, options = {}) => validate(s, options).findings.filter(f => f.severity === "error").map(f => f.rule);
const roots: string[] = [];

it("checks the shared action manifest as YAML configuration", () => {
  expect(errors(source({ "action.yml": "runs: [unterminated" }))).toContain("config.parse");
  expect(errors(source({ "action.yaml": "- not a mapping" }))).toContain("config.shape");
  expect(errors(source({ "action.yml": "name: Static gate\nruns:\n  using: composite\n  steps: []\n" }))).toEqual([]);
});
const write = (root: string, p: string, text: string) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), text); };
const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: ["pipe", "pipe", "pipe"] });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "poneglyph-config-test-")); roots.push(root);
  git(root, "init", "--quiet"); git(root, "config", "core.autocrlf", "false");
  write(root, ".gitignore", ".claude/doctor.local.json\n");
  write(root, ".claude/skills/sample/SKILL.md", skill());
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("configuration metadata contracts", () => {
  it("accepts the portable minimum and documented host extensions", () => {
    expect(errors(source({ ".claude/skills/sample/SKILL.md": skill("sample", "Useful.", "when_to_use: 'An explicit task'\neffort: xhigh\npaths: ['src/**']\nallowed-tools: [Read, Grep]\nmetadata:\n  keywords: 'source, task'\n") }))).toEqual([]);
  });
  it("decodes folded YAML and CRLF instead of counting indentation or quotes", () => {
    const text = "---\r\nname: sample\r\ndescription: >-\r\n  first line\r\n  second line\r\n---\r\nRead.\r\n";
    expect(frontmatter(text).fields.description).toBe("first line second line");
    expect(errors(source({ ".claude/skills/sample/SKILL.md": text }))).toEqual([]);
  });
  it.each(["", "   ", "x".repeat(1025)])("rejects invalid descriptions", description => {
    expect(errors(source({ ".claude/skills/sample/SKILL.md": skill("sample", description) }))).toContain("metadata.description");
  });
  it("counts Unicode characters, not UTF-16 units", () => {
    expect(errors(source({ ".claude/skills/sample/SKILL.md": skill("sample", "🧪".repeat(1024)) }))).toEqual([]);
  });
  it("accepts a 64-character name and rejects 65", () => {
    for (const length of [64, 65]) {
      const name = "a".repeat(length);
      const result = errors({ files: new Map([[`.claude/skills/${name}/SKILL.md`, skill(name)]]), links: [] });
      expect(result.includes("metadata.name")).toBe(length === 65);
    }
  });
  it.each(["Wrong", "bad--name", "-sample", "different"])("rejects invalid or mismatched names", name => {
    expect(errors(source({ ".claude/skills/sample/SKILL.md": skill(name) }))).toContain("metadata.name");
  });
  it("rejects malformed YAML, non-mappings, missing headers, and numeric descriptions", () => {
    for (const text of ["---\n[broken\n---\nBody", "---\n- item\n---\nBody", "no header", "---\nname: sample\ndescription: 42\n---\nBody"]) {
      expect(errors(source({ ".claude/skills/sample/SKILL.md": text })).length).toBeGreaterThan(0);
    }
  });
  it("rejects invalid known field types without treating unknown extensions as portable proof", () => {
    expect(errors(source({ ".claude/skills/sample/SKILL.md": skill("sample", "Useful.", "disable-model-invocation: 'false'\nmetadata: { count: 2 }\npaths: src\n") }))).toEqual(expect.arrayContaining(["metadata.boolean", "metadata.map", "metadata.paths"]));
  });
  it("warns on unknown extensions rather than silently certifying them", () => {
    const report = validate(source({ ".claude/skills/sample/SKILL.md": skill("sample", "Useful.", "future-extension: native\n") }));
    expect(report.findings).toContainEqual(expect.objectContaining({ rule: "metadata.extension", severity: "warning" }));
  });
  it("warns about a long body without blocking it", () => {
    const report = validate(source({ ".claude/skills/sample/SKILL.md": skill("sample", "Useful.", "", "line\n".repeat(500)) }));
    expect(report.findings).toEqual([expect.objectContaining({ rule: "skill.length", severity: "warning" })]);
  });
  it("supports legacy commands without requiring a name field", () => {
    expect(errors(source({ ".claude/commands/hello.md": "---\ndescription: Say hello.\n---\nSay hello.\n" }))).toEqual([]);
  });
  it("detects command shadowing and missing entrypoints", () => {
    expect(errors(source({ ".claude/commands/sample.md": "---\ndescription: Hi.\n---\nHi.", ".claude/skills/broken/references/doc.md": "Read." }))).toEqual(expect.arrayContaining(["metadata.collision", "skill.entry"]));
  });
  it("checks explicit local links but leaves examples and remote URLs alone", () => {
    const s = source({ ".claude/skills/sample/SKILL.md": skill("sample", "Useful.", "", '[Read](references/guide.md)\n[Web](https://example.com)\n```md\n[Example](missing.md)\n```\n`[code](missing.md)`'), ".claude/skills/sample/references/guide.md": "Details." });
    expect(errors(s)).toEqual([]);
    s.files.delete(".claude/skills/sample/references/guide.md");
    expect(errors(s)).toEqual(["reference.missing"]);
  });
  it("does not pass an empty inventory", () => { expect(errors({ files: new Map(), links: [] })).toContain("inventory.empty"); });
});

describe("native configuration structure", () => {
  it.each(["[broken", 'x = 1\nx = 2', 'x = "unterminated'])("rejects malformed TOML instead of accepting a partial configuration", text => {
    expect(errors(source({ ".codex/config.toml": text }))).toEqual(["config.parse"]);
  });
  it("rejects primitive permission objects and malformed MCP URLs", () => {
    expect(errors(source({ ".claude/settings.global.json": '{"permissions":"allow all"}' }))).toContain("config.permissions");
    for (const url of ["https://", "file:///tmp/server", 42]) expect(errors(source({ ".mcp.json": JSON.stringify({ mcpServers: { server: { url } } }) }))).toContain("mcp.transport");
    expect(errors(source({ ".mcp.json": JSON.stringify({ mcpServers: { server: { url: "https://user:password@example.com" } } }) }))).toContain("mcp.credentials");
  });
  it("checks JSON, YAML and TOML without executing anything", () => {
    expect(errors(source({ ".grok/config.toml": '[models]\ndefault = "chosen-at-runtime"', ".github/workflows/test.yml": "name: CI\non: push\n", ".mcp.json": JSON.stringify({ mcpServers: { server: { command: "DO-NOT-EXECUTE", args: ["argument"] } } }) }))).toEqual([]);
    expect(errors(source({ ".grok/config.toml": "[broken", ".claude/settings.global.json": "{broken" }))).toEqual(["config.parse", "config.parse"]);
  });
  it("rejects invalid MCP transport and argument types", () => {
    const mcp = { mcpServers: { bad: { command: "cmd", url: "https://example.com", args: "not-an-array" } } };
    expect(errors(source({ ".mcp.json": JSON.stringify(mcp) }))).toEqual(["mcp.transport", "mcp.args"]);
  });
  it("validates registered hook paths, types and timeouts", () => {
    const hooks = { Stop: [{ hooks: [{ type: "command", command: "bun $HOME/.claude/hooks/missing.ts", timeout: 0, async: "true" }] }] };
    expect(errors(source({ ".claude/settings.global.json": JSON.stringify({ hooks }) }))).toEqual(expect.arrayContaining(["hooks.path", "hooks.timeout", "hooks.async"]));
  });
  it("keeps the public project profile hook-free and private activation out of core defaults", () => {
    expect(errors(source({ ".claude/settings.json": '{"hooks": {}}', ".claude/settings.global.json": '{"enabledPlugins":{"poneglyph-work@poneglyph-work":true}}' }))).toEqual(expect.arrayContaining(["config.scope", "core.private-dependency"]));
  });
});

describe("private addon and data boundaries", () => {
  const addon = (): Source => ({ files: new Map([["skills/team-notes/SKILL.md", skill("team-notes")], [".claude-plugin/plugin.json", '{"name":"private-addon"}'], ["memory/team.md", "Private project facts."]]), links: [] });
  it("accepts unique skills and memory without its own doctrine", () => { expect(errors(addon(), { addon: true, baseSkills: new Set(["dev", "verify"]) })).toEqual([]); });
  it("rejects malformed plugin manifests and paths escaping the checkout", () => {
    const s = addon(); s.files.set(".claude-plugin/plugin.json", '{"name":false,"version":42,"skills":"../outside","hooks":{}}');
    expect(errors(s)).toEqual(expect.arrayContaining(["plugin.name", "plugin.version", "plugin.path", "addon.manifest"]));
    s.files.set(".claude-plugin/marketplace.json", '{"name":"private-addon","owner":{},"plugins":[false]}');
    expect(errors(s)).toContain("plugin.marketplace");
  });
  it("rejects copied doctrine, hooks and core skill names", () => {
    const s = addon(); s.files.set("AGENTS.md", "Duplicate"); s.files.set("hooks/hooks.json", "{}"); s.files.set("skills/dev/SKILL.md", skill("dev"));
    expect(errors(s, { addon: true, baseSkills: new Set(["dev"]) })).toEqual(expect.arrayContaining(["addon.doctrine", "addon.content", "addon.duplicate"]));
  });
  it("finds private terms in historical documents, JavaScript and file names", () => {
    const files = new Map([[".claude/plans/old.md", "PrivateCo"], ["legacy.js", "privateco"], ["PrivateCo.md", "notes"]]);
    expect(privacyMatches(files, ["privateco"])).toHaveLength(3);
    expect(privacyMatches(files, [])).toEqual([]);
  });
  it("redacts private paths, values and regex metacharacters in diagnostics", () => {
    const s = source({ "private.co.md": "secret private.co" });
    const report = validate(s, { privacyTerms: ["private.co"] });
    expect(render(report, ["private.co"])).not.toContain("private.co");
    expect(render(report, ["private.co"])).not.toContain("secret");
    expect(render(report, ["private.co"])).toContain("[PRIVATE]");
  });
  it("blocks force-added private configuration", () => {
    expect(errors(source({ ".claude/doctor.local.json": "{}", ".env": "secret", ".claude/settings.local.json": "{}" }))).toEqual(["privacy.file", "privacy.file", "privacy.file"]);
  });
  it("does not include raw parse errors in the CLI output", () => {
    const root = fixture(); write(root, ".claude/doctor.local.json", '{"privacyTerms": ["PRIVATE-SENTINEL"');
    const result = Bun.spawnSync([process.execPath, join(import.meta.dir, "../check-config.ts"), "--root", root]);
    expect(result.exitCode).toBe(2);
    expect(result.stdout.toString() + result.stderr.toString()).not.toContain("PRIVATE-SENTINEL");
  });
});

describe("real Git snapshot input", () => {
  it.skipIf(process.platform !== "win32")("accepts Windows root aliases without accepting subdirectories", () => {
    const root = fixture(); git(root, "add", ".");
    const short = execFileSync("cmd.exe", ["/d", "/c", `for %I in ("${root}") do @echo %~sI`], { encoding: "utf8", windowsVerbatimArguments: true }).trim();
    // Short names may be disabled on a volume; drive-case still exercises alias resolution.
    for (const alias of [short, root.replace(/^[A-Z]:/, drive => drive.toLowerCase()), root.replace("poneglyph-config-test-", "PONEGLYPH-CONFIG-TEST-")]) {
      for (const staged of [false, true]) {
        expect(readSource(alias, staged).files.get(".claude/skills/sample/SKILL.md")).toBe(skill());
        expect(() => readSource(join(alias, ".claude"), staged)).toThrow("--root must be the repository root.");
      }
    }
  });
  it("allows ignored machine activation but rejects publishing that same overlay", () => {
    const root = fixture();
    const overlay = ".claude/settings.machine.json";
    write(root, ".gitignore", ".claude/doctor.local.json\n.claude/settings.machine.json\n");
    write(root, overlay, '{"enabledPlugins":{"poneglyph-work@poneglyph-work":true}}');
    expect(readSource(root).files.has(overlay)).toBe(false);
    expect(errors(readSource(root))).toEqual([]);
    git(root, "add", "."); git(root, "add", "-f", "--", overlay);
    expect(errors(readSource(root, true))).toContain("privacy.file");
  });
  it("detects source skills accidentally hidden by ignore rules", () => {
    const root = fixture(); write(root, ".gitignore", ".claude/skills/hidden/\n");
    write(root, ".claude/skills/hidden/SKILL.md", skill("hidden"));
    expect(errors(readSource(root))).toContain("skill.ignored");
  });
  it("cannot hide private filenames or configuration using binary bytes", () => {
    const root = fixture(); write(root, "AUTH.JSON", "\0secret"); write(root, ".claude/settings.global.json", "\0{}");
    const findings = errors(readSource(root));
    expect(findings).toContain("privacy.file"); expect(findings).toContain("source.encoding");
  });
  it("blocks ambiguous roots instead of allowing an addon to masquerade as core", () => {
    const root = fixture(); write(root, ".claude-plugin/plugin.json", '{"name":"private-addon"}'); write(root, ".claude/settings.global.json", "{}");
    expect(check(root).report.findings.some(f => f.rule === "config.ambiguous-root")).toBe(true);
  });
  it("runs the shared pre-commit entrypoint against staged addon data", () => {
    const root = fixture();
    rmSync(join(root, ".claude/skills/sample"), { recursive: true });
    const p = "skills/team-notes/SKILL.md";
    write(root, p, skill("team-notes")); write(root, ".claude-plugin/plugin.json", '{"name":"private-addon"}');
    git(root, "add", ".");
    const run = () => Bun.spawnSync([process.execPath, join(import.meta.dir, "../pre-commit.ts")], { cwd: root });
    expect(run().exitCode).toBe(0);
    write(root, p, skill("team-notes", "")); git(root, "add", p); write(root, p, skill("team-notes"));
    const rejected = run(); expect(rejected.exitCode).toBe(1);
    expect(rejected.stdout.toString()).toContain("metadata.description");
  });
  it("does not allow an unstaged repair to conceal a staged defect", () => {
    const root = fixture(); const p = ".claude/skills/sample/SKILL.md";
    write(root, p, skill("sample", "")); git(root, "add", "."); write(root, p, skill());
    expect(errors(readSource(root, true))).toContain("metadata.description");
    expect(errors(readSource(root))).toEqual([]);
    expect(git(root, "diff", "--cached", "--name-only").toString()).toContain(p);
  });
  it("ignores unstaged additions in index mode, but discovers them in source mode", () => {
    const root = fixture(); git(root, "add", "."); write(root, ".claude/skills/new/SKILL.md", "bad");
    expect(errors(readSource(root, true))).toEqual([]);
    expect(errors(readSource(root))).toContain("metadata.parse");
  });
  it("detects a staged deleted target despite its unstaged restoration", () => {
    const root = fixture(); write(root, ".claude/skills/sample/SKILL.md", skill("sample", "Useful.", "", "[Read](references/doc.md)"));
    write(root, ".claude/skills/sample/references/doc.md", "Read."); git(root, "add", ".");
    git(root, "rm", "--cached", "--", ".claude/skills/sample/references/doc.md");
    expect(errors(readSource(root, true))).toContain("reference.missing");
  });
  it("does not follow directory junctions into private data", () => {
    const root = fixture(); const other = fixture(); write(other, "PRIVATE-SENTINEL.md", "private data");
    symlinkSync(other, join(root, "outside"), process.platform === "win32" ? "junction" : "dir");
    const s = readSource(root);
    expect([...s.files.values()].join("")).not.toContain("private data");
    expect(s.links.length).toBeGreaterThan(0);
  });
  it("rejects non-root directories and reports a missing private policy honestly", () => {
    const root = fixture(); expect(() => readSource(join(root, ".claude"))).toThrow();
    expect(check(root).report.findings).toContainEqual(expect.objectContaining({ rule: "privacy.unchecked", severity: "warning" }));
  });
});
