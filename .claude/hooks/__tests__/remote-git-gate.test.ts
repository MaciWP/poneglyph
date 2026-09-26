import { describe, expect, it } from "bun:test";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { authorized, extractTurn, judge, remoteActions, type Turn } from "../lib/remote-git";

const turn = (prompt: string, previousAssistantText = ""): Turn => ({ prompt, previousAssistantText });

describe("remote-git-gate — remoteActions", () => {
  const remote: Array<[string, string[]]> = [
    ["git push", ["push"]],
    ["git push origin feat/x", ["push"]],
    ["git -C . push", ["push"]],
    ["git -C ../other push --force-with-lease", ["push-force"]],
    ["git push -f origin main", ["push-force"]],
    ["git push origin +main", ["push-force"]],
    ["git push origin :old-branch", ["push-force"]],
    ["git push --delete origin old", ["push-force"]],
    ["git push -u origin HEAD:refs/heads/x", ["push"]],
    ["git -c core.sshCommand=ssh --no-pager push", ["push"]],
    ["cd sub && git push", ["push"]],
    ["bun test; git push origin main", ["push"]],
    ['bash -c "git push origin main"', ["push"]],
    ["eval 'git push'", ["push"]],
    ['echo "$(git push 2>&1)"', ["push"]],
    ["& git.exe push", ["push"]],
    ["gh pr create --fill", ["pr-create"]],
    ["gh -R MaciWP/poneglyph pr merge 45 --squash", ["pr-merge"]],
    ["git push -u origin b && gh pr create --fill", ["push", "pr-create"]],
    // PR #48 review (rev-opus H1/H2): forms the first detector missed or downgraded.
    [`git commit -m "don't break" && git push origin main && gh pr create --fill --title 'x'`, ["push", "pr-create"]],
    ['git -C "D:/my repo" push', ["push"]],
    ['git "push" origin main', ["push"]],
    ["GIT push origin main", ["push"]],
    ["git -p push origin main", ["push"]],
    ['bash -lc "git push origin main"', ["push"]],
    ["bash <<'EOF'\ngit push origin main\nEOF", ["push"]],
    ['echo "`git push origin main`"', ["push"]],
    ['& "C:/Program Files/Git/cmd/git.exe" push', ["push"]],
    ["\\git push", ["push"]],
    ["git \\\npush origin main", ["push"]],
    ["Invoke-Expression 'git push'", ["push"]],
    ["git subtree push --prefix dist origin gh-pages", ["push"]],
    ['echo "$( (git push) )"', ["push"]],
    ["gh pr new --fill", ["pr-create"]],
    ['git push "--force" origin main', ["push-force"]],
    ['git push origin "+main"', ["push-force"]],
    ["git -c remote.origin.push=+refs/heads/main:refs/heads/main push", ["push-force"]],
  ];
  for (const [cmd, actions] of remote) {
    it(`detects: ${cmd.split("\n")[0]}`, () => expect(remoteActions(cmd).sort()).toEqual([...actions].sort()));
  }

  const local = [
    "git status",
    "git checkout -- f",
    "git reset --hard HEAD~1",
    "git commit -m 'push the button'",
    'git commit -m "fix: gate git push and gh pr create"',
    'grep -rn "git push" .claude',
    "cat <<'EOF'\ngit push origin main\nEOF",
    "git commit -m \"$(cat <<'EOF'\nfeat: gate git push\nEOF\n)\"",
    "gh pr view 45",
    "git log --oneline origin/main..HEAD",
    "echo $((1<<2)); git status",
  ];
  for (const cmd of local) {
    it(`ignores: ${cmd.split("\n")[0]}`, () => expect(remoteActions(cmd)).toEqual([]));
  }

  it("still sees a push after an unclosed shift that looks like a heredoc", () => {
    expect(remoteActions("echo $((1<<x))\ngit push")).toEqual(["push"]);
  });
});

