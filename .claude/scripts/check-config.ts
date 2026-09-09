#!/usr/bin/env bun
// Offline source checks, not an agent evaluator. Rule sources: ../docs/config-quality.md.
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseToml } from "smol-toml";
import { frontmatter } from "./lib/skill-metadata";
export { frontmatter } from "./lib/skill-metadata";

export interface Finding { path: string; rule: string; message: string; severity: "error" | "warning" }
export interface Source { files: Map<string, string>; links: string[]; binary?: string[]; ignoredSkills?: string[] }
export interface Report { findings: Finding[]; files: number; skills: number; kind: "core" | "addon" }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");
const chars = (v: string) => [...v].length;
const CORE = resolve(import.meta.dir, "../..");
const PRIVATE_FILE = ".claude/doctor.local.json";

function git(root: string, args: string[], input?: string): Buffer {
  try {
    return execFileSync("git", ["-C", root, ...args], { input, maxBuffer: 128 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
  } catch { throw new Error("Cannot read the Git snapshot; no validation was completed."); }
}

/** Hooks export GIT_DIR and GIT_INDEX_FILE. A test run spawned from a hook must not inherit them, or fixture repositories resolve to the real one (linked worktree, 2026-09-09). */
export function withoutGitEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter((e): e is [string, string] => e[1] !== undefined && !e[0].startsWith("GIT_")));
}

/** Read only Git-listed files. Never follow links or read user-level configuration. */
export function readSource(root: string, staged = false): Source {
  // Native resolution also expands Windows short names and normalizes drive case.
  root = realpathSync.native(root);
  const top = realpathSync.native(git(root, ["rev-parse", "--show-toplevel"]).toString().trim());
  if (top !== root) throw new Error("--root must be the repository root.");
  const files = new Map<string, string>();
  const links: string[] = [];
  const binary: string[] = [];
  const ignoredSkills: string[] = [];
  if (!staged) {
    const ignored = git(root, ["ls-files", "--others", "--ignored", "--exclude-standard", "-z", "--", ".claude/skills", "skills"]).toString().split("\0");
    for (const p of ignored) if (/^(?:\.claude\/)?skills\/[^/]+\/SKILL\.md$/.test(p)) {
      let ancestor = join(root, p), linked = false;
      while (ancestor !== root) { if (lstatSync(ancestor).isSymbolicLink()) linked = true; ancestor = dirname(ancestor); }
      if (!linked) ignoredSkills.push(p);
    }
    const paths = new Set(git(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).toString().split("\0").filter(Boolean));
    for (const p of paths) {
      let info;
      try { info = lstatSync(join(root, p)); } catch (e) { if (object(e) && e.code === "ENOENT") continue; throw new Error("Cannot read a source file."); }
      // Check every ancestor too: a directory junction can expose a private checkout.
      let ancestor = join(root, p);
      let linked = false;
      while (ancestor !== root) { if (lstatSync(ancestor).isSymbolicLink()) linked = true; ancestor = dirname(ancestor); }
      if (linked || !info.isFile()) { links.push(p); continue; }
      const bytes = readFileSync(join(root, p));
      if (!bytes.includes(0)) files.set(p, bytes.toString("utf8")); else binary.push(p);
    }
  } else {
    const entries = git(root, ["ls-files", "--stage", "-z"]).toString().split("\0").filter(Boolean).map(line => {
      const m = /^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/.exec(line);
      if (!m || m[3] !== "0") throw new Error("Resolve index conflicts before validation.");
      return { mode: m[1], oid: m[2], path: m[4] };
    });
    const regular = entries.filter(e => e.mode === "100644" || e.mode === "100755");
    links.push(...entries.filter(e => !regular.includes(e)).map(e => e.path));
    // Object IDs freeze the index snapshot; unstaged fixes cannot mask staged defects.
    const batch = regular.length ? git(root, ["cat-file", "--batch"], regular.map(e => e.oid).join("\n") + "\n") : Buffer.alloc(0);
    let offset = 0;
    for (const e of regular) {
      const end = batch.indexOf(10, offset);
      const header = batch.subarray(offset, end).toString().split(" ");
      const size = Number(header[2]);
      if (end < 0 || header[0] !== e.oid || header[1] !== "blob" || !Number.isSafeInteger(size) || size < 0 || end + size + 2 > batch.length) throw new Error("Incomplete Git snapshot.");
      const bytes = batch.subarray(end + 1, end + 1 + size);
      if (!bytes.includes(0)) files.set(e.path, bytes.toString("utf8")); else binary.push(e.path);
      offset = end + size + 2;
    }
  }
  return { files, links, binary, ignoredSkills };
}

