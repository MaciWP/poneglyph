# Decision memo — Can poneglyph leverage "loops"?

**Source analyzed**: a YouTube marketing video (script) by an "Imperio Agéntico" community, arguing the industry has moved "from prompting to designing loops". Quotes attributed to Boris Cherny ("I no longer prompt, I write loops") and Peter Steinberg.
**Question**: should poneglyph adopt the "loop" pattern the video describes?
**Mode**: research-feature, light ceremony (no spec/tasks/build pipeline — this memo is the deliverable). Precedent: `018-evidence-roadmap/decision-memo-W4.md`.
**Date**: 2026-06-22.

---

> **UPDATE 2026-06-22 (post-memo correction)**: this memo originally claimed `/goal` does not exist
> as a native command — **that was wrong** (Commandment II). `/goal` IS a built-in CC command
> (2.1.139+): it installs a session-scoped Stop hook and keeps the session working turn-by-turn
> until a Haiku evaluator judges the condition met (the evaluator reads the transcript only, it does
> not execute). My earlier check failed because I looked for a `goal.md` file + skill entry; built-in
> commands appear as neither. Direction also shifted: the user asked to **adapt the project** to use
> these commands. Outcome of that work (does NOT change the core verdict below — native adoption, no
> subsystem): playbook `skills/orchestrator-protocol/references/09-loops-playbook.md` + a project-scoped
> `.claude/loop.md`. See that playbook for the full `/goal`+`/loop` mechanics and the video adopt/reject map.

## BLUF — verdict

**Adopt the native loop primitives Claude Code already ships (`/loop`, `schedule`, `ScheduleWakeup`) for a NARROW set of doctrine-compatible cases. Do NOT build a loop subsystem. Build at most a thin documented pattern, and only if a real case demands it.**

Three findings drive this:

1. **The valuable core of the video is real, and poneglyph already implements 3 of its 4 pieces** — more rigorously than the video. The only missing piece (the autonomous recurring *trigger*) is now shipped natively by Claude Code. There is nothing to *build*; there is something to *adopt, scoped*.
2. **The open-ended loop the video sells ("improve forever", model judging itself) is incompatible with poneglyph doctrine AND with the video's own stated "jewel"** (maker ≠ auditor). The doctrine-compatible shape is the *bounded goal-loop with an objectively verifiable stop* (tests pass + lint clean) = Commandment IV.
3. **The current project direction is "prune > add"** (Cmd IX, prune > add — ratified 2026-06-11). A "let's build a loops engine" recommendation rows directly against that decision. This memo therefore biases hard toward native-adoption over construction.

---

## Claim × reality (only load-bearing claims verified — Commandment II)

Marketing claims (4 machines 24/7, ROI 16×, $1M in tokens, the paid "motor agéntico") are **not** load-bearing for "can poneglyph use loops?" and were not investigated.

| Video claim | Reality (this environment) | Confidence |
|---|---|---|
| `/loop` exists, runs a prompt/skill on a recurring interval | **True.** Native skill `loop`: *"Run a prompt or slash command on a recurring interval (e.g. `/loop 5m /foo)`. Omit the interval to let the model self-pace."* | `[Seguro]` — skill list is authoritative |
| A "goal" trigger that runs until a condition is met (`/goal`) | **True — `/goal` is a native built-in (CC 2.1.139+)** [corrected; see UPDATE above]. Session-scoped Stop hook; a Haiku evaluator judges the natural-language condition after each turn, reading the transcript only (does not execute). `/loop` without an interval is the self-paced sibling. | `[Seguro]` — verified via official docs + in-session Stop hook text |
| Automatic triggers: schedule (cron) and event-triggered (webhook/PR) | **True, partially.** Native `schedule` skill = cron cloud agents/routines. `CronCreate/List/Delete` + `RemoteTrigger` exist. Event/webhook triggering is an external-infra concern, not a CLI primitive. | `[Seguro]` for cron; `[Suposición]` for webhook depth — not verified, not needed |
| "DAME": Trigger + Agent(maker) + verifiable Meta + State(E) | Accurate decomposition. It maps cleanly onto poneglyph (next section). | `[Seguro]` |
| The framework's "jewel": the auditor must be a **separate** agent from the maker (self-review is biased — attributed to Addy Osmani) | **Correct, and it is already poneglyph's core doctrine** (builder ≠ reviewer, Four-Eyes, fresh-context reviewer in `critic`). The video validates poneglyph, not the reverse. | `[Seguro]` |
| Cost: a loop spends tokens; today off subscription, tomorrow off API | True and relevant — it motivates the cost guardrail below. The specific $ figures are marketing, unverified. | n/a |

---

## DAME → poneglyph mapping (what already exists)

| DAME piece | Video's version | poneglyph equivalent | Gap? |
|---|---|---|---|
| **D — Trigger** | manual prompt OR schedule/cron/webhook | **MISSING natively in poneglyph** (commands are only `flow`, `role`, `sync-claude`). | **This is the only real gap.** Filled by native `/loop` + `schedule` + `ScheduleWakeup` + `CronCreate`. |
| **A — Agent (maker)** | one agent that produces | `build` skill (inline-first), `Workflow` for ≥4 read-only fan-out | covered, more disciplined |
| **M — verifiable Meta** | bounded (deterministic) vs unbounded (model-judged) | `critic` + blocking quality gates + `/flow` Phase 4 verdict; `tdd-design` oracle | covered, stronger |
| **E — State (out of chat)** | files/JSON/markdown so context-saturation doesn't lose work | `state.json`, `plans/`, `memory/`, the living-spec loop | covered, far stronger |

