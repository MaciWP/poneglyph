---
spec: 037-meta-create-harness
phase: 5
retro_level: full
retro_level_reason: 18 HUs, legitimate spec_drift (E4/H8/AC27), absorbed D20–D29, first critic NEEDS_CHANGES then repair
verdict_phase4: APPROVED_WITH_WARNINGS
spec_drift: legitimate
promotions_proposed: 1
promotions_approved: 1
commandment_violations: 4
living_spec_delta: yes
action_items: 8
created: 2026-09-11
status: approved
---

# Retro — 037-meta-create-harness

## Resumen

El problema (spec): no había un punto de entrada único, vivo y de tres hosts para consultar / crear / modificar / desactivar / borrar configuración nativa. `meta-create` solo enseñaba a crear, y solo a la manera de Claude.

Entregado: skill `meta-harness` (router + T1–T15 packs + lifecycle + lookup + evidence), gate `check-config` para agents de tres hosts, cuatro casos jsonl de disparo, stubs AC28 de `meta-create` y `meta-settings-cookbook`, parked tree poison-pilled (33 Redirects). Fuera de alcance respetado: no rewrite del catálogo, no sync scripts, no fetcher, no `/meta-harness` command.

Cómo fue: **fricción, no pivot**. El primer critic (3 agentes grok-4.6) dio **NEEDS_CHANGES** (6 MAJOR). El repair O1 cerró M1/M2/M4/M5/M6 en disco y dejó AC27 live `run.ts` como living-spec. Repair critic **APPROVED_WITH_WARNINGS** (N5/N6). Phase 4 persistida 2026-09-11. Feature **no** cerrada: este retro espera ratificación.

## Lecciones técnicas

### ✅ Patterns that worked

- **Cookbook 3-line Redirect as poison-pill**: `01-claude-md.md` already had the pattern. Reusing it on 33 parked files beat rewriting them as live packs (rejected) and beat `rm -rf` (destructive, not asked). Copying a parked template now copies a Redirect, not `model: sonnet`.
- **Stub invoke-off is two flags plus a dead description**: `disable-model-invocation: true` + `user-invocable: false` + `description: Stub. Use meta-harness.` + empty keywords. Letter-only stubs still auto-invoke (M2).
- **Pack 7-point contract scaled**: T1 as template-of-templates let T2–T15 stay thin. Absences as a table beat cloning Claude into empty cells (D13).
- **Approved 2.5 oracle as close-us evidence (O1)**: `tests.md:174` already put live `run.ts` out of US4. Closing on jsonl + unit grader was the honest path under G13. Do not spawn headless to satisfy a spec When that the oracle already narrowed.
- **Vendor user-guide beats spec seed**: T1 pack (Grok applies `model`/`effort`) was right; spec E4/H8 was stale. After critic, packs were patched from `~/.grok/docs/user-guide/`, not from the seed table.

### ❌ Patterns that didn't work

- **Stubbing `SKILL.md` and leaving `references/` + `templates/` live**: US1 first pass renamed the entry and left 33 files teaching `activation.keywords`, `model: sonnet`, `/meta-create skill`. Critic M1. A parked tree is still product. Same HU must poison-pill or delete it.
- **Writing host cells from spec seed instead of live lookup**: E4 said Grok does not apply `model`/`effort`. User-guide 08-skills.md says it does. T11 mixed Claude-compat aliases into the native TOML enum (M5). T3 marked Grok per-agent disable ausente while `/config-agents` and `subagents.toggle.<name>` exist (M6).
- **Spec When vs approved oracle**: AC27 When names `bun .claude/evals/run.ts`. Gate 2.5 oracle (T4.1–T4.3) is jsonl + unit. First critic correctly scored the spec When as unmet. Align Then at 2→3, or the critic will MAJOR a skip you already planned.
- **Repair critic without `flow-state verdict`**: `reopen-us` clears `review_verdict` by design. Writing `review.md` is not Phase 4 persisted. Successor found `review_verdict: null` until the helper ran.

