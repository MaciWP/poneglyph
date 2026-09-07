---
parent: drillme
name: complementary-patterns
description: Three patterns that deepen Socratic questioning when canonical categories alone are insufficient — 5-whys, first principles, inversion.
---

# Complementary patterns

## Contents

- [1. 5-whys](#1-5-whys)
- [2. First principles](#2-first-principles)
- [3. Inversion](#3-inversion)
- [Combining patterns](#combining-patterns)
- [When to escalate beyond drillme](#when-to-escalate-beyond-drillme)

The canonical 4 categories (`[location]` / `[approach]` / `[context]` / `[failure]` — see `01-catalog-socratic.md`) are the WHAT. These three patterns are the HOW: techniques to dig deeper when a single canonical question doesn't crystallize the answer.

## 1. 5-whys

### When to apply

| Trigger | Example |
|---|---|
| User describes a symptom, not a cause | "The API is slow" → why? → why? → ... |
| Multiple symptoms with possible common root | Tests flaky + deploys slow + on-call burned → 5-whys reveals shared cause |
| Solution feels disproportionate to problem | "Adding caching" — why? → "users complain" → why? → "page slow" → why? ... |
| Symptom vs root cause not clear | Almost any debugging context |

### Protocol

1. Start with the symptom as stated.
2. Ask "why?" — record the answer.
3. Ask "why?" of the new answer — record.
4. Repeat up to 5 times.
5. The root is the deepest answer that still has actionable response.

### Stop conditions

- Reaching a foundational fact (physics, business constraint, regulatory) → root found.
- Answers loop ("why X? because Y. why Y? because X") → root is ambiguous; need external research.
- 5 iterations without clarity → drillme can't resolve this alone; escalate to `decide` (heavy tier) or external investigation.

### Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Stopping at convenient answer | Stop at "the previous dev did it" without going deeper | "Why did they?" — go further |
| Stopping at blame | Root is "team X is slow" → blame, not analysis | Reframe as system issue: why is the work organized so that bottleneck happens? |
| Over-applying | Use 5-whys on a 1-line change | If decision is trivial, drillme itself shouldn't fire |

### Output format

When applying 5-whys, present the chain explicitly:

```markdown
[5-whys] Drilling into "the API is slow":
1. Why is the API slow? → endpoint /users takes 2s
2. Why does it take 2s? → N+1 query on user.posts
3. Why N+1? → no eager loading in ORM call
4. Why no eager loading? → original dev unaware of feature
5. Why unaware? → onboarding doc misses ORM perf section

Root: onboarding doc gap. Surface fix (eager loading) addresses symptom; structural fix (doc update) addresses class of issue.
```

## 2. First principles

### When to apply

| Trigger | Example |
|---|---|
| Novel problem with no clear precedent | "We need a custom rate limiter for a new modality" |
| Existing pattern feels wrong for this case | "Everyone uses Redis for sessions; ours shouldn't have sessions at all" |
| Stack inertia drives the choice | "We're using X because we always have" — strip down |
| Premature pattern matching | Solution proposed before problem fully understood |

### Protocol

1. **Strip**: identify the irreducible atoms of the problem (the requirements that can't be removed without changing the problem).
2. **Rebuild**: construct the simplest solution that satisfies those atoms, ignoring prior patterns.
3. **Compare**: place the rebuilt solution next to the proposed solution. Differences reveal accidental complexity.

### Stop conditions

- Atoms identified + rebuilt solution clearly simpler than proposal → first principles delivered value.
- Rebuilt solution converges with the proposal → proposal was already minimal; first principles is unnecessary here.
- Stripping reveals the "problem" itself is ill-formed → re-open Phase 1 (scope).

### Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Reinventing well-tested patterns | First-principles a known-solved problem (e.g., crypto, parsing) | Use established patterns for solved problems; first principles is for novel territory |
| Notebook thinking | "Just throw it in a script" without prod considerations | Acknowledge production gap |
| Naive simplification | Strips real requirements as "accidental" | Verify each removed requirement isn't load-bearing |

### Output format

```markdown
[first-principles] Stripping "we need a session store":

Atoms required:
- Per-user state survives across N requests within X minutes.
- State accessible from any of K backend instances.

Rebuilt minimal solution:
- Signed cookie with state encoded client-side; revocation via short TTL.

Comparison with proposal (Redis cluster):
- Redis adds: ops surface, network hop, failure mode for cache outage.
- Redis enables: state >cookie size, server-side revocation.
- If actual requirement fits in cookie + short TTL → Redis is accidental complexity.

Question: which atoms are wrong, or which atoms is the proposal serving that we missed?
```

## 3. Inversion

### When to apply

| Trigger | Example |
|---|---|
| Decision between 2 close options | "Library A vs B, both adequate" |
| Stuck on a single framing | "We must do X" — what if we MUST NOT do X? |
| Suspect groupthink | Everyone agrees → inversion forces dissent |
| Pre-mortem framing | "It's 6 months later, this failed" → why? |

### Protocol

1. Take the proposed decision (e.g., "use approach A").
2. Invert: "we must use the OPPOSITE of A" — and explore.
3. Find the strongest reasons OPPOSITE would be better.
4. Find what would have to be true for OPPOSITE to be the right call.
5. Compare: are those conditions present?

### Stop conditions

- Inversion reveals genuine equivalence → both options viable; pick on secondary criteria (team familiarity, opportunity cost).
- Inversion reveals proposal is significantly worse → flip the decision.
- Inversion conditions clearly absent → proposal confirmed.

### Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Contrarian for its own sake | Inversion forced where decision is obvious | Skip; inversion is for genuinely close calls |
| Straw-manning the inverse | Inversion is built weakly to confirm original | Steel-man the inverse first |

### Output format

```markdown
[inversion] Decision: "Use Postgres for user state"

What if we MUST NOT use Postgres?
- Forced into: in-memory + persistence-on-shutdown OR cookie-based state OR external SaaS.
- Best of those: cookie-based state for trivial users, with cookie size cap.
- For that to be better than Postgres: most user state fits in <4KB AND we don't need server-side queries.

Are those conditions present? <answer> — informs the original decision.
```

## Combining patterns

Patterns can be combined within one drillme:

- **5-whys + Inversion**: dig to root cause, then invert it.
- **First principles + Inversion**: rebuild from atoms, then ask "what would we lose if we did the opposite?".
- **Inversion + 5-whys**: invert decision, then 5-whys on why we wouldn't.

Cap: combining is for high-stakes decisions. For routine drillme, stick to one pattern + canonical 4 categories.

## When to escalate beyond drillme

If after applying 1-2 complementary patterns the decision still doesn't crystallize → drillme has reached its ceiling. Options:

1. **`decide` (heavy tier)**: spawn 5-12 perspectives in parallel + cross-debate + synthesis + vote.
2. **External research**: maybe the decision needs Context7/WebFetch + data the user doesn't have.
3. **Defer**: not all decisions need to be made now. Document open questions; revisit later.

Drillme closes gaps by asking the user. When the blocker is a genuine disagreement or the decision still won't crystallize after a full sweep, that is honest signal to escalate to a multi-voice debate (`decide` (heavy tier)), not to keep re-asking.
