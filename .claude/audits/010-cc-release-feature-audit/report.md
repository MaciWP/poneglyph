# CC Release Feature Audit 010 — adopción de features (2.1.222 → 2.1.258) + Codex CLI (0.146 → 0.152.1) + Grok Build (1.0.5 → 1.0.13)

**Date**: 2026-09-02
**Scope**: changelog de Claude Code 2.1.222→2.1.258 (aportado por Oriol) × `~/.grok/CHANGELOG.md` 1.0.6→1.0.13 × releases de Codex 0.147→0.152.1 (GitHub) × la capa Poneglyph (`.claude/`, CLAUDE.md, adaptadores Codex/Grok). Prioridad declarada por Oriol: **que Claude Code funcione mejor y entregue código de calidad** — lo cosmético queda fuera.
**Mode**: `/dev` + `/drillme` (3 rondas, 11 decisiones D1–D11) en plan mode; bucket A aplicado en la misma tanda, bucket B ratificado antes de tocar nada.
**Method**: inventario inline (Lead `Read`/`Grep`/`Bash`, cero agentes) → cruce con los tres changelogs → verificación contra `code.claude.com/docs/en/{settings-reference,env-vars,hooks,skills}.md`, `~/.grok/docs/user-guide/*` y `grok inspect` → buckets A/B/C/BC → aplicar.
**Relación con 009**: sucesor directo (009 = 2.1.136→2.1.161). 009/B2 (`/code-review` en `critic`) seguía sin aplicar y se cierra aquí (D10).

---

## Veredicto

La config era **madura pero desincronizada en tres capas**: la capa viva `~/.claude/settings.json` iba por detrás del repo, los adaptadores Codex/Grok no estaban instalados en esta máquina, y `harness-adapters.md` describía a Grok al revés de cómo funciona (carga TODA la capa Claude por compat, hooks incluidos). El resto son features 2.1.222+ que resuelven contradicciones reales de doctrina (atribución IA, modelo de subagentes, mensajes entre sesiones, fork).

| Bucket | Significado | Count | Estado |
|---|---|---|---|
| **A** — Drift factual en config/docs vivas | Error verificable, barato | 12 | 🟢 aplicados |
| **B** — Feature que resuelve un problema real | Accionable | 9 | 🟢 7 aplicados · ⚪ 2 declinados (B8 parcial, B9) |
| **BC** — Cambio de comportamiento | Solo awareness | 6 | registrados |
| **C** — No aplica / declinado por diseño | Registro honesto | 9 | registrados |

---

## Decisiones (drillme)

| Ref | Decisión | Aplicada en |
|---|---|---|
| D1 | Informe + A ahora + B ratificados | este fichero |
| D2 | Grok: `[compat.claude] hooks = false` | `~/.grok/config.toml` (fuera del repo) |
| D3 | Quitar `TaskCreate/TaskUpdate/TaskList/TaskGet` | `settings.global.json`, `commands/flow.md` |
| D4 | Instalar Codex + `consult` por PATH + twin Grok | `sync-codex --execute`, `consult/SKILL.md`, `~/.grok/rules/poneglyph-sp.md` |
| D5 | `attribution.commit/pr = ""` | `settings.global.json` |
| D6 | `CLAUDE_CODE_SUBAGENT_MODEL` = tier barato (backstop) | `settings.global.json` env + barrido de spawns en 6 skills |
| D7 | Gate de spawn cubre `SendMessage`/`@sesión`; `crossSessionInbound` en default `notify` | `CLAUDE.md:33`, `post-compact.ts` |
| D8 | Playbook re-encabezado para modelos no-Fable + §4 refrescado | `docs/model-uplift-playbook.md` |
| D9 | Nota doctrinal fork/background; P1 se mantiene | `orchestrator-protocol` + refs 03/04 |
| D10 | `/code-review` documentado en `critic` (cierra 009/B2) | `critic/SKILL.md` Step 4 + Step 7 |
| D11 | Claude `--restricted` como tercer adaptador de `consult` | `consult/SKILL.md` v2.1.0 |

---

## A — Drift factual (aplicado)

