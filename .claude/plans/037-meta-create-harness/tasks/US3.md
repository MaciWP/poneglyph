---
us: US3
title: T1 skill golden pack + templates + native creators
wave: W2
depends_on: [US1]
tdd_mode: optional
estimate: L
status: closed
absorbs_decision: D24 D26 D29 AC26
approved: 2026-09-10
closed: 2026-09-10
---

# US3 — T1 skill golden pack

## Execution prompt (Phase 3 input)

**Task**: Write the T1 (skill) pack and skill templates that every later type HU copies. Include 3-host matrix, live lookup recipe, evidence labels, lifecycle verbs, native-creator contract (AC26), and D29 listing note.
**Context**: Router exists (`meta-harness/SKILL.md` from US1). Old templates: `meta-create/templates/skill/{reference,research,workflow}.md` and `references/skill/*`. Official: https://agentskills.io/specification (`description` ≤1024, `name` ≤64, SKILL.md <500 lines, refs one level). Codex: https://learn.chatgpt.com/codex/build-skills.md + `[[skills.config]]` disable + listing 2%/8000 + load parser does not cap description. Grok: `~/.grok/docs/user-guide/08-skills.md` (`[skills] disabled`, extra keys ignored). Native creators: Grok `create-skill`, Claude `skill-creator`, Codex `$skill-creator` — they draft; this pack owns lookup/impact/gate/Poneglyph layer.
**Constraints**: Thin pack (7 points). No fetcher script (D22). Templates must instantiate to pass today's `check:config` (AC16). Do not rewrite the ~30-skill catalog (D12). es-ES only in Poneglyph layer (AC13).
**Deliverable**: `references/t01-skill.md`, `references/lookup.md` (shared recipe), `references/evidence.md` (E1–E6 + SkillsBench v4 re-anchor), `references/lifecycle.md` (verbs + impact step), `templates/skill/*.md` fixed vs gate, `references/native-creators.md`.
**Verify**: templates copied to a scratch skill pass `check:config`; SKILL.md router links the pack; pack has three host columns and explicit absences.
**Ask first**: if SkillsBench v4 numbers disagree with spec E1, update evidence labels — do not invent a CI number.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W2 |
| **Depends on** | US1 |
| **Blocks** | US4–US18 |
| **Files touched** | `meta-harness/references/t01-skill.md`, lookup, evidence, lifecycle, templates/skill |
| **TDD-mode** | optional — validation of templates via check-config |
| **Estimate** | L |
| **Cómo arrancar** | Read old skill refs + Agent Skills spec; write t01-skill.md as the 7-point template |
| **Decisión absorbida** | D24 D26 D29 AC26 |

## User story

- **As a**: Lead authoring a skill
- **I want**: one pack that is valid on all three hosts
- **So that**: later types copy a real contract, not a Claude-only leftover

## Acceptance criteria

- **AC1**: Given T1 pack, when opened, then it has the 7-point contract (what/when, lookup per host, vendor declare, min template, evidence, Poneglyph grain, declared absences).
- **AC2**: Given a template instance, when `check:config` runs, then it passes without hand patches (AC16).
- **AC3**: Given native creators, when they draft a skill for this repo, then the pack says they do not replace lookup/impact/`check:config`/Poneglyph (AC26).
- **AC4**: Given D29, when the pack discusses length, then it states 1024 portable + Codex listing truncate; not 500.
- **AC5**: Given Grok/Codex disable, when documenting verbs, then disable is named (`[skills] disabled` / `[[skills.config]] enabled=false`) not faked as delete.

## Files a crear / a modificar

| Path | Contenido / Cambio |
|---|---|
| `.claude/skills/meta-harness/references/t01-skill.md` | Golden pack |
| `.claude/skills/meta-harness/references/lookup.md` | W2 recipe (URL/path + date + CLI) |
| `.claude/skills/meta-harness/references/evidence.md` | Levels A/B/C/D/T1 + SkillsBench v4 |
| `.claude/skills/meta-harness/references/lifecycle.md` | Verbs + impact-before-mutate |
| `.claude/skills/meta-harness/references/native-creators.md` | AC26 |
| `.claude/skills/meta-harness/templates/skill/*.md` | Gate-clean portable templates |
| `.claude/skills/meta-harness/SKILL.md` | Link T1 pack |

## Workflow detallado

1. Re-anchor SkillsBench to v4 in evidence.md (cite arXiv 2602.12670 v4).
2. Write lookup.md with the three official indexes (agentskills llms.txt, Codex build-skills, Grok user-guide).
3. Write t01-skill.md matrix. Fix templates (keywords in metadata, when-NOT, content map, ≥3 evals, es-ES when_to_use for this repo).
4. Native-creators.md. Link from router.

## Verificación post-implementación

- Instantiated template: `check:config` 0.
- Pack cells: Claude / Codex / Grok all filled or «ausente».
