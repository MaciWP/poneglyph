---
parent: orchestrator-protocol
name: skill-matching
description: Keywords→skills table, task type detection, priority scoring, synergy rules, skills without keywords.
---

# Skill Matching + Keywords

## Keywords → Skills Table

| Keywords in Prompt | Skill to Load |
|--------------------|--------------|
| auth, jwt, password, security, token, session | `security-audit` |
| refactor, extract, SOLID, clean, simplify | `review-patterns` |
| error, retry, circuit, fallback, recovery | `diagnostic-patterns` |
| performance, memory, optimization, bottleneck, slow, n+1 | `review-patterns` |
| definition, references, hover, symbols, lsp | `lsp-operations` |
| code quality, code smells, SOLID, complexity, duplication | `review-patterns` |
| validate, verify, check, exists, hallucination, confidence | `anti-hallucination` |
| decide, decision, choose, evaluate, trade-off | `decide` |
| stress-test, devil's advocate, challenge decision, pre-mortem | `decide` (heavy tier) |
| explain, walkthrough, diff, learn, onboarding | `explain-changes` |
| prompt, generar prompt, refine, vague, agent prompt, meta-prompting | `prompt-engineer` |
| CLAUDE.md, settings.json, permissions, env vars | `meta-settings-cookbook` |
| create agent, new skill, add hook, scaffold extension, MCP server, plugin | `meta-create` |

## Task Type Detection

When keywords don't match cleanly, detect by task type:

| Task Type | Primary Skill |
|-----------|--------------|
| Performance investigation | `review-patterns` |
| Auth/permissions change | `security-audit` |
| Code cleanup/refactor | `review-patterns` |
| Debugging unknown error | `diagnostic-patterns` |

## Priority Scoring

```
score = +2 per keyword match
       + 2 per path rule match
       + 1 per task-type match
       + 1 per synergy partner in set
       - 3 if in conflict with higher-scored skill
```

If > 3 matches: prioritize keyword frequency → main domain → discard generic if specific exists.

## Synergy Rules

Some skills reinforce each other — both receive +1 when paired:

| Pair | Synergy |
|------|---------|
| `diagnostic-patterns` + `anti-hallucination` | Error tracing with verified claims |
| `review-patterns` + `security-audit` | Quality + threat surface in one pass |

## Conflict Rules

If two skills compete for the same slot and one is more specific, discard the generic:

| Generic | Specific (wins) |
|---------|----------------|
| `review-patterns` | `security-audit` (when security is the primary concern) |

## Skills Without Keywords (Preload via agentType frontmatter)

> Historical: the custom `builder`/`reviewer`/`scout` agents carried always-loaded skill baselines — they were **cut in feature 008** (work runs inline; see the delegation doctrine in SKILL.md).

Today the only preload surface is a custom Workflow `agentType` with `skills:` frontmatter — declare there the 1-2 skills EVERY unit of that type needs (e.g. `anti-hallucination` for any unit asserting facts about code). Preloaded skills do NOT count against the 3-skill Arch H limit.

> The Lead loads `diagnostic-patterns` itself when diagnosing failures, and `tech-plan` when planning — no dedicated agents.