| Ref | Hallazgo | Evidencia | Fix aplicado |
|---|---|---|---|
| A1 | Permisos y `allowed-tools` para `TaskCreate/…/TaskGet`, tools retiradas en Fable 5 / Opus 4.8 / Sonnet 5+ (2.1.233) | `settings.global.json:29-32`, `flow.md:4,21` | Eliminados (D3). `flow.md` ya declaraba que `state.json` + `flow-state.ts` bastan |
| A2 | `~/.claude/settings.json` generado con `minimumVersion` 2.1.198 mientras el repo dice 2.1.228 (commit e57b711 sin re-sync) | `grep minimumVersion ~/.claude/settings.json` | `sync-claude --execute` → 2.1.228 en vivo; además enlazó 7 docs que faltaban en `~/.claude/docs/`. `system-inventory.md` ya no cita el número: apunta a `settings.global.json` |
| A3 | Grok Build carga la capa Claude ENTERA por `compat.claude.*` (default on): CLAUDE.md, rules, 37 skills+commands, permisos y los hooks de `~/.claude/settings.json`. `harness-adapters.md`/`README.md` decían "hooks deliberately excluded" y "solo recibe el twin"; el twin no existía en esta máquina | `grok inspect` (Hooks (32) user; Skills 37 `[claude]`; Project Instructions incl. `Claude.md` y `.claude/rules/*`); `~/.grok/docs/user-guide/{05,08,10,12}.md` | D2 aplicada (`hooks OFF (config)` verificado); twin copiado (`sync-claude --status` → 🟢 content-equal); `harness-adapters.md`, `README.md`, `system-inventory.md` reescritos con la topología real |
| A4 | `consult` con rutas macOS fijas (`~/.local/bin/{codex,grok}`) y versiones de 2026-08-06 | `which codex grok`: `AppData/Local/Programs/OpenAI/Codex/bin/codex` (0.144.6), `~/.grok/bin/grok` (1.0.13) | Binarios por PATH (`command -v`); tabla de adaptadores reescrita; flags `codex exec --sandbox read-only --ephemeral --skip-git-repo-check` verificados en `codex exec --help` |
| A5 | Adaptador Codex no instalado (`sync-codex --status`: 6× missing) | `ls ~/.codex` sin `AGENTS.md` ni `skills/` | `sync-codex --execute --backup --force` → 6× linked; `AGENTS.md` 24 607 B de 32 768 (75 %) |
| A6 | `model-uplift-playbook.md` con premisa caducada ("post-Fable era"); §4 verificado solo hasta 2.1.201; Sonnet 5 "promo hasta 31 ago" | Fable 5.1 default desde 2.1.257; precio Sonnet 5 permanente (2.1.243) | Encabezado re-scope + §4 con fila Fable 5.1, `/effort` por modelo (2.1.251), `s` sesión (2.1.257), fila de subagent default |
| A7 | Doctrina de orquestación sin 2.1.232 (background por defecto, `fork` hereda conversación + caché) — "los 3 costes de delegar" ya no describen al fork; skills que spawnean asumían retorno síncrono | `orchestrator-protocol/SKILL.md:56-64`, `critic:155`, `graphify:252`, `scope:204`, `decide/heavy/01:505`, `deep-research:100` | Párrafo "Fork and background" + fila en Step 4; tabla "Primitive by context need" en `04-agent-selection.md`; filas fork/default en `03-complexity-routing.md`; cada spawn documentado exige modelo explícito y espera la notificación |
| A8 | `meta-settings-cookbook` refs 02/04/05 sin las claves 2.1.222+ | tablas de `references/{02,04,05}.md` | `attribution`, `fallbackModel`, `promptCacheTtl`, `modelPicker`, `modelOverrides`, `feedbackDrafts`, `crossSessionInbound`, `dialogExpiry`, `minimumVersion`; env `ANTHROPIC_DEFAULT_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL(_FORCE)`, `CLAUDE_CODE_ENABLE_TODO_TOOLS`, `CLAUDE_CODE_RESTRICTED`, `…DISABLE_1M_CONTEXT`, `…GOAL_CHECKIN_MINUTES`, `…WEBFETCH_CACHE_TTL_MS`; `effortLevel` con `xhigh`/`max`; gotchas de scope (bypassPermissions 2.1.257, wildcard 2.1.246) |
| A9 | Catálogo de eventos de hook incompleto (26 de 32) y protocolo stdout desfasado | `hooks` doc oficial: 32 eventos; 2.1.248 | Añadidos `Setup`, `UserPromptExpansion`, `PostToolBatch`, `DirectoryAdded`, `PreModelSwitch`, `PostModelSwitch`; tabla de exit codes + nota 2.1.248 (JSON inválido = error) + `if` best-effort (2.1.243); fila y nota en `rules/paths/hooks.md` |
| A10 | `frontmatter-spec.md` declaraba inválidos `allowed-tools` y `model`, que la doc oficial lista como campos de skill; faltaban `when_to_use`, `user-invocable`, `context`, `agent`, `background`, `hooks`, `shell` | `code.claude.com/docs/en/skills.md` tabla de frontmatter | Tabla alineada con los 17 campos oficiales; claves Poneglyph (`metadata.keywords`, `type`, `version`) marcadas como propias; `meta-create/SKILL.md` reminder #5 corregido |
| A11 | `local-model/`: 2.1.251 pone `Co-Authored-By: Claude Code` con modelos no reconocidos; 2.1.233 emite `[claude-code:unrecognized_model]` | changelog | Fila añadida a "What it costs" apuntando a D5. `CLAUDE_CODE_MAX_CONTEXT_TOKENS` sigue necesario `[Probable — 2.1.223 solo encaja el modelo desconocido en la ventana ASUMIDA de 200K]` |
| A12 | Sin `attribution`: el harness instruía `Co-Authored-By: Claude Fable 5.1` + footer "Generated with Claude Code", contra CLAUDE.md §Git/PR | esquema `claude-code-settings.json`: `attribution.commit`/`pr` **string**, "Empty string hides" | D5: `{"commit": "", "pr": ""}` en `settings.global.json` (verificado en el generado y con `claude -p` sin Settings Error) |

