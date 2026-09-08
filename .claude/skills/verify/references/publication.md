# Authorized publication

Read this reference in KNOW when the task includes remote publication. It does not
authorize Git mutations; the applicable session and repository rules own permission.
An approved plan that explicitly includes branch, commit, push, PR, CI wait, and
merge authorizes those steps within its scope. Carry them through without asking
again. A request limited to push or PR creation does not authorize a later merge.

## Remote preflight before PLAN

Inspect the actual repository and target branch. Record the observations for this
task; do not maintain a second list of required checks in a skill or local config.

| Input | Evidence to obtain |
|---|---|
| Local candidate | Working-tree/index state, HEAD, branch, upstream, ahead/behind after fetch, and the exact commits to publish |
| Remote identity | Repository, target branch, authenticated account permissions, allowed merge methods, and existing PRs |
| Merge restrictions | Branch protection and applicable rulesets, including admin enforcement, checks, reviews, freshness, and merge queue requirements |
| CI triggers | Workflow definitions and enabled state on the remote target and candidate; events, branch/path filters, job names, and permissions |
| Candidate state | Exact head SHA, base SHA, conflict/mergeability state, current check runs/statuses, and any required approvals |

For GitHub, use `gh api` and `gh pr view/checks` with the resolved repository and
branch. Useful API resources include `repos/{owner}/{repo}`, branch `protection`,
`rules/branches/{branch}`, `actions/workflows`, commit `check-runs` and `status`.
Read remote workflow content too; local YAML alone does not prove remote triggers.
Distinguish an absent restriction from a permission or network error. Unknown
requirements remain unverified; diagnose them before a dependent publication step.

The GitHub [protected-branch contract](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
allows admin enforcement. Admin permissions do not imply a permitted direct push.
Zero required human approvals does not remove a PR requirement or CI requirements.

## Coordinate local checks

Read the actual doctor and commit-hook commands before scheduling checks. Reuse
successful checks only while their relevant source and configuration remain unchanged.
In Poneglyph, the existing division is:

| Check | Input and scheduling |
|---|---|
| Focused regressions and real flow | Run during implementation; they demonstrate the specific behavior |
| Pre-commit configuration | Validates the complete Git index; unstaged repairs cannot satisfy it |
| Pre-commit suite and plugin validation | Exercise the working tree; keep relevant staged and working source equal before attributing success to the commit |
| Doctor | Checks working source, installation status, budget, and privacy; normally also runs the suite and plugin validation |

When a commit is authorized and imminent, let the normal pre-commit hook run its
suite. Pair it with `bun run doctor --fast` for the remaining doctor checks; record
the suite result from pre-commit, not the doctor's skipped-suite row. Do not also
run a manual full suite or separate plugin validation for the same unchanged state.
The existing doctor and hook can still overlap on plugin validation; do not bypass
either gate to remove that overlap. Without a verified hook run, use the full doctor.

Before commit, review both staged and unstaged diffs. If relevant source differs,
align it within the authorized scope or validate an isolated candidate snapshot.
Do not claim that working-tree tests validated different staged code. If a hook
fails, fix the cause and rerun the affected checks. Keep hooks enabled.

## Execute the approved publication

1. Create or reuse the scoped branch from the verified candidate. Preserve existing
   commits when the plan requires their identities. Commit only reviewed changes.
2. Push the candidate and create or update its PR toward the verified target.
   Keep descriptions factual; separate local evidence from pending remote evidence.
3. Wait for every remotely required check and merge requirement. Confirm each result
   belongs to the current candidate and current PR test merge where applicable.
   A green previous `main`, local doctor, or unrelated manual run is not evidence.
4. If checks fail, remain absent, or merge requirements change, retain the open PR
   and diagnose. Fix failures within scope. Escalate actual scope or permission gaps;
   do not weaken protections, bypass checks, force push, or alter Git internals.
5. Re-read the PR head and mergeability before merging. Use the approved, supported
   method and a head guard where available (`gh pr merge --match-head-commit`).
   Use a merge commit when original commit IDs must survive; do not use admin bypass.
6. Confirm the remote PR is merged and record its merge SHA. Fetch the destination,
   update local destination by fast-forward, and verify the merge is in its ancestry.
   Check original commit ancestry when preservation was required. Observe any
   post-merge CI separately; report failures without claiming an unqualified success.

## Evidence and learned boundary

Report three separate claims: local validations (commands and results), remote
candidate checks (SHA and PR/run links), and actual integration (merge SHA and
destination ancestry). A pushed branch or an open PR is not a completed merge.
Source checks do not establish native hook trust or model activation.

Incident, 2026-09-08: a direct `main` push of the Codex and Archify commits was
rejected because protection required a PR and remote checks, including for admins.
Local validation had passed but the candidate had no Actions runs. Remote preflight
belongs in KNOW, before choosing the publication path, rather than after rejection.
