---
parent: decide
name: cross-debate
description: Phase 2 protocol — perspectives debate with cited agreement/disagreement; step-back judge decides CONVERGED / PARTIAL / FULL after each round, max 3 cycles
---

# Cross-Debate Protocol (Phase 2)

## Contents

- [Activation](#activation)
- [Setup (Cycle 0)](#setup-cycle-0)
- [Cycle Loop](#cycle-loop)
- [Why Step-back Adapts Better Than Fixed Rounds](#why-step-back-adapts-better-than-fixed-rounds)
- [Updated Position Output Format (per perspective, per round)](#updated-position-output-format-per-perspective-per-round)
- [[Perspective Name] — Updated Position (Cycle N)](#perspective-name-updated-position-cycle-n)
- [Phase 1.5 — Late Perspective](#phase-15-late-perspective)
- [Anti-patterns Specific to Phase 2](#anti-patterns-specific-to-phase-2)
- [Output Section in Final Report](#output-section-in-final-report)
- [Debate Summary](#debate-summary)

## Activation
- Stakes Low → SKIP entire Phase 2
- Stakes Medium → run with step-back judge, max 3 cycles
- Stakes High → run with step-back judge, max 3 cycles

## Setup (Cycle 0)
At Phase 2 start, the orchestrator spawns one additional teammate alongside the perspectives:
- **Step-back Judge** (persona at `${CLAUDE_SKILL_DIR}/prompts/step-back-judge.md`)
- Persists across all cycles within Phase 2

## Cycle Loop

### Round (within a cycle)
1. Each perspective broadcasts its current position to all others
2. Each perspective emits an Updated Position citing:
   - ≥1 specific point of agreement with another perspective
   - ≥1 specific point of disagreement with reasoning
   - Whether its own Position changed and why
   - New pros/contras surfaced

### Step-back Verdict
3. Orchestrator compiles a debate summary and sends to Step-back Judge
4. Step-back Judge returns: CONVERGED / PARTIAL / FULL

### Verdict Processing
- **CONVERGED** → exit loop, proceed to Phase 3
- **PARTIAL** → orchestrator sends targeted re-debate instructions ONLY to the named perspectives. Other perspectives remain at current position. Loop back to Round (next cycle)
- **FULL** → orchestrator broadcasts re-debate instructions to ALL perspectives, including any "Option C" identified. Loop back to Round (next cycle)

### Circuit Breaker
- After 3 cycles without CONVERGED → exit loop, mark Phase 2 as `MAX_CYCLES_REACHED`
- The output Validation Report (Phase 4) flags this as a downgrade signal for confidence

## Why Step-back Adapts Better Than Fixed Rounds
Fixed rounds either over-deliberate (waste tokens when CONVERGED already) or under-deliberate (force exit when FULL re-debate is needed). Step-back lets the system decide based on actual debate quality, not stakes-tier guesses.

## Updated Position Output Format (per perspective, per round)

```
## [Perspective Name] — Updated Position (Cycle N)

**Agreement**: cite ≥1 specific point from another perspective and explain WHY you agree
  - "I agree with [Perspective X] that [point]: [reasoning]"

**Disagreement**: cite ≥1 specific point and explain WHY you don't
  - "I disagree with [Perspective Y] that [point] because [reasoning]"

**Position change**: did your overall Position move? from → to. Why?
  - "My position [stayed/moved] from [X] to [Y] because [reason]"

**New pros/contras surfaced by debate**:
  - [pro/con discovered only after reading others]
```

## Phase 1.5 — Late Perspective

If the debate (or the Step-back Judge) surfaces a fundamental angle that wasn't covered in Phase 1, the orchestrator may spawn **one** late perspective.

| Condition | Required |
|---|---|
| Angle is fundamental, not incremental | Must be a lens, not a sub-question |
| The need emerges from debate, not speculation | Cited by ≥1 perspective in their Updated Position OR named by the Step-back Judge in a FULL verdict |
| Stakes are Medium or High | Low stakes do not trigger Phase 1.5 |
| Only ONE late perspective per stress-test | Cost ceiling |

The late perspective gets the Phase 1 outputs as context and emits a normal perspective output. It does **not** participate in further debate cycles.

---

## Anti-patterns Specific to Phase 2

### Step-back capture (#14)
The judge starts arguing for/against the decision instead of evaluating debate quality. Mitigation: persona prompt is explicit; if symptoms appear, orchestrator discards the verdict and re-prompts the judge with the constraint reminder.

### Cycle thrashing
3 cycles all return PARTIAL on different perspectives → debate is fragmented. Mitigation: at cycle 2, if the previous verdict was PARTIAL on disjoint perspectives, escalate to FULL on the next round.

### Premature CONVERGED
Step-back returns CONVERGED in cycle 1 with 0 position shifts and 0 new findings → likely capture or laziness. Mitigation: orchestrator overrides CONVERGED to PARTIAL if cycle 1 had zero movement.

### Fake debate (no real exchange)
Updated Position does not cite specific points from others. Mitigation: reject and re-prompt; if still fake, mark debate FAILED and downweight triangulation.

### Sycophantic agreement
Multiple perspectives suddenly agree with the proposer's perspective. Mitigation: Adversary gets extra weight in Phase 3.

### Escalating personal tone
Debate becomes about perspectives, not the decision. Mitigation: re-prompt with explicit instruction to engage points, not personas.

### Position oscillation
Same perspective changes position across multiple cycles without new evidence. Mitigation: flag in output; treat that perspective's final position as low-confidence.

### Late perspective spawned speculatively
"Maybe legal would say…" without anyone actually citing legal. Mitigation: Phase 1.5 only spawns when a real perspective in their Updated Position cites the missing angle, or the Step-back Judge names it in a FULL verdict.

---

## Output Section in Final Report

The synthesis output (Phase 3) must include a **Debate Summary** section:

```
## Debate Summary
- Cycles run: [1 / 2 / 3 / max-reached]
- Step-back verdict trajectory: [e.g., FULL → PARTIAL → CONVERGED]
- Perspectives that changed Position: [list]
- New pros surfaced post-debate: [list]
- New contras surfaced post-debate: [list]
- Convergence: [genuine / entrenched / failed / max-reached]
- Phase 1.5 perspective added (if any): [name + reason]
- Core tension (unresolved disagreement): [described in own subsection]
```

If the debate was marked FAILED or `MAX_CYCLES_REACHED`, the synthesis explicitly says so and Phase 4 downgrades confidence one tier.
