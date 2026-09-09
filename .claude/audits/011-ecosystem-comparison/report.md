# Audit 011 — Poneglyph frente al ecosistema de skills para Claude Code (2026-09-03)

## Veredicto

Poneglyph está en el 1 % del ecosistema en **medición y guardarraíles** (evals deterministas, trinquete de presupuesto, doctor, gates de git/spawn, adaptadores multi-host) y en el 99 % equivocado en **peso siempre cargado**: 53 KB por turno frente a la guía oficial de Anthropic ("keep it short… bloated CLAUDE.md files cause Claude to ignore your actual instructions") y frente al repo más estrellado de doctrina en un solo fichero (Karpathy, ~4,5 KB). Lo que los repos punteros hacen y nosotros no: distribuir como plugin, activar por comando explícito donde el auto-disparo falla, y ordenar las preguntas del interrogatorio por dependencias (Pocock). Lo que nosotros hacemos y casi nadie: medir.

El barrido sistemático posterior (38 repos por categorías, nueve expertos con cita textual) no cambia el veredicto: lo afila. Los proyectos con más estrellas **y** con números publicados son los mínimos (Karpathy, ponytail, caveman); los únicos que miden resultado lo hacen con sesiones headless en Haiku sobre un repo real, que es justo lo que el plan 033 obliga desde hoy; y aparecen tres huecos concretos y baratos: coste real por modelo y día (ccusage), compresión de la salida de herramientas (rtk) y una prueba con/sin poneglyph que diga con datos si los 53 KB se pagan (A8–A10).

## Método y calidad de los datos

| Dato | Cómo se obtuvo | Tier (research-rigor) |
|---|---|---|
| Estrellas, forks, fechas | `gh api repos/<owner>/<repo>` el 2026-09-03 | T1 (fuente primaria, hoy) |
| Qué hace cada repo | README / SKILL.md leídos con WebFetch; frases entrecomilladas | C (autodescripción del autor) |
| Doctrina de referencia | `code.claude.com/docs/en/best-practices` (oficial) | B (vendor, autoritativo para la herramienta) |
| Cifras de poneglyph | `bun run budget`, `ls .claude/skills`, suite | T1 |
| Barrido de repos | `gh api search/repositories` con `topic:claude-code` y dos consultas por palabras, por estrellas (60 + 30 + 30 resultados), más 38 repos consultados uno a uno; filtrado a mano a "capa que mejora el uso de Claude Code" (fuera: agentes completos, routers, skills de dominio) | T1 para cifras; el filtro es criterio del auditor |
| Matriz de características | `feature-matrix.ts` (en este directorio): árbol completo de cada repo por `gh api repos/<r>/git/trees/HEAD?recursive=1` (ninguno truncado) y `git ls-files --cached --others --exclude-standard` en poneglyph; recuento por rutas con expresiones regulares (`SKILL.md`, `commands/*.md`, `agents/*.md`, `hooks/`, `.mcp.json`, `settings*.json`…); capacidades por README y rutas. Salida cruda: `feature-matrix.md` | T1 (recuentos) · C (capacidades) |
| Tesis de expertos | Tips de Boris Cherny recopilados en `shanraisshan/claude-code-best-practice` (cada tip enlaza a su tuit), post de Anthropic Engineering, posts de Willison y Ronacher, READMEs de Pocock, Osmani, Vincent, Tan, Gebert y Yegge | A/B (post propio del autor); la recopilación de Cherny es secundaria pero enlaza la fuente |

Descartado: los resúmenes de buscadores daban cifras de estrellas que no cuadraban con la API (p. ej. "227,6k" para superpowers frente a 281 225 reales); solo cuentan las de la API. Ningún repo publica coste de tokens por turno medido; las afirmaciones de ahorro (caveman "65–75 %") son del autor, no verificadas aquí.

## Origen de drillme

| Skill | Autor | Primera fecha pública | Mecánica | Estrellas del repo |
|---|---|---|---|---|
| `grill-me` → `grilling` | Matt Pocock (`mattpocock/skills`) | **2026-02-25** (ruta raíz `grill-me/`; hoy `skills/productivity/grilling`, `grill-me` es un envoltorio) | "Interview the user relentlessly until you reach a shared understanding." **Árbol de diseño**: cada decisión abre las que cuelgan de ella; se pregunta por **rondas** solo la **frontera** (lo que ya no depende de nada abierto), cada pregunta numerada **con respuesta recomendada**; los hechos los busca el agente (sub-agente), las decisiones son del usuario; termina cuando la frontera está vacía. `disable-model-invocation: true` (solo por comando) | 246 846 |
| `grillme` | Jekudy | 2026-03-16 | Tres olas (superficie 3–5 preguntas, aclaración 2–4, profunda 1–3), lentes estratégica/sistémica/psicológica/abogado del diablo, seguimiento de supuestos verificados/no verificados, resumen final | 42 |
| `interview-me` | Addy Osmani (`addyosmani/agent-skills`) | repo 2026-02 (fecha de la skill sin verificar) | "Requirements interrogation, one question at a time"; se instala suelta con `npx skills add … --skill interview-me` | 91 949 |
| `drillme` | poneglyph (este repo) | 2026-05-28 (`d30b2d1`) | **Gap gate** (0 preguntas si nada cambia la decisión), checklist de cobertura (4 categorías canónicas + aspectos laterales), rondas embudo, clasificación de respuestas, **integrar las respuestas en el artefacto**, bancos por fase de /flow. Fuentes citadas en el commit: Socratic Prompt Method (Jaseci Labs 2026), Towards AI 2025, patrón `/speckit.clarify` de `github/spec-kit`. No cita ni grill-me ni grillme | 0 |

