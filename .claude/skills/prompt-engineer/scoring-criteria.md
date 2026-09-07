# Scoring Criteria

5-criteria evaluation system for prompts.

## The 5 Criteria

| Criterion | 20 pts | 10 pts | 0 pts |
|----------|--------|--------|-------|
| **Clarity** | Action verb + specific target | Generic verb | Vague/ambiguous |
| **Context** | Paths + tech + versions | Tech mentioned | No context |
| **Structure** | Organized, bullets/headers | Clear paragraphs | Wall of text |
| **Success** | Metrics (<100ms, >90%) | "better", "faster" | No criteria |
| **Actionable** | No open questions | 1-2 clarifications | Very vague |

## Thresholds

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
