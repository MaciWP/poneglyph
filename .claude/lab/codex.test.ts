import {test,expect} from "bun:test";
import {commandFor,decode} from "./adapters";
test("Codex retains native sandbox and trust and requires a completed turn",()=>{
 const args=commandFor("codex","codex","chosen-model","task");
 expect(args).toContain("exec"); expect(args).toContain("--json"); expect(args).toContain("--ephemeral"); expect(args).toContain("workspace-write");
 expect(args.some(s=>s.includes("bypass"))).toBe(false);
 const raw=[{type:"thread.started",thread_id:"fixture"},{type:"item.completed",item:{type:"agent_message",text:"Done"}},{type:"turn.completed",usage:{input_tokens:30,cached_input_tokens:20,output_tokens:5}}].map(x=>JSON.stringify(x)).join("\n");
 expect(decode("codex",raw).terminal).toBe(true); expect(decode("codex",raw).text).toBe("Done");
 expect(decode("codex",raw).usage?.input_tokens).toBe(30);
 for(const bad of ["{}",raw.split("\n").slice(0,-1).join("\n"),raw+'\n{"type":"turn.failed"}']) expect(decode("codex",bad).terminal).toBe(false);
});