Conclusión `[Probable — primera fecha encontrada en GitHub]`: el creador del concepto público "grill-me" es Matt Pocock (febrero 2026); el `grillme` de Jekudy y el `interview-me` de Osmani son variantes posteriores o paralelas; el `drillme` de poneglyph es un diseño independiente que converge en la misma idea con más maquinaria. Lo que Pocock tiene y nosotros no: el **orden por frontera** (una pregunta cuya respuesta depende de otra abierta va a la ronda siguiente) y la regla "los hechos son trabajo del agente, nunca del usuario" como mecanismo (sub-agente), no como consejo. Lo que nosotros tenemos y él no: la puerta de cero preguntas, la cobertura por categorías y el volcado de respuestas al artefacto.

## Panorama: los repos que marcan el estándar

| Repo | Estrellas (2026-09-03) | Creado | Enfoque | Activación | Gates / calidad | Mide algo |
|---|---|---|---|---|---|---|
| `obra/superpowers` (Jesse Vincent) | 281 225 | 2025-10 | 14 skills de metodología (brainstorming, writing-plans, TDD, systematic-debugging, verification-before-completion, code review…); "Evidence over claims" | Hook de arranque + flujos obligatorios: "checks for relevant skills before any task" | TDD red-green, review en dos etapas, "verification-before-completion" | Tests de comportamiento (según README); telemetría de versión opcional |
| `affaan-m/everything-claude-code` (ECC) | 246 928 | 2026-01 | 68 agentes, **286 skills**, rules por lenguaje, hooks, memoria portable; "Optimize the context window. Persist everything else." | Comandos con espacio de nombres `/ecc:*` + hooks | AgentShield (escanea prompts, hooks, MCP, permisos, secretos); perfiles de hooks minimal/standard/strict | Sin coste medido; skills de "eval-harness" y "verification-loop" |
| `mattpocock/skills` | 246 846 | 2026-02 | ~20 skills "small, easy to adapt, and composable"; instalación **selectiva** | Split explícito: user-invoked (`/grill-me`, `/triage`) vs model-invoked | TDD, code-review, `to-spec`; grilling antes de construir | No |
| `forrestchang/andrej-karpathy-skills` | 209 859 | 2026-01 | **Un solo CLAUDE.md** (~750 palabras): "Don't assume. Don't hide confusion. Surface tradeoffs."; "Every changed line should trace directly to the user's request." | Siempre cargado | 7 reglas; criterios de éxito verificables antes de empezar | No |
| `anthropics/skills` | 173 542 | 2025-09 | Skills oficiales + especificación del formato (`name` + `description` como disparador) | Descripción | — | — |
| `garrytan/gstack` | 131 109 | 2026-03 | 23 skills-rol encadenadas (Think → Plan → Build → Review → Test → Ship → Reflect): `/plan-eng-review` produce la matriz que `/qa` consume | **Comandos explícitos**; sugerencia por etapa desactivable | `/review`, `/cso` (OWASP + STRIDE, umbral 8/10), `/qa` con navegador real, cobertura en cada `/ship` | Telemetría opt-in (skill, duración, éxito); no coste |
| `github/spec-kit` | 133 288 | 2025-08 | Spec-driven development; `/speckit.clarify` es el patrón "respuestas al artefacto" que drillme cita | Comandos | Spec → plan → tasks con gates | No |
| `JuliusBrussee/caveman` | 102 988 | 2026-04 | Un skill de ~1 100 palabras que recorta la prosa de salida ("why use many token when few token do trick"); conserva código, errores, números; se apaga en avisos de seguridad y secuencias | Toggle por sesión | — | Afirma 65–75 % menos tokens de salida (no verificado) |
| `gsd-build/get-shit-done` (archivado 2026-06, sigue en `open-gsd/gsd-core`) | 64 606 | 2025-12 | Contexto limpio por fase (plan / execute / review), meta-prompting | Comandos | Verificación por fase | No |
| `ruvnet/claude-flow` | 70 328 | 2025-06 | Enjambres multi-agente, memoria adaptativa | Orquestador propio | — | — |
| Listas: `ComposioHQ/awesome-claude-skills` 74 390 · `hesreallyhim/awesome-claude-code` 53 451 · `travisvn/awesome-claude-skills` 14 950 | | | Directorios | | | |

Lo que dice la guía oficial (`best-practices`), literal: "CLAUDE.md is loaded every session, so only include things that apply broadly. For domain knowledge or workflows that are only relevant sometimes, use skills instead." · "For each line, ask: *Would removing this cause Claude to make mistakes?* If not, cut it." · "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic." · "If you emphasize many lines, none of them stands out." · Sobre el plan mode: "If you could describe the diff in one sentence, skip the plan."

## Barrido sistemático: el resto del ecosistema por categorías

Renombres que la API resuelve y conviene conocer: `everything-claude-code` → `affaan-m/ECC`, `claude-flow` → `ruvnet/ruflo`, `forrestchang/andrej-karpathy-skills` → `multica-ai/andrej-karpathy-skills` (mismas estrellas).

