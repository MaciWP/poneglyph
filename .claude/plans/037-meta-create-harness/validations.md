---
spec: 037-meta-create-harness
tasks: tasks/
created: 2026-09-10
phase: 2.5
status: approved
validation_mode: validation
test_policy: auxiliary
approved: 2026-09-10
---

# Validations per HU (validation-mode)

## Why validation-mode and not TDD?

US1 and US3 plus US5–US18 produce markdown skills, packs, stubs, and templates.
There is no new binary function except US2/US4 (`tests.md`). TDD on packs would
be ceremony. Smoke is Grep/Read/`check:config` on instantiated templates.

Executable HUs: see `tests.md` (US2, US4). Do not duplicate those oracles here.

## Type-pack floor (US5–US18 copy this)

Every type HU (and US3) must satisfy the 7-point contract (spec AC9):

1. What / when (choice vs sibling types)
2. Lookup per host (URL or user-guide path + date-stamp recipe, no fetcher script)
3. Vendor declare (path, schema, reload/restart)
4. Min template or “template N/A”
5. Evidence with A/B/C/D/T1 labels; without A/B the text is not a norm
6. Poneglyph grain (quality, tokens, this-repo vs portable)
7. Declared absences (`ausente`, never a cloned Claude recipe)

Plus: three columns Claude / Codex / Grok; SKILL.md router links the pack;
relative Markdown links resolve; no second validator.

---

## US1 — Rename `meta-harness` + stubs + sweep + budget

### Pre

- Skills `meta-create` and `meta-settings-cookbook` exist as full bodies.
- Live callers include `skill-advisor/lib/rank.ts` `USAGE_TIER["meta-create"]`,
  `docs/auxiliary-skills-matrix.md`, `scripts/lib/budget-snapshot.json`,
  `docs/statusline-setup.md`.
- No `.claude/skills/meta-harness/` yet.

### Post

- `.claude/skills/meta-harness/SKILL.md` is the router (verbs, T1–T15 catalog,
  load-one-pack). Body well under 500 lines (smell: >200).
- Old skills are AC28 stubs. Cookbook `references/` still on disk (D27).
- Doctrine-sweep lives under `meta-harness/references/doctrine-sweep.md`.
- Always-loaded net `skills: description + when_to_use` ≤ 0 vs snapshot, or a
  D-row records the bytes. `TOLERANCE` stays 0.

### Structural assertions

- Stubs: `metadata.keywords: ""`, no `when_to_use`, one-line description that
  names `meta-harness`, dated prune row.
- Router `name: meta-harness` matches directory; description covers consult /
  create / modify / disable / delete.
- `USAGE_TIER["meta-harness"]` is set. Stub keys may remain until prune.

### Smoke

- `bun run check:config` exit 0.
- Budget tests: `bun test ./.claude/scripts/__tests__/budget.test.ts`.
- `rg "meta-create|meta-settings-cookbook"` on `.claude` + `docs` excluding
  `audits/` and historical `plans/` hits stubs + this plan only (AC29).

### Cross-validations

- `docs/statusline-setup.md` names `meta-harness` without a dead T14 path
  (placeholder sentence until US17).
- Historical audits/plans may keep old names.
- No `sync-claude` / `sync-codex` / `sync-grok` edits.

---

## US3 — T1 skill golden pack

### Pre

- US1 closed: router exists; old skill body is a stub.

### Post

- `references/t01-skill.md` is the 7-point golden pack.
- Shared refs: `lookup.md`, `evidence.md`, `lifecycle.md`, `native-creators.md`.
- `templates/skill/*.md` instantiate without hand patches.

### Structural assertions

- Three host columns; disable named (`[skills] disabled` / `[[skills.config]] enabled=false`).
- Length: portable 1024 + Codex listing truncate; **not** 500 (D29).
- Evidence re-anchors SkillsBench to arXiv 2602.12670 **v4** (ask Oriol if
  numbers disagree with spec E1 — do not invent a CI figure).
- Native creators draft only; this pack owns lookup / impact / `check:config` /
  Poneglyph (AC26).
- Templates: keywords in `metadata`, when-NOT, content map, ≥3 evals; this-repo
  `when_to_use` in es-ES.

### Smoke

- Copy a template into a scratch skill path under a disposable `source()` or
  temp repo and run `validate()` / `check:config` → 0 errors.
- Router links `t01-skill.md`. SKILL.md still <500 lines.

### Cross-validations

