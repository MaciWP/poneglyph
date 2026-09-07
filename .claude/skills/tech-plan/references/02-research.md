---
parent: tech-plan
name: research
description: Deep Research Protocol + Anti-Obsolescence Detection — consult external docs, reject deprecated APIs.
---

# Deep Research + Anti-Obsolescence — references/02

## Deep Research Protocol (MANDATORY)

**Principle**: FORBIDDEN to use outdated internal knowledge. Consult external sources BEFORE planning code.

### When to Consult External Documentation

| Condition | MANDATORY Action |
|-----------|-----------------|
| Framework API (Elysia, Bun) | Consult official documentation |
| Little-known library (<10k stars) | WebSearch "[library] changelog 2025 2026" |
| Design/architecture pattern | WebSearch + WebFetch from repo >1k stars |
| Any doubt about syntax/API | Official documentation BEFORE writing code |
| Suspected breaking changes | WebSearch "[library] breaking changes [version]" |

### Trusted Sources

| Type | Source | Trust |
|------|--------|-------|
| Official docs | Official framework site | High |
| GitHub issues/discussions | Official repo | Medium-High |
| Engineering blogs | Vercel, Anthropic, Google | High |
| Stack Overflow | Recent posts (2024-2026) | Medium |
| Random tutorials | Avoid | Low |

---

## Anti-Obsolescence Detection

**Problem**: According to [ICSE 2025](https://arxiv.org/abs/2406.09834), 25-38% of LLM-generated code uses deprecated APIs.

### Mandatory Checklist

Before using any API, verify:

| Check | How to verify | Action if fails |
|-------|--------------|-----------------|
| Is the API deprecated? | Official docs + search for "deprecated" in docs | Use replacement API |
| Correct version? | Compare package.json vs consulted docs | Adjust to installed version |
| Breaking changes? | WebSearch "[library] breaking changes [version]" | Apply migration guide |
| Legacy pattern? | Search for "modern alternative" or "best practice 2025" | Use modern pattern |

### Patterns to REJECT

| Legacy/Deprecated | Modern |
|-------------------|--------|
| `google-generativeai` | `google-genai` (new API) |
| `OpenAIClient` Azure v1 | `AzureOpenAIClient` v2 |
| Callbacks (`callback(err, result)`) | async/await |
| `var` | `const`/`let` |
| `require()` | `import` |
| `any` types | Specific types or `unknown` |

### Warning Signals

If you find these patterns in docs/examples, **look for an alternative**:

- "This API is deprecated"
- "Legacy mode"
- "For backwards compatibility"
- Examples with versions < current - 2 major versions

---

## References

- [ICSE 2025 - LLMs Meet Library Evolution: Deprecated API Usage](https://arxiv.org/abs/2406.09834)
- [Anthropic - Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
