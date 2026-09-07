---
name: {{SKILL_NAME}}
description: |
  {{DESCRIPTION}}
  Use when {{TRIGGER_CONDITION}}.
context: fork
agent: Explore
---

# {{SKILL_TITLE}}

Research {{TOPIC}} thoroughly and provide well-sourced findings.

## Methodology

1. **Codebase First**: Search local files using Read, Grep, Glob
2. **Web Search**: Find external information if needed
3. **Cross-Reference**: Verify findings across sources
4. **Summarize**: Present with confidence assessment

## Research Areas

### Area 1: {{Topic}}

Questions to answer:
- {{Question 1}}
- {{Question 2}}

### Area 2: {{Topic}}

Questions to answer:
- {{Question 1}}
- {{Question 2}}

## Output Format

## Research: {{TOPIC}}

### Summary
{{One paragraph summary}}

### Findings from Codebase

| Finding | Source | Confidence |
|---------|--------|------------|
| {{finding}} | `file.ts:123` | High |

### Findings from Web

| Finding | Source | Confidence |
|---------|--------|------------|
| {{finding}} | [Title](url) | Medium |

### Recommendations
1. {{Recommendation 1}}
2. {{Recommendation 2}}

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| {{area}} | High/Medium/Low | {{why}} |

### Sources
- [{{Source 1}}](url)
- `{{file.ts}}` - {{what it contributed}}

## Constraints

- Always cite sources
- Indicate confidence levels
- Prioritize official documentation
- Admit when information is not found

---

**Version**: 1.0.0