## Proceso

| Phase | Effort | Friction observed | Improvement candidate |
|---|---|---|---|
| 1 scope | L | Six fronts + D18 consults. Heavy but the right size (D11). | Keep. Do not park W2–W6. |
| 2 tech-plan | L | 18 HUs, D20–D29 absorbed at gate. DAG was US1→US3 then fan-out. | US1 AC must name parked `references/` + `templates/`, not only SKILL.md. |
| 2.5 oracle | M | T4 already excluded live `run.ts`. Spec AC27 When was not patched. | Living-spec Then now. Next time: patch spec When/Then at 2→3 when oracle narrows. |
| 3 build | XL | 18 HUs inline in one calendar day. Packs shipped; parked tree and stub flags lagged. | Rename HU includes poison-pill + invoke-off, not a follow-up. |
| 4 critic | L then M | First pass independent, 6 MAJOR. Repair pass inline + declared bias. Verdict helper skipped until retro eve. | After repair critic, run `flow-state verdict` in the same turn. |

**Heaviest**: Phase 3 volume was expected. The **costly** miss was US1 treating the stub as the rename.

**Fricción evitable**: M1/M2/M5/M6. M3 was a spec/oracle seam, not a product hole.

**Drillme útil**: Phase 4 critic questions surfaced E4 + AC27 as living-spec instead of more code.

`.claude/learned/inbox.md` is absent (learning-inbox hook cut 030). Discard count: 0.

## Drillme — Phase 5 (retrospective)

1. `[approach]` **Phase too heavy?** Phase 3 (18 packs) was the planned mass. The extra weight was Phase 4 because US1 did not finish the parked tree. Approach (one skill, 15 packs, no catalog rewrite) was right; the rename HU was too narrow.
2. `[approach]` **Avoidable friction?** Yes: poison-pill + invoke-off belonged in US1; T3/T11 cells belonged to user-guide not seed E4. M3 was avoidable by editing AC27 Then at gate 2→3 (`tests.md:174` already knew).
3. `[approach]` **Reusable pattern?** Poison-pill Redirect; invoke-off stub contract; “parked tree is product”. Also: spec seed ≠ vendor law at pack-write time.
4. `[context]` **Global vs local vs memory?** Poison-pill is already a local cookbook pattern — do not mint a skill. The parked-tree miss is cross-repo (any skill retirement) → one lessons row. `flow-state verdict` after reopen is already in `critic` SKILL.md — memory only if we keep skipping it.
5. `[failure]` **Commandment violated silently?** Not silent — critic caught them. ⚠️ on I (parked tree unread as product), II (seed as vendor), IV (AC27 When vs oracle), IX (rotting parked recipes until repair). See forensics.

Zero open questions that change this retro. Ratification of promotions / living-spec is Step 14, not a drillme gap.

## Promociones candidatas

| Candidate | Scope | Type | Why | Concrete proposal |
|---|---|---|---|---|
| **G14 — A stub SKILL.md is not a retirement** | lessons (global) | skill append | Critic M1: 33 parked files still taught old recipes after the stub landed. M2: letter-only stubs still auto-invoke. | Append one row to existing `.claude/skills/lessons/SKILL.md` §Lessons — process (file exists; merge, do not create). See sketch below. |

**Inbox**: none.

**Eval cases from ❌ failures**: not proposed. The documented failures were config/docs (parked tree, stub flags, vendor cells), not prompt routing. Routing already has `skill-meta-harness-create-22` .. `consult-25`. README growth rule forbids synthetic filler.

**Rejected as promotions** (honest zero extra):

- New skill for poison-pill — duplicates cookbook `01-claude-md.md` + the 33 Redirects.
- Code N5 `names.add` in the global agent set — breaks T2.1 (same name Claude+Grok is legal). Leave.
- Live eval case run as a promotion — G13 spawn; needs this-turn permission + Sonnet 5.