## B — Features adoptadas / declinadas

| Ref | Feature (release) | Decisión | Detalle |
|---|---|---|---|
| B1 | `attribution.commit/pr` (settings-reference; `includeCoAuthoredBy` deprecado) | 🟢 D5 | Cierra A12 en origen |
| B2 | `CLAUDE_CODE_SUBAGENT_MODEL` como default (2.1.251) | 🟢 D6 | `claude-haiku-4-5-20251001` (mismo ID que `fallbackModel`). Riesgo aceptado por Oriol: degradación silenciosa si un spawn omite `model` → mitigado con el barrido A7. Los forks no se ven afectados (heredan el modelo del padre) |
| B3 | Cross-session `SendMessage`/`ListAgents` en Windows (2.1.239), `@sesión` (2.1.232), `crossSessionInbound` (2.1.224) | 🟢 D7 | Gate ampliado en CLAUDE.md + `post-compact.ts`; `crossSessionInbound` en default `notify` (fijarlo sería ruido, Cmd IX) |
| B4 | `/code-review` en background a todos los niveles (2.1.232), `--fix`, `--comment` GitLab (2.1.257) | 🟢 D10 | Documentado en `critic` Step 4 como check mecánico opcional; `/ultrareview` solo user-invokable |
| B5 | `--restricted` / `CLAUDE_CODE_RESTRICTED` (2.1.248) | 🟢 D11 | Tercer adaptador de `consult`: `claude -p --restricted --model <tier> --output-format text`. Sonda viva: `READY` en 2,3 s |
| B6 | Codex 0.147→0.152.1: hooks nativos en `config.toml` (0.148, async + MCP; `Interrupt` 0.150), `codex exec fork` (0.148), `codex agents`/`codex queue` (0.149), `@` tareas (0.150), proyectos no confiados sin `AGENTS.md` (0.150), planning tool off por defecto (0.152), `--full-auto` retirado (0.147) | 🟢 docs | `harness-adapters.md`: hooks Codex excluidos **por decisión**, no por falta de contrato. `consult` no se rompe (verificado `codex exec --help` + sonda `READY` 6,5 s). Fechas de los releases tomadas de resúmenes de GitHub `[Probable]`; bullets verbatim |
| B7 | Grok 1.0.6→1.0.13: `/workflow --effort` y `--agent-budget` (1.0.9), hooks confirm/defer/add-context (1.0.13), `ui.permission_mode` (1.0.11), rules con headings renderizan (1.0.9), `Rules`/`Claude.md`/`.claude/rules` por compat | 🟢 docs | Topología real en `harness-adapters.md`; sonda `grok -p --sandbox read-only` → `READY` 11,5 s |
| B8 | `claude plugin validate .claude` (2.1.233) | 🟢 parcial | Añadido al doctor del repo (`AGENTS.md`, `README.md`, `harness-adapters.md`); pasa hoy. No se automatiza en un hook (Cmd IX) |
| B9 | `timeFormat`/`timeZone` (2.1.257), `spellcheck` (2.1.235), `keybindingFlavor` (2.1.238) | ⚪ declinado | Cosmético; fuera de la prioridad de Oriol |

