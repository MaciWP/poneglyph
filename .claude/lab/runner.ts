import * as fs from "node:fs";
import * as path from "node:path";
import { homedir, tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { atomicJSON, hash, loadVersion, saveVersion, schedule, validateRecipe, within, type Recipe, type RunRecord, type Assignment } from "./store";
import { inventory, installProfile, validateProfile, assertProfileInventory, prepareCore } from "./profiles";
import { Transaction, digest, exists } from "./transaction";
import { scenario, materializeScenario, type Scenario } from "./catalog";
import { evaluate } from "./oracle";
import { activeAgents, execute } from "./process";
import { commandFor, decode } from "./adapters";

export interface Experiment { version: 1; recipe: Recipe; scenarios: Record<string,string>; environment: Record<string,unknown>; engine: string; nativeCommon: string }
export interface Results { version: 1; id: string; experiment: string; kind: "evaluation" | "drill"; state: string; startedAt: string; finishedAt: string | null; elapsedSeconds: number | null; setupSeconds: number; rows: RunRecord[]; profileChecks: {condition:string;installedHash:string}[]; error: string | null }
export interface RunOptions { home?: string; roots?: Partial<Record<Recipe["host"],string>>; binary?: string; signal?: AbortSignal; onTrial?: (a: Assignment, work: string) => void; drill?: boolean }
export const engineHash = () => hash(["catalog.ts","oracle.ts","worker.ts","store.ts","profiles.ts","process.ts","adapters.ts","runner.ts","transaction.ts"].map(n=>[n,fs.readFileSync(path.join(import.meta.dir,n),"utf8")]));
export function prepareExperiment(root: string, input: unknown, environment: Record<string,unknown>): string {
 const recipe=validateRecipe(input), versions: Record<string,string>={}; let common: string | undefined;
 for (const condition of recipe.conditions) {
  const profile=validateProfile(loadVersion(root,"profile",condition.profile));
  prepareCore(within(root,path.join("cores",condition.profile)),profile);
  if (profile.host!==recipe.host) throw new Error("Profile host differs from experiment");
  if (common!==undefined && common!==profile.commonHash && recipe.factor!=="exploratory") throw new Error("Native common configuration differs across conditions");
  common=profile.commonHash;
  const prompt=loadVersion<any>(root,"prompt",condition.prompt);
  if (prompt?.version!==1 || typeof prompt.text!=="string" || !prompt.text.trim()) throw new Error("Invalid prompt version");
 }
 for (const id of recipe.scenarios) versions[id]=saveVersion(root,"scenario",scenario(id));
 return saveVersion(root,"experiment",{version:1,recipe,scenarios:versions,environment,engine:engineHash(),nativeCommon:common!} satisfies Experiment);
}
export function readExperiment(root: string, id: string): Experiment {
 const e=loadVersion<Experiment>(root,"experiment",id);
 if (e.version!==1) throw new Error("Unsupported experiment version"); validateRecipe(e.recipe);
 for (const id of e.recipe.scenarios) loadVersion(root,"scenario",e.scenarios[id]);
 return e;
}
export function effectiveRoots(): Partial<Record<Recipe["host"],string>> {
 return Object.fromEntries([["claude",process.env.CLAUDE_CONFIG_DIR],["grok",process.env.GROK_HOME],["codex",process.env.CODEX_HOME]].filter(([,v])=>v)) as Partial<Record<Recipe["host"],string>>;
}
export async function environmentFor(host: Recipe["host"], binary: string=host, roots=effectiveRoots()): Promise<Record<string,unknown>> {
 const r=await execute([binary,"--version"],process.cwd(),10);
 if (r.code!==0 || r.timedOut || r.outputLimit || !r.stdout.trim()) throw new Error("Cannot establish native CLI version");
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(CLAUDE_|CODEX_|GROK_|ANTHROPIC_|XAI_|OPENAI_)/.test(k)||k.toUpperCase()==="PATH").map(([k,v])=>[k,hash(v??"")]));
 return { platform:process.platform,arch:process.arch,bun:Bun.version,hostVersion:r.stdout.trim(),binary,roots,environmentHash:hash(env),control:"filesystem-verified; native loading requires separate acceptance evidence" };
}
function assertCleanAncestors(dir: string, home: string) {
 for (let p=path.dirname(dir);;p=path.dirname(p)) {
  if (p!==home) for (const n of [".claude",".grok",".agents","CLAUDE.md","CLAUDE.local.md","GROK.md","AGENTS.md","AGENTS.override.md",".mcp.json"]) if(exists(path.join(p,n))) throw new Error(`Ancestor configuration would contaminate the experiment: ${path.join(p,n)}`);
  if (p===path.dirname(p)) break;
 }
}
export async function runExperiment(root: string, experimentId: string, options: RunOptions = {}): Promise<Results> {
 root=fs.realpathSync(root);
 const e=readExperiment(root,experimentId), p=e.recipe, assignments=schedule(p);
 const planned=options.drill?assignments.filter((a,i)=>assignments.findIndex(b=>b.condition===a.condition)===i):assignments;
 if(e.engine!==engineHash()) throw new Error("Laboratory engine changed; use its recorded revision or prepare a new experiment");
 const home=fs.realpathSync(options.home??homedir());
 if(p.mode==="live" && home!==fs.realpathSync(homedir())) throw new Error("Live experiments must use the current native user home");
 if(p.mode==="simulation") {
  const relative=path.relative(root,home);
  if(!relative || relative.startsWith("..") || path.isAbsolute(relative) || home===fs.realpathSync(homedir())) throw new Error("Simulation home must be inside the private laboratory workspace");
  if(options.roots && Object.keys(options.roots).length) throw new Error("Simulation cannot override native configuration roots");
 }
 const roots=p.mode==="simulation"?{}:options.roots??effectiveRoots(), inv=inventory(home,p.host,roots);
 if(p.mode==="live") {
  assertCleanAncestors(root,home);
  if(activeAgents()) throw new Error("Close active agent sessions before the native configuration swap");
  const observed=await environmentFor(p.host,options.binary??p.host,roots);
  if(hash(observed)!==hash(e.environment)) throw new Error("Native environment changed since experiment preparation");
 }
 const profiles=new Map(p.conditions.map(c=>[c.id,validateProfile(loadVersion(root,"profile",c.profile))]));
 for(const profile of profiles.values()) assertProfileInventory(inv,profile);
 const definitions=new Map(p.scenarios.map(id=>[id,loadVersion<Scenario>(root,"scenario",e.scenarios[id])]));
 const id=randomUUID(), dir=within(root,path.join("executions",id)); fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const output: Results={version:1,id,experiment:experimentId,kind:options.drill?"drill":"evaluation",state:"preparing",startedAt:new Date().toISOString(),finishedAt:null,elapsedSeconds:null,setupSeconds:0,rows:[],profileChecks:[],error:null};
 const file=path.join(dir,"results.json"), save=()=>atomicJSON(file,{...output,integrity:hash(output)}); save();
 const stateDir=path.join(home,".poneglyph-lab");
 const baselines=new Map<string,ReturnType<typeof evaluate> extends Promise<infer T>?T:never>();
 let tx: Transaction | undefined, pendingWork: { from: string; to: string } | undefined;
 // Copy the agent's temporary tree into its run directory, then drop the temporary copy.
 const retain=()=>{ if(!pendingWork) return; const {from,to}=pendingWork; pendingWork=undefined; if(!exists(from)) return; fs.cpSync(from,to,{recursive:true}); fs.rmSync(from,{recursive:true,force:true}); };
 const preparation=performance.now();
 try {
  for (const [name,s] of options.drill?[]:definitions) {
   const calibration=path.join(dir,"calibration",name), initial=path.join(calibration,"initial"), reference=path.join(calibration,"reference");
   materializeScenario(initial,s); materializeScenario(reference,s,true);
   const baseline=await evaluate(initial,s,p.seed), accepted=await evaluate(reference,s,p.seed);
   if(!accepted.accepted || (s.unchanged ? !baseline.accepted : baseline.accepted)) throw new Error("Scenario calibration failed");
   baselines.set(name,baseline);
   // Keep the calibration evidence, not the reference implementation in an agent-visible run tree.
   atomicJSON(path.join(calibration,"result.json"),{baseline,reference:accepted});
   fs.rmSync(initial,{recursive:true,force:true}); fs.rmSync(reference,{recursive:true,force:true});
  }
  output.setupSeconds=(performance.now()-preparation)/1000;
  if(options.signal?.aborted) { output.state="interrupted-restored"; return output; }
  const watched=Object.values(inv.roots).filter(exists);
  tx=Transaction.begin(stateDir,inv.targets.map(t=>t.path),undefined,watched);
  tx.recordResults(file); tx.isolate(); output.state="running"; save();
  const started=performance.now();
  for(const assignment of planned) {
   if(options.signal?.aborted || (performance.now()-started)/1000>=p.limits.totalSeconds || output.rows.length>=p.limits.maxRuns) break;
   if(p.mode==="live"&&activeAgents()) throw new Error("An affected agent started during the experiment");
   tx.captureCreated();
   for(const entry of tx.journal.entries) tx.quarantine(entry.target);
   const run=path.join(dir,"runs",assignment.id), core=within(root,path.join("cores",p.conditions.find(c=>c.id===assignment.condition)!.profile));
   const profile=profiles.get(assignment.condition)!, s=definitions.get(assignment.scenario)!;
   installProfile(inv,profile,core);
   const expected=new Map(inv.targets.filter(t=>t.snapshot).map(t=>[t.path,digest(t.path)]));
   const coreHash=exists(core)?digest(core):null;
   if(options.drill) { output.profileChecks.push({condition:assignment.condition,installedHash:hash(Object.fromEntries(expected))}); save(); continue; }
   // The agent works in an opaque OS temporary directory: laboratory objects, other runs and condition labels are not reachable by relative path.
   const work=fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(),"poneglyph-trial-")));
   if(p.mode==="live") assertCleanAncestors(work,home);
   pendingWork={from:work,to:path.join(run,"work")};
   materializeScenario(work,s);
   const row: RunRecord={...assignment,status:"running",accepted:false,seconds:null,verifierSeconds:null,checks:[],regressions:0,model:null,usage:null,apiEquivalentUsd:null,numTurns:null,apiSeconds:null,modelUsage:null,permissionDenials:null}; output.rows.push(row); save();
   atomicJSON(path.join(run,"configuration.json"),{profile:p.conditions.find(c=>c.id===assignment.condition)!.profile,installed:Object.fromEntries(expected),coreHash,control:e.environment.control??"simulation"});
   options.onTrial?.(assignment,work);
   if(options.signal?.aborted) { row.status="cancelled"; save(); break; }
   if(p.mode==="live" && p.host==="grok") {
    const inspected=await execute([options.binary??p.host,"inspect","--json"],work,10,options.signal,pid=>tx!.recordChild(pid));
    if(inspected.code!==0 || inspected.timedOut || inspected.outputLimit) throw new Error("Native configuration inspection failed");
    atomicJSON(path.join(run,"inspection.json"),{outputHash:hash(inspected.stdout),verified:"inspection completed; content not exported"});
   }
   const c=p.conditions.find(c=>c.id===assignment.condition)!, template=loadVersion<{text:string}>(root,"prompt",c.prompt).text;
   const prompt=(template.includes("{{task}}")?template.replaceAll("{{task}}",s.prompt):s.prompt+"\n"+template)+"\nThe supplied task scope is approved. Implement and verify it autonomously. Run the public tests. Only src/service.ts is submitted; do not change protected infrastructure. Do not publish or contact anyone. Work only on this controlled project.";
   const remaining=p.limits.totalSeconds-(performance.now()-started)/1000;
   if(remaining<=0) { row.status="budget-exhausted"; save(); break; }
   if(p.mode==="simulation" && profile.role!=="base") fs.writeFileSync(path.join(work,"src/service.ts"),s.reference);
   const cmd=p.mode==="simulation"?[process.execPath,"-e",'console.log("synthetic process")']:commandFor(p.host,options.binary??p.host,p.model,prompt);
   const processResult=await execute(cmd,work,Math.min(p.limits.secondsPerRun,remaining),options.signal,pid=>tx!.recordChild(pid));
   row.seconds=processResult.seconds;
   const measured=p.mode==="simulation"?{terminal:true,text:"Synthetic result",model:"simulation",usage:null,apiEquivalentUsd:null,numTurns:null,apiSeconds:null,modelUsage:null,permissionDenials:null}:decode(p.host,processResult.stdout);
   // Raw host stream and final text are private evidence for later trace review; stderr is still dropped (may contain secrets).
   fs.writeFileSync(path.join(run,"stream.jsonl"),processResult.stdout,{mode:0o600});
   if(measured.terminal&&measured.text.trim()) fs.writeFileSync(path.join(run,"final.txt"),measured.text,{mode:0o600});
   row.model=measured.model; row.usage=measured.usage; row.apiEquivalentUsd=measured.apiEquivalentUsd;
   row.numTurns=measured.numTurns; row.apiSeconds=measured.apiSeconds; row.modelUsage=measured.modelUsage; row.permissionDenials=measured.permissionDenials;
   row.status=processResult.cancelled?"cancelled":processResult.timedOut?"timeout":processResult.outputLimit?"output-limit":processResult.code!==0?"agent-error":!measured.terminal?"invalid-output":"completed";
   if([...expected].some(([file,h])=>digest(file)!==h) || (coreHash!==null && digest(core)!==coreHash)) { row.status="configuration-invalid"; save(); throw new Error("Frozen configuration changed during the trial"); }
   const checked=await evaluate(work,s,p.seed,options.signal,pid=>tx!.recordChild(pid));
   row.checks=checked.checks; row.verifierSeconds=checked.seconds;
   row.regressions=checked.checks.filter(c=>!c.passed && baselines.get(s.id)!.checks.some(b=>b.name===c.name && b.passed)).length;
   row.accepted=row.status==="completed"&&checked.accepted;
   if(checked.status!=="evaluated"&&row.status==="completed") row.status=checked.status;
   atomicJSON(path.join(run,"evaluation.json"),checked); save(); retain();
  }
  output.state=options.drill?(output.profileChecks.length===planned.length?"drill-restored":"interrupted-restored"):output.rows.length===assignments.length&&output.rows.every(r=>r.status!=="cancelled"&&r.status!=="running"&&r.status!=="budget-exhausted")?"finished-restored":"interrupted-restored";
 } catch(error) { output.error=error instanceof Error?error.message:"Experiment failed"; output.state="failed-restored"; for(const row of output.rows) if(row.status==="running") row.status=options.signal?.aborted?"cancelled":"execution-error"; }
 finally {
  try { retain(); } catch(error) { output.error??=error instanceof Error?error.message:"Work retention failed"; }
  if(tx) {
   try { if(p.mode==="live"&&activeAgents()) throw new Error("An affected agent is still active; close it before recovery"); tx.restore(); }
   catch(error) { output.state="recovery-required"; output.error=error instanceof Error?error.message:"Recovery failed"; }
  }
  output.finishedAt=new Date().toISOString(); output.elapsedSeconds=(performance.now()-preparation)/1000; save();
 }
 return output;
}
