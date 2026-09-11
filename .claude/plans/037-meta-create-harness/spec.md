---
id: 037-meta-create-harness
created: 2026-09-10
mode: full
phase: 1
status: closed
approved: 2026-09-10
living_spec: v2 — delta from retro 037-meta-create-harness (E4/H8 vendor; AC27 Then = jsonl+unit)
closed: 2026-09-11
---

# Problema

No hay un punto de entrada único, vivo y de tres hosts para **cualquier** trabajo de configuración nativa: consultar si la norma cambió, crear, modificar, desactivar, o borrar sabiendo qué rompe.

Hoy `meta-create` solo enseña a **crear**, y solo a la manera de Claude Code. El cookbook cubre settings Claude. Codex y Grok tienen creadores nativos (`create-skill`, `create-workflow`, `skill-creator`) que no pasan por el gate ni por el grano Poneglyph. Borrar un hook en el repo no prueba que el host haya dejado de ejecutarlo.

Si no se hace: cada cambio nace Claude-céntrico; las docs se pudren; un delete o un permiso mal movido ensancha autoridad sin decirlo; Grok/Codex siguen el tool nativo y saltan el contrato.

# Resultado esperado

Seis frentes, todos en esta entrega. Ninguno es un extra. El oficio de la skill es el ciclo, no solo crear.

| Frente | Outcome |
|---|---|
| **W1 — Tres arneses** | Cada tipo nativo se declara de forma válida en Claude Code, Codex y Grok Build. Lo portable es el default. Lo de un host solo aparece cuando ese host lo necesita. Si un host no tiene el tipo, el pack lo dice; no se inventa. |
| **W2 — Docs oficiales vivas** | Por cada tipo, la skill dice cómo obtener ahora la documentación oficial de cada arnés y del estándar portable. El texto local es gotcha + plantilla, no la norma única. |
| **W3 — Evidencia** | Por cada tipo, prácticas de proyectos de éxito, expertos y, si existe, dato medible. Cada consejo lleva fuente y nivel. Lo sin fuente no se presenta como norma. |
| **W4 — Grano Poneglyph** | La plantilla y las recetas empujan calidad, rendimiento y menor coste de tokens. La capa Poneglyph (es-ES de activación, keywords, evals) se aplica en este repo; fuera, solo el núcleo portable. |
| **W5 — Estándar medible** | Cada norma que queramos controlar tiene un número o un sí/no, una fuente, y un sitio que la hace cumplir (CI, warning, o plantilla). El gate puede crecer: si Phase 2 o más tarde descubre un límite con evidencia, hay receta para promoverlo al validador. Sin eso no hay calidad controlable. |
| **W6 — Ciclo de vida** | La misma skill cubre consultar, crear, modificar, desactivar (si el host lo tiene) y borrar. El impacto (qué depende de esto) es un paso **antes** de mutar, no un verbo extra. Un tipo × host declara qué verbos soporta, cuáles no, y qué queda sin verificar. |

Más:

- Una sola skill (`meta-harness`) es el punto de entrada para cualquier configuración nativa de los tres arneses.
- `meta-create` y `meta-settings-cookbook` quedan stubs de redirección con contrato de prune (AC28). El rename no es solo el stub: hay sitios vivos en `.ts`/`.js`/`.md` (F5).

# Success criteria (medibles, Given/When/Then)

## W1 — Tres arneses

- **AC1 — Disparo amplio**: Given un prompt de consultar, crear, modificar, desactivar o borrar cualquier tipo T1–T15 en Claude, Codex o Grok, when el Lead enruta, then carga `meta-harness` y nombra el verbo **antes** de actuar. No carga el cookbook viejo ni se queda en un creador nativo sin el contrato de esta skill.
- **AC2 — Matriz por tipo**: Given cualquier tipo del catálogo T1–T15, when se abre su pack, then hay columna Claude, columna Codex y columna Grok: cómo se llama el artefacto, dónde vive, qué campos acepta, qué ignora, si se puede desactivar, y cuándo es efectivo (reload / restart / inmediato). Celda vacía = «este host no tiene este tipo», nunca una receta copiada de Claude.
- **AC3 — Portabilidad semántica**: Given se declara o se mueve un artefacto, when el tipo existe en un host, then el **outcome pedido** es válido ahí. No se promete un fichero único (T5/T10/T11/T14 son N ficheros nativos). Las claves que un host ignora no se copian por defecto. Una pérdida material de comportamiento se declara **antes** de sustituir la fuente.

## W2 — Docs oficiales vivas

- **AC4 — Receta de lookup**: Given un tipo y un host, when el Lead necesita la norma, then el pack indica la fuente oficial (índice llms.txt / guía de usuario / estándar portable) y el paso para leerla ahora, no solo un párrafo copiado en 2026-06.
- **AC5 — Fallback honesto**: Given la consulta en vivo falla, when se usa el texto local, then queda marcado como snapshot con fecha; no se presenta como norma vigente.
- **AC6 — Estándar portable**: Given se declara una skill, when hay conflicto entre hosts, then gana el estándar portable de Agent Skills para el núcleo (`name`, `description`, cuerpo, `references/`); las extensiones de host van aparte.

## W3 — Evidencia

- **AC7 — Consejo con fuente**: Given un consejo de authoring o de configuración en un pack, when se lee, then cita vendor, experto o dato medible, con nivel de evidencia a la vista (A/B/C/D/T1). Sin fuente ≠ norma.
- **AC8 — Dato medible primero**: Given existe un resultado medido que contradice una receta local, when se actualiza el pack, then gana el dato medido **como consejo de authoring**. No establece qué sintaxis acepta un host. Un conflicto entre doc oficial, snapshot e instalación se reporta con procedencia y versión de CLI; no se actualiza nada en silencio.
- **AC9 — Evidencia por tipo**: Given cada tipo T1–T15, when su pack está completo, then incluye al menos: norma vendor de los hosts que lo soportan + una ficha de prácticas (expertos/proyectos) +, si no hay dato medible, la etiqueta explícita «sin evidencia A/B».

