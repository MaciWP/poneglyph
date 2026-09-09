import { materializeTree, type Tree } from "./profiles";
export interface Scenario { version: 1; id: string; prompt: string; initial: Tree; reference: string; oracleVersion: 2; unchanged: boolean }
const get = "return db.one('SELECT id, owner_id, title FROM notes WHERE id = ? AND owner_id = ?', [id, userId]) ?? null;";
const create = `if (typeof title !== 'string' || !title.trim() || title.trim().length > 80) throw new Error('Invalid title');
const result = db.run('INSERT INTO notes(owner_id, title) VALUES (?, ?)', [userId, title.trim()]);
return db.one('SELECT id, owner_id, title FROM notes WHERE id = ?', [Number(result.lastInsertRowid)]);`;
const list = "return db.all('SELECT n.id, n.owner_id, n.title, u.name AS owner_name FROM notes n JOIN users u ON u.id = n.owner_id WHERE n.owner_id = ? ORDER BY n.id', [userId]);";
const store = `import { Database } from 'bun:sqlite';
export class Store {
 #db: Database; #queries = 0;
 constructor(file = ':memory:', seed = 0) {
  this.#db = new Database(file);
  this.#db.exec('PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL);');
  this.#db.exec('CREATE TABLE IF NOT EXISTS batches(owner_id INTEGER NOT NULL, batch_id TEXT NOT NULL, payload TEXT NOT NULL, note_ids TEXT NOT NULL, PRIMARY KEY(owner_id,batch_id));');
  if (!(this.#db.query('SELECT COUNT(*) AS n FROM users').get() as any).n) {
   const offset = seed * 10;
   for (const [id, name] of [[offset+1,'Alice'],[offset+2,'Bob'],[offset+3,'Empty']]) this.#db.query('INSERT INTO users VALUES (?, ?)').run(id as number,name as string);
   for (const [id,owner,title] of [[offset+1,offset+1,'Alpha-'+seed],[offset+2,offset+2,'Private-'+seed],[offset+3,offset+1,'Gamma-'+seed]]) this.#db.query('INSERT INTO notes VALUES (?, ?, ?)').run(id as number,owner as number,title as string);
  }
 }
 get queries() { return this.#queries; }
 get changes() { return (this.#db.query('SELECT total_changes() AS n').get() as {n:number}).n; }
 one(sql: string, args: any[] = []): any { this.#queries++; return this.#db.query(sql).get(...args); }
 all(sql: string, args: any[] = []): any[] { this.#queries++; return this.#db.query(sql).all(...args); }
 run(sql: string, args: any[] = []): any { this.#queries++; return this.#db.query(sql).run(...args); }
 transaction(fn: () => unknown): unknown { return this.#db.transaction(fn)(); }
 close() { this.#db.close(); }
}
`;
export const ids = ["ownership", "creation", "queries", "batch_import", "no_op"];
const prompts: Record<string,string> = {
 ownership: "Fix getNote so users cannot read another user's note. Return null for missing or inaccessible notes. Preserve all other API behavior.",
 creation: "Implement createNote. Accept a non-empty title after trimming, with at most 80 JavaScript string code units. Throw an error for invalid titles before any write. Persist the trimmed title and owner and return the created note. Preserve all other behavior.",
 queries: "Optimize listNotes. Return only the user's notes, with owner_name and note id order, using at most one Store SQL call, including for an empty result. Use the provided Store methods. Do not replace or alter the instrumentation. Preserve all other behavior.",
 batch_import: "Fix importNotes so a batch is atomic and idempotent. Validate all titles before any write, using createNote's title contract. The pair (ownerId,batchId) identifies a batch. A repeated successful batch with the same trimmed titles returns the same notes without writing again. Reusing that pair with different titles must throw without changing state. faultAfter is a testable interruption: throw after writing the note at that zero-based index. A failed batch leaves no notes or batch record and can be retried. Preserve all other API behavior.",
 no_op: "Check whether listNotes preserves owner isolation and note order and performs at most one Store SQL call, including an empty result. Optimize it only if it violates that requirement. If it already complies, explain that and leave src/service.ts unchanged. Preserve the remaining API and do not modify instrumentation.",
};
export function source(task: string, reference = false): string {
 return `import type { Store } from './store';
export function getNote(db: Store, userId: number, id: number) { ${task === 'ownership' && !reference ? "return db.one('SELECT id, owner_id, title FROM notes WHERE id = ?', [id]) ?? null;" : get} }
export function createNote(db: Store, userId: number, title: unknown) { ${task === 'creation' && !reference ? "throw new Error('TODO: implement creation');" : create} }
export function listNotes(db: Store, userId: number) { ${task === 'queries' && !reference ? "return db.all('SELECT id, owner_id, title FROM notes WHERE owner_id = ? ORDER BY id', [userId]).map((n: any) => ({ ...n, owner_name: db.one('SELECT name FROM users WHERE id = ?', [n.owner_id]).name }));" : list} }
export function importNotes(db: Store, ownerId: number, batchId: string, titles: unknown[], faultAfter = -1): any[] {
 if (typeof batchId !== 'string' || !batchId || !Array.isArray(titles) || titles.some(t=>typeof t !== 'string' || !t.trim() || t.trim().length>80)) throw new Error('Invalid batch');
 const normalized=(titles as string[]).map(t=>t.trim()), payload=JSON.stringify(normalized);
 const old=db.one('SELECT * FROM batches WHERE owner_id = ? AND batch_id = ?', [ownerId,batchId]);
 if (old) { if(old.payload!==payload) throw new Error('Conflicting batch'); return JSON.parse(old.note_ids).map((id:number)=>getNote(db,ownerId,id)); }
 const apply=()=>{
  const notes=normalized.map((title,index)=>{ const note=createNote(db,ownerId,title); if(index===faultAfter) throw new Error('Injected interruption'); return note; });
  db.run('INSERT INTO batches(owner_id,batch_id,payload,note_ids) VALUES (?,?,?,?)',[ownerId,batchId,payload,JSON.stringify(notes.map(n=>n.id))]);
  return notes;
 };
 return ${task === 'batch_import' && !reference ? "apply()" : "db.transaction(apply) as any[]"};
}
`;
}
export function scenario(id: string): Scenario {
 if (!ids.includes(id)) throw new Error(`Unknown scenario: ${id}`);
 const files: Record<string,string> = {
  "src/service.ts": source(id), "src/store.ts": store,
  "package.json": JSON.stringify({ private: true, type: "module", scripts: { test: "bun test public.test.ts" } }),
  "README.md": "Controlled notes service. Bun includes SQLite; no install or network is required. Run bun test. Only src/service.ts is submitted. Do not edit the Store, public tests, package.json or this README. You may create scratch files and tests; they are not submitted. Preserve the public API and use Store for all SQL operations.\n",
  "public.test.ts": "import {test,expect} from 'bun:test'; import {Store} from './src/store'; import {getNote,listNotes} from './src/service'; test('public happy path',()=>{const db=new Store();try{expect(getNote(db,1,1).title).toBe('Alpha-0');expect(listNotes(db,1).length).toBe(2);}finally{db.close();}});\n",
 };
 return { version: 1, id, prompt: prompts[id], initial: Object.fromEntries(Object.entries(files).map(([p,text])=>[p,{data:Buffer.from(text).toString("base64"),mode:0o600}])), reference: source(id,true), oracleVersion: 2, unchanged: id === "no_op" };
}
export function materializeScenario(dir: string, definition: Scenario, reference = false): void {
 const tree = structuredClone(definition.initial);
 if (reference) tree["src/service.ts"].data = Buffer.from(definition.reference).toString("base64");
 materializeTree(dir, tree);
}