### G14 sketch (applied 2026-09-11 — ratified with publication)

Append to `lessons/SKILL.md` process table:

| Lesson | Evidence | Rule to apply |
|---|---|---|
| **G14 — A stub SKILL.md is not a retirement** | 037 critic M1/M2: `meta-create` stub existed while `references/` + `templates/` still taught `activation.keywords` and `model: sonnet`; stubs without `disable-model-invocation` + `user-invocable: false` still auto-invoked | When parking a skill, poison-pill or delete `references/` and `templates/` in the **same** HU as the stub. Grep the parked tree for recipes, not only `SKILL.md`. Stubs that must not fire: `disable-model-invocation: true`, `user-invocable: false`, dead one-line description, empty keywords |

## Living-spec deltas

`spec_drift: legitimate`. All three criteria hold: real edge found in Phase 3/4; no contradiction of the problem statement (single three-host entry); rationale below. **Applied 2026-09-11** (user: adelante). D1–D3 are in `spec.md` (`living_spec: v2`).

### D1 — E4 (`spec.md` seed table)

**Section**: W3 hallazgos E4 (~line 237).

**Current**: Grok `model`/`effort`/`license`/`compatibility` «no se aplican».

**Proposed**:

```text
| E4 | Grok: descubre `.claude`, `.grok`, `.agents`, `.cursor`. Skills como `/nombre`. Commands planos. Hooks propios + compat Claude configurable. Grok **aplica** `when-to-use`, `model`, `effort`, `disable-model-invocation`. `license` y `compatibility` son opcionales del estándar portable. Claves extra desconocidas se ignoran. | T1 + B | Un artefacto en `.claude/skills` puede servir a Grok; no copies frontmatter Claude a ciegas — mira la columna Grok del pack T1. |
```

**Why**: pack T1 + user-guide `08-skills.md` (lookup 2026-09-10). Seed was wrong. v2 — delta from retro 037-meta-create-harness.

### D2 — H8 (`spec.md` deuda table)

**Section**: Estado actual H8 (~line 194).

**Current**: «Grok ignora o no aplica `model`, `effort`, `license`, `compatibility`».

**Proposed**:

```text
| H8 | Pagado 2026-09-10: pack T1 documenta que Grok aplica `model`/`effort`/`when-to-use`/`disable-model-invocation`. Codex ignora claves extra y recorta listing (2%/8000). |
```

**Why**: same vendor fetch. Marks the debt paid instead of leaving a lie in the inventory.

### D3 — AC27 Then (`spec.md` ~line 143)

**Section**: W6 AC27.

**Current When**: `when corre bun .claude/evals/run.ts`.

**Proposed** (Then matches approved US4 oracle; live stays opt-in):

```text
- **AC27 — Evals de disparo**: Given la description nueva, when se inspecciona `.claude/evals/cases.jsonl` y corre `bun test ./.claude/evals/__tests__/cases-meta-harness.test.ts`, then hay ≥1 caso es-ES de create, modify, delete y consult (`skill-meta-harness-create-22` .. `consult-25`) con `grader: skillTriggerParse` y `expected: meta-harness`. Live `bun .claude/evals/run.ts` es opt-in (G13): Sonnet 5; nunca Fable sin `--allow-expensive` y permiso de este turno. Hoy esos cuatro casos existen; el cookbook y `meta-create` ya no son el expected.
```

**Why**: `tests.md:174` already excluded live from the oracle at 2.5. Critic M3 scored the spec When. Product (four jsonl rows + unit 3/3) holds. Align the contract.

Not proposed: rewriting the whole T1–T15 «Cubierto hoy» column (that table is the 2026-09-10 pre-state inventory). Optional later if Oriol wants a post-delivery catalog snapshot.

## Commandments check

