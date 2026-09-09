import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { atomicJSON } from './store';

export function exists(p: string): boolean {
  try { fs.lstatSync(p); return true; } catch (e: any) { if (e.code === 'ENOENT') return false; throw e; }
}
export function digest(p: string): string {
  if (!exists(p)) return 'absent';
  const h = createHash('sha256');
  const visit = (f: string) => {
    const s = fs.lstatSync(f);
    h.update(String(s.mode & 0o777));
    if (s.isSymbolicLink()) h.update('link:' + fs.readlinkSync(f));
    else if (s.isFile()) h.update('file:').update(fs.readFileSync(f));
    else if (s.isDirectory()) {
      h.update('directory:');
      for (const n of fs.readdirSync(f).sort()) { h.update(JSON.stringify(n)); visit(path.join(f, n)); }
    } else throw new Error(`Unsupported file type: ${f}`);
  };
  visit(p); return h.digest('hex');
}
export function realDirectory(p: string) {
  const s = fs.lstatSync(p);
  if (!s.isDirectory() || s.isSymbolicLink()) throw new Error(`Expected a real directory, not a link: ${p}`);
  // Reject linked ancestors as well, excluding OS-level aliases resolved by caller.
  for (let d = path.resolve(p); path.dirname(d) !== d; d = path.dirname(d)) {
    if (fs.lstatSync(d).isSymbolicLink()) throw new Error(`Linked ancestor is unsupported: ${d}`);
  }
}
export type Entry = { target: string; backup: string; original: string; phase: 'pending' | 'moving' | 'isolated' | 'restoring' | 'restored' };
export type Journal = { version: 1; id: string; owner: number; results?: string; child?: number; watched?: { root: string; names: string[] }[]; state: 'active' | 'restored'; entries: Entry[]; quarantines: string[] };
export function alive(pid: number) {
  try { process.kill(pid, 0); return true; } catch (e: any) { return e.code !== 'ESRCH'; }
}

