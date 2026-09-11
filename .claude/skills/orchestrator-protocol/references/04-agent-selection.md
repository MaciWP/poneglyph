---
parent: orchestrator-protocol
name: agent-selection
description: Signal→agent selection matrix, multi-agent patterns, anti-patterns.
---

# Agent Selection

## Contents

- [Exploration Decision Matrix (Volume × Complexity)](#exploration-decision-matrix-volume-complexity)
- [Selection Matrix](#selection-matrix)
- [Multi-Agent Patterns](#multi-agent-patterns)
- [Parallelization & Batch Operations](#parallelization-batch-operations)
- [Anti-Patterns](#anti-patterns)

> **Delegation doctrine** (inline-first; agents = parallel READ-ONLY fan-out; write fan-out = explicit opt-in; the 3 costs): canonical in `SKILL.md` §Delegation doctrine + P8. This file selects WHICH primitive once fan-out is already justified by the tree.

## Exploration Decision Matrix (Volume × Complexity)

Before any exploration, decide HOW to read the codebase. **The exploration primitive is `Explore`** (built-in; inherits the session model since CC 2.1.198; empirical score 83). The custom `scout` agent was **cut in feature 008** — deeper single-unit synthesis runs inline (Lead `Read`/Grep); ≥4 independent exploration sweeps fan out via `Workflow`.

| | LOW complexity (direct read) | HIGH complexity (relationships, architecture) |
|---|---|---|
| **LOW volume** (1-2 files) | Lead `Read` directly — no delegation | Lead `Read`/Grep inline, or `Explore` |
| **HIGH volume** (≥3 files) | `Explore` — best fit | `Explore`; ≥4 independent sweeps → `Workflow` |

Plus: design-doc audits, cross-file consistency checks, and full-file reads → `Explore` (≥4 independent units → `Workflow`). WebSearch/WebFetch is **not** a discriminator (both have those tools).

### Derived rules

| Rule | Reason |
|-------|-------|
| The Lead reads 1-2 files inline | For bulk read-only exploration, use `Explore` (not a work-spawn). |
| LOW Volume + LOW Complexity = direct Read | Cost of delegation > cost of direct Read. |
| Exploration primitive = `Explore` (inherits session model) | Empirical score 83; the custom `scout` was cut in feature 008. |
| Deeper synthesis past Explore's window | Runs inline (Lead `Read`/Grep); ≥4 independent sweeps → `Workflow`. |
| Parallel axis: "change difficulty" | If after exploring you must implement a difficult change, invoke `tech-plan` skill (independent of the exploration axis). |

### Primitive by context need (CC ≥2.1.232)

| Need | Primitive | Model |
|------|-----------|-------|
| Fresh context (critic reviewer, adversarial check) | `general-purpose` | explicit — top tier for a verify/judge (`CLAUDE_CODE_SUBAGENT_MODEL` would silently give it the cheap tier) |
| Read-only sweep over the session's own thread | `subagent_type: "fork"` (inherits conversation + prompt cache) | parent's model, override ignored |
| Read-only codebase exploration, thread not needed | `Explore` | inherits session model |

All three run in the background by default — the result arrives as a task notification; never predict it. All three sit behind the CLAUDE.md §Agent spawn gate.

### Parallel axis — Change difficulty

The matrix above decides **exploration**. The difficulty of the **change that follows** is an independent axis:

| Change | Action after exploration |
|--------|-------------------------|
| Trivial (1 line, rename) | Lead inline |
| Standard (1 file, clear pattern) | Lead inline (`Skill('build')` in a /flow) |
| Multi-file / architectural (one unit) | Lead inline (`Skill('tech-plan')` first if complexity >60); ≥4 independent HUs → `Workflow` |

A task can be **HIGH Volume exploration + trivial change** (lots to read, little to change) or **LOW Volume + complex change** (little to read, lots to think). Decide each axis separately.

---

## Selection Matrix

The "Suggested skills to Read (for delegation)" column lists `.claude/skills/<name>/SKILL.md` paths the Lead should include in the delegation prompt's `[RELEVANT SKILLS FOR THIS TASK]` block (Arch H). Max 3 per delegation. Pick the ones whose paths actually match the task context; skip the column if none apply. **Domain-specific skills (Django, React, OpenAPI, etc.) now live as project skills** under each repo's `./.claude/skills/` — check the project's path rules or skill conventions to discover them. The global skills listed below are cross-project patterns only.

| Signal | Execution | Skill/Mode | Suggested skills to Read (Arch H) | Fallback |
|--------|-----------|------------|-------------------------------------------|----------|
| implement, create, fix, build | `build` inline by default; authorized Orca teams use its supervised-worker branch | (by prompt) | (match domain via skill-matching) | — |
| refactor, extract, simplify, restructure | inline | review-patterns | review-patterns | — |
| merge conflict, git conflict | inline | (prompt context) | — | — |
| docs, sync, documentation | inline | (doc task) | — | — |
| bug documentation, knowledge base | inline | diagnostic-patterns | diagnostic-patterns | — |
| review, validate, check (generic) | `Skill('critic')` inline + ONE fresh-context read-only reviewer (P1 exception, 019) | standard mode | review-patterns | — |
| security, audit, vulnerability, owasp | `Skill('critic')` + `Skill('security-audit')` | security-audit | security-audit | — |
| code quality, smells, SOLID, complexity | `Skill('critic')` / review-patterns (quality) | review-patterns (quality mode) | review-patterns | — |
| performance, slow, bottleneck, N+1 | `Skill('critic')` / review-patterns (performance) | review-patterns (performance mode) | review-patterns | — |
| plan, design, decompose, RFC, architecture, contract | Lead via `Skill('tech-plan')` | (no dedicated agent) | decide (heavy tier) (for design risk), review-patterns | — |
| >3 subtasks, breakdown, dependencies | Lead via `Skill('tech-plan')` | (decomposition in skill) | — | — |
| find, explore, search codebase | `Explore` (built-in); ≥4 sweeps → `Workflow` | — | — | Lead `Read` inline |
| error, failing, debug, diagnose | Lead via `Skill('diagnostic-patterns')` | (no dedicated agent) | diagnostic-patterns | fix inline (obvious fix) |

## Multi-Agent Patterns

| Pattern | Execution | When |
|---------|-----------|------|
| **Explore then Build** | `Explore` (read) → inline build | exploration provides context, Lead implements inline |
| **Plan then Build** | Lead `Skill('tech-plan')` → inline build (sequential; write fan-out = opt-in) | complexity >60 |
| **Build then Review** | inline build → `Skill('critic')` | mandatory for multi-file changes |
| **Diagnose then Fix** | Lead `Skill('diagnostic-patterns')` → fix inline | diagnosis before fix |
| **Worktree Parallel** | ≥4 `Workflow` WRITE units with `isolation: 'worktree'` — explicit user opt-in only | user opted in (ultracode) AND files may overlap |
| **Security Review** | `Skill('critic')` + `Skill('security-audit')` | auth/security changes |
| **Tiered Build** | Lead `Skill('tech-plan')` Mode B contracts → inline sequential | complexity 45-60, 2-3 domains with shared interfaces |
| **Team Parallel** | Team mode (experimental) | 3+ independent domains negotiating interfaces, complexity >60 |

### Workflow wiring

For a supervised Orca team, use `orca-workflow` instead of the native Workflow/Team
recipes below. Its approved roster and real dependencies determine concurrency;
its shared-worktree reservations serialize collisions. The default thresholds
and per-worker isolation examples here do not apply to that route.

How the capabilities of the custom agents (cut in feature 008) map onto the current model, and where `Workflow` fan-out is the right primitive:

| Capability (historical agent) | Now | Fan-out trigger |
|---|---|---|
| implement (was `builder`) | `build` inline by default; supervised-worker branch for an approved Orca team | Native Workflow uses explicit opt-in; Orca uses its shared-worktree contract |
| validate (was `reviewer`) | `critic` skill inline | standard/full code review → **ONE fresh-context read-only reviewer** (correctness/requirements only — P1 exception, 018 W1 D1/D3); decision review → panel via `decide` (heavy tier) |
| explore (was `scout`) | `Explore` (built-in) | ≥4 independent exploration sweeps → `Workflow` (read-only) |
| generator→validator | `pipeline(items, find, verify)` inside one `Workflow` | intra-workflow Four-Eyes — NOT a new spawn decision (spawn-tree P7) |

For CODE review the dispatch target is **ONE fresh-context read-only reviewer** (feature 019 — panels measured as the weak form for code: verifier gap, LLM-judge ensembles ~80% FP; 018 W1 D1/D3 + W2 D1). The author≠evaluator lesson (feature 002) is preserved via fresh context, not lens count. Panels (≥4 perspectives) remain the form for DECISION review (`decide` (heavy tier)) and read-only research fan-out — worked example: the retired ultracode-audit workflow (find→verify pipeline + cross-debate panel over a shared digest; removed 2026-09-11).

## Parallelization & Batch Operations

When delegating or reading, decide PARALLEL vs SEQUENTIAL per call, not per session. Parallelize everything independent; sequence only on real dependency.

### Parallel vs Sequential

| Parallel (same message) | Sequential (wait for result) |
|-------------------------|------------------------------|
| 3+ independent Reads | Edit after Read on the same file |
| 2+ different Glob patterns | Write that depends on Read |
| 2+ independent Agent spawns | Agent that needs prior agent's output |
| Multiple Grep queries on different symbols | Grep after creating a file |
| WebSearch + WebFetch (read-only fetches) | Any tool consuming previous output |

**Anti-pattern**: reading files one by one or spawning agents sequentially when independent → batch in one message.

### Cascading Cancel — the parallelization risk

When a message contains N parallel tool-calls and **one fails**, the others in the same message are cancelled. To avoid losing batch work:

| Rule | Reason |
|------|--------|
| Isolate fragile operations | Network calls (`WebFetch`, `git fetch`), filesystem writes, or `npm install` go in their OWN message. Their failure must not drag local Reads/Greps with them. |
| Parallel Edits only on disjoint paths | Never 2 `Edit` on the same file in the same message. |
| No parallel `Bash(cd <subdir>)` | `cwd` does not persist between Bash calls. Always use absolute paths. |
| When in doubt, sequential | Cost of an extra message < cost of reverting a cancelled batch. |

**Safe example**: `Read(a.ts) + Read(b.ts) + Grep("foo") + Glob("**/*.test.ts")` in one message — read-only, independent, disjoint paths.

**Risky example**: `Edit(file.ts) + WebFetch(url) + Bash("git push")` — if `WebFetch` fails, the `Edit` is cancelled and `git push` does not run. Split into 3 sequential messages.

---

## Anti-Patterns

The agent-count examples below describe default native delegation. They do not
prohibit the explicitly authorized `orca-workflow` route.

| Anti-Pattern | Problem | Use Instead |
|--------------|---------|-------------|
| Spawning an agent for exploration | misses context, wastes tokens | `Explore` (read) or Lead `Read` inline |
| tech-plan skill for complexity <30 | overkill, slows execution | act inline |
| skipping `critic` after multi-file changes | quality risk | `Skill('critic')` checkpoint |
| no tech-plan for >60 complexity | uncoordinated, error-prone | Lead `Skill('tech-plan')` → inline (≥4 HUs → `Workflow`) |
| ≥4 `Workflow` units without worktree on overlapping files | Write conflicts | `isolation: "worktree"` per unit |
| team mode for <3 domains | 3-7x cost with no real benefit | inline, or `Workflow` at ≥4 independent units |
| team mode for dependent domains | file conflicts between teammates | sequential inline / a `Workflow` |
| Reading files one by one | Latency + context overhead | Batch 3+ Reads in one message |
| Sequential agents with no dependency | Wasted parallelism | Spawn in one message |
| Glob → Read → Grep when Glob+Grep would suffice | Round-trips add up | Glob + Grep in same message |
| Edit without prior Read | risk of stale content | Read first, then Edit sequentially |
| Spawning 1-3 subagents when the Lead could act inline | wasted cost+latency, no parallelism return | Main session for ≤3 units; spawn only at ≥4 (Commandment X) |
| ≥4 parallel agents run ad-hoc instead of a workflow | no orchestration, hard to track | At ≥4 independent units → workflow |
