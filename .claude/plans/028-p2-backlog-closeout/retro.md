---
spec: 028-p2-backlog-closeout
phase: 5
retro_level: standard
verdict_phase4: APPROVED_WITH_WARNINGS
spec_drift: none
promotions_proposed: 2
promotions_approved: 2
commandment_violations: 0
living_spec_delta: no
action_items: 3
created: 2026-07-08
status: approved
---

# Retro — 028-p2-backlog-closeout

## Summary

Problema: el backlog P2 verificado sin ejecutar. Entregado: rename `security-audit` con barrido completo (con prueba model-facing en vivo en la propia sesión), gate 2.1.198, learning-inbox saneado (3 filtros + gitignore onboard + split auto-memory), security-gate dual-channel, `Skill(verify)` cableado, y los 3 flecos (SK-07, `complete-phase`, defaults RI-3). 6 HUs, 3 red→green, 188 tests. El backlog P2 accionable queda a CERO; solo sobreviven los 4 trials (fuera por diseño).

## Lessons

### ✅ Patterns that worked
- **El pinned-behavior sweep de 027, usado por primera vez**: identificó en 2.5 el test a preservar (T3.4) y el diseño del suelo lo respetó desde el inicio — la promotion de la feature anterior pagó en la siguiente.
- **Verificación inmediata post-comando**: el grep tras cada sed atrapó DOS fallos en caliente (el word-split de zsh que dejó todo sin tocar, y el sobre-rename del homónimo nativo). Sin esa cadencia habrían llegado al critic o a producción.
- **Rename con frontera de palabra**: `security-reviewer` (ejemplo de agente) sobrevivió intacto al sweep.

### ❌ Patterns that didn't work
- **zsh no hace word-split de `$VAR`**: `for f in $FILES` iteró UNA vez con la lista entera y sed falló completo. En este entorno (shell zsh) las listas en variables exigen `tr '\n' | while read` o arrays.
- **Greps no-discriminantes producen veredictos falsos en ambas direcciones**: (a) en la auditoría v2 degradé SK-07 a "dudoso" porque `grep "09-loops"` daba 2 hits — ambos eran del fichero HERMANO (playbook), no del objetivo; (b) hoy el sweep renombró la mención al `security-review` NATIVO (mismo identificador, distinto dueño). Misma clase: la verificación debe discriminar el identificador exacto Y su dueño, no un prefijo/homónimo.

## Process audit

| Phase | Effort | Friction | Improvement |
|---|---|---|---|
| 1-2-2.5 | S | ninguna (0 preguntas, discovery denso) | — |
| 3 build | L (6 HUs) | zsh word-split + sobre-rename (ambos atrapados) | memorias abajo |
| 4 critic | S | ninguna | — |

## Drillme — Phase 5

1. ¿Pesada de más? Build, proporcional a 6 HUs. 2. ¿Fricción evitable? Las dos ❌ (evitables con las memorias). 3. ¿Reusable? Ambas clases. 4. ¿Scope? Memoria las dos (hechos puntuales de entorno/proceso). 5. ¿Commandment en silencio? No — ambos fallos se atraparon y declararon en ciclo.

## Promotion candidates

| Candidate | Scope | Type | Why | Proposal |
|---|---|---|---|---|
| `feedback-zsh-no-wordsplit` | memory | memoria | ❌ 1: sed recibió la lista entera; clase de entorno que reaparecerá en cualquier loop Bash | Fichero de memoria + línea MEMORY.md |
| `feedback-discriminating-greps` | memory | memoria | ❌ 2: falso-dudoso SK-07 + sobre-rename del homónimo nativo — una sola clase | Fichero de memoria + línea MEMORY.md |

Failure→eval: ninguna es gradeable determinista en el harness golden-prompt (son de proceso Bash/verificación, no de generación de texto) — declarado.

## Living-spec

`spec_drift: none` — sin sección.

## Commandments audit

10/10 ✅ (II estuvo en riesgo dos veces en build y las dos veces el propio proceso lo atrapó antes de reportar — el sistema de verificación inmediata funcionó como gate, no hubo violación que llegara a artefacto).

## Action items

| Action | Owner | Trigger | Due |
|---|---|---|---|
| Validación conductual: (a) inbox.md no sobre-filtra learnings legítimas (warning del review), (b) listado model-facing muestra `security-audit` propio, (c) junto con los pendientes de 026/027 | user + Lead | próximas sesiones reales | esta semana |
| Commit del trabajo 028 | user (o Lead con OK) | ratificación | hoy |
| Backlog restante = solo los 4 trials (CG-03/04/09/10) — uno por sesión si se quieren | user | a discreción | — |
