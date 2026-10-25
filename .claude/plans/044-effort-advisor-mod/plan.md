# Plan: mod `tempo`, esfuerzo por prompt y medidor del advisor (v2, tras revisión)

> El mod se construyó como `plugins/vivre-card` y se renombró a `plugins/log-pose` (Log Pose, de One Piece; los logs anteriores siguen en `~/.cache/poneglyph/vivre-card/`). Herramienta `mcp__log-pose__set`, log en `~/.cache/poneglyph/log-pose/`. Las directivas `tempo:<nivel>` de la fase 0 se retiraron. Este plan conserva el nombre de trabajo; el estado actual está en `plugins/log-pose/README.md` y los resultados en `eval-v3.md`.

## Contexto

Opus 5.5 trabaja todo el día a `medium`, sea cual sea la tarea. Las tareas triviales pagan razonamiento que no necesitan y las difíciles se quedan cortas, salvo que escribas `/effort high`. El advisor se lleva ≈ 16 % del gasto (452 llamadas en 14 días) y no sigue ningún criterio.

El mod `tempo` clasifica cada prompt tuyo en dos ejes:

- la dificultad decide el esfuerzo;
- la incertidumbre decide cuánto usar el advisor.

El mod aplica el nivel a todo el turno, Opus puede corregirlo, y todo queda registrado para calibrarlo con datos.

**Revisión.** La v1 la revisaron Codex ("rework", 3 bloqueantes) y un agente Opus ("approve with fixes"). Comprobé en el d.ts las citas que deciden y todas eran correctas. Esta v2 incorpora sus arreglos; la tabla del final dice de dónde sale cada uno.

Hechos de base (brief `.claude/plans/044-effort-advisor-mod/prompt.md`):

- En Opus 5.5, el esfuerzo por mensaje conserva la caché, y Claude Code lo usa con `/effort`. En tus transcripts, el turno siguiente a un cambio leyó de caché 124k y 84k tokens.
- En la API ese nivel "holds until a later message changes it". No se sabe cómo traduce el motor una reescritura de `turn.step` (sondas S1 y S2).
- Un mod no puede tocar el advisor. El medidor es una instrucción y se mide con `serverToolUses`.
- El presupuesto de un hook es 10 s de tiempo propio. Las llamadas `$` no cuentan; `$.clock.sleep` sí (d.ts 3444, 5096-5116).

## Decisiones tomadas (tus respuestas)

| Decisión | Valor |
|---|---|
| Quién fija el esfuerzo | El mod, para todo el turno; Opus corrige con la herramienta desde el prompt siguiente |
| Puesta en marcha | Directa en cuanto pasen las sondas |
| Rango del mod | `low` a `xhigh`; `max` solo con tu `/effort` |
| Tu `/effort` | Es el suelo; el `medium` por defecto no cuenta como suelo |
| Duración de la corrección | Hasta que cambie la tarea |
| Modelo del advisor | Opus 5.5 |
| Subagentes | No se tocan |
| Línea de esfuerzo del router | Se retira en Claude; se mantiene en Codex y Grok |

## Diseño

### Qué prompts y qué modelos

- Solo se clasifican los prompts con `origin.kind` `composer` (tu terminal) o `bridge`.
- Los demás orígenes (`sdk` de `claude -p`, `peer`, `task-notification`, `scheduled-trigger` y el resto) reutilizan la decisión vigente y no borran la corrección. Así las evaluaciones del router y las ejecuciones sin interfaz no pagan la latencia.
- Solo se reescribe el esfuerzo con `e.model === 'claude-opus-5-5'`, que es el modelo que prueba S1. Cualquier otro modelo (Sonnet 5.5 con `between_tools` o Haiku con thinking desactivado devuelven 400 si cambia el esfuerzo, y una caída de seguridad cambia el modelo), un `e.effort` numérico o ausente, y los pasos con `agentId` pasan sin cambios.
- Con `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` activo, el mod empieza en modo `steer`. Lo lee con `$.env.get` y el nombre literal.

### Clasificación: una sola llamada a `$.model.complete`

