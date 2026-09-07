# CC Release Feature Audit — adopción de features (2.1.136 → 2.1.161)

**Date**: 2026-06-03
**Scope**: Claude Code release notes 2.1.136→2.1.161 (+ high-value earlier) × poneglyph `.claude/` config. Deliverable = análisis, no código.
**Mode**: `/flow --full` degradado a **research-audit-light** (regla del propio `/flow`: deliverable=informe → ceremonia ligera, sin spec/tasks/tdd machinery; sustancia temprano). Commandment III.
**Method**: inventory `settings.json` + 4 hooks registrados + agents/skills frontmatter (Grep) → cross-ref vs release notes limpias (`/release-notes`) → bucket A/B/C → advisor (Opus) pre-write.
**Relación con 005**: complementario. **005 = config *correctness*** (¿funciona como dice?). **Este = *adopción de features*** (¿qué capacidades nuevas de CC no aprovechamos?). Cero solapamiento de hallazgos.

---

## Veredicto

Config **madura y al día**. La mayoría de features relevantes 2.1.x ya están adoptadas (ver §Ya adoptado). El valor del audit son **los gaps**, no la enumeración.

| Bucket | Significado | Count |
|---|---|---|
| **A** — Drift factual en config viva | Error verificable, must-fix, barato | 1 |
| **B** — Feature que resuelve problema real | Accionable | 3 |
| **C** — Existe pero no aplica / declinado-por-diseño | Registro honesto, sin acción | 5 |
| **BC** — Cambio de comportamiento (no es gap) | Solo awareness | 3 |

**Top accionable** (orden impacto×facilidad):
1. **A1** — keyword `"workflow"` → `"ultracode"` en CLAUDE.md + `flow.md` (error factual, trivial).
2. **B2** — documentar `/ultrareview` + `/code-review --fix` en skill `critic`.
3. **B1** — evaluar `hook args` exec-form para robustez de hooks en Windows.

---

## A — Drift factual en config viva (must-fix)

### A1 · Keyword de dynamic-workflows: `"workflow"` → `"ultracode"`

| | |
|---|---|
| **Release** | 2.1.160 — *"Renamed the dynamic-workflow trigger keyword from `workflow` to `ultracode`. The word "workflow" no longer triggers a run."* |
| **Estado** | ❌ CLAUDE.md §Execution modes y `.claude/commands/flow.md` (×2: nota Phase 3 + "explicit user opt-in") siguen diciendo `keyword "workflow"`. |
| **Confirmación** | La propia descripción de la tool `Workflow` exige keyword `"ultracode"`. |
| **Riesgo** | Instrucción factualmente falsa: un lector/agente cree que "workflow" dispara opt-in; no lo hace desde 2.1.160. |
| **Fix** | Reemplazar `"workflow"` → `"ultracode"` en ambos ficheros; añadir nota "la palabra workflow ya no dispara run". |
| **Commandment** | II (verdad factual) + X (mantenibilidad). |

> Nota: 005 #10 ya marcó las afirmaciones de versión con disclaimer "verify vs release notes" — A1 es un caso concreto que ese disclaimer cubre pero no corrigió.

---

## B — Feature que resuelve problema real (accionable)

### B1 · `hook args: string[]` (exec form) — robustez de hooks en Windows

| | |
|---|---|
| **Release** | 2.1.139 — *"hook `args: string[]` field (exec form) that spawns the command directly without a shell, so path placeholders never need quoting."* |
| **Contexto** | Los 4 hooks de poneglyph son command-strings `bun ${CLAUDE_PROJECT_DIR}/.claude/hooks/*.ts`. El changelog muestra **bugs recurrentes de invocación de hooks en Windows** (2.1.45 hooks fallando silenciosamente→Git Bash; 2.1.136 `/usr/bin/bash`; 2.1.161 hooks invocando bash explícitamente fallan). |
| **Por qué** | Exec-form (`"args": ["bun", "${CLAUDE_PROJECT_DIR}/.claude/hooks/x.ts"]`) evita el parsing de shell por completo. **Preventivo** — no corrige un flake conocido en este repo (`${CLAUDE_PROJECT_DIR}` actual sin espacios). |
| **Acción** | Evaluar exec-form para los 4 hooks; documentarlo en templates de `meta-create/references/hook/`. |
| **Prioridad** | Media-baja. **No confirmado que los hooks bun hayan fallado aquí** — es endurecimiento, no parche. |
| **Commandment** | VII (eficiencia) + X. |