/** One fixed per-user journal is also the exclusive lock. Never auto-steal it. */
export class Transaction {
  constructor(readonly file: string, public journal: Journal, readonly checkpoint: (label: string) => void = () => {}) {}
  private save(label: string) { atomicJSON(this.file, this.journal); this.checkpoint(label); }
  static begin(stateDir: string, targets: string[], checkpoint?: (label: string) => void, watched: string[] = []) {
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 }); realDirectory(stateDir);
    const file = path.join(stateDir, 'active.json');
    if (exists(file)) throw new Error(`Experiment/recovery pending. Run lab restore. Journal: ${file}`);
    const normalized = targets.map(t => path.resolve(t));
    if (new Set(normalized.map(t => process.platform === 'win32' ? t.toLowerCase() : t)).size !== targets.length) throw new Error('Duplicate targets');
    for (const t of normalized) {
      realDirectory(path.dirname(t));
      if (normalized.some(other => other !== t && (process.platform === 'win32' ? t.toLowerCase().startsWith((other + path.sep).toLowerCase()) : t.startsWith(other + path.sep)))) throw new Error('Overlapping targets');
      if (path.resolve(stateDir).toLowerCase() === t.toLowerCase() || path.resolve(stateDir).toLowerCase().startsWith((t + path.sep).toLowerCase())) throw new Error('Journal inside target');
    }
    const id = randomUUID();
    const journal: Journal = { version: 1, id, owner: process.pid, state: 'active', watched: watched.map(root => ({ root, names: fs.readdirSync(root) })), quarantines: [], entries: normalized.map((target, i) => ({
      target, backup: path.join(path.dirname(target), `.poneglyph-lab-${id}-${i}.original`), original: digest(target), phase: 'pending',
    })) };
    // Write-ahead lock is created exclusively before any configuration mutation.
    const fd = fs.openSync(file, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(journal)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (process.platform !== 'win32') { const d = fs.openSync(stateDir, 'r'); try { fs.fsyncSync(d); } finally { fs.closeSync(d); } }
    return new Transaction(file, journal, checkpoint);
  }
  static load(stateDir: string) {
    const file = path.join(stateDir, 'active.json');
    const j = JSON.parse(fs.readFileSync(file, 'utf8')) as Journal;
    if (j.version !== 1 || !Array.isArray(j.entries) || !Number.isSafeInteger(j.owner) || j.owner < 1 || !['active', 'restored'].includes(j.state) || !Array.isArray(j.quarantines) || !/^[a-f0-9-]{36}$/.test(j.id)) throw new Error('Invalid journal; keep backups and inspect manually');
    j.entries.forEach((e, i) => {
      if (!['pending', 'moving', 'isolated', 'restoring', 'restored'].includes(e.phase) || !/^(absent|[a-f0-9]{64})$/.test(e.original) || !path.isAbsolute(e.target) || e.backup !== path.join(path.dirname(e.target), `.poneglyph-lab-${j.id}-${i}.original`)) throw new Error('Invalid journal path');
      realDirectory(path.dirname(e.target));
    });
    return new Transaction(file, j);
  }
  isolate() {
    for (const e of this.journal.entries) {
      if (e.phase !== 'pending') throw new Error('Transaction already started');
      if (digest(e.target) !== e.original) throw new Error(`Changed since inventory: ${e.target}`);
      e.phase = 'moving'; this.save('before-move');
      if (e.original !== 'absent') { fs.renameSync(e.target, e.backup); this.syncParent(e.target); }
      this.checkpoint('after-move');
      e.phase = 'isolated'; this.save('isolated');
    }
  }
  recordResults(file: string) { this.journal.results = file; this.save('results-path'); }
  recordChild(pid?: number) { if (pid === undefined) delete this.journal.child; else this.journal.child = pid; this.save('child'); }
  captureCreated() {
    for (const w of this.journal.watched ?? []) {
      realDirectory(w.root);
      for (const name of fs.readdirSync(w.root)) {
        if (name.startsWith('.poneglyph-lab-') || w.names.includes(name)) continue;
        const target = path.join(w.root, name);
        if (this.journal.entries.some(e => e.target === target)) continue;
        const i = this.journal.entries.length;
        this.journal.entries.push({ target, backup: path.join(w.root, `.poneglyph-lab-${this.journal.id}-${i}.original`), original: 'absent', phase: 'isolated' });
        this.save('new-entry');
      }
    }
  }
  restore() {
    if (this.journal.child && alive(this.journal.child)) throw new Error('Agent process still alive; stop it before restoring configuration');
    this.captureCreated();
    for (const e of [...this.journal.entries].reverse()) {
      realDirectory(path.dirname(e.target));
      if (e.phase === 'restored') {
        if (digest(e.target) !== e.original) throw new Error(`Restored entry changed: ${e.target}`);
        continue;
      }
      // Pending means mutation intent was never persisted, so leave the entry alone.
      if (e.phase === 'pending') {
        if (digest(e.target) !== e.original) throw new Error(`Unmoved entry changed: ${e.target}`);
      } else if (exists(e.backup)) {
        if (digest(e.backup) !== e.original) throw new Error(`Original backup changed: ${e.backup}`);
        e.phase = 'restoring'; this.save('before-restore');
        this.quarantine(e.target);
        fs.renameSync(e.backup, e.target); this.syncParent(e.target); this.checkpoint('after-restore');
      } else if (e.original === 'absent') {
        e.phase = 'restoring'; this.save('before-restore'); this.quarantine(e.target);
      } else if (digest(e.target) !== e.original) {
        throw new Error(`Missing original backup; refusing overwrite: ${e.target}`);
      }
      if (digest(e.target) !== e.original) throw new Error(`Restore verification failed: ${e.target}`);
      e.phase = 'restored'; this.save('restored-entry');
    }
    this.journal.state = 'restored'; this.save('restored');
    // Archive first; unlinking only the journal releases the lock. Keep all run state.
    atomicJSON(path.join(path.dirname(this.file), `${this.journal.id}.restored.json`), this.journal);
    fs.unlinkSync(this.file);
  }
  private syncParent(target: string) {
    if (process.platform === 'win32') return;
    const d = fs.openSync(path.dirname(target), 'r');
    try { fs.fsyncSync(d); } finally { fs.closeSync(d); }
  }
  quarantine(target: string) {
    if (!exists(target)) return;
    const dest = path.join(path.dirname(target), `.poneglyph-lab-${this.journal.id}-${randomUUID()}.run`);
    this.journal.quarantines.push(dest); this.save('before-quarantine');
    fs.renameSync(target, dest); this.syncParent(target); this.checkpoint('after-quarantine');
  }
}
