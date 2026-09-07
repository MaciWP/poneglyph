# Plan 033 — Sesiones headless: nunca en un tier caro sin permiso

## Contexto

El 2026-09-03 el Lead lanzó **82 sesiones `claude -p`** en un día (sondas de activación, evals, repeticiones tras la cuota y tras revertir un cambio). Por modelo `[Seguro — primer "model" de cada transcript en ~/.claude/projects]`:

| Modelo | Sesiones | Origen |
|---|---|---|
| claude-opus-5 | 44 | `evals/run.ts` no pasa `--model`: el headless por defecto cae en Opus |
| claude-fable-5-1 | 29 | `probe-activation.ts` con `--model claude-fable-5-1` explícito ("mismo modelo que el diario") |
| claude-sonnet-5 / haiku | 9 | pruebas sueltas |

Causa raíz, en dos capas: (1) doctrina — CLAUDE.md §Agent spawn cubre "anything that starts a separate model worker", pero el Lead trató evals y sondas como comandos de verificación y no pidió permiso ni modelo; (2) mecánica — ningún script del repo fija un modelo barato por defecto ni rechaza uno caro, y ningún hook frena un `claude -p` sin `--model`. Resultado: 24 % de la cuota semanal y 43 % de Fable en una conversación. Oriol: "es tirar el dinero, no puede ocurrir".

Objetivo: que una sesión headless en Fable u Opus **no pueda ocurrir por defecto** — solo con una decisión explícita y visible.

## Decisiones (drillme, 1 ronda)

| Ref | Decisión | Estado |
|---|---|---|
| D1 | Tier por defecto para headless: **Haiku 4.5** para graders de prosa/estilo y smoke (`READY`), **Sonnet 5** para casos de disparo de skill y sondas de activación (el baseline de disparo en Haiku es ~20 %, demasiado ruidoso para leer deltas) | ratificado (Oriol, 2026-09-03) |
| D2 | Guard mecánico en la propia sesión: hook `PreToolUse` sobre `Bash` que bloquea `claude -p`/`--print` sin `--model` o con Fable/Opus sin `--allow-expensive` | ratificado |
| D3 | Observabilidad: fila del doctor "sesiones hoy por modelo" (🟡 si > 20/día) | ratificado |
| D4 | Política de repeticiones: como máximo UNA repetición por caso fallido; la segunda exige decisión de Oriol | fijo (Cmd X) |

## Paquetes

### WP-A — Doctrina (CLAUDE.md §Agent spawn, dueño único)

- Lista de superficies: añadir "headless `claude -p` / `--print` (evals, sondas, smoke, `consult`) — es un worker de modelo aparte".
- Tabla de defaults: fila "Regression evals, activation probes, smoke → cheapest tier (Haiku); skill-trigger cases → mid (Sonnet)". Fable/Opus en headless solo con permiso este turno.
- Coste: ~+250 B siempre cargado (13 200 → ~13 450, dentro del +5 % del trinquete).

### WP-B — Un solo resolutor de modelo para todo lo headless

| Fichero | Cambio |
|---|---|
| `.claude/scripts/lib/headless.ts` (nuevo) | `resolveHeadlessModel({ argv, kind })`: `kind` ∈ `style` \| `smoke` → `claude-haiku-4-5-20251001`; `skill-trigger` \| `probe` → `claude-sonnet-5`. `--model X` sobreescribe; si X casa `/fable|opus/i` y no viene `--allow-expensive` → lanza error con el motivo (coste). `--dry-run` imprime el comando resuelto sin spawnear. `EXPENSIVE_MODEL_RE` exportado (lo reutiliza el hook) |
| `.claude/evals/run.ts` | Usa el resolutor por caso (`c.type === "skill-trigger"` → `skill-trigger`, resto `style`); pasa `--model` siempre; `--dry-run` lista comandos; el informe imprime el modelo usado |
| `.claude/evals/compare.ts` | Mismo resolutor (`kind: "style"`), `--model` explícito siempre |
| `.claude/evals/probe-activation.ts` (movido desde `plans/032-polish-pass/activation/`) | Resolutor `kind: "probe"`; `--repeat` máximo 2 (D4); los JSON de 032 se quedan donde están como evidencia |
| `.claude/scripts/__tests__/headless.test.ts` | Defaults por kind, override, rechazo de Fable/Opus sin flag, aceptación con flag, dry-run |

