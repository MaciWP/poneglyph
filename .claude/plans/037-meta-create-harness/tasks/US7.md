---
us: US7
title: T4 rule pack
wave: W3
depends_on: [US3]
tdd_mode: skip
estimate: S
status: closed
approved: 2026-09-10
closed: 2026-09-10
---

# US7 — T4 rule

## Execution prompt (Phase 3 input)

**Task**: Write the T4 rule pack. Rules stay out of `check-config` (D15). Claude `.claude/rules/`; Codex AGENTS.md / config rules; Grok `.grok/rules/` + AGENTS.md.
**Context**: Old `meta-create/references/rule/*`. Grok `12-project-rules.md`.
**Constraints**: Do not add rules to the CI validator this HU. Distinction: rule vs memory (T9) vs skill (T1) stays in the choice tree.
**Deliverable**: `references/t04-rule.md` + optional templates.
**Verify**: three columns; «not in check-config» explicit.
**Ask first**: nothing.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W3 |
| **Depends on** | US3 |
| **Blocks** | none |
| **Files touched** | `t04-rule.md` |
| **TDD-mode** | skip: documentation pack |
| **Estimate** | S |
| **Cómo arrancar** | Copy t01; document paths + always-loaded cost |
| **Decisión absorbida** | D15 D23 |

## User story

- **As a**: Lead adding a path-scoped rule
- **I want**: to know it is always-loaded request, not a gate
- **So that**: we do not pretend `check-config` enforces rule body quality

## Acceptance criteria

- **AC1**: Given T4 pack, when opened, then 7-point contract + three hosts.
- **AC2**: Given D15, when discussing the gate, then rules are out of `check-config`.

tdd-skip: documentation pack, no testable behavior
