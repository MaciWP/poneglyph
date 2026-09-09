import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scenario, materializeScenario } from "./catalog";
import { evaluate } from "./oracle";
const root=()=>mkdtempSync(join(tmpdir(),"poneglyph-advanced-"));
test("interrupted imports must roll back and retry exactly once",async()=>{
 const s=scenario("batch_import"), a=root(), b=root(); materializeScenario(a,s); materializeScenario(b,s,true);
 const bad=await evaluate(a,s,14), good=await evaluate(b,s,14);
 expect(bad.accepted).toBe(false); expect(good.accepted).toBe(true);
 expect(bad.checks.some(c=>c.name==="atomic-import"&&!c.passed)).toBe(true);
});
test("an already-correct implementation permits no product change",async()=>{
 const s=scenario("no_op"), a=root(); materializeScenario(a,s);
 expect((await evaluate(a,s,17)).accepted).toBe(true);
 writeFileSync(join(a,"src/service.ts"),s.reference+"\n// unnecessary edit\n");
 const r=await evaluate(a,s,17); expect(r.accepted).toBe(false);
 expect(r.checks.some(c=>c.name==="no-unnecessary-change"&&!c.passed)).toBe(true);
});
test("a failed import cannot leave a batch record that the next attempt silently removes",async()=>{
 const s=scenario("batch_import"),a=root(); materializeScenario(a,s,true);
 const mutation=`if(faultAfter>=0){db.run('INSERT INTO batches(owner_id,batch_id,payload,note_ids) VALUES (?,?,?,?)',[ownerId,batchId,payload,'[]']);throw new Error('interrupted');}
 db.run('DELETE FROM batches WHERE note_ids = ?', ['[]']);
 const old=db.one`;
 writeFileSync(join(a,"src/service.ts"),s.reference.replace("const old=db.one",mutation));
 const r=await evaluate(a,s,18); expect(r.accepted).toBe(false);
 expect(r.checks.some(c=>c.name==="failed-import-clean"&&!c.passed)).toBe(true);
});

test("an idempotent retry cannot write even if the final data stays equal",async()=>{
 const s=scenario("batch_import"),dir=root(); materializeScenario(dir,s,true);
 writeFileSync(join(dir,"src/service.ts"),s.reference.replace("if (old) {", "if (old) { db.run('UPDATE notes SET title = title WHERE owner_id = ?', [ownerId]);"));
 const r=await evaluate(dir,s,22);
 expect(r.accepted).toBe(false);
 expect(r.checks.some(c=>c.name==="idempotent-import"&&!c.passed)).toBe(true);
});

test("batch title validation cannot write before rejecting an invalid title",async()=>{
 const s=scenario("batch_import"),dir=root(); materializeScenario(dir,s,true);
 const needle="if (typeof batchId !== 'string'";
 writeFileSync(join(dir,"src/service.ts"),s.reference.replace(needle,"if(Array.isArray(titles)&&titles.some(t=>typeof t!=='string'||!t.trim()||t.trim().length>80)) db.run('UPDATE notes SET title = title WHERE owner_id = ?', [ownerId]);\n "+needle));
 const r=await evaluate(dir,s,23);
 expect(r.accepted).toBe(false);
 expect(r.checks.some(c=>c.name==="invalid-import-no-write"&&!c.passed)).toBe(true);
});
