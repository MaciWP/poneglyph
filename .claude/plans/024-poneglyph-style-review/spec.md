---
id: 024-poneglyph-style-review
created: 2026-06-23
approved: 2026-06-23
mode: full
phase: 1
status: approved
---

# Problema

El estilo Poneglyph (`.claude/output-styles/poneglyph.md`) se aplica de forma desigual: algunas normas se cumplen siempre, otras "se saltan" sin que nada lo detecte. La causa raíz no es de **carga** (el estilo está activo y en el system prompt — verificado) sino de **spec + cobertura**: las normas que se saltan son, por construcción, las que (a) están redactadas de forma no-seguible autoregresivamente, (b) son contradictorias o redundantes, o (c) no tienen ningún caso de eval que las vigile. La suite de evals (019) pasa ≈100% por diseño, así que solo protege las normas ya cubiertas; el resto deriva en silencio.

# Resultado esperado

> **Prioridad nº1 (usuario, 2026-06-23)**: buen uso de los confidence labels `[Seguro]/[Probable]/[Suposición]` con payload → menos tokens, mejor comunicación, más visual. La spec ya los DEFINE bien; el gap real es el **trigger de cuándo producirlos** sin que te lo pidan (la infrautilización). Eso es el cambio de mayor valor.

- `poneglyph.md` revisado: trigger de confidence labels reforzado, cero contradicciones, cero referencias muertas (ref `/explain` rota → `/explain-changes`), longitud justificada (cada bloque gana su sitio).
- Mapa norma→cobertura-de-eval explícito: cada norma del estilo o tiene un caso que la vigila, o se declara conscientemente como no-cubrible (conductual difusa).
- Casos de eval nuevos SOLO para normas con fallo documentado y sin cobertura (sin filler; respeta el cap ≤50 y la regla "una norma por caso real").
- TL;DR de `CLAUDE.md` §Communication & Honesty Protocol verificado en sync con el canon (sin drift).
- Evidencia mecánica de mejora: baseline live de la suite antes, suite verde después.

# Success criteria (medibles, Given/When/Then)

- **AC1**: Given `poneglyph.md` actual, when se audita norma por norma, then se entrega una tabla con cada norma clasificada como {seguible | no-seguible-autoregresiva | contradictoria | redundante | muerta} con evidencia de línea — y las marcadas se corrigen o se justifica por qué se mantienen.
- **AC2**: Given el inventario de normas del estilo, when se cruza con `.claude/evals/cases.jsonl`, then existe un mapa norma→{cubierta | no-cubrible | gap} y todo `gap` con fallo documentado se cierra con un caso nuevo trazable a su origen real (`source` obligatorio).
- **AC3**: Given los cambios a `poneglyph.md` y/o `cases.jsonl`, when se corre `bun test ./.claude/evals/` y `bun test ./.claude/hooks/`, then ambos quedan verdes; y la suite live (`run.ts`) post-cambio pasa ≥ el baseline (ningún caso de estilo regresiona).
- **AC4**: Given el TL;DR de estilo en `CLAUDE.md` (línea ~70), when se contrasta con `poneglyph.md`, then o está en sync o se corrige el drift; no se duplica la spec completa (se mantiene la referencia + TL;DR).
- **AC5**: Given la deep research interna + externa-narrow, when se documenta, then cada afirmación accionable sobre el mecanismo de carga del output-style está verificada contra fuente (docs oficiales / `claude-code-guide`), no afirmada de memoria.
- **AC6**: Given `.claude/commands/flow.md`, when se revisa el wiring de fronteras de fase, then `skill-advisor` queda cableado junto al `drillme` (al menos una llamada en las fronteras de fase), espejado en la regla SIEMPRE; `bun test ./.claude/hooks/` sigue verde. (Instrucción usuario 2026-06-23.)
- **AC7**: Given el trigger reforzado de confidence labels, when se especifica, then la spec incluye un disparador POSITIVO ("cualquier afirmación que matizarías con creo/quizás, toda predicción o inferencia desde lectura incompleta → label con payload"), no solo la definición de cada estado.

# Out of scope (explícito)

- **No** se construye enforcement de prosa por hook/gate: ningún hook ve el texto del asistente; el único lever real es calidad-de-spec + cobertura-de-eval. (Reframe validado con advisor.)
- **No** se valida la mejora conductual "mirando cómo escribo en esta sesión": esta sesión cargó el estilo antiguo; la validación conductual real es la próxima sesión + la suite live headless.
- **No** deep research web amplia de "prompt engineering best practices" (riesgo de slop; el usuario eligió interno + externo-narrow).
- **No** se reescribe el estilo de cero ni se añaden piezas nuevas si un edit dirigido basta (doctrina "pulir > añadir").
- **No** se tocan los graders salvo que la auditoría revele un bug de grader (en cuyo caso "suspect the eval first").

# Constraints

- **Técnico**: Bun + TypeScript; los cambios son markdown (`poneglyph.md`, `CLAUDE.md`) + JSONL (`cases.jsonl`). Si se toca `graders.ts`, red→green.
- **Reglas seguibles en generación**: toda norma del estilo debe ser seguible sin contar/medir antes de generar (lección `feedback-rules-must-be-generation-executable`). Preferir ejemplos/anchors a thresholds numéricos.
- **Coste always-loaded**: `poneglyph.md` (~147 líneas) se inyecta cada turno; podar tiene coste recurrente real, pero **no se cortan los ejemplos** (son la spec — `feedback-always-loaded-vs-ondemand-cost` + declaración propia del fichero).
- **Compatibilidad**: `bun test ./.claude/hooks/` y `bun test ./.claude/evals/` verdes. Cap de la suite ≤50 casos.
- **Binario live**: el runner llama a `claude` literal; correr live exige PATH overlay a `~/.local/bin/claude` (`claude-binary-sandbox-path`).

# Stakeholders

- **Oriol** — sufre el problema (estilo aplicado desigual), decide los hard gates, valida el outcome conductual en la próxima sesión.

# Open questions

- Ninguna bloqueante. Las 3 decisiones de alcance/research/validación se cerraron en el cuestionario (alcance = spec+evals+CLAUDE.md; research = interno+externo-narrow; validación = live baseline+post).

# Modelo conceptual / Detalle técnico

Tres niveles independientes que el feature ataca por separado:

1. **Spec** (`poneglyph.md`) — contenido del estilo. Lever: claridad, no-contradicción, seguibilidad, longitud.
2. **Oráculo** (`.claude/evals/`) — qué normas se vigilan mecánicamente. Lever: cobertura.
3. **Superficie always-loaded** (`CLAUDE.md` TL;DR) — el puntero al canon. Lever: sync sin duplicación.

Diagnóstico fundacional (a confirmar con baseline live): la suite pasa ≈100%, luego las normas cubiertas (openers prohibidos, BLUF, es-ES, confidence labels, skill-trigger) NO son las que se saltan. Las candidatas a "se salta" son las **sin cobertura**: anti-calque, anti-telegráfico, "structure earns its place" / anti-over-structuring, status-icons-solo-operativos, hard-preserves, "don't repeat / no closing summary". La revisión debe priorizar esas.
