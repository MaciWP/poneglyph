import {test,expect} from "bun:test";
import {mkdtempSync,readdirSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execute} from "./process";
const cli=join(import.meta.dir,"cli.ts");
test("real CLI demo and repeat preserve history without model calls",async()=>{
 const parent=mkdtempSync(join(tmpdir(),"poneglyph-cli-")),root=join(parent,"laboratory");
 const demo=await execute([process.execPath,cli,"demo",root],parent,40);
 expect(demo.code).toBe(0);
 const first=readdirSync(join(root,"executions")); expect(first).toHaveLength(1);
 const report=readFileSync(join(root,"executions",first[0],"report.html"),"utf8"); expect(report).toContain("SIMULACIÓN");
 const repeat=await execute([process.execPath,cli,"repeat",root,"--execution",first[0]],parent,40); expect(repeat.code).toBe(0);
 expect(readdirSync(join(root,"executions"))).toHaveLength(2);
 const history=await execute([process.execPath,cli,"history",root],parent,5); expect(history.code).toBe(0); expect(history.stdout).toContain(first[0]);
},90000);
test("CLI help never starts a model",async()=>{
 const r=await execute([process.execPath,cli,"--help"],process.cwd(),5); expect(r.code).toBe(0); expect(r.stdout).toContain("profile-freeze");
});
