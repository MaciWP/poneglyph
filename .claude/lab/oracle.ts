import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Database } from "bun:sqlite";
import { materializeScenario, type Scenario } from "./catalog";
import { within, canonical, type Check } from "./store";
import { execute } from "./process";

export interface Evaluation { status: string; accepted: boolean; checks: Check[]; seconds: number }
export async function evaluate(work: string, s: Scenario, seed: number, signal?: AbortSignal, onChild?: (pid?: number)=>void): Promise<Evaluation> {
 const start = performance.now(); const checks: Check[] = [];
 const result = (status: string): Evaluation => ({ status, accepted: status === "evaluated" && checks.length > 0 && checks.every(c=>c.passed), checks, seconds:(performance.now()-start)/1000 });
 let submitted: Buffer;
 try {
  for (const [name,file] of Object.entries(s.initial)) {
   const p = within(work,name);
   if (!fs.lstatSync(p).isFile()) throw new Error("Missing or linked submission");
   if (name !== "src/service.ts" && !fs.readFileSync(p).equals(Buffer.from(file.data!,"base64"))) throw new Error("Protected file changed");
  }
  submitted = fs.readFileSync(within(work,"src/service.ts"));
  if (submitted.length > 256*1024) throw new Error("Submission too large");
 } catch { return result("submission-invalid"); }
 const clean = fs.realpathSync(fs.mkdtempSync(join(tmpdir(),"poneglyph-verifier-")));
 try {
  materializeScenario(clean,s);
  fs.writeFileSync(join(clean,"src/service.ts"),submitted);
  const offset = seed * 10, u = offset+1, other = offset+2;
  const actions = [
   {method:"getNote",args:[u,offset+1]}, {method:"getNote",args:[u,offset+2]}, {method:"getNote",args:[u,offset+999]},
   {method:"listNotes",args:[u]}, {method:"listNotes",args:[other]}, {method:"listNotes",args:[offset+3]},
   {method:"createNote",args:[other,"  New note  "]},
   ...["","   ","x".repeat(81),null,42,{}].map(value=>({method:"createNote",args:[u,value]})),
   {method:"createNote",args:[u,"x".repeat(80)]},
   {method:"getNote",args:[other,offset+2]}, {method:"getNote",args:[other,offset+1]},
   {method:"importNotes",args:[u,"batch-"+seed,["One","Two"],1]},
   {method:"importNotes",args:[u,"batch-"+seed,["One","Two"]]},
   {method:"importNotes",args:[u,"batch-"+seed,["One","Two"]]},
   {method:"importNotes",args:[u,"batch-"+seed,["Different"]]},
   ...["","   ","x".repeat(81),null,42,{}].map((value,i)=>({method:"importNotes",args:[u,"invalid-"+i,["Valid",value]]})),
  ];
  const database = join(clean,"observed.sqlite");
  const observe=async(batch:typeof actions)=>{
   const nonce=randomBytes(24).toString("hex");
   const observed=await execute([process.execPath,join(import.meta.dir,"worker.ts")],clean,5,signal,onChild,{input:JSON.stringify({nonce,seed,database,store:join(clean,"src/store.ts"),service:join(clean,"src/service.ts"),actions:batch}),env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:tmpdir(),TMPDIR:tmpdir()}});
   if(observed.code!==0||observed.timedOut||observed.cancelled||observed.outputLimit) throw new Error("Invalid verifier process");
   const payload=JSON.parse(observed.stdout);
   if(payload?.nonce!==nonce||!Array.isArray(payload.results)||payload.results.length!==batch.length||payload.results.some((r:any)=>typeof r?.error!=="boolean"||!Number.isInteger(r.queries)||r.queries<0||!Number.isInteger(r.changes)||r.changes<0)) throw new Error("Invalid verifier observations");
   return payload.results as {value:any;error:boolean;queries:number;changes:number}[];
  };
  const first=await observe(actions.slice(0,17));
  const interrupted=new Database(database,{readonly:true}); let cleanFailure=false;
  try {
   cleanFailure=first[16].error&&(interrupted.query("SELECT COUNT(*) AS n FROM batches").get() as any).n===0&&(interrupted.query("SELECT COUNT(*) AS n FROM notes").get() as any).n===3+Number(!first[6].error)+Number(!first[13].error);
  } finally { interrupted.close(); }
  // Observe the intermediate state before a retry can conceal a failed rollback.
  const r=[...first,...await observe(actions.slice(17))], check=(name:string,critical:boolean,passed:boolean)=>checks.push({name,critical,passed});
  check("failed-import-clean",true,cleanFailure);
  check("own-note",false,!r[0].error && r[0].value?.title===`Alpha-${seed}`);
  check("cross-user-denied",true,!r[1].error && r[1].value===null);
  check("missing-note",false,!r[2].error && r[2].value===null);
  check("list-contract",false,!r[3].error && canonical(r[3].value)===canonical([{id:offset+1,owner_id:u,title:`Alpha-${seed}`,owner_name:"Alice"},{id:offset+3,owner_id:u,title:`Gamma-${seed}`,owner_name:"Alice"}]));
  check("list-isolation",true,!r[4].error && r[4].value?.length===1 && r[4].value[0].id===offset+2);
  check("query-bound",false,!r[3].error && r[3].queries<=1);
  check("empty-list",false,!r[5].error && Array.isArray(r[5].value) && r[5].value.length===0 && r[5].queries<=1);
  check("other-owner-access",true,!r[14].error && r[14].value?.title===`Private-${seed}` && !r[15].error && r[15].value===null);
  const db=new Database(database,{readonly:true});
  try {
   const notes=db.query("SELECT * FROM notes ORDER BY id").all() as any[];
   check("create-persist-trim",false,!r[6].error && r[6].value?.title==="New note" && r[6].value.owner_id===other && notes.some(n=>n.id===r[6].value.id && n.title==="New note" && n.owner_id===other));
   check("invalid-create-no-write",true,r.slice(7,13).every(x=>x.error&&x.changes===0) && notes.filter(n=>!["One","Two","Different"].includes(n.title)).length===3+Number(!r[6].error)+Number(!r[13].error));
   check("boundary-title",false,!r[13].error && r[13].value?.title==="x".repeat(80) && notes.some(n=>n.id===r[13].value.id && n.title==="x".repeat(80)));
   check("atomic-import",true,r[16].error && !r[17].error && notes.filter(n=>n.title==="One"||n.title==="Two").length===2);
   check("idempotent-import",true,!r[17].error && !r[18].error && r[18].changes===0 && canonical(r[17].value)===canonical(r[18].value) && r[19].error && r[19].changes===0 && !notes.some(n=>n.title==="Different"));
   check("invalid-import-no-write",true,r.slice(20).every(x=>x.error&&x.changes===0));
   check("original-data-preserved",true,[{id:offset+1,owner_id:u,title:`Alpha-${seed}`},{id:offset+2,owner_id:other,title:`Private-${seed}`},{id:offset+3,owner_id:u,title:`Gamma-${seed}`}].every(n=>notes.some(v=>canonical(v)===canonical(n))));
  } finally { db.close(); }
  if (s.unchanged) check("no-unnecessary-change",false,submitted.equals(Buffer.from(s.initial["src/service.ts"].data!,"base64")));
  return result("evaluated");
 } catch { return result("verifier-invalid"); }
 finally { fs.rmSync(clean,{recursive:true,force:true}); }
}