### B2 · `/ultrareview` + `/code-review --fix/--comment` no documentados en skill `critic`

| | |
|---|---|
| **Release** | 2.1.111 `/ultrareview` (cloud multi-agent paralelo); 2.1.147 `/code-review` (renombrado de `/simplify`, `--comment`); 2.1.152 `/code-review --fix` (aplica findings al working tree). |
| **Estado** | `/code-review` **YA en uso** (005 corrió vía `/code-review xhigh`). Pero el skill `critic` (Phase 4) **no documenta** estas opciones. |
| **Acción** | Añadir a `critic/SKILL.md`: (a) `/ultrareview` como opción **user-invokable** para full-mode (multi-agent cloud) — ⚠️ NO auto-delegable: es billed + user-triggered, el Lead no puede lanzarla; (b) `/code-review --fix` como ruta de aplicación de findings. |
| **Prioridad** | Media. Cierra el gap doc entre el skill `critic` y los comandos nativos que ya complementan Phase 4. |
| **Commandment** | IV (gates) + IX (auto-mejora). |

### B3 · `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` — defense-in-depth en subprocesos

| | |
|---|---|
| **Release** | 2.1.83 — strips Anthropic + cloud creds del env de subprocesos (Bash, **hooks**, MCP stdio). |
| **Contexto** | poneglyph es hooks-heavy (4 subprocesos `bun` por evento) + MCP `context7`. |
| **Estado** | No seteado. |
| **Prioridad** | **Baja** — el repo se autodeclara non-enterprise-security, single-user (005). Pero es one-line + gratis, higiene VI. |
| **Commandment** | VI (seguridad). |

---

## C — Existe pero no aplica / declinado-por-diseño (registro honesto)

| # | Feature (release) | Veredicto |
|---|---|---|
| C1 | `/goal` — completion-condition autónomo cross-turn (2.1.139) | **Declinado por diseño.** Choca con la filosofía de hard-gates human-only (`/flow`, Commandment I/IV). Útil como tool a conocer, no a wirear. |
| C2 | hook `continueOnBlock` PostToolUse (2.1.139) | **Solo evaluar — NO es fix de 005 #2.** `code-validator` (PostToolUse) ya hace `exit 2`, que ya surfacea stderr a Claude. `continueOnBlock` afecta sobre todo el halting del turno → probablemente redundante con el comportamiento actual. Verificar antes de tocar. |
| C3 | `MessageDisplay` hook — transformar/ocultar texto del asistente (2.1.152) | **Declinado.** Forzar el estilo poneglyph terse vía hook es over-engineering vs el output-style file. |
| C4 | `fewer-permission-prompts` / `/less-permission-prompts` (2.1.111) | **N/A.** `settings.local.json allow:["*"]` + `defaultMode:auto` → fricción de permisos ya nula. |
| C5 | `disallowed-tools` en skills (frontmatter) (2.1.152) | **Mejora menor opt-in.** Agents ya usan `disallowedTools`; skills podrían quitar tools mientras activos (ej. skills read-only de research). Anotado, no urgente. |

> **Verificar, no afirmar** — `autoMemoryDirectory` (2.1.74) / auto-memory (2.1.32/59/154): la memoria de poneglyph en `~/.claude/projects/.../memory/` (MEMORY.md index + ficheros por-fact) **tiene la forma de la auto-memory nativa de CC**. Probable alineación → sin acción, pero no afirmado como equivalencia sin verificar.

---

## BC — Cambios de comportamiento a tener en cuenta (no son gaps de config)