**poneglyph also already loops internally**: the `Workflow` engine documents `loop-until-count`, `loop-until-budget`, and `loop-until-dry` patterns for fan-out. So "the loop" is not a foreign concept — it exists, bounded and budgeted, inside orchestration.

**Net**: poneglyph has 3/4 DAME pieces, built to a higher bar than the video. The 4th (autonomous recurring trigger) is a Claude Code native primitive, not something to author.

---

## Doctrine tension (the honest part)

The video's headline mode — *leave it running unattended overnight, improving forever, four machines 24/7* — collides head-on with poneglyph's spine:

- **Commandment III (ask before assuming) + IV (blocking human hard gates 1→2, 2→3)**: a fully unattended write-loop bypasses the human gates that are the whole point of `/flow`.
- **Inline-first doctrine (017/US1, evidence-based)**: unattended/delegated build work *empirically degraded quality* in poneglyph's own history (token multiplication, summary degradation at hand-back). An autonomous build-loop re-introduces exactly that failure mode.
- **`prune > add`**: building a bespoke loop engine adds surface area the project has decided to stop adding.

**The sharpest argument is the video against itself**: the video says the framework's jewel is maker ≠ auditor (external verifier, because self-judgment is biased). An *open-ended* loop where the model decides "is it perfect yet? no, keep going" **is the model judging itself** — the exact bias the video warns against. So open loops are not just doctrine-incompatible; they are **internally inconsistent with the video's own principle**. The only loop shape that survives both filters is the **bounded goal-loop with an external, objective stop**.

---

## Doctrine-compatible opportunities (ranked by value / risk)

### ✅ 1 — Goal-loop with a verifiable stop, wrapping build→critic (HIGH value, LOW risk)
The bounded case. Stop condition is objective and external: `bun test ./.claude/hooks/` green **and** lint clean **and** `critic` verdict APPROVED. This is literally Commandment IV expressed as a loop.
- **Mechanism (native, no build)**: `/loop` self-paced (no interval) over a single, well-scoped, *already-gate-approved* HU, stopping on the test/critic signal. Or `ScheduleWakeup` to wait on a background build.
- **Why it's safe**: the human gate happened *before* the loop (spec/tasks approved); the loop only grinds an approved task to a green, machine-checkable bar. Maker (`build`) ≠ auditor (`critic`) is preserved.
- **Note**: this is essentially the philosophy of the retired `best-of-n` pilot (test-selected attempts; archived 031, pattern preserved in `plans/_archive/031-skill-cuts/`) in a sequential loop. Possibly already covered — check before adding anything.

### ✅ 2 — Unattended read-only research/audit loops (MEDIUM-HIGH value, LOW risk)
Re-run a read-only consistency pass or `deep-research` periodically. **Read-only ⇒ no destructive-mutation risk ⇒ no human gate needed** (the gate exists to guard writes). Output is a report the human reads when convenient — the video's own "leave it marked for the morning" use case, minus the write risk.
- **Mechanism (native)**: `schedule`/cron for a daily/hourly routine, or `/loop 1h`.
- **Why it's safe**: nothing is mutated; worst case is wasted tokens, capped by the cost guardrail.

### ✅ 3 — `ScheduleWakeup` to await background work (MEDIUM value, ~ZERO risk)
Already available, zero new surface: poll a CI run / background `Workflow` / remote queue and resume when a condition flips. This is just using a primitive that already exists well.

### 🚫 Anti-recommendations (do NOT do)
- **Open-ended "improve forever" loops that self-judge** — violate maker≠auditor *and* the video's own principle. Reject.
- **Unattended build/write loops without gates** — violate hard gates 1→2/2→3 and re-trigger the inline-first quality regression. Reject.
- **A bespoke poneglyph "loops engine" / `/loop` wrapper command** — rows against `prune > add`; native primitives already cover cases 1–3. Reject unless a concrete case proves the native ergonomics insufficient (then a *thin* documented pattern, not a subsystem).

---

## Guardrails for ANY adopted loop (non-negotiable)
Native primitives already provide the levers — use them:
- **Hard stop**: objective verifiable condition (tests+lint+critic) OR explicit max-iterations/budget. `Workflow` has `budget.total` as a hard ceiling; `ScheduleWakeup` clamps interval to [60, 3600]; `/loop` takes an interval.
- **Scope**: read-only, OR human-gated *before* the loop starts. Never unattended writes.
- **Cost log**: record token spend per loop run (cost discipline — always-loaded costs every turn, on-demand costs once; Cmd IX).
- **Kill switch**: every native loop is cancelable (`/loop` stop, cron delete).

---

## Recommendation & next step

**Recommendation**: leverage the *concept* — yes — by adopting the native primitives for cases 1–3. Build nothing now. The video's contribution to poneglyph is mostly **confirmation** (its "jewel" is already our doctrine), plus a **naming/mental-model** for a pattern we partly already run inside `Workflow` and `/flow`.

**This memo recommends; it does not mutate the system.** If you want to operationalize one case, the cheapest high-value move is **case 1 or 2 as a documented usage pattern** (e.g. a short note in `orchestrator-protocol` or a `/flow` aside), gated by a use-census first per Cmd IX (prune > add). That would be a separate, small `/flow` — not part of this analysis.

**Your call**: which (if any) of cases 1–3 is worth a follow-up? Default if you say nothing: none — the analysis stands as the deliverable.
