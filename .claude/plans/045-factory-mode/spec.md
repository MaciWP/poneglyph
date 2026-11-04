---
id: "045-factory-mode"
created: "2026-10-26"
approved: "2026-10-26"
mode: full
phase: 1
status: approved
---

# Problema

The layer assumes a human in every turn: `remote-git-gate` needs this turn's ask for a push or a
PR, the Git hard rule says the same, and the doctrine asks open questions and waits. A ticket
session that should run unattended up to a draft PR (software factory plan, F2) stops at the
first push, at every plan gate, and at every non-blocking doubt.

# Resultado esperado

- A session launched for one ticket can commit, push its own branch and open a **draft** PR
  without a chat ask, and nothing else remote.
- A merge never runs from a factory session, whatever the chat says.
- Non-blocking doubts go to a file and the session goes on; only a blocking one stops it.
- Attended sessions behave exactly as today.

# Success criteria (medibles, Given/When/Then)

- **AC1**: Given a main-thread session whose process env carries a valid grant for ticket
  `ABC-1`, branch `feature/ABC-1`, when it runs `git push -u origin feature/ABC-1` (or `git push`
  with that branch checked out) and the turn has no ask, then the gate allows it.
- **AC2**: Given the same grant, when the command pushes any other destination (`main`,
  `HEAD:dev`, a second refspec, `--all`, `--tags`, `--mirror`) or forces (`-f`, `+ref`,
  `--force-with-lease`, `--delete`), then the gate denies it.
- **AC3**: Given the same grant, when it runs `gh pr create --draft --head feature/ABC-1`, then it
  is allowed; without `--draft`, with another `--head`, or `gh pr ready`, then denied.
- **AC4**: Given the grant, when any command merges a PR (`gh pr merge`, `gh api … /merge`,
  `gh pr ready` followed by auto-merge, `gh pr merge --auto`), then it is denied even if the
  turn's prompt orders it.
- **AC5**: Given the grant, when the command runs inside a subagent (`agent_id` set), then it is
  denied as today (`SUBAGENT_REASON`).
- **AC6**: Given no grant or a malformed one, when any remote command runs, then the verdict is the
  same as today: the whole `remote-git-gate.test.ts` suite passes unchanged.
- **AC6b** (amendment D5, the one attended change): Given any session, with or without a grant,
  when a shell command sets, exports or unsets `PONEGLYPH_FACTORY` (`VAR=… cmd`, `export`,
  `env VAR=…`, `declare -x`, `unset`, `$env:` in PowerShell), then the gate denies it. A grant whose
  `expires` is more than 24 h after `now` is invalid.
- **AC7**: Given a factory session that hits a non-blocking doubt, when it decides, then it appends
  the doubt, the assumption taken and the file it affects to `dudas.md` in the plan folder and
  keeps working; a blocking doubt ends the turn with the session in `needs_you`.

# Out of scope (explícito)

- The pipeline in Agentic OS (work item, stages, handoff files): F3. F2 only defines the grant
  contract the launcher will set.
- The PR comment loop: F4.
- Codex and Grok factory sessions: Claude first; their gates stay attended.
- Closing the gate's known holes outside merge (git aliases, scripts, `npm publish`).

# Constraints

- The grant must not be forgeable from inside the session it authorizes: the agent can write any
  file and prefix any command, but it cannot change its parent process's environment.
- Fail closed: an unreadable grant, a branch check that fails or a parse error means attended
  rules.
- `bun test ./.claude/` and `bun run doctor` stay green.
- Destructive-operation, sensitive-file and secret rules do not change in factory mode.

# Stakeholders

- **Oriol**: launches tickets, answers doubts at the end, merges by hand. Approves this spec
  before any change to `remote-git-gate` or settings.

# Open questions

