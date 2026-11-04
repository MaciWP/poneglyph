---
spec: "045-factory-mode"
tasks: "tasks/index.md"
phase: 2.5
status: approved
validation_mode: validation
test_policy: auxiliary
approved: 2026-10-26
---

# Validations: factory mode

## US4 — Doctrine

### Pre
- `wc -c CLAUDE.md` and the doctor budget row recorded before the edit (snapshot 15087 B).
- `rg -n "Unattended overnight" .claude/skills/agent-routing/references/09-loops-playbook.md` finds line 69.

### Post
- `.claude/docs/factory-mode.md` exists and states: grant fields, covered actions (commit with
  hooks, push own branch, draft PR), never-covered actions (merge, ready, force), `dudas.md`
  format (doubt, assumption taken, affected file), high-risk exclusion, no `--agent` at launch.

### Structural assertions
- ~~`CLAUDE.md` bytes ≤ snapshot; the Git rule names factory sessions and `docs/factory-mode.md`.~~
  Superseded by US4 AC1b (user decision): `CLAUDE.md` stays unchanged.
- `rg -l "factory-mode.md" .claude/rules/paths/hooks.md .claude/skills/agent-routing/references/09-loops-playbook.md`
  lists both (`CLAUDE.md` dropped per AC1b).
- No dates or model names in the new doc (`rg -n "20[0-9]{2}-|claude-|opus|sonnet|haiku" .claude/docs/factory-mode.md` empty).

### Smoke
- `bun run check:config` 0 errors; `bun run doctor` budget row 🟢.

### Cross-validations
- The doc's never-covered list equals the deny rows of T3.2 (same actions, same words).

## US5 — Live probe

### Pre
- US3 installed by the sync; a throwaway GitHub repo chosen by the user; clone on `feature/TEST-1`
  with one commit.

### Post
- Draft PR open on `feature/TEST-1`, unmerged.

### Structural assertions
- `factory-gate.log` lines: `allow push TEST-1`, `allow pr-create TEST-1`, `deny push TEST-1`
  (main), `deny pr-ready TEST-1`, `deny pr-merge TEST-1`.

### Smoke
- `PONEGLYPH_FACTORY='{…TEST-1…}' claude --model haiku` in the clone, one prompt asking it to push,
  open a draft PR, then try `git push origin main`, `gh pr ready` and `gh pr merge`.

### Cross-validations
- `gh pr view --json isDraft,state` → `isDraft: true`, `state: OPEN`.
