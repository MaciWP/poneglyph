---
us: US4
title: "Doctrine for factory sessions within the always-loaded budget"
wave: W3
depends_on: ["US3"]
tdd_mode: skip
estimate: S
status: closed
absorbs_decision: "D3, D4"
approved: 2026-10-26
closed: 2026-10-26
---

# US4: Doctrine

## Execution prompt (Phase 3 input)

**Task**: Write the factory contract once and point the rules that contradict it at it.
**Context**: Git hard rule (`CLAUDE.md:30`), PLAN step (`CLAUDE.md` §How to work, "ask 0-3
blocking questions per round, then wait"), the playbook row "Unattended overnight build/write, no
gates → Reject" (`.claude/skills/agent-routing/references/09-loops-playbook.md:69`), the
`remote-git-gate` row in `.claude/rules/paths/hooks.md`. Load `Skill(harness-config)` first.
**Constraints**: `CLAUDE.md` adds no net bytes (doctor ratchet, 15087 B): one clause in the Git
rule pointing at `.claude/docs/factory-mode.md`, offset by a trim elsewhere. The doc holds: the
grant, what it covers (commit with hooks per D3, push own branch, draft PR), what it never covers
(merge, ready, force), `dudas.md` for non-blocking doubts (spec AC7), high-risk exclusion (D4),
no `--agent` at launch. No dates or model names in doctrine (memory `doctrine-writing`).
**Deliverable**: new `.claude/docs/factory-mode.md`; edits to `CLAUDE.md`, the playbook row,
`hooks.md` row.
**Verify**: `bun run check:config`; `bun run doctor` budget row green; grep that every file names
the doc.
**Ask first**: the exact `CLAUDE.md` wording (always-loaded doctrine).

## Decision during build

The user kept `CLAUDE.md` untouched: its Git rule already requires an explicit ask, and the
factory limit lives in `.claude/docs/factory-mode.md`, which states the draft PR is the last step
and the merge is never attempted, asked for or offered. AC1 is replaced by AC1b.

## Acceptance criteria

- **AC1b**: `CLAUDE.md` unchanged; `factory-mode.md` opens with the draft-PR-is-last limit.

- ~~**AC1**~~ (superseded by AC1b): `CLAUDE.md` size ≤ snapshot; the Git rule names factory sessions and the doc.
- **AC2**: The playbook row no longer rejects what the contract allows: it rejects unattended work
  without the grant and its gates.
- **AC3**: `hooks.md` describes the grant path in the `remote-git-gate` cell.

## Verificación post-implementación

- `bun run check:config`; `bun run doctor`.
