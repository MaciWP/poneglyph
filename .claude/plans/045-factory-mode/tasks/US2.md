---
us: US2
title: "Read what a command publishes, for the factory path"
wave: W1
depends_on: []
tdd_mode: forced
estimate: M
status: closed
absorbs_decision: "D1"
approved: 2026-10-26
closed: 2026-10-26
---

# US2: Factory command reader

## Execution prompt (Phase 3 input)

**Task**: Add `factoryReading(command)` to `remote-git.ts`: for each remote statement, what it
publishes, in enough detail to judge it against a grant.
**Context**: `remote-git.ts` already has a quote-aware `tokenize`, nested-shell recursion
(`remoteActions`) and `statementActions`. Reuse them; extend the per-statement reader instead of
writing a second parser. Shape per item: `{kind: "push", remote?: string, destinations: string[] |
"current", force: boolean, gitDir?: string}` (`remote` is the name or URL argument, absent for a
bare `git push`), `{kind: "pr-create", draft: boolean, head?: string, repo?: string}` (`-R`/`--repo`),
`{kind: "pr-ready"}`, `{kind: "pr-merge"}`, `{kind: "api-write"}` for any `gh api` that is not a
plain GET (`-X`/`--method` other than GET, `-f`/`-F`/`--field`/`--raw-field`/`--input`, or a
`graphql` call), `{kind: "unknown"}` for remote-looking text it cannot parse (fail closed).
**Constraints**: `remoteActions` output must not change (spec AC6): the new kinds (`pr-ready`,
`gh api …/merge`, `gh pr merge --auto`) live only in the factory reader. `--all`, `--tags`,
`--mirror`, `--delete`, `+ref`, `:ref` count as non-grant destinations or force.
**Deliverable**: the function plus table tests in `remote-git-gate.test.ts` (new `describe`).
**Verify**: `bun test .claude/hooks/__tests__/remote-git-gate.test.ts`; `bun run typecheck`.
**Ask first**: nothing, decisions locked.

## User story

- **As a**: the gate under a grant
- **I want**: the exact destinations, draft flag and head of each remote command
- **So that**: I can allow the ticket's own branch and draft PR and nothing else

## Acceptance criteria

- **AC1**: `git push -u origin feature/ABC-1` → push to `["feature/ABC-1"]`, no force;
  `git push` → `"current"`; `git push origin HEAD:dev` → `["dev"]`; `git push origin a b` → both.
- **AC2**: `-f`, `--force-with-lease`, `+feature/ABC-1`, `--delete`, `:x`, `--mirror`, `-c remote.o.push=+…`
  → force true; `--all`/`--tags` → a destination that never matches a grant.
- **AC3**: `gh pr create --draft --head feature/ABC-1` → draft true, head set; `gh pr create`
  → draft false; `gh pr ready 12` → pr-ready.
- **AC4**: `gh pr merge 12`, `gh pr merge --auto`, `gh api -X PUT repos/o/r/pulls/12/merge` →
  pr-merge; the same inside `bash -c "…"` or `$(…)` → pr-merge.
- **AC5**: Existing `remoteActions` tests pass unchanged.
- **AC6**: `git push https://github.com/x/y feature/ABC-1` → `remote` is the URL; `gh pr create -R x/y --draft`
  → `repo: "x/y"`; `gh api graphql -f query='mutation…'`, `gh api -X PATCH …`, `gh api … -f state=closed`
  → `api-write`; `gh api repos/o/r/pulls/1` → nothing.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/hooks/lib/remote-git.ts` | export `factoryReading`, reuse `tokenize` |
| `.claude/hooks/__tests__/remote-git-gate.test.ts` | new `describe("remote-git-gate: factoryReading")` |

## Casos edge

- `git -C ../other push`: record `gitDir` so US3 reads the branch there or denies.
- Refspec `feature/ABC-1:feature/ABC-1` → destination is the right side.

## Smell signals

- ⚠️ A second tokenizer appears: stop, extend `statementActions` instead.

## Verificación post-implementación

- `bun test ./.claude/hooks/` green.