| # | Commandment | Cumplido? | Evidencia / Violación |
|---|---|---|---|
| I | Understand before acting | ⚠️ | Pack lookup was real for T1. Parked `meta-create/references` was not treated as product until critic M1. |
| II | Factual truth | ⚠️ | Seed E4 used as vendor law. User-guide contradicted it. M5/M6 same class. |
| III | Radical honesty | ✅ | Repair critic declared author-bias. Live evals not faked as run. O1 recorded. |
| IV | Quality gates | ⚠️ | Gates green (`check:config` 0 errors, budget Δ 0, unit 3/3). AC27 When still named live `run.ts` after 2.5 narrowed the oracle. |
| V | Reuse first | ✅ | Redirect pattern reused. No second validator. No catalog rewrite. |
| VI | Security | ✅ | `native-hook --check` passed. Secrets only as deny examples. |
| VII | Observability | ✅ | `reopen_history` in state.json. Living-spec flagged, not silently patched. |
| VIII | Internal prompting | ✅ | First critic: three grok-4.6 explore agents (user asked). Repair: inline. |
| IX | Maintainability | ⚠️ | Same incident as I: parked recipes rotted until poison-pill. After repair, glob is Redirects. |
| X | Efficiency | ✅ | No live `run.ts` (O1/G13). N5 not coded (would break T2.1). Three agents only with this-turn ask. |

### Commandment violations forensics

**I + IX — parked tree (one incident)**

- When: US1 first close. Stub SKILL.md + doctrine-sweep of live `.ts/.md` callers. `references/` and `templates/` left intact.
- Alternative: poison-pill or delete in that HU (cookbook 01 already showed the Redirect).
- Prevent: G14 if ratified. US rename check: grep parked tree for recipes = 0.

**II — seed as vendor**

- When: T3/T11 cells and E4/H8 prose. First critic vs `~/.grok/docs/user-guide/`.
- Alternative: fetch the type page before writing the cell (lookup.md already says so).
- Prevent: living-spec D1/D2. No new rule — lookup.md is the owner. Pack was already correct for T1; T3/T11 lagged.

**IV — AC27 When**

- When: spec left `run.ts` as When; 2.5 oracle excluded it; critic MAJOR; plan O1 deferred to retro.
- Alternative: patch Then at gate 2→3 when the oracle narrowed.
- Prevent: living-spec D3. Next feature: oracle win is a spec patch candidate, not a close-us footnote.

## Action items

| Action | Owner | Trigger | Due |
|---|---|---|---|
| Ratify or reject living-spec D1–D3 | Oriol | this retro | before `close-feature` |
| Ratify or reject G14 append | Oriol | this retro | before `close-feature` or carry as deferral |
| Stamp lookup last-fetch for T2–T15 (N6) | Lead | next `consult` on those types | next consult, not this pass |
| Do not code N5 `names.add` | Lead | any check-config tweak | standing; T2.1 would break |
| Live `run.ts` on 22–25 | Oriol | explicit O2 this-turn + Sonnet 5 | optional; not a closer |
| AC28 prune stubs | Lead | live grep of old names is zero outside stubs/audits | later cycle; grep not zero |
| Archive working set to `_archive/037-…/` | Oriol then Lead | after `close-feature` | ask first; do not move now |
| Commit / PR | Oriol | explicit this-turn verb | not inferred from retro |

## Feature closure gate

- [x] Every HU has verified closure in `state.json` (`us_pending: []`, 18 completed including repair re-close of US1/US4/US6/US14)
- [x] Approving review: `APPROVED_WITH_WARNINGS`, `review_verdict` persisted
- [ ] Retro decisions ratified (`retro_status` will be `pending` after this file)
- [ ] `retro-status approved` + `close-feature` only after ratification
- [ ] Publication / commit not requested
- [ ] Archive deferred until Oriol authorizes

Working tree at retro time (HEAD `f229e34`): modified stubs/packs/gate/evals + **untracked** `.claude/skills/meta-harness/` and this plan dir. Product is not in git until Oriol asks for a commit.