| Categoría | Repo | Estrellas | Creado | Qué hace (según su README) | Publica una medida |
|---|---|---|---|---|---|
| Doctrina mínima | `DietrichGebert/ponytail` | 123 139 | 2026-06 | Una skill: el "senior más perezoso de la sala"; código mínimo; `<!-- ponytail: … -->` marca el recorte deliberado | **Sí, con método**: sesión headless de Claude Code sobre `full-stack-fastapi-template`, 12 tickets, n=4, Haiku 4.5, puntuado sobre el `git diff`: −54 % LOC, −22 % tokens, −20 % coste, 100 % seguro. Control caveman: −20 % LOC pero **+7 % tokens** |
| Doctrina mínima | `multica-ai/andrej-karpathy-skills` | 209 860 | 2026-01 | Un CLAUDE.md de ~750 palabras | No |
| Método por ciclo | `addyosmani/agent-skills` | 91 949 | 2026-02 | 25 skills y 9 comandos por fase: `/spec /plan /build /test /constraints /review /webperf /code-simplify /ship`; "Tests are proof"; skills que también se activan por contexto ("designing an API triggers `api-and-interface-design`"); `/build auto` "removes the human stepping between tasks, not the verification" | No |
| Método por ciclo | `bmad-code-org/BMAD-METHOD` | 52 645 | 2025-04 | Agile AI-Driven Development: "right-sized process", decisiones explícitas que se conservan como contexto; instalador `npx` | No |
| Método por ciclo | `SuperClaude-Org/SuperClaude_Framework` | 23 866 | 2025-06 | Comandos, personas cognitivas y flags | No |
| Método por ciclo | `coleam00/context-engineering-intro` | 13 822 | 2025-07 | Plantilla PRP de context engineering | No |
| Referencia | `shanraisshan/claude-code-best-practice` | 65 581 | 2025-10 | Índice vivo de las features oficiales y recopilación de los tips de Boris Cherny con enlace a cada tuit | — |
| Planes en disco | `OthmanAdi/planning-with-files` | 26 611 | 2026-01 | `task_plan.md`, `findings.md`, `progress.md` reinyectados por un hook `UserPromptSubmit`; sobreviven a `/clear` y a la compactación | **Sí** (del autor): reanuda en 5,0 turnos frente a 13,3 sin ficheros; 706 tests; "3 out of 3 blind A/B wins" |
| Memoria | `thedotmack/claude-mem` | 93 093 | 2025-08 | Memoria persistente entre sesiones; por defecto **alojada** (CMEM Pro, alta por email), observador local opt-in | No |
| Memoria | `gastownhall/beads` (Steve Yegge) | 26 850 | 2025-10 | Tracker de issues en grafo (Dolt) como memoria estructurada; `bd remember`; "do not create MEMORY.md files" | No |
| Memoria y coste | `mksglu/context-mode` | 20 335 | 2026-02 | MCP que sandboxea la salida de herramientas (315 KB → 5,4 KB) y "think in code": el agente escribe el script que cuenta en vez de leer 50 ficheros; continuidad por SQLite/FTS5 | Cifras del autor |
| Coste de herramientas | `rtk-ai/rtk` | 78 439 | 2026-01 | Proxy en Rust que comprime la salida de 100+ comandos antes de que la lea el agente; aviso propio: "not the same as cutting your bill by 90 %", tokens estimados como `bytes/4` | Porcentaje por comando |
| Coste de herramientas | `headroomlabs-ai/headroom` | 68 790 | 2026-01 | Comprime salidas, logs, ficheros y chunks RAG antes del LLM | Cifras del autor |
| Observabilidad | `ccusage/ccusage` | 18 319 | 2025-05 | Coste y tokens por día, sesión y modelo leyendo los JSONL locales de Claude Code | — |
| Observabilidad | `jarrodwatts/claude-hud` | 27 810 | 2026-01 | Plugin de statusline: uso de contexto, herramientas activas, agentes, todos | — |
| Observabilidad | `sirmalloc/ccstatusline` | 12 752 | 2025-08 | Statusline configurable (la que ya usa esta máquina) | — |
| Orquestación | `Yeachan-Heo/oh-my-claudecode` | 38 979 | 2026-01 | Multi-agente "teams-first": "Don't learn Claude Code. Just use OMC." | No |
| Orquestación | `ruvnet/ruflo` | 70 329 | 2025-06 | Enjambres | No |
| Distribución multi-host | `wshobson/agents` | 39 385 | 2025-07 | 94 plugins, 202 agentes, 183 skills, 105 comandos; una fuente Markdown para Claude Code, Codex, Cursor, OpenCode, Antigravity y Copilot | No |
| Distribución | `anthropics/claude-plugins-official` | 35 867 | 2025-11 | Directorio oficial; nombres de plugin inmutables; formulario de admisión | — |
| Distribución | `davila7/claude-code-templates` | 30 513 | 2025-07 | `npx` que instala agentes, comandos, hooks, settings y MCPs sueltos | No |
| Catálogos de vendor | `vercel-labs/agent-skills` 30 792 · `openai/skills` 25 376 | | 2025-11/12 | Skills oficiales de Vercel y de Codex; `npx skills add` instala en 70+ agentes | — |
| Bundles | `VoltAgent/awesome-agent-skills` 33 700 (1 000+) · `alirezarezvani/claude-skills` 25 474 (380) | | 2025-10 | Catálogos masivos | No |
| Inteligencia de código | `Graphify-Labs/graphify` | 114 294 | 2026-04 | Grafo de conocimiento por tree-sitter con aristas `EXTRACTED`/`INFERRED`; `/graphify .` | No |
| Inteligencia de código | `colbymchenry/codegraph` 69 430 · `DeusData/codebase-memory-mcp` 42 046 · `oraios/serena` 28 783 | | | Grafos e índices semánticos vía MCP | — |
| Calidad de salida | `Leonxlnx/taste-skill` 83 998 · `blader/humanizer` 41 277 · `Nutlope/hallmark` 27 958 | | 2026 | Anti-slop en interfaces y en prosa | No |