## BC — Cambios de comportamiento (awareness)

| # | Cambio (release) | Interacción con Poneglyph |
|---|---|---|
| BC1 | Subagentes en background + `fork` por defecto (2.1.232); notificaciones entre turnos dentro de `<system-reminder>` (2.1.234) | Doctrina actualizada (A7). Nunca predecir el resultado de un agente |
| BC2 | Output styles custom ya no derivan a la voz por defecto a mitad de sesión (2.1.238) | El "within-session decay" del dossier de `system-inventory.md` debería reducirse; medible con `evals/compare.ts` cuando interese |
| BC3 | Claves que ignoran project/local: `defaultMode: bypassPermissions` (2.1.257), `remoteControlAtStartup` (2.1.222), `env.CLAUDE_CONFIG_DIR`/`TMPDIR` (2.1.251), `sandbox.ripgrep` (2.1.232) | Nuestra config vive en user scope; sin impacto. Documentado en cookbook 02/05 |
| BC4 | Hooks: stdout `{…}` inválido = error reportado (2.1.248); `if` best-effort (2.1.243) | Los 5 hooks emiten JSON válido o prosa sin `{` inicial; sin impacto. Documentado |
| BC5 | `Write` puede sobrescribir sin `Read` previo en modelos nuevos (2.1.228) | La anti-pattern "Edit sin Read" sigue siendo buena práctica; sin cambio |
| BC6 | "Default teammate model" retirado (2.1.234); `CLAUDE_CODE_SUBAGENT_MODEL` es default, no override (2.1.251); `_FORCE` (2.1.257) | Refuerza "modelo explícito en cada spawn" (CLAUDE.md §Agent spawn) |

## C — No aplica / declinado por diseño

`modelPicker` (Max plan; el modelo local entra por `ANTHROPIC_BASE_URL`) · `promptCacheTtl`/`subagentPromptCacheTtl` (Max plan ya tiene 1 h; la doc los orienta a API key/cloud) · `PreModelSwitch` hook como guardián de cambio de modelo (sobre-ingeniería) · `SendFeedback`/`feedbackDrafts` (default on, se deja) · self-hosted runner · Remote Control · GitLab · Bedrock/Vertex/Foundry · `desktopSessionCleanupPeriodDays` · extender `sync-claude.ts` para instalar el twin Grok (el checker es "check, not install" a propósito) · revisión formal de P1/"3 costes" (D9: solo nota; abrir `decide` heavy si algún día se cuestiona).

---

## Verificación (REVIEW)

| Check | Resultado |
|---|---|
| `bun test ./.claude/` | Primera pasada: 374 pass / **8 fail** (`security-gate.test.ts` ×6, `skill-activation.test.ts` ×1, `sync-codex.test.ts` ×1), ninguno en ficheros tocados por el audit — semántica de rutas Windows sobre fixtures POSIX. Tras el seguimiento T1 (abajo): **384 pass / 0 fail** (382 + 2 tests nuevos) |
| `claude plugin validate .claude` | ✔ Validation passed |
| `sync-claude --status` | 🟢 settings.json · 🟢 sp twin · 🟢 grok twin (copia content-equal) |
| `~/.claude/settings.json` | `minimumVersion` 2.1.228 · `attribution` presente · `CLAUDE_CODE_SUBAGENT_MODEL` presente · sin `Task*` |
| `sync-codex --status` | 6× linked; `AGENTS.md` 24 607 B (< 32 768) |
| `grok inspect` | `claude → hooks OFF (config)`; Hooks 32→31 (el resto vienen de `~/.grok/hooks/*.json` de Orca/emdash, no de Claude); Project Instructions y Skills siguen cargando |
| Sondas `consult` | `claude --restricted` READY 2,3 s · `codex exec` READY 6,5 s · `grok -p` READY 11,5 s |
| `bun .claude/evals/run.ts` | ver §Evals |
| D6 (`/tasks` muestra el modelo del subagente) | ⚪ pendiente del primer spawn aprobado en una sesión nueva |
| D5 (sin trailer) | ⚪ pendiente del próximo commit que Oriol pida |

### Seguimiento T1–T3 (aplicado tras "continúa por donde lo has dejado")

