---
description: Genera mensaje de commit en ingles desde el diff staged/unstaged, siguiendo el estilo del repo. Solo texto, nunca ejecuta git.
---

# /commit-message

Genera un mensaje de commit en **ingles**, breve y claro, a partir de los cambios actuales (staged si los hay, si no unstaged). Sigue el estilo de commits del repo. NO ejecuta el commit: solo produce el texto listo para copiar.

> Generalizado desde la capa de un repo de trabajo (2026-08-05). En repos con capa propia, la versión del proyecto tiene precedencia.

## Instrucciones

Ejecuta los pasos EN ORDEN. No saltes ninguno.

### Paso 1: Recopilar cambios

Ejecuta en paralelo:

```bash
git branch --show-current          # rama actual (para extraer el ticket)
git diff --cached --stat && git diff --cached    # staged (prioridad si existen)
git diff --stat && git diff        # unstaged (fallback)
git log --oneline -15 --no-merges  # estilo reciente del repo (para imitar formato)
```

**Regla de selección**: si hay cambios staged, describe SOLO esos. Si no hay staged, describe los unstaged. Nunca mezcles ambos sin avisar.

### Paso 2: Detectar ticket

Extrae el ID del nombre de la rama (patrón `[A-Z]{2,}-\d+`, p. ej. `ABC-123` o `feature/ABC-123`, o el tracker del repo). Si se detecta → prefija el subject con él. Si NO → usa solo el verbo descriptivo (sin prefijo inventado).

### Paso 3: Detectar el estilo del repo

Del `git log` observa el patrón dominante y replícalo (p. ej. en un repo pueden convivir `ABC-123 <Verbo descripción>` — el más frecuente —, `feat(ABC-123): <desc>` y `FIX <desc>`). Subject en **imperativo**, primera letra mayúscula, sin punto final.

### Paso 4: Analizar el diff

Identifica QUÉ cambió realmente. Agrupa cambios relacionados; no listes archivo por archivo — describe el efecto.

### Paso 5: Avisos pre-commit

Comprueba y AVISA (no bloquees) si: hay submodules modificados (¿bump intencional?) · hay archivos sensibles en el diff (`.env`, settings, `*.lock`, secrets) · el diff mezcla cambios no relacionados (sugiere separar en >1 commit).

### Paso 6: Generar mensaje

Produce DOS variantes:

````
## Mensaje de commit

**Variante corta:**
```
<TICKET> <subject imperativo>
```

**Variante con body:**
```
<TICKET> <subject imperativo>

- <cambio logico 1>
- <cambio logico 2>
```
````

Body: bullets `-`, cada uno un cambio lógico, imperativo, en inglés, máximo ~5 (agrupa si hay más). Si hubo avisos del Paso 5, lístalos DEBAJO bajo `### Avisos`.

## Reglas

1. **Inglés siempre** para el mensaje; identificadores verbatim.
2. **NO inventes**: solo lo que está en el diff real.
3. **NO ejecutes el commit** ni validaciones — este comando solo genera texto.
4. **NO uses `git add`**: respeta el estado del index.
5. **Breve**: subject ≤ ~72 chars, sin relleno, sin "this commit".
6. **Imperativo**: "Add", "Fix", "Remove" — no "Added".
7. **Sin autoría de IA** (CLAUDE.md §Git / PR, la lista de lo prohibido vive allí):
   las dos variantes salen limpias; la excepción solo si el usuario lo pide
   **este turno**.
8. **Output**: el bloque final directamente, listo para copiar.