Fuera del estudio por no ser capa de uso de Claude Code: `NousResearch/hermes-agent` 240 697 (otro agente), `farion1231/cc-switch` 130 920 (conmutador de proveedores), routers y proxies (`musistudio/claude-code-router` 37 048, `router-for-me/CLIProxyAPI` 50 160, OmniRoute), skills de dominio (marketing, ciencia, búsqueda de empleo).

## Lo que dicen los expertos y cómo queda poneglyph

| Experto | Fuente (fecha) | Tesis, en sus palabras | Poneglyph |
|---|---|---|---|
| Boris Cherny, creador de Claude Code | 13 tips (X, 2026-01-03) y 6 tips (2026-04-16), recopilados en `claude-code-best-practice` | Setup "surprisingly vanilla". Un CLAUDE.md compartido en git: "Anytime Claude does something incorrectly, add it to the CLAUDE.md". Plan mode al empezar. Slash commands para el "inner loop". Pocos subagentes (`code-simplifier`, `verify-app`). Hook `PostToolUse` para formatear. `/permissions` en vez de `--dangerously-skip-permissions`. "Give Claude a way to verify its work… it will 2–3x the quality of the final result." Opus con thinking para lo interactivo | Hace todo eso (plan, verify, comandos, permisos, gates). La diferencia es el volumen: su CLAUDE.md crece una regla por error; el nuestro son 13,5 KB de doctrina y 12,7 KB de estilo |
| Anthropic Engineering | *Effective context engineering for AI agents* (2025-09-29) | "finding the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome" · "attention budget" que se agota con el tamaño del contexto · recuperación "just-in-time" con identificadores ligeros frente a precargar · "right altitude": ni lógica frágil ni consejo vago | Skills bajo demanda = just-in-time ✅. 53 KB siempre cargados = attention budget gastado en cada turno ❌ |
| Simon Willison | *Claude Skills are awesome* (2025-10-16) | "each skill only takes up a few dozen extra tokens, with the full details only loaded in should the user request a task that the skill can help solve" | Las 30 descripciones suman 21,2 KB ≈ 5 300 tokens: ~175 tokens por skill, entre 4 y 7 veces "a few dozen" |
| Armin Ronacher | *Agentic Coding Recommendations* (2025-06-12) | "Tools need to be fast. The quicker they respond (and the less useless output they produce) the better" · logs a fichero · "the dumbest possible thing that will work" · ecosistemas estables con poco churn | Bash-first y doctor rápido ✅. Ninguna compresión de la salida de herramientas ❌ |
| Andrej Karpathy (vía el repo de 210 k) | `CLAUDE.md` | "Don't assume. Don't hide confusion. Surface tradeoffs."; criterios de éxito verificables antes de empezar | Los mismos principios en Cmd I–III y el bucle, con 20 veces más bytes |
| Matt Pocock | `mattpocock/skills` | Skills "small, easy to adapt, and composable"; split explícito user-invoked / model-invoked; `grilling` | Origen de drillme; A1–A2 |
| Addy Osmani | `addyosmani/agent-skills` | Comandos por fase del ciclo; "Tests are proof"; `interview-me`; la autonomía quita al humano entre tareas, "not the verification" | Equivale a /flow + verify; tercera convergencia independiente en el interrogatorio |
| Jesse Vincent (superpowers) · Garry Tan (gstack) | READMEs | "Evidence over claims"; flujos obligatorios; roles encadenados por comandos explícitos | A la par (tabla anterior) |
| Dietrich Gebert (ponytail) | README y `benchmarks/results/2026-06-18-agentic.md` | Mide con sesiones headless en Haiku 4.5, n=4, repo real, puntuando el diff | El método que el plan 033 obliga desde hoy; poneglyph ya adaptó ponytail en `dev` (MIT, citado) |
| Steve Yegge (beads) | README | Memoria en grafo con dependencias en vez de planes en markdown; "do not create MEMORY.md files" | Contrario a nuestra memoria-como-caché en ficheros; para un usuario y repos medianos el fichero basta y es auditable |

## Hallazgos del barrido