- **D1 (P1, decided)**: the merge is denied only when the grant is present (gate logic).
  Attended sessions keep "mergea la PR". Residual risk: a factory hook that does not fire
  (#6305) does not block the merge; GitHub branch protection with a required review is the
  backstop.
- **D2 (P2, recommended default)**: grant channel is the env var `PONEGLYPH_FACTORY` set by the
  launcher on the `claude` process, JSON `{ticket, branch, repo, expires}`. [Suposición: verificar
  con un hook de prueba que la variable del proceso llega al entorno del hook y que
  `PONEGLYPH_FACTORY=… git push` dentro del comando no la cambia.] Rejected: a grant file, because
  the session can write it.
- **D3 (P3, recommended default)**: the grant covers commits on the granted branch, with the
  project's hooks (`SKIP=` only for the full suite, per the work add-on lessons), never `--no-verify`.
- **D5 (amendment, decided 2026-10-26 via AskUserQuestion "Enmendar")**: any session could mint
  its own grant by launching a child `claude` with the variable set. The gate denies every command
  that sets or exports it (AC6b), and `expires` is capped at 24 h. This is the one exception to
  "attended sessions behave exactly as today". D2 and D3 were approved with gate 2→3.
- **D4 (P4, decided)**: High blast radius tickets (migrations, auth, deletion, schema) never run
  in factory mode; the launcher refuses them in F3. Factory mode skips the `flow-lifecycle` hard
  gates for phases 1-2: the ticket spec is the approval, and gate questions become `dudas.md`
  entries.
- **D6 (amendment after the phase 4 REJECT, decided via AskUserQuestion: "Lista blanca
  estricta", "Best-effort y declararlo", and for the attended gate "solo debería dejarlo pasar si
  yo lo confirmo por el chat o lo pido explícitamente")**:
  - D1 becomes an allowlist. Under a grant only two shapes pass, each as the whole command:
    `git push [-u|--set-upstream] origin <grant.branch>` with no global git options, every push
    URL of `origin` (`get-url --push --all`) being `https://github.com/<grant.repo>`; and
    `gh pr create --draft --head <grant.branch> -R <grant.repo>` with flags from a closed list.
    Any other push or PR form is denied with the exact command to run instead; any `gh`
    subcommand outside a read-only list and any git subcommand that is not a builtin (so not an
    alias) is denied. AC1's bare `git push` and AC9 no longer apply.
  - D5 is best-effort, and the threat model is written down: the gate stops honest mistakes and
    injected one-liners, not a session that writes a script or program and runs it. The boundary
    against that is GitHub: required review on the base branch with admin bypass off (F3
    precondition). The mint check reads normalised text, counts an assignment only in a
    statement's prefix, also covers a redirect or `tee` into a settings or shell rc file, and the
    gate also judges Write/Edit/MultiEdit into those files.
  - Attended change, beyond D5: a merge through `gh api` (`…/merge`, a merge mutation) counts as
    `pr-merge`, and a value assigned in the command that a `$VAR` may run, or an alias defined in
    it (`-c alias.`, `git config alias.`, `gh alias set`), is read as the command it holds. Both
    then need the user's ask like any other remote action.
- **D7 (amendment after review rounds 2 and 3, decided via AskUserQuestion on 2026-11-04:
  "Reacotar, haz push, abre la PR y mergea")**: the "injected one-liners" claim in D6 is withdrawn.
  Three rounds each closed every reproduced bypass and found a new family (shells behind
  wrappers, git options and settings that run commands, `GIT_*` variables, `${IFS}`, names built
  at run time), because shell, git and PowerShell semantics give a session unbounded ways to build
  one command line. The text gate is a guard against honest mistakes and the common shapes it
  tests; it is not a boundary. The boundary is GitHub, and F3 must not launch without it: a token
  scoped to the ticket's repo, required review on the base branch with admin bypass off, the
  `https` push URL, and protection on every branch other than the ticket's (check whether a ruleset
  can limit which branches the token updates before relying on it). Round 3's open findings stay
  listed in `review.md`.

# Modelo conceptual / Detalle técnico

## Grant

Set by the launcher (Agentic OS `argvFor` env, F3), never by the chat. Validated with a zod-like
check in `hooks/lib/remote-git.ts`: ticket key, branch name that contains the ticket key and is
not the default branch, `owner/repo`, ISO `expires` not past. Anything else: no grant.

## Gate changes (`hooks/lib/remote-git.ts`)

- New actions: `pr-ready` (`gh pr ready`), `pr-merge` also from `gh api` paths ending in
  `/merge` and `gh pr merge --auto`.
- `factoryAllows(command, grant, cwd)`: push allowed only when every destination is the grant
  branch (explicit refspec, or no refspec and `git -C cwd rev-parse --abbrev-ref HEAD` returns it),
  no force; `pr-create` only with `--draft` and `--head` equal to the grant branch or absent with
  that branch checked out. `pr-merge` and `pr-ready`: never.
- `gateVerdict` order: subagent check first (unchanged), then grant path, then today's
  `judge`. With a grant, attended asks never widen it.
- Log one line per factory verdict to `<project>/.claude/learned/factory-gate.log`
  (allow/deny, action, ticket) for observability.

## Doctrine

- `CLAUDE.md` §Hard rules, Git: one sentence: in a session the launcher marks as factory, the
  ticket is the ask for commit, push to its branch and a draft PR; never merge.
- §How to work PLAN: in factory mode, non-blocking questions go to `dudas.md` with the assumption
  taken; a blocking one stops the session.
- `09-loops-playbook.md:69` ("Unattended overnight build/write" rejected): update to point at
  this contract instead of contradicting it.

## Verification

- Gate tests in `.claude/hooks/__tests__/remote-git-gate.test.ts`: AC1-AC6 as table cases, plus
  the env-forgery probe of P2.
- A real probe session launched with the env var against a throwaway repo: push and draft PR pass,
  merge denied, `factory-gate.log` lines present.
- `bun run doctor`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| The hook does not fire (#6305) and a factory session pushes elsewhere | Branch protection on `main`/`dev` with a required review stays on GitHub (D1) |
| A nested `claude` launched by the agent inherits the grant | Same branch and draft-only limits apply; log shows it |
| Doctrine exception read in attended sessions | The sentence names the launcher mark; without the env var nothing changes |