## W4 — Grano Poneglyph

- **AC10 — Plantilla por defecto**: Given se crea una skill, when se aplica el default, then incluye `name` + `description` (qué y cuándo, tercera persona), when-NOT, pasos, mapa de contenido, anti-patrones cortos y ≥3 escenarios de eval; el cuerpo principal queda bajo el presupuesto de divulgación progresiva.
- **AC11 — Coste de contexto**: Given un pack, when el Lead no necesita un host o un detalle, then no lo carga. SKILL.md router corto; un pack por tipo; sin ladrillo único.
- **AC12 — Calidad > volumen**: Given hay que elegir entre más texto y más acierto, when se escribe una receta, then gana la versión compacta y curada. Skills autogeneradas sin eval no son el default.
- **AC13 — Capa Poneglyph**: Given se authora dentro de este repo, when aplica la capa 2, then description/when_to_use en es-ES, keywords del hook, evals del repo. Given se authora para un repo ajeno, then solo el núcleo portable.

## W5 — Estándar medible (gate que ya existe)

- **AC15 — Suelo actual**: Given una skill o command generado por `meta-harness`, when entra en el snapshot de git, then pasa `bun run check:config` (errores = bloqueo). No se inventa un segundo validador paralelo.
- **AC16 — Plantilla = gate**: Given el default de T1/T2, when se instancia, then el artefacto cumple el contrato de `config-quality.md` sin parches a mano.
- **AC17 — Norma nueva con dueño**: Given este feature concluye un límite (p. ej. tope de `description` portable), when se adopta, then queda en `config-quality.md` + `check-config.ts` (error o warning) y en la plantilla. Un número solo en prosa de la skill no cuenta como estándar.
- **AC18 — No cifras inventadas**: Given no hay fuente A/B/T1 para un recuento (palabras, «32», «150 caracteres»), when se discute calidad, then no entra al gate. El repo ya rechazó un target de 150 caracteres sin base.
- **AC19 — Promoción de norma**: Given W3/W2 descubre un límite con fuente A/B/T1, when se adopta, then se añade **una** fila en `config-quality.md`, **una** regla en `check-config.ts`, **un** fixture, y la plantilla. Antes de que sea **error** de CI, se corre contra el catálogo existente. Si algo de D12 fallaría, la regla sale como warning o los arreglos van en la misma HU. Nunca un merge con rojo conocido. Nunca se relaja la regla en silencio. `meta-harness` documenta esa receta.
- **AC20 — Agents tres hosts** (baked 2026-09-10, Oriol: scan the three hosts + every agent fulfills the rules + shared name collision): Given a T3 **definition file** enters the snapshot — Claude `.claude/agents/*.md`, Grok `.grok/agents/*.md`, Codex `.codex/agents/*.toml` — when `check:config` runs, then `name`/`description` use the skill contract (kebab 1–64, description 1–1024 nonempty). Markdown without YAML is `metadata.parse`. Markdown `name` matches the filename stem. Codex `name` is the identifier (filename match is convention) but still kebab-hyphen like skills (`pr_explorer` fails; copy-paste from vendor docs must rename). Codex also requires nonempty `developer_instructions` (vendor MUST). Agent names join the skill/command collision set. Missing agent dirs are no-op. `[agents]` in `config.toml` is global caps, not this scan. Grok personas are not agents. `rules/*.md` and CLAUDE.md/AGENTS.md length stay out (budget ratchet).

# Estándares medibles (inspección 2026-09-10)

No es «o cambiamos los tests o las plantillas». Es una cadena. Si un número no cabe en la capa 1, no es un estándar controlable.

| Capa | Qué es | Dónde vive | Qué prueba |
|---|---|---|---|
| 1. Ley mecánica | Sí/no sin modelo | `config-quality.md` + `check-config.ts` | Forma de la fuente: metadata, parse, paths, privacidad |
| 2. Plantilla | Default que el Lead escribe | `meta-harness/templates/` + packs | Calidad de authoring: when-NOT, mapa, evals, es-ES |
| 3. Comportamiento | El agente hace lo que dice | `.claude/evals/` (no CI) | Regresión de conducta; graders deterministas |
| 4. Presupuesto | El always-loaded no crece por accidente | `scripts/lib/budget.ts` (TOLERANCE 0) | Bytes de CLAUDE.md, rules, descriptions |

CI hoy (`/.github/workflows/ci.yml`): `bun run check:config` → `bun test ./.claude/` (incluye el ratchet de presupuesto) → Gitleaks 8.30.1 → `claude plugin validate .claude`. Pre-commit y doctor reutilizan el mismo `check-config`. Los evals live (`claude -p`) no corren en CI.

## Lo que YA es estándar (capa 1)

Estos números ya controlan calidad. Una skill nueva que no los cumpla no entra al snapshot.