| Ref | Hallazgo | Evidencia |
|---|---|---|
| H1 | El top del ecosistema es bimodal: doctrina mínima de un fichero o una skill (Karpathy 210 k, ponytail 123 k, caveman 103 k) o bundles enormes (ECC 247 k, wshobson 39 k). El peso siempre cargado de poneglyph no tiene par en ninguno de los dos polos | Tabla de categorías |
| H2 | Solo tres proyectos publican una medida de resultado con método: ponytail (headless Haiku, n=4, repo real), planning-with-files (A/B propio, 706 tests) y rtk (porcentaje por comando, con aviso). Poneglyph mide activación y presupuesto, no resultado: no existe un número "con/sin poneglyph" sobre un repo real | READMEs; `.claude/evals/` |
| H3 | El creador de la herramienta trabaja "vanilla": CLAUDE.md compartido que crece una regla por error, plan mode, comandos, pocos subagentes, verificación. Poneglyph hace lo mismo con un orden de magnitud más de texto por turno | Cherny 2026-01-03 |
| H4 | Coste de las descripciones: ~175 tokens por skill frente a "a few dozen" (Willison); 30 skills ≈ 5 300 tokens por turno solo en descripciones | `bun run budget` (21,2 KB) |
| H5 | Poneglyph ya absorbe del ecosistema con criterio: ponytail → `dev` (MIT, 2026-08), graphify → skill más memo de decisión (2026-06-22: no para la capa, sí para repos de trabajo grandes), `/speckit.clarify` → drillme. A1–A3 continúan ese hábito | `skills/dev/SKILL.md:29`, `docs/graph-tooling-decision.md` |
| H6 | El interrogatorio previo al diseño es una categoría validada por convergencia independiente: `grilling` (Pocock), `interview-me` (Osmani), `/speckit.clarify` (GitHub), `grillme` (Jekudy), `drillme` (poneglyph) | Tabla de origen |
| H7 | La memoria alojada por defecto (claude-mem) choca con la regla de este repo de que lo de empresa no sale de la máquina; las alternativas locales (beads, planning-with-files, nuestro `memory/`) no chocan | README de claude-mem |

## Matriz de características

Quince proyectos y poneglyph, todo lo que aporta valor a un agente: componentes de Claude Code, método, memoria, modelo y coste, seguridad, configuración, otras IAs, MCP, herramientas y distribución. `get-shit-done` queda fuera: archivado, su sucesor `open-gsd/gsd-core` tiene 9 079 estrellas (2026-05). Los recuentos de ECC, Pocock, gstack y SuperClaude superan lo que declara su README porque el árbol incluye espejos por harness, wrappers o catálogos; se dan ambos.

### Componentes (ficheros contados en el árbol, 2026-09-03)

| Componente | poneglyph | superpowers | ECC | Pocock | Karpathy | gstack | Osmani | wshobson | spec-kit | BMAD | OMC | SuperClaude | davila7 | caveman | ponytail |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Skills (`SKILL.md`) | 30 | 14 | 898 (README 286) | 37 (README ~20) | 1 | 61 (README 23+8) | 25 | 183 | 1 | 60 | 36 | 9 | 899 (catálogo) | 24 | 12 (variantes por host) |
| Comandos slash (`commands/*.md`) | 5 | 0 | 424 (94 shims) | 0 | 0 | 0 | 9 | 105 | 36 | 0 | 21 | 61 (README 30) | 47 | 7 | 0 |
| Subagentes (`agents/*.md`) | 0 | 0 | 307 (README 68) | 0 | 0 | 0 | 4 | 202 | 0 | 2 | 21 | 42 (README 20) | 26 | 6 | 0 |
| Hooks (ficheros) | 5 (4 eventos) | 3 | 76 | 0 | 0 | 6 | 7 | 2 | 0 | 0 | 41 | 3 | 5 | 10 | 10 |
| Rules (`rules/*.md`) | 5 | 0 | 430 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 7 | 0 | 213 | 2 | 3 |
| Output style | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Statusline (rutas) | 3 | 0 | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 69 | 2 | 2 |
| `settings*.json` entregado | 3 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 5 | 0 | 0 |
| CLAUDE.md / AGENTS.md | 1 / 1 | 1 / 1 | 12 / 14 | 1 / 1 | 1 / 0 | 2 / 2 | 1 / 2 | 1 / 2 | 0 / 1 | 1 / 6 | 3 / 10 | 1 / 5 | 13 / 6 | 18 / 13 | 0 / 1 |
| Manifest de plugin | 0 (plugin privado aparte) | 2 (+Codex, Cursor, Devin, Kimi) | 2 (+Codex) | 2 | 2 | 0 | 2 (+Codex) | 93 | 0 | 1 | 2 | 1 | 1 | 2 | 2 |
| MCP (`.mcp.json` / rutas) | 0 (`.mcp.json` vacío; docs para crearlos) | 0 | `.mcp.json` + 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | `.mcp.json` + 151 | 48 (README 8) | 272 | 32 | 0 |
| Tests del propio sistema | 29 | 60 | 284 | 0 | 0 | 760 | 7 | 37 | 169 | 43 | 3 446 | 14 | 24 | 243 | 20 |
| Evals / benchmarks | 16 | 0 | 3 | 0 | 0 | 3 | 75 | 0 | 0 | 0 | 80 | 0 | 1 004 | 37 | 35 |
| CI (workflows) | 1 | 0 | 11 | 1 | 0 | 14 | 1 | 6 | 25 | 5 | 8 | 6 | 15 | 8 | 2 |
| Memoria (rutas) | 1 | 0 | 18 | 0 | 0 | 15 | 0 | 9 | 1 | 1 | 144 | 12 | 18 | 2 | 0 |
| Planes / plantillas | 121 | 19 | 2 | 0 | 0 | 14 | 0 | 17 | 32 | 79 | 48 | 1 | 152 | 0 | 0 |
| Scripts / bin | 35 | 12 | 361 | 5 | 0 | 178 | 14 | 7 | 34 | 33 | 107 | 14 | 832 | 55 | 5 |
| Docs | 12 | 43 | 1 536 | 25 | 0 | 50 | 14 | 10 | 40 | 200 | 50 | 126 | 128 | 44 | 2 |
| Ficheros totales | 414 | 195 | 3 519 | 164 | 9 | 1 526 | 195 | 1 167 | 556 | 639 | 6 812 | 409 | 9 240 | 1 381 | 159 |

