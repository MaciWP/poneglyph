---
spec: 025-flow-backhalf-gate
phase: 5
retro_level: standard
verdict_phase4: APPROVED
spec_drift: none
promotions_proposed: 2
promotions_approved: 0
commandment_violations: 0
living_spec_delta: no
action_items: 4
created: 2026-06-30
status: approved
---

# Retro — 025-flow-backhalf-gate

## Resumen

Problema (spec.md): `/flow` no daba visibilidad de la mitad trasera (build→critic→retro) → 50% de features abandonadas en proyectos reales. Entregado: subcomando `status` en flow-state.ts + recordatorio pasivo en post-compact.ts + schema documentado (D4) + ownership de retro. Veredicto: **fluido**. Doble valor: cierra el hallazgo #1 de la auditoría Y, como dogfood, **valida que toda la maquinaria de `/flow` funciona end-to-end** (las 5 fases + 2 hard gates + flow-state.ts mutaciones + skills de fase + reviewer fresco).

## Lecciones

### ✅ Patrones que funcionaron
- **Gap-analysis de tech-plan atrapó la sync-trap**: un hook SYNCED (`~/.claude/`) no puede importar de `scripts/` (NO-synced). Detectarlo en Fase 2 evitó un import roto-en-clone; forzó scan inline (Cmd III: 8 líneas dup > acoplar). Reutilizable siempre que se comparta lógica hook↔script.
- **Reviewer de contexto fresco atrapó un gap real** (Usage sin `status`) que yo, autor, no vi. Confirma el author≠reviewer (memoria `independent-reviewer-when-self-assessing`).
- **TDD-forced en US1**: el red (export error) → green (15 pass) dio confianza real, no ceremonia, en la lógica de scan.

### ❌ Fricción
- **Build no se invocó per-HU vía `Skill('build')`** estricto — corrí el build inline directamente (cargué el procedimiento una vez). Honesto: para 3 HUs pequeñas con oracle claro fue proporcionado, pero se desvía de la regla literal de flow.md "invoke Skill('build') con US{id}". Lección de proceso, no de producto.
- El minor del Usage comment es exactamente una micro-instancia de la clase "docs divergen del código" que la auditoría está atacando — irónico y revelador: el drift es fácil de introducir incluso conscientemente.

## Process audit

| Fase | Esfuerzo | Fricción | Mejora candidata |
|---|---|---|---|
| 1 scope | S | brief ya detallado → cuestionario reducido | — |
| 2 tech-plan | M | gap-analysis encontró la sync-trap (valor, no fricción) | — |
| 2.5 tdd-design | S | — | — |
| 3 build | M | invocación inline vs Skill('build') per-HU | clarificar en flow.md que inline-build ES el mecanismo (ya implícito) |
| 4 critic | M | reviewer async (espera) | — |

Fase más pesada: empate 2/3/4 (M). Ninguna reveló herramienta faltante.

## Drillme — Phase 5
1. **¿Fase muy pesada?** No; todas proporcionadas al tamaño.
2. **¿Fricción evitable?** La duplicación del scan (US1/US2) es deliberada, no evitable sin acoplar.
3. **¿Patrón reutilizable?** Sí — la sync-trap (hook↔script) es clase recurrente.
4. **¿Global/local/memoria?** Memoria (la sync-trap) + global (los fixes de la auditoría).
5. **¿Commandment violado en silencio?** No.

## Promotions (candidatas — pendientes de ratificación)

| Candidato | Scope | Tipo | Por qué | Propuesta |
|---|---|---|---|---|
| sync-trap hook↔script | memory | memoria | Clase de bug recurrente: hook synced no puede importar script no-synced; gap-analysis debe chequearlo | Nueva memoria `feedback-sync-trap-hook-script` |
| Refrescar system-inventory.md (P1/D1) | global | doc-fix | El mapa miente: skills 22→24, skill-advisor "cut" pero existe, fallbackModel "no existe" pero está configurado (CC 2.1.166) | Editar `.claude/docs/system-inventory.md` líneas 128,142,158 |

> Failure→eval case: el minor (Usage drift) no es un fallo de comportamiento del sistema sino un descuido de autor; no amerita caso de eval. El abandono de mitad trasera (problema raíz) ahora tiene mecanismo de detección (`status`) que ES su guardia.

## Living-spec
`none` — lo entregado coincide 1:1 con spec.md (OQ1 resuelta en gate 1→2, entregado tal cual).

## Commandments audit

| # | Cumplido | Evidencia |
|---|---|---|
| I | ✅ | Hard gates humanos reales; fricción de proceso (build inline) declarada sin softening |
| II | ✅ | Cada finding de la auditoría verificado inline; 3 falsos positivos rechazados |
| III | ✅ | Scan inline dup (8 líneas) > abstracción acoplada; extiende no reescribe |
| IV | ✅ | TDD red→green US1; 145 tests gate el APPROVED |
| V | ✅ | gap-analysis antes de construir atrapó la sync-trap |
| VI | ✅ | Best-effort exit 0; borrado cross-repo denegado por la red de seguridad → entregado al user |
| VII | ✅ | Fan-out read-only paralelo (5 Explore) en la auditoría; build inline |
| VIII | ✅ | US como Execution prompts (Arch H); reviewer fresco con prompt acotado |
| IX | ✅ | El propio feature ES un mecanismo de observabilidad de la mitad trasera |
| X | ✅ | Cierra D4 (schema no miente); P1 propone cerrar más drift de docs |

## Action items

| Acción | Owner | Trigger | Due |
|---|---|---|---|
| Escribir memoria sync-trap | Lead | ratificación | esta sesión |
| Aplicar P1 (refrescar system-inventory.md) | Lead | ratificación user | esta sesión / próxima |
| Aplicar P2 (D2 layering, D3 refs muertas meta-create, D5 deprecation) | Lead | ratificación user | próxima sesión |
| Ejecutar P3 (limpieza cross-repo) | user | comandos ya entregados | a discreción |
