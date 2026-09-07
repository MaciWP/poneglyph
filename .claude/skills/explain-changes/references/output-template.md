---
parent: explain-changes
name: output-template
description: Literal "professor-mode" report template plus a condensed good example and an annotated bad example
---

# Output Template

## Contents

- [Literal Template](#literal-template)
- [Resumen ejecutivo](#resumen-ejecutivo)
- [Cadena logica](#cadena-logica)
- [Cambios punto por punto](#cambios-punto-por-punto)
- [Preguntas frecuentes pre-anticipadas](#preguntas-frecuentes-pre-anticipadas)
- [Que sigue](#que-sigue)
- [Good Example (Condensed)](#good-example-condensed)
- [Resumen ejecutivo](#resumen-ejecutivo)
- [Cadena logica](#cadena-logica)
- [Cambios punto por punto](#cambios-punto-por-punto)
- [Preguntas frecuentes pre-anticipadas](#preguntas-frecuentes-pre-anticipadas)
- [Que sigue](#que-sigue)
- [Bad Example (Annotated)](#bad-example-annotated)
- [Resumen ejecutivo](#resumen-ejecutivo)
- [Cambios punto por punto](#cambios-punto-por-punto)
- [Que sigue](#que-sigue)

Format every report with this structure. Sections are FIXED — do not rename, reorder, or omit. If a section is empty, write "No aplica" rather than removing it.

## Literal Template

```markdown
## Resumen ejecutivo
- 3-5 bullets stating WHAT changed and WHY.
- If changes are causally chained, mention the chain explicitly.
- Last bullet: scope (file count, line count, single intent vs multi-intent).

## Cadena logica
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
- **Que hace**: 1-2 frases.
- **Por que es necesario**: razon (link a cambio previo si depende).
- **Como funciona**: explicacion + cita `path/file.py:line` cuando ayuda.
- **Verificacion**: cita literal de doc oficial con URL completa, formato:
  > [titulo doc](URL exacta): "cita literal entrecomillada".
- **Caveats / opinion**: anti-patterns, mejoras posibles, riesgos. Honesto.

### 2. ...

## Preguntas frecuentes pre-anticipadas
- **Q**: pregunta probable del usuario.
  **A**: respuesta directa, con cita si aplica.

## Que sigue
- Profundizo en algun punto?
- Aplico el patron a otro fichero / explico cambio relacionado?
- Verifico contra otra fuente?
```

## Good Example (Condensed)

> Target: change in `apps/library/models.py` adding a unique constraint scoped to soft-delete.

```markdown
## Resumen ejecutivo
- Anadida UniqueConstraint sobre (company, code) condicionada a deleted IS NULL.
- Migracion 0042 elimina el unique simple anterior.
- Test nuevo verifica que dos filas con el mismo code coexisten si una esta soft-deleted.
- Scope: 2 ficheros, 38 lineas, intent unico (preservar unicidad sin colisionar con soft-delete).

## Cadena logica
Soft-delete activo (Cambio A previo)
   ↓ (consecuencia: filas "muertas" rompen UNIQUE)
UniqueConstraint condicional (Cambio 1)
   ↓
Migracion drop + recreate (Cambio 2)
   ↓
Test de coexistencia (Cambio 3)

## Cambios punto por punto

### 1. UniqueConstraint condicional
- **Que hace**: reemplaza `unique=True` por `UniqueConstraint(fields=["company","code"], condition=Q(deleted__isnull=True))`.
- **Por que es necesario**: SoftDeleteModel deja filas en BD; el unique global colisiona al re-crear.
- **Como funciona**: Postgres soporta indices parciales — la constraint solo aplica cuando deleted es NULL.
- **Verificacion**:
  > [Django Model Meta options](https://docs.djangoproject.com/en/5.0/ref/models/options/#django.db.models.Options.constraints): "UniqueConstraint... A condition limits the constraint to a subset of rows."
- **Caveats**: requiere migracion data-aware si ya hay duplicados con deleted-not-null.

### 2. Migracion 0042
- **Que hace**: drop del unique simple, add del UniqueConstraint condicional.
- **Por que es necesario**: el cambio en Meta requiere migracion explicita.
- **Como funciona**: dos operaciones en la misma migracion — orden importa.
- **Verificacion**: ver test 3, que cubre la coexistencia post-migracion.
- **Caveats**: en bases con duplicados existentes, esta migracion fallara — anadir `RunPython` previo si aplica.

### 3. Test de coexistencia
- **Que hace**: crea fila A, soft-delete, crea fila B con mismo code → debe pasar.
- **Por que es necesario**: regresion-guard contra el bug original.
- **Como funciona**: AAA, sin mocks, hits a BD real (autouse fixture del proyecto).
- **Caveats**: no cubre el caso de race condition entre delete y create concurrentes.

## Preguntas frecuentes pre-anticipadas
- **Q**: por que no `unique_together`?
  **A**: `unique_together` no acepta `condition`. UniqueConstraint con condition es la unica via.
- **Q**: funciona en MySQL?
  **A**: no — indices parciales son Postgres-specific en Django ORM. Verificable en doc oficial.

## Que sigue
- Profundizo en la migracion 0042?
- Reviso si otros modelos con SoftDelete tienen el mismo problema?
```

## Bad Example (Annotated)

```markdown
## Resumen ejecutivo
- Se actualizo el modelo.   <!-- VAGUE: que se actualizo? -->
- Se mejoro la unicidad.    <!-- VAGUE: "mejoro" es opinion no hecho -->

## Cambios punto por punto
### 1. Cambio en models.py
- Probablemente Django soporta indices parciales.   <!-- "Probablemente" = NO VERIFICADO -->
- Ver: https://stackoverflow.com/q/12345678         <!-- StackOverflow NO es fuente autoritativa -->
- El patron es comun.                                <!-- "Comun" sin grep que lo respalde -->

## Que sigue
- Si quieres te explico mas.   <!-- FOLLOW-UP DEBIL: no ofrece direcciones concretas -->
```

Problems with the bad example:

- "Probablemente" sin verificacion → debe ser WebFetch + cita literal.
- StackOverflow como fuente → solo dominios canonicos (ver verification-rules.md).
- "Patron comun" sin grep → debe respaldarse con >=2 referencias en el repo.
- Resumen sin cadena logica → falta la seccion entera y no enlaza causalidad.
- Follow-up generico → debe ofrecer 2-3 direcciones concretas.
