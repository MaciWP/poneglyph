---
id: 027-roi-fixes-model-advisor
created: 2026-07-07
approved: 2026-07-07
mode: standard
phase: 1
status: closed
---

# Problema

De las 5 debilidades identificadas en el análisis del proyecto (2026-07-07), las 3 mecánicas siguen abiertas: los lifecycles abiertos solo se hacen visibles tras una compactación (el recordatorio cuelga de post-compact), la clase sync-trap deja instrucciones rotas fuera del repo (scripts/ no sincado), y la documentación siempre-cargada acumula números duros que caducan solos. Además, el criterio de routing modelo/effort (playbook §4, escrito ayer) es letra muerta: nada lo propone en el momento de decidir.

# Resultado esperado

- Los planes abiertos son visibles **al arranque de cada sesión**, no solo tras compactar (ataca abandono de mitad trasera + retros pending cross-repo).
- La clase sync-trap RI-1 muere: las instrucciones `bun .claude/scripts/...` funcionan desde cualquier repo (y RI-10 queda calificado).
- `system-inventory.md` sin afirmaciones contables que caduquen solas: cada número reemplazado por puntero a la fuente o comando de recuento.
- El routing modelo/effort se **propone** en las fronteras donde ya dispara skill-advisor, gated a "solo si difiere del estado actual" — propose→ratify, nunca auto-switch (imposible para `/model` y no deseado).

# Success criteria (medibles, Given/When/Then)

- **AC1**: Given una sesión nueva en cualquier repo con planes `feature_closed:false`, when arranca la sesión, then el Lead recibe el recordatorio de planes abiertos (verificable con fixture + ejecución del hook; comportamiento real en próxima sesión — no se banquea).
- **AC2**: Given un clon/otro repo con la capa global sincada, when se sigue la instrucción `bun .claude/scripts/flow-state.ts status`, then resuelve (symlink de scripts/ existe en `~/.claude/`); y las 3 instrucciones de evals quedan calificadas "(en el repo poneglyph)".
- **AC3**: Given `system-inventory.md` tras la pasada, when se grep-ea por los números caducables detectados en la auditoría v2 (conteos de skills/comandos/casos, líneas exactas), then 0 restantes sin puntero-a-fuente.
- **AC4**: Given una tarea cuyo routing recomendado difiere del estado de sesión (p.ej. bulk sweep con effort xhigh activo), when skill-advisor corre en frontera de fase, then la propuesta incluye modelo/effort citando playbook §4; y given que NO difiere, then 0 menciones (anti-ceremonia, verificable leyendo la skill).
- **AC5**: Given todo el paquete, when corren las suites, then verdes; el hook nuevo con tests propios.

# Out of scope (explícito)

- Los 2 fallos no-mecánicos: coste (disciplina de triage ya escrita) y gravedad meta (política de uso — decisión del usuario, sin tooling).
- Auto-switch de modelo o effort de sesión — técnicamente imposible para `/model` desde el Lead y no deseado (propose→ratify).
- Un drillme/skill NUEVO para el selector — se extiende `skill-advisor` (Cmd X: mismo ground, un solo dueño).
- El resto del backlog P2 (security-review rename, minimumVersion, learning-inbox multi-repo, ultracode-audit.js…).
- Telemetría/métricas del ratio meta/real — observabilidad reactiva por doctrina.

# Constraints

- El recordatorio SessionStart reutiliza el diseño ya ratificado en 025 (mismo scan, distinto evento); coste por sesión mínimo (hook silencioso cuando 0 abiertos).
- Sin módulos compartidos hook↔scripts (memoria `feedback-sync-trap-hook-script`): el hook escanea inline.
- skill-advisor mantiene su contrato: propone, nunca fuerza; 0 ruido cuando nada difiere.
- Suites verdes; convención es-ES/EN por superficie.

# Stakeholders

- **Oriol** — ratifica gates; sufre los 3 fallos en el día a día cross-repo.
- **El Lead post-Fable** — consumidor del recordatorio y del selector.

# Open questions

- Ninguna — cuestionario reducido a 0 (alcance ratificado ítem a ítem en la conversación previa: paquete ROI + inclusión del selector como US extra). Drillme saturado sin gaps que cambien la decisión.
