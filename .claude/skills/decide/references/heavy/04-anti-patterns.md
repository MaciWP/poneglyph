---
parent: decide
name: anti-patterns
description: 17 anti-patterns of adversarial reasoning and multi-perspective debate, with detection and correction
---

# Anti-Patterns

## Contents

- [The 17 Anti-Patterns](#the-17-anti-patterns)
- [Detection Reference Table](#detection-reference-table)
- [Self-Meta Check](#self-meta-check)

The following anti-patterns degrade the value of the stress-test. Each has a detection signal and a correction. Self-Meta Check at the end of the workflow audits against this list.

## The 17 Anti-Patterns

### 1. Contrarianism for its own sake
**Detection**: Adversary disagrees with everything regardless of merit; positions are uniformly negative; no Pro is acknowledged even when the evidence is clear.
**Correction**: Disagree only when there is a specific, concrete reason. Acknowledge real merits before challenging.

### 2. Nihilism
**Detection**: Output reduces to "everything is risky, do nothing"; no actionable verdict; no prioritization.
**Correction**: Stress-test must end in a verdict. Even "Investigate first" is a directional verdict with concrete next steps.

### 3. Straw-manning
**Detection**: A perspective attacks a weakened or fictional version of the proposal that the user did not put forward.
**Correction**: Quote the proposal verbatim before critiquing it. Steel-man comes before attack.

### 4. Reverse confirmation bias
**Detection**: Disagreement gets louder when evidence supports the proposal; evidence is dismissed because it would require changing position.
**Correction**: Each perspective must update its Position when faced with strong evidence in cross-debate, or explicitly explain why the evidence is insufficient.

### 5. Vague doom
**Detection**: "This might fail" / "edge cases will appear" without specific trigger, blast radius, or detection signal.
**Correction**: Every failure mode names: trigger condition, early warning sign, blast radius. If you can't, drop the failure mode.

### 6. Personality critique
**Detection**: Output critiques the proposer rather than the proposal ("the user clearly doesn't understand X"); attribution of motives.
**Correction**: Engage the technical content. The proposer is not in the room; only the proposal is.

### 7. Objection without alternative
**Detection**: Cons stack up but no alternative is offered; the user is left with "don't do this" and no path forward.
**Correction**: Every Critical/Major contra must come with at least one alternative or mitigation. Adversary perspective specifically must propose alternatives.

### 8. Groupthink across perspectives
**Detection**: The N spawned perspectives produce nearly identical outputs; no real diversity; everyone shares the same blind spots.
**Correction**: The Outsider perspective is the canary here — if Outsider also agrees with everyone, the framing is probably contaminated. Spawn Phase 1.5 with a deliberately orthogonal perspective if this happens. The Self-Meta Check verifies real diversity.

### 9. Outsider contamination
**Detection**: The Outsider perspective references specific files, functions, classes, project history, or "best practices" the user mentioned — meaning it absorbed context it should not have.
**Correction**: Outsider's prompt restricts tools to NONE (no Read/Grep/Glob/Context7/WebSearch). The orchestrator does not pass project files to it. If Outsider's output contaminates, discard and re-spawn with the explicit restriction reinforced.

### 10. Linus caricature
**Detection**: Linus output is insults, all-caps rants, gratuitous swearing; opinion without technical analysis; sounds like parody.
**Correction**: Linus must be **pragmatic-brutal WITH technical analysis**. The persona is sharp engineering judgment, not a costume. The prompt has explicit BAD/GOOD examples; if the output is BAD, reject and re-spawn.

### 11. Fake debate
**Detection**: Phase 2 produces Updated Positions where no perspective changed Position, no perspective cited specific points from another perspective, and no new pros/contras were surfaced. The debate was theatre.
**Correction**: Mark the debate FAILED in the synthesis output. Investigate cause: stakes might be miscalibrated (perspectives are redundant), prompts might be too generic, or the decision is genuinely uncontroversial. Triangulation is downweighted when debate fails.

### 12. Failure-to-report validation failure
**Detection**: Phase 4 internally detected a failed sub-check (4.1, 4.2, 4.3, or 4.4) but the final output's Validation Report shows PASS, or the Validation Report is missing entirely.
**Correction**: Phase 4 is a blocking gate. Any failed sub-check **must** appear explicitly in the Validation Report block of the output, with reason. The verdict confidence must be downgraded one tier when any sub-check fails. Silent suppression violates Commandment III (radical honesty) and Commandment IV (blocking gates).

### 13. Suppressed dissent
**Detection**: The Phase 5 vote tally shows unanimous SUPPORT, but the upstream Phase 1/2/3 outputs contain explicit reservations or contradictions from one or more perspectives that are not reflected in any OPPOSE / CONDITIONAL vote. OR: dissenting reasons are paraphrased / softened rather than transcribed verbatim. OR: the consensus level is reported as "Strong" when the underlying numbers say otherwise.
**Correction**: Phase 5 votes must be transcribed exactly as the perspective produced them. CONDITIONAL and OPPOSE reasons appear verbatim in the Dissenting Reasons block. Consensus level is computed mechanically from the tally, not editorialized. If a perspective's earlier output contradicts its Phase 5 vote, the orchestrator must surface the contradiction in the report and ask the perspective to reconcile (one extra round if stakes High; otherwise flag and lower confidence). Suppressing dissent to manufacture consensus violates Commandment III (radical honesty).

### 14. Step-back capture
**Detection**: The Step-back Judge's output starts arguing for or against the decision instead of evaluating debate quality. Symptoms: "I think Option A is better", recommendations on the decision, evidence quoted in support of a position. The judge is no longer at meta level — it has been absorbed by the framing.
**Correction**: Persona prompt forbids it explicitly with stop-and-reset instructions. Orchestrator discards captured verdicts and re-prompts the judge with the constraint reminder. If a 2nd capture occurs in the same Phase 2, mark Phase 2 as `JUDGE_CAPTURED` and downgrade confidence in Phase 4.

### 15. Karpathy/Linus voice collapse
**Detection**: Karpathy's output and Linus's output sound the same — both brutal, both destructive, both reaching the same conclusion via the same argument. The distinct voices have collapsed into one. Symptom: removing the names from both outputs yields indistinguishable text.
**Correction**: Karpathy's output must include both addenda ("What an LLM agent would struggle with here", "What I'd actually build first") and lean constructive. Linus's output stays brutal-pragmatic. If they sound the same, re-spawn Karpathy with the persona's anti-pattern reminder.

### 16. Simplifier nihilism
**Detection**: Simplifier's output reduces to "delete everything" / "you don't need this" without a working alternative. The lens collapses to anti-everything.
**Correction**: Every Simplifier critique must include the "Simplest version that could work" addendum with a concrete description of what would replace the proposal. If Simplifier truly believes the entire proposal is unjustified, it must produce the minimal alternative that still solves the underlying problem.

### 17. Cost Optimizer false economy
**Detection**: Cost Optimizer recommends cuts that affect security, reliability, correctness, or compliance to save trivial amounts. Symptom: pennies prioritized over critical dimensions.
**Correction**: Cost Optimizer's output must cite the dimension affected by each cut (security/reliability/correctness/compliance/perf). Cuts touching critical dimensions must be flagged with explicit risk acknowledgment, not just dollar savings. The Steel-Man for keeping the cost must be considered before recommending the cut.

---

## Detection Reference Table

| Signal | Anti-pattern | Where to look |
|---|---|---|
| All cons, no pros | #1 Contrarianism | Adversary output |
| No verdict | #2 Nihilism | Final output |
| Misquoted proposal | #3 Straw-manning | Per-perspective Pros/Contras |
| Position never updates | #4 Reverse confirmation | Updated Positions across rounds |
| "X could fail" without specifics | #5 Vague doom | Pre-Mortem section |
| "the user thinks…" | #6 Personality critique | Any perspective |
| Cons without mitigations | #7 Objection without alternative | Adversary, Maintainer outputs |
| Perspectives are nearly identical | #8 Groupthink | Cross-perspective comparison |
| Outsider mentions `apps/foo.py` | #9 Outsider contamination | Outsider output |
| Linus uses insults / all-caps | #10 Linus caricature | Linus output |
| 0 position changes + 0 new findings | #11 Fake debate | Phase 2 round outputs |
| Failed sub-check + missing/PASS Validation Report | #12 Failure-to-report | Final output |
| Unanimous SUPPORT inconsistent with upstream Phase 1-3 reservations / paraphrased dissent | #13 Suppressed dissent | Phase 5 vote tally + dissent block |
| Judge takes position on decision | #14 Step-back capture | Step-back verdict output |
| Karpathy and Linus produce indistinguishable text | #15 Voice collapse | Compare both outputs side-by-side |
| "Delete everything" without alternative | #16 Simplifier nihilism | Simplifier output |
| Cost cut affecting security/reliability/correctness | #17 Cost Optimizer false economy | Cost Optimizer output |

## Self-Meta Check

Before proceeding to Phase 5, the orchestrator runs this 5-question audit:

1. **Steel-Man genuinely strong?** Could a thoughtful supporter of the decision read the steel-man and feel it represents their case? If no → too weak, redo.
2. **No vague doom?** Every Critical/Major finding has trigger + evidence + mitigation? If no → fix.
3. **Real diversity?** Do the perspectives actually disagree on something, or did they all agree (groupthink)? If groupthink → flag in output, lower confidence.
4. **Outsider stayed isolated?** No file paths, no class names, no "as we know from this codebase". If contaminated → re-spawn or mark perspective FAILED.
5. **Debate produced movement?** At least 1 Position changed OR ≥2 new pros/contras surfaced. If neither → mark debate FAILED, downweight triangulation.

If any of the 5 fails, the output explicitly notes which check failed and why. Honest failure reporting is mandatory; silent suppression of failed checks is itself an anti-pattern (failure-to-report).
