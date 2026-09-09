import {test,expect} from "bun:test";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Transaction,exists} from "./transaction";
import {execute} from "./process";
test("another process recovers a journal after an abrupt exit",async()=>{
 const root=mkdtempSync(join(tmpdir(),"poneglyph-crash-")),state=join(root,"state"),file=join(root,"original.json");
 writeFileSync(file,"original");
 const source=`import {Transaction} from ${JSON.stringify(join(import.meta.dir,"transaction.ts"))}; const tx=Transaction.begin(${JSON.stringify(state)},[${JSON.stringify(file)}],label=>{if(label==='after-move')process.exit(17)});tx.isolate();`;
 const child=await execute([process.execPath,"-e",source],root,5); expect(child.code).toBe(17); expect(exists(file)).toBe(false);
 Transaction.load(state).restore(); expect(readFileSync(file,"utf8")).toBe("original");
});
