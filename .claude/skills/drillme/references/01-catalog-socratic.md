---
parent: drillme
name: catalog-socratic
description: 4 canonical categories of the Socratic Prompt Method — full templates, adaptation by context, anti-patterns.
---

# Canonical 4-category catalog

## Contents

- [1. [location] — Challenge location](#1-location-challenge-location)
- [2. [approach] — Challenge approach](#2-approach-challenge-approach)
- [3. [context] — Introduce context](#3-context-introduce-context)
- [4. [failure] — Probe failure modes](#4-failure-probe-failure-modes)
- [Coverage calibration](#coverage-calibration)
- [Combining with complementary patterns](#combining-with-complementary-patterns)

Source: [Socratic Prompt Method, Jaseci Labs 2026](https://blogs.jaseci.org/blog/2026/03/10/socratic-prompt-method/) + [Towards AI — The Socratic Prompt 2025](https://towardsai.net/p/machine-learning/the-socratic-prompt-how-to-make-a-language-model-stop-guessing-and-start-thinking).

Each drillme should cover **at least 3 of these 4 categories**. Skipping a category is acceptable but must be declared honestly ("Skipping `[X]` — N/A in this context"). Inventing a synthetic question to pad coverage is an anti-pattern.

## 1. `[location]` — Challenge location

### Purpose

Architectural awareness. Surfaces assumptions about **where** something lives, **which layer** owns it, **which file** is the natural home.

### Canonical templates

| Template | When to use |
|---|---|
| "Is this the right place / file / layer for this?" | Code change with multiple plausible homes |
| "Does this belong in `<module A>` or `<module B>`?" | Cross-cutting concern, ambiguous ownership |
| "Should this live in the global layer or the project-local layer?" | Poneglyph: skill/rule/hook decision |
| "Is this concern at the right level of abstraction?" | Premature low-level decisions in a high-level spec |

### When to skip honestly

- Context is purely conceptual (no file/code yet) → location N/A.
- Decision is "should we do X at all?" — location is downstream.

### Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| File-path guessing | Question references a specific path without verification | First Glob/Read, then ask |
| Layer cargo-cult | "MVC says this goes in controller" without checking project conventions | Glob/Grep similar files first |

## 2. `[approach]` — Challenge approach

### Purpose

Pattern reasoning. Surfaces assumptions about **why this pattern over alternatives**, what was rejected and why, whether simpler exists.

### Canonical templates

| Template | When to use |
|---|---|
| "Why this approach over `<alternative>`? What did we reject?" | Decision between 2+ patterns |
| "What's the simplest version that could possibly work?" | Anti-overengineering (Commandment V) |
| "Are we solving the right problem?" | Symptom vs root cause |
| "Why now and not later / not earlier?" | Timing of the decision |
| "If we had to do this in 1 hour vs 1 week, what changes?" | Force scope calibration |

### When to skip honestly

- Approach is mechanical (rename, format) → no choice.
- Approach is dictated by external constraint (security/compliance) — challenging it is performative.

### Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Steel-man missing | Critique without representing the strongest case for the alternative | Steel-man before critique (anti-pattern #3 from decide (heavy tier)) |
| Contrarian for its own sake | "Why not X?" without a reason X would be better | Disagree only with concrete reason |

## 3. `[context]` — Introduce context

### Purpose

Dependency discovery. Surfaces interactions, side effects, downstream consumers, upstream sources.

### Canonical templates

| Template | When to use |
|---|---|
| "How does this interact with `<X>`?" | Cross-module change |
| "What does this touch that we haven't accounted for?" | Implicit dependencies |
| "Who depends on this? Who do we depend on for this?" | Upstream/downstream surface |
| "What invariants must hold before/after this?" | State machine, contract |
| "Is there a pattern in the project we're ignoring?" | Reinvention check |

### When to skip honestly

- Pure greenfield with no existing code → no dependencies yet.

### Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Generic "ensure compatibility" | No specific dependency named | Name the dependency or skip |
| Dependency invention | Citing imports that don't exist | Grep first, then claim |

## 4. `[failure]` — Probe failure modes

### Purpose

Edge case robustness. Surfaces what breaks, what's worst-case, what we'd regret in 6 months.

### Canonical templates

| Template | When to use |
|---|---|
| "What happens if `<edge case>`?" | Always — edge cases are universal |
| "What's the worst-case scenario?" | Severity calibration |
| "It's 6 months later, this failed — why?" | Pre-mortem (from decide (heavy tier)) |
| "What would guarantee the worst outcome?" | Inversion |
| "If we deploy this Friday and break Saturday, what's the rollback?" | Operational failure modes |
| "What's the silent failure mode?" | Errors that don't fail loudly |

### When to skip honestly

- Reversible trivial change in dev environment → low blast radius.

### Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Vague doom | "This might break" without trigger condition | Concrete trigger + early warning + blast radius |
| Failure mode without mitigation | Critical contra with no recovery path | Pair every Critical/Major failure with mitigation |

## Coverage checklist (gap-driven, not count-driven)

There is no "N questions for complexity tier X" table. Coverage is driven by gaps, not by a target count: **sweep every category; for each, if a gap exists that would change the decision, ask; if it genuinely doesn't apply, declare "N/A — reason".** On trivial input no gaps surface → zero questions (the hybrid gate in SKILL.md). On an ambiguous decision many surface → ask until closed.

Sweep these aspect categories:

| Group | Categories |
|---|---|
| **Canonical 4** | `[location]` · `[approach]` · `[context]` · `[failure]` |
| **Lateral / improvement** (what the user did NOT mention) | partial failures · retries / idempotency · timeouts & downtime · input validation · authz / security surface · performance & scale · observability · migration / rollback / backward-compat · UX / DX · cost & effort · data & state lifecycle · concurrency |
| **Phase bank** (inside /flow) | the detected phase's questions from `03-phase-questions.md` |

The lateral group is where drillme earns its keep: it surfaces the gaps the requester didn't think to mention. Still gap-gated — a category with no real gap is declared N/A, never padded with a synthetic question.

## Combining with complementary patterns

The 4 categories are **WHAT to ask**; complementary patterns (5-whys, first principles, inversion) are **HOW to dig deeper** when the canonical question alone is insufficient. See `02-complementary-patterns.md`.
