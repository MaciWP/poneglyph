# Revisión de los cambios publicados después de la auditoría

Consulta: 2026-09-05. La PR #3 permanecía en `dfa904a6` cuando se pidió esta revisión. Los cambios pendientes ya habían llegado a **main**, en [`ed1c411`](https://github.com/MaciWP/claude-code-poneglyph/commit/ed1c411) y [`802d795`](https://github.com/MaciWP/claude-code-poneglyph/commit/802d7953ea6da0f6c8116e8947932b52ea1130ea): **121 archivos, 3.666 inserciones y 4.894 eliminaciones** respecto a la base original. No son cambios nuevos dentro de la PR #3. Este apéndice conserva la auditoría original como fotografía histórica y evalúa el delta más relevante.

**Opinión:** conservaría la separación público/privado, la retirada de hooks defectuosos, los modelos explícitos y la instrumentación. No daría por demostrada una mejora general de calidad/coste. Algunos instrumentos nuevos todavía producen señales falsas; el informe del ecosistema mezcla inventario útil con conclusiones que sus datos no permiten.

## Qué mejora y qué no está cerrado

| Cambio | Valor que conservaría | Estado de los hallazgos originales |
|---|---|---|
| Retirada de `post-compact` y `workspace-hint` | Elimina un canal de reinyección incorrecto y una ruta macOS fija | H02/H05 dejan de aplicar a main. Quedan referencias históricas, no hooks activos |
| Traslado de skills/lecciones de empresa al plugin privado | Reduce contaminación entre proyectos y separa distribución de conocimiento interno | S02/S32 retiradas del catálogo público; S15 cambia de alcance. No se auditó el plugin privado ni su instalación |
| Procedimiento e historia separados en referencias | Reduce texto cargado al invocar varias skills, conservando trazabilidad | No corrige por sí mismo la aprobación circular ni los veredictos solapados; siguen presentes en main |
| Eliminación del mínimo de rondas en drillme | Preguntas más proporcionales a la información que falta | Mejora concreta de S10. Necesita evaluación conductual para cuantificar tiempo/calidad |
| `doctor`, presupuesto y CI Windows | Hace visibles contratos operativos que antes faltaban | Buenos instrumentos candidatos, pero con defectos N01/N02/N06. Main aún no incluye macOS en su matriz |
| Validar settings generados mediante `claude doctor` | Comprueba aceptación del host, además de existencia del fichero | Mejora parcial de C06; no es una transacción de instalación completa |
| Modelo explícito y política por tipo de ejecución | Evita heredar inadvertidamente el modelo global | N03/N04/N05 muestran límites del gate y parser. El modelo efectivo debe confirmarse en la salida del host |
| Clasificar errores de cuota/auth aparte del fallo conductual | Mejora el diagnóstico del evaluador | `runLive` sigue sin garantizar proceso/final completos; N07 lo muestra para el control de salud |

Los enlaces y tamaños de [inventory.json](inventory.json) corresponden a `ecd56cf`, no a este main. Aquí hay **30 skills**; el ranker sigue perdiendo **29/30 descripciones** (N08). No hay contradicción con el 31/32 original: se retiraron dos entradas, pero el parser continúa defectuoso.

## Ocho observaciones reproducibles nuevas o revalidadas

Código: [review-main-802d795.ts](review-main-802d795.ts). Resultado: [review-main-802d795-results.json](review-main-802d795-results.json). Se ejecutan funciones puras sobre un checkout del main fijado; las cadenas de comandos son datos, no se lanzan sesiones.

```sh
bun docs/component-audit-2026-09-05/review-main-802d795.ts --repo <checkout-de-main-802d795>
```

| ID / prioridad | Observación | Consecuencia y corrección propuesta |
|---|---|---|
| N01 · P1 | `statusFromSyncOutput("")` devuelve verde; el caller no integra el exit code del subproceso | Una instalación no comprobada puede parecer sana. Exigir exit válido y un inventario reconocido no vacío; resultado discriminado de ejecución/parseo |
| N02 · P1 | `summarizeTests` toma `1 pass + 1 fail` del **nombre de un test** | Una suite verde parece roja. Se reprodujo también al ejecutar doctor: anuncia 1 fail/2 pass aunque la suite completa pase. Parsear el bloque final del runner, anclado por línea, y validar sus contadores |
| N03 · P1 | El gate permite un comando compuesto cuyo primer proceso usa Haiku y el segundo Opus; `env claude ...` tampoco queda cubierto | El primer `--model` de toda la cadena no describe cada proceso. Usar un launcher con argv y política propia; el hook debe declarar cobertura limitada. No convertir el parser shell heurístico en una barrera completa |
| N04 · P1 | `--model=claude-opus-4-6` se ignora y se elige el default | El experimento puede ejecutarse con un modelo distinto del solicitado. Unificar sintaxis admitida/rechazada entre hook y resolver, registrar requested/resolved/observed |
| N05 · P2 | `--model --dry-run` toma `--dry-run` como ID de modelo | Rechazar valor ausente antes de construir procesos; validar flags desconocidos e incompatibles |
| N06 · P2 | `description: Short inline description` aporta cero bytes al presupuesto | El ratchet no mide todas las representaciones válidas de YAML. Parser compartido real; distinguir bytes estimados de contexto efectivamente cargado |
| N07 · P1 | Un evento assistant sin result terminal se declara saludable | Interrupción puede convertirse en resultado puntuable. Exigir exit válido y final exitoso para live; separar explícitamente el contrato de fixtures de texto |
| N08 · P1 | 29/30 descripciones quedan en `|`/`>` | El ranker sigue operando con datos defectuosos. Reparar YAML antes de calibrar selección |

