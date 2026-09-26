import { describe, expect, it } from "bun:test";
import { authorized, extractTurn, judge, remoteActions, type Turn } from "../remote-git-gate";

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
  ];
  for (const [cmd, actions] of remote) {
    it(`detects: ${cmd}`, () => expect(remoteActions(cmd).sort()).toEqual([...actions].sort()));
  }

  const local = [
    "git status",
    "git checkout -- f",
    "git reset --hard HEAD~1",
    "git commit -m 'push the button'",
    'grep -rn "git push" .claude',
    "cat <<'EOF'\ngit push origin main\nEOF",
    "gh pr view 45",
    "git log --oneline origin/main..HEAD",
  ];
  for (const cmd of local) {
    it(`ignores: ${cmd.split("\n")[0]}`, () => expect(remoteActions(cmd)).toEqual([]));
  }
});

describe("remote-git-gate — authorized", () => {
  const yes: Array<[Turn, string]> = [
    [turn("haz push"), "push"],
    [turn("commitea y pushea la rama"), "push"],
    [turn("súbelo a origin"), "push"],
    [turn("sube la rama y abre la PR"), "pr-create"],
    [turn("push it and open a PR"), "pr-create"],
    [turn("mergea la PR"), "pr-merge"],
    [turn("sí", "Los tests pasan. ¿Hago push de la rama?"), "push"],
    [turn("dale", "¿Abro la PR ahora?"), "pr-create"],
    [turn("commit y push"), "push"],
    [turn("haz push --force"), "push-force"],
    [turn("borra la rama remota"), "push-force"],
  ];
  for (const [t, action] of yes) {
    it(`allows ${action} on: ${t.prompt}`, () => expect(authorized(t, action as never)).toBe(true));
  }

  const no: Array<[Turn, string]> = [
    [turn("refactoriza el helper"), "push"],
    [turn("commitea los cambios"), "push"],
    [turn("guarda los cambios y versiona"), "push"],
    [turn("sube el timeout a 30"), "push"],
    [turn("no hagas push todavía"), "push"],
    [turn("commit pero sin push"), "push"],
    [turn("¿por qué me pides permiso para git push?"), "push"],
    [turn("haz push"), "pr-create"],
    [turn("sí", "¿Sigo con los tests?"), "push"],
    [turn("ok", "Hecho. No he hecho push."), "push"],
    [turn("vale", "He subido los cambios. ¿Sigo con los tests?"), "push"],
    [turn("arregla el test de git push"), "push"],
    [turn("haz push"), "push-force"],
    [turn("sí, pero antes revisa el diff completo y los tests de integración y luego ya vemos", "¿Hago push?"), "push"],
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
