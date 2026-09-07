---
parent: decide
name: techniques
description: 5 adversarial techniques applied as synthesis phase across all perspectives post-debate
---

# 5 Adversarial Techniques (Synthesis Phase)

## Contents

- [Overview](#overview)
- [1. Steel-Man First](#1-steel-man-first)
- [2. Assumption Audit](#2-assumption-audit)
- [3. Pre-Mortem](#3-pre-mortem)
- [4. Inversion](#4-inversion)
- [5. Second-Order Effects](#5-second-order-effects)
- [High-Risk Areas (inherited from anti-hallucination)](#high-risk-areas-inherited-from-anti-hallucination)
- [Output Checklist (synthesis phase)](#output-checklist-synthesis-phase)
- [Gotchas](#gotchas)

After Phase 1 (perspectives in parallel) and Phase 2 (cross-debate), the orchestrator synthesizes findings across all perspectives using these 5 techniques. They operate **across** perspectives, not within a single one.

## Overview

| # | Technique | Function in synthesis |
|---|---|---|
| 1 | Steel-Man First | Build the strongest case FOR the decision by combining the pros of all perspectives post-debate. If no strong steel-man can be built, the decision is not defensible |
| 2 | Assumption Audit | List all assumptions surfaced. Classify by likelihood × impact. Flag shared assumptions as suspect (groupthink) |
| 3 | Pre-Mortem | Combine failure modes. Triangulation: if 2+ perspectives predict the same failure → HIGH confidence |
| 4 | Inversion | "What would guarantee the worst outcome?" Check if proposal contains those elements |
| 5 | Second-Order Effects | For Critical findings, trace 2nd-order effects. High stakes: 3rd order |

---

## 1. Steel-Man First

### Definition
Reconstruct the **strongest possible case** for the decision before attacking it. Combine the most credible pros from all perspectives (post-debate).

### Procedure
1. Pull every Pro flagged by any perspective post-debate
2. Discard pros that were retracted or weakened during cross-debate
3. Group surviving pros by theme
4. Compose the steel-man as a single coherent paragraph
5. Ask: "If this paragraph is true, is the decision defensible?" If no → decision fails

### Cross-perspective angle
A steel-man assembled from multiple lenses is stronger than a steel-man from one lens. Look for pros that come from **different lenses pointing the same direction** (those are highest signal).

### Worked example — "Redis vs Memcached" (post-debate)
> Steel-man for Redis: Maintainer cites mature TS clients; Operator confirms Redis is already operated; Product flags pub/sub as a roadmap item arriving in Q3; Performance confirms throughput is well within Redis's envelope. Together: Redis is the lower-marginal-cost choice given existing ops and a future feature that requires it.

If that steel-man cannot be built (because the pros don't survive debate), the decision is not defensible.

### Anti-patterns
| Anti-pattern | Correct version |
|---|---|
| Steel-manning the alternatives, not the decision | Steel-man what the user is proposing, then attack it |
| Listing pros without coherence | A paragraph that, if true, justifies the decision |
| Including retracted pros | Only post-debate, surviving pros |

---

## 2. Assumption Audit

### Definition
Surface every assumption — explicit AND implicit — that the decision rests on. Score by likelihood (how likely it's true) × impact (cost if false).

### Procedure
1. Collect assumptions from each perspective's "Context I needed" and "Invisible assumptions" sections
2. Add assumptions implicit in the proposal text itself (often the most dangerous)
3. Score each: Likelihood (Low/Medium/High true), Impact (Low/Medium/High if wrong)
4. **Flag shared assumptions as suspect** — if every perspective takes the same thing for granted, it might be groupthink
5. Output as a table

### Cross-perspective angle
Assumptions appearing in **only one perspective** are usually the most surfacing. Assumptions appearing in **all perspectives** are most suspect (everyone is operating in the same blind spot).

### Worked example
| Assumption | Likelihood true | Impact if false | Flag |
|---|---|---|---|
| Sessions need to cross instances | Medium | High | shared by all → suspect (groupthink) |
| Already operating Redis | Unknown | High | needs verification |
| Pub/sub needed in 6 months | Medium | Medium | from Product only |
| Fsync stalls won't matter | High | High | from Adversary only |

### Anti-patterns
| Anti-pattern | Correct version |
|---|---|
| Listing only stated assumptions | Look for what is implicitly assumed |
| Not scoring | Likelihood × impact is mandatory |
| Ignoring shared assumptions | Shared = suspect, must flag |

---

## 3. Pre-Mortem

### Definition
"It is 6 months later. The decision failed catastrophically. Tell the story of why." Forces concrete failure modes instead of hand-waving.

### Procedure
1. Set the time: 6 months / 1 year / 2 years (pick by stakes)
2. Pull failure modes already proposed by perspectives
3. **Triangulation**: if ≥2 perspectives predicted the same failure mode, that mode gets HIGH confidence automatically
4. For each surviving mode, name: trigger condition, early warning sign, blast radius
5. Filter out vague doom — every mode must have a specific trigger

### Cross-perspective angle
This is where triangulation does its work. The output of pre-mortem is a list of failure modes, each annotated with how many perspectives predicted it. ≥2 = HIGH; 1 = MEDIUM unless the lens is clearly authoritative for that mode.

### Worked example
| Failure mode | Trigger | Predicted by | Confidence |
|---|---|---|---|
| Sessions lost on Redis restart | persistence off, instance crash | Adversary, Operator | HIGH (triangulated) |
| Fsync stalls under write spike | persistence on, write peak | Adversary, Performance | HIGH (triangulated) |
| Eng-weeks burned with no product gain | nothing on roadmap depends on choice | Product, Linus | HIGH (triangulated) |

### Anti-patterns
| Anti-pattern | Correct version |
|---|---|
| Vague doom ("this might fail") | Trigger + early warning + blast radius |
| Failure mode without confidence | Annotate triangulation count |

---

## 4. Inversion

### Definition
Munger / Jacobi: invert the question. Instead of "how do we succeed?", ask "what would guarantee the worst outcome?". Then check if the proposal contains those elements.

### Procedure
1. Imagine the worst plausible outcome of this decision
2. List the conditions that would guarantee that outcome
3. Check the proposal against each condition: does it have it? does it prevent it?
4. Anything in column 1 that's also in the proposal is an immediate red flag

### Worked example — "Redis vs Memcached"
| Worst-outcome condition | Present in proposal? |
|---|---|
| Choose without measurement | Yes (no numbers cited) |
| Enable persistence without need | Unknown — not specified |
| No rollback plan | Yes (not mentioned) |
| New ops burden unowned | Yes (no on-call story) |

### Anti-patterns
| Anti-pattern | Correct version |
|---|---|
| Generic worst case | Concrete worst case for THIS decision |
| Inversion without checklist | Always produce the table mapping condition → presence in proposal |

---

## 5. Second-Order Effects

### Definition
Beyond the direct outcome, what does this decision **enable** or **prevent** that wasn't asked about?

### Procedure
1. For each Critical finding, ask: "If this is true, what becomes more/less likely 6-12 months from now?"
2. List both positive and negative second-order effects
3. For HIGH stakes only: do the same for 3rd order
4. Watch for compounding effects (where 2nd order amplifies 1st)

### Worked example — choosing Redis
- 2nd-order positive: pub/sub becomes available without a new component → enables notification redesign
- 2nd-order negative: team starts using Redis as a queue → introduces durability assumptions Redis was not chosen for
- 3rd-order (HIGH stakes only): Redis-as-queue creates an outage during fsync stall, on-call burden grows, eventually a real queue (SQS/Kafka) is added anyway → all the cost, none of the avoidance

### Anti-patterns
| Anti-pattern | Correct version |
|---|---|
| Listing only positives | Both directions, especially negatives |
| Speculative effects | Anchor each effect to a concrete trigger |

---

## High-Risk Areas (inherited from anti-hallucination)

When applying these techniques, certain claim types must be verified before being used:

| Area | Bad (don't do) | Good (do) |
|---|---|---|
| API signatures | Quote a function signature from memory | Read source or Context7, then quote |
| Version-specific behaviour | "Postgres 17 has feature X" without check | WebSearch for release notes / Context7 |
| Recent changes | Cite a CVE / library bug from training data | WebSearch (cite URL + date) |
| Benchmark numbers | "Redis is 30% faster" without source | Cite specific benchmark + workload + version |
| Existing code claims | "Function `foo` does X" without reading | Read the file, quote line |

If a claim cannot be verified, it must be marked `UNKNOWN` and the user told what verification is needed. **Never invent.**

---

## Output Checklist (synthesis phase)

Before emitting Phase 3 output, the orchestrator must have:

- [ ] Steel-man as a coherent paragraph (post-debate pros only)
- [ ] Assumption Audit table with Likelihood × Impact + groupthink flag
- [ ] Pre-Mortem table with triangulation counts
- [ ] Inversion table mapping worst-outcome conditions to proposal
- [ ] Second-Order Effects (2nd order minimum; 3rd order if HIGH stakes)
- [ ] Each High-Risk Area claim has been verified or marked UNKNOWN

## Gotchas

| Gotcha | Why | Workaround |
|---|---|---|
| Triangulation can amplify shared bias, not signal | If 11 perspectives share an assumption, agreement is not validation | Always check if the agreed point depends on a shared unverified assumption |
| Steel-man can lock in motivated reasoning | Steel-manning what you already prefer feels like analysis | Steel-man, then immediately apply Adversary's contras to that paragraph |
| Pre-mortem produces too many failure modes | Output becomes noise | Keep top 3-5 by impact; discard low-impact unless clearly likely |
| Second-order effects become speculation | Beyond 2nd order without anchor = creative writing | Each 2nd/3rd order effect must point to a concrete trigger condition |
