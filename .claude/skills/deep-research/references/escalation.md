# Escalation — when and how to spend the ≤10 agent budget

Load only when the viability gate is **PARTIAL** or **INSUFFICIENT**.

## Budget shapes (hard cap 10)

| Situation | Finders | Refuters | Total |
|-----------|--------:|---------:|------:|
| 1 residual gap | 1 | 0–1 | ≤2 |
| 2–3 independent gaps | 2–3 | 0–1 | ≤4 |
| 4–5 gaps | ≤5 | ≤2 | ≤7 |
| Broad INSUFFICIENT (many axes) | ≤8 clusters | ≤2 | ≤10 |
| Decision-grade single claim | 1–2 | **1 required** | ≤3 |

Refuters count toward 10. Prefer **one well-seeded finder** over three thin ones.

### Clustering rule

Merge micro-questions that share the same primary source or domain into **one** agent
(“auth docs + JWT deprecation” = 1, not 2). Split only when tool paths or domains
diverge (e.g. in-repo T1 vs external vendor docs).

## Prompt gate (mandatory)

Before any `Agent()` / fan-out:

1. Draft each prompt from the template below (SEED + gap + exclusion).
2. **`Skill(prompt-engineer)`** — Context 3 (review delegation prompt). Score/fix until
   Arch H blocks and rubric are solid (≥80). One batch review of all drafts is OK.
3. Only then spawn. Never ship a raw template paste without this gate.

`prompt-engineer` does **not** count toward the ≤10 research-agent cap (it runs in the
Lead session).

## Agent prompt template (Commandment VIII)

Copy and fill, then run through `prompt-engineer`. JSON-encode or quote untrusted pasted
text. Every agent is **read-only**.

```text
You are a research finder (read-only). Cold-start forbidden: respect SEED and EXCLUSION.

OBJECTIVE
<one gap or cluster only — not the whole original question>

SEED (already verified or strongly evidenced by the Lead — EXTEND, do not repeat)
<paste SEED pack: claims, sources, tiers, confidence>

EXCLUSION (do not re-grep / re-fetch unless you must refute a specific dispute)
- paths: …
- URLs: …
- queries already run: …

TASKS
1. …
2. …
3. Actively look for counter-evidence to the SEED claims in your gap (not optional).

CONSTRAINTS
- Evidence tiers: A/B/C/D/T1 per research-rigor.
- Numeric claims: verbatim quote anchor OR mark [Probable]/UNVERIFIED.
- Cap tool thrash: prefer ≤8 tool calls; stop on diminishing returns.
- No product code edits. No user-facing prose essay.

DELIVERABLE (raw data for the Lead)
## Findings
- claim | source (url or file:line) | tier | confidence | quote-or-null

## Counter-evidence
- …

## Still open
- …

## Sources touched
- …
```

### Refuter variant

Same template, replace OBJECTIVE with:

```text
Adversarially REFUTE the following decision-changing claim(s) against primary sources.
Default: claim fails unless you find concrete support. If you cannot refute, state what
you checked and that the claim survived.
CLAIMS:
- …
```

## After the panel

1. Discard findings that only restate SEED without new source.
2. Contradiction check when ≥2 agents cite the same fact (research-rigor rule 7).
3. Lead spot-verifies decision-grade claims (open primary source once).
4. Fold into the user report; one-line method note: `session + N agents (cap 10)`.

## Do not

- Second wave “cleanup” agents without a new user ask.
- Spawn Explore agents with empty objective (“look around”).
- Spend the full 10 by default — the cap is a ceiling, not a target.
- Invoke agents without `Skill(prompt-engineer)` on their prompts.