| Ref | Hallazgo | Causa raíz | Fix | Evidencia |
|---|---|---|---|---|
| T1 | `security-gate.ts::resolveMutationLocation` daba `external` en Windows para `cd src && git commit` (y para los fixtures POSIX del test), silenciando el aviso de disciplina git | Comparaba `cwd` sin normalizar contra `base` normalizado y usaba `"/"` literal como separador (`dir.startsWith(base + "/")`), que en Windows nunca casa | Normaliza ambos lados con `path.resolve` y compara con `isInsideBase()` (`path.relative` — agnóstico de separador, insensible a mayúsculas donde el SO lo es, otro disco = externo). `ponytail`: rutas Git Bash (`cd /d/PYTHON/x`) siguen leyéndose como externas (fail-open) | 6 tests antes rojos → verdes; +2 tests nuevos (cd nativo dentro del árbol → session; hermano con el mismo prefijo → external). En runtime el payload `cwd` es nativo (`D:\…`) `[Probable — no reproducido con un Stop real; la normalización hace equivalentes ambos caminos]` |
| T1b | `skill-activation.test.ts` "fail-silent on unwritable destination" usaba `/dev/null/nope` — en Windows resuelve a `D:\dev\null\nope` y el `mkdir` **tiene éxito**, dejando basura en el disco | Fixture no portable | Fixture = ruta bajo un FICHERO regular temporal (falla en todo SO) | Test verde. Basura previa en `D:\dev\null\nope\.claude\learned\skill-hints.log` (2026-08-24) pendiente de borrar — `rm -r` es destructivo: lo decide Oriol |
| T1c | `sync-codex.test.ts` esperaba `"/repo/CLAUDE.md"` literal frente a `path.join` nativo | Fixture no portable | `path.join` en las dos entradas literales | Test verde |
| T2 | Eval `devloop-trivial-21` contradecía `ca797ff` (bucle completo también en lo trivial) | Caso escrito el 2026-08-05, doctrina invertida el 2026-08-10 | Caso cortado; `evals/README.md` con 20 casos y la justificación; el modo `no-ceremony` del grader se conserva (3 tests propios, reutilizable) | Suite de graders verde |
| T3 | `skill-drillme-01` under-trigger 2/2 con "valida este plan antes de cerrarlo" | El hook exige frase multi-palabra o ≥2 palabras distintas; `drillme` solo tenía `valida` suelto y los "antes-de-cerrar" con guiones **nunca casan** con texto real | Keywords de `drillme`: `valida este plan`, `valida el plan`, `cuestiona el plan`, `antes de cerrar`, `antes de decidir` (sin guiones) | Probe del hook: emite `Skill(drillme) — matched "valida este plan"`; "valida que el endpoint responde 200" sigue en silencio (precisión intacta). `claude plugin validate` ✔. Re-run del eval: ver línea final de §Evals |

### Regresión introducida y corregida (honestidad, Cmd III)

La primera versión de D5 escribió `attribution.commit: false` / `pr: false`, siguiendo el resumen de la doc de referencia ("string or false"). El esquema real de 2.1.258 exige **string** y Claude Code, ante UNA clave inválida, **descarta `~/.claude/settings.json` entero** — Oriol lo vio como "Settings Error … Files with errors are skipped entirely" al abrir una sesión nueva: sin hooks, sin permisos, sin estilo. Corregido a `""` (el esquema documenta "Empty string hides"), re-sync y validado con `claude -p` (sin error) el mismo día. Lección incorporada al checklist de audits (memoria `release-audit-checklist-cc`): **validar el settings generado lanzando un `claude -p` antes de dar el sync por hecho** — la verificación de A2 miró el fichero, no si Claude Code lo aceptaba. Recomendación R1 (abajo): que `sync-claude --execute` haga esa comprobación por sí mismo.

### Evals

`bun .claude/evals/run.ts` (protocolo del repo tras tocar CLAUDE.md y descripciones de skills): **18/21**. Aplicado el protocolo "suspect the eval first":

| Caso | Fallo | Diagnóstico |
|---|---|---|
| `devloop-trivial-21` | `ceremony on trivial task: stages [goal, plan]` | **Eval caducado, no regresión**: el caso (2026-08-05, `expected: no-ceremony`) es anterior a `ca797ff` (2026-08-10, "require full KNOW→LEARN loop on every coding task"), que invirtió su premisa. Hoy la doctrina exige etapas visibles también en lo trivial. Recomendación: cortar el caso (contradice CLAUDE.md; convertirlo en "visible" lo haría casi duplicado de `devloop-nontrivial-20`) y ajustar el conteo en `evals/README.md`. Decisión de Oriol — no tocado en este audit |
| `skill-drillme-01`, `skill-techplan-02` | `expected Skill(x) invocation not found` | Disparo automático de skills con tools activas, `trials ×1` — estocástico por diseño (README §Known gaps: leer deltas, no absolutos). Ningún cambio de este audit toca la activación de `drillme`/`tech-plan` (la línea nueva de CLAUDE.md es sobre `SendMessage`; la descripción cambiada es la de `consult`). Re-lanzados en aislamiento: resultado en la línea siguiente |

