---
spec: {NNN}-{slug}
tasks_implemented: [US{ids}]
oracle_source: validations.md|tests.md|both|none
created: {ISO-date}
phase: 4
status: draft
---

# Review — <feature>

## Veredicto

**APPROVED** | **NEEDS_CHANGES** | **BLOCKED** — <razón en 1 línea>

## Oracle ejecutado

> Conecta con `validations.md` (validation-mode) o `tests.md` (TDD-mode) o ambos según `oracle_source`. Reporta por HU; agrega aquí, no duplica el contenido del oracle.

| HU | Oracle source | Pre | Post | Structural | Smoke | Cross | Resultado |
|---|---|---|---|---|---|---|---|
| US{N} | validations.md §US{N} | ✅ | ✅ | ✅ | ⚠️ | ✅ | PASS / FAIL |
| US{N} | tests.md §T{N}.* | — | — | — | — | — | <X/Y tests passing> |

> Para HUs con TDD-mode, completar columnas relevantes (tests passing) y dejar las de validation con `—`. Para HUs con validation-mode, al revés. Si ambos: ambas filas.

## Checklist

### Correctness

- [ ] Soluciona el problema declarado en spec.md (Fase 1)
- [ ] Happy path E2E funciona
- [ ] Edge cases conocidos cubiertos

### Quality

- [ ] Cobertura de tests respeta `test-policy.md`
- [ ] Mismo estilo de programación que el resto del proyecto (referencias: <files>)
- [ ] Sin duplicación introducida
- [ ] No hay sobre-ingeniería (Commandment V)
- [ ] Nombres consistentes y legibles

### Security

- [ ] No expone secrets/credenciales en logs ni código
- [ ] No introduce vulns OWASP Top 10 conocidas
- [ ] Inputs externos validados

### Performance

- [ ] Sin loops N² evidentes donde N puede crecer
- [ ] Sin operaciones de I/O dentro de loops cuando se puede batch
- [ ] Async/parallelism aprovechado si aplica

### Mantenibilidad

- [ ] Comentarios solo donde el "por qué" no es obvio
- [ ] No deja TODOs sin issue/tarea asignada
- [ ] Tests del cambio quedan en lugar canónico

## Findings (con severidad)

| Severidad | Descripción | Archivo:línea | Recomendación |
|---|---|---|---|
| BLOCKER\|MAJOR\|MINOR\|NIT | <descripción> | `<path>:<line>` | <acción concreta> |

## Living-spec deltas detectadas

> Solo si spec.md y lo entregado divergen. Omitir en caso contrario. NO aplicar cambios aquí — proponer para Fase 5.

- **Sección afectada**: <sección de spec.md>
- **Diff propuesto**: <qué cambiaría>
- **Razón**: <por qué el delta es legítimo>

## Tests ejecutables (si aplica)

> Reporte de `bun test` u otro runner — paso fundamental para HUs con código nuevo. Omitir si el feature es 100% docs/markdown.

- **Comando ejecutado**: `<cmd>`
- **Resultado**: `<X pass / Y fail / Z skipped>`
- **Coverage**: `<%>` (si `test-policy.md` lo exige)
- **Regresiones detectadas**: `<lista>` o `ninguna`

## Next step

- Si **NEEDS_CHANGES**: HU(s) específicas a re-trabajar → <lista con AC concreto que falla>
- Si **APPROVED**: siguiente = Fase 5 (`/retro`); actualizar `state.json.current_phase` a `fase-5`.
- Si **BLOCKED**: <motivo y qué se necesita para desbloquear; actualizar `state.json.us_pending` con detalle>.
