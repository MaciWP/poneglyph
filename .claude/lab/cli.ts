#!/usr/bin/env bun
import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";
import { parseArgs } from "node:util";
import { atomicJSON, canonical, hash, loadVersion, saveVersion, validateRecipe, schedule, type Host, type Recipe } from "./store";
import { captureProfile, deriveProfile, exportDraft, freezeDraft, inventory, type Profile } from "./profiles";
import { environmentFor, effectiveRoots, prepareExperiment, readExperiment, runExperiment } from "./runner";
import { ids } from "./catalog";
import { compare, loadResults, writeReport } from "./report";
import { activeAgents } from "./process";
import { Transaction, alive, exists } from "./transaction";

const HELP=`Laboratorio de Poneglyph · bajo demanda
  bun run lab demo <directorio-nuevo>
  bun run lab init <directorio-nuevo> --host claude|codex|grok --model <id>
      --seconds <por-intento> --max-runs <máximo> --total-seconds <total>
      [--cases ownership,creation,queries,batch_import,no_op] [--trials 2] [--seed 42]
  bun run lab plan <directorio> [--experiment <hash>]
  bun run lab freeze <directorio>
  bun run lab run <directorio> [--experiment <hash>]
  bun run lab drill <directorio> [--experiment <hash>]
  bun run lab repeat <directorio> --execution <id>
  bun run lab prompt <directorio> --file <texto.txt>
  bun run lab profile-capture <directorio>
  bun run lab profile-export <directorio> --profile <hash> --to <borrador-nuevo>
  bun run lab profile-freeze <directorio> --from <borrador>
  bun run lab history <directorio>
  bun run lab report <directorio> --execution <id>
  bun run lab compare <directorio> --left <id> --right <id> --from <condición> --to <condición>
  bun run lab doctor [--host claude|codex|grok]
  bun run lab status [directorio]
  bun run lab restore [directorio]

demo usa un home ficticio y procesos simulados. No usa modelos ni tu configuración.
init captura perfiles y crea recipe.json; no los instala. Edita el borrador y ejecuta freeze.
run utiliza la definición congelada. Los intercambios nativos requieren cerrar las sesiones afectadas.
drill intercambia y restaura perfiles sin ejecutar modelos ni puntuar tareas.
restore recupera el estado original. La ejecución nativa no es un sandbox del sistema operativo.
`;
interface Workspace { version: 1; mode: "live"|"simulation"; host: Host; home: string }
function workspace(root:string):Workspace {
 const w=JSON.parse(fs.readFileSync(path.join(root,"workspace.json"),"utf8")) as Workspace;
 if(w.version!==1||!["live","simulation"].includes(w.mode)||!["claude","codex","grok"].includes(w.host)) throw new Error("Invalid laboratory workspace");
 if(w.mode==="live") w.home=fs.realpathSync(homedir());
 else w.home=path.join(fs.realpathSync(root),"simulation-home");
 return w;
}
function selected(root:string,id?:string):string { return id??JSON.parse(fs.readFileSync(path.join(root,"selection.json"),"utf8")).experiment; }
const output=(value:unknown)=>console.log(JSON.stringify(value,null,2));
export async function main(args=process.argv.slice(2)):Promise<number> {
 const strings=["host","model","seconds","max-runs","total-seconds","cases","trials","seed","experiment","execution","file","profile","from","to","left","right"] as const;
 const stringOptions=Object.fromEntries(strings.map(k=>[k,{type:"string"}])) as Record<(typeof strings)[number],{type:"string"}>;
 const {positionals,values}=parseArgs({args,allowPositionals:true,options:{...stringOptions,help:{type:"boolean"}}});
 const [command,input,...extra]=positionals;
 if(values.help||!command||command==="help") { console.log(HELP); return 0; }
 if(extra.length) throw new Error("Unexpected arguments");
 const host=(values.host??"claude") as Host;
 if(!["claude","codex","grok"].includes(host)) throw new Error("Unknown host");
 if(command==="doctor") { output({inventory:inventory(homedir(),host,effectiveRoots()),activeAgents:activeAgents(),versions:await environmentFor(host)}); return 0; }
 if(command==="status"||command==="restore") {
  const w=input?workspace(path.resolve(input)):null;
  const stateDir=path.join(w?.home??homedir(),".poneglyph-lab"),file=path.join(stateDir,"active.json");
  if(!exists(file)) { console.log("No hay recuperación pendiente."); return 0; }
  const tx=Transaction.load(stateDir);
  if(command==="status") { output(tx.journal); return 0; }
  if(alive(tx.journal.owner)||(w?.mode!=="simulation"&&activeAgents())) throw new Error("The experiment owner or an affected agent is still active");
  tx.restore();
  if(tx.journal.results&&exists(tx.journal.results)) {
   const {integrity,...result}=JSON.parse(fs.readFileSync(tx.journal.results,"utf8"));
   if(integrity!==hash(result)) throw new Error("Result integrity mismatch after configuration recovery");
   result.state="recovered-restored";
   for(const row of result.rows??[]) if(row.status==="running") row.status="interrupted";
   result.finishedAt=new Date().toISOString(); result.elapsedSeconds=null;
   atomicJSON(tx.journal.results,{...result,integrity:hash(result)});
  }
  console.log("Configuración original restaurada y verificada."); return 0;
 }
 if(!input) throw new Error("Specify a laboratory directory");
 const root=path.resolve(input);
 if(command==="init"||command==="demo") {
  if(exists(root)) throw new Error("Use a new laboratory directory");
  const demo=command==="demo",mode=demo?"simulation":"live",model=demo?"simulation":values.model;
  const conditions=[{id:"base",profile:"0".repeat(64),prompt:"0".repeat(64)},{id:"current",profile:"1".repeat(64),prompt:"0".repeat(64)}];
  const recipe=validateRecipe({version:1,name:demo?"Demostracion":"experiment",host,model,mode,factor:"profile",seed:Number(values.seed??42),trials:Number(values.trials??(demo?1:2)),scenarios:values.cases?values.cases.split(","):ids,conditions,limits:{maxRuns:Number(values["max-runs"]??(demo?10:NaN)),secondsPerRun:Number(values.seconds??(demo?3:NaN)),totalSeconds:Number(values["total-seconds"]??(demo?120:NaN))}});
  let home=fs.realpathSync(homedir());
  if(demo) { home=path.join(root,"simulation-home"); for(const n of [".claude",".codex",".grok"]) fs.mkdirSync(path.join(home,n),{recursive:true}); fs.writeFileSync(path.join(home,".claude","CLAUDE.md"),"Synthetic Poneglyph configuration\n"); }
  const profile=captureProfile(inventory(home,host,demo?{}:effectiveRoots()),demo?undefined:path.resolve(import.meta.dir,"../.."));
  const env=demo?{platform:process.platform,arch:process.arch,bun:Bun.version,hostVersion:"simulation",control:"synthetic home"}:await environmentFor(host);
  fs.mkdirSync(root,{recursive:true,mode:0o700}); fs.writeFileSync(path.join(root,".gitignore"),"*\n");
  atomicJSON(path.join(root,"workspace.json"),{version:1,mode,host,home} satisfies Workspace);
  const prompt=saveVersion(root,"prompt",{version:1,text:"{{task}}"});
  conditions[0].profile=saveVersion(root,"profile",deriveProfile(profile,"base")); conditions[1].profile=saveVersion(root,"profile",profile);
  for(const c of conditions)c.prompt=prompt;
  recipe.conditions=conditions;
  exportDraft(path.join(root,"drafts","candidate"),deriveProfile(profile,"candidate"));
  atomicJSON(path.join(root,"recipe.json"),recipe);
  const experiment=prepareExperiment(root,recipe,env); atomicJSON(path.join(root,"selection.json"),{experiment});
  output({directorio:root,experimento:experiment,modo:mode,intentos:schedule(recipe).length,borrador:path.join(root,"drafts","candidate")});
  if(!demo) return 0;
  const result=await runExperiment(root,experiment,{home,onTrial:a=>console.log(`${a.order}/${schedule(recipe).length} · ${a.scenario} · ${a.condition}`)});
  console.log(writeReport(root,result.id)); return result.state==="finished-restored"?0:2;
 }
 const w=workspace(root);
 if(command==="prompt") {
  if(!values.file) throw new Error("Specify --file"); const text=fs.readFileSync(values.file,"utf8"); if(!text.trim()||text.length>1024*1024) throw new Error("Invalid prompt text");
  output({prompt:saveVersion(root,"prompt",{version:1,text})}); return 0;
 }
 if(command==="profile-capture") { output({profile:saveVersion(root,"profile",captureProfile(inventory(w.home,w.host,w.mode==="simulation"?{}:effectiveRoots()),w.mode==="simulation"?undefined:path.resolve(import.meta.dir,"../..")))}); return 0; }
 if(command==="profile-export") { if(!values.profile||!values.to) throw new Error("Specify --profile and --to"); exportDraft(values.to,loadVersion<Profile>(root,"profile",values.profile)); console.log(path.resolve(values.to)); return 0; }
 if(command==="profile-freeze") { if(!values.from) throw new Error("Specify --from"); output({profile:saveVersion(root,"profile",freezeDraft(values.from))}); return 0; }
 if(command==="freeze") {
  const recipe=validateRecipe(JSON.parse(fs.readFileSync(path.join(root,"recipe.json"),"utf8")));
  if(recipe.mode!==w.mode||recipe.host!==w.host) throw new Error("Create another workspace to change host or simulation mode");
  const env=w.mode==="simulation"?{platform:process.platform,arch:process.arch,bun:Bun.version,hostVersion:"simulation",control:"synthetic home"}:await environmentFor(w.host);
  const experiment=prepareExperiment(root,recipe,env); atomicJSON(path.join(root,"selection.json"),{experiment}); output({experiment}); return 0;
 }
 if(command==="plan") { const id=selected(root,values.experiment),e=readExperiment(root,id); output({experiment:id,...e,schedule:schedule(e.recipe)}); return 0; }
 if(command==="history") {
  const dir=path.join(root,"executions"); output(!exists(dir)?[]:fs.readdirSync(dir).filter(n=>/^[a-f0-9-]{36}$/.test(n)).map(id=>{const {results}=loadResults(root,id); return {id,experiment:results.experiment,state:results.state,startedAt:results.startedAt,attempts:results.rows.length,accepted:results.rows.filter(r=>r.accepted).length};})); return 0;
 }
 if(command==="report") { if(!values.execution) throw new Error("Specify --execution"); console.log(writeReport(root,values.execution)); return 0; }
 if(command==="compare") {
  if(!values.left||!values.right||!values.from||!values.to) throw new Error("Specify --left, --right, --from and --to");
  output(compare(loadResults(root,values.left),loadResults(root,values.right),values.from,values.to)); return 0;
 }
 if(command!=="run"&&command!=="repeat"&&command!=="drill") throw new Error("Unknown command");
 if(command==="repeat"&&!values.execution) throw new Error("Specify --execution");
 const id=command==="repeat"?loadResults(root,values.execution!).results.experiment:selected(root,values.experiment);
 const e=readExperiment(root,id);
 if(e.recipe.host!==w.host||e.recipe.mode!==w.mode) throw new Error("Experiment differs from workspace host/mode");
 if(command!=="repeat"&&!values.experiment&&canonical(validateRecipe(JSON.parse(fs.readFileSync(path.join(root,"recipe.json"),"utf8"))))!==canonical(e.recipe)) throw new Error("The recipe draft changed; freeze it or explicitly select the previous experiment");
 const controller=new AbortController(),cancel=()=>controller.abort(); process.on("SIGINT",cancel);process.on("SIGTERM",cancel);
 try {
  output({experiment:id,mode:e.recipe.mode,kind:command==="drill"?"drill":"evaluation",attempts:command==="drill"?0:schedule(e.recipe).length,profiles:e.recipe.conditions.length,limits:e.recipe.limits});
  const result=await runExperiment(root,id,{home:w.home,drill:command==="drill",signal:controller.signal,onTrial:a=>console.log(`${a.order}/${schedule(e.recipe).length} · ${a.scenario} · ${a.condition}`)});
  output({execution:result.id,state:result.state,error:result.error,report:writeReport(root,result.id)});
  return ["finished-restored","drill-restored"].includes(result.state)?0:2;
 } finally {process.off("SIGINT",cancel);process.off("SIGTERM",cancel);}
}
if(import.meta.main) main().then(code=>{process.exitCode=code;}).catch(error=>{console.error(error instanceof SyntaxError?"Invalid input syntax; inspect the selected local JSON/TOML file.":error instanceof Error?error.message:"Laboratory failed");process.exitCode=1;});
