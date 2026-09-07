# Corrections

Specific corrections for each scoring criterion.

## By Criterion

### Clarity (0 → 20)

| If missing | Add |
|----------|--------|
| Verb | "Create", "Modify", "Delete", "Refactor" |
| Target | Specific file, function, endpoint |
| Action | What should happen exactly |

### Context (0 → 20)

| If missing | Add |
|----------|--------|
| Location | File path: `src/services/user.ts` |
| Technology | "using Elysia", "with Drizzle ORM" |
| Dependencies | "requires bcrypt for hashing" |

### Structure (0 → 20)

| If missing | Add |
|----------|--------|
| Organization | Bullets for steps |
| Separation | Headers for sections |
| Clarity | Inline code for identifiers |

### Success (0 → 20)

| If missing | Add |
|----------|--------|
| Metric | "<100ms", ">90% coverage" |
| Output | "returns 201 with {id, email}" |
| Verification | "test X must pass" |

### Actionable (0 → 20)

| If missing | Add |
|----------|--------|
| Decisions | Make the technical decisions |
| Ambiguity | Remove "maybe", "perhaps" |
| Completeness | All required info present |

## Quick Fix Table

| Current Score | Priority Correction |
|--------------|------------------------|
| < 20 | Add verb + target |
| 20-40 | Add technical context |
| 40-60 | Structure with bullets |
| 60-70 | Add success criterion |

## Quick Improvement Template

```markdown
## Prompt Original
[pegar prompt del usuario]

## Análisis
- Clarity: X/20 - [razón]
- Context: X/20 - [razón]
- Structure: X/20 - [razón]
- Success: X/20 - [razón]
- Actionable: X/20 - [razón]
- **Total: XX/100**

## Prompt Mejorado
[versión mejorada]

## Cambios Realizados
1. [cambio 1]
2. [cambio 2]
```
