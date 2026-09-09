import * as fs from "node:fs";
import * as path from "node:path";
import { parse, stringify } from "smol-toml";
import { hash, within, atomicJSON, type Host } from "./store";
import { digest } from "./transaction";
import { generateSpTwin } from "../commands/sync-claude";
import { buildCodexLinks, generatedContent } from "../scripts/sync-codex";

const CONFIG = new Set(["CLAUDE.md", "GROK.md", "AGENTS.md", "AGENTS.override.md", "settings.json", "settings.local.json", "config.toml", ".mcp.json", "mcp.json", "hooks.json", "rules", "skills", "commands", "hooks", "agents", "plugins", "output-styles", "scripts", "workflows", "system-prompts", "docs", "loop.md"]);
const PRESERVE = new Set([".credentials.json", "auth.json", "managed-settings.json", "managed_config.toml", "requirements.toml", "policy-limits.json"]);
const VOLATILE = new Set(["projects", "sessions", "memory", "todos", "tasks", "plans", "debug", "history.jsonl", "stats-cache.json", "cache", "backups", "file-history", "shell-snapshots", "telemetry", "paste-cache", "session-env", "ide", "downloads", "statsig", "settings.local.json.bak", "image-cache", "uploads", "feedback", "feedback-bundles", "usage-data", "logs", "tmp", "log", "version.json", "state_5.sqlite", "state_5.sqlite-shm", "state_5.sqlite-wal"]);
// Native runtime/account artifacts are common, never profile payloads. Unknown
// entries still fail closed; these names were inspected on the installed CLIs.
const RUNTIME = new Set(["bin","bundled","vendor","completions","auth.json.lock","managed_config.lock","trusted_folders.toml","trusted_folders.toml.lock",".config-init.lock",".metadata_version","agent_id","installation_id","models_cache.json",".claude.json","remote-settings.json","daemon.lock","active_sessions.lock","mcp-oauth-locks",".orca-config-settings-baseline.json",".orca-hook-trust-provenance.json",".orca-managed-home",".sandbox_migration","README.md","CHANGELOG.md","CHANGELOG.json"]);
const TRANSIENT = new Set(["daemon","daemon.status.json","jobs","learned",".last-cleanup",".last-update-result.json","mcp-needs-auth-cache.json","marketplace-cache","memtrace","relocations","active_sessions.json","campaigns_state.json","campaigns_state.json.lock","last-copy.txt","slash-mru.json","tip_cursor.json","worktrees.db","thread-writer-locks","session_index.jsonl"]);
const transient = (name:string)=>VOLATILE.has(name)||TRANSIENT.has(name)||/^(state|goals|logs|memories|queue|thread_history)_\d+\.sqlite(?:-shm|-wal)?$/.test(name)||/^(config\.toml|hooks\.json|settings\.json)(?:\.[a-zA-Z0-9_-]+)*\.bak$/.test(name);
export interface FileData { data: string | null; mode: number }
export type Tree = Record<string, FileData>;
export interface Inventory { version: 1; host: Host; home: string; roots: Record<string, string>; targets: { key: string; path: string; snapshot: boolean }[]; preserved: string[] }
export interface Binding { entry: string; relative: string; source: string }
export interface Profile { version: 1; host: Host; role: "current" | "base" | "candidate"; entries: Record<string, Tree>; core: Tree; sourceRoot: string | null; commonHash: string; bindings?: Binding[] }
const exists = (p: string) => { try { fs.lstatSync(p); return true; } catch (e: any) { if (e.code === "ENOENT") return false; throw e; } };
export function inventory(home: string, host: Host, overrides: Partial<Record<Host, string>> = {}): Inventory {
  home = fs.realpathSync(home);
  const names: Host[] = host === "claude" ? [host] : ["claude", host];
  const roots: Record<string, string> = Object.fromEntries(names.map(n => [n, path.resolve(overrides[n] ?? path.join(home, "." + n))]));
  roots.agents = path.join(home, ".agents");
  const targets: Inventory["targets"] = [], preserved: string[] = [];
  for (const [key, root] of Object.entries(roots)) {
    if (exists(root) && (fs.lstatSync(root).isSymbolicLink() || !fs.lstatSync(root).isDirectory())) throw new Error(`Configuration root requires a real directory: ${root}`);
    if (key === "agents") { targets.push({ key: "agents", path: root, snapshot: true }); continue; }
    if (!exists(root)) { targets.push({key,path:root,snapshot:true}); continue; }
    const found = exists(root) ? fs.readdirSync(root) : [];
    for (const name of new Set([...CONFIG, ...VOLATILE, ...found])) {
      if (name.startsWith(".poneglyph-lab-")) continue;
      const file = path.join(root, name);
      if (PRESERVE.has(name)||RUNTIME.has(name)) {
        if (exists(file)) {
          if(name===".claude.json"&&Object.keys(JSON.parse(fs.readFileSync(file,"utf8")).mcpServers??{}).length) throw new Error("Account file contains global MCP; classify it before running");
          preserved.push(file);
        }
        continue;
      }
      if (!CONFIG.has(name) && !transient(name)) throw new Error(`Unknown configuration entry: ${file}`);
      targets.push({ key: `${key}/${name}`, path: file, snapshot: CONFIG.has(name) });
    }
  }
  for (const name of ["CLAUDE.md", "CLAUDE.local.md", "GROK.md", "AGENTS.md", "AGENTS.override.md"]) targets.push({ key: `home/${name}`, path: path.join(home, name), snapshot: true });
  const account = path.join(home, ".claude.json");
  if (names.includes("claude") && exists(account)) {
    const data = JSON.parse(fs.readFileSync(account, "utf8"));
    if (Object.keys(data.mcpServers ?? {}).length) throw new Error("Account file contains global MCP; classify and separate common configuration before running");
    preserved.push(account);
  }
  return { version: 1, host, home, roots, targets, preserved };
}
export function snapshot(source: string, exclude: Set<string> = new Set()): Tree {
  const result: Tree = Object.create(null); let bytes = 0, count = 0;
  const walk = (file: string, relative: string, ancestors: Set<string>) => {
    if (exclude.has(relative)) return;
    const real = fs.realpathSync(file), stat = fs.statSync(real);
    if (ancestors.has(real)) throw new Error("Cyclic profile dependency");
    if (++count > 20000 || (bytes += stat.isFile() ? stat.size : 0) > 100 * 1024 * 1024) throw new Error("Profile exceeds 100 MB / 20000 entries");
    if (!stat.isDirectory() && !stat.isFile()) throw new Error("Unsupported profile entry");
    result[relative] = { data: stat.isDirectory() ? null : fs.readFileSync(real).toString("base64"), mode: stat.mode & 0o777 };
    if (stat.isDirectory()) for (const name of fs.readdirSync(real).sort()) walk(path.join(real, name), relative ? relative + "/" + name : name, new Set([...ancestors, real]));
  };
  walk(source, "", new Set()); return result;
}
const COMMON_KEYS = new Set(["model", "models", "model_provider", "model_providers", "model_reasoning_effort", "model_reasoning_summary", "effortLevel", "env", "features", "permissions", "approval_policy", "sandbox_mode", "sandbox_workspace_write", "mcp_servers", "mcpServers"]);
function commonEntries(entries: Record<string, Tree>): Record<string, Tree> {
  const result: Record<string, Tree> = {};
  const flat={...entries};
  for(const [key,tree] of Object.entries(entries)) if(["claude","codex","grok"].includes(key)) for(const name of ["settings.json","settings.local.json","config.toml"]) if(tree[name]?.data) flat[key+"/"+name]={"":tree[name]};
  for (const [key, tree] of Object.entries(flat)) {
    if (!/(?:settings(?:\.local)?\.json|config\.toml|\.?mcp\.json)$/.test(key) || !tree[""]?.data) continue;
    const text = Buffer.from(tree[""].data!, "base64").toString("utf8");
    const data = key.endsWith(".toml") ? parse(text) : JSON.parse(text);
    const common = Object.fromEntries(Object.entries(data).filter(([k]) => COMMON_KEYS.has(k)));
    result[key] = { "": { mode: tree[""].mode, data: Buffer.from(key.endsWith(".toml") ? stringify(common) : JSON.stringify(common)).toString("base64") } };
  }
  return result;
}
export function validateProfile(value: unknown): Profile {
  const p = value as Profile;
  if (!p || p.version !== 1 || !["claude", "grok", "codex"].includes(p.host) || !["base", "current", "candidate"].includes(p.role) || !p.entries || typeof p.entries !== "object" || !p.core || typeof p.core !== "object") throw new Error("Invalid profile");
  let bytes=0,count=0;
  const checkTree = (tree: Tree) => {
    if (!tree || typeof tree !== "object" || Array.isArray(tree)) throw new Error("Invalid profile tree");
    for (const [relative, file] of Object.entries(tree)) {
      if(++count>20000 || (bytes+=file?.data?.length??0)>140*1024*1024) throw new Error("Profile exceeds bounded storage size");
      if (relative && (relative.split("/").some(n => !n || n === "." || n === "..") || /[\\:]/.test(relative) || path.isAbsolute(relative))) throw new Error("Unsafe profile path");
      if(relative.split("/").some(n=>PRESERVE.has(n)||n===".env"||n.startsWith(".env."))) throw new Error("Credential files cannot enter a profile");
      if (!file || !Number.isInteger(file.mode) || file.mode < 0 || file.mode > 0o777 || (file.data !== null && (typeof file.data !== "string" || Buffer.from(file.data, "base64").toString("base64") !== file.data))) throw new Error("Invalid profile file");
      if (file.data && /\.(json|toml)$/.test(relative)) rejectCredentials(Buffer.from(file.data, "base64").toString("utf8"),relative);
    }
    const names=Object.keys(tree), folded=names.map(n=>n.toLowerCase());
    if(new Set(folded).size!==names.length) throw new Error("Case-colliding profile paths are not portable");
    if(names.some(n=>tree[n].data!==null&&names.some(other=>other!==n&&(n===""||other.startsWith(n+"/"))))) throw new Error("Profile file conflicts with a directory");
  };
  for (const [key, tree] of Object.entries(p.entries)) {
    if (!["agents","claude","grok","codex"].includes(key) && !/^(claude|grok|codex|home)\/[a-zA-Z0-9_.-]+$/.test(key)) throw new Error("Unsafe profile entry");
    if(PRESERVE.has(key.split("/").at(-1)!)) throw new Error("Credential or policy files cannot enter a profile");
    checkTree(tree);
    if (tree[""]?.data && /\.(json|toml)$/.test(key)) rejectCredentials(Buffer.from(tree[""].data, "base64").toString("utf8"),key);
  }
  checkTree(p.core);
  if(p.bindings!==undefined && (!Array.isArray(p.bindings)||p.bindings.some(b=>!b||!Object.hasOwn(p.entries,b.entry)||!Object.hasOwn(p.entries[b.entry],b.relative)||!Object.hasOwn(p.core,b.source)))) throw new Error("Invalid profile source binding");
  if (p.commonHash !== hash(commonEntries(p.entries))) throw new Error("Common native configuration changed; capture a new experiment");
  return p;
}
function rejectCredentials(text: string, location: string) {
  let data: unknown;
  try { data=location.endsWith(".toml")?parse(text):JSON.parse(text); }
  catch { throw new Error(`Invalid profile JSON/TOML: ${JSON.stringify(location)}`); }
  const sensitive=/(?:^|_)(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client_secret|password|authorization|auth_provider_command)$/i;
  const visit=(value:unknown,key="")=>{
    if(value&&typeof value==="object") { for(const [name,child] of Object.entries(value)) visit(child,name); return; }
    if(typeof value!=="string"||!value||!sensitive.test(key)) return;
    const reference=/\$\{[A-Z][A-Z0-9_]*(?::-)?\}/g;
    const hasReference=reference.test(value); reference.lastIndex=0;
    const residual=value.replace(reference,"").trim();
    if(hasReference&&(residual===""||(/authorization/i.test(key)&&/^(Bearer|Basic|Token)$/i.test(residual)))) return;
    throw new Error(`Embedded authentication cannot be stored in a profile: ${JSON.stringify(location)}`);
  };
  visit(data);
}
export function captureProfile(inv: Inventory, coreRoot?: string): Profile {
  const entries: Record<string, Tree> = {};
  for (const target of inv.targets) if (target.snapshot && exists(target.path)) entries[target.key] = snapshot(target.path);
  let core: Tree = {}; const bindings: Binding[]=[];
  if (coreRoot) {
    const source = path.resolve(coreRoot);
    const tree = snapshot(path.join(source, ".claude"), new Set(["lab", "plans", "settings.machine.json", "settings.local.json"]));
    for (const [name, file] of Object.entries(tree)) core[name ? ".claude/" + name : ".claude"] = file;
    core[""] = { data: null, mode: 0o700 };
    for (const name of ["CLAUDE.md", "package.json"]) if (exists(path.join(source, name))) core[name] = snapshot(path.join(source, name))[""];
    const dep = path.join(source, "node_modules", "smol-toml");
    if (exists(dep)) for (const [name, file] of Object.entries(snapshot(dep))) core["node_modules/smol-toml" + (name ? "/" + name : "")] = file;
    const forms = [source, source.replaceAll("\\", "/"), source.replaceAll("\\", "\\\\")].sort((a,b)=>b.length-a.length);
    for (const tree of [...Object.values(entries), core]) for (const file of Object.values(tree)) if (file.data) {
      const buffer = Buffer.from(file.data, "base64"); let text = buffer.toString("utf8");
      if (!Buffer.from(text).equals(buffer)) continue;
      for (const form of forms) text = text.split(form).join("{{LAB_CORE}}");
      file.data = Buffer.from(text).toString("base64");
    }
    const realSource=fs.realpathSync(source);
    for(const target of inv.targets.filter(t=>t.snapshot&&exists(t.path))) {
      for(const relative of Object.keys(entries[target.key]).sort((a,b)=>a.length-b.length)) {
        if(bindings.some(b=>b.entry===target.key&&(b.relative===""||relative===b.relative||relative.startsWith(b.relative+"/")))) continue;
        const original=relative?path.join(target.path,relative):target.path;
        const candidate=path.relative(realSource,fs.realpathSync(original)).replaceAll("\\","/");
        let origin=(!candidate.startsWith("../")&&!path.isAbsolute(candidate)&&Object.hasOwn(core,candidate))?candidate:null;
        // Recognize copied generated inputs only when their bytes still match.
        if(!origin && target.key==="claude/CLAUDE.md"&&relative===""&&entries[target.key][relative].data===core["CLAUDE.md"]?.data) origin="CLAUDE.md";
        if(!origin && target.key==="grok/rules"&&relative==="poneglyph-sp.md"&&entries[target.key][relative].data===core[".claude/system-prompts/poneglyph-sp.md"]?.data) origin=".claude/system-prompts/poneglyph-sp.md";
        if(origin) bindings.push({entry:target.key,relative,source:origin});
      }
    }
  }
  return validateProfile({ version: 1, host: inv.host, role: "current", entries, core, sourceRoot: coreRoot ? path.resolve(coreRoot) : null, commonHash: hash(commonEntries(entries)),bindings });
}
export function deriveProfile(current: Profile, role: "base" | "candidate"): Profile {
  const p = structuredClone(validateProfile(current)); p.role = role;
  if (role === "base") { p.entries = commonEntries(p.entries); p.core = {}; p.bindings=[]; p.sourceRoot = null; p.commonHash = hash(commonEntries(p.entries)); }
  return validateProfile(p);
}
export function materializeTree(root: string, tree: Tree, binding = ""): void {
  for (const [relative, file] of Object.entries(tree).sort(([a],[b])=>a.length-b.length)) {
    const target = relative ? within(root, relative) : path.resolve(root);
    if (file.data === null) fs.mkdirSync(target, { recursive: true, mode: file.mode });
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      const buffer = Buffer.from(file.data, "base64"), text = buffer.toString("utf8");
      fs.writeFileSync(target, binding && text.includes("{{LAB_CORE}}") ? text.replaceAll("{{LAB_CORE}}", binding.replaceAll("\\", "/")) : buffer, { flag: "wx", mode: file.mode });
    }
  }
}
export function assertProfileInventory(inv: Inventory, profile: Profile): Map<string,string> {
  validateProfile(profile);
  if (profile.host !== inv.host) throw new Error("Profile host mismatch");
  const allowed = new Map(inv.targets.filter(t=>t.snapshot).map(t=>[t.key,t.path]));
  const selected=new Map<string,string>();
  for (const key of Object.keys(profile.entries)) {
    const [root,name]=key.split("/");
    const dest=allowed.get(key)??(allowed.has(root)&&name&&CONFIG.has(name)?path.join(allowed.get(root)!,name):undefined);
    if(!dest) throw new Error(`Profile entry outside inventory: ${key}`);
    selected.set(key,dest);
  }
  const paths=[...selected.values()];
  if(paths.some(p=>paths.some(other=>other!==p&&other.startsWith(p+path.sep)))) throw new Error("Overlapping profile entries");
  return selected;
}
export function installProfile(inv: Inventory, profile: Profile, coreDirectory: string): void {
  const allowed=assertProfileInventory(inv,profile);
  prepareCore(coreDirectory,profile);
  for (const [key, tree] of Object.entries(profile.entries)) materializeTree(allowed.get(key)!, tree, coreDirectory);
}
export function prepareCore(directory:string,profile:Profile): void {
 if(!Object.keys(profile.core).length) return;
 const record=directory+".integrity.json", binding=path.resolve(directory), source=hash(profile.core);
 if(exists(directory)) {
  if(!exists(record)) throw new Error("Frozen core is incomplete; preserve it and use a new workspace");
  const saved=JSON.parse(fs.readFileSync(record,"utf8"));
  if(saved.source!==source||saved.binding!==binding||saved.digest!==digest(directory)) throw new Error("Frozen core integrity mismatch");
  return;
 }
 materializeTree(directory,profile.core,directory);
 atomicJSON(record,{source,binding,digest:digest(directory)});
}
export function exportDraft(directory: string, value: Profile): void {
 const p=validateProfile(value);
 if(exists(directory)) throw new Error("Draft destination already exists");
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 for(const [key,tree] of Object.entries(p.entries)) materializeTree(within(directory,"entries/"+key),tree);
 fs.mkdirSync(path.join(directory,"core"),{recursive:true});
 materializeTree(path.join(directory,"core"),p.core);
 fs.writeFileSync(path.join(directory,"profile.json"),JSON.stringify({version:1,host:p.host,role:"candidate",sourceRoot:p.sourceRoot,commonHash:p.commonHash,entryKeys:Object.keys(p.entries),bindings:(p.bindings??[]).map(b=>({...b,original:treeContentHash(subtree(p.entries[b.entry],b.relative))})),generatorInputs:Object.fromEntries(GENERATOR_INPUTS.map(name=>[name,hash(p.core[name]?.data??null)])),generatedAgents:hash(p.entries["codex/AGENTS.md"]?.[""]?.data??null)},null,2)+"\n");
}
const GENERATOR_INPUTS=["CLAUDE.md",".claude/output-styles/poneglyph.md",".claude/system-prompts/poneglyph-sp.md",".claude/rules/harness-runtime.md"];
const treeContentHash=(tree:Tree)=>hash(Object.fromEntries(Object.entries(tree).map(([name,file])=>[name,file.data])));
function subtree(tree:Tree,relative:string): Tree {
 return Object.fromEntries(Object.entries(tree).filter(([name])=>relative===""||name===relative||name.startsWith(relative+"/")).map(([name,file])=>[relative===""?name:name===relative?"":name.slice(relative.length+1),file]));
}
export function freezeDraft(directory: string): Profile {
  const meta=JSON.parse(fs.readFileSync(path.join(directory,"profile.json"),"utf8"));
  if(!Array.isArray(meta.entryKeys)||meta.entryKeys.some((k:unknown)=>typeof k!=="string")||new Set(meta.entryKeys).size!==meta.entryKeys.length) throw new Error("Invalid draft entries");
 refreshGeneratedDraft(directory,meta);
 const entries=Object.fromEntries(meta.entryKeys.map((key:string)=>[key,snapshot(within(directory,"entries/"+key))]));
 const core=snapshot(path.join(directory,"core"));
 if(Object.keys(core).length===1&&core[""].data===null) delete core[""];
 const bindings:Binding[]=[];
 for(const b of meta.bindings??[]) {
  if(!b||!Object.hasOwn(entries,b.entry)||!Object.hasOwn(entries[b.entry],b.relative)||!Object.hasOwn(core,b.source)) throw new Error("Invalid draft source binding");
  const edited=subtree(entries[b.entry],b.relative),derived=subtree(core,b.source);
  if(treeContentHash(edited)!==b.original&&treeContentHash(edited)!==treeContentHash(derived)) throw new Error("Conflicting derived-entry edit; edit its core source instead");
  for(const name of Object.keys(entries[b.entry])) if(b.relative===""||name===b.relative||name.startsWith(b.relative+"/")) delete entries[b.entry][name];
  for(const [relative,file] of Object.entries(derived)) entries[b.entry][b.relative?(relative?b.relative+"/"+relative:b.relative):relative]=file;
  bindings.push({entry:b.entry,relative:b.relative,source:b.source});
 }
 return validateProfile({version:1,host:meta.host,role:"candidate",sourceRoot:meta.sourceRoot,commonHash:meta.commonHash,entries,core,bindings});
}
function refreshGeneratedDraft(directory:string,meta:any):void {
 if(!meta.generatorInputs) return;
 const root=within(directory,"core"), fingerprint=(name:string)=>hash(exists(path.join(root,name))?fs.readFileSync(path.join(root,name)).toString("base64"):null);
 const style=".claude/output-styles/poneglyph.md";
 if(exists(path.join(root,style))&&fingerprint(style)!==meta.generatorInputs[style]) {
  fs.mkdirSync(path.join(root,".claude","system-prompts"),{recursive:true});
  if(generateSpTwin(root,true).status==="error") throw new Error("Cannot regenerate the candidate style twin");
 }
 const agents=within(directory,"entries/codex/AGENTS.md");
 const inputs=["CLAUDE.md",".claude/system-prompts/poneglyph-sp.md",".claude/rules/harness-runtime.md"];
 if(meta.host==="codex"&&exists(agents)&&fs.readFileSync(agents,"utf8").startsWith("<!-- generated by sync-codex")&&inputs.some(name=>fingerprint(name)!==meta.generatorInputs[name])) {
  let generated=generatedContent(buildCodexLinks(root,path.join(directory,"native"))[0])!;
  for(const form of [root,root.replaceAll("\\","/"),root.replaceAll("\\","\\\\")].sort((a,b)=>b.length-a.length)) generated=generated.split(form).join("{{LAB_CORE}}");
  const old=fs.readFileSync(agents,"utf8");
  if(hash(Buffer.from(old).toString("base64"))!==meta.generatedAgents&&old!==generated) throw new Error("Conflicting generated guidance edit; edit the core sources instead");
  fs.writeFileSync(agents,generated);
 }
}
