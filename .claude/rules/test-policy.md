---
paths:
  - ".claude/plans/**"
---

<!-- Path-scoped (021): flow-plan/flow-test-plan/build Read this file explicitly when they run, so it never needs eager always-load. Lazy-trigger on planning artefacts is belt-and-suspenders; the skills' explicit Read is the real delivery. -->

# Test Policy

Whether TDD-first decomposition applies when planning changes. Read explicitly by `flow-plan` (§0.1), `flow-test-plan`, and honored by `flow-build` per node.

## Levels

| Level | Meaning | Planner behavior |
|---|---|---|
| `business-critical` | Tests cover business logic; regressions cost real value | TDD-first MANDATORY: test node before impl node in DAG. Skip requires `tdd-skip: <reason ≥10 chars>` on the node |
| `mixed` | Both business and auxiliary tests | Per-file: business paths → TDD-first; auxiliary paths → optional. Planner declares rationale per node |
| `auxiliary` | Infrastructure/hooks/helpers; no business logic | TDD-first OPTIONAL. Tests run post-impl as verification. Nodes opt in with `tdd: forced` |

## Project declaration

This project's policy: **`auxiliary`** — poneglyph is orchestration config; tests cover security gates and validators (`.claude/hooks/__tests__/`), not business logic. Mandatory TDD would be ceremony without proportional value. This rule is the single source of the project default; `/flow-lifecycle` raises it per HU (see Override in plan below). The repo verification command is `bun test ./.claude/` (on failure → `Skill('troubleshooting')`).

## Override in plan

A plan node may override the project policy:

- `tdd: forced` — force test-first despite `auxiliary` (e.g. a new hook with non-trivial logic warranting red→green).
- `tdd-skip: <reason ≥10 chars>` — skip test-first despite `business-critical`. Reason must be concrete: `doc-only change, no testable behavior` · `exploratory spike before contract is stable` · `config tweak, validated by existing integration tests`.

Inside `/flow-lifecycle` the default is raised, not replaced: behaviour-changing HUs get `tdd: forced`, auxiliary code included; document-only HUs use validations. `flow-test-plan` resolves this per HU and justifies every exception before execution (`skills/flow-test-plan/SKILL.md` §Step 2). Outside `/flow-lifecycle`, the project level above applies unchanged.