| Superficie | Norma | Tipo | Fuente |
|---|---|---|---|
| `name` (skill) | kebab ASCII, 1–64, igual que el directorio | MUST, error CI | convención portable del repo |
| `description` (skill) | no vacía, **1–1024 code points Unicode** | MUST, error CI | Agent Skills spec. **No 32 palabras. No 150 caracteres.** |
| `description` (command) | el mismo tope 1024 | MUST, error CI | convención de proyecto, no límite universal de commands |
| cuerpo skill/command | no vacío | MUST, error CI | Agent Skills |
| `description` + `when_to_use` | >1536 → warning | SHOULD | listing default de Claude |
| cuerpo ≥500 líneas | warning, no error | SHOULD | divulgación progresiva Anthropic; no es score de calidad |
| metadata desconocida | warning | SHOULD | no prohibir campos futuros de host |
| links markdown relativos | deben resolver en el snapshot | MUST | consistencia de proyecto |
| colisión skill/command | prohibida | MUST | proyecto |
| JSON/YAML/TOML | parsea como mapping | MUST | parsers nativos + `smol-toml` |
| hooks / MCP / plugin | forma estructural | MUST | contratos vendor + subset común |
| `settings.json` de proyecto | solo `$schema` y `respectGitignore` | MUST | perfil global vs proyecto |

## Lo que NO es estándar (y no debe inventarse)

| Candidato | Por qué no entra a CI | Dónde sí vive |
|---|---|---|
| «description de 32 palabras» / longitud «ideal» | Sin A/B. `config-quality.md` y E6 lo prohíben | — |
| when-NOT, Content Map, anti-patrones | Un heading no mide calidad | plantilla (capa 2) |
| ≥3 evals por skill nueva | Ceremonia estructural; los evals reales son casos con fallo documentado (019) | plantilla + `.claude/evals/` |
| description/when_to_use en es-ES | Política de activación, no forma parseable con rigor | capa Poneglyph (AC13) |
| CLAUDE.md &lt;200 líneas | Guía Anthropic (B); el ratchet de presupuesto ya veta el crecimiento always-loaded | plantilla T9 + budget |
| `rules/*.md` frontmatter | El gate no los lee hoy | pack T4 |
| agents (`.claude/agents/*.md`) | El gate no los lee hoy | pack T3 |
| output styles | El gate no los lee hoy | pack T13 |
| que una skill «funcione bien» | Metadata ≠ acierto (E6, arXiv 2602.11988v2) | evals (capa 3) |

## Hueco de las plantillas actuales (por eso hay que tocarlas)

`check-config` no escanea `meta-create/templates/` (no son `skills/<name>/SKILL.md`). El artefacto **instanciado** sí entra al gate. Hoy las plantillas, si se copian tal cual:

- T1 `templates/skill/reference.md` y `workflow.md`: `Use when` en inglés; keywords en `description` en vez de `metadata.keywords`; sin when-NOT, sin Content Map, sin evals.
- T3 `templates/agent/*.md`: `tools`, `permissionMode`, `model: sonnet` — receta Claude; el gate **ni las ve**.
- El pack `references/skill/frontmatter-spec.md` aún muestra `activation.keywords` y `for_agents` como «Full Example» (H5), campos que el propio pack declara inválidos.

Consecuencia de producto (D15, ratificada): **las plantillas se adaptan al gate (suelo). El gate no se relaja para que una plantilla mala pase. El gate crece cuando aparece un número con fuente A/B/T1 (AC19), no cuando apetece un recuento de palabras.**

Promoción (la capacidad que Oriol pidió): descubrir → etiquetar A/B/T1 → fila en `config-quality.md` + regla + test + plantilla. Eso es introducir una norma. Un heading en la skill no lo es.

## Transición

## W6 — Ciclo de vida

Verbos de v1: **consultar · crear · modificar · desactivar (si el host lo tiene) · borrar**.
El **impacto** no es un verbo: es el paso previo a modificar, borrar o renombrar (`doctrine-sweep` + grep de registros). Migrar de host es modificar con plantilla portable, no un séptimo verbo (Fable D2; ahorra always-loaded).

- **AC21 — Consultar frescura**: Given un pack con fecha de última comprobación y versión de CLI del host, when se consulta, then por host reporta sin cambio / cambió (qué celdas) / inalcanzable. No edita nada solo.
- **AC22 — Modificar sin wipe**: Given configuración existente, when se modifica, then el comportamiento no pedido se conserva. Si el pedido ya está, es no-op. Un cambio parcial se declara. No se sustituye el fichero por la plantilla default.
- **AC23 — Borrar ≠ desactivar ≠ desinstalado**: Given un pedido de quitar, when termina, then distingue: fuente en repo, registros, copias instaladas, overlay de máquina, sesión activa, follow-up (p. ej. `sync-claude --execute` + restart). Lo no observado queda «sin verificar». Desactivar, si el host no lo tiene, se declara ausente; no se finge con un delete.
- **AC24 — Impacto antes de mutar**: Given un rename, delete o cambio de doctrina, when se revisa, then hay una tabla acotada: dueño, consumidores (`rg` de nombres/paths/claves en md/ts/js/json/toml/yaml), sitios de doctrina (`doctrine-sweep`), límite de inspección. Cierre honesto: «sin referencias vivas en estas raíces; estado instalado sin verificar». No hay grafo nuevo.
- **AC25 — Estado efectivo**: Given T5/T10/T11/T13/T14 (y análogos), when se cambia o se borra, then el pack nombra fuente, paso de install, overlay, y qué bloquea o concede **ahora** ese permiso/hook. Done de fuente ≠ done de runtime.
- **AC26 — Creadores nativos**: Given Grok `create-skill` / `create-workflow`, Claude `skill-creator` o Codex `skill-creator` redactan un artefacto para este repo, when entra al snapshot, then `meta-harness` posee lookup, impacto, `check:config` y capa Poneglyph. El creador solo posee el borrador. Un éxito del tool nativo no sustituye el gate.
- **AC27 — Evals de disparo**: Given la description nueva, when se inspecciona `.claude/evals/cases.jsonl` y corre `bun test ./.claude/evals/__tests__/cases-meta-harness.test.ts`, then hay ≥1 caso es-ES de create, modify, delete y consult (`skill-meta-harness-create-22` .. `consult-25`) con `grader: skillTriggerParse` y `expected: meta-harness`. Live `bun .claude/evals/run.ts` es opt-in (G13): Sonnet 5; nunca Fable sin `--allow-expensive` y permiso de este turno. Hoy esos cuatro casos existen; el cookbook y `meta-create` ya no son el expected.
- **AC28 — Stubs y prune**: Given `meta-create` o `meta-settings-cookbook` como stub, when aterriza, then `metadata.keywords: ""`, sin `when_to_use`, description de una línea que nombra `meta-harness`, y una fila de prune con fecha. Given acaba el ciclo, then doctrine-sweep a cero referencias vivas y se borra el stub. «Un ciclo» = esa fila + grep limpio, no un tiempo vago.
- **AC29 — Rename en código vivo**: Given el rename a `meta-harness`, when corre doctrine-sweep, then cada sitio vivo `.ts`/`.js`/`.md` (incl. `skill-advisor/lib/rank.ts`, `workflows/ultracode-audit.js`, `docs/auxiliary-skills-matrix.md`, snapshot de budget) nombra `meta-harness`. Planes e auditorías históricas pueden conservar el nombre viejo.
- **AC30 — Presupuesto always-loaded**: Given el feature mergea, when se actualiza el ratchet, then el neto de `skills: description + when_to_use` es ≤ 0 respecto al snapshot previo, **o** una fila D registra los bytes de más y por qué. TOLERANCE sigue en 0.
- **AC14 — Cookbook absorbido**: el cuerpo útil vive bajo `meta-harness`; el stub cumple AC28.

