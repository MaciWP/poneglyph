import {test,expect} from "bun:test";
import {summarize,compare,renderReport} from "./report";
import type {RunRecord} from "./store";
const row=(condition:string,accepted:boolean,cost:number|null=1):RunRecord=>({id:"ownership.t1."+condition,scenario:"ownership",trial:1,condition,order:1,status:"completed",accepted,seconds:10,verifierSeconds:1,checks:[{name:"access",critical:true,passed:accepted}],regressions:0,model:null,usage:null,apiEquivalentUsd:cost});
const experiment:any={version:1,recipe:{name:"Example",host:"claude",model:"chosen",mode:"simulation",factor:"profile",trials:1,scenarios:["ownership"],conditions:[{id:"a",profile:"1",prompt:"same"},{id:"b",profile:"2",prompt:"same"}]},scenarios:{ownership:"scenario-v1"},environment:{platform:"win32"},engine:"engine"};
test("ratios include failures and unknown cost is never zero",()=>{
 const rows=[row("a",true),{...row("a",false),trial:2}]; expect(summarize(rows,"a").secondsPerAccepted).toBe(20);
 expect(summarize([row("a",false)],"a").secondsPerAccepted).toBeNull();
 expect(summarize([row("a",true,null)],"a").apiEquivalentPerAccepted).toBeNull();
});
test("comparison refuses causal labels on changed environments or incomplete pairs",()=>{
 const a={experiment,rows:[row("a",false)]},b={experiment,rows:[row("b",true)]};
 expect(compare(a,b,"a","b").paired).toBe(1);
 expect(compare(a,b,"a","b").acceptancePoints).toBe(100);
 const changed={...b,experiment:{...experiment,environment:{platform:"darwin"}}}; expect(compare(a,changed,"a","b").comparable).toBe(false);
 const common={...b,experiment:{...experiment,nativeCommon:"different-native-settings"}}; expect(compare(a,common,"a","b").comparable).toBe(false);
 const missing={...b,rows:[]}; expect(compare(a,missing,"a","b").comparable).toBe(false);
});
test("HTML exposes synthetic mode, escapes text and keeps individual failures",()=>{
 const html=renderReport({...experiment,recipe:{...experiment.recipe,name:'<script>bad</script>'}},{state:"finished-restored",rows:[row("a",false),row("b",true)]} as any);
 expect(html).toContain("SIMULACIÓN"); expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>bad"); expect(html).toContain("access");
});
