---
name: decide
description: |
  Decide entre alternativas técnicas con el nivel de rigor que la decisión merece: tier RÁPIDO (3 perspectivas inline, ~500-800 tokens) para decisiones reversibles, o tier PESADO (stress-test adversarial de 5-12 perspectivas en paralelo con cross-debate, técnicas Steel-Man/Pre-Mortem/Inversion, gate de validación y voto) para decisiones irreversibles o de alto riesgo. Un clasificador de stakes elige el tier al entrar.
  Úsala cuando: hay que elegir entre arquitecturas/librerías/enfoques, "qué opción elijo", "compara alternativas", "trade-offs", o antes de comprometerte con una decisión — "cuestiona esta decisión", "abogado del diablo", "pre-mortem", "estoy seguro de esto".
metadata:
  keywords: >
    Keywords - decide, decision, choose, evaluate, compare, trade-off, pros-cons,
    architecture-decision, stress-test, challenge this decision, devils-advocate, steel-man,
    pre-mortem, antes-de-decidir, cuestiona esta decisión
disable-model-invocation: false
argument-hint: "<decision, question or brief>"
when_to_use: |
  "qué opción elijo", "compara alternativas", "trade-offs", "qué librería uso", "cuestiona esta decisión", "abogado del diablo", "pre-mortem", "challenge this decision", "which library", "evaluate options"
---

# Decide — tiered decision support (031: merged with `decision-stress-test`)

One skill, two tiers. The classifier picks; the user can override either way.

## Underlying principle

> "If everyone is thinking alike, then somebody isn't thinking." — Tenth Man Rule

Sycophancy is the silent killer of engineering decisions. The quick tier builds three
genuinely different lenses into every reversible call; the heavy tier builds
**structural disagreement** (forced dissent, context-isolated Outsider, Linus) into
the ones you cannot cheaply undo.

## Step 0 — Tier classifier (Bezos Type 1/2)

Apply the one-way-door test (`references/01-decision-frameworks.md` §1): *if wrong,
can we undo it at acceptable cost?*

| Answer | Tier | Cost | Shape |
|---|---|---|---|
| Yes — two-way door, reversible, low/medium stakes | **Quick** | ~500-800 tokens | 3 perspectives INLINE, ADR synthesis |
| No — one-way door, irreversible/expensive, high stakes (architecture, framework, schema, money) | **Heavy** | ~2-3K+ tokens, 5-12 subagents | Adversarial stress-test, Phases 1-5 |

Default-on-uncertainty for the heavy tier's internal calibration: Medium stakes.
Skip entirely (no tier) when there is no real decision: mechanical changes, already-committed
choices (post-commitment stress-testing is rationalization), pure debugging, exploratory
"what is X?" questions.

Effort note: this skill pins no `effort:` — the quick tier must stay cheap. When the
heavy tier fires, escalate reasoning for that work (deep-reasoning subagent prompts;
suggest `/effort xhigh` to the user if the session runs low).

## Quick tier (reversible calls)

### 1. Prepare brief
Central question + context + constraints (read the file if the argument is a path).

### 2. Adopt 3 perspectives INLINE — never spawned (1-3 units → inline, spawn tree)
Write all three positions in one pass, each with **Recommendation / Main argument / Pros / Cons / Risks**:
- **Pragmatist** — fastest/safest to implement, minimal technical risk, real cost (time, complexity, debt), maintainability.
- **Innovator** — most elegant/scalable, future doors it opens, the unconventional option nobody considered.
- **Critic** — what goes wrong per option, hidden costs, unverified assumptions, questions to answer BEFORE deciding (may answer "we need more information").

### 3. Synthesize ADR-style (Nygard — `references/01-decision-frameworks.md` §2)
1. **Decision** in active voice ("We will…") · 2. **Context** (forces/constraints) ·
3. **Consequences** — easier AND harder · 4. **Confidence**: high 3/3, medium 2/3, low none ·
5. **Tensions & next steps**. If the Critic over-demands rigor on a clearly reversible
call, name the over-rigor anti-pattern (§3) — bias toward deciding.

### 4. Report
Summary inline. HTML memo only on request, via `html-report` (`templates/decision.template.html` — single visual system, Cmd IX).

## Heavy tier (irreversible / high stakes)

Full protocol in `references/heavy/00-heavy-protocol.md`. Shape:

1. **Triage** (invoker asks 1-4 AskUserQuestion if the decision/alternatives/constraints are unclear) + **framing check** (right problem? Option C? do-nothing evaluated?).
2. **Stakes calibration** → 5/8/11/12 perspectives (`references/heavy/03-stakes-calibration.md`).
3. **Phase 1** — perspectives in parallel subagents (Outsider context-isolated; Linus/Karpathy personas in `prompts/`).
4. **Phase 2** — adaptive cross-debate gated by a Step-back Judge (max 3 cycles; Medium+ only).
5. **Phase 3** — synthesis with the 5 adversarial techniques + triangulation + per-finding anti-hallucination verification gate.
6. **Phase 4** — BLOCKING validation gate (findings/debate/verdict/self-meta; failures reported, never suppressed).
7. **Phase 5** — final recommendation with per-perspective vote, verbatim dissents, consensus level.

Verdict shapes: Proceed / Proceed with conditions / Investigate first / Reject.

## Content map

| Topic | File |
|---|---|
| Bezos Type 1/2 doors + Nygard ADR (both tiers' canon) | `references/01-decision-frameworks.md` |
| Heavy protocol, Phases 1-5 end to end | `references/heavy/00-heavy-protocol.md` |
| 11+1 perspectives: lenses, tools, prompts, examples | `references/heavy/01-perspectives.md` |
| 5 adversarial techniques as synthesis | `references/heavy/02-techniques.md` |
| Stakes calibration matrix + edge cases | `references/heavy/03-stakes-calibration.md` |
| 17 anti-patterns + self-meta audit | `references/heavy/04-anti-patterns.md` |
| Output template + worked example | `references/heavy/05-output-template.md` |
| Cross-debate protocol (Step-back Judge) | `references/heavy/06-cross-debate.md` |
| Outsider / Linus / Karpathy / Step-back personas | `prompts/*.md` |

## Commandments cubiertos

| # | Cómo |
|---|---|
| I | Brief + triage + framing check force understanding before recommending |
| II | Heavy tier: per-finding verification gate; no speculative objections |
| III | Forced dissent (Adversary), verbatim dissents in the vote — the decision is challenged, not validated |
| V | Tier classifier keeps reversible calls at ~500-800 tokens — no over-engineering |
| X | Quick tier inline (no spawns for 1-3 units); heavy tier stakes-calibrated 5-12, never fixed over-spend |

## Related

- `consult` — EXTERNAL second opinion (codex/grok); decide is the internal machinery. High-stakes calls can use both.
- `drillme` — closes information gaps by asking the USER; decide weighs alternatives. Gaps first, decision second.
- `scope` — reuses `references/heavy/01-perspectives.md` and `prompts/outsider-agent.md` for its full mode.
- `html-report` — renders the decision memo on request.
