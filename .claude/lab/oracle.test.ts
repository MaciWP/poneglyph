import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scenario, materializeScenario } from "./catalog";
import { evaluate } from "./oracle";
const root = () => mkdtempSync(join(tmpdir(), "poneglyph-oracle-"));
for (const id of ["ownership", "creation", "queries"]) test(`${id}: initial failure and reference success`, async () => {
  const s = scenario(id), a = root(), b = root();
  materializeScenario(a, s); materializeScenario(b, s, true);
  const bad = await evaluate(a, s, 7), good = await evaluate(b, s, 7);
  expect(bad.accepted).toBe(false); expect(good.accepted).toBe(true);
  expect(bad.checks.some(c=>!c.passed)).toBe(true);
});
test("invented checks, early exit and protected-file edits cannot pass", async () => {
  const s = scenario("ownership"), a = root(); materializeScenario(a, s);
  writeFileSync(join(a, "src/service.ts"), 'console.log(JSON.stringify(Array.from({length:10},()=>({name:"fake",passed:true,critical:false})))); process.exit(0); export function getNote(){}');
  expect((await evaluate(a, s, 11)).accepted).toBe(false);
  const b = root(); materializeScenario(b, s, true); writeFileSync(join(b,"src/store.ts"), "export class Store {}");
  expect((await evaluate(b, s, 11)).status).toBe("submission-invalid");
});
test("deny-everything and resetting instrumentation are rejected", async () => {
  const s = scenario("ownership"), a = root(); materializeScenario(a,s,true);
  writeFileSync(join(a,"src/service.ts"), s.reference.replace("return db.one('SELECT id, owner_id, title FROM notes WHERE id = ? AND owner_id = ?', [id, userId]) ?? null;", "return null;"));
  expect((await evaluate(a,s,21)).accepted).toBe(false);
  const q = scenario("queries"), b = root(); materializeScenario(b,q,true);
  writeFileSync(join(b,"src/service.ts"), q.reference.replace("return db.all(", "db.queries = 0; return db.all("));
  expect((await evaluate(b,q,21)).accepted).toBe(false);
});
