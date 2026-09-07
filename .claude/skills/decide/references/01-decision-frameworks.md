---
parent: decide
name: decision-frameworks
description: Reversibility/stakes classification (Bezos Type 1/2 doors) + ADR-style recommendation structure (Nygard) — the canon behind the decide workflow
---

# Decision Frameworks — the canon behind `decide`

Two frameworks survived adversarial verification against primary sources and ground this
skill. Cynefin, RAPID/DACI, weighted/Pugh matrices and cost-of-delay were researched but
did **not** survive verification from reputable primaries — they are deliberately omitted
rather than cited weakly (Commandment II). Use only what is below.

## 1. Classify first: reversibility × stakes (Bezos one-way / two-way doors)

Before scanning options, classify the decision. This is what picks the tier inside
`decide`: the quick 3-perspective scan, or the heavy adversarial stress-test
(`references/heavy/00-heavy-protocol.md`).

| Class | Door | Nature | Process the framework prescribes |
|---|---|---|---|
| **Type 1** | one-way | Consequential AND irreversible / nearly irreversible — you can't get back through the door | "Made methodically, carefully, slowly, with great deliberation and consultation" → the **heavy tier** (adversarial stress-test) |
| **Type 2** | two-way | Changeable / reversible — you can reopen the door and walk back | "Can and should be made quickly by high-judgment individuals or small groups" → **exactly** `decide`'s niche |

> Source: Amazon 2015 Shareholder Letter (Jeff Bezos), SEC-filed primary —
> `https://s2.q4cdn.com/299287126/files/doc_financials/annual/2015-Letter-to-Shareholders.PDF`

**The test (apply literally):** *If we choose this and it's wrong, can we undo it and
re-enter the door at acceptable cost?* Yes → Type 2 → proceed with the 3-perspective scan.
No → Type 1 → run the heavy tier (`references/heavy/00-heavy-protocol.md`), not the quick scan.

**Match rigor to class — this is prescriptive, not optional.** "Type 2 decisions *can and
should* be made quickly." A fast scan on a reversible call is the correct process, not a
shortcut. Running heavyweight rigor on a reversible decision is the primary anti-pattern
(§3).

## 2. Structure the recommendation ADR-style (Michael Nygard, 2011)

The `decide` synthesis (Step 3) and the generated memo should follow the canonical ADR
shape so the *reasoning and trade-offs* are captured, not just the pick. Foreground these
four — Title doubles as the memo's heading/filename:

| Section | What it answers |
|---|---|
| **Status** | proposed / accepted / rejected / deprecated / superseded |
| **Context** | "What is the issue that is motivating this decision or change?" — the forces and constraints at play (problem, not solution) |
| **Decision** | "What is the change we are proposing and/or doing?" — full sentences, active voice: "We will…" |
| **Consequences** | "What becomes easier or more difficult because of this change?" — list **all** of them, positive and negative |

> Sources (primary): Nygard 2011 `https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions`
> · `https://adr.github.io/` · canonical template repo
> `https://github.com/joelparkerhenderson/architecture-decision-record`

**Scope check — is it worth the ADR-style write-up?** Reserve it for *architecturally
significant* decisions: those affecting structure, non-functional characteristics,
dependencies, interfaces, or construction techniques. The whole point is to record the
**why** and the **trade-offs**, so a future reader understands the decision without having
to blindly accept or reverse it. A trivial reversible call needs a one-liner, not an ADR.

## 3. The one verified anti-pattern: over-rigor on a reversible decision

> "As organizations get larger, there seems to be a tendency to use the heavy-weight Type 1
> decision-making process on most decisions, including many Type 2 decisions. The end result
> of this is slowness, unthoughtful risk aversion, failure to experiment sufficiently, and
> consequently diminished invention." — Bezos, 2015 Amazon letter

For `decide`: when the Critic perspective demands more analysis on a clearly reversible,
low/medium-stakes call, name this anti-pattern. The cost of a wrong Type 2 decision is the
cost of walking back through the door — usually small. Bias toward deciding and moving,
flagging the easy reversal path, over gathering more certainty.

> Other commonly-cited pitfalls (analysis paralysis, HiPPO / highest-paid-person's-opinion,
> sunk-cost fallacy) are real but did **not** survive verification in this research pass —
> treat them as folklore here, not cited canon. Add them only if separately sourced.

## How `decide` uses this file

1. **Step 0 (Tier classifier):** classify reversibility × stakes (§1). Type 1 → heavy tier; Type 2 → quick scan.
2. **Step 2 (3 perspectives):** unchanged — Pragmatist / Innovator / Critic.
3. **Step 3 (Synthesize):** shape the recommendation as Status / Context / Decision / Consequences (§2); if Critic over-demands rigor on a reversible call, cite §3.
