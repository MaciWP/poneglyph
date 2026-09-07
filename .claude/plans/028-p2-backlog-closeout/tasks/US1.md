---
us: US1
title: Rename security-review → security-audit + barrido completo de dispatchers
wave: W1
depends_on: []
tdd_mode: optional
estimate: M
status: closed
closed: 2026-07-08
---

# US1 — Identidad no colisionante del skill de seguridad

## Execution prompt (Phase 3 input)

**Task**: Renombrar `.claude/skills/security-review/` → `.claude/skills/security-audit/` (dir + frontmatter `name:`) y barrer TODAS las referencias vivas al nombre viejo.
**Context**: Colisión confirmada en vivo: el listado model-facing muestra el built-in nativo `security-review`, no el propio. Refs vivas (discovery): critic/SKILL.md + references/01+02, commands/flow.md, commands/role.md, docs/auxiliary-skills-matrix.md, docs/system-inventory.md, docs/model-uplift-playbook.md §4, orchestrator-protocol (SKILL + 04 + 05 + 09-playbook), meta-create (SKILL + agent/examples + agent/templates-spec + skill/frontmatter-spec), tech-plan/references/05, decision-stress-test/SKILL.md, skill-advisor/__tests__/rank.test.ts (fixture).
**Constraints**: Fix-la-clase: o se barre todo o no se toca. Históricos/ejemplos puros (html-report/examples/sample-audit-report.md, menciones en retros/audits/plans) se CONSERVAN — son registro. La superficie es-ES del skill se mantiene; solo cambia la identidad. `git mv` para preservar historia.
**Deliverable**: dir renombrado, frontmatter `name: security-audit`, refs vivas actualizadas, fixture de test actualizado.
**Verify**: `grep -rn "security-review" <capa viva sin _archive/examples/audits/plans>` → 0; `bun test` verde; en la PRÓXIMA sesión el listado model-facing debe mostrar la descripción es-ES propia (AC1 conductual — declarar diferido).
**Ask first**: el nombre `security-audit` se ratifica en gate 2→3 — si el usuario prefiere otro, usar ese.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Wave / Deps / Blocks** | W1 / none / none |
| **Files** | dir rename + ~12 md + 1 test fixture |
| **TDD** | optional (mv + texto; el fixture corre en suite) |
| **Cómo arrancar** | `git mv` → sweep grep ordenado por dispatchers |

## Acceptance criteria

- **AC1**: Given el rename, when grep del nombre viejo en capa viva (excluyendo históricos declarados), then 0 hits (spec AC1).
- **AC2**: Given la suite, when corre, then verde (fixture de rank.test.ts incluido).
