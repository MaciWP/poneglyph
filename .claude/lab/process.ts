import { spawn, spawnSync } from 'node:child_process';

export type ProcessResult = { code: number | null; timedOut: boolean; cancelled: boolean; outputLimit: boolean; stdout: string; seconds: number };
export async function execute(command: string[], cwd: string, seconds: number, signal?: AbortSignal, onChild?: (pid?: number) => void, options: { input?: string; env?: NodeJS.ProcessEnv } = {}): Promise<ProcessResult> {
  if (!Number.isFinite(seconds) || seconds <= 0 || !command.length) throw new Error('Invalid process limits');
  if (signal?.aborted) throw new Error('Cancelled');
  const start = performance.now();
  return await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd, shell: false, detached: process.platform !== 'win32', windowsHide: true, env: options.env ?? process.env, stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    try { onChild?.(child.pid); } catch (e) { child.kill('SIGKILL'); reject(e); return; }
    if (options.input !== undefined) { child.stdin!.on('error', () => {}); child.stdin!.end(options.input); }
    child.stdout!.setEncoding('utf8'); child.stderr!.setEncoding('utf8');
    let stdout = '', bytes = 0, timedOut = false, cancelled = false, outputLimit = false;
    const stop = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        const r = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        if (r.error) child.kill('SIGKILL');
      } else { try { process.kill(-child.pid, 'SIGKILL'); } catch (e: any) { if (e.code !== 'ESRCH') child.kill('SIGKILL'); } }
    };
    const abort = () => { cancelled = true; stop(); };
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; stop(); }, seconds * 1000);
    const collect = (chunk: string, out: boolean) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 8 * 1024 * 1024) { outputLimit = true; stop(); return; }
      if (out) stdout += chunk; // stderr drained but never persisted; may contain secrets
    };
    child.stdout!.on('data', c => collect(c, true)); child.stderr!.on('data', c => collect(c, false));
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    child.on('error', e => { cleanup(); try { onChild?.(); } catch {} reject(e); });
    // Also terminate descendants when the parent exits successfully.
    child.on('exit', stop);
    child.on('close', code => { cleanup(); try { onChild?.(); } catch (e) { reject(e); return; } resolve({ code, stdout, seconds: (performance.now() - start) / 1000, timedOut, cancelled, outputLimit }); });
    // Recording the child may abort before the listener is registered.
    if (signal?.aborted) abort();
  });
}
export function activeAgents(): boolean {
  const r = process.platform === 'win32'
    ? spawnSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8' })
    : spawnSync('ps', ['-axo', 'comm='], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('Cannot inspect active agents; refusing a global swap');
  return r.stdout.split('\n').some(line => /(?:^|[/\\"\s])(?:claude|grok|codex)(?:\.exe)?(?:["\s]|$)/i.test(line.trim()));
}
