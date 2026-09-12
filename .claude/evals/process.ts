/** Own only the child we spawn. Bound waiting, including inherited output pipes. */
export async function runEvalProcess(cmd: string[], cwd?: string, timeoutMs = 120_000): Promise<{ stdout: string; error?: string }> {
  try {
    const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
    let timer: ReturnType<typeof setTimeout>;
    const stdoutReader = proc.stdout.getReader();
    const stderrReader = proc.stderr.getReader();
    const read = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) return Buffer.concat(chunks).toString("utf8");
        chunks.push(value);
      }
    };
    const deadline = new Promise<{ stdout: string; error: string }>(resolve => {
      timer = setTimeout(() => {
        try { proc.kill(); } catch { /* The direct child may already have exited. */ }
        void stdoutReader.cancel().catch(() => {});
        void stderrReader.cancel().catch(() => {});
        resolve({ stdout: "", error: `process timed out after ${timeoutMs}ms` });
      }, timeoutMs);
    });
    try {
      const completion = Promise.all([read(stdoutReader), read(stderrReader), proc.exited])
        .then(([stdout, stderr, code]) => ({ stdout, ...(code !== 0
          ? { error: `process exited ${code}${stderr.trim() ? `: ${stderr.trim().slice(0, 200)}` : ""}` }
          : {}) }));
      return await Promise.race([deadline, completion]);
    } finally { clearTimeout(timer!); }
  } catch {
    return { stdout: "", error: "process could not start or its output could not be read" };
  }
}
