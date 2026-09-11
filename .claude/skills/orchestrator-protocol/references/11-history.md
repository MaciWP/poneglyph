---
parent: orchestrator-protocol
name: history
description: Where the removed references of this skill went, and the 2026-05-28 simplification (US8 AC7).
---

# History — removed references

Relocated verbatim from `SKILL.md` §Content Map on 2026-09-03 (plan 032/WP4).

## Removed references (simplified 2026-05-28 — US8 AC7 SIMPLIFICAR)

| Former ref | Current canonical source |
|---|---|
| `02-prompt-scoring.md` | `prompt-engineer` skill (covers prompt quality + scoring) |
| `07-delegation-recovery.md` | split (021): always-loaded triggers in `.claude/rules/error-recovery.md`; procedural detail back in `references/07-error-recovery.md` |
| `08-output-style.md` | `output-styles/poneglyph.md` (terse-first rules, escape triggers) |

## 2026-09-03 (plan 032)

- `§0 Verify First` reduced to a pointer: the always-loaded style owns the rule and confidence levels.
- The model-routing tier table moved to CLAUDE.md §Agent spawn (single owner); this skill keeps only the two rules it adds.
- The spawn-tree mermaid diagram moved to `references/10-spawn-decision-tree-diagram.md`; the P1–P8 table stays inline as the executable rule.
- The multi-round questioning paragraph (006) became a pointer to `drillme` (owner of the rounds mechanics).
