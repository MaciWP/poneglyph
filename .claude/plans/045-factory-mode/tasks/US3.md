---
us: US3
title: "Factory verdict in the gate, with its log"
wave: W2
depends_on: ["US1", "US2"]
tdd_mode: forced
estimate: M
status: closed
absorbs_decision: "D1, D2"
approved: 2026-10-26
closed: 2026-10-26
---

# US3: Factory verdict, wiring and log

## Execution prompt (Phase 3 input)

**Task**: Make `gateVerdict` judge remote commands against the grant when one is present.
**Context**: `gateVerdict` in `.claude/hooks/lib/remote-git.ts` (subagent check, then `judge`).
US1 gives `factoryGrant(env, now)`, US2 gives `factoryReading(command)`. The payload carries
`cwd`. Logs go through `learnedLog(cwd, name)` in `.claude/hooks/lib/paths.ts`.
**Constraints**: Order: subagent denial first (unchanged, spec AC5) → grant path → today's `judge`.
Under a grant, attended asks never widen it and every merge, ready or `api-write` is denied (D1).
Where a push lands is read from git, never guessed: for `"current"`, the checked-out branch must
be the grant branch, `push.default` one of unset/simple/current/upstream/tracking,
`branch.<b>.merge` unset or `refs/heads/<grant.branch>`, the push remote from
`for-each-ref --format=%(push:remotename)` (it follows `branch.X.pushRemote`), and that remote with
no `remote.X.push` or `remote.X.mirror`. (Build finding: `@{push}` fails with "unknown revision"
until the remote-tracking ref exists, so it cannot judge a first push.) A URL written in the
command is denied: `url.*.insteadOf` rewrites it after the gate reads it. The remote's
`git remote get-url --push <remote>` (or the URL argument itself) must end in `grant.repo`
(`owner/name`, optional `.git`), in https form on `github.com` or ssh form on any host: SSH host
aliases such as `git@github-personal:MaciWP/poneglyph.git` are user-configured and count. `gh pr create` needs `-R` equal to `grant.repo`, or no `-R` with the
cwd's push URL naming it. All via argv arrays with a 2 s timeout; any failure denies. Keep the entrypoint's fail-closed contract and its 10 s deadline.
**Deliverable**: `factoryVerdict(reading, grant, branchOf)` (pure, `branchOf` injected), the wiring
in `gateVerdict`, one log line per factory verdict to `factory-gate.log`
(`<ts> <allow|deny> <action> <ticket> <reason>`), a deny reason that names the grant limit.
**Verify**: `bun test ./.claude/hooks/`; `bun run typecheck`; entrypoint tests spawn the hook with
`PONEGLYPH_FACTORY` in the child env.
**Ask first**: nothing, decisions locked.

## User story

- **As a**: Oriol running tickets unattended
- **I want**: the session to push its branch and open a draft PR on its own, and never merge
- **So that**: tickets reach a draft PR without me, and the merge stays mine

## Acceptance criteria

- **AC1** (spec AC1): grant + push to the grant branch (explicit or current) → allowed, no ask.
- **AC2** (spec AC2): grant + any other destination or any force → denied.
- **AC3** (spec AC3): grant + `gh pr create --draft` with grant head or current branch → allowed;
  not draft, other head, or `gh pr ready` → denied.
- **AC4** (spec AC4): grant + any merge kind → denied even when the prompt says "mergea la PR".
- **AC5** (spec AC5): grant + `agent_id` → `SUBAGENT_REASON`.
- **AC6** (spec AC6): no grant or malformed → the existing suite passes byte for byte.
- **AC7**: each factory verdict writes one line to `factory-gate.log`.
- **AC8**: grant + a push or PR aimed at another repo (URL argument, a second remote, `-R other/x`)
  → denied; grant + any `api-write` → denied.
- **AC10** (spec AC6b, D5): in any session, with or without a grant, a command that sets, exports
  or unsets `PONEGLYPH_FACTORY` (`PONEGLYPH_FACTORY=… claude -p`, `export PONEGLYPH_FACTORY=…`,
  `env PONEGLYPH_FACTORY=… claude`, `declare -x`, `unset PONEGLYPH_FACTORY`,
  `$env:PONEGLYPH_FACTORY=…`, also inside `bash -c` or a heredoc fed to a shell) → denied, checked
  before the subagent and grant paths. Reading it (`echo $PONEGLYPH_FACTORY`) stays allowed.
- **AC9**: grant + bare `git push` on `feature/ABC-1` tracking `origin/main` with
  `push.default=upstream` → denied.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/hooks/lib/remote-git.ts` | `factoryVerdict`, wiring in `gateVerdict` |
| `.claude/hooks/__tests__/remote-git-gate.test.ts` | verdict table + entrypoint cases with env |

## Casos edge

- Detached HEAD (`rev-parse` prints `HEAD`) → deny.
- A command mixing an allowed push and a merge → deny the whole call.

## Verificación post-implementación

- `bun test ./.claude/` green; `bun run doctor`.