- `classify` queda descartado: "`text` is data" (d.ts 2648), así que una rúbrica dentro del texto se clasifica en vez de seguirse, y no tiene tiempo máximo.
- `$.model.complete` con:
  - `model: 'haiku'`;
  - la rúbrica en `system`;
  - `effort: 'low'`, `maxTokens: 16`, `timeoutMs: 2500` y un `signal` para cancelar de verdad.
- Respuesta: tres palabras: `<easy|normal|hard> <clear|some-doubt|unclear> <same|new>`.
- El tercer campo es la continuidad de la tarea. Se juzga con el prompt (hasta 2.000 caracteres) y los primeros 300 caracteres del prompt anterior, no con el nivel anterior, que sesgaría la respuesta.
- Una respuesta que no se puede analizar cuenta como fallo. Un resultado que llega tarde se descarta, con un id de petición, y nunca toca el estado.
- **Continuaciones explícitas**: una lista cerrada (`sigue`, `continúa`, `ok`, `dale`, `sí`, `adelante`, `go on`, `continue`), sin regla de longitud. No se clasifican: decisión anterior y `same`.

### Decisión (`core.ts`, funciones puras)

1. `MATRIX[dificultad][incertidumbre] → {effort, gauge}`, la del brief (§Two axes).
2. Tope del mod: `min(recomendación, 'xhigh')`.
3. La corrección de Opus sustituye a la recomendación mientras siga vigente.
4. Suelo: `max(resultado, suelo)`. Si el suelo es `max`, el resultado es `max` (en la v1 el tope lo recortaba).

**Suelo.** Es `e.effort` del paso cuando es distinto de `medium`, el nivel por defecto de Opus 5.5.

- Límite conocido: un `/effort medium` explícito no se distingue del valor por defecto. El d.ts no indica el origen del valor y no hay evento que observe `/effort`. Como los dos significan `medium`, el único efecto es que el mod puede bajar a `low`. Lo dejo documentado.
- S3 decide si `e.effort` es tu nivel o el último que escribió el mod. Si es el segundo, el suelo se guarda en el estado.

**Fallos.**

| Caso | Qué pasa |
|---|---|
| Fallo con una decisión previa | Se reutiliza la previa, y la corrección y el suelo se conservan |
| Fallo sin decisión previa | Se escribe `e.effort` explícitamente y no hay nota |
| Texto vacío o solo adjuntos | Igual que una continuación |

### Una decisión por turno

- `prompt.submit` guarda `pending` y añade la nota a `e.context`, conservando lo que ya hubiera.
- `turn.start` lo fija: `decisions.set(turnId, pending)`.
- `turn.step` busca la decisión por `e.turnId`.
- Un prompt que entra en un turno en marcha (`e.turnId` presente) no cambia ese turno; su decisión es para el siguiente.
- `turn.complete` borra la entrada.

### Aplicación (`turn.step`)

- Se escribe el mismo nivel en todos los pasos del turno principal: `next({...e, effort})`.
- Si el motor usa el esfuerzo por mensaje, solo cuenta el paso 0 y el resto no hace daño. Si usa el global, saltarse pasos devolvería el paso 1 a `medium`.
- El nivel se escribe siempre explícitamente, porque el último nivel por mensaje se queda vigente hasta que otro lo cambia.

### La herramienta `mcp__tempo__set`

- Entrada `{effort: 'low'|'medium'|'high'|'xhigh'|'auto', reason}`. `auto` borra la corrección.
- `tool.describe` con `isDeferred: false`, como workboard (`register.ts:702-705`).
- Devuelve `{result: "Applies from the next step."}`: desde el siguiente paso del turno en curso (la sonda S1 midió que cambiar de nivel entre pasos no rompe la caché).
- La corrección dura hasta que el clasificador dice `new` o Opus manda `auto`. Mientras está activa, la nota la muestra: `Your override: high (reason). Send auto when the task changes.`
- El suelo también se aplica a la corrección.

### Nota para Opus (≈ 50 tokens)

