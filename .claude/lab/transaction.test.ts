import { test, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Transaction, exists, digest } from './transaction';
const temps: string[] = [];
function temp() { const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'poneglyph lab '))); temps.push(d); return d; }
afterEach(() => { for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
function setup() {
  const root = temp(), home = path.join(root, 'home'), state = path.join(root, 'state');
  fs.mkdirSync(home); fs.mkdirSync(state);
  const file = path.join(home, 'settings.json'), absent = path.join(home, 'absent');
  fs.writeFileSync(file, '{"original":true}');
  return { root, home, state, file, absent };
}
test('restores original bytes and absent paths; preserves run changes in quarantine', () => {
  const { state, file, absent } = setup();
  const hash = digest(file), tx = Transaction.begin(state, [file, absent]);
  tx.isolate(); fs.writeFileSync(file, 'candidate'); fs.mkdirSync(absent);
  tx.restore(); expect(digest(file)).toBe(hash); expect(exists(absent)).toBe(false);
  expect(tx.journal.quarantines.length).toBe(2); expect(fs.readFileSync(tx.journal.quarantines[1], 'utf8')).toBe('candidate');
  tx.restore(); expect(digest(file)).toBe(hash);
});
test('exclusive journal refuses another experiment', () => {
  const { state, file } = setup(); const tx = Transaction.begin(state, [file]);
  expect(() => Transaction.begin(state, [file])).toThrow('pending'); tx.restore();
});
for (const failure of ['before-move', 'after-move', 'isolated', 'before-restore', 'before-quarantine', 'after-quarantine', 'after-restore', 'restored-entry', 'restored']) {
  test(`recovers interruption at ${failure}`, () => {
    const { state, file, absent } = setup(); const original = digest(file);
    let crashed = false;
    const tx = Transaction.begin(state, [file, absent], label => { if (label === failure && !crashed) { crashed = true; throw new Error('simulated interruption'); } });
    try { tx.isolate(); fs.writeFileSync(file, 'candidate'); fs.writeFileSync(absent, 'new'); tx.restore(); } catch {}
    expect(crashed).toBe(true);
    Transaction.load(state).restore(); expect(digest(file)).toBe(original); expect(exists(absent)).toBe(false);
  });
}
test('symlink/junction is moved and restored without modifying its target', () => {
  const { state, home } = setup(), source = path.join(home, 'source'), link = path.join(home, 'rules');
  fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'rule.md'), 'original source');
  fs.symlinkSync(process.platform === 'win32' ? source : 'source', link, process.platform === 'win32' ? 'junction' : 'dir');
  const linkValue = fs.readlinkSync(link), hash = digest(source);
  const tx = Transaction.begin(state, [link]); tx.isolate(); fs.mkdirSync(link); fs.writeFileSync(path.join(link, 'rule.md'), 'candidate'); tx.restore();
  expect(fs.readlinkSync(link)).toBe(linkValue); expect(digest(source)).toBe(hash);
});
if (process.platform !== 'win32') test('broken relative link survives recovery', () => {
  const { state, home } = setup(), link = path.join(home, 'broken');
  fs.symlinkSync('does-not-exist', link);
  const tx = Transaction.begin(state, [link]); tx.isolate(); tx.restore();
  expect(fs.readlinkSync(link)).toBe('does-not-exist');
});
test('modified or missing original backup fails closed', () => {
  const { state, file } = setup(), tx = Transaction.begin(state, [file]);
  tx.isolate(); fs.writeFileSync(tx.journal.entries[0].backup, 'unexpected modification'); fs.writeFileSync(file, 'candidate');
  expect(() => tx.restore()).toThrow('backup changed'); expect(fs.readFileSync(file, 'utf8')).toBe('candidate');
});
test('new unknown agent output is quarantined even during recovery', () => {
  const { state, home, file } = setup(), tx = Transaction.begin(state, [file], undefined, [home]);
  tx.isolate(); fs.writeFileSync(path.join(home, 'new-agent-memory'), 'leak');
  Transaction.load(state).restore(); expect(exists(path.join(home, 'new-agent-memory'))).toBe(false); expect(exists(file)).toBe(true);
});
test('refuses overlapping paths and linked parent directories', () => {
  const { state, home } = setup(); const d = path.join(home, 'real'); fs.mkdirSync(d);
  expect(() => Transaction.begin(state, [d, path.join(d, 'child')])).toThrow('Overlapping');
  const link = path.join(home, 'link'); fs.symlinkSync(d, link, process.platform === 'win32' ? 'junction' : 'dir');
  expect(() => Transaction.begin(state, [path.join(link, 'child')])).toThrow('real directory');
});
