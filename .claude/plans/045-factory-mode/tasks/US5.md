---
us: US5
title: "Live probe of a factory session on a throwaway repo"
wave: W3
depends_on: ["US3", "US4"]
tdd_mode: skip
estimate: S
status: approved
approved: 2026-10-26
---

# US5: Live probe 🔴

## Execution prompt (Phase 3 input)

**Task**: Prove the grant end to end in a real Claude Code session.
**Context**: After the sync installs US3, launch `claude` with `PONEGLYPH_FACTORY` set for
`TEST-1`/`feature/TEST-1` inside a clone of a throwaway GitHub repo, with a cheap model.
**Constraints**: Creating the repo and the PR is outward-facing: the user creates or approves the
repo first. The user launches the probe from their own terminal: D5 denies this session (and
any other) the command that sets the variable, by design. `--model` with a cheap model, as the
headless-model gate requires. No `--agent`. Hook trust is shown by `factory-gate.log`, not by registration.
**Deliverable**: an evidence note in `validations.md`: commands, verdicts, log lines, PR URL.
**Verify**: push of `feature/TEST-1` and `gh pr create --draft` pass; `git push origin main`,
`gh pr ready` and `gh pr merge` are denied; one log line each.
**Ask first**: which repo to use, and delete it afterwards or keep it.

## Acceptance criteria

- **AC1**: The draft PR exists and the log shows `allow push` and `allow pr-create`.
- **AC2**: The three forbidden commands are denied with the grant reason, and the PR stays open
  and unmerged.
