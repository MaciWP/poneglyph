---
name: build
description: |
  Implementa UNA HU aprobada (Fase 3 del workflow de 5 fases). Lee tasks/USX.md + tests.md/validations.md + state.json, identifica la siguiente HU (o una concreta vía /build US{id}), busca ejemplos del proyecto para el estilo, honra el TDD-mode (red→green si forced; impl + verificación de suite si optional). Invoca AskUserQuestion ante dudas concretas (nunca improvisa). Actualiza state.json al cerrar. Corre INLINE en la sesión principal.
  Úsala cuando: tasks/ aprobado + oracle de Fase 2.5 aprobado + HU pendiente en state.json, "build", "implementa", "ejecuta", "construye", "siguiente HU", tras /tdd-design y antes de /critic.
metadata:
  keywords: >
    Keywords - build, implement, implementa, ejecuta, construye, develop, code, write,
    red-green, TDD, HU, story, story-executor, fase-3, phase-3, next-HU
disable-model-invocation: false
argument-hint: "[US{id}]"
when_to_use: |
  "implementa la HU", "construye esto", "ejecuta la tarea", "siguiente HU", "implement the story", "build it", "next HU"
---

# Build (Phase 3)

Implements ONE HU at a time from an approved `tasks/` + Phase 2.5 oracle. Each HU closes red→green (or impl + suite verify when policy allows) before the next HU starts. **HU-atomic** — never opens two HUs in parallel.

## Underlying principle

> "Each HU closes intra-fase before the next one. Smallest diff that satisfies the AC + drillme." (Commandment V — simple by default; Commandment IV — blocking gates per HU)

Discipline: **atomicity + honest test/validation closure + inline execution** (one HU = one unit of work in the main session; "context isolation" is never a reason to spawn — `orchestrator-protocol` P1/P2). Rationale: `references/01-history.md`.

## When to use

| Trigger | Example |
|---|---|
| `tasks/` approved + `tests.md`/`validations.md` approved + HUs pending in `state.json` | After `/tdd-design` closes Phase 2.5 |
| User invokes `/build` (next pending HU) or `/build US{id}` (specific HU) | Direct invocation |
| `tdd-design` skill closes and triggers Phase 3 invocation | Auto-chain from Phase 2.5 |

## When to skip

| Anti-trigger | Why |
|---|---|
| `tasks/` not yet approved (status `draft`) | Phase 2 first |
| Phase 2.5 oracle not approved (no `tests.md`/`validations.md`) | Phase 2.5 first — TDD-mode HUs need oracle BEFORE impl |
| All HUs in `state.json` already completed | Phase 4 (`/critic`) instead |
| Bug fix in trivial mode (no `tasks/` directory) | Direct edit by Lead — Phase 3 ceremony adds nothing |

## Workflow

### Step 1 — Read inputs

1. `Glob .claude/plans/*-*/tasks/index.md` — find active feature.
2. If multiple → pick the one whose `state.json.current_phase == 3` (or 2 → 3 transition pending); ask user if ambiguous.
3. Read in parallel:
   - `tasks/index.md` (DAG + tabla resumen)
   - `tasks/US{N}.md` for each HU pending in `state.json`
   - `tests.md` (TDD-mode HUs) and/or `validations.md` (validation-mode HUs) — at least one exists per Phase 2.5
   - `state.json` (current_phase, us_completed, us_pending)
   - `.claude/rules/test-policy.md` (project TDD policy)

### Step 2 — Identify HU to execute

| Invocation | Selection |
|---|---|
| `/build US{id}` | Execute that exact HU. If already completed in `state.json` → ask user (re-run? abort?). |
| `/build` (no arg) | First HU in `state.json.us_pending` whose `depends_on` are all in `state.json.us_completed`. If none → check if a previously failed HU is in `us_pending_blocked` and escalate. |

Read the chosen `tasks/US{N}.md` completely + its associated `T{N}.X` tests or validation block. When the US carries an "Execution prompt (Phase 3 input)" block, that block is the PRIMARY instruction — Task/Context/Constraints/Deliverable/Verify govern the implementation; the rest of the document elaborates it.

