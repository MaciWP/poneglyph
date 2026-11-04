---
status: closed (D7: merged as a guard, findings open)
reviewer: fresh-context general-purpose agent, top tier (user request; security gate)
scope: US1–US4 (US5 live probe postponed by the user)
verdict: REJECT (ratified by the user: rework chosen via AskUserQuestion, spec D6)
---

# Review: 045 factory mode

## Verdict

REJECT, ratified: the user chose the rework (spec D6). The grant path is a denylist over command shapes, and
the reviewer found shapes it does not read that push elsewhere, merge, or mint a grant.

## Findings (reviewer), with Lead reproduction

Lead reproduction: `gateVerdict` with a grant and a stub `git` (grant branch checked out, `origin`
→ `https://github.com/o/r.git`).

| # | Severity | Finding | Lead check |
|---|---|---|---|
| 1 | critical | Push judged against the payload `cwd`, not the command's: `cd X &&`, `--git-dir=`, `GIT_DIR=`, `-c remote.*.pushurl`, repeated `-C` | `cd /tmp/other && git push origin feature/ABC-1`, `GIT_DIR=… git push …`, `git -c remote.origin.pushurl=… push …` ALLOW |
| 2 | critical | `gh api -XPUT …/merge` (attached short flag) read as no action | ALLOW; `-X PUT` DENY |
| 3 | critical | Merge through runtime expansion or alias: `$M`, `xargs gh`, `gh alias set`, `git -c alias.x=…`, PowerShell backtick | `M="gh pr merge 1"; $M` ALLOW |
| 4 | high | `echo main \| xargs git push origin` read as a push of the current branch | ALLOW |
| 5 | high | Second `pushurl` ignored (`get-url --push` prints the first); any SSH host accepted | by reviewer, real git |
| 6 | high | Mint check runs on raw text: quote-split names, `eval`, python, shell rc files, and `.claude/settings.local.json` `env` (Write tool, no Bash) | by reviewer |
| 7 | medium | `GH_REPO=evil/x gh pr create --draft`; gh base-repo resolution differs from the gate's | ALLOW |
| 8 | low | `rg PONEGLYPH_FACTORY= .claude` denied (false positive) | not rechecked |
| 9 | low | `REMOTE_HINT` now matches `gh … api`: fail-closed blocks read-only `gh api` in attended sessions | by reading |
| 10 | medium | Tests: `fakeGit` answers `""` to every key; no null-read, multi-pushurl, or `realGit` timing rows; allow fixture bakes any-host SSH | by reading |
| 11 | low | Doctrine claims "any gh api write" denied and push URL checked; 2, 5, 7 contradict it | by reading |

Checks run by the reviewer: `bun test ./.claude/hooks/` 543 pass 0 fail; `bun run typecheck` clean.
Tests green with these holes: the oracle covered the shapes the builder thought of.

Attended path (no grant, no ask in the turn), same commands: everything is denied except
`gh api -XPUT|-X PUT …/merge` and `M="gh pr merge 1"; $M`, which are allowed. Those two holes
predate 045: the attended gate never judged `gh api`, and does not expand variables.

## Root cause

Under a grant the gate allows whatever it does not recognise as forbidden. Unattended, the
safe direction is the opposite: allow only exact canonical shapes and deny every other command
that names `git push`, `gh pr` or `gh api`. The mint check has the same flaw and also cannot see
writes outside Bash (settings `env`).

## Not checked

Settings `env` reaching a child session's hooks; gh's real base-repo order; `realGit` timing on
Windows; the Monitor payload field; AC7; the live probe (US5).

## Round 2 (2026-11-04, same reviewer, against the D6 allowlist)

REJECT. 9 of the 11 findings above closed. New: N1 high, quoted commands run by a shell on
stdin, a wrapper (`env -S`, `watch`, `find -exec`, `stdbuf`, `Start-Process`) or a git setting;
N2 medium, the grant spelled with escapes (`\x5f`, `_`) or a splice; N3 medium, a
`remote.origin.push` mapping sending the allowed push to `main` (reproduced with real git);
N4 low, doctrine overclaims. All four fixed test-first; a follow-up pass closed the
`xargs -I{} sh -c "{}"` and `parallel` shapes, `launchctl setenv`, `.envrc` and `.bash_aliases`.
Attended path: no regression on 282 command strings; 0 mint denials replaying 29,743 real calls.

## Round 3 (2026-11-04, fresh reviewer, adversarial)

REJECT against D6's claim that the gate stops injected one-liners. Open, all also open on the
attended path of `main`:

| # | Severity | Shape still allowed under a grant |
|---|---|---|
| 1 | high | git options that run a command: `git grep -O'…'`, `difftool -x`, `--upload-pack`, `archive --exec`, `clone -u` |
| 2 | high | `GIT_*` command variables whose value does not start with a command word (`GIT_SSH_COMMAND='x;gh …'`, `GIT_EDITOR`, `GIT_PAGER`) |
| 3 | high | a `-c` value with no whitespace (`core.fsmonitor=gh${IFS}pr${IFS}merge`) |
| 4 | high | a shell on stdin behind an unknown wrapper or a leading redirect (`\| stdbuf -oL sh`, `\| >/dev/null sh`) |
| 5 | high | the command `sh -c` runs built at run time (`"$(printf 'g%sh …' '')"`) |
| 6 | high | the grant name built at run time (`n=PONEGLYPH; export ${n}_FACTORY=x`) |
| 7 | high | PowerShell: `SetEnvironmentVariable` with a built name, `Set-Item -Path ('env:'+…)` (`setx` closed) |
| 8 | medium | Write of a built name into a start-up file (`export ${P}_FACTORY=…` into `~/.zshenv`) |

Decision (spec D7): stop patching; the text gate is a guard against honest mistakes, not a
boundary. F3 does not launch without the GitHub boundary. Merged with these findings open.