# Catálogo de tipos (todos en v1)

Cada fila es un documento que esta skill debe saber declarar o configurar. Phase 2 verifica cada celda contra la doc oficial; si un host no tiene el tipo, la celda queda «ausente».

| Id | Tipo | Claude Code (hoy en nuestros packs) | Codex | Grok Build | Cubierto hoy |
|---|---|---|---|---|---|
| T1 | Skill | `SKILL.md` + frontmatter Claude | `SKILL.md` + `agents/openai.yaml` opcional | `SKILL.md`; claves extra ignoradas o no aplicadas | Claude-only |
| T2 | Command | `.claude/commands/*.md` o skill invocable | `$name` sobre el markdown compartido | `commands/*.md` o skill slash | no |
| T3 | Agent / subagent | `.claude/agents/*.md` | subagents nativos | `.grok/agents/` + personas | Claude-only |
| T4 | Rule | `.claude/rules/` | instrucciones en AGENTS.md / config | `.grok/rules/` + AGENTS.md | Claude-only |
| T5 | Hook | `settings.json` hooks | `hooks.json` / `config.toml` | `~/.grok/hooks/*.json` | Claude-only |
| T6 | MCP | `.mcp.json` | MCP nativo Codex | `config.toml` / modal `/mcps` | Claude-only |
| T7 | Plugin | `plugin.json` + marketplace | plugins Codex | plugins + marketplaces Grok | Claude-only |
| T8 | Workflow | workflows dinámicos Claude | **ausente** como tipo de fichero (plugins = T7; no hay `.rhai`) | `.grok/workflows/*.rhai` / `/create-workflow` | no |
| T9 | Memoria de proyecto | `CLAUDE.md` | `AGENTS.md` | `AGENTS.md` / `CLAUDE.md` / rules | cookbook Claude |
| T10 | Settings del host | `settings.json` | `config.toml` | `config.toml` + `pager.toml` | cookbook Claude |
| T11 | Permisos | `permissions` en settings | política nativa Codex | permisos / sandbox Grok | cookbook Claude |
| T12 | Variables de entorno | env de Claude | env Codex | env Grok | cookbook Claude |
| T13 | Output style | `.claude/output-styles/` | **ausente** (theme TUI + `personality`; no hay dir de styles) | **ausente** como tipo Claude (theming ≠ output style; hook omite `output_style`) | cookbook Claude |
| T14 | Statusline | `statusLine` en settings | `tui.status_line` en `config.toml` | `[ui.status_line]` | cookbook Claude |
| T15 | gitignore de la capa | receta Claude | receta Codex | receta Grok | cookbook Claude |

Contrato de un pack completo (T1–T15):

1. **Qué es** el tipo y cuándo usarlo frente a los demás (árbol corto de elección).
2. **Lookup oficial** por host (W2).
3. **Cómo se declara** según cada vendor: path, frontmatter/schema, gotchas (W1).
4. **Plantilla mínima** portable + extras de host opcionales.
5. **Prácticas con evidencia** (W3).
6. **Grano Poneglyph** de ese tipo: calidad, rendimiento, coste (W4).
7. **Ausencias** declaradas: lo que un host no tiene.

# Estado actual (deuda que este feature paga)

Inventario de `meta-create` + `meta-settings-cookbook` a 2026-09-10:

| Hueco | Hecho |
|---|---|
| H1 | Los dos skills son Claude-only. Codex y Grok no tienen pack. |
| H2 | No hay tipo Command ni Workflow. |
| H3 | Cookbook cubre CLAUDE.md / settings.json / output styles / env / permissions / gitignore / statusline. No cubre AGENTS.md, `config.toml` de Codex ni de Grok, `pager.toml`, personas Grok. |
| H4 | La rúbrica de authoring está vendored con fecha 2026-06-10. La doc de skills de Claude se actualizó en 2026-09-08. |
| H5 | El ejemplo de frontmatter de skills aún muestra `activation.keywords` y `for_agents`, que el propio spec del pack declara inválidos. |
| H6 | No hay receta de «cómo leer la doc oficial ahora». Hay URLs fijas de Claude. |
| H7 | No hay capa de evidencia (expertos / proyectos / papers). La rúbrica es Anthropic + convenciones Poneglyph. |
| H8 | Pagado 2026-09-10: pack T1 documenta que Grok aplica `model`/`effort`/`when-to-use`/`disable-model-invocation`. Codex ignora claves extra y recorta listing (2%/8000). |
| H9 | Un consejo en CLAUDE.md/AGENTS.md es una petición. Un hook es una garantía. Los packs no fuerzan esa distinción en los tres hosts. |
| H10 | Ya hay un gate de fuente (`check-config.ts` + `config-quality.md`) en CI, pre-commit y doctor. Las plantillas actuales no se contrastan contra él al generar. Rules, CLAUDE.md/AGENTS.md y evals ≥3 no pasan por ese gate. |

# W2 — Cómo obtener la documentación oficial

Producto, no implementación: cada pack nombra fuentes vivas. Phase 2 elige el mecanismo concreto.

| Fuente | Qué cubre | Índice vivo |
|---|---|---|
| Estándar Agent Skills | Núcleo portable de skills (T1) | `https://agentskills.io` · `/specification` · `/llms.txt` |
| Claude Code | T1–T15 en su forma Claude | `https://code.claude.com/docs/llms.txt` (skills, hooks, mcp, plugins, memory, settings, permissions, sub-agents, features-overview) |
| Codex | T1–T15 en su forma Codex | `https://developers.openai.com/codex` (skills, hooks, AGENTS.md, customization, plugins, MCP, config, subagents) y `https://learn.chatgpt.com/llms.txt` |
| Grok Build | T1–T15 en su forma Grok | `https://docs.x.ai/build` · guía local `~/.grok/docs/user-guide/` (08 skills, 09 plugins, 10 hooks, 12 project rules, 05/26 config, 16 subagents, 22 permissions, 25 status-line, 07 MCP) |

Reglas de lookup:

- El Lead consulta la fuente oficial del tipo **antes** de afirmar un campo o un path.
- El pack local guarda gotchas verificados y plantillas, con fecha de última comprobación.
- Si oficial y pack discrepan, gana oficial y el pack se marca para arreglo (no se «arregla» callando).
- No se copia la guía entera del vendor al repo. Se apunta y se resume lo que cambia la declaración.

# W3 — Evidencia: qué cuenta y qué ya sabemos

## Niveles (los de rigor de este repo)

| Nivel | Qué es | Uso en un pack |
|---|---|---|
| A | Paper / benchmark con metodología pública | Puede cambiar una receta |
| B | Dato medido por el vendor, etiquetado | Puede cambiar una receta |
| C | Informe de practitioner con números | Inspira; no funda una norma solo |
| D | Opinión sin números | Color; nunca como «hay que» |
| T1 | Hecho leído en este repo o en la guía instalada | Ancla local |

Sin A/B/T1, el pack dice «práctica habitual, sin evidencia A/B».

## Hallazgos ya en mano (seed para Phase 2; hay que anclar cita al escribir el pack)

| Id | Hallazgo | Nivel | Consecuencia de producto |
|---|---|---|---|
| E1 | SkillsBench (arXiv 2602.12670, 86 tareas, 7.308 trayectorias): skills **curadas** +16,2 pp de pass medio; skills **autogeneradas** −1,3 pp; 16/84 tareas empeoran con skill; software engineering solo +4,5 pp; 2–3 módulos +20,0 pp vs ≥4 módulos +5,2 pp; compactas +18,9 pp vs documentación exhaustiva +5,7 pp. | A | Plantilla default = compacta, curada, con evals. Prohibido el dump autogenerado como default. Un skill = un trabajo. |
| E2 | Anthropic: divulgación progresiva (metadata siempre; cuerpo al activar; refs a demanda). SKILL.md &lt; 500 líneas. Description = gatillo. Eval-first. CLAUDE.md &lt; 200 líneas. Hook = garantía; instrucción en memoria = petición. | B | Router corto, packs a demanda, when-NOT, evals, memoria delgada, guardas en hooks. |
| E3 | Codex: mismo estándar Agent Skills; `description` más corta que Claude; claves extra ignoradas; `agents/openai.yaml` para extras Codex. AGENTS.md pequeño. | B | No copiar frontmatter Claude a Codex. Núcleo portable. |
| E4 | Grok: descubre `.claude`, `.grok`, `.agents`, `.cursor`. Skills como `/nombre`. Commands planos. Hooks propios + compat Claude configurable. Grok **aplica** `when-to-use`, `model`, `effort`, `disable-model-invocation`. `license` y `compatibility` son opcionales del estándar portable. Claves extra desconocidas se ignoran. | T1 + B | Un artefacto en `.claude/skills` puede servir a Grok; no copies frontmatter Claude a ciegas — mira la columna Grok del pack T1. |
| E5 | NN/g (lectura en pantalla): layout escaneable +47 % usabilidad, conciso +58 %, combinado +124 %. Ya es ley de estilo; los packs la heredan. | B | Tablas, una idea por frase, sin ladrillos. |
| E6 | `config-quality.md`: cumplir metadata no es un score de rendimiento. arXiv 2602.11988v2 (AGENTS.md): sin mejora general de éxito y más coste de inferencia en su muestra. arXiv 2601.20404v2: beneficios de eficiencia en otra muestra. Ninguno valida una longitud «ideal» de description ni el efecto de nuestro validador en calidad entregada. | A | Prohibido inventar «32 palabras». Los números del gate salen del spec Agent Skills / del host más estricto verificado, no de un gusto. |