### Step 3 — Execute inline (the HU is one unit of work)

The HU is implemented **inline in the main session**. Per the canonical spawn decision tree (`orchestrator-protocol` §Step 1), **1 agent is forbidden** and "context isolation" is not a valid reason to spawn — a single HU, even one touching ≥5 files, is one unit of work the Lead does directly. `/clear` resets context between HUs if it grows.

| HU characteristic | Mode | Reason |
|---|---|---|
| Any single HU (1..N files, bounded change) | **Inline** (Lead in skill) | Default-allow gate covers it; spawning 1 agent for isolation is forbidden (P1/P2) |
| HU touches sensitive paths (`.env`, `*.lock`, `package.json`, `.claude/settings*.json`, `secrets/`) | **Inline** + declare `sensitive: <reason ≥8 chars>` | CLAUDE.md sensitive-paths rule |
| HU is "create extension" (new skill/hook/rule/MCP/plugin) | Lead invokes `meta-create` first; then inline | Meta-context requires `meta-create` consultation |
| The wave has **≥4 independent HUs** with disjoint files and no shared state | **Workflow** fan-out (opt-in) | Only at ≥4 parallel units does delegation pay off (P3); `isolation: 'worktree'` per unit on collision |

> A single HU is NEVER a reason to spawn. Fan-out is decided at the WAVE level (≥4 independent HUs), not per-HU — and it is user opt-in (Workflow). See `orchestrator-protocol` §Step 1 spawn decision tree + `references/04-agent-selection.md` §Workflow wiring.

### Step 4 — Glob/Grep ejemplos similares (style anchors)

Before any Edit/Write:

1. `Glob` patrón similar al output esperado (`.claude/skills/*/SKILL.md` for new skills, `.claude/hooks/*.ts` for new hooks, etc.).
2. `Read` 1-3 ejemplos cercanos en estilo y dominio.
3. `Grep` referencias a las funciones/módulos/patrones que la HU usará (`anti-hallucination`).
4. **When the HU writes tests**: Glob the existing test infrastructure (`**/conftest.py`, `**/factory*.py`, `**/fixtures/**`, shared test helpers) and load the project's test-conventions skill if present (e.g. `django-testing-patterns`). Reuse existing fixtures/factories by name — **never duplicate data an existing fixture provides**; add a new fixture only at the correct shared level (closest conftest / shared helper), per the oracle's "new fixture needed" flag from Phase 2.5.

5. **Lessons pass**: `Skill(lessons)` — the cross-repo guards plus the `references/<stack>-*.md` matching the HU's stack (Django, React, …). Mandatory when the HU touches code recovered from a stash or an old branch (lesson G3).

Anti-hallucination auxiliary fires here automatically; if it doesn't, the Lead runs Glob/Grep/LSP manually before claiming any path exists.

### Step 5 — Honor TDD-mode per HU

Read `tests.md` frontmatter `tdd_policy: <forced|adaptive|optional>` + per-node overrides (`tdd: forced`, `tdd-skip: <reason>`).

**Forced (or per-node `tdd: forced`)** — strict red→green:

```
1. Write the test file from T{N}.X spec.
2. Run it (`bun test <path>` or project equivalent).
3. Verify it FAILS with the predicted error (red). A pass before impl is a smell — STOP + confirm with Lead.
4. Implement minimal code in the IMPL files to pass the test.
5. Re-run the test. Verify it passes (green).
6. If new edge cases emerge → add tests in the SAME HU and iterate red→green within it. Do not push silently to next HU.
```

**`tdd-skip: <reason>`** — reason is binding; do not relitigate:

```
1. Implement the code directly.
2. Run the existing test suite as verification (`bun test ./.claude/hooks/` or project equivalent).
3. If the skip reason looks wrong on inspection (e.g., the change DOES have testable behavior), report it in Issues and let the Lead decide.
```

**Optional (`auxiliary` policy with no per-node override)** — status quo:

```
1. Implement.
2. Run suite as post-impl verification.
3. If suite reveals breakage in unrelated code → diagnose with `diagnostic-patterns` skill.
```

