---
spec: "045-factory-mode"
tasks: "tasks/index.md"
phase: 2.5
status: approved
test_mode: tdd
tdd_policy: forced
approved: 2026-10-26
---

# Tests: factory mode

Policy: `rules/test-policy.md` §Override in plan raises the `auxiliary` default to forced for
behaviour-changing HUs inside `/flow-lifecycle`. Classification:

- US1: TDD (creates `factory-grant.ts`)
- US2: TDD (extends `remote-git.ts`)
- US3: TDD (wires `gateVerdict`, entrypoint)
- US4: validation (`validations.md`)
- US5: validation, live probe (`validations.md`)

Fixtures reused: `turn()` and the entrypoint `run`/`payload` helpers in
`.claude/hooks/__tests__/remote-git-gate.test.ts`. New fixture needed: `grantEnv(over)`: no
existing helper builds a `PONEGLYPH_FACTORY` value.

Pinned-behaviour sweep: the entrypoint `run` helper spawns with the test process env. If
`PONEGLYPH_FACTORY` is ever set where the suite runs (a factory session running the tests), every
existing entrypoint case changes verdict. Update `run` to pass `env` without that variable, and add
the variable only in the new cases.

## US1 — tests

### T1.1 — a valid grant parses
- **Type**: unit
- **Pre-condition**: `grantEnv()` with ticket `ABC-1`, branch `feature/ABC-1`, repo `o/r`, expires
  now + 1 h; `now` fixed.
- **Action**: `factoryGrant(env, now)`
- **Assert**: equals `{ticket: "ABC-1", branch: "feature/ABC-1", repo: "o/r", expires: <same>}`.
- **Must fail before impl (red)**: `Cannot find module '../lib/factory-grant'`.

### T1.2 — every invalid shape is null
- **Type**: unit, table
- **Pre-condition**: rows: var missing; `"{"`; `[]`; branch `main`, `master`, `dev`, `develop`,
  `HEAD`, `feature/OTHER-2`, `feature/ABC-1..x`, `feature/ABC-1:main`, `feature/*`,
  `feature/ABC 1`; repo `o`, `o/r/x`; ticket `abc-1`, `ABC`; expires past, `"tomorrow"`,
  now + 25 h (D5 cap); an extra
  field is ignored, a missing one is null.
- **Action**: `factoryGrant(env, now)` per row
- **Assert**: null for every invalid row.
- **Must fail before impl (red)**: module not found; after a stub that returns the parsed JSON,
  `expected null, received {…branch: "main"…}`.

## US2 — tests

### T2.1 — push destinations
- **Type**: unit, table
- **Action**: `factoryReading(cmd)`
- **Assert**: `git push -u origin feature/ABC-1` → `[{kind:"push", destinations:["feature/ABC-1"], force:false}]`;
  `git push` → `destinations:"current"`; `git push origin HEAD:dev` → `["dev"]`;
  `git push origin a b` → `["a","b"]`; `git push origin feature/ABC-1:feature/ABC-1` →
  `["feature/ABC-1"]`; `git -C ../x push` → `gitDir:"../x"`.
- **Must fail before impl (red)**: `factoryReading is not a function` /
  `Export named 'factoryReading' not found`.

### T2.2 — force and wide pushes
- **Type**: unit, table
- **Assert**: `-f`, `--force`, `--force-with-lease`, `+feature/ABC-1`, `--delete x`, `:x`,
  `--mirror`, `-c remote.origin.push=+refs/heads/*:refs/heads/*` → `force:true`; `--all`,
  `--tags` → a destination `"*"` that no grant matches.
- **Must fail before impl (red)**: `expected true, received false` on `force` for the first row.

### T2.3 — PR kinds
- **Type**: unit, table
- **Assert**: `gh pr create --draft --head feature/ABC-1` → `{kind:"pr-create", draft:true, head:"feature/ABC-1"}`;
  `gh pr create --fill` → `draft:false`; `gh pr ready 12` → `pr-ready`; `gh pr merge 12`,
  `gh pr merge --auto --squash`, `gh api -X PUT repos/o/r/pulls/12/merge`,
  `bash -c "gh pr merge 1"`, `echo $(gh pr merge 1)` → `pr-merge`.
- **Must fail before impl (red)**: `expected [{kind:"pr-ready"}], received []`.

### T2.4 — attended detection unchanged
- **Type**: regression
- **Assert**: the existing `describe("remote-git-gate: remoteActions")` passes unchanged, and
  `remoteActions("gh pr ready 12")` and `remoteActions("gh api -X PUT repos/o/r/pulls/1/merge")`
  stay `[]`.
- **Must fail before impl (red)**: none: it is green before and must stay green (guard).

## US3 — tests

### T3.1 — grant path allows the own branch and the draft PR
- **Type**: unit (`factoryVerdict` with injected `branchOf`)
- **Pre-condition**: grant `ABC-1`/`feature/ABC-1`; `branchOf` returns `feature/ABC-1`.
- **Action**: verdict for `git push -u origin feature/ABC-1`, `git push`,
  `gh pr create --draft --head feature/ABC-1`, `gh pr create --draft`.
- **Assert**: null (allowed) for all four.
- **Must fail before impl (red)**: `Export named 'factoryVerdict' not found`.

