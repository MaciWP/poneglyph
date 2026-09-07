---
spec: 027-roi-fixes-model-advisor
tasks: tasks/index.md
phase: 2.5
validation_mode: validation
test_policy: auxiliary
---

# Validations — 027 (US2/US3/US4; US1 en tests.md)

US2 se clasifica validation-mode con rationale declarado: su único cambio `.ts` es una entrada de datos en `LINK_FOLDERS` — el oracle natural es el smoke del symlink resultante, no un unit test (TDD ahí sería ceremonia).

## US2 — scripts/ sincado + quals evals

### Pre
- `LINK_FOLDERS` = [skills, commands, docs, hooks, workflows, output-styles] (verificado sync-claude.ts:14-21).
- `~/.claude/scripts` NO existe.

### Post
- `"scripts"` en el array; symlink global creado; 3 instrucciones evals calificadas.

### Structural assertions
- El array mantiene su forma (una entrada nueva, sin reordenar); `evals/` sigue fuera (tracked-not-synced, deliberado).

### Smoke
- `ls -la ~/.claude/scripts` → symlink al repo.
- `cd /tmp && bun ~/.claude/scripts/flow-state.ts status --plan /tmp/nope-xyz` → error típado "plans root not found" (no module-not-found).
- `bun test ./.claude/commands/` verde.
- `grep -c "in the poneglyph repo" <los 3 ficheros>` = 3.

### Cross-validations
- Las instrucciones `bun .claude/scripts/flow-state.ts` de flow.md/retro NO se tocan (pasan a funcionar por el symlink).
- `sensitive:` declarado al re-ejecutar sync (regenera settings global).

## US3 — inventario sin números caducables

### Pre
- US1 y US2 cerradas (hooks 7→8; scripts/ pasa a sincado).
- Lista de caducables del discovery: hooks "7 registered", rules "2 + paths/" (ya stale — falta model-uplift), roles "13", skills "(24)", commands "(3 slash…)".

### Post
- Cada conteo de la lista = snapshot fechado + puntero a fuente, o eliminado en favor del puntero.

### Structural assertions
- Patrón del doc ya existente como ancla: la fila evals ("19 as of 2026-07-02 — recount cases.jsonl…").
- Las filas de hooks y sync reflejan el estado post-US1/US2 (docs-sync-same-feature).

### Smoke
- `grep -n "7 registered\|2 + paths/" system-inventory.md` → 0 hits sin puntero.
- Lectura de coherencia de las filas afectadas.

### Cross-validations
- Ningún dato borrado sin puntero equivalente (convertir, no amputar).

## US4 — skill-advisor modelo/effort

### Pre
- skill-advisor §Workflow actual sin paso de modelo/effort; playbook §4 existe con la tabla de routing.

### Post
- Paso nuevo (≤10 líneas) en §Workflow + nota en SIEMPRE rules + 1 frase en el wiring 024 de flow.md.

### Structural assertions
- El paso declara el gate: "propose SOLO si difiere del estado actual de sesión; si coincide, 0 menciones".
- Referencia a `docs/model-uplift-playbook.md §4` — la tabla NO se copia.
- Contrato intacto: propone→humano ratifica; nunca instruye auto-switch.

### Smoke
- `grep -c "model-uplift-playbook" skill-advisor/SKILL.md` ≥1 y `grep` de que ninguna fila de la tabla §4 aparece duplicada en la skill.
- `grep "modelo/effort\|model/effort" commands/flow.md` → 1 hit en la línea de wiring 024.

### Cross-validations
- flow.md y la skill cuentan la MISMA historia (proponer en fronteras, gated); spec AC4 verificable por lectura.