Phase 2 **amplía** este seed: por cada tipo, busca expertos y proyectos de éxito (Pulumi/harness, Anthropic steering, OpenAI skill creator, plugin-dev de Anthropic, Goose, etc.) y ancla citas. Si un tipo no tiene A/B, se etiqueta; no se rellena con D disfrazado.

Contra-evidencia obligatoria: SkillsBench muestra que una skill mala **empeora**. Los packs deben decir cuándo **no** crear una skill (cabe en CLAUDE.md/AGENTS.md, cabe en un hook, es ruido).

# W4 — Grano Poneglyph (calidad, rendimiento, coste)

No es un apéndice de estilo. Es el default de cada artefacto que esta skill genera.

| Eje | Norma de producto | Se ve en |
|---|---|---|
| **Calidad** | Eval-first (≥3 escenarios) en skills nuevas de este repo. When-NOT. Anti-patrones. No afirmar un campo de host sin lookup. Description en tercera persona, qué + cuándo. | T1 plantilla, rúbrica, AC10 |
| **Rendimiento (acierto)** | Description es código de routing, no documentación. Un skill = un trabajo. Skills que solapan se diferencian en el gatillo. Hook cuando debe ocurrir siempre; skill cuando hay que razonar; memoria cuando es «siempre haz X» y cabe en poco. | Árbol de elección, E1, E2 |
| **Coste (tokens)** | SKILL.md corto; refs a un nivel; no cargar packs de otros tipos ni de otros hosts. Memoria de proyecto delgada. No duplicar la guía del vendor. `disable-model-invocation` en skills con efectos secundarios. Compacto gana a exhaustivo (E1). | AC11, AC12, Content Map |

Capa 2 (solo este repo): superficie de activación en es-ES; `metadata.keywords` para el hook de activación; evals del repo; doctrine-sweep si cambia una decisión canónica. Fuera de este repo, el default es el núcleo portable.

Incentivo: la plantilla default **ya** es la de menor coste y mayor acierto. El grosor extra (ficheros por host, keywords, evals) se añade cuando el contexto lo pide, no al revés.

# Modelo conceptual

Dos trabajos, siempre juntos, en cada tipo:

1. **Enterarse**: lookup oficial vivo por host + estándar portable.
2. **Declarar bien**: receta vendor + evidencia + grano Poneglyph.

Disparo: cualquier indicación o interacción de configuración nativa de los tres arneses (T1–T15).

Carga: router corto en `SKILL.md`; un pack por tipo; una matriz portable vs Claude vs Codex vs Grok. El Lead no lee un fichero único enorme.

Elección de mecanismo (árbol corto, no un tratado):

| ¿Tiene que ocurrir siempre, igual, sin juicio? | Hook (T5) |
| ¿Es «siempre haz X» y cabe en poco? | Memoria de proyecto (T9) o rule (T4) |
| ¿Es procedimiento o conocimiento a veces? | Skill (T1) o command (T2) |
| ¿Aísla contexto / paralelo? | Agent (T3) |
| ¿Habla con un sistema externo? | MCP (T6); skill enseña a usarlo |
| ¿Se reparte a otros repos? | Plugin (T7) |
| ¿Orquesta varios workers con presupuesto? | Workflow (T8) |

# Out of scope (explícito)

- Reescribir el catálogo existente de ~30 skills al template nuevo.
- Otros harnesses (Cursor, Gemini, Copilot, etc.).
- Publicar plugins en marketplaces.
- Implementar un servidor MCP de cero (sí: la entrada de configuración, T6).
- Cambiar `sync-claude` / `sync-codex` / `sync-grok`.
- Un comando o workflow compañero como interfaz de `meta-harness`.
- Convertir cada guía oficial completa en un mirror local.
- Un segundo validador paralelo a `check-config`.
- Inventar recuentos (palabras, «32», «150 caracteres») sin fuente A/B/T1.
- Convertir when-NOT, Content Map, evals ≥3 o es-ES en error de CI en este feature.

# Constraints

- Una sola skill de entrada. Packs por tipo. Matriz de hosts, no tres árboles paralelos.
- Núcleo portable + capa Poneglyph solo en este repo.
- Máxima calidad con el menor coste de tokens y el mayor acierto.
- La skill vive en `.claude/skills/meta-harness/`. El directorio `meta-create` es stub (AC28) hasta el prune.
- Checks existentes (`bun test ./.claude/`, doctor, evals de comportamiento) siguen en verde.
- 035 y 036 siguen su propio ciclo; este plan no los toca.
- Phase 2 no puede «aparcar» W2–W6 para una v2. Los seis frentes son el MVP (D11).
- No se toca `sync-claude` / `sync-codex` / `sync-grok` (D12). Los packs **nombran** el paso de install; no lo reimplementan.
- No se cierra un gap en silencio (D19). Una duda que cambie el DAG, un AC o una D se pregunta a Oriol. Un consult a Astra o Fable no sustituye esa pregunta.

# Decisiones (drillme, 2026-09-10)

