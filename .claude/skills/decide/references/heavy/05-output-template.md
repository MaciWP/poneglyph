---
parent: decide
name: output-template
description: Literal output template, scaled by stakes, with 2 worked examples (Low and High)
---

# Output Template

## Contents

- [Literal Template](#literal-template)
- [Stakes Tier](#stakes-tier)
- [Initial Triage](#initial-triage)
- [Framing Check](#framing-check)
- [Phase 1: Perspectives](#phase-1-perspectives)
- [Phase 2: Debate Summary    [Medium+]](#phase-2-debate-summary-medium)
- [Phase 3: Synthesis](#phase-3-synthesis)
- [Tradeoff Map](#tradeoff-map)
- [Triangulated Findings](#triangulated-findings)
- [Core Tension](#core-tension)
- [Decision Guide](#decision-guide)
- [Verdict](#verdict)
- [Confidence Calibration](#confidence-calibration)
- [Phase 4: Validation Report](#phase-4-validation-report)
- [Phase 5: Final Recommendation with Per-Perspective Vote](#phase-5-final-recommendation-with-per-perspective-vote)
- [Outstanding Questions for the User](#outstanding-questions-for-the-user)
- [Scaling by Stakes](#scaling-by-stakes)
- [Worked Example A — Low Stakes (5 perspectives, no debate)](#worked-example-a-low-stakes-5-perspectives-no-debate)
- [Stakes Tier](#stakes-tier)
- [Phase 1: Perspectives](#phase-1-perspectives)
- [Phase 3: Synthesis](#phase-3-synthesis)
- [Verdict](#verdict)
- [Phase 4: Validation Report](#phase-4-validation-report)
- [Phase 5: Final Recommendation with Per-Perspective Vote](#phase-5-final-recommendation-with-per-perspective-vote)
- [Worked Example B — High Stakes](#worked-example-b--high-stakes) (removed 031 — scale Example A per `03-stakes-calibration.md`)
- [Stakes Tier](#stakes-tier)
- [Initial Triage](#initial-triage)
- [Framing Check](#framing-check)
- [Phase 1: Perspectives (abbreviated)](#phase-1-perspectives-abbreviated)
- [Phase 2: Debate Summary](#phase-2-debate-summary)
- [Phase 3: Synthesis](#phase-3-synthesis)
- [Tradeoff Map](#tradeoff-map)
- [Triangulated Findings](#triangulated-findings)
- [Core Tension](#core-tension)
- [Decision Guide](#decision-guide)
- [Verdict](#verdict)
- [Confidence Calibration](#confidence-calibration)
- [Phase 4: Validation Report](#phase-4-validation-report)
- [Phase 5: Final Recommendation with Per-Perspective Vote](#phase-5-final-recommendation-with-per-perspective-vote)

The final stress-test output follows this structure. Sections marked `[High only]` are emitted only when stakes = High (or High with UX). Sections marked `[Medium+]` are emitted for Medium and High.

## Literal Template

```markdown
# Decision Stress-Test: <decision summary>

## Stakes Tier
**Tier**: [Low / Medium / High / High with UX]
**Reasoning**: <1-2 sentences on why this tier>
**Perspectives spawned**: [count + names]
**Debate cycles**: [0 / 1 / 2 / 3 / max-reached]

## Initial Triage
<questions asked + answers received, OR "Skipped — input was sufficient">

## Framing Check
<answer to "are we solving the right problem?", "is there an Option C?">

## Phase 1: Perspectives

### [Perspective 1 name]
**Position**: [...]    **Confidence**: [0-100]
#### Pros
- ...
#### Contras
- ...
#### Context I needed
- ...
#### Questions for the user (if any)
- ...

### [Perspective 2 name]
... (same structure)

(repeat for all spawned perspectives)

## Phase 2: Debate Summary    [Medium+]
- Cycles run: [1 / 2 / 3 / max-reached]
- Step-back verdict trajectory: [e.g., FULL → PARTIAL → CONVERGED]
- Perspectives that changed Position: [list]
- New pros surfaced post-debate: [list]
- New contras surfaced post-debate: [list]
- Convergence: [genuine / entrenched / failed / max-reached]
- Phase 1.5 perspective added (if any): [name + reason]

## Phase 3: Synthesis

### Steel-Man (post-debate)
<coherent paragraph; if cannot be built → "STEEL-MAN FAILED — decision is not defensible">

### Assumption Audit
| Assumption | Likelihood true | Impact if false | Flag |
|---|---|---|---|
| ... | ... | ... | ... |

### Pre-Mortem    [Medium+]
| Failure mode | Trigger | Predicted by | Confidence |
|---|---|---|---|
| ... | ... | ... | ... |

### Inversion    [High only]
| Worst-outcome condition | Present in proposal? |
|---|---|
| ... | ... |

### Second-Order Effects    [High only]
- 2nd-order positive: ...
- 2nd-order negative: ...
- 3rd-order (HIGH stakes only): ...

## Tradeoff Map

| Dimension | Option A | Option B | Weight | Confidence |
|---|---|---|---|---|
| <e.g., latency> | <pro/con summary> | <pro/con summary> | <N perspectives flagged> | <HIGH/MEDIUM/LOW> |
| <e.g., ops complexity> | ... | ... | ... | ... |
| <e.g., cost> | ... | ... | ... | ... |

**Weight** = number of perspectives that flagged this dimension as material to the decision.
**Confidence** = HIGH if triangulated by ≥2 perspectives; MEDIUM if 1 perspective with verified evidence; LOW otherwise.

## Triangulated Findings
<findings flagged HIGH because ≥2 perspectives reported the same point>

## Core Tension
<the single unresolved disagreement, if any. THIS IS THE INSIGHT.>
<If debate failed: explicitly note "no core tension surfaced — debate was entrenched/failed">

## Decision Guide
| If <condition> → | Then <recommendation> |
|---|---|
| ... | ... |

## Verdict
**Recommendation**: [Proceed / Proceed with conditions / Investigate first / Reject]
**One-line summary**: <1 sentence>
**Concrete next steps**:
1. ...
2. ...

## Confidence Calibration
**Overall confidence**: [HIGH / MEDIUM / LOW / UNKNOWN]
**Key assumptions** (if these break, verdict changes):
- ...
**Conditions invalidating verdict**:
- ...
**Monitoring signals** (watch these post-decision):
- ...

## Phase 4: Validation Report
**4.1 Findings Validation**: [PASS / FAIL — reason]
**4.2 Debate Validation**: [PASS / FAIL — reason / N/A if Low stakes]
**4.3 Verdict Validation**: [PASS / FAIL — reason]
**4.4 Self-Meta Check** (5-question audit):
- [ ] Steel-Man genuinely strong
- [ ] No vague doom
- [ ] Real diversity across perspectives
- [ ] Outsider stayed isolated
- [ ] Debate produced movement (or failure honestly reported)

**4.5 Overall Gate**: [PASS / FAIL]
**Confidence downgrade applied**: [yes (HIGH→MEDIUM) / no]

## Phase 5: Final Recommendation with Per-Perspective Vote

### Recommendation (drafted from Phase 3 + Phase 4)
<1-2 paragraph crisp recommendation with concrete next steps>

### Vote Tally
| Perspective | Vote | Reason (verbatim) |
|---|---|---|
| Outsider | [SUPPORT/OPPOSE/CONDITIONAL/ABSTAIN] | "..." |
| Adversary | ... | "..." |
| (one row per spawned perspective) | ... | "..." |

### Dissenting reasons (verbatim, not summarized)
<each OPPOSE / CONDITIONAL reason transcribed exactly as the perspective wrote it>

### Consensus Level (qualitative)
**Level**: [Strong consensus / Mixed / Weak consensus / No consensus]
**Computed from**: <X SUPPORT / Y CONDITIONAL / Z OPPOSE / W ABSTAIN out of N (excluding step-back judge)>

### Decision Confidence Score (numeric)
| Signal | Value | Interpretation |
|---|---|---|
| Panelist consensus | <N>/<total> SUPPORT (<%>) | <strong/moderate/weak> |
| Confidence spread | <min>%–<max>% (Δ <delta>%) | <narrow/moderate/wide> |
| Position shifts during debate | <N> of <total> perspectives | <stable/healthy/volatile> |
| Cycles to converge | <N> of 3 | <fast/normal/slow/max-reached> |
| Step-back trajectory | <[verdict sequence]> | <smooth/recovered/contested> |

**Final Decision Confidence**: <0-100>%
> Interpretation: >80% strong / 50-80% moderate / <50% contested

### Final verdict (after consensus interaction)
<verdict tag, possibly downgraded based on Phase 4 + Phase 5 interaction>

## Outstanding Questions for the User
1. ...
```

---

## Scaling by Stakes

| Section | Low | Medium | High |
|---|---|---|---|
| Stakes Tier | yes | yes | yes |
| Initial Triage | yes if asked | yes if asked | yes if asked |
| Framing Check | optional | yes | yes |
| Phase 1 (perspectives) | 5 | 8 | 11 (or 12) |
| Phase 2 Debate | omit | yes (max 3 cycles, step-back judge) | yes (max 3 cycles, step-back judge) |
| Steel-Man | yes | yes | yes |
| Assumption Audit | yes | yes | yes |
| Pre-Mortem | omit | yes | yes |
| Inversion | omit | omit | yes |
| Second-Order | omit | omit | yes |
| Tradeoff Map | omit | yes | yes |
| Triangulated Findings | omit | yes | yes |
| Core Tension | omit | yes | yes |
| Decision Guide | optional | yes | yes |
| Verdict | yes | yes | yes |
| Confidence Calibration | brief | full | full |
| Phase 4 Validation Report | mandatory | mandatory | mandatory |
| Phase 5 Final Recommendation Vote | mandatory | mandatory | mandatory |

---

## Worked Example A — Low Stakes (5 perspectives, no debate)

**Input**: "Should the new pytest fixture have scope=`session` or scope=`function`?"

```markdown
# Decision Stress-Test: pytest fixture scope=session vs function

## Stakes Tier
**Tier**: Low
**Reasoning**: Reversible per fixture, no public surface, isolated change.
**Perspectives spawned**: 5 (Outsider, Adversary, Maintainer, Simplifier, Linus)
**Debate cycles**: 0 (Low stakes — Phase 2 skipped)

## Phase 1: Perspectives

### Outsider
**Position**: conditional / **Confidence**: 60
#### Pros
- Both scopes work. The choice is local.
#### Contras (Minor)
- The framing assumes the fixture should be reused. If it should be deterministic, scope=function is the only safe answer.
#### Naive questions
- What is the fixture? Does it carry state across tests?

### Adversary
**Position**: against scope=session if state mutates / **Confidence**: 80
#### Pros
- scope=session is faster
#### Contras (Major if mutable state)
- Test contamination — most painful failure mode in test suites
#### Mitigation
- Use scope=function unless the fixture is read-only

### Maintainer
**Position**: scope=function / **Confidence**: 75
#### Pros
- Most predictable; new contributors won't be surprised
#### Contras (Minor)
- Slower

### Simplifier
**Position**: scope=function / **Confidence**: 80
#### What's added that the problem doesn't strictly require
- The decision itself: pytest's default IS function-scope. Choosing scope=function is choosing the default — not adding anything. Choosing session is adding a non-default behavior plus an implicit read-only contract.
#### Simplest version that could work
- Use the default. Document the reason inline if non-obvious. Promote to session only if a measurement justifies it.

### Linus
**Position**: scope=function / **Confidence**: 90
#### What I'd actually do
"Default to function. Promote to session ONLY if you've measured a real cost AND the fixture is provably read-only."

## Phase 3: Synthesis

### Steel-Man (for scope=session)
The fixture is read-only and tests are slow enough that session scope is measurable wins; team understands the contract.

### Assumption Audit
| Assumption | Likelihood true | Impact if false | Flag |
|---|---|---|---|
| Fixture is read-only | unknown | High (test contamination) | needs verification |

## Verdict
**Recommendation**: Proceed with scope=function unless fixture is provably read-only AND speedup is measured.
**Confidence**: HIGH

## Phase 4: Validation Report
**4.1 Findings Validation**: PASS
**4.2 Debate Validation**: N/A (Low stakes — no debate)
**4.3 Verdict Validation**: PASS — verdict is actionable; "scope=function unless read-only AND speedup measured"
**4.4 Self-Meta Check**:
- [x] Steel-Man strong
- [x] No vague doom
- [x] Real diversity
- [x] Outsider isolated
- [x] N/A (no debate)

**4.5 Overall Gate**: PASS
**Confidence downgrade applied**: no

## Phase 5: Final Recommendation with Per-Perspective Vote

### Recommendation
Default the new fixture to `scope=function`. Promote to `scope=session` only if the fixture is provably read-only AND a measured speedup justifies it.

### Vote Tally
| Perspective | Vote | Reason |
|---|---|---|
| Outsider | SUPPORT | "Conservative default; honest about the unknown" |
| Adversary | SUPPORT | "Test contamination risk avoided" |
| Maintainer | SUPPORT | "New contributors won't be surprised" |
| Simplifier | SUPPORT | "Choosing the default is choosing nothing extra" |
| Linus | SUPPORT | "Default to function. Promote only with measurement. Correct." |

### Dissenting reasons
None.

### Consensus level
**Level**: Strong consensus (5/5 SUPPORT)

### Decision Confidence Score
N/A for Low stakes — no debate cycles, no step-back judge. Confidence derived from Phase 4 Validation result and Phase 5 unanimity.
**Final Decision Confidence**: 92% (5/5 SUPPORT, all HIGH-confidence findings, Phase 4 PASS)

### Final verdict (after consensus interaction)
Proceed with `scope=function`. Confidence remains HIGH.
```

---

## Worked Example B — High Stakes

Removed (031 content cut): scale Example A up per the Phase tables and `03-stakes-calibration.md` for Medium/High — the structure is identical, only perspective count, debate rounds and technique coverage grow.
