# Auto-activación de SKILLs en Claude Code (2026) — informe verificado

> Durable spec-input. Producido por un Workflow de 29 agentes (12 sweep web + 16 verify adversarial + síntesis), 2026-06-09.
> Stats: **12 CONFIRMED · 4 PARTIAL · 0 REFUTED · 0 UNVERIFIABLE.** Ninguna afirmación refutada de raíz; las refutaciones puntuales viven *dentro* de los 4 PARTIAL.
> Amplía el dossier previo `_research-skill-evolution-2026-05-29.md` Part A (que tenía solo 2 agentes de activación + un eval "directional" sin metodología). Verify every claim before building (Cmd II) — fuentes inline.

## TL;DR — cómo se auto-activan las skills (2026)

- **Es matching semántico del LLM, no un índice.** No hay embeddings/keyword-index/regex/registry: el modelo juzga la petición del usuario contra el texto `description` (+ `when_to_use`) que ya está en el system prompt. [CONFIRMED](https://code.claude.com/docs/en/skills)
- **Dos capas de límite de caracteres coexisten**: validación por campo (`name` ≤64, `description` ≤1024) y un cap de *listing* de Claude Code sobre `description`+`when_to_use` combinados = **1.536 chars** (`maxSkillDescriptionChars`). [CONFIRMED](https://code.claude.com/docs/en/skills)
- **Presupuesto dinámico de listing = 1% de la ventana de contexto** (`skillListingBudgetFraction`/`SLASH_COMMAND_TOOL_CHAR_BUDGET`); en overflow se **dropean primero las descriptions de las skills menos invocadas** — la frecuencia de uso afecta la matchabilidad. `/doctor` lo diagnostica. [CONFIRMED](https://code.claude.com/docs/en/skills)
- **El driver nº1 es la calidad de la `description`**: directiva ("ALWAYS invoke… Use when…") con triggers concretos > pasiva > vaga. Anthropic admite que Claude tiende a **infra-disparar** (undertrigger). [CONFIRMED](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)
- **Ningún mecanismo fuerza la activación.** Un hook solo *empuja* (inyecta hint); el control determinista real es `paths`, `disable-model-invocation` y `skillOverrides`. La no-determinación es de diseño. [CONFIRMED](https://code.claude.com/docs/en/skills)

## Mecanismo nativo (verificado)

| Aspecto | Hallazgo | Fuente (URL) | Credibilidad |
|---|---|---|---|
| Matching | LLM juzga la petición vs `description`+`when_to_use` en contexto. Sin embeddings/index/regex/retrieval. Selección vía el tool `Skill`. | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) · [platform overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) | oficial (CONFIRMED) |
| Progressive disclosure | L1 metadata (`name`+`description`, ~100 tok) siempre en system prompt; L2 cuerpo SKILL.md (<5k tok) carga al disparar; L3 recursos al referenciarse. | [platform overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) | oficial |
| Cap por campo (validación API) | `name` ≤64 (lowercase/números/guiones, sin XML, sin "anthropic"/"claude"); `description` no-vacía, ≤1024, sin XML. | [platform best-practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) | oficial (CONFIRMED) |
| Cap de listing (Claude Code) | `description`+`when_to_use` **combinados** truncados a **1.536 chars** (configurable `maxSkillDescriptionChars`). Distinto del 1024 por campo. Histórico: 250→1.536 en v2.1.105. | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) | oficial (CONFIRMED) |
| Presupuesto de listing | Names siempre incluidos; descriptions hasta **1% de la ventana de contexto**; overflow ⇒ se dropean primero las menos invocadas. `/doctor` diagnostica. ⚠️ El 1% se computa contra una baseline fija ~200K, así que en modelos de 1M de contexto el presupuesto efectivo es ~5x menor de lo que "1% de la ventana" sugiere. | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) · [issue #57941](https://github.com/anthropics/claude-code/issues/57941) | oficial + bug confirmado (CONFIRMED) |
| Campos frontmatter (16) | `name, description, when_to_use, argument-hint, arguments, disable-model-invocation, user-invocable, allowed-tools, disallowed-tools, model, effort, context, agent, hooks, paths, shell`. Solo `description` recomendado. | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) | oficial |
| `skills:` NO es campo de SKILL.md | Es frontmatter de **subagente** (precarga). Ponerlo en SKILL.md es un error de categoría. | [sub-agents](https://code.claude.com/docs/en/sub-agents) | oficial (CONFIRMED) |

**Campos que SÍ afectan activación**: `description`/`when_to_use` (driver primario; truncan a 1.536), `paths` (glob gate determinista), `disable-model-invocation:true` (mata auto-trigger + bloquea precarga en subagentes), `user-invocable` (solo menú UI, **NO** afecta activación). `allowed-tools`/`disallowed-tools`/`model`/`effort`/`context`/`agent`/`hooks`/`shell` no afectan activación (scoping/permisos).

## Palancas para subir activación, rankeadas por ROI

| # | Palanca | Efecto esperado | Coste/infra | Evidencia |
|---|---|---|---|---|
| 1 | **Description directiva con triggers** ("Use when…", extensiones de fichero, frases del usuario entrecomilladas, sinónimos) | El mayor delta verificado: directiva vs actual OR=20.6, p<0.0001 (~20x). Anthropic mejoró 5/6 skills con su optimizador. | cero (solo escribir) | [Seleznov 650-trials](https://medium.com/@ivan.seleznov1/why-claude-code-skills-dont-activate-and-how-to-fix-it-86f679409af1) (single-author, CONFIRMED como reportado) · [claude.com blog](https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills) (oficial, sin %) |
| 2 | **Descriptions "pushy"** (contra-undertrigger) | Anthropic recomienda explícitamente descripciones "un poco pushy" porque Claude **infra-dispara**. | cero | [skill-creator SKILL.md](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) (oficial, CONFIRMED — verbatim, blob SHA `65b3a40`) |
| 3 | **Cláusula de exclusión** ("Do NOT use for…") | Reduce over-trigger sin matar el disparo correcto; "la línea más importante" según destilados. | cero | [taste-skill](https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md) · [Generative Programmer](https://generativeprogrammer.com/p/skill-authoring-patterns-from-anthropics) (community/reputable) |
| 4 | **Higiene del presupuesto de listing** (consolidar, `skillOverrides: name-only` para low-priority, `/doctor`) | Evita que descriptions de skills menos usadas se dropeen y pierdan keywords. | bajo (config) | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) (oficial, CONFIRMED) |
| 5 | **`paths:` glob gate** | Restringe activación a ficheros que matchean — útil para skills de dominio. | bajo | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) ⚠️ ver anti-patterns: `paths` tiene bugs abiertos |
| 6 | **Hook UserPromptSubmit inyectando hint-list** | Solo *nudge*, nunca fuerza; degrada con phrasing pasivo (combinado con descriptions vagas cayó a 37%). | medio (script, mantenimiento de reglas) | [Spence](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably) · [paddo.dev](https://paddo.dev/blog/claude-skills-hooks-solution/) (community) |

> Las palancas 1-2 son **descripción**, coste cero, mayor efecto — y son lo que poneglyph debería priorizar sobre cualquier infra de hooks.

## Descripción canónica que funciona

**Guía verbatim oficial** (combinando [platform best-practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) + [skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)):

- **Tercera persona.** Bien: `"Processes Excel files and generates reports"`. Evitar: `"I can help you…"`, `"You can use this to…"`.
- **WHAT + WHEN, use-case primero** (sobrevive al truncado a 1.536): `"[verbos específicos de lo que hace]. Use when [contextos/keywords de disparo + extensiones + sinónimos]."`
- **"Pushy"** (verbatim skill-creator): *"currently Claude has a tendency to 'undertrigger' skills… To combat this, please make the skill descriptions a little bit 'pushy'."*
- **Toda la info de "when to use" en la description**, no en el cuerpo (regla skill-creator). Claude Code añade además el campo `when_to_use` (también frontmatter, no cuerpo — reconciliable).
- **Evitar** vago (`"Helps with documents"`, `"Processes data"`) y nombres genéricos (`helper`, `utils`, `tools`). Naming en gerundio (`processing-pdfs`).

Ejemplo oficial verbatim (PDF):
> `Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.`

**Plantilla concreta:**
```yaml
---
name: <gerundio-kebab>          # ≤64, lowercase/guiones, sin "claude"/"anthropic"
description: >-                  # ≤1024 por campo; combinado con when_to_use ≤1536
  <Qué hace, verbos específicos>. Use when <disparadores concretos: keywords,
  ".ext", frases que el usuario diría literalmente, síntomas/errores>.
  Make sure to use this skill whenever <contexto>, even if not asked explicitly.
  Do NOT use for <exclusión clara>.
when_to_use: >-                  # opcional: frases de ejemplo / triggers extra
  "<frase usuario 1>", "<frase usuario 2>"
---
```

## Anti-patterns de activación

| Por qué una skill NO se activa | Corrección | Fuente |
|---|---|---|
| Description enuncia capacidad sin "use when" (sin señal de CUÁNDO) | Añadir condiciones de disparo directivas | [skills docs](https://code.claude.com/docs/en/skills) (oficial) |
| Phrasing del usuario no matchea keywords de la description | Rephrase, o `/skill-name` directo; añadir sinónimos | [skills troubleshooting](https://code.claude.com/docs/en/skills) (oficial) |
| Presupuesto de listing en overflow ⇒ keywords dropeadas | `/doctor`; consolidar; `skillListingBudgetFraction` / `skillOverrides: name-only` | [skills docs](https://code.claude.com/docs/en/skills) (oficial) |
| `disable-model-invocation:true` | Es el kill-switch de auto-trigger por diseño; quitarlo si se quiere auto | [skills docs](https://code.claude.com/docs/en/skills) (oficial) |
| `skillOverrides: off / name-only / user-invocable-only` en settings | Revisar settings (default = `on`) | [skills docs](https://code.claude.com/docs/en/skills) (oficial) |
| Colisión de nombres (skill > command; enterprise>personal>project; `/skill` mata TODOS los commands) | Renombrar; namespacing en plugins | [issue #13586](https://github.com/anthropics/claude-code/issues/13586) (community) |
| YAML malformado / fichero no `SKILL.md` exacto / block-scalar `>`/`|` / perms WSL | `---` en línea 1; nombre exacto; `chmod -R 755` | [Agensi](https://www.agensi.io/learn/claude-code-skills-not-working-troubleshooting) (community) |
| Dos skills cubren la misma tarea ⇒ Claude usa la equivocada | Auditar y eliminar solapamiento | [Agensi](https://www.agensi.io/learn/claude-code-skills-not-working-troubleshooting) (community) |
| `paths:` no dispara al leer/editar fichero que matchea | **Bug abierto** (no hay corrección oficial) | [#62049](https://github.com/anthropics/claude-code/issues/62049) (OPEN, CONFIRMED, sin verificar por Anthropic) |
| `paths:` sin `description` ⇒ skill indescubrible | Añadir `description` siempre | [#49835](https://github.com/anthropics/claude-code/issues/49835) (OPEN) |
| Plugins con duplicados ⇒ descriptions vacías ⇒ sin trigger | Evitar SKILL.md duplicados entre marketplace/cache | [#59423](https://github.com/anthropics/claude-code/issues/59423) (OPEN) |

## Skill chaining / skill-llama-skill

**No existe primitiva oficial "skill chaining". Una skill NO llama directamente a otra — Claude es el coordinador.** Cuatro mecanismos soportados:

| Mecanismo | Main session | Subagente | Versión / estado |
|---|---|---|---|
| Texto "now run /x" en el cuerpo (instrucciones que steerean a Claude vía tool `Skill`) | sí (emergente) | — | community-documented sobre el tool oficial [mindstudio](https://www.mindstudio.ai/blog/claude-code-skill-collaboration-chaining-workflows) |
| `context: fork` + `agent:` (el SKILL.md es el prompt del subagente) | dispara fork | sí | oficial; loop de auto-reinvocación corregido en **v2.1.144/2.1.145** [changelog](https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md) |
| `skills:` frontmatter (precarga **contenido completo** en subagente) | — | sí | oficial [sub-agents](https://code.claude.com/docs/en/sub-agents); no precarga skills con `disable-model-invocation:true` |
| Tool `Skill` dentro de subagente | — | sí | roto hasta **v2.1.133** (corregido ahí) [changelog](https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md) |

- Telemetría reconoce `nested-skill` como `invocation_trigger` (junto a `user-slash`, `claude-proactive`) desde **v2.1.126** — confirma que skill-to-skill es un path reconocido.
- **Subagentes NO pueden spawnear subagentes** (por diseño: `Agent(agent_type)` no tiene efecto en definiciones de subagente). Relevante para [#59968](https://github.com/anthropics/claude-code/issues/59968): el síntoma (multi-agent skill colapsa a self-affirmation en contexto único) es real, pero **su causa declarada — "no hereda el grant del tool Agent" — está contradicha por la doc oficial**; es nesting deshabilitado por diseño, no un grant que falla en heredarse. [PARTIAL](https://code.claude.com/docs/en/sub-agents)

## Hooks para routing/hint

**Sí, un hook `UserPromptSubmit`/`SessionStart` puede SUBIR activación inyectando una hint-list — pero solo como *nudge*, jamás fuerza.**

- **Mecanismo** (oficial [hooks](https://code.claude.com/docs/en/hooks)): stdout no-JSON, o JSON `hookSpecificOutput.additionalContext`, se añade al contexto. Cap **10.000 chars**. `UserPromptSubmit` timeout 30s (corre antes de cada prompt). `PreToolUse`/`PostToolUse` **no** inyectan contexto a nivel de prompt ⇒ inservibles para router.
- **Restricción load-bearing**: `additionalContext` solo lo soportan hooks `type:'command'`, **NO** `type:'prompt'` (que solo pueden bloquear). Aserción comunitaria de [#37559](https://github.com/anthropics/claude-code/issues/37559), no clara en docs. ⚠️ El veredicto marca esto **PARTIAL**: el split de `additionalContext` es real, **pero `replacementPrompt` NO es un campo de hook real** — no aparece en docs ni changelog; no lo uses. [PARTIAL](https://github.com/anthropics/claude-code/issues/37559)
- **No hay mecanismo oficial para invocar/forzar una skill desde un hook.** Solo `reloadSkills` (re-escanea disco, no activa). Las afirmaciones community de "100% loading" son hint-based con failure modes documentados (dispara en edits triviales, no dispara sin ficheros abiertos, mantenimiento manual de reglas).
- **Phrasing**: escribir el hint como hechos ("This repo uses bun test") no como órdenes de sistema (disparan defensas anti-injection). Hooks se **saltan en `-p`/non-interactive** y los SessionStart de **plugin** pierden `additionalContext` (vivir en settings.json). [#16538](https://github.com/anthropics/claude-code/issues/16538)
- **El fantasma `prompt-enrichment.ts`** de poneglyph (hook de auto-sugerencia diseñado pero nunca implementado) es coherente con esta evidencia: un router por hook es frágil, no determinista y de mantenimiento costoso. **Sigue siendo correcto no implementarlo.**

## Verificación adversarial — qué sobrevivió

12 CONFIRMED · 4 PARTIAL · 0 REFUTED · 0 UNVERIFIABLE. Las únicas refutaciones de la corrida viven *dentro* de los PARTIAL.

| Claim | Verdict | Evidencia / qué se cae |
|---|---|---|
| Sin embeddings/index/regex; solo LLM-matching + capa truncado | **CONFIRMED** | Todas las fuentes oficiales corroboran; `userPromptKeywords.ts` regex = detección de "frustration words", NO routing de skills |
| Dos caps de char (64/1024 por campo + 1.536 listing combinado) + presupuesto 1% | **CONFIRMED** | Verbatim en docs; el "250" era valor superseded (pre-v2.1.105) |
| En overflow se dropean primero las menos invocadas; `/doctor` surfacea | **CONFIRMED** | Docs near-verbatim + strings de producto ("full descriptions kept for most-used skills") |
| `disable-model-invocation:true` quita description del contexto + bloquea precarga subagente; distinto de `user-invocable` (menú) | **CONFIRMED** | Verbatim docs; "el más fuerte" es editorial (`skillOverrides:off` mata más) |
| Docs NO documentan manejo de claves frontmatter desconocidas (silently-ignored unverified) | **PARTIAL** | Mitad CLI-runtime se sostiene; **no afirmar que se ignoran** (validador de Desktop las rechaza); paréntesis sobre hooks-matcher **inexacto** |
| `skills:` es campo de subagente, no de SKILL.md | **CONFIRMED** | Dos docs oficiales, tablas completas |
| 650-trials: OR=20.6, p<0.0001; 88.9% (578/650); single-author, no replicado | **CONFIRMED** | Verbatim; corrección: usó `claude -p … --allowedTools Skill` + cclogviewer, **NO Daytona** (eso fue Spence) |
| "73% de 214 skills <60" = code-smell, no tasa de fallo en vivo | **CONFIRMED** | pulser es linter estático; autor = vendedor de pulser; "no ejecuta contra Claude" (statement against interest) |
| "→100% vía hooks" no generaliza; cayó 75%/67% en edge-cases; salto 84/80→100 fue **upgrade de modelo** (Haiku→Sonnet) | **CONFIRMED** | Verbatim Spence; single-practitioner, no oficial |
| #6305 Pre/PostToolUse no disparan = bug dispatcher único vs misconfig, asimetría limpia | **PARTIAL** | Real + version-spanning + sin fix oficial **se sostiene**; "bug único vs misconfig / asimetría limpia" **sobre-afirma** — son varios modos distintos + misconfig |
| #62049 `paths:` nunca dispara auto-load al leer/editar fichero; OPEN, no verificado por Anthropic | **CONFIRMED** | gh CLI: OPEN, evidencia mitmproxy, 0 comentarios de Anthropic |
| #59968 tool Skill en subagente no hereda grant Agent ⇒ colapso single-context; OPEN | **PARTIAL** | Metadata + síntoma **confirmados**; **mecanismo contradicho** por docs (subagentes no spawnean por diseño, no es grant no-heredado) |
| "pushy descriptions" solo verbatim en skill-creator, auto-hedged, ausente de blog Oct-2025 y best-practices, aún en revisión actual | **CONFIRMED** | blob SHA `65b3a40`, verbatim línea 67; ausente de las otras superficies oficiales |
| 1.536 = combinado description+when_to_use (cap CC), distinto del 1024 por campo (API) | **CONFIRMED** | Verbatim docs; community claudefa.st (dice "1.536 solo description") refutado por docs oficiales |
| `when_to_use` es campo separado, anexado a description, cuenta hacia 1.536; distinto de la regla skill-creator | **CONFIRMED** | Verbatim docs; reconciliable (when_to_use también es frontmatter, no cuerpo) |
| `additionalContext`/`replacementPrompt` solo en hooks `type:'command'` | **PARTIAL** | Split de `additionalContext` **real**; `replacementPrompt` **NO existe** como campo (ni en command hooks) — fabricación-por-propagación desde #37559 |

## Deltas vs dossier 2026-05-29

| Afirmación previa del dossier | Estado | Evidencia 2026 |
|---|---|---|
| Nativo = LLM fuzzy-match de description+when_to_use | **still-true** | [CONFIRMED](https://code.claude.com/docs/en/skills) |
| Cap combinado ~1536 chars | **still-true (preciso)** | 1.536 exacto, combinado, configurable `maxSkillDescriptionChars` [docs](https://code.claude.com/docs/en/skills); además presupuesto dinámico 1% (no estaba en el dossier) |
| Activación ~20% vaga → 50-72% "Use when" → 72-90% con ejemplos (metodología sin citar) | **updated** | La **dirección** se corrobora (vaga < "Use when" < directiva, OR=20.6). Los **absolutos NO son comparables**: dominados por modelo + densidad de keywords del prompt, no por calidad de description. Baselines: Haiku 20% / Sonnet 55% / Opus 87.5%; el salto 84/80→100 fue upgrade de modelo. [Seleznov](https://medium.com/@ivan.seleznov1/why-claude-code-skills-dont-activate-and-how-to-fix-it-86f679409af1) · [Spence](https://scottspence.com/posts/measuring-claude-code-skill-activation-with-sandboxed-evals) |
| `activation.keywords` no es oficial | **still-true** | No hay campo `keywords`; matching sobre prosa description+when_to_use. Estudios: "keywords had zero measurable effect" [CONFIRMED](https://code.claude.com/docs/en/skills) |
| skills/commands merged | **still-true** | `.claude/commands/x.md` y `.claude/skills/x/SKILL.md` ambos crean `/x`; en colisión gana la skill; built-ins (`/help`,`/compact`) NO son skills [docs](https://code.claude.com/docs/en/skills) |
| Sin skill-calls-skill nativo en main session | **still-true (matizado)** | No hay primitiva; Claude coordina vía tool `Skill`; el chaining EMERGE de instrucciones en el cuerpo [CONFIRMED](https://code.claude.com/docs/en/skills) |
| `skills:` frontmatter de subagente precarga | **still-true** | Inyecta **contenido completo**; roto hasta v2.1.133 vía tool `Skill`, corregido ahí [sub-agents](https://code.claude.com/docs/en/sub-agents) |
| `prompt-enrichment.ts` fantasma | **still-true** | Confirmado que un router por hook solo nudge, frágil; correcto no implementarlo [PARTIAL #37559](https://github.com/anthropics/claude-code/issues/37559) |

**Nota colateral (corrección a CLAUDE.md)**: el `CLAUDE.md` de poneglyph atribuye el rename `workflow`→`ultracode` a v2.1.154; el CHANGELOG lo sitúa en **v2.1.160** (v2.1.154 introdujo workflows; "workflow" dejó de disparar en 2.1.160). El "since 2.1.160" del CLAUDE.md ya es correcto; la mención a 2.1.154 como rename es errónea. [changelog](https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md)

## Implicaciones para la skill `skill-advisor` (propone→valida)

**La tensión load-bearing**: el nativo ya hace LLM-matching sobre el listing en contexto ([CONFIRMED](https://code.claude.com/docs/en/skills)), así que un **re-sugeridor por keywords sería parcialmente redundante** con lo que el modelo ya hace. PERO el nativo **infra-dispara por admisión de Anthropic** ([skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md), CONFIRMED) y **no se puede forzar** (la no-determinación es de diseño); un hook solo *nudge* y poneglyph ya rechazó esa vía (fantasma `prompt-enrichment.ts`, still-true).

⇒ **"Propone→humano valida" es la respuesta CORRECTA al problema de controlabilidad, no un workaround.** El gate humano resuelve exactamente lo que el nativo no puede: forzar consideración determinista + backstop al undertrigger, sin pelear contra el modelo.

**Qué hace el nativo redundante:**
- Auto-surfacing del match obvio (description directiva sola lo logra — palanca nº1, coste cero). `skill-advisor` **no debe re-implementar matching**.
- Un índice/registry propio de keywords (no existe en el nativo, no aportaría — los estudios dan keywords con efecto cero).

**Qué el nativo NO cubre (y justifica la skill):**
- El **gate de elección humana** ("¿activo estas 2 de las 5 candidatas?").
- El **backstop al undertrigger** en fronteras de fase de `/flow`, donde no hay fichero abierto que dispare `paths` y la petición es conceptual (~0% de auto-activación).
- **Curaduría sobre el listing** cuando hay muchas skills (el presupuesto dropea las menos usadas — una recomendación explícita las re-eleva sin tocar settings).

**Diseño mínimo-coherente (Commandment III):**
1. Una **SKILL** (no hook, no índice separado) que, dada la tarea actual, **rankea un shortlist desde el listing nativo en contexto** (≤3-5 candidatas) y lo presenta al humano vía `AskUserQuestion` para ratificar cuáles activar.
2. **Invocable desde `/flow`** en fronteras de fase (donde el matching nativo es más débil) **+ otros commands/skills + on-demand**.
3. **Sin hook router** (frágil, `additionalContext` solo command-type, se salta en `-p`, no fuerza).
4. **Sin re-matching propio**: aprovecha que las descriptions ya están en contexto; la skill razona sobre ellas, no construye índice.
5. **Su propia `description` debe ser directiva** ("Use when… proponer skills relevantes para una tarea, en fronteras de `/flow`, cuando el usuario duda qué activar") para no caer ella misma víctima del undertrigger.

**Lo que NO debe hacer**: forzar invocación (imposible), duplicar el matching del modelo, ni depender de un hook. Su valor único es el **par propone→ratifica humana** sobre el shortlist nativo — un componente que mapea a Commandment I (simbiosis: Claude propone volumen/precisión, el humano decide) y III (mínimo: una skill, cero infra nueva).

## Fuentes clave

Oficial: [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) · [platform.claude.com/.../agent-skills/overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) · [.../best-practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) · [sub-agents](https://code.claude.com/docs/en/sub-agents) · [hooks](https://code.claude.com/docs/en/hooks) · [CHANGELOG](https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md) · [anthropics/skills skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md). Evals: [Seleznov 650-trials](https://medium.com/@ivan.seleznov1/why-claude-code-skills-dont-activate-and-how-to-fix-it-86f679409af1) · [Spence](https://scottspence.com/posts/measuring-claude-code-skill-activation-with-sandboxed-evals). Issues: #57941, #62049, #59968, #6305, #37559, #13586, #49835, #59423, #16538.
