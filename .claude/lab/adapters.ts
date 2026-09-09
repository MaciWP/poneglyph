import type { Host } from "./store";
export interface Telemetry { terminal: boolean; text: string; model: string | null; usage: Record<string, number> | null; apiEquivalentUsd: number | null; numTurns: number | null; apiSeconds: number | null; modelUsage: Record<string, unknown> | null; permissionDenials: unknown[] | null }
const unknown = { numTurns: null, apiSeconds: null, modelUsage: null, permissionDenials: null } as const;
const empty = (): Telemetry => ({terminal:false,text:"",model:null,usage:null,apiEquivalentUsd:null,...unknown});
const number = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v>=0;
const record = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
function usage(value: unknown): Record<string,number> | null {
 if (!value || typeof value !== "object" || Array.isArray(value)) return null;
 const rows=Object.entries(value).filter((p):p is [string,number]=>number(p[1]));
 return rows.length?Object.fromEntries(rows):null;
}
export function commandFor(host: Host, binary: string, model: string, prompt: string): string[] {
 if (!model.trim() || model.startsWith("-") || !binary) throw new Error("An explicit model and binary are required");
 if (host === "grok") return [binary,"--no-auto-update","-p",prompt,"--model",model,"--output-format","streaming-messages-json","--permission-mode","dontAsk","--allow","Read","--allow","Write","--allow","Edit","--allow","Glob","--allow","Grep","--allow","Bash"];
 if (host === "codex") return [binary,"exec","--json","--ephemeral","--sandbox","workspace-write","--skip-git-repo-check","--model",model,prompt];
 if (host !== "claude") throw new Error("Adapter not implemented");
 // Declared envelope: the profile's common permissions may extend it; system/init and permission_denials in the stream show the effective one.
 return [binary,"-p",prompt,"--model",model,"--output-format","stream-json","--verbose","--no-session-persistence","--permission-mode","dontAsk","--allowedTools","Read","Write","Edit","Glob","Grep","Bash","Skill"];
}
export function decode(host: Host, raw: string): Telemetry {
 try {
  const events=raw.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  if (!events.length || events.some(e=>!e || typeof e!=="object" || Array.isArray(e))) return empty();
  if (host === "grok") {
   // Grok 1.0.13 --help identifies this as the Anthropic Messages wire format.
   // Only a complete assistant message or successful SDK result is terminal.
   if(events.some(e=>e.type==="error"||e.error||e.is_error)) return empty();
   const last=events.at(-1);
   if(last.type==="result") return decode("claude",raw);
   const message=last.type==="assistant"?last.message:last.type==="message"?last:null;
   if(message?.role!=="assistant" || !["end_turn","stop_sequence"].includes(message.stop_reason) || !Array.isArray(message.content)) return empty();
   const text=message.content.filter((c:any)=>c.type==="text"&&typeof c.text==="string").map((c:any)=>c.text).join("\n");
   if(!text.trim()) return empty();
   return {terminal:true,text,model:typeof message.model==="string"?message.model:null,usage:usage(message.usage),apiEquivalentUsd:null,...unknown};
  }
  if (host === "codex") {
   if(events.some(e=>e.type==="turn.failed"||e.type==="error") || events.at(-1).type!=="turn.completed") return empty();
   const texts=events.filter(e=>e.type==="item.completed"&&e.item?.type==="agent_message"&&typeof e.item.text==="string").map(e=>e.item.text);
   if(!texts.length || !texts.at(-1).trim()) return empty();
   return {terminal:true,text:texts.at(-1),model:events.find(e=>typeof e.model==="string")?.model??null,usage:usage(events.at(-1).usage),apiEquivalentUsd:null,...unknown};
  }
  if (host!=="claude") return empty();
  const result=events.at(-1);
  if (result.type!=="result" || result.subtype!=="success" || result.is_error===true || typeof result.result!=="string" || !result.result.trim() || events.some(e=>e.is_error || (e.type==="result" && e.subtype?.startsWith("error")))) return empty();
  const models=record(result.modelUsage);
  return {terminal:true,text:result.result,model:models && Object.keys(models).length===1?Object.keys(models)[0]:null,usage:usage(result.usage),apiEquivalentUsd:number(result.total_cost_usd)?result.total_cost_usd:null,numTurns:Number.isInteger(result.num_turns)&&result.num_turns>=0?result.num_turns:null,apiSeconds:number(result.duration_api_ms)?result.duration_api_ms/1000:null,modelUsage:models,permissionDenials:Array.isArray(result.permission_denials)?result.permission_denials:null};
 } catch { return empty(); }
}
