// Trusted bridge: return observations, never acceptance decisions. Keep the nonce
// and encoder outside the submitted module, and reject unsolicited stdout upstream.
import { pathToFileURL } from "node:url";
const encode = JSON.stringify;
const write = process.stdout.write.bind(process.stdout);
const request = JSON.parse(await Bun.stdin.text());
const { Store } = await import(pathToFileURL(request.store).href);
Object.freeze(Store.prototype);
const db = new Store(request.database, request.seed);
Object.freeze(db);
const service = await import(pathToFileURL(request.service).href);
const results: { value: unknown; error: boolean; queries: number; changes: number }[] = [];
try {
 for (const action of request.actions) {
  const before = db.queries, changes = db.changes;
  try { results.push({ value: await service[action.method](db, ...action.args) ?? null, error: false, queries: db.queries - before, changes: db.changes - changes }); }
  catch { results.push({ value: null, error: true, queries: db.queries - before, changes: db.changes - changes }); }
 }
} finally { db.close(); }
write(encode({ nonce: request.nonce, results }));
