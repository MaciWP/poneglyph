import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inventory, captureProfile, deriveProfile, installProfile, validateProfile, exportDraft, freezeDraft, assertProfileInventory, prepareCore } from "./profiles";
import { buildCodexLinks, generatedContent } from "../scripts/sync-codex";
test("capture freezes linked configuration, preserves authentication and isolates candidate edits", () => {
  const home = mkdtempSync(join(tmpdir(), "poneglyph-profile-"));
  mkdirSync(join(home, ".claude")); mkdirSync(join(home, "source"));
  writeFileSync(join(home, "source", "SKILL.md"), "Original");
  symlinkSync(join(home, "source"), join(home, ".claude", "skills"), process.platform === "win32" ? "junction" : "dir");
  writeFileSync(join(home, ".claude", ".credentials.json"), "DO NOT COPY");
  writeFileSync(join(home, ".claude", "settings.json"), JSON.stringify({ model: "configured", outputStyle: "Poneglyph" }));
  const inv = inventory(home, "claude");
  expect(inv.preserved.some(p => p.endsWith(".credentials.json"))).toBe(true);
  const current = captureProfile(inv);
  writeFileSync(join(home, "source", "SKILL.md"), "Changed later");
  expect(JSON.stringify(current)).not.toContain("DO NOT COPY");
  expect(Buffer.from(current.entries["claude/skills"]["SKILL.md"].data!, "base64").toString()).toBe("Original");
  const base = deriveProfile(current, "base");
  expect(base.entries["claude/skills"]).toBeUndefined();
  const nativeSettings = JSON.parse(Buffer.from(base.entries["claude/settings.json"][""].data!, "base64").toString());
  expect(nativeSettings.model).toBe("configured");
  expect(nativeSettings.outputStyle).toBeUndefined();
  const dest = mkdtempSync(join(tmpdir(), "poneglyph-profile-install-")); mkdirSync(join(dest, ".claude"));
  installProfile(inventory(dest, "claude"), current, join(dest, "bundle"));
  expect(readFileSync(join(dest, ".claude", "skills", "SKILL.md"), "utf8")).toBe("Original");
  const bad = structuredClone(current); bad.entries["claude/skills"]["../outside"] = bad.entries["claude/skills"]["SKILL.md"];
  expect(() => validateProfile(bad)).toThrow();
});
test("changed core doctrine regenerates captured Codex guidance",()=>{
 const home=mkdtempSync(join(tmpdir(),"poneglyph-guidance-home-")),source=mkdtempSync(join(tmpdir(),"poneglyph-guidance-source-"));
 mkdirSync(join(home,".codex"));
 for(const name of ["skills","commands","rules","system-prompts"])mkdirSync(join(source,".claude",name),{recursive:true});
 writeFileSync(join(source,"CLAUDE.md"),"Original doctrine\n");writeFileSync(join(source,".claude","rules","harness-runtime.md"),"Runtime\n");writeFileSync(join(source,".claude","system-prompts","poneglyph-sp.md"),"Style\n");
 writeFileSync(join(home,".codex","AGENTS.md"),generatedContent(buildCodexLinks(source,home)[0])!);
 const current=captureProfile(inventory(home,"codex"),source),draft=join(home,"draft");exportDraft(draft,current);
 writeFileSync(join(draft,"core","CLAUDE.md"),"Changed doctrine\n");
 const p=freezeDraft(draft);expect(Buffer.from(p.entries["codex/AGENTS.md"][""].data!,"base64").toString()).toContain("Changed doctrine");
});
test("absolute core references are rebound to frozen dependencies",()=>{
 const home=mkdtempSync(join(tmpdir(),"poneglyph-bound-home-")), core=mkdtempSync(join(tmpdir(),"poneglyph-bound-core-"));
 mkdirSync(join(home,".claude")); mkdirSync(join(core,".claude","hooks"),{recursive:true});
 writeFileSync(join(core,".claude","hooks","marker.ts"),"export const marker='original';");
 writeFileSync(join(home,".claude","settings.json"),JSON.stringify({hooks:{Stop:[{hooks:[{type:"command",command:'bun "'+core.replaceAll('\\','/')+'/.claude/hooks/marker.ts"'}]}]}}));
 const p=captureProfile(inventory(home,"claude"),core);
 writeFileSync(join(core,".claude","hooks","marker.ts"),"changed");
 const dest=mkdtempSync(join(tmpdir(),"poneglyph-bound-dest-")); mkdirSync(join(dest,".claude"));
 const bundle=join(dest,"frozen"); installProfile(inventory(dest,"claude"),p,bundle);
 expect(readFileSync(join(bundle,".claude","hooks","marker.ts"),"utf8")).toContain("original");
 expect(readFileSync(join(dest,".claude","settings.json"),"utf8")).toContain(bundle.replaceAll('\\','/'));
 expect(()=>prepareCore(bundle,p)).not.toThrow();
 writeFileSync(join(bundle,".claude","hooks","marker.ts"),"tampered");
 expect(()=>prepareCore(bundle,p)).toThrow("Frozen core");
});
test("missing compatibility roots remain single recoverable targets and invalid entries fail preflight",()=>{
 const home=mkdtempSync(join(tmpdir(),"poneglyph-missing-root-")); mkdirSync(join(home,".grok"));
 const inv=inventory(home,"grok"); expect(inv.targets.some(t=>t.path===join(realpathSync(home),".claude"))).toBe(true);
 const p=captureProfile(inv); p.entries["home/unregistered"]={"":{data:Buffer.from("unexpected").toString("base64"),mode:0o600}};
 expect(()=>assertProfileInventory(inv,p)).toThrow("outside inventory");
});
test("embedded authentication is rejected before it enters profile storage",()=>{
 const home=mkdtempSync(join(tmpdir(),"poneglyph-embedded-auth-")); mkdirSync(join(home,".claude"));
 writeFileSync(join(home,".claude","settings.json"),JSON.stringify({api_key:"fixture-placeholder"}));
 expect(()=>captureProfile(inventory(home,"claude"))).toThrow("authentication");
});
test("environment credential references and schema descriptions are not literal credentials",()=>{
 const home=mkdtempSync(join(tmpdir(),"poneglyph-auth-reference-")); mkdirSync(join(home,".claude"));
 writeFileSync(join(home,".claude","settings.json"),JSON.stringify({mcpServers:{example:{headers:{Authorization:"Bearer ${EXAMPLE_ACCESS_TOKEN}"}}},properties:{password:{type:"string"}}}));
 expect(()=>captureProfile(inventory(home,"claude"))).not.toThrow();
});
test("native executables and account metadata remain outside the swap",()=>{
 const home=mkdtempSync(join(tmpdir(),"poneglyph-runtime-files-")); mkdirSync(join(home,".grok","bin"),{recursive:true});
 writeFileSync(join(home,".grok","bin","grok.exe"),"runtime fixture"); writeFileSync(join(home,".grok","auth.json.lock"),"");
 const inv=inventory(home,"grok"); expect(inv.preserved).toContain(join(realpathSync(home),".grok","bin"));
 expect(inv.targets.some(t=>t.path===join(realpathSync(home),".grok","bin"))).toBe(false);
});
test("unknown discovery entries and embedded credentials fail before a swap", () => {
  const home = mkdtempSync(join(tmpdir(), "poneglyph-profile-bad-")); mkdirSync(join(home, ".claude"));
  writeFileSync(join(home, ".claude", "unknown-source"), "test");
  expect(() => inventory(home, "claude")).toThrow("Unknown");
});
test("candidate drafts are ordinary editable files with immutable native common settings",()=>{
 const home=mkdtempSync(join(tmpdir(),"poneglyph-draft-")); mkdirSync(join(home,".claude"));
 writeFileSync(join(home,".claude","CLAUDE.md"),"Original");
 writeFileSync(join(home,".claude","settings.json"),JSON.stringify({model:"same"}));
 const current=captureProfile(inventory(home,"claude")), draft=join(home,"draft"); exportDraft(draft,current);
 writeFileSync(join(draft,"entries","claude","CLAUDE.md"),"Candidate");
 expect(Buffer.from(freezeDraft(draft).entries["claude/CLAUDE.md"][""].data!,"base64").toString()).toBe("Candidate");
 writeFileSync(join(draft,"entries","claude","settings.json"),JSON.stringify({model:"changed"}));
 expect(()=>freezeDraft(draft)).toThrow("Common");
});
test("editing a bound source updates the actual discovered skill instead of a detached copy",()=>{
 const home=mkdtempSync(join(tmpdir(),"poneglyph-binding-home-")),source=mkdtempSync(join(tmpdir(),"poneglyph-binding-source-"));
 mkdirSync(join(home,".claude"));mkdirSync(join(source,".claude","skills","dev"),{recursive:true});
 writeFileSync(join(source,".claude","skills","dev","SKILL.md"),"Original");
 symlinkSync(join(source,".claude","skills"),join(home,".claude","skills"),process.platform==="win32"?"junction":"dir");
 const current=captureProfile(inventory(home,"claude"),source),draft=join(home,"draft");exportDraft(draft,current);
 writeFileSync(join(draft,"core",".claude","skills","dev","SKILL.md"),"Candidate");
 const frozen=freezeDraft(draft);
 expect(Buffer.from(frozen.entries["claude/skills"]["dev/SKILL.md"].data!,"base64").toString()).toBe("Candidate");
 writeFileSync(join(draft,"entries","claude","skills","dev","SKILL.md"),"Conflicting edit");
 expect(()=>freezeDraft(draft)).toThrow("source");
});
