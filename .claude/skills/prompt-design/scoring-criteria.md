# Scoring Criteria

5-criteria evaluation system for prompts.

## The 5 Criteria

| Criterion | 20 pts | 10 pts | 0 pts |
|----------|--------|--------|-------|
| **Clarity** | Action verb + specific target | Generic verb | Vague/ambiguous |
| **Context** | Paths + tech + versions | Tech mentioned | No context |
| **Structure** | Organized, bullets/headers | Clear paragraphs | Wall of text |
| **Success** | Observable outcome + verification (behavior, artifact or relevant metric) | "better", "faster", or a result without a way to check it | No criteria |
| **Actionable** | No open questions | 1-2 clarifications | Very vague |

## Thresholds

A non-numeric DoD can earn full Success credit. For variable tasks, require the
recipient to resolve missing acceptance and quality priorities before execution.
Existing task criteria remain authoritative; do not invent metrics or scope to
raise the score. Stop at the selected context's threshold with a usable prompt.

| Score | Action |
|-------|--------|
| 80-100 | Proceed directly |
| 70-79 | Proceed with caution |
| < 70 | Improve before continuing |

## Scoring Examples

### High Score (85)
> "Añadir endpoint POST /api/users que valide email único, hashee password con bcrypt, y retorne 201"

- Clarity: 20 (verb + specific target)
- Context: 15 (implicit tech)
- Structure: 20 (organized)
- Success: 15 (status code defined)
- Actionable: 15 (clear)

### Low Score (25)
> "Mejorar el sistema de usuarios"

- Clarity: 5 (vague)
- Context: 0 (no details)
- Structure: 10 (simple)
- Success: 5 (no criteria)
- Actionable: 5 (ambiguous)
