# Anti-Patterns

Common prompt errors and how to avoid them.

## Anti-Patterns Table

| Anti-Pattern | Bad Example | Correction |
|--------------|--------------|------------|
| **Vagueness** | "Mejorar performance" | "Reducir tiempo de response de /api/users de 500ms a <100ms" |
| **No Context** | "Arreglar el bug" | "Arreglar error en login.ts:45 donde password null causa crash" |
| **Infinite Scope** | "Refactorizar todo" | "Extraer validación de OrderService a ValidationService" |
| **No Criteria** | "Hacerlo mejor" | "Reducir complejidad ciclomática de 15 a <10" |
| **Multiple Tasks** | "Login y registro y perfil" | Split into 3 separate prompts |

## Warning Signals

| Word | Problem | Alternative |
|---------|----------|-------------|
| "mejorar" | Vague | Specify metric |
| "arreglar" | No context | Describe the bug |
| "todo" | Infinite scope | Limit to component |
| "rápido" | No criteria | Define ms/ops |
| "y...y...y" | Multiple tasks | Split |

## Pre-Submit Checklist

- [ ] Does it have a specific action verb?
- [ ] Does it mention concrete files or components?
- [ ] Does it define a measurable success criterion?
- [ ] Is it a single atomic task?
- [ ] Can I start without asking more?

## Common Technical Errors

| Error | Problem | Fix |
|-------|----------|-----|
| `claude-3-opus` | Stale model ID from memory | Verify the current ID against the host (`/model`, provider docs) — never hard-code one |
| `rm -rf` on Windows | Unix command | `Remove-Item -Recurse` |
| `cat file.txt` | Unix command | `type file.txt` or Read tool |
| Path with `/` | Unix separator | Use `\` on Windows |
