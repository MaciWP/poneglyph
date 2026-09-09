import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, renameSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { inventory, captureProfile, deriveProfile } from "./profiles";
import { saveVersion, type Recipe } from "./store";
import { prepareExperiment, runExperiment } from "./runner";
import { loadResults } from "./report";
function fixture() {
 const root=mkdtempSync(join(tmpdir(),"poneglyph-runner-")), data=join(root,"data"), home=join(data,"simulation-home"); mkdirSync(join(home,".claude"),{recursive:true});
 writeFileSync(join(home,".claude","CLAUDE.md"),"Original configuration");
 const current=captureProfile(inventory(home,"claude")); const a=saveVersion(data,"profile",deriveProfile(current,"base")), b=saveVersion(data,"profile",current);
 const prompt=saveVersion(data,"prompt",{version:1,text:"{{task}}"});
 const recipe: Recipe={version:1,name:"test",host:"claude",model:"simulation",mode:"simulation",factor:"profile",seed:3,trials:2,scenarios:["ownership"],conditions:[{id:"base",profile:a,prompt},{id:"current",profile:b,prompt}],limits:{maxRuns:4,secondsPerRun:3,totalSeconds:30}};
 return {root,home,data,recipe};
}
test("frozen experiments repeat with fresh attempts and restore original configuration",async()=>{
 const f=fixture(), id=prepareExperiment(f.data,f.recipe,{platform:process.platform,hostVersion:"simulation"});
 const works:string[]=[];
 const a=await runExperiment(f.data,id,{home:f.home,onTrial:(_,work)=>works.push(work)}), b=await runExperiment(f.data,id,{home:f.home});
 expect(a.id).not.toBe(b.id); expect(a.state).toBe("finished-restored"); expect(a.rows).toHaveLength(4);
 expect(a.rows.filter(r=>r.accepted)).toHaveLength(2);
 // Opaque temporary work directories outside the laboratory, removed after retention.
 expect(works).toHaveLength(4); expect(works.every(w=>basename(w).startsWith("poneglyph-trial-")&&!w.startsWith(f.data)&&!existsSync(w))).toBe(true);
 const run=join(f.data,"executions",a.id,"runs",a.rows[0].id);
 expect(readFileSync(join(run,"stream.jsonl"),"utf8")).toContain("synthetic process");
 expect(readFileSync(join(run,"final.txt"),"utf8")).toBe("Synthetic result");
 expect(existsSync(join(run,"work","src","service.ts"))).toBe(true);
 expect(a.rows.filter(r=>r.condition==="base").every(r=>!r.accepted)).toBe(true);
 expect(readFileSync(join(f.home,".claude","CLAUDE.md"),"utf8")).toBe("Original configuration");
 expect(JSON.parse(readFileSync(join(f.data,"executions",a.id,"results.json"),"utf8")).rows).toHaveLength(4);
 const file=join(f.data,"executions",a.id,"results.json"), altered=JSON.parse(readFileSync(file,"utf8")); altered.rows[0].accepted=true; writeFileSync(file,JSON.stringify(altered));
 expect(()=>loadResults(f.data,a.id)).toThrow("integrity");
},30000);
test("simulation cannot swap a home outside its private workspace",async()=>{
 const f=fixture(), id=prepareExperiment(f.data,f.recipe,{platform:process.platform,hostVersion:"simulation"});
 const external=mkdtempSync(join(tmpdir(),"poneglyph-unrelated-")); mkdirSync(join(external,".claude"));
 await expect(runExperiment(f.data,id,{home:external})).rejects.toThrow("Simulation home");
},30000);
test("recovery drill swaps profiles without executing or scoring tasks",async()=>{
 const f=fixture(),id=prepareExperiment(f.data,f.recipe,{platform:process.platform,hostVersion:"simulation"});
 const r=await runExperiment(f.data,id,{home:f.home,drill:true});
 expect(r.state).toBe("drill-restored");expect(r.rows).toHaveLength(0);expect(r.profileChecks).toHaveLength(2);
 expect(readFileSync(join(f.home,".claude","CLAUDE.md"),"utf8")).toBe("Original configuration");
});
test("cancellation restores the original profile",async()=>{
 const f=fixture(), id=prepareExperiment(f.data,f.recipe,{platform:process.platform,hostVersion:"simulation"});
 const controller=new AbortController();
 const r=await runExperiment(f.data,id,{home:f.home,signal:controller.signal,onTrial:()=>controller.abort()});
 expect(r.state).toBe("interrupted-restored"); expect(r.rows).toHaveLength(1);
 expect(r.rows[0].accepted).toBe(false);
 expect(readFileSync(join(f.home,".claude","CLAUDE.md"),"utf8")).toBe("Original configuration");
},30000);

test("a real spawn failure restores the profile and records an execution error",async()=>{
 const f=fixture(); f.recipe.conditions=f.recipe.conditions.filter(c=>c.id==="base");
 const id=prepareExperiment(f.data,f.recipe,{platform:process.platform,hostVersion:"simulation"});
 let moved="";
 const r=await runExperiment(f.data,id,{home:f.home,onTrial:(_,work)=>{
  // Removing the cwd through a reversible rename forces spawn itself to fail.
  moved=work+"-moved"; renameSync(work,moved);
 }});
 expect(r.state).toBe("failed-restored"); expect(r.rows).toHaveLength(1);
 expect(r.rows[0].status).toBe("execution-error"); expect(r.rows[0].accepted).toBe(false);
 expect(r.error).toContain("spawn");
 expect(readFileSync(join(f.home,".claude","CLAUDE.md"),"utf8")).toBe("Original configuration");
 expect(existsSync(join(f.home,".poneglyph-lab","active.json"))).toBe(false);
 rmSync(moved,{recursive:true,force:true});
},30000);
