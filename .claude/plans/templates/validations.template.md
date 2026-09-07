---
spec: {NNN}-{slug}
tasks: tasks/
created: {ISO-date}
phase: 2.5
status: draft
validation_mode: validation
test_policy: business-critical|mixed|auxiliary
---

# Validations per HU (validation-mode)

## ¿Por qué validation-mode y no TDD?

<2-3 líneas: sin código ejecutable nuevo, sin oracle binario natural. La HU produce markdown/skills/docs/configs — aplicar TDD sería ceremonia sin valor real. Las validaciones declarativas son verificables vía Grep/Read/manual LLM review.>

## Categorías de validación

| Categoría | Significado |
|---|---|
| **Pre-conditions** | Qué debe existir/cumplirse ANTES de empezar la HU |
| **Post-conditions** | Qué debe existir/cumplirse TRAS cerrar la HU |
| **Structural assertions** | Estructura/contenido obligatorio en los archivos producidos |
| **Smoke checks** | Verificaciones funcionales (skill se auto-activa, command no falla) |
| **Cross-validations** | Refs entre archivos coherentes; nada huérfano |

## US{N} — <título>

### Pre

- <Qué debe existir antes de empezar esta HU>

### Post

- <Qué debe existir/ser cierto después de completarla>

### Structural assertions

- <Sección/campo obligatorio en el artefacto producido>
- <Frontmatter field presente y con valor válido>

### Smoke

- <Verificación funcional ejecutable — Glob, Grep, Read, manual invocation>

### Cross-validations

- <Referencia cruzada entre archivos que debe ser coherente>

---

## Cross-cutting validations

> Solo si hay validaciones que aplican al conjunto del feature, no por HU. Omitir en caso contrario.

- **X1**: <validación cross-cutting sobre el feature entero>