### Capacidades (sí · parcial · no · ? = sin evidencia en README ni rutas)

| Capacidad | poneglyph | superpowers | ECC | Pocock | Karpathy | gstack | Osmani | wshobson | spec-kit | BMAD | OMC | SuperClaude | davila7 | caveman | ponytail |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Flujo de desarrollo por fases | sí (KNOW→LEARN, /flow) | sí | sí | parcial (skills sueltas, a propósito) | no | sí | sí | no | sí | sí | sí | sí | no | no | no |
| Spec o plan antes del código | sí | sí | sí | parcial | parcial | sí | sí | no | sí | sí | sí | sí | no | no | no |
| Interrogatorio previo | sí (drillme) | sí | ? | sí (grilling) | no | parcial | sí (interview-me) | ? | sí (clarify) | parcial | ? | ? | no | no | no |
| TDD / tests como prueba | sí | sí | sí | sí | no | sí | sí | parcial | parcial | parcial | sí | ? | ? | no | no |
| Review independiente | sí (critic) | sí | sí | sí | no | sí | sí | sí | ? | parcial | parcial | ? | parcial | no | no |
| Verificación antes de "hecho" | sí (verify) | sí | sí | parcial | sí | sí | sí | no | parcial | parcial | sí | ? | ? | no | no |
| Retro / aprendizaje persistente | sí (LEARN, lessons) | no | sí | no | no | sí (/reflect) | no | no | no | parcial | parcial | parcial | no | no | no |
| Memoria entre sesiones | sí (caché + planes + post-compact) | no | sí | no | no | ? | no | ? | parcial | parcial | sí | parcial | parcial | no | no |
| Hooks deterministas | sí (4 eventos) | sí | sí | no | no | sí | sí | parcial | no | no | sí | parcial | sí | sí | sí |
| Subagentes definidos | no (roles como skills) | parcial | sí | no | no | no | sí | sí | no | sí | sí | sí | sí | sí | no |
| Gate de permiso y modelo para spawns | sí | no | ? | no | no | ? | ? | ? | no | ? | no | ? | ? | no | no |
| Routing de modelo y coste | sí (tiers, headless barato, trinquete) | no | ? | no | no | parcial | no | no | no | ? | sí | no | no | no | no |
| Medición del propio sistema | sí (activación, presupuesto; sin A/B) | parcial | parcial | no | no | parcial | parcial | no | no | no | parcial | no | ? | sí (afirmado) | sí (A/B con método) |
| Seguridad (gates, secretos, auditoría) | sí | ? | sí (AgentShield) | no | no | sí (/cso) | parcial | sí | no | no | parcial | no | sí | parcial | no |
| Configuración de Claude entregada | sí (31 claves: permisos 14/20/2, estilo, statusline, attribution, plugins) | no | parcial | no | no | no | no | no | no | parcial | parcial | parcial | sí (catálogo) | no | no |
| Estilo de salida / voz | sí (output style es-ES) | no | no | no | parcial | no | no | no | no | no | no | parcial (modes) | parcial | sí | no |
| Otras IAs (multi-host) | parcial (Codex, Grok, Pi) | sí (14) | sí (Codex + 8 adaptadores) | parcial | parcial | sí | sí (70+) | sí (6) | sí (15+) | sí | no | no | no | sí | sí |
| Modelo local | sí | no | parcial | no | no | no | no | no | no | no | no | no | parcial | no | no |
| MCP integrados | no | no | sí | no | no | no | no | no | no | no | sí | sí (8) | sí (catálogo) | ? | no |
| Worktrees / paralelismo | parcial (config) | sí | sí | no | no | parcial | no | no | no | no | sí | no | parcial | no | no |
| Prompt engineering interno | sí | no | ? | no | no | no | no | sí | no | no | ? | no | sí | no | no |
| Investigación con rigor | sí (deep-research, tiers) | no | sí | parcial | no | no | no | no | no | parcial | sí | sí | sí | no | no |
| Distribución | repo + sync + plugin privado | plugin oficial | npx / plugin | plugin oficial / npx skills | copiar un fichero | clone + setup | plugin / npx skills | marketplace / gh skill | CLI `specify` | `npx bmad-method` | plugin / npm | pipx | npx | plugin / npx | plugin / npx |

### Lectura de la matriz

