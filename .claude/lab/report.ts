import * as fs from "node:fs";
import { join } from "node:path";
import { canonical, hash, within, type RunRecord } from "./store";
import { readExperiment, type Experiment, type Results } from "./runner";
export const escapeHTML=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function summarize(rows: RunRecord[], condition: string) {
 const group=rows.filter(r=>r.condition===condition), accepted=group.filter(r=>r.accepted).length;
 const total=(key:"seconds"|"verifierSeconds"|"apiEquivalentUsd")=>group.length && group.every(r=>typeof r[key]==="number"&&Number.isFinite(r[key]))?group.reduce((n,r)=>n+r[key]!,0):null;
 const seconds=total("seconds"), cost=total("apiEquivalentUsd"), times=group.flatMap(r=>r.seconds===null?[]:[r.seconds]).sort((a,b)=>a-b);
 const median=times.length?(times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2:null;
 return {condition,attempted:group.length,accepted,acceptanceRate:group.length?accepted/group.length:null,seconds,verifierSeconds:total("verifierSeconds"),medianSeconds:median,timeCoverage:times.length,secondsPerAccepted:accepted&&seconds!==null?seconds/accepted:null,apiEquivalentUsd:cost,apiEquivalentPerAccepted:accepted&&cost!==null?cost/accepted:null,criticalFailures:group.reduce((n,r)=>n+r.checks.filter(c=>c.critical&&!c.passed).length,0),regressions:group.reduce((n,r)=>n+r.regressions,0),executionErrors:group.filter(r=>r.status!=="completed").length};
}
export interface Compared { experiment: Experiment; rows: RunRecord[]; results?: Results }
export function compare(a: Compared,b: Compared,from: string,to: string) {
 const reasons:string[]=[], same=(x:unknown,y:unknown)=>canonical(x??null)===canonical(y??null);
 const pa=a.experiment.recipe,pb=b.experiment.recipe;
 for(const side of [a,b]) if(side.results&&!['finished-restored','recovered-restored'].includes(side.results.state)) reasons.push("Execution is not fully restored");
 for(const key of ["host","model","mode","factor","seed","limits"] as const) if(!same(pa[key],pb[key])) reasons.push(`Different ${key}`);
 for(const key of ["engine","environment","scenarios","nativeCommon"] as const) if(!same(a.experiment[key],b.experiment[key])) reasons.push(`Different ${key}`);
 const ca=pa.conditions.find(c=>c.id===from),cb=pb.conditions.find(c=>c.id===to);
 if(!ca||!cb) reasons.push("Condition not found");
 else if(pa.factor==="profile"&&!same(ca.prompt,cb.prompt)) reasons.push("Prompt changed in a profile comparison");
 else if(pa.factor==="prompt"&&!same(ca.profile,cb.profile)) reasons.push("Profile changed in a prompt comparison");
 if(pa.factor==="exploratory") reasons.push("Exploratory comparison has multiple changing factors");
 const index=(rows:RunRecord[],condition:string)=>{
  const map=new Map<string,RunRecord>();
  for(const r of rows.filter(r=>r.condition===condition)) { const key=`${r.scenario}/${r.trial}`; if(map.has(key)) reasons.push("Duplicate task/trial"); map.set(key,r); }
  return map;
 };
 const x=index(a.rows,from),y=index(b.rows,to),keys=[...x.keys()].filter(k=>y.has(k));
 const expected=pa.scenarios.length*pa.trials;
 if(!keys.length || keys.length!==x.size || keys.length!==y.size || x.size!==expected || y.size!==pb.scenarios.length*pb.trials) reasons.push("Incomplete or unmatched task/trial coverage");
 const signature=(r:RunRecord)=>r.modelUsage?canonical(Object.keys(r.modelUsage).sort()):r.model;
 const rows=[...x.values(),...y.values()], signatures=new Set(rows.map(signature).filter(s=>s!==null));
 if(signatures.size>1) reasons.push("Resolved models differ");
 if(pa.mode==="live"&&rows.some(r=>r.status==="completed"&&signature(r)===null)) reasons.push("Resolved model unknown");
 const comparable=!reasons.length;
 return {comparable,reasons,paired:keys.length,acceptancePoints:comparable?100*keys.reduce((n,k)=>n+Number(y.get(k)!.accepted)-Number(x.get(k)!.accepted),0)/keys.length:null,from:summarize([...x.values()],from),to:summarize([...y.values()],to),interpretation:"Observed matched results only; no statistical superiority or equivalence claim",limitations:["Repeated attempts are not independent tasks","Native loading and provider changes require separate evidence"]};
}
export function loadResults(root:string,id:string): Compared & {results:Results} {
 if(!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid execution identifier");
 const {integrity,...results}=JSON.parse(fs.readFileSync(within(root,join("executions",id,"results.json")),"utf8")) as Results & {integrity:string};
 if(results.version!==1||results.id!==id||!Array.isArray(results.rows)) throw new Error("Invalid result record");
 if(integrity!==hash(results)) throw new Error("Result integrity mismatch");
 return {results,rows:results.rows,experiment:readExperiment(root,results.experiment)};
}
export function renderReport(experiment:Experiment,results:Results): string {
 const e=escapeHTML,n=(v:number|null)=>typeof v==="number"&&Number.isFinite(v)?v.toFixed(2):"—",p=experiment.recipe;
 const summaries=p.conditions.map(c=>summarize(results.rows,c.id));
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Laboratorio · ${e(p.name)}</title><style>
:root{color-scheme:light dark;--bg:#f7f8fa;--ink:#172333;--muted:#485767;--line:#ccd3dd;--accent:#075885}*{box-sizing:border-box}body{font:16px/1.6 system-ui,sans-serif;background:var(--bg);color:var(--ink);max-width:1200px;margin:auto;padding:32px}h1{font-size:2rem;line-height:1.2}h2{font-size:1.25rem;margin-top:2rem}p{max-width:85ch}.meta{color:var(--muted)}.notice{border-left:4px solid var(--accent);padding:12px 20px}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}caption{text-align:left;font-weight:600;padding:12px 0}th,td{text-align:left;border-bottom:1px solid var(--line);padding:10px 12px;vertical-align:top}th{color:var(--accent)}.scroll{overflow-x:auto}details{margin:12px 0}summary{cursor:pointer}summary:focus-visible{outline:3px solid var(--accent)}code{overflow-wrap:anywhere}@media(prefers-color-scheme:dark){:root{--bg:#101923;--ink:#e8eef6;--muted:#b6c4d5;--line:#3b4c60;--accent:#8fd5fa}}@media print{body{padding:0;font-size:11pt}.scroll{overflow:visible}details{break-inside:avoid}}
</style></head><body><main><h1>${e(p.name)}</h1><p class="notice"><strong>${results.kind==="drill"?"ENSAYO DE RECUPERACIÓN: perfiles intercambiados sin ejecutar modelos ni puntuar tareas.":p.mode==="simulation"?"SIMULACIÓN: resultados sintéticos, sin modelos.":"Experimento nativo: resultados observados en los escenarios seleccionados."}</strong><br>El informe no acredita superioridad estadística ni ausencia de defectos.</p><p class="meta">${e(p.host)} · Modelo solicitado: ${e(p.model)} · ${e(experiment.environment.platform)}<br>Estado: ${e(results.state)} · ${results.rows.length} intentos registrados</p>
<div class="scroll"><table><caption>Calidad y consumo por configuración</caption><thead><tr><th scope="col">Configuración</th><th scope="col">Aceptadas / intentos</th><th scope="col">Fallos críticos</th><th scope="col">Regresiones</th><th scope="col">Segundos / aceptada</th><th scope="col">USD API equivalentes / aceptada</th></tr></thead><tbody>${summaries.map(s=>`<tr><th scope="row">${e(s.condition)}</th><td>${s.accepted} / ${s.attempted}</td><td>${s.criticalFailures}</td><td>${s.regressions}</td><td>${n(s.secondsPerAccepted)}</td><td>${n(s.apiEquivalentPerAccepted)}</td></tr>`).join("")}</tbody></table></div>
<p>Los ratios incluyen los intentos fallidos. — indica datos desconocidos o un ratio sin soluciones aceptadas. El equivalente API no es gasto facturado ni cuota de suscripción.</p><div class="scroll"><table><caption>Resultados individuales</caption><thead><tr><th scope="col">Escenario</th><th scope="col">Configuración</th><th scope="col">Repetición</th><th scope="col">Resultado</th><th scope="col">Tiempo agente</th><th scope="col">Verificación</th></tr></thead><tbody>${results.rows.map(r=>`<tr><th scope="row">${e(r.scenario)}</th><td>${e(r.condition)}</td><td>${r.trial}</td><td>${r.accepted?"Aceptada":r.status==="completed"?"Requisitos incumplidos":e(r.status)}</td><td>${n(r.seconds)} s</td><td>${n(r.verifierSeconds)} s</td></tr>`).join("")}</tbody></table></div>
<h2>Evidencia por intento</h2>${results.rows.map(r=>`<details><summary>${e(r.id)} · ${r.checks.filter(c=>c.passed).length}/${r.checks.length} comprobaciones</summary><ul>${r.checks.map(c=>`<li>${c.passed?"Cumple":"Falla"}: ${e(c.name)}${c.critical?" (crítico)":""}</li>`).join("")}</ul><p>Modelo resuelto: ${e(r.model??"desconocido")} · Turnos: ${r.numTurns??"desconocido"} · Denegaciones de permiso: ${r.permissionDenials?r.permissionDenials.length:"desconocido"}</p></details>`).join("")}
<h2>Versiones y condiciones</h2><p>Se comparan escenarios y repeticiones emparejados. Los cambios de prompt, pruebas, modelo, sistema o entorno deben examinarse antes de atribuir una diferencia a la configuración.</p><details><summary>Definición congelada</summary><pre><code>${e(JSON.stringify(experiment,null,2))}</code></pre></details>${results.error?`<p class="notice">${e(results.error)}</p>`:""}</main></body></html>`;
}
export function writeReport(root:string,id:string): string {
 const data=loadResults(root,id),file=within(root,join("executions",id,"report.html"));
 fs.writeFileSync(file,renderReport(data.experiment,data.results)); return file;
}