`Tempo: this prompt runs at high effort (hard, some doubt). Advisor gauge 2: call it once before declaring done. Wrong level for this task? Call mcp__tempo__set; it applies from the next prompt.`

Cada nivel del medidor nombra su disparador (brief §Advisor barometer). En modo `steer`, la nota añade "Please think hard before responding." o "Answer directly without deliberating.".

### Protección de la caché

- Solo cuenta en el paso 0 de un prompt donde cambió el nivel.
- Hay rotura si `cache_read < 0,9 ×` el prefijo del paso principal anterior (`read + creation + input`). La comparación es con el paso anterior, no con el actual, para que pegar un texto largo no dé un falso positivo.
- No se evalúa el paso cuando:
  - `usage` es nulo o el denominador es 0;
  - `e.model` cambió;
  - `messageCount` bajó;
  - pasaron más de 5 min desde el paso anterior (TTL desconocido: 1 h con suscripción, 5 min con créditos).
- **Dos roturas seguidas** en prompts con cambio de nivel pasan el mod a `steer` desde el prompt siguiente: se escribe `e.effort` una vez y después se pasa sin tocar, con un toast. Un cambio que conserva la caché pone el contador a 0.

### Log

- `$.fs.write` reescribe el fichero entero (d.ts 3251-3256), así que cada sesión tiene su fichero: `~/.cache/poneglyph/tempo/<sessionId>.jsonl`.
- Se escribe desde un array en memoria con un máximo de 500 registros, en `turn.complete`. Un fallo de escritura se ignora y no afecta al turno.
- Cada registro lleva:
  - origen, modelo, etiquetas, recomendación, suelo, corrección, nivel aplicado y modo;
  - `classifyMs`, si hubo fallo o se agotó el tiempo, y `submitMs` (el tiempo hasta `next`, que también retrasa al router y a los otros mods);
  - pasos, tokens de salida, y `cache_read` / `cache_creation` / `input` del paso 0;
  - llamadas al advisor con el índice del paso y el total de pasos (posición: antes de la primera edición, o al final).

## Fases

### Fase 0: sondas (esqueleto en modo sonda, sesión interactiva tuya)

El esqueleto registra cada paso y fuerza niveles a partir de la variable `TEMPO_PROBE`. Yo leo el log, el transcript y `/usage`.

| Sonda | Qué responde | Aprobado |
|---|---|---|
| S1 caché | medium→high, medium→low y high→low reescribiendo todos los pasos de un turno con herramientas. **Control**: las mismas transiciones con tu `/effort` en la misma sesión | `cache_read` ≥ 90 % del prefijo en los pasos 0 a N y en el siguiente prompt, en las tres transiciones, igual que el control; `/usage` sin "likely cause" de esfuerzo |
| S2 efecto | ¿El nivel llega y se mantiene? Un prompt fijo, 5 repeticiones por nivel (low, medium, high, xhigh), más un prompt que pasa sin tocar después de uno reescrito a high | Las medianas de tokens de salida separadas, sin solaparse sus rangos; se sabe qué nivel corre el prompt que pasa sin tocar |
| S3 suelo | Después de una reescritura, ¿`e.effort` es tu nivel o el arrastrado? También con `/effort max` y al volver de `max` | Se sabe cuál es, y el diseño del suelo queda fijado |
| S4 clasificación | ¿Permite el guard `$.model.complete`? Latencia en 20 prompts, tiempo agotado y cancelación con `signal` | p95 ≤ 2,5 s, menos del 5 % agotados, la cancelación funciona |
| S6 hud | ¿La barra muestra el nivel reescrito? | Si no, se ordena con `next.trace` o se acepta |
| S7 ciclo de vida | Prompt en cola durante un turno, mensaje de un peer, interrupción con Esc, subagente con herramientas, `/clear` | La decisión de cada turno es la suya, sin mezclas; el estado se reinicia con `/clear` |
| S8 controles de caché | Expiración, `/compact` y recarga de plugins | Ninguno cuenta como rotura |

La S5 (`xhigh` válido) se quita: los valores no admitidos se rebajan sin error (d.ts 854), y la documentación ya dice que Opus 5.5 admite los cinco niveles.

