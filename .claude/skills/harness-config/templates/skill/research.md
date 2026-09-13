---
name: {{SKILL_NAME}}
description: |
  {{DESCRIPTION}}
  Úsala cuando: {{TRIGGER_CONDITION}}.
metadata:
  keywords: >
    Keywords - {{KEYWORD_1}}, {{KEYWORD_2}}, {{KEYWORD_3}}
disable-model-invocation: false
when_to_use: |
  "{{TRIGGER_PHRASE_1}}", "{{TRIGGER_PHRASE_2}}", "{{TRIGGER_PHRASE_3}}"
---

# {{SKILL_TITLE}}

Research {{TOPIC}} thoroughly and provide well-sourced findings.

Instantiate: `{{SKILL_NAME}}` kebab 1–64 matching the directory; `description` 1–1024; `when_to_use` and `metadata.keywords` strings. Portable default omits Claude-only `context: fork`. This-repo activation copy stays es-ES.

## When NOT to use

- The answer is already in the repo and a Grep closes it.
- The user asked for a change, not an investigation (use the matching build skill).
- A single official page is enough — fetch that page; do not fan out.

## Methodology

1. **Codebase first**: Read, Grep, Glob before the web.
2. **Official docs**: vendor index, then the type page. Date-stamp the fetch.
3. **Cross-reference**: two sources or an honest single-source tag.
4. **Summarize**: findings with confidence; admit gaps.

## Research areas

### Area 1: {{Topic}}

- {{Question 1}}
- {{Question 2}}

### Area 2: {{Topic}}

- {{Question 1}}
- {{Question 2}}

## Output

### Summary

{{One paragraph}}

### Findings

| Finding | Source | Confidence |
|---|---|---|
| {{finding}} | `file.ts:123` or URL | High / Medium / Low |

### Recommendations

1. {{Recommendation 1}}
2. {{Recommendation 2}}

## Eval scenarios (≥3)

1. {{Codebase-only question — no web}}
2. {{Official-doc conflict with a local snapshot}}
3. {{Nothing found — must say so, not invent}}

## Anti-patterns

| Avoid | Instead |
|---|---|
| {{Invent a number or a vendor recipe}} | {{Cite the page and date, or say unreachable}} |

## Content map

| Topic | File | Read when |
|---|---|---|
| {{Topic}} | `references/{{file}}.md` | {{When to load}} |

## Constraints

- Cite sources. Indicate confidence. Prefer official docs. Admit when information is not found.
