---
description: Orchestrate the full feature lifecycle (scope → tech-plan → tdd-design → build → critic → retro) with human hard gates and measurable boundary checklists.
argument-hint: "<task> | --resume <slug>"
allowed-tools: Read, Edit, Write, Bash, Glob, Grep, Skill, Agent, AskUserQuestion
---

# /flow — feature lifecycle orchestrator

Runs the 6 phase skills (`scope` → `tech-plan` → `tdd-design` → `build` → `critic` → `retro`) over `.claude/plans/{NNN}-{slug}/`, with `state.json` as the resumable source of truth. `/flow` orchestrates a FEATURE (multi-turn); the `orchestrator-protocol` skill orchestrates a Lead TURN — complementary, not redundant.

## Host contract

The steps below keep Claude tool names (`Skill()`, `Agent()`, `AskUserQuestion`, `Workflow()`). Use native equivalents in Codex and Grok, with the same phase artifacts and human gates. Resolve shared resources through `rules/harness-runtime.md` in the installed Poneglyph layer.

| Verb | If the tool exists | If it does not |
|---|---|---|
| `Skill('x')` | Call `Skill` | Read the installed `skills/x/SKILL.md` and run that phase as Lead. Never improvise a phase from memory. |
| `AskUserQuestion` | Native | Available host question tool or direct chat question. Hard gates stay human-only. |
| `Agent()` / fresh reviewer | Native | A real host worker tool only with **this-turn** permission + model (CLAUDE.md). Otherwise critic runs **inline**. |
| `Workflow(flow-build\|flow-cycle)` | Claude Workflow JS | **Do not call.** Grok `workflow` is Rhai — a different contract. Back-half stays **inline**. |
| `flow-state.ts` | `bun $HOME/.claude/scripts/flow-state.ts` | Same path (synced scripts / repo). |

`allowed-tools` in the frontmatter is Claude-only. Codex invokes the generated
`$flow` entrypoint and reads this source. Do not add another lifecycle implementation.

## Doctrine — no modes (user decision 2026-08-05, 029/US12)

`/flow` always runs FULL. Legacy flags (`--minimal|--standard|--full`) parse but are ignored — warn the user. The adaptive lever is per-phase: a phase or artifact that genuinely doesn't apply is skipped by the Lead **with explicit justification, announced BEFORE skipping, and recorded** (retro: `retro-status "skipped — <justificación ≥10 chars>"`; `close-feature` refuses a null/pending retro).

## Boundary checklist (each phase boundary, ≤5 items, recorded)

On entering every phase, tick — and record via `bun $HOME/.claude/scripts/flow-state.ts boundary-check <phase> "<item>"` — so compliance is measurable, not aspirational:

1. Phase skill invoked (`Skill('<phase>')`) — or skip justified + announced.
2. Previous phase's artifact exists (spec.md / tasks/+oracle / green diff / review.md / retro.md-or-justified-skip).
3. `state.json` updated via the helper.
4. Crossing 1→2 or 2→3 → human gate approved (AskUserQuestion — APPROVE / REFINE / BLOCK).
5. Entering Phase 2 or 3 → `skill-advisor` shortlist proposed (propose→ratify; 0 proposals when nothing applies) and `drillme` gap-sweep before the gate (0 questions when unambiguous). These two checkpoints replace the old every-boundary mandate (measured compliance was ~2%).

## Steps

### 1 — Parse

`--resume <slug>` → Step 4. Otherwise `$ARGUMENTS` is the task (empty → ask). Legacy mode flags → warn + ignore.

### 2 — Slug + state

`NNN = max(plans) + 1` → `slug = NNN-<kebab-summary>` → `mkdir -p .claude/plans/<slug>/tasks` → write `state.json` (canonical schema, used by all 6 phase skills):

```json
{
  "spec_slug": "<NNN>-<slug>", "mode": "full",
  "current_phase": 1, "phases_completed": [],
  "gates_approved": { "1->2": false, "2->3": false },
  "us_completed": [], "us_pending": [], "us_history": [],
  "boundary_checks": [],
  "feature_closed": false, "review_verdict": null, "retro_status": null,
  "started_at": "<YYYY-MM-DD>", "updated_at": "<YYYY-MM-DD>"
}
```

`current_phase`: `1|2|2.5|3|4|5|"closed"`. `us_history` and `boundary_checks` are appended by the helper (`close-us`, `boundary-check`).

### 3 — Phases

| Phase | Skill | Produces | Gate / exit |
|---|---|---|---|
| 1 Scope | `scope` | `spec.md` | Gate 1→2 (human) |
| 2 Tech-plan | `tech-plan` | `tasks/index.md` + `US{N}.md` (each with a scored Execution prompt) | — |
| 2.5 Oracle | `tdd-design` | `tests.md` / `validations.md` | Gate 2→3 (human) |
| 3 Build | `build` per HU | green diff per HU | per-HU tests pass |
| 4 Critic | `critic` | `review.md` + verdict | APPROVED/WITH_WARNINGS → 5 · NEEDS_CHANGES → re-enter 3 (only flagged HUs) · BLOCKED → STOP, escalate |
| 5 Retro | `retro` | `retro.md` (promotions + living-spec deltas, both pending user approval) | `retro-status approved` (or justified skip) → `close-feature` |

