---
parent: decide
name: stakes-calibration
description: Stakes matrix mapping Low/Medium/High to perspective count, step-back judge activation, and techniques applied
---

# Stakes Calibration

The cost of stress-testing is real (subagent spawns + adaptive debate cycles gated by the step-back judge). Stakes calibration ensures the process scales with the actual cost of being wrong.

## Calibration Matrix

| Stakes | Reversibility | Time horizon | Perspectives | Step-back judge | Techniques |
|---|---|---|---|---|---|
| Low | Fully reversible | Hours / days | 5 (Outsider + Adversary + Maintainer + Linus + **Simplifier**) | OFF (no Phase 2) | Steel-Man + Assumption Audit |
| Medium | Reversible with effort | Days / weeks | 8 (+ Performance + Operator + **Cost Optimizer**) | ON (max 3 cycles, adaptive) | + Pre-Mortem |
| High | Irreversible or near-irreversible | Months+ | 11 (+ Security + Product + **Karpathy**) | ON (max 3 cycles, adaptive) | All 5 |
| High with UX | Same as High AND public surface affected | Months+ | 12 (+ User) | ON (max 3 cycles, adaptive) | All 5 |

### Why these escalation steps

- **Simplifier in Low**: anti-overengineering is universal (Commandment V). Simplification pressure applies even to trivial decisions — choosing the default over the elaborate option costs nothing and catches accidental complexity early.
- **Cost Optimizer in Medium**: cost matters when there is real impact on production / infra / eng-time. Not relevant in purely local decisions (covered by Low stakes' lens already), but the moment a decision involves paid services, third-party deps, or non-trivial eng-weeks, cost is a first-class lens.
- **Karpathy in High**: pairs with Linus as a second persona with a complementary voice (constructive vs destructive, build-observe-iterate vs talk-is-cheap). The cost of an extra persona is justified only on architectural decisions where AI-readability, modern stack pragmatism, and Software 2.0 boundary all matter.

## Stakes Classification Criteria

The orchestrator classifies stakes using the following rules. **If any High criterion fires, stakes are High** (any single signal escalates).

| Signal | Tier |
|---|---|
| Architectural choice (database, queue, framework, language) | High |
| Public API contract change | High |
| Security/auth/crypto-relevant | High |
| Migration of production data | High |
| Library/framework choice that's hard to swap | High |
| Module-internal pattern decision | Medium |
| Library used in one place, easy to swap | Medium |
| Code style / naming / file layout | Low |
| Test fixture choice | Low |
| Local tooling / dev convenience | Low |

## Edge Cases

### Irreversible-but-small
A small decision that creates a public commitment (e.g., a new endpoint name in v1 of an external API). Treat as **High** even if the surface is tiny — the irreversibility dominates.

### Reversible-but-expensive
A reversible choice whose unwind cost is significant (e.g., a 2-week migration to undo). Treat as **Medium minimum**, escalate to High if unwind > 1 sprint.

### Repeated low-stakes choices that compound
A pattern decision (e.g., naming convention) that will be applied 100 times. Each application is Low, but the aggregate is Medium-High. Stress-test the pattern itself at Medium, not each instance.

### Stakes uncertain from input
If the orchestrator cannot classify confidently from the input, the **Initial Triage** asks the user. Default-on-uncertainty is **Medium**, not High — High has a real cost and we don't pay it on speculation.

## 6 Worked Examples

| Decision | Stakes | Why | Perspectives |
|---|---|---|---|
| `pytest` fixture scope: `session` vs `function` | Low | Reversible per fixture, no public surface | 5 |
| Naming convention for new domain (`UserProfile` vs `Profile`) | Low → Medium | Low if used in 1 file; Medium if it's a pattern | 5 or 8 |
| Library choice for HTTP client (httpx vs requests) | Medium | Reversible with effort; no public contract | 8 |
| Cache layer: Redis vs Memcached | Medium | Reversible with effort; introduces ops cost | 8 |
| Postgres → DynamoDB migration | High | Architectural, near-irreversible, ops impact | 11 |
| New `/api/v1/users` schema | High with UX | Public contract, consumers depend on it | 12 |

## How the Orchestrator Uses This

1. After Initial Triage, orchestrator selects stakes tier
2. Spawns the corresponding number of perspectives (Phase 1)
3. Runs Phase 2 with the Step-back Judge (max 3 adaptive cycles), or skips it for Low stakes
4. Applies the corresponding techniques in synthesis (Phase 3)
5. Stakes tier is logged in the output for transparency (the user can challenge it)

## Anti-Patterns

| Anti-pattern | Why | Correct version |
|---|---|---|
| Always run 11/12 perspectives "to be thorough" | Burns budget on Low stakes; trains user to ignore the skill | Calibrate honestly to the actual stakes |
| Run the minimum to save tokens | Misses signal on High stakes | If the criteria say High, run High |
| Hide stakes tier in output | User can't challenge the calibration | Always print stakes tier + reasoning at the top |
| Treat "I'm not sure" as High | Speculation inflates cost | Default to Medium when uncertain; ask the user via Triage |