- No fetcher script (D22). No rewrite of the ~30-skill catalog (D12).
- Impact is a step in `lifecycle.md`, not a sixth verb (D16).

---

## US5 — T2 command

### Pre

- US3 golden pack exists.

### Post

- `references/t02-command.md` with the type-pack floor.
- Optional `templates/command/` only if instantiation is a `commands/*.md`.

### Structural assertions

- Codex invocation is `$name` on shared markdown, not a cloned Claude file.
- No `/meta-harness` command (D7).

### Smoke

- Instantiated command template passes `check:config` if it lives in
  `.claude/commands/*.md`.

### Cross-validations

- Router lists T2. Commands stay an artifact type, not a second entrypoint.

---

## US6 — T3 agent / subagent

### Pre

- US2 gate and US3 pack closed. This repo has **no** `.claude/agents/` today.

### Post

- `references/t03-agent.md` + gate-clean `templates/agent/*`.

### Structural assertions

- Claude `.claude/agents/*.md`; Grok `.grok/agents/*.md`; Codex
  `.codex/agents/*.toml` (not `[agents]` caps in `config.toml`). Personas ≠ agents
  and stay out of the US2 scan.
- Templates pass the US2 name/description scan. No required Claude-only
  `permissionMode` / `model: sonnet` on portable default.
- Host-level disable (Grok `GROK_SUBAGENTS=0` / `[subagents] enabled=false`)
  is not documented as per-file delete.

### Smoke

- Instantiated agent fixture in `source()` → no `metadata.name` /
  `metadata.description` errors (`bun test` US2 suite still green).

### Cross-validations

- Does not clone `.claude/agents` into Codex/Grok cells.

---

## US7 — T4 rule

### Pre

- US3 closed.

### Post

- `references/t04-rule.md` with type-pack floor.

### Structural assertions

- Claude `.claude/rules/`; Codex AGENTS.md / config; Grok `.grok/rules/` + AGENTS.md.
- Explicit: rules stay **out** of `check-config` (D15).
- Choice tree vs T1 skill and T9 memory.

### Smoke

- Grep `check-config.ts` has no new `rules/` scan.

### Cross-validations

- Always-loaded cost pointed at the budget ratchet, not a new CI line count.

---

## US8 — T5 hook

### Pre

- US3 closed. Old `meta-create/references/hook/*` still readable as source.

### Post

- `references/t05-hook.md` (+ templates that do not write project settings hooks).

### Structural assertions

- Claude: global via `sync-claude`; project `settings.json` hook-free.
- Codex: `hooks.json` / `[hooks]`; if this Windows CLI still disables them,
  cell is «present, not effective on Windows» (lookup date + CLI version).
- Grok: `~/.grok/hooks/*.json`.
- AC23/AC25: source vs install vs overlay vs session; delete ≠ disable.
- Hook = enforcement; CLAUDE.md = request (H9).

### Smoke

- Templates do not add `hooks` to `.claude/settings.json`.
- Pack names the install step; does not edit sync scripts (D12).

### Cross-validations

- Effective-from (reload / restart) filled per host.

---

## US9 — T6 MCP (config only)

### Pre

- US3 closed.

### Post

- `references/t06-mcp.md`. No MCP server implementation.

### Structural assertions

- Claude `.mcp.json`; Codex `codex mcp` / config.toml; Grok config.toml / `/mcps`.
- Secrets: env / key files, never committed tokens.

### Smoke

- Pack does not add a server binary or new MCP implementation.

### Cross-validations

- Install step named, not reimplemented (D12).

---

## US10 — T7 plugin

### Pre

- US3 closed.

### Post

- `references/t07-plugin.md`. Marketplace publish remains out of scope.

### Structural assertions

- Disable keys where the host has them (Codex `[plugins."…"] enabled=false`;
  Grok equivalent). Disable ≠ uninstall ≠ delete.

### Smoke

- No marketplace publish recipe presented as in-scope.

### Cross-validations

- Codex plugins are T7, not a fake T8 workflow.

---

## US11 — T8 workflow

### Pre

- US3 closed (`native-creators.md` exists).

### Post

- `references/t08-workflow.md`.

### Structural assertions

- Codex cell = **ausente** as a file type (do not teach plugins here).
- Grok: `.grok/workflows/*.rhai` + `/create-workflow`; disable
  `[workflows] enabled=false`.
- Claude dynamic workflows named without inventing a Grok clone.
- AC26: Grok `create-workflow` drafts; `meta-harness` still owns gate/impact.

### Smoke

