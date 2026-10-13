# Corrections

Specific corrections for each scoring criterion.

## By Criterion

### Clarity

| If missing | Add |
|----------|--------|
| Verb | "Create", "Modify", "Delete", "Refactor" |
| Target | Specific file, function, endpoint |
| Action | What should happen exactly |

### Context

| If missing | Add |
|----------|--------|
| Location | File path: `src/services/user.ts` |
| Technology | "using Elysia", "with Drizzle ORM" |
| Dependencies | "requires bcrypt for hashing" |

### Structure

| If missing | Add |
|----------|--------|
| Organization | Bullets for steps |
| Separation | Headers for sections |
| Clarity | Inline code for identifiers |

### Success

| If missing | Add |
|----------|--------|
| Metric | "<100ms", ">90% coverage" |
| Output | "returns 201 with {id, email}" |
| Verification | "test X must pass" |

### Actionable

| If missing | Add |
|----------|--------|
| Decisions | Make the technical decisions |
| Ambiguity | Remove "maybe", "perhaps" |
| Completeness | All required info present |

## Fix Order

When several criteria fail, fix them in this order: Clarity (verb + target), Context,
Success, Structure.

## Quick Improvement Template

```markdown
## Prompt Original
[pegar prompt del usuario]

## Análisis
- Clarity: pasa/falla - [qué falta]
- Context: pasa/falla - [qué falta]
- Structure: pasa/falla - [qué falta]
- Success: pasa/falla - [qué falta]
- Actionable: pasa/falla - [qué falta]

## Prompt Mejorado
[versión mejorada]

## Cambios Realizados
1. [cambio 1]
2. [cambio 2]
```