| # | Cambio (release) | Interacción con poneglyph |
|---|---|---|
| BC1 | **Lean system prompt** ahora default salvo Haiku/Sonnet/Opus≤4.7 (2.1.154) | CLAUDE.md es **grande**. Con system prompt lean, las project-instructions pesan proporcionalmente más en contexto. Awareness → posible trim de CLAUDE.md (Commandment VII). |
| BC2 | **Claude reserva la multiple-choice question** para decisiones que genuinamente no puede tomar (2.1.154) | Skills AskUserQuestion-heavy (scope 5-Q, drillme). Los **hard gates de `/flow` siguen disparando** (son llamadas AskUserQuestion explícitas), pero skills que "preguntan ante duda" ahora preguntan menos autónomamente. Awareness. |
| BC3 | **acceptEdits prompts** antes de `.npmrc`/`.yarnrc*`/`bunfig.toml`/`.bazelrc`/`.pre-commit-config.yaml`/`.devcontainer/` (2.1.160) | `builder` tiene `permissionMode: acceptEdits`. Si builder edita esos ficheros, **ahora prompteará** aun en acceptEdits → puede interrumpir flujos de build sobre config-files. Awareness. |

---

## Ya adoptado (crédito — qué SÍ usamos)

| Feature | Release | Evidencia |
|---|---|---|
| `autoMode.hard_deny` | 2.1.136 | `settings.json:161-169` |
| `defaultMode: auto` (auto mode) | 2.1.152 | `settings.json:62` |
| `effortLevel: xhigh` + per-skill `effort:` | 2.1.111 / 2.1.80 | `settings.json:133` + 20 skills |
| Advisor tool + `advisorModel: opus` | 2.1.117 | `settings.json:151` (+ tool en sesión) |
| `worktree.baseRef: head` | 2.1.133 | `settings.json:116` |
| `ENABLE_PROMPT_CACHING_1H` | 2.1.108 | `settings.json:11` |
| `spinnerVerbs` (replace, ES) | 2.1.23 | `settings.json:137-150` |
| `statusLine.refreshInterval` | 2.1.97 | `settings.json:118-123` |
| Agent frontmatter `disallowedTools`/`permissionMode`/`skills:`/`initialPrompt`/`background:` | 2.0.30→2.1.49 | `builder.md`, `reviewer.md`, `scout.md` |
| `promptSuggestionEnabled`/`awaySummaryEnabled`/`agentPushNotifEnabled` off | 2.1.x | `settings.json:152-154` (tuneado deliberadamente) |
| `enabledPlugins` (context7, skill-creator, frontend-design, typescript-lsp) | 2.0.12+ | `settings.json:124-129` |
| `ENABLE_LSP_TOOL` | 2.0.74 | `settings.json:6` |
| MCP tool search auto | 2.1.7 | deferred tools en sesión (default) |
| Opus 4.8 | 2.1.154 | env (modelo de sesión) |
| `events-catalog.md` (meta-create) completo y actualizado | — | 20+ eventos, incl. los nuevos |

---

## NIT (opcional, bajo valor)

- **`paths/hooks.md` tabla de eventos** lista 8 vs 20+ en `events-catalog.md`. **NO es defect** — la tabla tiene columna "Usage in Poneglyph" = subset curado, no spec exhaustiva (esa es `events-catalog.md`). Opcional: añadir 1 línea de cross-ref a `events-catalog.md`.

---

## Próximos pasos (ratificación del usuario)

El deliverable es este informe. Las acciones son features a ratificar, no implementadas:

1. **¿Aplico A1?** (workflow→ultracode en CLAUDE.md + flow.md) — recomendado, trivial, error factual.
2. **¿Aplico B2?** (documentar `/ultrareview` + `/code-review --fix` en `critic`).
3. **¿Evalúo B1?** (exec-form hooks) y/o **B3** (`SUBPROCESS_ENV_SCRUB`).
4. C/BC: solo registro — sin acción salvo que decidas lo contrario.
5. ¿Render HTML del informe? (skill `html-report` disponible).