| Ref | Decisión |
|---|---|
| D1 | Una skill, no dos. Oficio: ciclo de configuración nativa de los tres arneses. |
| D2 | Nombre: `meta-harness`. Rechazado `meta-create` (un verbo) y `meta-poneglyph` (ruido de activación + no portable). |
| D3 | Cookbook: mover refs + stub con contrato AC28 (keywords vacíos, prune observable). |
| D4 | Automantenimiento: núcleo local + consulta en vivo de docs oficiales. |
| D5 | Artefacto portable por defecto; extras de host solo si hacen falta. |
| D6 | Plantilla skill: portable + mapa + when-NOT + evals. |
| D7 | Command y workflow son tipos de artefacto, no entrypoints extra. |
| D8 | `references/` partido por tipo, con matriz de hosts. |
| D9 | Audiencia: portable + convenciones Poneglyph encima. |
| D10 | Construcción: `/flow` completo. |
| D11 | MVP = todos los tipos nativos (T1–T15) **y** los seis frentes W1–W6. |
| D12 | No migrar el catálogo; no otros harnesses; no sync. |
| D13 | Si un host no tiene un tipo, se declara ausente. No se clona la receta Claude. |
| D14 | Evidencia etiquetada; sin A/B no es norma. SkillsBench prohíbe el dump autogenerado como default. |
| D15 | Suelo + techos vendor + promoción. Plantillas cumplen el `check:config` de hoy. Agents con YAML: mismo `name`/`description` que skills. Rules y longitud de CLAUDE.md/AGENTS.md fuera del validador. when-NOT / mapa / evals / es-ES en plantilla, no error de CI. Si más tarde se descubre un límite con A/B/T1, se promueve al mismo gate (AC19); no hace falta haberlo listado ahora. |
| D16 | Oficio = ciclo (consultar/crear/modificar/desactivar/borrar) en T1–T15. Impacto = paso, no verbo. |
| D17 | Creadores nativos redactan; `meta-harness` posee el contrato (lookup, impacto, gate, capa Poneglyph). |
| D18 | Consulta Astra (gpt-6-astra, high) + Fable (`claude -p --restricted --model fable`). Ambos REFINE. Fable recorta verbos v1 y concreta stubs/budget/evals. |
| D19 | Proceso de este feature (ratificado al gate 1→2): seguir definiendo. No rellenar un gap con un default silencioso. Cada duda que cambie el DAG / un AC / una D se consulta a Oriol. Se pueden abrir consultas a Codex Astra y a Claude Fable cuando el hueco sea de hecho vendor, de diseño técnico o de refutación — no cuando sea gusto de producto. Un consult es hipótesis; Grep/Read/docs primarias ganan. |
| D20 | Consultas: mixto. Astra se lanza si el hueco es vendor/CLI/refutación del plan. Fable solo si Oriol lo nombra este turno o el hueco es arquitectura del DAG. Gusto de producto: siempre AskUserQuestion. Un consult no cierra un AC. |
| D21 | Espina del DAG: rename a `meta-harness` + router + stubs (AC28/29/30) primero. Después T1. Después el resto de tipos. |
| D22 | Lookup W2: solo receta. El pack nombra URL/path oficial, el paso para leerla ahora, y sello fecha + versión de CLI. Sin script fetcher. Lead usa WebFetch/Read/Context7. |
| D23 | Un HU por tipo T1–T15 (no familias). Atomicidad por tipo, no por lote. |
| D24 | T1 es golden: T2–T15 dependen de T1 y copian su contrato de 7 puntos. No hay cadena T2→T3→… |
| D25 | Tres HUs transversales: (1) rename+stubs+sweep+budget, (2) check-config AC19/AC20, (3) evals AC27. Cookbook absorbido en (1) a nivel de stub; el movimiento de refs se cierra en ronda 3. Native-creators (AC26) viven en T1/T8, no en HU suelta. |
| D26 | Cada HU de tipo entrega el pack delgado completo (W1–W6): matriz 3 hosts, receta lookup, evidencia o «sin A/B», verbos de ciclo, plantilla si aplica. Research vivo dentro de la HU. |
| D27 | Cookbook: US1 solo stub + router. T9/T10/T11/T13/T14 mueven su rebanada. AC14 cierra cuando aterrizan esos tipos. |
| D28 | Evals (AC27) cuelgan de rename+T1, no de T15. Prueban disparo de la skill, no la existencia de 15 packs. |
| D29 | Tope `description`: **1024** (Agent Skills + Codex skill-creator). El 500 de 2026-02 está muerto. Codex CLI `main` no rechaza al cargar (`parser.rs`: `description` solo no-vacía; `MAX_NAME_LEN` 64). PR openai/codex#29006 (merged 2026-06-19): el 1024 es tope de **listing** al modelo (1021+`...`), no de disco. `check-config` se queda en error 1024. No hay fila AC19 nueva. El pack T1 documenta el recorte de listing. |

# Contrato de proceso (D19)

Vigente en las fases 2 → 5 de este plan. Oriol: «Ok, lo voy a probar, pero es muy importante que no caigamos en no preguntar más cosas y no seguir definiendo.»

| Si el hueco es… | Quién | Qué no hacer |
|---|---|---|
| Cambia el DAG, un AC, una D, o un verbo/tipo | Preguntar a Oriol en ronda, con default | Inventar el corte y seguir |
| Hecho de vendor, CLI, path, o contradicción del plan | Grep/Read/docs; si sigue abierto, **Astra** (D20) | Citar el consult como verdad |
| Arquitectura del DAG o Oriol nombra Fable este turno | **Fable** `--restricted` (D20) | Lanzar Fable por un lookup barato |
| Gusto de wording / orden cosmética | Lead decide, lo dice en una línea | Abrir ronda por eso |

Cierre de ronda: o las respuestas entran en este spec / `tasks/`, o el ítem queda `[OPEN]` con dueño. Nunca «ya lo vemos luego» sin fila.

# Riesgos de producto

