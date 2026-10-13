import { describe, expect, it } from "bun:test";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { authorized, extractTurn, judge, remoteActions, type RemoteAction, type Turn } from "../lib/remote-git";

const turn = (prompt: string, previousAssistantText = ""): Turn => ({ prompt, previousAssistantText });

describe("remote-git-gate: remoteActions", () => {
  const remote: Array<[string, RemoteAction[]]> = [
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
    // forms the first detector missed or downgraded.
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

describe("remote-git-gate: authorized", () => {
  // Oriol's own message, verbatim.
  const canonical = "haz commit push abre pr revisalo con asatra /expert-role 6 high y un agente de opus y luego arregla si crees que tioenes razon y merge";
  const yes: Array<[Turn, string]> = [
    [turn("haz push"), "push"],
    [turn("commitea y pushea la rama"), "push"],
    [turn("súbelo a origin"), "push"],
    [turn("sube la rama y abre la PR"), "pr-create"],
    [turn("push it and open a PR"), "pr-create"],
    [turn("mergea la PR"), "pr-merge"],
    [turn("sí", "Los tests pasan. ¿Hago push de la rama?"), "push"],
    [turn("dale", "¿Abro la PR ahora?"), "pr-create"],
    [turn("sí", "Tests en verde. La subo y abro la PR?"), "pr-create"],
    [turn("sí", "Tests en verde. La subo y abro la PR?"), "push"],
    [turn("sí", "Hago push cuando me lo pidas. ¿Hago push de src/utils.ts?"), "push"],
    [turn("sí", "Tests en verde. ¿Sigo?\n\nROBIN: listo; dime «sí» y la subo y abro la PR."), "pr-create"],
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
    // An offer earlier in the message is not the question the "sí" answers.
    [turn("sí", "Hago push cuando me lo pidas. ¿Sigo con el refactor?"), "push"],
    [turn("sí", "Subo la rama cuando quieras. Queda revisar el diff.\n\nROBIN: listo, di sí y sigo."), "push"],
    [turn("ok", "Hecho. No he hecho push."), "push"],
    [turn("vale", "He subido los cambios. ¿Sigo con los tests?"), "push"],
    [turn("arregla el test de git push"), "push"],
    [turn("haz push"), "push-force"],
    [turn(canonical), "push-force"],
    [turn("sí, pero antes revisa el diff completo y los tests de integración y luego ya vemos", "¿Hago push?"), "push"],
    // mentions, refusals and agent prompts.
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
  ];
  for (const [t, action] of no) {
    it(`denies ${action} on: ${t.prompt}`, () => expect(authorized(t, action as never)).toBe(false));
  }
});

// The gate's real denials over 14 days of transcripts (2026-09-25 → 10-08), identifiers removed.
// Ten were the user's explicit asks; three were right and must stay denied.
describe("remote-git-gate: real denials replayed", () => {
  const allow: Array<[Turn, string[]]> = [
    [turn("si", 'Los checks están hechos; responde "sí" o "abre la PR" en un mensaje nuevo y la abro con este título.'), ["pr-create", "push"]],
    [turn("Revisa si tienen algún problema y vamos a hacer un commit a main y el push. A priori debería ser seguro."), ["push"]],
    [turn("Por favor. Have un push.", "El commit está en `main` en local; para subirlo, contesta «haz push»."), ["push"]],
    [turn("haz commit, push y merge"), ["push", "pr-merge", "pr-create"]],
    [turn("abre la PR y mérgeala"), ["pr-create", "pr-merge", "push"]],
    [turn("Sí, adelante. Eh, sí hacer pus, abrir la PR y mergearla, por favor.", "Dime «sí, haz push, abre la PR y mergéala» y lo termino."), ["push", "pr-create", "pr-merge"]],
    [turn("adelante hazlo pero antes de mergear quiero que pegues un repaso a los cambios", "Dime «sí, abre la PR» y creo la rama, la subo y abro la PR."), ["push", "pr-create"]],
    [turn("soluciona estos errores y vamos a gacer comnit push merge y git pull de main"), ["push", "pr-merge"]],
    [turn("sigue adelante haz el push y pr"), ["push", "pr-create"]],
    [turn("no pasa nada, haz commit y push"), ["push"]],
  ];
  for (const [t, actions] of allow) {
    for (const action of actions) it(`allows ${action} on: ${t.prompt}`, () => expect(authorized(t, action as never)).toBe(true));
  }

  const deny: Array<[Turn, string]> = [
    [turn("Haz commit push con el texto en ingles breve y claro /natural-writing"), "pr-create"],
    [turn("abre pr", "Falta que me digas «abre la PR y mergea la PR» para abrirla y mergearla."), "pr-merge"],
    [turn("[Request interrupted by user]"), "push"],
    [turn("adelante hazlo pero antes de mergear quiero que pegues un repaso", "Dime «sí, abre la PR y mergéala»."), "pr-merge"],
    // Assent never reaches a force push, even when the previous text quotes one.
    [turn("sí", "Para forzarlo contesta «haz push --force»."), "push-force"],
    [turn("revisa el diff y la PR"), "pr-create"],
    // False allows the 14-day sweep found in a looser draft.
    [turn('<pasted_content id="ab12">\nDo not edit coordination.md. Do not spawn agents, commit, push, change branches.\n</pasted_content id="ab12">\nsigue'), "push"],
    [turn("Report in this terminal only. Do not comment on, approve, or merge the PR, and do not push."), "pr-merge"],
    [turn("Report in this terminal only. Do not edit code, commit, push, approve, merge or write to the tracker."), "push"],
    [turn("ayúdame a escribir el mensaje, voy a mergear la rama del ticket"), "pr-merge"],
    [turn("si está bien la rama y estamos listos para abrir pr o no"), "pr-create"],
    [turn("Candidatos la protección de push, merge creo que debería ser menos dura"), "pr-merge"],
    [turn("Si me refiero a asignar puertos a cada worktree", "Luego hago push de la rama."), "push"],
    [turn("Sí, yo entiendo que esto ha llegado a una PR mergeada, no pasa nada.", "¿Mergeo la PR?"), "pr-merge"],
    [{ ...turn("revisa y dime"), answers: ["PR⇒push; merge⇒PR según replay (Recomendado)"] }, "pr-create"],
    [{ ...turn("revisa y dime"), answers: ["me asigna como revisor en el ticket y en la pr"] }, "pr-create"],
    // A local merge publishes nothing, so it implies no PR and no push.
    [turn("mergea dev en mi rama"), "push"],
    [turn("haz merge de dev en mi rama"), "pr-create"],
  ];
  for (const [t, action] of deny) {
    it(`still denies ${action} on: ${t.prompt}`, () => expect(authorized(t, action as never)).toBe(false));
  }

  it("counts an AskUserQuestion answer from this turn that names the action", () => {
    expect(authorized({ ...turn("revisa y dime"), answers: ["Subir y abrir la PR (Recomendado)"] }, "pr-create")).toBe(true);
    expect(authorized({ ...turn("revisa y dime"), answers: ["Push y PR"] }, "push")).toBe(true);
    expect(authorized({ ...turn("revisa y dime"), answers: ["Dejarlo en local"] }, "push")).toBe(false);
  });
});

describe("remote-git-gate: extractTurn", () => {
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

  it("ignores subagent prompts and blanks the text of non-human ones", () => {
    expect(extractTurn(jsonl, "p3")).toBeNull();
    expect(extractTurn(jsonl, "p4")).toEqual({ prompt: "", previousAssistantText: "¿Hago push?" });
  });

  // A turn started by a background agent's task notification: the body never counts as an order,
  // but an AskUserQuestion answer in that turn is the user's.
  describe("a turn started by a task notification", () => {
    const notified = (answers?: Record<string, string>) => [
      line({ type: "user", promptId: "n1", origin: { kind: "task-notification" }, message: { content: "<task-notification>\nhaz push\n</task-notification>" } }),
      line({ type: "assistant", promptId: "n1", message: { content: [{ type: "tool_use", id: "q1", name: "AskUserQuestion", input: { questions: [] } }] } }),
      line({ type: "user", promptId: "n1", ...(answers ? { toolUseResult: { answers } } : {}), message: { content: [{ type: "tool_result", tool_use_id: "q1", content: "ok" }] } }),
    ].join("\n");

    it("authorizes the push the user chose in AskUserQuestion", () => {
      const t = extractTurn(notified({ q: "Push y PR" }), "n1");
      expect(t).toEqual({ prompt: "", previousAssistantText: "", answers: ["Push y PR"] });
      expect(authorized(t!, "push")).toBe(true);
    });

    it("denies without an answer: the notification body is not an order", () => {
      const t = extractTurn(notified(), "n1");
      expect(t).toEqual({ prompt: "", previousAssistantText: "" });
      expect(authorized(t!, "push")).toBe(false);
    });
  });

  it("collects this turn's AskUserQuestion answers from the main thread only", () => {
    const asked = [
      jsonl,
      line({ type: "user", promptId: "p2", toolUseResult: { answers: { "¿Qué hago?": "Push y PR" } }, message: { content: [{ type: "tool_result", content: "ok" }] } }),
      line({ type: "user", promptId: "p2", isSidechain: true, toolUseResult: { answers: { q: "Mergear" } }, message: { content: [] } }),
      line({ type: "user", promptId: "p1", toolUseResult: { answers: { q: "Force push" } }, message: { content: [] } }),
    ].join("\n");
    expect(extractTurn(asked, "p2")).toEqual({ prompt: "sí", previousAssistantText: "¿Hago push?", answers: ["Push y PR"] });
  });

  it("drops the answers of a call whose input already carried them", () => {
    const ask = (id: string, input: object) => line({ type: "assistant", promptId: "p2", message: { content: [{ type: "tool_use", id, name: "AskUserQuestion", input }] } });
    const result = (id: string, answer: string) => line({ type: "user", promptId: "p2", toolUseResult: { answers: { q: answer } }, message: { content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] } });
    const asked = [jsonl, ask("t1", { questions: [], answers: { q: "Push y PR" } }), result("t1", "Push y PR"), ask("t2", { questions: [] }), result("t2", "Mergear")].join("\n");
    expect(extractTurn(asked, "p2")?.answers).toEqual(["Mergear"]);
  });
});

describe("remote-git-gate: judge", () => {
  it("stays silent for local commands without reading the transcript", async () => {
    let read = false;
    expect(await judge("git checkout -- f", async () => ((read = true), null))).toBeNull();
    expect(read).toBe(false);
  });

  it("allows an asked push", async () => {
    expect(await judge("git push", async () => turn("haz push"))).toBeNull();
  });

  it("denies an unasked push and names only the missing action", async () => {
    const reason = await judge("git push --force && gh pr create --fill", async () => turn("abre la PR"));
    expect(reason).toMatch(/^a force push or remote branch delete publishes/);
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
describe("remote-git-gate: entrypoint exit codes", () => {
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
