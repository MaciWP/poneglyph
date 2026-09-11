---
us: US1
title: Rename meta-harness + stubs + doctrine-sweep + budget
wave: W1
depends_on: []
tdd_mode: optional
estimate: M
status: closed
absorbs_decision: D21 D27 AC28-30
approved: 2026-09-10
closed: 2026-09-10
---

# US1 — Rename meta-harness + stubs + sweep + budget

## Execution prompt (Phase 3 input)

**Task**: Create `.claude/skills/meta-harness/` as the router skill. Turn `meta-create` and `meta-settings-cookbook` into AC28 stubs. Update every live `.ts`/`.js`/`.md` site (not historical audits/plans). Keep always-loaded net ≤0 or record a D-row (AC30).
**Context**: Current skills at `.claude/skills/meta-create/` and `meta-settings-cookbook/`. Live sites include `skill-advisor/lib/rank.ts` (`USAGE_TIER["meta-create"]`), `.claude/docs/auxiliary-skills-matrix.md`, `.claude/scripts/lib/budget-snapshot.json`, `docs/statusline-setup.md`, `.claude/workflows/ultracode-audit.js`, `.claude/docs/pr3-review.md`, `.claude/rules/paths/orchestration.md`. Impact protocol: `meta-create/references/doctrine-sweep.md` — move it under `meta-harness`. Do not move cookbook body refs (D27).
**Constraints**: Do not implement type packs (US3+). Do not change `sync-claude`/`sync-codex`/`sync-grok`. Repo English; activation copy es-ES. Stubs: `metadata.keywords: ""`, no `when_to_use`, one-line description naming `meta-harness`, prune row with date. Historical audits/plans may keep old names (AC29).
**Deliverable**: `meta-harness/SKILL.md` router; stubs; doctrine-sweep moved; live grep of `meta-create`/`meta-settings-cookbook` only hits stubs + historical; budget snapshot updated.
**Verify**: `bun run check:config`; `bun test ./.claude/scripts/lib/` (budget); `rg` of live names; SKILL.md <500 lines.
**Ask first**: nothing — D21/D27/AC28–30 locked. If always-loaded grows, record D-row before merging; do not silently raise TOLERANCE.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W1 |
| **Depends on** | none |
| **Blocks** | US3 (and transitively US4–US18) |
| **Files touched** | `skills/meta-harness/SKILL.md`, stubs, rank.ts, matrix, budget-snapshot, statusline-setup |
| **TDD-mode** | optional — budget test post-impl |
| **Estimate** | M |
| **Cómo arrancar** | Grep live names; copy doctrine-sweep; write router SKILL.md; stub old skills |
| **Decisión absorbida** | D21 D27 AC28–30 |

## User story

- **As a**: Lead on any of the three hosts
- **I want**: one skill name for any native-config job
- **So that**: create-only `meta-create` and the Claude cookbook stop winning the route

## Acceptance criteria

- **AC1**: Given a prompt to consult/create/modify/disable/delete T1–T15, when routing, then `meta-harness` is the named skill (spec AC1 skeleton — description + when_to_use cover five verbs).
- **AC2**: Given stubs land, when reading them, then they match AC28 (empty keywords, no when_to_use, one-line redirect, dated prune row).
- **AC3**: Given doctrine-sweep on live `.ts`/`.js`/`.md`, when it finishes, then every live site names `meta-harness` (AC29). Historical audits/plans excluded.
- **AC4**: Given budget ratchet, when snapshot updates, then net of `skills: description + when_to_use` is ≤0 vs previous snapshot, or a D-row records the bytes (AC30). TOLERANCE stays 0.
- **AC5**: Given cookbook, when US1 closes, then only the stub exists; refs stay until US12–US18 (D27).

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/skills/meta-harness/SKILL.md` | Router: verbs, catalog T1–T15, load-one-pack, native-creator pointer |
| `.claude/skills/meta-harness/references/doctrine-sweep.md` | Moved from meta-create |
| `.claude/skills/meta-create/SKILL.md` | Stub AC28 |
| `.claude/skills/meta-settings-cookbook/SKILL.md` | Stub AC28 |
| `.claude/skills/skill-advisor/lib/rank.ts` | `USAGE_TIER["meta-harness"]` |
| `.claude/docs/auxiliary-skills-matrix.md` | Rename rows |
| `.claude/scripts/lib/budget-snapshot.json` | New skill sizes |
| `docs/statusline-setup.md` | Point at meta-harness T14 pack (path may be placeholder until US17) |

## Workflow detallado

1. Grep `meta-create` and `meta-settings-cookbook` in `.claude` + `docs` excluding `audits/` and historical `plans/`.
2. Create `meta-harness/SKILL.md` router (short; packs come in later HUs).
3. Move doctrine-sweep. Stub the two old skills.
4. Patch live code/docs. Leave cookbook `references/*.md` in place.
5. Run check-config + budget tests. Record D-row if net >0.

## Casos edge

- Edge: `USAGE_TIER` missing `meta-harness` leaves advisor ranking on the stub — update the map this HU.
- Edge: statusline-setup points at cookbook 07 until US17; this HU must not leave a dead path. Point at `meta-harness` + “T14 pack in US17” or keep cookbook path until US17 moves the file — prefer a sentence that names `meta-harness` without a broken link.

## Smell signals

- ⚠️ Router SKILL.md >200 lines → packs leaking into the router.
- ⚠️ Cookbook refs moved here → violates D27.

## Verificación post-implementación

- Smoke: `rg "meta-create|meta-settings-cookbook" .claude docs --glob '!**/audits/**' --glob '!**/plans/**'` only stubs + this plan.
- `bun run check:config` and budget tests green.