**Validation-mode HU** (markdown/skill/doc/config) — no `tests.md` entry, only `validations.md`:

```
1. Implement the markdown/config change.
2. Verify each of the 5 categories in validations.md (Pre/Post/Structural/Smoke/Cross).
3. Run `bun test ./.claude/hooks/` as smoke (poneglyph-specific — auxiliary policy).
4. If Structural assertion fails (e.g., missing frontmatter field) → fix before declaring HU done.
```

### Step 6 — AskUserQuestion on concrete doubts (NEVER improvise)

Triggers for `AskUserQuestion`:

| Trigger | Example |
|---|---|
| Interface ambiguous (function signature not specified in AC) | "AC says 'parse the config' but doesn't specify input format — JSON or YAML?" |
| Decision not in spec (path, naming, default value) | "Where should the cache live? `~/.claude/cache/` or `.claude/<project>/cache/`?" |
| Edge case not covered in AC or oracle | "What if the input array is empty? AC silent; assume `[]` returns or error?" |
| Conflict between AC and existing code style | "AC asks for `snake_case` but project uses `camelCase` everywhere. Honor AC or follow style?" |

NEVER guess. NEVER add features beyond the AC. If 2+ `AskUserQuestion` fires in a single HU → smell signal: the HU was poorly defined; flag in Issues for retro (Phase 5).

### Step 7 — Drillme intra-HU (baseline 4, proportional)

These 4 are the **floor** for an HU with real implementation choices, not a hard cap: drillme is gap-gated (SKILL.md), so it sweeps any additional `[approach]`/`[failure]` gap the HU surfaces and produces **fewer (or zero)** on an unambiguous HU. Proportional to information gain, never a fixed count.

Before declaring HU complete:

1. `[approach]` **Pattern ignored?** Is there a pattern in the project I'm ignoring? (Glob results inspected?)
2. `[approach]` **Duplication?** Does my implementation introduce duplication of an existing utility?
3. `[approach]` **Over-engineering?** Am I adding more than the AC strictly requires (abstractions, hooks, fallbacks for impossible states)?
4. `[approach]` **Naming consistent?** Are names (files, functions, variables) consistent with the rest of the codebase?

Coverage: 4/4 in the `[approach]` category — Phase 3 is implementation-focused; `[location]`/`[context]`/`[failure]` were covered in upstream phases. NOT padding with artificial questions.

> Skill-to-skill invocation is probabilistic. If `drillme` does not auto-fire and a real doubt blocks progress, the Lead invokes `/drillme "<concrete doubt — HU US{N}>"` manually before closing the HU.

### Step 8 — Update state.json AND `tasks/US{N}.md` frontmatter

Two updates per HU closure (both mandatory — Cmd VII observability + documental coherence). One command does both, schema-validated: `bun .claude/scripts/flow-state.ts close-us US{N} --files "a.md,b.ts"` — prefer it over hand-rolled JSON/sed edits.

**8a. Update `state.json`** after tests pass (or validations close):

```json
{
  "current_phase": 3,
  "us_completed": ["US1", "US2", "US{N}"],
  "us_pending": ["US{M}", "US{P}"],
  "us_history": [
    {
      "us": "US{N}",
      "completed_at": "2026-MM-DD",
      "tests_passed": true,
      "files_touched": ["path/a", "path/b"],
      "execution": "inline",
      "askuserquestion_count": 0
    }
  ]
}
```

If `state.json` does not exist yet (first HU of Phase 3) → create it with the schema declared in US8 (`/flow`). If schema undefined → use the minimal shape above.

**8b. Update `tasks/US{N}.md` frontmatter** — the closed HU's own document:

```diff
 ---
 us: US{N}
 ...
- status: approved
+ status: closed
+ closed: YYYY-MM-DD
+ implemented: YYYY-MM-DD  # if not present
 ---
```

Without this update, the US document remains in `status: approved` even though its code is delivered → documental incoherence at feature closure (Phase 5 retro catches this as a smell). The build skill is RESPONSIBLE for closing the US frontmatter the moment the HU passes its gate.

