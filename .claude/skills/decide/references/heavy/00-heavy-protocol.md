---
parent: decide
---

# Heavy tier — adversarial stress-test protocol (Phases 1-5)

The full mechanics of `decide`'s heavy tier (formerly the standalone `decision-stress-test` skill, merged in 031). The SKILL.md holds the tier classifier and the summary tables; this file holds the phase-by-phase protocol. Everything else stays in the sibling references — this file points, it does not restate.

## Initial triage

If the input is ambiguous, the **invoker** (the Lead) asks 1-4 `AskUserQuestion` calls BEFORE Phase 1 — subagents cannot ask the user; they include questions in their output and the invoker consolidates. Ask only what is missing: the exact decision (pick one of N) · alternatives on the table · reversibility/time horizon · constraints (budget, deadline, team, compliance). If the conversation already has the context, skip the triage.

## Stakes calibration

| Stakes | Perspectives | Step-back judge | Techniques |
|---|---|---|---|
| Low | 5 (Outsider + Adversary + Maintainer + Linus + Simplifier) | OFF (no Phase 2) | Steel-Man + Assumption Audit |
| Medium | 8 (+ Performance + Operator + Cost Optimizer) | ON (max 3 cycles) | + Pre-Mortem |
| High | 11 (+ Security + Product + Karpathy) | ON (max 3 cycles) | All 5 |
| High with UX | 12 (+ User) | ON (max 3 cycles) | All 5 |

Default-on-uncertainty: **Medium**. Criteria + 6 worked classifications: `03-stakes-calibration.md`.

## Framing check (30 seconds, before spawning)

1. Are we solving the right problem? 2. Is there an Option C nobody considered? 3. Is "do nothing" already evaluated? Output the answers in the report.

## Phase 1 — perspectives in parallel

Spawn N perspectives (per stakes tier) as subagents in **parallel** — single message, N calls. Lenses, tool restrictions and prompt sources: `01-perspectives.md` (Outsider is context-isolated by construction: input only, NO Read/Grep/Web — its prompt is `../../prompts/outsider-agent.md`; Linus and Karpathy personas live in `../../prompts/` too). Each perspective emits: Position, Confidence, Pros, Contras with severity, Context I needed, Questions.

## Phase 2 — cross-debate with Step-back Judge (Medium+)

The judge (persona: `../../prompts/step-back-judge.md`) NEVER takes positions; after each round it returns `CONVERGED` (exit to Phase 3), `PARTIAL` (targeted re-debate to named perspectives) or `FULL` (broadcast re-debate). Circuit breaker: max 3 cycles → `MAX_CYCLES_REACHED` (Phase 4 downgrades confidence). Full protocol, thrashing prevention, premature-CONVERGED override: `06-cross-debate.md`.

## Phase 3 — synthesis with the 5 adversarial techniques

Steel-Man First · Assumption Audit (Likelihood × Impact, shared assumptions flagged) · Pre-Mortem · Inversion · Second-Order Effects (3rd order if High). Applied ACROSS the post-debate outputs. Detail: `02-techniques.md`.

**Triangulation**: ≥2 perspectives independently surfacing the same finding → HIGH confidence, annotated `[triangulated by N]`. Caveat: triangulation can amplify shared bias (Assumption Audit groupthink flag; anti-pattern #8 in `04-anti-patterns.md`).

**Verification gate** (per finding, before it enters the output): Glob for file claims, Grep/Read for function/pattern claims, Context7/WebSearch for version/CVE/benchmark claims, LSP hover for signatures. Unverifiable → tag `UNKNOWN` + state what verification is needed. Confidence tags: HIGH (tool-verified or triangulated) / MEDIUM (informed inference) / LOW (bare inference) / UNKNOWN.

## Phase 4 — validation (blocking quality gate)

| Sub-gate | Pass criterion |
|---|---|
| 4.1 Findings | Every HIGH finding cites tool output or `[triangulated by N]`; every UNKNOWN names the missing verification |
| 4.2 Debate | ≥1 Position change OR ≥2 new pros/contras OR debate honestly marked FAILED |
| 4.3 Verdict | ≥1 concrete next step; ≥2 measurable monitoring signals; ≥1 named invalidating condition |
| 4.4 Self-meta | 5-question audit: Steel-Man genuinely strong · no vague doom · real diversity · Outsider stayed isolated · debate produced movement |
| 4.5 Gate | Any failure → `Validation Report` block naming it + verdict confidence downgraded one tier |

Silent suppression of a failed sub-check is anti-pattern #12 — failure-to-report is itself a failure (Commandments III, IV).

## Phase 5 — final recommendation with per-perspective vote

Draft recommendation → broadcast to the SAME perspectives (no new spawns) → each votes `SUPPORT`/`OPPOSE`/`CONDITIONAL` (names the condition)/`ABSTAIN` (names what's missing) with a 1-2 sentence reason → tally + **verbatim** dissents (paraphrasing dissent is anti-pattern #13) → consensus level: Strong (≥80% SUPPORT) / Mixed (50-80%, no OPPOSE) / Weak (50-80% with OPPOSE) / None (<50%). The Step-back Judge does NOT vote. If Phase 4 already downgraded confidence AND Phase 5 returns weak/no consensus → downgrade a second tier and reframe as "Investigate first" with the dissents as the questions.

## Output

Structured report scaled by stakes (Low omits Pre-Mortem/Inversion/Second-Order; Medium omits Inversion/Second-Order). Literal template + worked example: `05-output-template.md`. Anti-pattern catalog (17): `04-anti-patterns.md`.