- Grep pack for a Codex `.rhai` path → zero.

### Cross-validations

- Workflow is a type, not a `/meta-harness` entrypoint (D7).

---

## US12 — T9 memory (cookbook 01)

### Pre

- US3 closed. Cookbook `references/01-claude-md.md` is the live doc.

### Post

- Live file is `meta-harness/references/t09-memory.md`. Cookbook 01 gone or stub.

### Structural assertions

- CLAUDE.md + AGENTS.md + Grok dual-load. CLAUDE.md <200 is guidance B, not CI.
- Request ≠ hook (H9). D15: no line-count rule in `check-config`.

### Smoke

- Live path is under `meta-harness`. Cookbook stub still AC28 if the skill remains.

### Cross-validations

- Cookbook body not duplicated under both skills (D27).

---

## US13 — T10 settings (cookbook 02)

### Pre

- Cookbook `02-settings-json.md` live.

### Post

- `t10-settings.md` live under `meta-harness`.

### Structural assertions

- Claude `settings.json` (project: `$schema` + `respectGitignore` only).
- Codex `config.toml`; Grok `config.toml` + `pager.toml`.
- Extra keys a host ignores are listed as ignored, not copied.

### Smoke

- Cookbook 02 is not the live path.

### Cross-validations

- No sync-script edits.

---

## US14 — T11 permissions (cookbook 05)

### Pre

- Cookbook `05-permissions.md` live.

### Post

- `t11-permissions.md` live under `meta-harness`.

### Structural assertions

- AC25 chain: source vs overlay vs session.
- Codex sandbox/approvals; Grok permissions/safety guide.
- Widening authority on delete/scope-change is called out (H8).

### Smoke

- Cookbook 05 is not the live path.

### Cross-validations

- Does not weaken existing security gates.

---

## US15 — T12 env (cookbook 04)

### Pre

- Cookbook `04-env-vars.md` live.

### Post

- `t12-env.md` live under `meta-harness`.

### Structural assertions

- Three host env surfaces. Secrets not in git. `.env` still needs `sensitive:`.

### Smoke

- Cookbook 04 is not the live path.

### Cross-validations

- No committed token examples.

---

## US16 — T13 output style (cookbook 03)

### Pre

- Cookbook `03-output-styles.md` live.

### Post

- `t13-output-style.md` live under `meta-harness`.

### Structural assertions

- Codex and Grok cells = **ausente** as Claude output-styles.
- Pointers to theme / personality / T10, not a cloned `.claude/output-styles/`.

### Smoke

- Cookbook 03 is not the live path. Grep pack: no “copy this style dir to Grok”.

### Cross-validations

- Grok theming is not sold as this type (D13).

---

## US17 — T14 statusline (cookbook 07)

### Pre

- Cookbook `07-statusline.md` live. US1 may have left a placeholder in
  `docs/statusline-setup.md`.

### Post

- `t14-statusline.md` live. `docs/statusline-setup.md` points at this pack.

### Structural assertions

- All three hosts have a real key: Claude `statusLine`, Codex `tui.status_line`,
  Grok `[ui.status_line]`.

### Smoke

- Cookbook 07 is not the live path. Setup doc link resolves.

### Cross-validations

- Unlike T13, no `ausente` cell.

---

## US18 — T15 gitignore (cookbook 06)

### Pre

- Cookbook `06-gitignore.md` live.

### Post

- `t15-gitignore.md` live under `meta-harness`.

### Structural assertions

- Three host ignore recipes.
- Grok: hide skills via `[skills] ignore` / `disabled`, **not** `.gitignore`
  (user-guide 08-skills.md).

### Smoke

- Cookbook 06 is not the live path.

### Cross-validations

- Gitignoring `.claude/**` is not documented as “Grok stopped loading the skill”.

---

## Cross-cutting validations

- **X1**: Router `SKILL.md` stays a catalog + load-one-pack. Packs do not leak
  into the router (smell: router >200 lines).
- **X2**: After US12–US18, cookbook live refs are gone; only AC28 stubs remain
  until grep is zero and stubs are deleted (end of cycle, not US1).
- **X3**: `bun run check:config` green on this repo after every code HU (US1,
  US2) and after template HUs that add instantiable files.
- **X4**: No Cursor / Gemini / Copilot, no marketplace publish, no MCP server
  from scratch, no sync-script rewrite (D12).
- **X5**: Consult Astra / Fable remains a Phase 3 research tool on vendor
  drift; it is not an oracle. Grep/Read/docs win (D19).