| Ref | Lectura |
|---|---|
| M1 | **Solo poneglyph** tiene: output style propio, `settings.json` completo entregado (permisos allow/deny/ask, attribution, statusline, plugins), gate de permiso y modelo para spawns, routing de coste con guard mecánico y evals deterministas de activación. davila7 también entrega settings, pero como catálogo a elegir |
| M2 | **Poneglyph va por detrás** en subagentes definidos (0 frente a 68–202; por diseño: roles como skills y agentes genéricos con gate), MCP integrados (0; llegan por conectores de claude.ai y plugins), multi-host (parcial frente a 6–15 hosts), manifest de plugin público (0) y worktrees (solo en configuración) |
| M3 | **A la par** en método: flujo por fases, spec antes de código, interrogatorio, TDD, review, verificación, hooks y memoria. Aquí el ecosistema converge y nadie destaca |
| M4 | **Tamaño**: 414 ficheros y 30 skills es rango medio (superpowers 195, Osmani 195, Pocock 164; ECC 3 519, OMC 6 812, davila7 9 240; Karpathy 9). El problema de poneglyph no es el número de piezas sino los bytes que carga en cada turno |

## Poneglyph frente al conjunto

| Dimensión | Ecosistema (lo mejor visto) | Poneglyph hoy | Lectura |
|---|---|---|---|
| Activación de skills | superpowers: hook de arranque + flujo obligatorio · gstack y Pocock: comandos explícitos donde el auto-disparo falla | Hook `skill-activation` (precisión primero, silencioso), tabla de routing siempre cargada, `skill-advisor`, `/flow` determinista; medido: disparo nativo 8/11 en sondas, 3/4 en evals | A la par; la diferencia es que nosotros **medimos** el disparo y ellos no. La vía "comando explícito" de gstack/Pocock es la respuesta al mismo problema que G12 |
| Gates y seguridad | ECC AgentShield · superpowers verification-before-completion · gstack `/cso` | Gate git/PR y spawn (doctrina + Stop hook + `permissions.ask`), sin autoría de IA por `attribution`, hook headless-model-gate, security-gate de secretos | Más gates que cualquiera; casi todos advisory salvo los hooks. Igual que el ecosistema: nadie bloquea del todo |
| Medición | superpowers: tests de comportamiento · gstack: telemetría opt-in · resto: nada | 20 evals deterministas (sin juez LLM), trinquete de presupuesto, doctor de 7 filas, sondas de activación, 429 tests | **Ventaja clara y rara**. Nadie del top publica coste por turno |
| Peso siempre cargado | Karpathy 4,5 KB · guía oficial: "keep it short" · ECC: rules por packs selectivos · superpowers: hook + 14 descripciones | **53 KB** (CLAUDE.md 13,5 + style 12,7 + rules 3,5 + 30 descripciones 21,2 + plugin 2,4) | El punto débil. La propia guía de Anthropic dice que el exceso hace que se ignoren instrucciones; V1 sigue abierta |
| Tamaño del catálogo | Pocock ~20 · superpowers 14 · gstack 23 · ECC 286 | 30 + 3 en plugin privado | Rango sano; el problema no es el número sino los bytes por descripción (~700 B de media frente a ~150–300 B típicos) |
| Multi-host | ECC y wshobson: instaladores por harness · gstack: 10 agentes | Codex (AGENTS.md + 5 skills), Grok (compat + twin), Pi (append) | A la par en alcance; ellos usan instaladores, nosotros junctions + sync con validación |
| Distribución | Plugin/marketplace (superpowers, Pocock, ECC) · `npx` (ECC) · `git clone` + setup (gstack) | Repo + `sync-claude.ts` (junctions) + plugin privado para lo de empresa | Funciona, pero cada máquina repite pasos; el ecosistema converge en plugin |
| Interrogatorio | Pocock `grilling`: frontera + respuesta recomendada + hechos por sub-agente | drillme: gap gate + cobertura + rondas + volcado al artefacto | Complementarios: el orden por frontera es la mejora concreta que podemos tomar |
| Memoria y planes en disco | claude-mem (alojada), beads (grafo), planning-with-files (3 ficheros + hook) | `memory/` como caché con índice, `plans/NNN-*/`, hook `post-compact`, `lessons` | A la par y local por diseño; sin A/B publicado |
| Coste de la salida de herramientas | rtk (hasta −90 % de salida bash), context-mode (sandbox + "think in code"), headroom | Nada: el Lead lee la salida cruda | **Hueco** barato de cerrar y medir |
| Observabilidad del gasto | ccusage (coste por día y modelo desde los JSONL), claude-hud (contexto en vivo) | Doctor: sesiones del día por modelo (033); ccstatusline | Hueco: el coste por modelo lo da ccusage en un comando y habría hecho visible el incidente de las 82 sesiones el mismo día |
| Medida de resultado | ponytail y planning-with-files publican un A/B con método | `compare.ts` existe para el estilo; ningún número con/sin poneglyph sobre un repo real | Hueco que decidiría V1 con datos en vez de opinión |

## Qué aportaría valor sin romper nada