**Anti-pattern blocked**: closing a HU in `state.json` but leaving `tasks/US{N}.md status: approved` → forces Phase 5 retro to do residual cleanup + flag a Phase 3 process failure in lessons ❌.

### Step 9 — Verify (blocking gate per HU)

Before reporting HU completed:

- Tests pass: `bun test <relevant>` (or project equivalent) → 100% on touched files.
- Project full suite: `bun test ./.claude/hooks/` (or equivalent) → no regressions in unrelated code.
- Type check (if project has type checker): `tsc --noEmit` / `mypy` / `cargo check` / `go vet`.
- Lint (if configured).
- **Docs-sync (same HU)**: if the HU created/changed a component (hook, skill, command, setting), the docs that DESCRIBE it (registry tables like `rules/paths/hooks.md §Available Hook Events + reliability`, `system-inventory.md`) update in the SAME HU — truth-debt regenerates otherwise (lesson: 017 Phase 4 MAJOR).
- If ANY of the above fails → invoke `diagnostic-patterns` skill, retry per `error-recovery.md` budget. After 2 retries → escalate to user.

**Never report "completed" without tests passing** (Commandment IV).

### Step 10 — Report HU closure + next HU

Output to user:

```
✅ HU US{N} closed.
- Files: <list>
- Tests: <pass count>/<total>; red→green honored (or tdd-skip: <reason>; or validation closure)
- Execution: inline (or Workflow fan-out if the wave had ≥4 independent HUs)
- AskUserQuestion fired: <count>
- state.json updated.
- tasks/US{N}.md frontmatter updated: status: closed + closed: YYYY-MM-DD

Next HU available: US{M} (depends_on satisfied)
  → /build US{M} para ejecutar
  → /build sin args para auto-seleccionar
  → /critic si todas las HUs cerradas (Phase 4)
```

If all HUs closed → flag `state.json.current_phase: 4` and report "Phase 3 complete. Hard gate 3->4 — review/critic pending."

## Execution model: inline

The `builder` agent was cut in feature 008 (1 agent forbidden; "context isolation" is not a reason). A single HU runs inline; a ≥4-HU parallel wave may fan out via `Workflow` with the `default` subagent (`orchestrator-protocol` spawn tree). History: `references/01-history.md`.

## Auxiliary skills