Phase 3 loop: iterate `us_pending` in DAG order; failure → `diagnostic-patterns` + retry per `error-recovery.md`. A single HU — even ≥5 files — runs inline; **≥4 independent HUs** in a wave may fan out via `Workflow` — explicit user opt-in only ("ultracode" or direct ask).

**Parallel back-half (031, opt-in, ask-gated)**: with tasks/ approved + Phase 2.5 closed, the user may run the back half as a saved workflow — `Workflow({name: "<wf>", args: {slug: "<NNN-slug>"}})`. Both execute pending HUs by DAG wave (sonnet units; file collisions serialize instead of worktrees), return `blocked` + the exact question on an ambiguous AC (never improvised), and never touch `state.json` or git.

| Workflow | Covers | Pick it when |
|---|---|---|
| `flow-build` | Build + full suite + ONE fresh reviewer (opus) → per-HU status | You only need the HUs executed and will run `/critic` yourself |
| `flow-cycle` | Build with the `build`-skill protocol (style anchors, oracle red→green, intra-HU drillme, docs-sync, 1 retry with root-cause diagnosis) + Phase-4 review (base checks + fresh reviewer + `review-patterns` + conditional `security-audit` + spec-drift) → **writes `review.md`** with a PROPOSED verdict | You want the Phase-4 artifact too; ~2× flow-build. Extra args: `only: ["US3"]` (re-run flagged HUs after NEEDS_CHANGES), `level: "light\|standard\|full"` |

The Lead then closes state (`flow-state close-us`), records the returned `boundary_checks`, resolves blocked/failed with the user, and ratifies the verdict (`flow-state verdict`) — a workflow never approves itself. Tradeoff: ~2-4× tokens on the build phase for wall-clock ÷ parallelism.

Phase 5 closure: approved promotions → Lead writes targets inline; approved living-spec diff → patch `spec.md` ("v2 — delta from retro <slug>"); then `close-feature` + frontmatter `status: closed` in spec/tasks.

### 4 — Resume + back-half re-engagement

Read `state.json` strictly; missing/corrupt → reconstruct from artifacts (`Glob <slug>/{spec,tasks/index,tests,validations,review,retro}.md`) + warn. Continue from `current_phase` + `gates_approved`.

**Stuck back-half** (phase 4 with unprocessed verdict, or 5 with retro pending — where 10/14 measured lifecycles died): close it in ONE short session — process verdict → `retro` (or justified skip) → `close-feature`. Re-engagement is manual: `bun $HOME/.claude/scripts/flow-state.ts status` surfaces open lifecycles (the SessionStart open-plans offer was cut 2026-08-07 — followed 1/9 times); closing must be cheap.

### 5 — Report

```
{🟢|⚪|🔴} /flow {slug} — phases <list> · HUs <n>/<m> · verdict <v> ·
retro <status> · closed <yes|no> · promotions pending <n> · skips justificados: <list|none>
```

## Rules

- Each phase runs via its `Skill()` — the Lead MUST NOT improvise phase work from memory (feature 023: under-use is the enemy). Invoke explicitly if auto-fire misses.
- Hard gates are human-only — NEVER auto-approve.
- `state.json` on every transition, via the helper: `close-us | approve-gate | verdict | retro-status | boundary-check | close-feature | complete-phase | status`.
- BLOCKED verdict stops the lifecycle; the user decides reopen/abandon.
- At gates: multi-round questioning while genuine doubt remains (`output-styles/poneglyph.md` §1 Truth; mechanics in `drillme`).

## Edge cases

- Resume without state.json → reconstruct from artifacts + warn; never silently guess.
- Another feature mid-flight when `/flow` is invoked → ask (reuse slug or new); never silently fork.
- HU with unclosed `depends_on` in the loop → STOP, surface the DAG violation.
- Slug is generated once at Phase 1; later phases honor it; unrelated feature → new NNN.

## Smell signals

- ⚠️ Gate 2→3 rejected in >50% of runs → tech-plan is producing weak HUs.
- ⚠️ `state.json` accumulating without `feature_closed: true` → back-half is dying again; run `flow-state.ts status` periodically + re-engagement path.
- ⚠️ `boundary_checks` consistently empty in closed lifecycles → the checklist is being skipped silently.

## Archive

Closed/abandoned plans → `.claude/plans/_archive/` (gitignored). Audits → `.claude/audits/`. `plans/` holds active features + `templates/` + live-referenced files.

## Commandments cubiertos

| # | Cómo |
|---|---|
| I | Phase 1 scope before any technical work |
| III | Hard gates = explicit human approval (colleague pattern) |
| IV | Gates + verdict + retro guard block until resolved; skips solo justificados y registrados |
| VII | `boundary_checks` + state.json = compliance observable end-to-end |
| IX | Rewrite 029/US17: 2.850→~1.100 palabras, mandatos 24→8, modos legacy eliminados |

## Related

`orchestrator-protocol` (turn-level) · the 6 phase skills · `drillme` (gap sweeps at gates) · `skill-advisor` (checkpoints at Phase 2/3 entry).
