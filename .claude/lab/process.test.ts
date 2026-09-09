import { test, expect } from "bun:test";
import { execute } from "./process";
import { commandFor, decode } from "./adapters";
test("bounded commands drain pipes and preserve nonzero exit",async()=>{
 const r=await execute([process.execPath,"-e",'process.stderr.write("x".repeat(200000));console.log("partial");process.exit(2)'],process.cwd(),3);
 expect(r.code).toBe(2); expect(r.stdout).toContain("partial");
 const hung=await execute([process.execPath,"-e","setInterval(()=>{},1000)"],process.cwd(),0.1);
 expect(hung.timedOut).toBe(true); expect(hung.seconds).toBeLessThan(3);
 const noisy=await execute([process.execPath,"-e",'process.stdout.write("x".repeat(9000000))'],process.cwd(),3);
 expect(noisy.outputLimit).toBe(true);
});
test("Claude requires successful completion and extracts only assistant prose",()=>{
 const cmd=commandFor("claude","claude","explicit-model","task"); expect(cmd).toContain("--model"); expect(cmd).toContain("explicit-model");
 const raw=[{type:"system",text:"not prose"},{type:"assistant",message:{content:[{type:"text",text:"Answer"}]}},{type:"result",subtype:"success",is_error:false,result:"Answer",usage:{input_tokens:3},modelUsage:{chosen:{}},total_cost_usd:0.1}].map(x=>JSON.stringify(x)).join("\n");
 expect(decode("claude",raw).text).toBe("Answer"); expect(decode("claude",raw).terminal).toBe(true);
 for(const bad of ["", "{}", raw.split("\n").slice(0,-1).join("\n"),JSON.stringify({type:"result",subtype:"error",result:"Answer"})]) expect(decode("claude",bad).terminal).toBe(false);
 expect(()=>commandFor("claude","claude","","task")).toThrow();
});

test("cancellation while recording a child is not lost",async()=>{
 const controller=new AbortController();
 const r=await execute([process.execPath,"-e","setTimeout(()=>process.exit(0),1500)"],process.cwd(),3,controller.signal,pid=>{if(pid)controller.abort();});
 expect(r.cancelled).toBe(true); expect(r.timedOut).toBe(false);
});

test("parent exit terminates descendants that retain inherited pipes",async()=>{
 const descendant='console.log("descendant="+process.pid);setTimeout(()=>process.exit(0),3000);';
 const parent=`import {spawn} from 'node:child_process';spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:['ignore','inherit','inherit']});setTimeout(()=>process.exit(0),400);`;
 const r=await execute([process.execPath,"-e",parent],process.cwd(),2);
 expect(r.code).toBe(0); expect(r.timedOut).toBe(false);
 const pid=Number(r.stdout.match(/descendant=(\d+)/)?.[1]); expect(pid).toBeGreaterThan(0);
 let alive=false; try {process.kill(pid,0);alive=true;} catch {}
 expect(alive).toBe(false);
});