Wiring and manual fallbacks for this phase (anti-hallucination, drillme, diagnostic-patterns must fire on every HU; lsp-operations, review-patterns, meta-create, meta-settings-cookbook conditional): `.claude/docs/auxiliary-skills-matrix.md` §Fallbacks per phase. Skill-to-skill invocation is probabilistic (issue #59968) — when an auxiliary does not fire, apply its fallback row.

## SIEMPRE rules

- HU-atomic: one HU at a time; never open two HUs in parallel.
- Glob/Grep ejemplos del proyecto BEFORE writing — preserve style.
- AskUserQuestion on concrete doubts; NEVER improvise.
- Read before Edit (always). Glob before Write (verify file does not exist).
- Tests pass before declaring "completed" (Commandment IV — no exceptions).
- Update `state.json` on every HU closure (closure + timestamp + tests_passed + execution mode).
- Execute inline — a single HU is never a reason to spawn an agent (P1/P2). Fan out only at ≥4 independent HUs (Workflow, wave-level).

## Adaptation intra-phase (Principio 2)

| Signal | Adaptation |
|---|---|
| HU trivial (1 file, known pattern, no ambiguity) | Skip exhaustive Glob; 1-2 examples max; reduced drillme (most-relevant question only) |
| HU touches business-critical code AND `test-policy.md` = `business-critical` | Strict red→green; no shortcuts; full drillme 4/4 |
| HU has `tdd-skip: <reason>` | Implement directly; suite verify; declare skip reason verbatim in Step 10 report |
| HU is markdown-only (validation-mode) | Skip `tests.md` consultation; apply Pre/Post/Structural/Smoke/Cross from `validations.md` |
| Tests fail 2x consecutive on same HU | STOP — escalate to user with diagnosis (per `error-recovery.md` Stuck Detection) |

## Casos edge

- **Edge 1** — HU `depends_on` not satisfied (HU listed in `us_pending` but a dep is also pending): STOP, execute dep first or escalate to Lead.
- **Edge 2** — `tests.md` has T{N}.X but the test file path conflicts with an existing test: ask user (rename/merge/skip).
- **Edge 3** — HU AC mentions a function that doesn't exist yet AND isn't in any HU's `files` field: smell — Phase 2 decomposition missed it; abort and escalate.
- **Edge 4** — A ≥4-HU wave fanned out via Workflow and one unit fails: follow `error-recovery.md` (the Workflow runtime drops the failed unit to `null`; re-run that unit inline or in a follow-up Workflow).
- **Edge 5** — User invokes `/build` but `state.json` says Phase 3 already complete: ask if re-run a specific HU or transition to Phase 4.
- **Edge 6** — HU touches sensitive path: Lead declares inline `sensitive: <reason ≥8 chars>` before the edit; no extra ceremony.

## Smell signals

- ⚠️ If a HU requires modifying files NOT listed in its `tasks/US{N}.md` `files` field → smell: reopen Phase 2 to refine the HU's scope.
- ⚠️ If 2+ `AskUserQuestion` fires in a single HU → HU was poorly defined; flag for retro (Phase 5).
- ⚠️ If implementation introduces duplication detected by Glob/Grep → refactor before closing the HU.
- ⚠️ If a TDD-mode test passes BEFORE impl (red expected, got green) → smell: the contract is misunderstood; STOP and confirm with Lead.
- ⚠️ If `diagnostic-patterns` retries exceed budget on the same HU → escalate; do not loop silently.
- ⚠️ If the Lead is tempted to spawn 1 agent "for isolation" on a big HU → forbidden (P1/P2); execute inline, `/clear` between HUs if context grows.

## Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Improvise on ambiguous AC | Code introduces decision not in AC + no `AskUserQuestion` fired | Revert ambiguous bit; ask user; redo |
| Skip red phase in forced TDD | `tests.md` says forced but impl committed before test ran red | Re-run test in isolation (revert temporarily); verify red was reachable; document in Issues |
| Over-engineer beyond AC | New abstraction/hook/fallback not requested in AC | Remove; simpler version that meets AC only |
| Report "completed" without verifying | No test output in Step 9 yet HU marked done in state.json | Reopen HU; run verify; only then re-close |
| Spawn 1 agent for a big HU "for isolation" | An Agent() call for a single HU | Forbidden (P1/P2); execute inline; `/clear` if context grows |
| Modify unrelated code "while there" | Diff includes files outside HU's `files` field | Revert non-HU edits; flag for retro if pattern emerges |

## Commandments cubiertos

| # | Cómo |
|---|---|
| II | `anti-hallucination` before every Edit/Write — no invented references |
| V | Smallest diff that satisfies AC; over-engineering caught by drillme Q3 |
| IV | Tests pass before "completed"; no exceptions (blocking gate per HU) |
| I | Read AC + tests/validations + ejemplos del proyecto BEFORE writing |
| VI | Sensitive paths require inline declaration; destructive ops never run by this skill |
| X | Inline execution avoids wasteful 1-agent spawns; fan-out only at ≥4 independent HUs (P1/P3) |
| IX | Meta-extensions go through `meta-create` skill consultation (extensible meta-system) |

## References

Rationale, builder-agent history and post-implementation verification of this skill: `references/01-history.md`.

## Output format reminder

When this skill closes a HU:

```
✅ HU US{N} closed.
- Files: [<paths>]
- Tests: <X/Y passing>; mode: <forced red→green | tdd-skip: <reason> | validation-mode | optional>
- Execution: inline (or Workflow fan-out if ≥4-HU wave)
- AskUserQuestion fired: <N>
- state.json updated.

Next HU: US{M}
  → /build US{M} (specific)
  → /build (next pending)
  → /critic (if all HUs closed → Phase 4)
```