### WP-C — Hook `PreToolUse` (Bash) — el freno en la sesión del Lead (D2)

| Fichero | Cambio |
|---|---|
| `.claude/hooks/headless-model-gate.ts` (nuevo) | Lee el payload `PreToolUse` (`tool_name === "Bash"`, `tool_input.command`). Función pura `judgeCommand(cmd)`: si invoca `claude` con `-p`/`--print` y (a) no lleva `--model` → **deny** ("headless sin modelo: añade `--model <tier barato>`"); (b) `--model` casa `EXPENSIVE_MODEL_RE` sin `--allow-expensive` → **deny**; (c) `bun … evals/run.ts|compare.ts|probe-activation.ts` con `--model` caro sin flag → **deny**. Salida: JSON `hookSpecificOutput.permissionDecision: "deny"` + `permissionDecisionReason`; en otro caso silencio (exit 0). Comandos sin `claude`: 0 I/O |
| `.claude/hooks/__tests__/headless-model-gate.test.ts` | Tabla de comandos: permitidos (`claude doctor`, `claude plugin validate`, `claude -p --model claude-haiku-4-5-20251001 x`), denegados (`claude -p x`, `claude -p --model claude-fable-5-1 x`, `bun .claude/evals/run.ts --model opus`), permitido con `--allow-expensive` |
| `.claude/settings.global.json` (`sensitive: user profile source`) | Registrar `PreToolUse` con `matcher: "Bash"` → `bun $HOME/.claude/hooks/headless-model-gate.ts`, timeout 5 |
| `.claude/rules/paths/hooks.md`, README (tabla de hooks), `docs/system-inventory.md` | Fila del hook; nota: PreToolUse es best-effort (#6305) — el cinturón; los defaults de WP-B son los tirantes |

### WP-D — Doctor: sesiones del día por modelo (D3)

| Fichero | Cambio |
|---|---|
| `.claude/scripts/doctor.ts` | Fila "Headless/sesiones hoy": cuenta transcripts de hoy en `~/.claude/projects/<slug>/*.jsonl` y agrupa por el primer `"model":"…"`; 🟡 si > 20 sesiones o si alguna es Fable/Opus y el total > 5; detalle "N sesiones (fable a · opus b · sonnet c · haiku d)". Función pura `summarizeSessions(entries, today)` |
| `.claude/scripts/__tests__/doctor.test.ts` | Casos: 3 sesiones sonnet → 🟢; 25 → 🟡; 6 con 1 fable → 🟡 |

### WP-E — Registro y política

| Fichero | Cambio |
|---|---|
| `.claude/evals/README.md` | Fila "Model policy": Haiku para estilo, Sonnet para disparo, Fable/Opus solo con `--allow-expensive` y permiso; "Repeticiones: máximo 1 por caso"; coste estimado por run con esos tiers |
| `.claude/skills/lessons/SKILL.md` | G13 — "A headless run is a spawn": evidencia (82 sesiones, 44 Opus + 29 Fable, 2026-09-03), regla (permiso + modelo barato por defecto + guard mecánico) |
| `.claude/skills/consult/SKILL.md` | Una frase: la propuesta por defecto para el adaptador Claude es el tier barato; Fable solo si Oriol lo nombra |
| `.claude/plans/032-polish-pass/plan.md` | Fila en §Respuesta a la review: incidente de cuota → plan 033 |

## Fuera de alcance

Cambiar el modelo por defecto de las sesiones interactivas (`settings.model`) — afectaría al uso diario de Oriol. Bloquear `Agent()`: ya está en `permissions.ask`. Rehacer evals/sondas ahora: ninguna sesión headless en esta tanda (coste cero de modelo).

## Verificación (sin gastar cuota)

| # | Check | Esperado |
|---|---|---|
| 1 | `bun test ./.claude/` | Verde con los tests nuevos (headless, hook, doctor) |
| 2 | `bun .claude/evals/run.ts --dry-run` | Lista 20 comandos, todos con `--model claude-haiku-4-5-20251001` o `claude-sonnet-5`; ninguno Fable/Opus |
| 3 | `bun .claude/evals/run.ts --model claude-fable-5-1 --dry-run` | Falla con el motivo; con `--allow-expensive` pasa |
| 4 | Hook con payload sintético por stdin (`{"tool_name":"Bash","tool_input":{"command":"claude -p hola"}}`) | JSON `deny` con motivo; `claude -p --model claude-haiku-4-5-20251001 hola` → silencio |
| 5 | `bun .claude/commands/sync-claude.ts --execute --backup --force` | Settings aceptado por `claude doctor`; 4 eventos de hook |
| 6 | `bun run doctor` | Fila "sesiones hoy" presente (hoy saldrá 🟡 por las 82: es la prueba real); resto 🟢 |
| 7 | Presupuesto | CLAUDE.md +~250 B dentro del trinquete |

## Riesgos

| Ref | Riesgo | Mitigación |
|---|---|---|
| R1 | PreToolUse no dispara siempre (#6305) | Los scripts fijan el modelo por sí mismos (WP-B); el hook es la segunda barrera, no la única |
| R2 | Sonnet dispara skills menos que Fable → evals de disparo más ruidosos | Se leen deltas con el mismo modelo (README); el baseline se retoma con Sonnet una vez, no en Fable |
| R3 | El hook bloquea un `claude -p` legítimo de Oriol en su terminal | Solo actúa dentro de Claude Code (tool Bash del Lead); en su shell no interviene |

## Esfuerzo

~2 h, cero sesiones headless. Commit cuando Oriol lo pida.

## Resultado (2026-09-03, misma tarde) `[Seguro — ejecutado en sesión, cero sesiones headless]`

| # | Check | Resultado |
|---|---|---|
| 1 | `bun test ./.claude/` | 429/429 (32 tests nuevos: headless 5, hook 21, doctor sesiones 4, más los existentes) |
| 2 | `bun .claude/evals/run.ts --dry-run` | 20 comandos, 40 apariciones de `--model claude-haiku-4-5-20251001` / `claude-sonnet-5`; skill-trigger en Sonnet, prosa en Haiku; ninguno Fable/Opus |
| 3 | `--model claude-fable-5-1 --dry-run` | Rechazado con motivo (exit 2); con `--allow-expensive` pasa |
| 4 | Hook con payload sintético | `claude -p hola` → JSON `deny` con motivo; `claude -p --model claude-haiku-4-5-20251001 hola` → silencio; `echo "claude -p …"` permitido (solo cuenta si `claude` es la palabra de comando) |
| 5 | `sync-claude --execute` | Settings aceptado por `claude doctor`; eventos: PreToolUse, UserPromptSubmit, InstructionsLoaded, Stop. `sync-codex` regenerado (25 738 B) |
| 6 | `bun run doctor` | Fila "Sessions today": 🟡 83 sesiones (opus 38 · fable 28 · unknown 9 · sonnet 5 · haiku 3) — la prueba real del incidente; resto 🟢 |
| 7 | Presupuesto | Snapshot ratificado en 53 225 B (incluye plugin); CLAUDE.md +~330 B por la superficie y la fila de tier; `lessons` +718 B por G13 |

El hook entra en vigor en la SIGUIENTE sesión de Claude Code (los settings se cargan al arrancar). `probe-activation.ts` vive ahora en `.claude/evals/` (las JSON de 032 siguen en `plans/032-polish-pass/activation/`). Sin commit (Oriol decide).