- Si S1 falla, el mod se construye en modo `steer`. Eso es funcionamiento degradado, no el objetivo cumplido, y te lo diré así.
- Si el guard bloquea `model.complete` (S4), se pasa a dos `classify` con tiempo agotado por `signal`, y la rúbrica en las etiquetas.

### Fase 1: evaluación del clasificador (por el camino real)

- 40 prompts reales de tus transcripts, sin continuaciones. Las etiquetas las propongo yo y tú las revisas.
- Se reparten así: 25 para ajustar la rúbrica y 15 de reserva que no se miran hasta el final.
- La build de sonda tiene un modo `TEMPO_EVAL` que los clasifica con el mismo `$.model.complete` y lo escribe en el log.
- Umbral en la reserva:
  - ≥ 70 % de acierto en dificultad, informando el intervalo (≈ ±20 puntos con n=15);
  - 0 saltos easy↔hard;
  - `unclear` nunca como `clear`;
  - `new` y `same` acertados en ≥ 80 %.
- Base de comparación: el mismo modo clasifica los prompts de tus 14 días a `medium`, para comparar por nivel.

### Fase 2: el mod

| Fichero | Contenido |
|---|---|
| `plugins/tempo/.claude-plugin/plugin.json`, `types/` (copia de hud), `tsconfig.json`, `hooks/hooks.json` | estructura de un mod nuevo |
| `plugins/tempo/hooks/core.ts` | puro: `MATRIX`, `decide`, `isContinuation`, `parseLabels`, `noteFor`, `cacheBroke`, `record` |
| `plugins/tempo/hooks/register.ts` | fino, con 7 hooks: `session.start`, `prompt.submit`, `turn.start`, `turn.step`, `turn.complete`, `tool.call`, `tool.describe` |
| `plugins/tempo/scripts/report.ts` | métricas del log y de la evaluación |
| `plugins/tempo/tests/core.spec.ts` | matriz; tope y suelo (incluido `max`); corrección y `auto`; continuaciones; fallos (tarde, no analizable, vacío); cortocircuito (exclusiones, dos seguidas, reinicio) |
| `plugins/tempo/tests/native.test.ts` | nota; mismo `effort` en todos los pasos principales; `agentId`, otros modelos y otros orígenes sin tocar; decisión por `turnId`; la herramienta devuelve `{result}` |
| `.claude-plugin/marketplace.json` | entrada `tempo` |

Patrones que reutilizo:

- herramienta y estado de módulo, de `plugins/dock/hooks/register.ts`;
- `turn.step` como generador, de `plugins/hud/hooks/register.ts:247`;
- `isDeferred`, de `plugins/workboard/hooks/register.ts:702`;
- forma de los tests nativos, de dock.

### Fase 3: router, activación y doctrina

- `.claude/hooks/prompt-router.ts`: con `host === 'claude'`, `effortLine` deja de emitirse, con sus tests.
- Barrido de "propose `/effort high`" en `.claude/`.
- Activación con el mismo mecanismo que los otros mods. Lo verifico antes; si toca `.claude/settings.global.json`, lo indico con `sensitive:`. Después, sync y `claude plugin update tempo@poneglyph`.
- Memoria: `project-effort-advisor-mod.md` y `effort-and-advisor-controls.md` con los resultados de las sondas.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Pérdida de calidad en `low` | Se mide cuántas veces Opus sube el nivel y cuántas lo corriges tú o repites la pregunta en prompts `easy`; si pasa del 15 %, `easy` sube a `medium` |
| El clasificador acierta poco | Umbral en la reserva; tope `xhigh`; suelo; correcciones de Opus por encima del 25 % → revisar la rúbrica |
| Latencia de 2,5 s también para el router y los otros mods | Solo prompts `composer`/`bridge`; las continuaciones no se clasifican; `submitMs` en el log |
| Rotura de caché | Cortocircuito con exclusiones y dos roturas seguidas |
| Opus ignora el medidor | Se mide la posición de las llamadas, no solo el número; si los niveles 0 y 1 se cumplen poco, se ajusta la redacción |