| Riesgo | Si pasa | Mitigación de alcance |
|---|---|---|
| R1 | Un pack «3-host» que en realidad es Claude + notas | AC2: tres columnas; celda ausente explícita |
| R2 | Docs oficiales consultadas una vez y vueltas a vendor | AC4–AC5: lookup + fecha; discrepancia = arreglo |
| R3 | Folklore de Twitter como «best practice» | AC7–AC9: niveles; D sin A/B no funda |
| R4 | Skill unificada tan gorda que no se carga bien | AC11: router + packs; E1 compacto |
| R5 | Bajo acierto de disparo al cubrir create y config | AC1: description y when_to_use cubren ambos verbos y los T1–T15 |
| R6 | Radio de T1–T15 × 3 hosts × evidencia = no termina | Contrato de pack (7 puntos) es el done; no un tratado por vendor |
| R7 | Descubrimos un límite real y no hay sitio donde engancharlo | AC19: receta de promoción al gate existente; un número huérfano en prosa no cuenta |
| R8 | Grok `create-skill` gana el disparo | AC1 + AC26 + AC27 (evals de routing) |
| R9 | Borrar fuente ≠ quitar efecto (overlay / sync / sesión) | AC23 + AC25 |
| R10 | Rename y stubs hinchan always-loaded | AC28 + AC30 |
| R11 | Phase 2 «completa» el DAG sin preguntar y congela gaps | D19: ronda abierta mientras un gap cambie el DAG; consult ≠ cierre |

# Open questions

Ninguna bloquea el *qué* (gate 1→2 cerrado). Phase 2 cierra el *cómo*. Ronda 1 (usuario) vs investigación (Lead):

**Cerrado ronda 1:** D20 mixto · D21 rename primero · D22 receta · D23 un HU por tipo.
**Cerrado ronda 2:** D24 T1 golden · D25 tres transversales · D26 pack delgado completo.
**Cerrado ronda 3:** D27 cookbook por tipo · D28 evals tras T1.

**DAG-shape: saturado para cortes de producto.** Lo que queda es investigación (celdas vendor, layout de `references/`, SkillsBench v4, tope Codex). Eso no se pregunta: se trae con evidencia. Si un hallazgo cambia un AC o el DAG, vuelvo a ronda.

**Defaults aplicados:** check-config 🔵 con el rename. T3 depende de check-config (AC20). T2 y T4–T15 dependen solo de T1.

# DAG de producto (Phase 2, saturado en cortes)

18 HUs. Wave 3 es independiente entre sí (salvo T3). El Lead las ejecuta en serie; el DAG no finge deps.

| US | Wave | Depende de | Qué |
|---|---|---|---|
| US1 | 1 | — | Rename `meta-harness` + stubs `meta-create`/`cookbook` + doctrine-sweep vivo + budget AC30 |
| US2 | 1 | — | `check-config` AC19 receta + AC20 agents YAML |
| US3 | 2 | US1 | T1 skill golden (pack + templates + native-creators AC26) |
| US4 | 3 | US1, US3 | Evals AC27 (create/modify/delete/consult) |
| US5 | 3 | US3 | T2 command |
| US6 | 3 | US2, US3 | T3 agent/subagent |
| US7 | 3 | US3 | T4 rule |
| US8 | 3 | US3 | T5 hook |
| US9 | 3 | US3 | T6 MCP |
| US10 | 3 | US3 | T7 plugin |
| US11 | 3 | US3 | T8 workflow |
| US12 | 3 | US3 | T9 memoria (mueve cookbook `01-claude-md`) |
| US13 | 3 | US3 | T10 settings (mueve `02-settings-json`) |
| US14 | 3 | US3 | T11 permisos (mueve `05-permissions`) |
| US15 | 3 | US3 | T12 env (mueve `04-env-vars`) |
| US16 | 3 | US3 | T13 output style (mueve `03-output-styles`) |
| US17 | 3 | US3 | T14 statusline (mueve `07-statusline`) |
| US18 | 3 | US3 | T15 gitignore (mueve `06-gitignore`) |

`tasks/` aún no se escribe: falta research vendor (Codex T8/T13/T14, tope description, SkillsBench v4, layout de `references/`).

**Lead investiga (no son gusto; se traen con evidencia):**

- Layout exacto de `references/` y templates bajo `meta-harness/` (condicionado a la granularidad).
- Cómo se fecha un snapshot local (fecha + versión de CLI del host).
- Corpus de evidencia extra por tipo (ampliar E1–E6; etiquetar huecos). Reanclar SkillsBench a v4.
- T8/T13 Codex: ausentes (docs 2026-09-10). T14 Codex: `tui.status_line` existe.
- Tope Codex `description`: **cerrado D29**. 1024 portable + listing. 500 no se promueve.
- Prune de stubs: observable = grep limpio, no un número de días (ya decidido; falta la fila de fecha al aterrizar AC28).
- Disable T1: Codex `[[skills.config]] enabled=false` (restart). Grok `[skills] disabled = ["name"]`.

Lookup W2 (D22 receta), sellos 2026-09-10:

| Fuente | URL / path |
|---|---|
| Agent Skills spec | https://agentskills.io/specification (`description` ≤1024; `name` ≤64; SKILL.md &lt;500 líneas) |
| Agent Skills índice | https://agentskills.io/llms.txt |
| Codex skills (vigente) | https://learn.chatgpt.com/codex/build-skills.md |
| Codex config | https://developers.openai.com/codex/config-reference (`tui.status_line`) |
| Grok user-guide | `~/.grok/docs/user-guide/` (08 skills, 10 hooks, 16 subagents, 25 status-line, 05 config workflows) |
