---
description: Genera descripcion de PR en markdown (es-ES, breve) desde el diff contra la rama base, lista para copiar y pegar. Nunca ejecuta git.
---

# /pr-description

Genera la descripción de una Pull Request a partir del diff de la rama actual contra la rama base. Output: markdown listo para copiar y pegar.

> Generalizado desde la capa de un repo de trabajo (2026-08-05). En repos con capa propia, la versión del proyecto tiene precedencia.

## Instrucciones

### Paso 1: Recopilar datos del diff

Detecta la rama base (la de integración del repo: `dev` si existe en origin, si no `main`) y ejecuta en paralelo:

```bash
git branch --show-current
git log <base>..HEAD --oneline --no-merges
git diff <base>...HEAD --stat
git diff <base>...HEAD
```

### Paso 2: Detectar ticket (si aplica)

Extrae el ID de la rama (`ABC-123` o el tracker del repo). Si se detecta y hay conector Jira disponible, consulta el ticket para enriquecer la Descripción; si falla, continúa sin él.

### Paso 3: Cambios en base de datos (solo stacks con migraciones)

Si el diff incluye migraciones nuevas (p. ej. `*/migrations/*.py`): márcalo y, si el stack lo permite, incluye el SQL (`python manage.py sqlmigrate <app> <migration>`). Si no hay: "No". En stacks sin migraciones, omite la sección.

### Paso 4: Analizar cambios

Del diff: archivos creados/modificados/eliminados, piezas afectadas (modelos, endpoints, componentes, servicios…), tests nuevos/modificados, config/permisos/fixtures.

### Paso 5: Generar documento

Sigue EXACTAMENTE esta plantilla, con datos reales del diff — nada inventado. Categorías de "Cambios importantes" adaptadas al stack (backend: Modelos/Servicios/Endpoints/Serializers/Tests; frontend: Componentes/API/Estado/Estilos/Tests); omite categorías vacías.

````markdown
### Descripcion

> [Qué hace esta PR y por qué. Referencia y contexto del ticket si existe.]

### Cambios importantes

> **[Categoría]:**
> - [cambio]

### Hay algun cambio importante en la base de datos?

- [SI/NO — con explicación y SQL de migraciones si las hay; omitir sección en stacks sin BD]

### Como se ha probado?

> - Tests unitarios/integración: [los del diff; si no hay, decirlo honestamente]

### Checklist para los revisores

> Esta lista indica los puntos que el revisor ha tenido en cuenta, lo cual no implica que necesariamente se cumplan.

- [ ] El pull request tiene un titulo claro y conciso?
- [ ] El codigo sigue las convenciones de estilo del proyecto?
- [ ] El codigo no introduce errores o advertencias?
- [ ] La logica del codigo es clara y facil de entender?
- [ ] El cambio tiene pruebas unitarias o de integracion asociadas?
- [ ] Se han cubierto todos los casos de prueba relevantes?
- [ ] La documentacion ha sido actualizada si es necesario?
- [ ] El cambio no afecta negativamente al rendimiento o la seguridad?

### Notas adicionales

> [Decisiones técnicas, trade-offs, pendientes. Si no hay: "Ninguna."]
````

## Reglas

1. **NO inventes cambios** — solo el diff real.
2. **NO ejecutes validaciones** — este comando solo genera la descripción.
3. **Respeta la plantilla exacta** — el output se copia-pega.
4. **Sin tests en el diff** → dilo honestamente.
5. **Idioma**: castellano breve y claro; términos técnicos en inglés.
6. **Output**: el markdown final directo en la respuesta.
