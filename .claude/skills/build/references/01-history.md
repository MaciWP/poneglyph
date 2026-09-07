---
parent: build
name: history
description: Rationale, the builder-agent cut (feature 008) and post-implementation verification of the build skill — history, not runtime procedure.
---

# build — rationale, execution-model history, post-implementation verification

Relocated verbatim from `SKILL.md` on 2026-09-03 (plan 032/WP4 — progressive disclosure).

## Underlying principle (rationale)

> "Each HU closes intra-fase before the next one. Smallest diff that satisfies the AC + drillme." (Commandment V — simple by default; Commandment IV — blocking gates per HU)

Phase 3 is the only phase that touches production code. Every other phase is design or verification. The discipline here is **atomicity + honest test/validation closure + inline execution** (a single HU is one unit of work → the main session does it; "context isolation" is not a reason to spawn — see the canonical spawn decision tree in `orchestrator-protocol`).

## Execution model: inline (builder agent CUT — feature 008)

| Era | Decision |
|---|---|
| Original (feature 001, AC7) | `builder` agent KEEP-conditional — invoked for HUs ≥5 files "for context isolation" |
| **Now (feature 008)** | **`builder` agent CUT.** The spawn decision tree forbids 1 agent; "context isolation" is not a valid reason (the user resets context with `/clear`). A single HU is one unit of work → **inline**. Fan-out happens only at the WAVE level when ≥4 independent HUs exist (Workflow, opt-in). |

**Effect**: `.claude/agents/builder.md` deleted; `agent-memory/builder/MEMORY.md` archived under `plans/008-agent-spawn-policy/archive/`. This skill executes inline; for a ≥4-HU parallel wave the Lead may fan out via `Workflow` using the `default` subagent (see `orchestrator-protocol` spawn decision tree).

## Verification (post-implementation of this skill)

- Smoke: invoke `/build US{N}` on an approved `tasks/` + `tests.md` → executes exactly that HU inline; produces diff + tests pass.
- Verify `state.json` is updated with the HU's closure entry (timestamp, tests_passed, execution mode).
- Verify NO files outside the HU's `files` field are touched (Glob diff vs `files`).
- Verify if HU has `tdd: forced` then a test file was created + ran red before impl (audit via git log of the test file vs impl file).
- `bun test ./.claude/hooks/` → green (this skill is markdown only — no hook test impact).

## Auxiliary skills — fallbacks

Moved to `.claude/docs/auxiliary-skills-matrix.md` §Fallbacks per phase (single owner of the phase↔auxiliary wiring).
