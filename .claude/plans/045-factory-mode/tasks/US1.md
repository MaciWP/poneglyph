---
us: US1
title: "Parse and validate the factory grant from PONEGLYPH_FACTORY"
wave: W1
depends_on: []
tdd_mode: forced
estimate: S
status: closed
absorbs_decision: "D2"
approved: 2026-10-26
closed: 2026-10-26
---

# US1: Parse and validate the factory grant

## Execution prompt (Phase 3 input)

**Task**: Add a pure `factoryGrant(env)` that returns a validated grant or null.
**Context**: Spec 045 §Grant and D2. The grant is JSON in `process.env.PONEGLYPH_FACTORY`:
`{ticket, branch, repo, expires}`. Hooks inherit Claude Code's env (index §Research). Existing
gate logic: `.claude/hooks/lib/remote-git.ts`; tests: `.claude/hooks/__tests__/remote-git-gate.test.ts`.
**Constraints**: No new dependency (no zod in this repo's hooks: hand-written checks). Pure: the
caller passes `env` and `now`. Any invalid field → null, never a partial grant.
**Deliverable**: `.claude/hooks/lib/factory-grant.ts` exporting `type Grant` and
`factoryGrant(env, now)`; tests in `.claude/hooks/__tests__/factory-grant.test.ts`.
**Verify**: `bun test .claude/hooks/__tests__/factory-grant.test.ts`; `bun run typecheck`.
**Ask first**: nothing, decisions locked.

## User story

- **As a**: the factory launcher
- **I want**: one strict reader for the grant I put on the `claude` process
- **So that**: a malformed or stale grant can never widen what a session may publish

## Acceptance criteria

- **AC1**: Given `{"ticket":"ABC-1","branch":"feature/ABC-1","repo":"o/r","expires":<future>}`,
  then a grant with those four fields.
- **AC2**: Given a missing var, invalid JSON, an extra-wide branch (`main`, `master`, `dev`,
  `develop`, `HEAD`, a branch without the ticket key, one with `..`, `*`, `:` or spaces), a repo
  not shaped `owner/name`, a ticket not shaped `[A-Z][A-Z0-9]+-\d+`, or `expires` past,
  unparseable or more than 24 h after `now` (spec D5), then null.
- **AC3** (spec AC6): Given a grant only as a prefix inside the command text
  (`PONEGLYPH_FACTORY=… git push`), then the reader never sees it: it reads `env` only.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/hooks/lib/factory-grant.ts` | new, ~40 lines |
| `.claude/hooks/__tests__/factory-grant.test.ts` | new, table tests |

## Verificación post-implementación

- `bun test .claude/hooks/__tests__/factory-grant.test.ts` green, then `bun test ./.claude/hooks/`.
