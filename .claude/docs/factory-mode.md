# Factory mode

A factory session takes one ticket to a draft PR without the user in the loop, and opening that
PR is the last thing it does. It never merges, marks the PR ready, asks to merge or offers to: the
merge is the user's, outside the session, and no message in the chat changes that. The launcher
starts the session and puts this limit in its kickoff prompt, since nothing always-loaded points
here; the session never starts or widens a grant. A denied merge or ready ends the matter: it is
not a doubt for `dudas.md`. Gate logic: `hooks/lib/remote-git.ts`,
`hooks/lib/factory-grant.ts`; plan `plans/045-factory-mode/`.

## The grant

The launcher sets `PONEGLYPH_FACTORY` on the `claude` process, never through the chat:

```json
{"ticket": "ABC-1", "branch": "feature/ABC-1", "repo": "owner/name", "expires": "<ISO, at most 24 h ahead>"}
```

The branch must name the ticket and never be a shared branch (`main`, `dev`…). A malformed or
expired grant is no grant: the attended rules apply. Launch without `--agent`: it sets `agent_id`,
and the gate keeps remote git out of any agent. The launcher also sets every push URL of `origin`
to `https://github.com/<repo>`: an SSH host is whatever the session's ssh config says, so the gate
denies a push through one.

## What it covers

The grant is an allowlist: two commands pass, each as the whole command, with no pipe, `&&` or
`$(…)` around it.

| Action | Under the grant |
|---|---|
| Commit on the grant branch | Yes, with the project's hooks; `--no-verify` never |
| `git push -u origin <branch>` | Yes, when every push URL of `origin` is `https://github.com/<repo>` |
| `gh pr create --draft --head <branch> -R <repo> --title "<title>" --body-file <file>` | Yes; also `--base`, `--label`, `--assignee`, `--reviewer`, `--milestone`, `--fill*` |
| Any other push or PR form (bare `git push`, other flags, inside a pipe) | Denied, with the exact command to run instead |
| Push elsewhere, force, delete, a URL or another remote, global git options | Denied |
| A push that a `remote.origin.push` mapping or a `.git/remotes`/`.git/branches` file redirects | Denied |
| Any merge (also through `gh api`), `gh pr ready`, any `gh api` write | Denied, whatever the chat says |
| A `gh` command outside the read-only list (`pr view/list/status/checks/diff`, `gh api` reads, …) | Denied |
| A git subcommand that is not a builtin (an alias) | Denied |
| git or gh run by a command the gate does not read (`find -exec`, `stdbuf`, `Start-Process`) | Denied |
| A shell or eval fed on stdin (`… \| sh`, `… \| iex`, `bash -s`, `bash <<EOF`, `xargs … sh -c`, `parallel`) | Denied |
| Quoted gh or git push text that a wrapper or git setting runs (`env -S`, `watch`, `-c core.pager=`, `git config credential.helper`) | Denied; readers (`rg`, `grep`, `echo`, a commit message) stay free |

Every grant verdict on a remote command in the main session (not a subagent or mint denial) appends one line to
`<project>/.claude/learned/factory-gate.log`: `<ts> allow|deny <kinds> <ticket> [what was outside]`.

Every session, factory or not, is denied a command that sets, exports or unsets
`PONEGLYPH_FACTORY` (in any case, as a name the shell completes, such as `PONEGLYPH_$V` or
`PONEGLYPH${U}FACTORY`, or spelled with the escapes a shell, printf or JSON decodes: `\x5f`,
`\137`, `_`), and a
redirect, `tee`, `sed -i`, Write, Edit or MultiEdit that writes it into a settings or shell
start-up file (`.envrc` and `.bash_aliases` included), and a macOS `launchctl setenv`: a session
must not mint a grant for a child `claude`. Reading those files and
setting the other `PONEGLYPH_` variables stay free.

## What the gate does not stop

The gate reads the text of one call at a time. It stops honest mistakes and the common shapes in
its tests, and it is not a boundary: shell, git and PowerShell can build a one-line command in
more ways than a reader follows (git options that run a command, `GIT_*` variables, `${IFS}`,
names built at run time; open findings in `plans/045-factory-mode/review.md`). Nor does it stop a
session that writes a script or program and runs it, nor anything split across calls (a
file written in one call and copied into `~/.zshenv` in the next, or a `~/.gitconfig` setting
written with the file tools that a later git call runs), nor a hook that does not fire
(#6305). The mint check is best-effort for the same reason, and its file-tool half fails open. The
boundary is on GitHub: a token scoped to the ticket's repo, a required review on the base branch
that admins cannot bypass, and protection on every branch other than the ticket's. The launcher
refuses a repo without that.

## How the session works

- The ticket spec is the approval for scope and plan. Questions that do not block go to
  `dudas.md` in the plan folder, one entry each: the doubt, the assumption taken, the file it
  affects. The session keeps going.
- A blocking doubt, or a denied action the ticket needs, ends the turn: the launcher shows the
  session as needing the user.
- Verification is deterministic first (tests of the touched scope, types, lint) and its literal
  output goes with the PR.

## What never runs in factory mode

High blast radius tickets: migrations, schema changes, auth, deletion. The launcher refuses them.