Alternativa descartada: un selector de modelo por prompt (estilo RouteLLM). Cambiar de modelo siempre rompe la caché; cambiar el esfuerzo no.

## Verificación

1. `bun test plugins/tempo` y canario: romper una celda de `MATRIX` y ver un test en rojo; restaurar y ver verde.
2. `tsc --project plugins/tempo/tsconfig.json`, como orden aparte.
3. `~/.local/bin/claude plugin test plugins/tempo`, como orden aparte.
4. `bun test ./.claude/`, `bun run check:config` y `bun run doctor`.
5. Flujo real en una sesión nueva:
   - una pregunta trivial queda en `low` con medidor 0;
   - una tarea de diseño difícil sube a `high` o `xhigh` con medidor 3;
   - `sigue` mantiene el nivel;
   - la corrección de Opus se aplica en el prompt siguiente y `auto` la borra;
   - un `claude -p` no se clasifica;
   - `cache_read` ≥ 90 % al subir y al bajar;
   - el log tiene un registro por prompt.
6. Al cabo de una semana, `report.ts`:
   - el cortocircuito no se ha activado;
   - p95 de la clasificación ≤ 2,5 s;
   - correcciones de Opus < 25 %;
   - señales de calidad en `easy` < 15 %;
   - coste total por nivel frente a la base etiquetada por el mismo clasificador, incluidos la clasificación, el advisor y la caché;
   - posición de las llamadas al advisor por nivel del medidor.

## De dónde sale cada cambio de la v2

| Cambio | Fuente |
|---|---|
| Decisión ligada a `turnId` | Codex 2, Claude 4 |
| Continuidad `same/new` separada de la dificultad y lista cerrada de continuaciones | Codex 3, Claude 8 |
| Pruebas que deciden: control, repeticiones, pase sin tocar, S7, S8 | Codex 4, Claude 7 |
| `model.complete` con cancelación real y resultados tardíos descartados | Claude 1, Codex 5 |
| Cortocircuito: base del paso anterior, exclusiones, dos seguidas, reinicio | Codex 6, Claude 6 |
| Fallos: reutilizar la decisión previa y escribir siempre el nivel | Codex 7, Claude 5 |
| Reserva de evaluación, coste total, señales de calidad, posición del advisor | Codex 8, Claude 7 |
| Log por sesión con límite (`fs.write` reescribe el fichero) | Codex 9 |
| Solo `composer`/`bridge`, solo Opus 5.5, suelo `max` | Claude 2, Claude 3, Codex 1 |
| Suelo con límite documentado (no se puede saber de dónde viene el valor) | Codex 1: no hay evento que observe `/effort`, así que se acepta el límite en lugar de inventar uno |

## Resultados de la fase 0 (2026-10-15, sondas sin interfaz, claude 2.1.300)

| Sonda | Resultado |
|---|---|
| S1 caché | Pasa. Sesión 6230cd98: la tasa de lectura de caché fue 0,95-1,00 en todos los pasos principales en medium→high→low→medium→low→off→high→off, también en los pasos con herramientas. Sin el control de `/effort` (no se puede sin interfaz) |
| S2 efecto | Parcial. Mediana de tokens de salida (n=5 por nivel, prompt fijo sin herramientas): low 748, medium 849, high 911, xhigh 3.435. Crece con el nivel y `xhigh` se separa claramente, pero los rangos de low, medium y high se solapan en un prompt fácil |
| S3 suelo | `e.effort` siempre es el de la sesión (`medium`), nunca el último escrito: el suelo se lee de `e.effort` |
| S4 clasificador | `$.model.complete` lo permite el guard; 9/9 respuestas válidas, 679-822 ms |
| S7 subagente | Los pasos con `agentId` pasan sin tocar |
| S6, S7 (cola, Esc), S8 | Pendientes de una sesión con terminal (prueba real de la fase 2) |

## Decisión v3: el router de skills entra en tempo (2026-10-15)