**Validación del main sin nuestras correcciones:** 429 pass, 0 fail, 834 expectativas, 25 archivos, Bun 1.4.0 en Linux. Las ocho observaciones se reproducen aunque esa suite pase. No son ocho pérdidas porcentuales de calidad, ni todas son bugs recién introducidos: N07/N08 revalidan problemas anteriores.

Fuentes del código: [doctor.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/802d7953ea6da0f6c8116e8947932b52ea1130ea/.claude/scripts/doctor.ts), [headless-model-gate.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/802d7953ea6da0f6c8116e8947932b52ea1130ea/.claude/hooks/headless-model-gate.ts), [headless.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/802d7953ea6da0f6c8116e8947932b52ea1130ea/.claude/scripts/lib/headless.ts), [budget.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/802d7953ea6da0f6c8116e8947932b52ea1130ea/.claude/scripts/lib/budget.ts), [run.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/802d7953ea6da0f6c8116e8947932b52ea1130ea/.claude/evals/run.ts).

## Otros límites importantes del delta

**Instalación:** `validateGeneratedSettings` drena stdout/stderr y aplica timeout, mejoras útiles. Pero ignora el exit code: si `claude doctor` falla antes de imprimir su sección esperada, no encontrar problemas se interpreta como aceptación. El parser depende de texto y del path completo; cambios de formato pueden quedar silenciosos. El rollback solo restaura un fichero real si se pidió backup; no recupera un symlink previo ni revierte todos los enlaces. El backup sigue basado en día. Probar salida fallida/vacía, ruta citada/abreviada, backup repetido y fallo tras una mutación antes de anunciar recuperación completa. [Código de sync](https://github.com/MaciWP/claude-code-poneglyph/blob/802d7953ea6da0f6c8116e8947932b52ea1130ea/.claude/commands/sync-claude.ts).

**Sonda de activación:** `probe-activation.ts` espera stdout y salida del proceso, pero no drena stderr, no tiene timeout propio y no valida exit/final. Un `Skill()` seguido de fallo puede producir hit=true. Ejecuta en el repo real y `plan` mode; eso no acredita aislamiento de todos los hooks, memorias o estado. Un label/path de salida y un `--repeat` negativo necesitan validación. Su utilidad es medir activación bajo condiciones concretas, no éxito de la tarea. [Código](https://github.com/MaciWP/claude-code-poneglyph/blob/802d7953ea6da0f6c8116e8947932b52ea1130ea/.claude/evals/probe-activation.ts).

**Telemetría:** la fila «sessions today» cuenta ficheros por mtime y toma el primer modelo encontrado. Una sesión antigua modificada hoy no equivale a una iniciada hoy; un cambio de modelo posterior se pierde. `readFileSync(...).slice(...)` lee el fichero entero. Mantendría la fila como aproximación explícita hasta extraer timestamps/modelos de eventos. No convertir 82 sesiones históricas en una regla universal de presupuesto.

**Presupuesto:** contar también plugins corrige la omisión anterior, pero leer todas las entradas del registro no demuestra cuáles están habilitadas/cargadas en este proyecto. La misma instalación puede repetirse por scopes; plugins ajenos al perfil también afectan la medida. Conservar medición de bytes versionada y añadir origen efectivo por host, en vez de presentar el total como tokens reales facturados cada turno.

**CI:** Windows añadido es una mejora real. La validación de plugin con `continue-on-error: true` sigue siendo informativa; no presentarla como gate obligatorio. macOS queda pendiente en main. La PR del flujo propone añadirlo. El grep de privacidad depende de términos locales y no se ejecuta en CI: el amarillo es honesto, pero no acredita revisión de secretos. [Workflow](https://github.com/MaciWP/claude-code-poneglyph/blob/802d7953ea6da0f6c8116e8947932b52ea1130ea/.github/workflows/ci.yml).

## Qué dicen realmente las medidas del plan 032

El [diet ledger](https://github.com/MaciWP/claude-code-poneglyph/blob/802d7953ea6da0f6c8116e8947932b52ea1130ea/.claude/plans/032-polish-pass/diet-ledger.md) reconoce una corrección valiosa: **168.241→151.528 bytes** en nueve cuerpos, aproximadamente −9,9%, pero **51.254→52.912 bytes**, +3,2%, en su medición de superficie con el plugin de aquella máquina. La primera cifra no cancela la segunda: son denominadores distintos. El total del plugin privado es un dato reportado por el proyecto, no replicado en este entorno.

Los JSON publicados contienen **8/11 hits antes y 8/11 después**; el rerun selectivo tiene **3/6**. Eso confirma los recuentos, no ausencia de regresión de calidad. Se repiten casos elegidos después de observar fallos, y solo se mide que se invoca una skill. El cambio de `when_to_use` de 1/4 a 3/4 tras revertirlo, con incidencias de cuota cercanas, es una señal para investigar. No demuestra por sí solo una regla causal del host. Conservar la reversión prudente es razonable; etiquetar la explicación como hipótesis y probarla con orden balanceado, modelo fijo y resultado funcional.

## Crítica al nuevo informe del ecosistema

La [auditoría 011](https://github.com/MaciWP/claude-code-poneglyph/blob/802d7953ea6da0f6c8116e8947932b52ea1130ea/.claude/audits/011-ecosystem-comparison/report.md) aporta candidatos y fuentes útiles. Cambiaría estas conclusiones antes de usarlas para decidir:

1. **«En el 1% del ecosistema» no está demostrado.** No hay población definida, medida comparable ni percentil calculado. Tener doctor/evals cuenta capacidades, no su corrección. N01/N02/N07 ilustran por qué importa esa diferencia.
2. **La matriz mide coincidencias en rutas.** `hostCodex`, `kwVerify` o `kwSecurity` no acreditan soporte nativo, verificación real o seguridad; pueden contar ejemplos y documentación. Los árboles remotos usan HEAD mutable y el árbol local incluía cambios untracked. Fijar SHA por repo, guardar datos crudos y separar «archivo encontrado» de «capacidad ejecutada». El número de estrellas sirve para descubrir proyectos, no para ordenar su efectividad.
3. **Las recomendaciones por dependencia necesitan un piloto.** Instalar mediante `npx` puede descargar paquetes si no están en caché; no equivale a «sin red» por definición. El valor de ccusage es hacer visible el consumo; una estimación monetaria no es necesariamente el coste marginal de una suscripción. La [documentación de ccusage](https://ccusage.com/guide/) describe la lectura de uso local y sus informes.
4. **Compresión de herramientas:** puede reducir texto, pero una semana antes/después mezcla tareas y carga. Usar las mismas tareas, salida original conservada y recuperación de detalles; medir fallos de diagnóstico además de tokens.
5. **No limitar el ABC a Haiku por coste.** Es útil para validar el instrumento barato, pero no prueba la configuración de los modelos que usas para entregar código. Empezar con nueve runs de un modelo elegido y ampliar por bloques, como define el laboratorio.

La referencia [ponytail, benchmark agentic de 2026-06-18](https://github.com/DietrichGebert/ponytail/blob/main/benchmarks/results/2026-06-18-agentic.md) sí explica una comparación mejorada tras una crítica y reconoce contaminación del baseline por plugins globales. Es especialmente pertinente para nuestro ABC. Pero declara que sus tareas de features no levantan servidor ni navegador; las pruebas adversariales ejecutadas son un eje separado. Por tanto «menos LOC» y «100% seguro» no acreditan corrección funcional integral de esas doce features. Copiaría aislamiento, controles y reconocimiento de límites; no su titular como garantía para Poneglyph.

La [guía oficial de Claude](https://code.claude.com/docs/en/best-practices) favorece instrucciones relevantes y contexto proporcional. No da un percentil de Poneglyph ni un umbral universal de KB. La [referencia CLI](https://code.claude.com/docs/en/cli-reference) documenta `claude doctor` como diagnóstico de instalación/settings sin iniciar sesión; eso justifica usarlo, pero no garantiza que nuestro parser de su salida sea correcto.

## Decisión propuesta

Conservar el delta y corregir sus instrumentos antes de atribuirle mejoras. La nueva PR del flujo se basa en `802d795`, conserva los cambios publicados y resuelve aprobación circular, cierre prematuro y veredictos inconsistentes, incluida la copia en `flow-cycle`. Los defectos de doctor/headless/presupuesto permanecen identificados para un lote propio, evitando mezclar cambios independientes y perder atribución en el ABC.

Alcance de esta revisión: diff completo inventariado; lectura focalizada de ejecución, sincronización, medición y conclusiones del informe. No se reauditaron semánticamente todos los soportes de los 121 archivos, ni los 38 repos externos, ni plugins privados. No se hicieron llamadas a modelos ni swaps globales.