describe("remote-git-gate — authorized", () => {
  // Oriol's own message that opened PR #48's review round, verbatim.
  const canonical = "haz commit push abre pr revisalo con asatra /orca-team 6 high y un agente de opus y luego arregla si crees que tioenes razon y merge";
  const yes: Array<[Turn, string]> = [
    [turn("haz push"), "push"],
    [turn("commitea y pushea la rama"), "push"],
    [turn("súbelo a origin"), "push"],
    [turn("sube la rama y abre la PR"), "pr-create"],
    [turn("push it and open a PR"), "pr-create"],
    [turn("mergea la PR"), "pr-merge"],
    [turn("sí", "Los tests pasan. ¿Hago push de la rama?"), "push"],
    [turn("dale", "¿Abro la PR ahora?"), "pr-create"],
    [turn("sí, adelante", "¿Hago push?"), "push"],
    [turn("commit y push"), "push"],
    [turn("haz push --force"), "push-force"],
    [turn("borra la rama remota"), "push-force"],
    [turn(canonical), "push"],
    [turn(canonical), "pr-create"],
    [turn(canonical), "pr-merge"],
    [turn("haz commit push abre pr y merge"), "pr-merge"],
    [turn("No esperes más, haz push"), "push"],
    [turn("sin miedo, haz push"), "push"],
    [turn("crea la PR y mergéala"), "pr-merge"],
    [turn("haz el merge de la PR"), "pr-merge"],
    [turn("merge it"), "pr-merge"],
  ];
  for (const [t, action] of yes) {
    it(`allows ${action} on: ${t.prompt}`, () => expect(authorized(t, action as never)).toBe(true));
  }

  const no: Array<[Turn, string]> = [
    [turn("refactoriza el helper"), "push"],
    [turn("commitea los cambios"), "push"],
    [turn("guarda los cambios y versiona"), "push"],
    [turn("sube el timeout a 30"), "push"],
    // A bare enclitic order names no target: "súbelo a 30" raises a value. Needs "súbelo a origin".
    [turn("súbelo"), "push"],
    [turn("no hagas push todavía"), "push"],
    [turn("commit pero sin push"), "push"],
    [turn("¿por qué me pides permiso para git push?"), "push"],
    [turn("haz push"), "pr-create"],
    [turn("sí", "¿Sigo con los tests?"), "push"],
    [turn("ok", "Hecho. No he hecho push."), "push"],
    [turn("vale", "He subido los cambios. ¿Sigo con los tests?"), "push"],
    [turn("arregla el test de git push"), "push"],
    [turn("haz push"), "push-force"],
    [turn(canonical), "push-force"],
    [turn("sí, pero antes revisa el diff completo y los tests de integración y luego ya vemos", "¿Hago push?"), "push"],
    // PR #48 review (rev-opus H3/H4/H5): mentions, refusals and agent prompts.
    [turn("sí, pero no hagas push", "Tests en verde. ¿Hago push?"), "push"],
    [turn("sí", "¿Subo el timeout a 30 segundos?"), "push"],
    [turn("sí", "¿Resuelvo el conflicto de merge en utils.ts?"), "pr-merge"],
    [turn("ok, sin push de momento", "¿Hago push?"), "push"],
    [turn("vale", "¿Pruebo en local sin hacer push?"), "push"],
    [turn("sí", "¿Uso --force-with-lease en el rebase local?"), "push-force"],
    [turn("arregla el push al array en utils.ts"), "push"],
    [turn("Explícame gh pr merge."), "pr-merge"],
    [turn("el push a la cola falla con undefined"), "push"],
    [turn("Revisa el bug. Push notifications no llegan en iOS"), "push"],
    [turn("the push to the queue drops messages, fix it"), "push"],
    [turn("explícame qué hace gh pr create --fill"), "pr-create"],
    [turn('Check false denials in his wording ("haz push", "abre la PR"). Never run a real git push.'), "push"],
    [turn("You are working inside Orca, a multi-agent IDE. You are a dispatched worker. Task: haz push y abre la PR."), "push"],
  ];
  for (const [t, action] of no) {
    it(`denies ${action} on: ${t.prompt}`, () => expect(authorized(t, action as never)).toBe(false));
  }
});