### T3.2 — grant path denies the rest
- **Type**: unit, table
- **Assert**: a reason string matching `/factory grant/` for: push to `main`, `HEAD:dev`, two
  refspecs with one foreign, any force row of T2.2, `git push` with `branchOf` → `"main"`,
  `"HEAD"` or a throw; `gh pr create` without `--draft`; `--head feature/OTHER-2`; `gh pr ready`;
  every merge row of T2.3; `git push && gh pr merge 1` (mixed);
  `git push https://github.com/other/x feature/ABC-1`; `git push o2 feature/ABC-1` with `o2`
  resolving to `other/x`; `gh pr create -R other/x --draft`; `gh api graphql -f query='mutation{…}'`;
  `gh api -X PUT repos/o/r/pulls/1/merge`.
- **Must fail before impl (red)**: `expected "…factory grant…", received null` once a permissive stub exists.

### T3.3 — chat asks never widen a grant
- **Type**: integration (`gateVerdict` with a transcript whose prompt is "mergea la PR y haz push --force")
- **Assert**: `gh pr merge 1` and `git push --force` both denied under a grant.
- **Must fail before impl (red)**: `expected deny, received null` (today's `judge` would allow the merge).

### T3.4 — entrypoint with the env var
- **Type**: integration (spawn `remote-git-gate.ts`, `env` with `PONEGLYPH_FACTORY`, `cwd` in a
  temp git repo on `feature/ABC-1`, payload without any ask)
- **Assert**: `git push` exits 0; `git push origin main` exits 2; `gh pr merge 1` exits 2; the same
  payload with `agent_id` exits 2 with `SUBAGENT_REASON`; a malformed `PONEGLYPH_FACTORY` behaves
  as today (unasked push exits 2 with the attended reason).
- **Must fail before impl (red)**: first case `expected 0, received 2`.

### T3.4b — a bare push follows git's push target
- **Type**: integration (temp repo with a local bare remote named `origin` whose push URL is
  rewritten to `git@github.com:o/r.git` via `remote.origin.pushurl`; branch `feature/ABC-1`)
- **Assert**: with upstream `origin/feature/ABC-1`, bare `git push` exits 0; after
  `git branch -u origin/main` and `git config push.default upstream`, bare `git push` exits 2.
- **Must fail before impl (red)**: second case `expected 2, received 0` with a `HEAD`-based reader.

### T3.5 — one log line per factory verdict
- **Type**: integration (temp project dir that gitignores `.claude/learned/`)
- **Assert**: after T3.4's first two calls, `factory-gate.log` has two lines matching
  `/^\S+ (allow|deny) push ABC-1 /`.
- **Must fail before impl (red)**: `ENOENT: factory-gate.log`.

### T3.6 — attended suite unchanged
- **Type**: regression
- **Assert**: every pre-existing test in `remote-git-gate.test.ts` passes with the env var absent.

### T3.7 — nobody mints a grant (D5)
- **Type**: unit (`gateVerdict` without a grant and with one) + entrypoint
- **Assert**: denied with a reason naming the launcher for `PONEGLYPH_FACTORY='{}' claude -p x`,
  `export PONEGLYPH_FACTORY=x`, `env PONEGLYPH_FACTORY=x claude`, `declare -x PONEGLYPH_FACTORY=x`,
  `unset PONEGLYPH_FACTORY`, `$env:PONEGLYPH_FACTORY='x'` (PowerShell tool),
  `bash -c "export PONEGLYPH_FACTORY=x"`; allowed: `echo $PONEGLYPH_FACTORY`, `git commit -m "PONEGLYPH_FACTORY docs"`.
- **Must fail before impl (red)**: `expected deny, received null` for the first row.

## D6 amendment (after the phase 4 REJECT, spec D6)

D6 replaces the denylist with an allowlist, so these rows change; the rest stand.

| Row | Was | Now |
|---|---|---|
| T2.1 | `destinations`, `"current"`, `gitDir` | Items carry `canonical`, `remote` and `refspecs`; a bare push, `-C` or any global option is not canonical |
| T2.4 | `gh api …/merge` stays out of `remoteActions` | It is `pr-merge` in attended sessions too, and so are a merge mutation, a `$VAR` holding `gh pr merge` and a git or gh alias defined in the command (D6, attended change) |
| T3.1 | Bare `git push` and `gh pr create --draft` allowed | Only `git push [-u] origin <branch>` and `gh pr create --draft --head <branch> -R <repo>` as the whole command |
| T3.4 | Bare `git push` exits 0 | `git push -u origin feature/ABC-1` exits 0; bare `git push` exits 2 |
| T3.4b | Bare push follows git's push target | Replaced: every push URL of `origin` (`get-url --push --all`) must be `https://github.com/<repo>`; a second push URL elsewhere exits 2 |

New rows:

- **T6.1**, the reviewer's bypasses: each row of `review.md` that reproduced is denied
  (`describe("remote-git-gate: factoryVerdict")`, "denies the reviewer's bypasses").
- **T6.2**, a push or PR in another shape is denied with the exact command to run instead; a
  merge or ready is denied with no follow-up and no `dudas.md` entry.
- **T6.3**, D5 best-effort: setting `PONEGLYPH_FACTORY` (any case, or a name the shell completes:
  `PONEGLYPH_FACTOR{Y,}`, `PONEGLYPH_FACT'ORY'`), a redirect, `tee` or `sed -i` that writes it into
  a settings or shell start-up file, and Write/Edit/MultiEdit into those files are denied; a
  heredoc of data, a search (`rg PONEGLYPH_FACTORY= .`), a read of a settings or rc file, the other
  `PONEGLYPH_` variables and a note in a plain file are allowed.
- **T6.4**, the entrypoint on file tools: they are a separate settings entry without `onFailure`,
  and with the library missing a Write exits 0 whatever it names (fail open). The tool name comes
  from the parsed payload: a Bash command whose text holds `"tool_name":"Write"` is still judged.
