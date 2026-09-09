import {test,expect} from "bun:test";
import {commandFor,decode} from "./adapters";
test("Grok uses its native command and rejects empty or failed final output",()=>{
 expect(commandFor("grok","grok","explicit","task")).toContain("--no-auto-update");
 expect(commandFor("grok","grok","explicit","task")).toContain("streaming-messages-json");
 for(const raw of ["{}","[]","null","not json",JSON.stringify({error:"rate limit",response:"partial"}),JSON.stringify({status:"failed",response:"partial"})]) expect(decode("grok",raw).terminal).toBe(false);
 const result=decode("grok",JSON.stringify({type:"assistant",message:{type:"message",role:"assistant",content:[{type:"text",text:"Implemented"}],model:"explicit",stop_reason:"end_turn",usage:{input_tokens:5,output_tokens:2}}}));
 expect(result.terminal).toBe(true); expect(result.apiEquivalentUsd).toBeNull(); expect(result.text).toBe("Implemented");
 expect(decode("grok",JSON.stringify({response:"Implemented"})).terminal).toBe(false);
});
