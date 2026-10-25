---
parent: changes-explain
name: output-template
description: Literal "professor-mode" report template plus a condensed good example and an annotated bad example
---

# Output Template

## Contents

- [Literal Template](#literal-template)
- [Resumen ejecutivo](#resumen-ejecutivo)
- [Cadena lógica](#cadena-lógica)
- [Cambios punto por punto](#cambios-punto-por-punto)
- [Preguntas frecuentes pre-anticipadas](#preguntas-frecuentes-pre-anticipadas)
- [Qué sigue](#qué-sigue)
- [Good Example (Condensed)](#good-example-condensed)
- [Resumen ejecutivo](#resumen-ejecutivo)
- [Cadena lógica](#cadena-lógica)
- [Cambios punto por punto](#cambios-punto-por-punto)
- [Preguntas frecuentes pre-anticipadas](#preguntas-frecuentes-pre-anticipadas)
- [Qué sigue](#qué-sigue)
- [Bad Example (Annotated)](#bad-example-annotated)
- [Resumen ejecutivo](#resumen-ejecutivo)
- [Cambios punto por punto](#cambios-punto-por-punto)
- [Qué sigue](#qué-sigue)

Format every report with this structure. Sections are FIXED: do not rename, reorder, or omit. If a section is empty, write "No aplica" rather than removing it.

## Literal Template

```markdown
## Resumen ejecutivo
- 3-5 bullets stating WHAT changed and WHY.
- If changes are causally chained, mention the chain explicitly.
- Last bullet: scope (file count, line count, single intent vs multi-intent).

## Cadena lógica
Show how each change depends on the previous one. Prefer a short text chain;
use mermaid only if the chain has >3 branches.

```
Cambio A (causa raiz)
   ↓ (consecuencia: ...)
Cambio B
   ↓
Cambio C
```

## Cambios punto por punto

### 1. {nombre corto del cambio}
- **Qué hace**: 1-2 frases.
- **Por qué es necesario**: razón (link a cambio previo si depende).
- **Cómo funciona**: explicación + cita `path/file.py:line` cuando ayuda.
- **Verificación**: cita literal de doc oficial con URL completa, formato:
  > [título doc](URL exacta): "cita literal entrecomillada".
- **Caveats / opinión**: anti-patterns, mejoras posibles, riesgos. Honesto.

### 2. ...

## Preguntas frecuentes pre-anticipadas
- **Q**: pregunta probable del usuario.
  **A**: respuesta directa, con cita si aplica.

## Qué sigue
- 2-3 direcciones concretas en afirmativo (profundizar en el cambio N, aplicar el patrón a otro fichero, verificar contra otra fuente).
- Si el usuario debe elegir entre ellas, la elección va por `AskUserQuestion`, nunca como pregunta en texto.
```

## Good Example (Condensed)

> Target: change in `apps/library/models.py` adding a unique constraint scoped to soft-delete.

```markdown
## Resumen ejecutivo
- Anadida UniqueConstraint sobre (company, code) condicionada a deleted IS NULL.
- Migración 0042 elimina el unique simple anterior.
- Test nuevo verifica que dos filas con el mismo code coexisten si una está soft-deleted.
- Scope: 2 ficheros, 38 líneas, intent único (preservar unicidad sin colisionar con soft-delete).

## Cadena lógica
Soft-delete activo (Cambio A previo)
   ↓ (consecuencia: filas "muertas" rompen UNIQUE)
UniqueConstraint condicional (Cambio 1)
   ↓
Migración drop + recreate (Cambio 2)
   ↓
Test de coexistencia (Cambio 3)

## Cambios punto por punto

### 1. UniqueConstraint condicional
- **Qué hace**: reemplaza `unique=True` por `UniqueConstraint(fields=["company","code"], condition=Q(deleted__isnull=True))`.
- **Por qué es necesario**: SoftDeleteModel deja filas en BD; el unique global colisiona al re-crear.
- **Cómo funciona**: Postgres soporta índices parciales: la constraint solo aplica cuando deleted es NULL.
- **Verificación**:
  > [Django Model Meta options](https://docs.djangoproject.com/en/5.0/ref/models/options/#django.db.models.Options.constraints): "UniqueConstraint... A condition limits the constraint to a subset of rows."
- **Caveats**: requiere migración data-aware si ya hay duplicados con deleted-not-null.

### 2. Migración 0042
- **Qué hace**: drop del unique simple, add del UniqueConstraint condicional.
- **Por qué es necesario**: el cambio en Meta requiere migración explicita.
- **Cómo funciona**: dos operaciones en la misma migración, orden importa.
- **Verificación**: ver test 3, que cubre la coexistencia post-migración.
- **Caveats**: en bases con duplicados existentes, esta migración fallará; añadir `RunPython` previo si aplica.

### 3. Test de coexistencia
- **Qué hace**: crea fila A, soft-delete, crea fila B con mismo code → debe pasar.
- **Por qué es necesario**: regresión-guard contra el bug original.
- **Cómo funciona**: AAA, sin mocks, hits a BD real (autouse fixture del proyecto).
- **Caveats**: no cubre el caso de race condition entre delete y create concurrentes.

## Preguntas frecuentes pre-anticipadas
- **Q**: ¿por qué no `unique_together`?
  **A**: `unique_together` no acepta `condition`. UniqueConstraint con condition es la única vía.
- **Q**: funciona en MySQL?
  **A**: no: índices parciales son Postgres-specific en Django ORM. Verificable en doc oficial.

## Qué sigue
- Profundizar en la migración 0042.
- Revisar si otros modelos con SoftDelete tienen el mismo problema.
```

## Bad Example (Annotated)

```markdown
## Resumen ejecutivo
- Se actualizó el modelo.   <!-- VAGUE: ¿qué se actualizó? -->
- Se mejoró la unicidad.    <!-- VAGUE: "mejoro" es opinión no hecho -->

## Cambios punto por punto
### 1. Cambio en models.py
- Probablemente Django soporta índices parciales.   <!-- "Probablemente" = NO VERIFICADO -->
- Ver: https://stackoverflow.com/q/12345678         <!-- StackOverflow NO es fuente autoritativa -->
- El patrón es común.                                <!-- "Común" sin grep que lo respalde -->

## Qué sigue
- Si quieres te explico más.   <!-- FOLLOW-UP DÉBIL: no ofrece direcciones concretas -->
```

Problems with the bad example:

- "Probablemente" sin verificación → debe ser WebFetch + cita literal.
- StackOverflow como fuente → solo dominios canónicos (ver verification-rules.md).
- "Patrón común" sin grep → debe respaldarse con >=2 referencias en el repo.
- Resumen sin cadena lógica → falta la sección entera y no enlaza causalidad.
- Follow-up genérico → debe ofrecer 2-3 direcciones concretas.
