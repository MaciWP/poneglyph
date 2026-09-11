---
spec: 037-meta-create-harness
tasks_implemented: [US1, US2, US3, US4, US5, US6, US7, US8, US9, US10, US11, US12, US13, US14, US15, US16, US17, US18]
oracle_source: both
created: 2026-09-10
phase: 4
status: complete
review_level: full
review_level_reason: repair pass after NEEDS_CHANGES; same 18 HUs; quality-mode only
verdict: APPROVED_WITH_WARNINGS
spec_drift: legitimate
findings_count:
  blocker: 0
  major: 0
  minor: 2
  nit: 0
fresh_reviewer_invoked: no (inline + declared bias)
fresh_reviewer_note: repair pass; first critic used three grok-4.6 explore agents. This pass greps the six MAJORs. Author implemented the fix (bias declared).
security_review_invoked: no
review_patterns_modes: [quality]
base_revision: f229e34b54b1bd3d3977966ec727c66c0e1caaf9
---

# Review — 037-meta-create-harness (repair pass)

## Veredicto

**APPROVED_WITH_WARNINGS** — six prior MAJORs closed on disk. Two minors remain (N5 agent `names.add` skipped by plan; N6 last-fetch stamps still T1-only). AC27 live `run.ts` is living-spec (plan O1); inventory oracle is green.

## Prior MAJOR re-check

| Id | Status | Evidence |
|---|---|---|
| M1 parked recipes | closed | grep `activation.keywords` / `model: sonnet` / `/meta-create skill` in `meta-create/` → 0. 33 files are Redirect stubs |
| M2 stub auto-invoke | closed | both stubs: `disable-model-invocation: true`, `user-invocable: false`, description `Stub. Use meta-harness.` |
| M3 live evals | living-spec | jsonl 22–25 + unit 3/3. Plan O1: no spawn. `spec.md:143` When still names `run.ts` — Phase 5 patches Then |
| M4 doctrine-sweep glob | closed | `doctrine-sweep.md:19` includes js/json/toml/yaml |
| M5 T11 Grok modes | closed | `t11-permissions.md:24` native enum vs Claude-compat aliases |
| M6 T3 Grok disable | closed | `t03-agent.md:30` host-level + toggle + `/config-agents` |

## Requirement evidence (repair delta)

| Requirement | Status | Check |
|---|---|---|
| AC1 listing | passed | stubs cannot auto-invoke; parked tree cannot teach |
| AC2 T3/T11 Grok cells | passed | vendor enum + disable match user-guide |
| AC14 create body | passed | parked refs are Redirects; cookbook 01–07 already were |
| AC24 glob | passed | doctrine-sweep includes js/json/toml/yaml |
| AC27 When live | living-spec | unit oracle passed; live not run (O1) |
| AC28 invocation | passed | flags + short description; letter already held |
| AC30 | passed | always-loaded Δ 0 (21033) |

`coverageMet: true` against the approved 2.5 oracle + this repair. Spec AC27 When is flagged for retro, not as a remaining product hole.

## Oracle ejecutado

| HU | Resultado |
|---|---|
| US1 repair | PASS — stubs, 33 poison-pills, glob, `check:config` 0 errors |
| US6 repair | PASS — T3 disable cell |
| US14 repair | PASS — T11 keys cell |
| US4 O1 | PASS — 3/3 unit; live skipped by plan |

## Checklist

### Correctness

- [x] spec problem solved for the assembled happy path (router + packs; old tree is Redirect)
- [x] Happy path: Lead loading `meta-harness` + one pack; stub listing no longer competes on verbs
- [x] Edge: glob of `meta-create/references/` now Redirects
- [x] Tests: 3/3 evals unit; `check:config` 0 errors

### Quality

- [x] `test-policy.md` auxiliary
- [x] Cookbook stub pattern reused (no new abstraction)
- [x] No catalog rewrite, no sync-script edits

### Security

- [x] `native-hook --check` passed; secrets only as anti-pattern examples

### Performance

- [x] N/A docs/config

### Mantenibilidad

- [x] No TODOs in `meta-harness/`
- [x] Lessons: G2 gates re-run; G13 live `run.ts` not spawned (O1)

## Findings

| Sev | Id | Descripción | Archivo:línea | Recomendación |
|---|---|---|---|---|
| MINOR | N5 | Agent scan checks `names.has` and does not `names.add`. Two Codex TOML files with the same `name` would not collide. Global add would break T2.1 (same name Claude+Grok). | `check-config.ts:165-177` | Leave; document in retro if wanted. Do not code this pass |
| MINOR | N6 | Last-fetch table is T1-only | `lookup.md:30-37` | Stamp T2–T15 on next consult |

## Living-spec

- **E4/H8** (`spec.md:194,237`): Grok **does** apply `model`/`effort`. Pack is correct. Patch spec in `/retro`.
- **AC27** (`spec.md:143`): Then should match the approved US4 oracle (jsonl + `skillTriggerParse` unit). Live `run.ts` remains opt-in (G13).

## Drillme — Phase 4 (repair)

1. Spec drift? Legitimate E4 + AC27 wording. Baked.
2. E2E happy path? Router + one pack; parked glob Redirects; stubs invoke-off.
3. Edge? Copying a parked template now copies a Redirect, not `model: sonnet`.
4. Coverage? Auxiliary + US4 unit. Live evals out of this pass.

Zero open questions.

## Tests ejecutables

- **Comando**: `bun run check:config` (0 errors); `bun .claude/scripts/budget.ts` (Δ 0); `bun test ./.claude/evals/__tests__/cases-meta-harness.test.ts` (3/3); `native-hook --check` passed
- **Regresiones**: ninguna en gates
- **Bias**: author of the repair wrote this pass. First critic was independent.

## Next step

- **APPROVED_WITH_WARNINGS**: `/retro` (living-spec E4 + AC27). No commit unless asked.