export function privacyMatches(files: Map<string, string>, terms: string[]): string[] {
  if (!strings(terms) || terms.some(t => !t.trim())) throw new Error("Privacy terms must be non-empty strings.");
  // Return paths, never matched content or terms. Rendering redacts paths as well.
  return [...files].filter(([p, text]) => terms.some(t => (p + "\n" + text).toLowerCase().includes(t.toLowerCase()))).map(([p]) => p);
}

export function validate(source: Source, options: { addon?: boolean; privacyTerms?: string[]; baseSkills?: Set<string> } = {}): Report {
  const { files } = source;
  const addon = options.addon ?? (files.has(".claude-plugin/plugin.json") && !files.has(".claude/settings.global.json"));
  const findings: Finding[] = [];
  const add = (path: string, rule: string, message: string, severity: Finding["severity"] = "error") => findings.push({ path, rule, message, severity });
  const skillPattern = addon ? /^skills\/([^/]+)\/SKILL\.md$/ : /^\.claude\/skills\/([^/]+)\/SKILL\.md$/;
  const names = new Set<string>();
  const keys = new Set<string>();
  for (const p of [...files.keys(), ...source.links, ...(source.binary ?? [])]) {
    if (keys.has(p.toLowerCase())) add(p, "path.case", "Paths collide on case-insensitive filesystems.");
    keys.add(p.toLowerCase());
    if (/(^|\/)(?:\.env(?:\.(?!example$|sample$)[^/]+)?|auth\.json|credentials\.json|settings\.(?:local|machine)\.json|doctor\.local\.json)$/.test(p.toLowerCase())) add(p, "privacy.file", "Machine-private configuration must not enter the source snapshot.");
    if (addon && !/^(?:skills\/|memory\/|tests\/|\.github\/workflows\/|\.claude-plugin\/(?:plugin|marketplace)\.json$|README\.md$|LICENSE(?:\.\w+)?$|\.gitignore$|\.gitattributes$)/.test(p)) add(p, "addon.content", "An addon contains unique skills and memory, minimal manifests, and test integration only.");
    if (addon && /(^|\/)(?:CLAUDE|AGENTS)(?:\.override)?\.md$/i.test(p)) add(p, "addon.doctrine", "Shared doctrine belongs only in the core.");
  }
  for (const p of source.links) add(p, "path.external", "Linked source is not inspected or published by this gate. Use local activation outside the tracked source.");
  for (const p of source.ignoredSkills ?? []) add(p, "skill.ignored", "A source skill is hidden by Git ignore rules and would not reach review.");
  for (const p of source.binary ?? []) {
    if (/\.(?:md|json|toml|ya?ml|ts|js|sh)$/i.test(p)) add(p, "source.encoding", "Configuration and source must be text, not binary or UTF-16.");
    else add(p, "privacy.binary", "Binary content requires separate privacy review; its contents were not scanned.", "warning");
  }
  const skillDirs = new Set([...files.keys()].flatMap(p => {
    const m = (addon ? /^skills\/([^/]+)\// : /^\.claude\/skills\/([^/]+)\//).exec(p);
    return m ? [m[1]] : [];
  }));
  for (const name of skillDirs) if (!files.has(`${addon ? "" : ".claude/"}skills/${name}/SKILL.md`)) add(`${addon ? "" : ".claude/"}skills/${name}`, "skill.entry", "A skill directory must contain SKILL.md.");

  for (const [p, text] of files) {
    const skill = skillPattern.exec(p);
    const command = !addon && /^\.claude\/commands\/[^/]+\.md$/.test(p);
    if (!skill && !command) continue;
    let fields, body;
    try { ({ fields, body } = frontmatter(text)); } catch { add(p, "metadata.parse", "Invalid YAML frontmatter; source content is withheld."); continue; }
    const known = new Set(["name", "description", "compatibility", "metadata", "license", "disable-model-invocation", "user-invocable", "background", "when_to_use", "argument-hint", "model", "effort", "agent", "allowed-tools", "disallowed-tools", "arguments", "paths", "context", "hooks"]);
    if (Object.keys(fields).some(k => !known.has(k))) add(p, "metadata.extension", "Unknown metadata needs a documented host contract; check for spelling errors.", "warning");
    const name = fields.name ?? (command ? posix.basename(p, ".md") : undefined);
    if (typeof name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || chars(name) > 64 || (skill && name !== skill[1])) add(p, "metadata.name", "Use a matching kebab-case name of 1–64 characters (project convention).");
    if (typeof name === "string") {
      if (names.has(name)) add(p, "metadata.collision", "A skill and command cannot shadow each other in this repository.");
      names.add(name);
      if (addon && options.baseSkills?.has(name)) add(p, "addon.duplicate", "The addon must not copy or override a core skill.");
    }
    if (typeof fields.description !== "string" || !fields.description.trim() || chars(fields.description) > 1024) add(p, "metadata.description", "description must contain 1–1024 characters.");
    if (fields.compatibility !== undefined && (typeof fields.compatibility !== "string" || !fields.compatibility.trim() || chars(fields.compatibility) > 500)) add(p, "metadata.compatibility", "compatibility must contain 1–500 characters.");
    if (fields.metadata !== undefined && (!object(fields.metadata) || !Object.values(fields.metadata).every(v => typeof v === "string"))) add(p, "metadata.map", "metadata must map strings to strings.");
    for (const key of ["disable-model-invocation", "user-invocable", "background"]) if (fields[key] !== undefined && typeof fields[key] !== "boolean") add(p, "metadata.boolean", `${key} must use a literal YAML boolean for portability.`);
    for (const key of ["when_to_use", "argument-hint", "model", "effort", "agent", "license"]) if (fields[key] !== undefined && typeof fields[key] !== "string") add(p, "metadata.string", `${key} must be a string.`);
    for (const key of ["allowed-tools", "disallowed-tools", "arguments"]) if (fields[key] !== undefined && typeof fields[key] !== "string" && !strings(fields[key])) add(p, "metadata.tools", `${key} must be a string or string array.`);
    if (fields.paths !== undefined && !strings(fields.paths)) add(p, "metadata.paths", "paths must be a string array.");
    if (fields.context !== undefined && fields.context !== "fork") add(p, "metadata.context", "The documented context value is fork.");
    if (typeof fields.description === "string" && typeof fields.when_to_use === "string" && chars(fields.description + " " + fields.when_to_use) > 1536) add(p, "metadata.listing", "The Claude default listing may truncate this description.", "warning");
    if (!body.trim()) add(p, "skill.body", "Instructions must not be empty.");
    if (body.split(/\r?\n/).length >= 500) add(p, "skill.length", "Consider moving detail into references; 500 lines is guidance, not a quality score.", "warning");
    if (addon && fields.hooks !== undefined) add(p, "addon.hooks", "The private addon does not register hooks.");
    if (fields.hooks !== undefined) checkHooks(fields.hooks, p);
    // Explicit Markdown links only. Examples in fences and inline code are not dependencies.
    const prose = body.replace(/^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[^\n]*$/gm, "").replace(/`[^`\n]*`/g, "");
    for (const m of prose.matchAll(/\[[^\]\n]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      let target = m[1].split(/[?#]/)[0];
      if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/|~|\$)/i.test(target) || /[{}<>]/.test(target)) continue;
      try { target = decodeURIComponent(target); } catch { add(p, "reference.path", "Malformed local reference."); continue; }
      const resolved = posix.normalize(posix.join(posix.dirname(p), target));
      if (resolved.startsWith("../") || ![...files.keys()].some(f => f === resolved || f.startsWith(resolved.replace(/\/$/, "") + "/"))) add(p, "reference.missing", `Missing local Markdown target: ${target}`);
    }
  }

  function checkHooks(hooks: unknown, p: string) {
    if (!object(hooks)) { add(p, "hooks.shape", "hooks must be an event mapping."); return; }
    // Deliberately do not maintain an exhaustive event allowlist; hosts add events.
    for (const registrations of Object.values(hooks)) {
      if (!Array.isArray(registrations)) { add(p, "hooks.shape", "Each event must contain an array of registrations."); continue; }
      for (const registration of registrations) {
        if (!object(registration) || !Array.isArray(registration.hooks) || (registration.matcher !== undefined && typeof registration.matcher !== "string")) { add(p, "hooks.shape", "Invalid hook registration."); continue; }
        for (const hook of registration.hooks) {
          if (!object(hook) || typeof hook.type !== "string" || !["command", "prompt", "agent", "http"].includes(hook.type)) { add(p, "hooks.handler", "Unsupported hook handler type."); continue; }
          const field = hook.type === "command" ? "command" : hook.type === "http" ? "url" : "prompt";
          if (typeof hook[field] !== "string" || !hook[field].trim()) add(p, "hooks.handler", "Hook handler content must be a non-empty string.");
          if (hook.timeout !== undefined && (typeof hook.timeout !== "number" || !Number.isFinite(hook.timeout) || hook.timeout <= 0)) add(p, "hooks.timeout", "Hook timeout must be positive.");
          if (hook.async !== undefined && (typeof hook.async !== "boolean" || hook.type !== "command")) add(p, "hooks.async", "async is a boolean for command hooks only.");
          if (typeof hook.command === "string") {
            for (const m of hook.command.matchAll(/(?:\$HOME\/|\$\{HOME\}\/|~\/|\.\/)?(\.claude\/(?:hooks|scripts)\/[^\s"']+\.(?:ts|js|sh|py))/g)) if (!files.has(m[1])) add(p, "hooks.path", "A registered core hook points to a missing source file.");
          }
        }
      }
    }
  }

  for (const [p, text] of files) {
    const config = /^(?:action\.ya?ml|\.claude\/(?:settings(?:\.global)?\.json|ccstatusline\/settings\.json)|\.mcp\.json|\.(?:claude|codex)-plugin\/[^/]+\.json|(?:\.codex|\.grok)\/config\.toml|\.github\/workflows\/[^/]+\.ya?ml)$/.test(p);
    if (!config) continue;
    let data: unknown;
    // Bun 1.3.14 accepts an unterminated TOML table header. Keep this parser strict.
    try { data = p.endsWith(".toml") ? parseToml(text) : /\.ya?ml$/.test(p) ? Bun.YAML.parse(text) : JSON.parse(text); } catch { add(p, "config.parse", "Invalid configuration syntax; source content is withheld."); continue; }
    if (!object(data)) { add(p, "config.shape", "Configuration must be an object."); continue; }
    if (data.hooks !== undefined) checkHooks(data.hooks, p);
    if (data.permissions !== undefined) {
      if (!object(data.permissions)) add(p, "config.permissions", "Permissions must be a mapping.");
      else for (const key of ["allow", "ask", "deny"]) if (data.permissions[key] !== undefined && !strings(data.permissions[key])) add(p, "config.permissions", "Permission rules must be string arrays.");
    }
    if (p === ".claude-plugin/plugin.json") {
      if (typeof data.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name)) add(p, "plugin.name", "A plugin needs a kebab-case name.");
      if (data.version !== undefined && (typeof data.version !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(data.version))) add(p, "plugin.version", "Use a semantic plugin version.");
      if (addon && ["hooks", "agents", "commands", "mcpServers", "lspServers", "outputStyles"].some(k => data[k] !== undefined)) add(p, "addon.manifest", "This addon exposes skills only; it must not add tools, agents, hooks, or doctrine.");
      if (data.skills !== undefined) {
        const paths = typeof data.skills === "string" ? [data.skills] : data.skills;
        if (!strings(paths)) add(p, "plugin.skills", "Plugin skill paths must be a string or string array.");
        else for (const path of paths) if (!path.startsWith("./") || path.includes("..") || ![...files.keys()].some(f => f.startsWith(path.slice(2).replace(/\/$/, "") + "/"))) add(p, "plugin.path", "A declared skill path must exist inside the plugin.");
      }
    }
    if (p === ".claude-plugin/marketplace.json" && (typeof data.name !== "string" || !object(data.owner) || typeof data.owner.name !== "string" || !Array.isArray(data.plugins) || data.plugins.some((v: unknown) => !object(v) || typeof v.name !== "string" || v.source === undefined))) add(p, "plugin.marketplace", "Invalid marketplace identity or plugin entries.");
    if (/settings.*\.json$/.test(p) && !addon && /poneglyph-work/i.test(text)) add(p, "core.private-dependency", "Private addon activation belongs in ignored machine settings, not published core defaults.");
    if (p === ".claude/settings.json" && Object.keys(data).some(k => !["$schema", "respectGitignore"].includes(k))) add(p, "config.scope", "Project settings must not duplicate the global profile.");
    for (const key of ["enabledPlugins", "env"]) if (data[key] !== undefined && (!object(data[key]) || !Object.values(data[key]).every(v => typeof v === (key === "env" ? "string" : "boolean")))) add(p, "config.map", `${key} has invalid value types.`);
    const servers = data.mcpServers ?? data.mcp_servers;
    if (servers !== undefined) {
      if (!object(servers)) add(p, "mcp.shape", "MCP servers must be a mapping.");
      else for (const server of Object.values(servers)) {
        if (!object(server)) { add(p, "mcp.server", "MCP server must be an object."); continue; }
        const local = typeof server.command === "string" && !!server.command.trim();
        let remote = false;
        if (typeof server.url === "string") {
          try {
            const url = new URL(server.url);
            remote = ["http:", "https:"].includes(url.protocol) && !!url.hostname;
            if (url.username || url.password) add(p, "mcp.credentials", "Do not embed credentials in MCP URLs.");
          } catch { /* The transport check below reports the malformed URL. */ }
        }
        if (local === remote) add(p, "mcp.transport", "An MCP server needs either a command or an HTTP(S) URL.");
        if ((server.command !== undefined && !local) || (server.url !== undefined && !remote)) add(p, "mcp.transport-value", "Declared MCP transport fields must be valid non-empty strings.");
        if (server.args !== undefined && !strings(server.args)) add(p, "mcp.args", "MCP args must be a string array.");
        for (const key of ["env", "headers"]) if (server[key] !== undefined && (!object(server[key]) || !Object.values(server[key]).every(v => typeof v === "string"))) add(p, "mcp.map", "MCP environment and headers must be string mappings.");
      }
    }
  }
  if (!skillDirs.size) add(".", "inventory.empty", "No skills discovered; an empty scan is not a pass.");
  const privacyFiles = new Map([...files, ...(source.binary ?? []).map(p => [p, ""] as const)]);
  for (const p of privacyMatches(privacyFiles, options.privacyTerms ?? [])) add(p, "privacy.term", "Private content detected; matching content is withheld.");
  return { findings, files: files.size, skills: skillDirs.size, kind: addon ? "addon" : "core" };
}

export function render(report: Report, terms: string[] = []): string {
  let output = report.findings.map(f => `${f.severity.toUpperCase()} ${JSON.stringify(f.path)} [${f.rule}] ${f.message}`).join("\n");
  output += `\n${report.kind}: ${report.files} text files, ${report.skills} skills; ${report.findings.filter(f => f.severity === "error").length} errors, ${report.findings.filter(f => f.severity === "warning").length} warnings. Static checks only.`;
  for (const term of terms) if (term) output = output.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[PRIVATE]");
  return output.trim();
}

export function check(root: string, staged = false): { report: Report; terms: string[] } {
  const source = readSource(root, staged);
  const addon = source.files.has(".claude-plugin/plugin.json") && !source.files.has(".claude/settings.global.json");
  let terms: string[] = [];
  const privateFile = join(root, PRIVATE_FILE);
  if (!addon && existsSync(privateFile)) {
    const parsed = JSON.parse(readFileSync(privateFile, "utf8"));
    if (!strings(parsed.privacyTerms) || !parsed.privacyTerms.length || parsed.privacyTerms.some((t: string) => !t.trim())) throw new Error("Invalid local privacy policy; no privacy pass is claimed.");
    terms = parsed.privacyTerms;
  }
  const baseSkills = addon ? new Set([...readSource(CORE).files.keys()].flatMap(p => /^\.claude\/skills\/([^/]+)\/SKILL\.md$/.exec(p)?.slice(1) ?? [])) : undefined;
  const report = validate(source, { addon, privacyTerms: terms, baseSkills });
  if (source.files.has(".claude-plugin/plugin.json") && source.files.has(".claude/settings.global.json")) report.findings.push({ path: ".", rule: "config.ambiguous-root", severity: "error", message: "Core global profile and private addon manifest must live in separate repositories." });
  if (!addon && !terms.length) report.findings.push({ path: PRIVATE_FILE, rule: "privacy.unchecked", severity: "warning", message: "No local private terms supplied. Corporate-content privacy was not checked." });
  return { report, terms };
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({ args: process.argv.slice(2), options: { root: { type: "string", default: process.cwd() }, staged: { type: "boolean", default: false } }, strict: true });
    const { report, terms } = check(resolve(values.root!), values.staged);
    console.log(render(report, terms));
    process.exitCode = report.findings.some(f => f.severity === "error") ? 1 : 0;
  } catch {
    // Parse errors can embed credentials. Never print raw exception objects.
    console.error("Configuration check could not complete. Check arguments, Git access, source readability, and the local privacy policy. Details withheld for privacy.");
    process.exitCode = 2;
  }
}