El usuario elige fusionar desde ya: una sola llamada a `$.model.complete` decide las skills, las correcciones de términos, el esfuerzo y el medidor del advisor. Esto revisa el descarte de P1 en la sesión `54c4c7e8`, que se basó en que solo 5 de 189 turnos editaban antes de la nota. Esa sesión no midió la latencia en el proceso.

Medido con un mod de usar y tirar y el prompt real del router (38 skills, 23.044 caracteres), Haiku, n=8:

| Variante | Duración | Caché | Salida |
|---|---|---|---|
| `system` como texto | 0,86-1,25 s | 0 leídos, ≈ 8.950 de entrada en cada llamada | 6/6 JSON válidos |
| `system: [{ text, cache: true }]` | 0,81-1,77 s, p50 0,93 s | 8.911 leídos tras la primera | 8/8 JSON válidos |

Referencia del hook actual: 5,8 s p50 y 7,8 s p90 de llamada (`prompt-router.log`, n=88); nota antes del paso 0 en 42 de 189 turnos; 7 días: 301 candidatos, 74 seguidos (25 %), 170 sin respuesta.

Cambios al diseño:

- **Una llamada.** `system` = cuerpo del agente del router + catálogo + glosario + rúbrica de tempo, en bloque con `cache: true`. La salida es el JSON del router más `difficulty`, `uncertainty` y `continuity`. Se analiza con las funciones puras de `prompt-router.ts` si el mod puede importarlas; si no, se extraen a un módulo compartido sin dependencias de Node.
- **Catálogo.** Se lee con `$.fs` al inicio de la sesión y se vuelve a leer cuando cambian los ficheros, porque `ContextSkills` solo da nombres y tokens, sin descripciones.
- **Entrega.** La nota única (skills, esfuerzo y medidor) va en el `context` de `prompt.submit`, antes del paso 0. El hook async de Claude deja de ejecutarse; Codex y Grok siguen con el hook.
- **Paridad.** Antes de retirar el hook en Claude, el eval held-out del router (`router-heldout.ts`) tiene que dar con el mod el mismo resultado que el hook (50-51/64, ±6 de ruido, al menos 2 ejecuciones por brazo).
- **Riesgo nuevo.** Un fallo del mod deja sin router y sin esfuerzo a la vez. Ante un fallo se reutiliza la decisión de esfuerzo anterior, la nota no lleva skills y se registra en el log, igual que el hook falla en silencio.
- **Caché de 5 minutos.** En el mod caduca a los 5 minutos y en el hook a la hora, así que habrá más escrituras en frío (≈ $0,002 cada una). Se mide en el log.

Fase 1 añade el eval de paridad del router a la evaluación del clasificador. Fase 3 retira el hook en Claude en lugar de retirar solo `effortLine`.

## Auditoría y mejoras (2026-10-16, versión 0.3.0)

Informe completo con causas y opciones: https://claude.ai/artifact/VCBAwYDBC4oZFM6p7D68t1. Resultado por frente:

| Frente | Hecho | Medida |
|---|---|---|
| Fallos (L1, L2, E2, E4, E5, E6, C2, C3, T3) | Corregidos con tests | Unitarios y una sesión real con `/clear` |
| Esfuerzo | Sin cambios de matriz | Con un suelo `xhigh` en la configuración, el nivel del mod no cambia ningún paso; la matriz D1 no se aplica |
| Glosario (T1) | Términos del arnés añadidos | Lote de prueba v3: precisión de correcciones 100 %, recall 36 % → 44-52 % |
| Palabras cortas (T2) | Medido, sin cambio | Los errores vistos en vivo («hug», «sonic», «opues», «trillme») ya pasan con el glosario. Umbral por longitud: +1 de 25 buenas en prueba, sin tocar las malas, pero deja que «un» u «os» acaben en hud o hook |
| Criterio de skills (S2) | Probado y retirado | Regla «tarea más pequeña que la skill» en el agente: rechazos del Lead aún sugeridos 39 % → 35 %, falsas alarmas 20 % → 3 %, pero hit@3 74 % → 68 % (por debajo de la puerta del 72 %). Pasar el final de la respuesta anterior: sin efecto |
| Skills por fase (S4) | Pista tras la primera llamada a `Agent` sin prompt-design y al primer `Artifact` sin natural-writing | En 7 días, prompt-design estaba cargado antes del primer agente en 5 de 50 sesiones; natural-writing antes del primer artefacto en 2 de 22 |
| Memoria (M1, M2) | `declined:` en `<past>`; las skills cargadas tras la primera edición del turno no se aprenden | 178 entradas, 59 con rechazos; positivas 137 → 124 |
| Memoria evaluada (M3) | Se queda activa | Prueba, 2 ejecuciones, memoria cortada por fecha: hit@3 71 % → 76 %; casos ganados frente a perdidos 9/3 y 10/3 (McNemar p 0,15 y 0,09). Falsas alarmas mezcladas (+4/−1 y 0/−1). Coste +15 % por prompt. Brazo `s-mem` en `log-pose-v3.ts` |
| Log por sesión (I3) | Arreglado en 0.3.3 | El 22-10, 24 de 71 llamadas del mod no tenían fila: solo se volcaban al acabar el turno, y un turno largo o una sesión cerrada antes las perdía. Ahora la fila del prompt se escribe al momento y los pasos cada 50; `fixes` en la fila `submit` desde 0.3.2 |
| ¿Se nota el esfuerzo? (V1.3) | Sin señal | 22-10, 76 turnos principales por nivel real: medium 16 pasos y 15k de salida por turno, high 16 y 18k, xhigh 42 y 64k. Correcciones del usuario en el prompt siguiente, revisadas a mano: medium 2/11, high 3/15 (las tres de una misma tarea de audio), xhigh 1/10; interrupciones 1. Muestra pequeña y nivel confundido con la tarea; repetir con ≥50 prompts posteriores al 18-10 |
| Seguimientos con contexto | Instalado en 0.3.5, sin medir (decisión del usuario) | 10-23: la regla «un `same` solo sube» dejó 8 prompts seguidos en xhigh tras una pregunta difícil (xhigh ≈ 75 % de la salida). Ahora Sonnet recibe `<last-turn>` (nivel, pasos, herramientas, interrupción, final de la respuesta) y etiqueta el trabajo que queda; el nivel sale de esas etiquetas. Alternativas medidas en `private/outcomes` (41 casos): regla anterior 41 % justo / 32 % por debajo; bajar de 1 en 1 41 % / 49 %; heredar como mucho high 44 % / 32 %. Prueba con Sonnet real (modo eval, campo `last`): commit tras turno resuelto → easy/clear, «sigue fallando» → hard/unclear, turno interrumpido → hard/some-doubt; el mismo «revisa que todo quede bien» da normal/clear tras un turno resuelto, hard/unclear tras uno fallido y normal/some-doubt sin contexto (2 ejecuciones iguales). Revisar en vivo: cadenas xhigh y bajadas a media tarea. Para medirlo, `turns.jsonl` ya tiene pasos, herramientas y respuesta del turno anterior para el campo `last` de los 41 casos |
| Glosario que aprende (T4) | Aplazado | En 60 días, 15 pares aceptados en notas y solo 2 repetidos en 2+ sesiones, ya en el glosario |

Pendiente, con su disparador:

- **Pista de fase → bloqueo** si en una semana se sigue menos de la mitad de las pistas. Lo cuenta `skill-usage.ts` desde los transcripts (pista seguida = la skill se carga en el mismo turno) y la fila Skills del doctor se pone en amarillo con 10 o más pistas y menos de la mitad seguidas.
- **T4** cuando las notas den 5 o más pares nuevos repetidos en 2+ sesiones en un mes (`Probable dictation fixes` en los transcripts).
- **D1 (matriz)**: desde el 2026-10-18 no hay suelo (Opus en medium por defecto, el selector sube o baja). La tabla sigue con lo normal en medium; si en vivo «no se nota», subir lo normal a high.
- **Agentic OS (I2, I5, I6, J1)**: coste con lectura y escritura de caché separadas, ventanas iguales al comparar con el hook y un panel con el porqué de cada métrica.
