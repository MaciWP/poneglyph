# Decision memo — ¿Graphify o un "recall" (memoria-grafo) para poneglyph?

**Date**: 2026-06-22. **Mode**: research-feature, light ceremony (memo = deliverable; precedente 021-loops, 018-W4).
> **Addendum 031 (2026-08-06)**: `project-onboard` (la vía de activación condicional citada abajo) fue CORTADA — la ruta ahora es manual: al trabajar en un repo grande code-dominant, sugerir Graphify a mano si aplica. El memo se relocó aquí desde sus references al cortarla.
**Question**: ¿tiene sentido adoptar [graphify.net](https://github.com/safishamsi/graphify) o la skill/plugin "recall" en poneglyph?

## BLUF — verdict

**No a ambos para la capa poneglyph.** Resuelven problemas reales que poneglyph (a) no tiene en su forma de codebase, o (b) ya resuelve de forma deliberada y mejor-alineada con su doctrina. Único matiz: **Graphify sí tiene caso en repos de trabajo grandes de código** — ahí, no aquí. Es una nota, no trabajo nuevo (`prune>add`).

## Qué es cada uno

| Herramienta | Qué hace | Mecanismo |
|---|---|---|
| **Graphify** | Grafo de conocimiento del *código*: navegar por estructura, no por grep. Vende 71,5× menos tokens en codebases grandes. | Tree-sitter (determinista, local) + NetworkX + Leiden; instala directiva en CLAUDE.md + **hook PreToolUse** que consulta el grafo antes de cada búsqueda |
| **"recall"** (MemoryGraph `/recall` / Remember / claude-graph-memory) | *Memoria persistente* cross-sesión: recordar conversaciones, decisiones, patrones entre sesiones, como grafo | Grafo extraído (entidades+relaciones) consultado por Claude entre sesiones |

## Por qué NO en poneglyph

**Graphify:**
1. `[Seguro]` **Naturaleza, no tamaño.** poneglyph son **162 .md vs 36 .ts** — prosa/semántica, no estructura de código parseable. Tree-sitter (la fuerza determinista de Graphify) apenas aplica al markdown. Y poneglyph **ya tiene capa de navegación curada a mano**: `[[links]]` entre memorias, reference-maps en las skills, `system-inventory.md`, índice `MEMORY.md`. El grafo automático no añade sobre una navegación ya diseñada.
2. `[Seguro]` **Colisión de doctrina.** Su mecanismo es un **hook PreToolUse**, que la propia doctrina de poneglyph marca *unreliable* (#6305, `rules/paths/hooks.md`); hay **cero** PreToolUse registrados a propósito. Un consult-before-search que falla en silencio da comportamiento inconsistente.
3. `[Probable — no verificado en docs de Graphify]` El markdown (mayoría del repo) caería a la extracción semántica por LLM, no al path local de Tree-sitter → menos privacidad/ahorro de lo que vende.

**"recall" (cualquier memoria-grafo cross-sesión — robusto a qué producto exacto sea):**
1. `[Seguro]` **Redundante.** poneglyph ya corre la **auto-memoria nativa de CC** (25 entradas + `MEMORY.md` en el path nativo) + el sistema curado de feedback + el living-spec loop. La memoria nativa existe ahora **en cada repo**, no solo poneglyph.
2. `[Seguro]` **Choca con la filosofía de curación.** La memoria de poneglyph es **curada y ratificada por humano** (feedback con Why/How, promoción vía retro). Una extracción automática a grafo crea segunda fuente de verdad (contra Commandment IX) y acumula lo que la disciplina dice NO guardar.

## Matiz conservado (honestidad en ambos sentidos)

Graphify es legítimo en un **repo de trabajo grande de código** (no markdown, no curado a mano): ahí el 71,5× y la navegación-por-estructura sí muerden. Ruta: si surge ese caso, `project-onboard` podría sugerirlo para ese repo concreto — nunca en la capa global poneglyph.

## ¿Vía global? + modelo de ahorro (follow-up)

**Graphify — sí hay vía global coherente**: NO always-on en todos los repos (coste donde no aporta + hook PreToolUse poco fiable), sino **capacidad-global / activación-condicional**: skill disponible en `~/.claude/`, y `project-onboard` la sugiere/activa solo cuando el repo cruza el umbral (grande + code-dominant). **recall — el global no lo rescata**: la redundancia con la auto-memoria nativa es invariante al scope (la nativa ya existe en cada repo).

**Ahorro** `≈ f_exploración × (1 − 1/R) − overhead`. Con `R>5`, `(1−1/R)>0.8` → la palanca es **f_exploración** (fracción de tokens en localizar/leer ficheros para orientarse), no R. Estimaciones modeladas `[Suposición]`, no medidas (medir exigiría parsear logs de tokens por categoría); R=71,5× es benchmark propio de Graphify, no verificado fuera:

| Escenario | f_exploración | Ahorro neto | Por qué |
|---|---|---|---|
| Graphify · poneglyph (local/global) | ~5–15% | **≈ 0%** (break-even a leve negativo) | Edits dirigidos + razonamiento + generación dominan; .md no usa Tree-sitter → extracción LLM come el ahorro |
| Graphify · repo grande de código (local) | ~30–50% | **≈ 25–40%** `[Probable]` | Orientarse domina el coste; el grafo muerde |
| recall (cualquier scope) | n/a | **≈ 0%** | No es herramienta de ahorro; eje = calidad de recall, ya cubierto a 25 entradas + `[[links]]` |

## Status

- [x] Veredicto: no a ambos en la capa poneglyph.
- [x] Vía accionable cableada: criterio "repo grande + code-dominant → sugerir Graphify" en `project-onboard` (Step 1 análisis + Step 2 menú), como sugerencia condicional per-repo (no always-loaded).

## Sources
- https://github.com/safishamsi/graphify · https://graphify.net/graphify-claude-code-integration.html
- https://memorygraph.dev/docs/plugin/ · https://github.com/amarodeabreu/claude-graph-memory