| Ref | Adopción | De dónde | Coste / riesgo | Recomendación |
|---|---|---|---|---|
| A1 | drillme: ordenar cada ronda por **frontera** (solo preguntas cuyas dependencias están resueltas; las dependientes van a la ronda siguiente) y llevar siempre la **respuesta recomendada** por pregunta como regla, no como costumbre | Pocock `grilling` | Un párrafo en `drillme/SKILL.md` Step 3; sin código | **Sí**, ahora |
| A2 | "Los hechos los busca el agente; las decisiones son del usuario" como paso explícito del gap gate: antes de preguntar, Grep/Read; solo sube al usuario lo que no está en el repo | Pocock `grilling` + guía oficial ("Never ask what is discoverable", ya en CLAUDE.md §KNOW) | Una frase en drillme Step 1 | **Sí** |
| A3 | Poda de CLAUDE.md con la pregunta oficial "¿quitar esta línea causaría errores?", línea a línea, y mover a skills lo que solo aplica a veces | `best-practices`, Karpathy | Sesión corta de revisión con Oriol; riesgo: quitar doctrina que sí frena errores → cada corte con la evidencia de por qué sobra | **Sí**, es la vía D11-compatible para V1 |
| A4 | Publicar poneglyph como **plugin** (marketplace propio, como ya hace `poneglyph-work`) además del sync | superpowers, Pocock, ECC | `claude plugin validate .claude` ya pasa; hooks y skills irían en el manifest; los settings de usuario (permisos, style) seguirían necesitando el sync | Después; primero medir cuánto simplifica una instalación nueva |
| A5 | Fila del doctor con `claude plugin details` del plugin propio (coste always-on que reporta el host) | Host | 10 líneas | Sí, pequeño |
| A6 | Recorte de prosa de salida al estilo caveman para turnos mecánicos | caveman | Ya lo cubre el style §4 Cost; una regla más no cambia el comportamiento sin medir | No; medir primero con `compare.ts` |
| A7 | Bundles de cientos de skills, enjambres, listas "awesome" | ECC, claude-flow | Contra Cmd IX y contra la guía oficial | No |
| A8 | `npx ccusage daily --breakdown` (lee los JSONL locales, sin red) como fila del doctor o, al menos, como comando documentado en el README: coste por modelo y día | ccusage | Cero código propio; una dependencia `npx` | **Cubierto** (plan 037, 2026-09-09): `/usage` oficial + `bun run usage` + fila "Context (7d)" del doctor, sin dependencia `npx` |
| A9 | Probar `rtk` (o `context-mode`) una semana en trabajo real y medir con ccusage antes y después; adoptar solo si baja el input | rtk, Ronacher | Instalación y `rtk init`; riesgo: la compresión oculta detalles que el Lead necesita para diagnosticar, así que empezar por los comandos de solo lectura (`ls`, `git status`, `grep`) | Probar y medir |
| A10 | Un A/B "con/sin poneglyph" al estilo ponytail: 6–12 tareas reales sobre un repo de referencia, headless Haiku, n=3, puntuado sobre el diff y con los evals. Es la evidencia que decide V1 (A3) con datos | ponytail | 36–72 sesiones headless en Haiku con permiso previo, céntimos por sesión `[Probable — precio de lista de Haiku 4.5]`; método a documentar en `evals/README.md` | **Sí**, antes de podar CLAUDE.md a ciegas |
| A11 | Memoria alojada (claude-mem), orquestación multi-agente por defecto (oh-my-claudecode, ruflo) | — | Contra la regla de privacidad del repo y Cmd X | No |

## Fuentes

- Anthropic, *Best practices for Claude Code* — https://code.claude.com/docs/en/best-practices (2026-09-03)
- https://github.com/obra/superpowers · https://github.com/affaan-m/everything-claude-code · https://github.com/mattpocock/skills (`skills/productivity/grilling/SKILL.md`, `grill-me` historia desde 2026-02-25) · https://github.com/forrestchang/andrej-karpathy-skills (`CLAUDE.md`) · https://github.com/anthropics/skills · https://github.com/garrytan/gstack · https://github.com/github/spec-kit · https://github.com/JuliusBrussee/caveman (`skills/caveman/SKILL.md`) · https://github.com/gsd-build/get-shit-done · https://github.com/ruvnet/claude-flow · https://github.com/Jekudy/grillme-skill
- Barrido: https://github.com/DietrichGebert/ponytail (`benchmarks/results/2026-06-18-agentic.md`) · https://github.com/addyosmani/agent-skills · https://github.com/shanraisshan/claude-code-best-practice (`tips/claude-boris-13-tips-03-jan-26.md`, `tips/claude-boris-6-tips-16-apr-26.md`; tuit original https://x.com/bcherny/status/2007179832300581177) · https://github.com/OthmanAdi/planning-with-files · https://github.com/thedotmack/claude-mem · https://github.com/gastownhall/beads · https://github.com/mksglu/context-mode · https://github.com/rtk-ai/rtk · https://github.com/headroomlabs-ai/headroom · https://github.com/ccusage/ccusage · https://github.com/jarrodwatts/claude-hud · https://github.com/Yeachan-Heo/oh-my-claudecode · https://github.com/wshobson/agents · https://github.com/anthropics/claude-plugins-official · https://github.com/davila7/claude-code-templates · https://github.com/bmad-code-org/BMAD-METHOD · https://github.com/Graphify-Labs/graphify · https://github.com/Leonxlnx/taste-skill
- Expertos: Anthropic, *Effective context engineering for AI agents* (2025-09-29) — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents · Simon Willison, *Claude Skills are awesome, maybe a bigger deal than MCP* (2025-10-16) — https://simonwillison.net/2025/Oct/16/claude-skills/ · Armin Ronacher, *Agentic Coding Recommendations* (2025-06-12) — https://lucumr.pocoo.org/2025/6/12/agentic-coding/
- Estrellas y fechas: API de GitHub (`gh api repos/…` y `gh api search/repositories`), 2026-09-03.
- Poneglyph: `bun run budget`, `git log d30b2d1`, `.claude/plans/032-polish-pass/`.