Re-run aislado de los dos casos de skill (`trials ×1`, tools activas): `skill-techplan-02` **PASS** (flake confirmado), `skill-drillme-01` **FAIL** de nuevo (2/2 hoy). Nada de este audit toca `drillme`, su descripción ni `skill-activation.ts`, y el repo no guarda transcripts de runs anteriores, así que no hay baseline: se registra como **under-trigger pre-existente `[Probable]`** del prompt "valida este plan antes de cerrarlo" (ambiguo entre `drillme`, `critic` y `verify`; el hook no inyecta hint porque "valida" es una sola palabra clave). Seguimiento aplicado como T3 (frases multi-palabra en las keywords de `drillme`): re-run aislado de `skill-drillme-01` → **PASS** (1/1). Suite de evals efectiva tras T2+T3: 20 casos, los 20 con evidencia de paso en esta sesión (18 en la pasada completa + `skill-techplan-02` y `skill-drillme-01` en re-runs aislados).

---

## Riesgo residual

- D6 puede degradar en silencio un spawn que omita `model`. Mitigación aplicada en doctrina y en las 6 skills que spawnean; la verificación real es el primer `/tasks` de una sesión nueva.
- Los cambios de settings viven a partir de la **siguiente** sesión (settings se cargan al arrancar).
- Las fechas de los releases de Codex proceden de resúmenes de GitHub y no coinciden entre sí; los bullets son verbatim y se han contrastado con `codex exec --help`.

## Recomendaciones (opinión del Lead al cierre, 2026-09-02)

| Ref | Recomendación | Evidencia de esta sesión |
|---|---|---|
| R1 | `sync-claude --execute` valida el settings generado contra el esquema (o lanza `claude -p "ok"` y falla si aparece "Settings Error") antes de declarar 🟢 | La regresión D5: un valor inválido desactivó toda la capa de usuario y el sync lo reportó como éxito |
| R2 | Doctor único (`bun doctor`: sync-claude --status + sync-codex --status + `claude plugin validate` + `bun test`) enganchado al `pre-commit` de husky (hoy solo corre `bun test ./.claude/hooks/`) | Capa viva 30 días retrasada, adaptadores sin instalar, suite roja en Windows desde el 24 de agosto sin que nadie lo viera |
| R3 | CI en matriz Windows + Ubuntu (`.github/workflows/ci.yml` existe) | 8 tests rotos solo en Windows; el gate de calidad estaba apagado en la máquina principal |
| R4 | Presupuesto de tokens always-loaded y dedupe: CLAUDE.md + rules + style = 36 KB, frontmatters de 32 skills = 33 KB; el texto del gate de spawn vive en 4 sitios | Cmd IX pide reducir; la capa crece con cada regla |
| R5 | Evals: subconjunto barato por cambio (graders offline + 5 casos vivos) y la suite completa mensual; audit de releases cada 4-6 semanas | Un caso contradijo la doctrina 3 semanas sin que nadie lo notara; 009→010 pasaron 3 meses y hubo drift en tres capas |

R1–R4 se ejecutaron como **plan 032** (`.claude/plans/032-polish-pass/plan.md`, 2026-09-03): validación del settings generado con `claude doctor` en sync-claude, `bun run doctor`, CI Windows + Ubuntu, dedupe de gates, dieta de skills con trinquete de presupuesto, plugin privado para el contenido de empresa. R5 (cadencia de evals/audits) queda abierto.

## Fuentes

Changelog CC 2.1.222–2.1.258 (Oriol) · `~/.grok/CHANGELOG.md` (1.0.6–1.0.13) · `github.com/openai/codex/releases` (0.147.0, 0.148.0, 0.149.0–0.152.1 vía `learn.chatgpt.com/docs/changelog`) · `code.claude.com/docs/en/{settings,settings-reference,env-vars,hooks,skills}.md` · `~/.grok/docs/user-guide/{05-configuration,08-skills,10-hooks,12-project-rules,14-headless-mode,26-config-reference}.md` · `grok inspect`, `codex exec --help`, `claude --help`.