describe("remote-git-gate — extractTurn", () => {
  const line = (o: unknown) => JSON.stringify(o);
  const human = { origin: { kind: "human" } };
  const jsonl = [
    line({ type: "user", promptId: "p1", ...human, message: { content: "haz push" } }),
    line({ type: "assistant", message: { content: [{ type: "text", text: "¿Hago push?" }] } }),
    line({ type: "user", promptId: "p2", ...human, message: { content: [{ type: "text", text: "sí" }, { type: "image", source: {} }] } }),
    line({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "git push" } }] } }),
    line({ type: "user", promptId: "p2", message: { content: [{ type: "tool_result", content: "ok" }] } }),
    line({ type: "user", promptId: "p2", isMeta: true, message: { content: "harness note: push" } }),
    line({ type: "user", promptId: "p3", isSidechain: true, message: { content: "haz push" } }),
    line({ type: "user", promptId: "p4", origin: { kind: "agent" }, message: { content: "haz push" } }),
    "{broken",
  ].join("\n");

  it("takes the prompt with this call's promptId, skipping tool results and meta events", () => {
    expect(extractTurn(jsonl, "p2")).toEqual({ prompt: "sí", previousAssistantText: "¿Hago push?" });
  });

  it("never falls back to an earlier prompt when the current one is not written yet", () => {
    expect(extractTurn(jsonl, "p9")).toBeNull();
  });

  it("ignores subagent and non-human prompts", () => {
    expect(extractTurn(jsonl, "p3")).toBeNull();
    expect(extractTurn(jsonl, "p4")).toBeNull();
  });
});

describe("remote-git-gate — judge", () => {
  it("stays silent for local commands without reading the transcript", async () => {
    let read = false;
    expect(await judge("git checkout -- f", async () => ((read = true), null))).toBeNull();
    expect(read).toBe(false);
  });

  it("allows an asked push", async () => {
    expect(await judge("git push", async () => turn("haz push"))).toBeNull();
  });

  it("denies an unasked push and names only the missing action", async () => {
    const reason = await judge("git push && gh pr create --fill", async () => turn("abre la PR"));
    expect(reason).toMatch(/^git push publishes/);
    expect(reason).not.toMatch(/gh pr create/);
  });

  it("fails closed when the transcript cannot be read", async () => {
    expect(await judge("git push", async () => null)).toMatch(/did not ask/);
    expect(
      await judge("git push", async () => {
        throw new Error("EACCES");
      }),
    ).toMatch(/did not ask/);
  });
});

// The real entrypoint, spawned as Claude Code runs it: exit 2 blocks, anything else lets the call run.
describe("remote-git-gate — entrypoint exit codes", () => {
  const entry = resolve(import.meta.dir, "..", "remote-git-gate.ts");
  const dir = mkdtempSync(join(tmpdir(), "remote-git-gate-"));
  const transcript = join(dir, "t.jsonl");
  writeFileSync(transcript, JSON.stringify({ type: "user", promptId: "p1", origin: { kind: "human" }, message: { content: "haz push" } }) + "\n");
  const run = async (stdin: string, script = entry) => {
    const p = Bun.spawn(["bun", script], { stdin: new Blob([stdin]), stdout: "pipe", stderr: "pipe" });
    return p.exited;
  };
  const payload = (command: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ tool_name: "Bash", tool_input: { command }, transcript_path: transcript, prompt_id: "p1", ...extra });

  it("lets an asked push run and blocks an unasked force push", async () => {
    expect(await run(payload("git push origin main"))).toBe(0);
    expect(await run(payload("git push -f origin main"))).toBe(2);
  });

  it("blocks a push inside a subagent even when the prompt asked for it", async () => {
    expect(await run(payload("git push", { agent_id: "a1" }))).toBe(2);
  });

  it("gates the Monitor tool too", async () => {
    expect(await run(JSON.stringify({ tool_name: "Monitor", tool_input: { command: "git push -f" }, transcript_path: transcript, prompt_id: "p1" }))).toBe(2);
  });

  it("blocks when the payload names no prompt", async () => {
    expect(await run(payload("git push", { prompt_id: undefined }))).toBe(2);
  });

  it("fails closed on a malformed payload that looks remote, and stays silent otherwise", async () => {
    expect(await run('{"tool_input": {"command": "git push"')).toBe(2);
    expect(await run('{"tool_input": {"command": "git status"')).toBe(0);
  });

  it("fails closed when its library is missing (a partial sync)", async () => {
    const lone = join(dir, "remote-git-gate.ts");
    copyFileSync(entry, lone);
    expect(await run(payload("git push"), lone)).toBe(2);
    expect(await run(payload("git status"), lone)).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });
});
