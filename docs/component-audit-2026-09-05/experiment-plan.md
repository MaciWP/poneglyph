# Correcciones y experimento con presupuesto limitado

El objetivo es **calidad entregada por coste y por tiempo**, conservando un mínimo de calidad obligatorio. Esto no es un leaderboard de modelos. Un experimento de configuración debe mantener fijo el modelo dentro de cada comparación; después se repite el mismo protocolo con otro modelo.

## Tres brazos, una diferencia atribuible

| Brazo | Configuración | Pregunta |
|---|---|---|
| A | Perfil nativo mínimo, sin reglas personalizadas de Poneglyph; misma autenticación, herramientas y permisos necesarios | ¿Qué resuelve ya el agente? |
| B | Poneglyph del SHA auditado, congelado | ¿Qué aporta o empeora el sistema actual? |
| C | Perfil mínimo + un grupo pequeño de cambios identificados por hash | ¿Cuál es el efecto de esa intervención concreta? |

Primer C recomendado: instrucciones de verificación proporcionales, conocimiento local necesario y reporte de incertidumbre sin porcentajes ficticios. Mantener instrumentación corregida fuera de los tres brazos: si solo C recibe un grader mejor, se comparan instrumentos distintos. Para estudiar un hook de routing, cambiar solo ese hook y sus datos, no simultáneamente modelo, permisos y prompt de tarea.

No dar a B aclaraciones que A no recibe para salvar un bloqueo. Objetivo, criterios, autorizaciones y decisiones iniciales deben estar completos e idénticos. Si un brazo requiere interacción pese a la autonomía autorizada, registrar `blocked_by_policy`; no inventar una aprobación. Las restricciones superiores del host y de la organización siguen vigentes en todos los brazos.

## Nueve ejecuciones útiles

Empezar por **una tarea × tres configuraciones × tres repeticiones = nueve ejecuciones por modelo**. Se elige la tarea y el presupuesto antes de ver resultados. Esto separa mejor la variación estocástica que una sola ejecución de tres tareas distintas. Rotar el orden en tres bloques: ABC, BCA, CAB. Aleatorizar previamente el orden de esos bloques y guardar la semilla; no asumir que una semilla vuelve determinista al modelo remoto.

Con dos modelos son 18 ejecuciones, no nueve. Primero validar el harness con procesos simulados y ejecutar el piloto en una sola suscripción. Repetir con el segundo modelo solo si se acepta el gasto estimado. Después ampliar a tres tareas diferentes requiere 27 ejecuciones por modelo. Elegir modelos efectivamente disponibles mediante las CLIs instaladas; registrar ID resuelto, versión del host y fecha, no solo alias «Claude» o «Grok».

Tres repeticiones detectan fallos grandes y problemas del harness; **no acreditan una mejora pequeña ni permiten generalizar a todos los repos**. Publicar resultados individuales y declarar inconcluso un empate o efecto inestable. No elegir el mejor de tres como resultado normal: reportar éxito sobre todas las ejecuciones iniciadas. Registrar fallos de infraestructura aparte, con análisis secundario justificado, sin borrarlos del historial.

## Base realista y oráculo independiente

Crear un fixture versionado pequeño pero completo: CLI de importación de datos con persistencia local, validación, errores y tests, sin red externa. Preparar al menos estas tareas de dificultad comparable, en commits iniciales distintos:

1. **Bug de importación:** valores vacíos y separadores dentro de comillas se interpretan mal. AC: preservar datos, errores con línea y ausencia de regresión en casos válidos. Tests retenidos con combinaciones no dadas en el prompt.
2. **Cambio de comportamiento:** importación repetida debe ser idempotente, incluido fallo a mitad de escritura. AC: ningún duplicado y recuperación demostrada. No basta pasar tests que solo comprueban el happy path.
3. **Portabilidad:** paths con espacios/Unicode, CRLF y cancelación; mismo resultado y estado final en Windows/macOS. Evitar usar mocks de Windows como única acreditación de Windows.

El modelo puede modificar el producto y añadir tests propios; los tests retenidos y el grader se ejecutan **fuera de su árbol escribible**. Verificar el diff final, ficheros prohibidos y artefactos de evaluación. Si el agente altera o elimina la evaluación, no puede declararse éxito. La máquina de evaluación no reutiliza resultados cacheados de otro brazo. Cada run parte del mismo commit, dependencias fijadas y estado inicial; sin memoria, lecciones ni conversación heredadas de otro run.

El mismo autor de una solución puede escribir tests que reproduzcan su error. Por eso el oráculo debe definirse antes y revisarse con ejemplos positivos/negativos, incluida una implementación deliberadamente incorrecta que tiene que fallar. Usar un juez modelo solo para dimensiones cualitativas con rúbrica ciega; contabilizar su coste y calibrarlo contra revisión humana. No dejar que prosa convincente compense un AC funcional fallido. Fundamento: [E04](evidence.md#e04).

## Métricas sin una puntuación que esconda fallos

| Dimensión | Registro y cálculo | Interpretación |
|---|---|---|
| Calidad obligatoria | Todos los AC críticos pasan, sin corrupción ni cambios prohibidos | Si falla, no es solución aceptable, aunque sea rápida |
| Calidad adicional | Casos retenidos, regresiones, mantenibilidad con rúbrica y revisión ciega | Pesos predeclarados; mostrar también cada dimensión |
| Éxito | Runs aceptables / todos los runs iniciados | No confundir pass@1 con «alguna de tres salió bien» |
| Coste | Tokens input/output/cache separados; coste reportado o estimado y fórmula versionada | En suscripción, USD marginal puede ser desconocido: `null`, nunca cero inventado |
| Tiempo | Wall-clock completo; tiempo modelo/herramientas/tests/reintentos separado si existe | Incluir esperas y fallos; distinguir tarea de preparación/juez |
| Eficiencia | Coste total / soluciones aceptables; tiempo total / soluciones aceptables | Si no hay ninguna solución, valor no definido; publicar 0 éxitos, no ratio engañoso |
| Autonomía | Preguntas, intervenciones, bloqueos, reintentos y causas | Mismo nivel de autorización inicial en todos los brazos |

Mostrar pares calidad–coste y calidad–tiempo, con frontera de opciones no dominadas. No sumar milisegundos y tokens con pesos improvisados. Para calidad/coste, primero aplicar el mínimo de calidad; después comparar gasto. Para calidad/rendimiento, usar wall-clock y éxito, no tokens/segundo como sustituto de una tarea bien resuelta. Si el proveedor no expone uso completo, marcar cobertura de medición parcial. No sumar input total y cached input cuando cache ya forma parte del total.

Guardar por run: IDs de experimento/bloque/tarea/brazo, commit inicial y diff final, hashes de configuración cargada, modelo y host efectivos, OS/shell, timestamps monotónicos/duración, estado terminal, exit code, consumo disponible, resultados de AC y manifest de artefactos. Guardar stdout/stderr separados, redactando credenciales y sin subir configuración personal en bruto. Prompt y trayectorias requieren fixtures sin datos privados.

## Configuración global: swap temporal y recuperación

La configuración local **no cancela necesariamente** instrucciones globales o gestionadas. El laboratorio debe identificar los orígenes efectivos mediante capacidades nativas de cada host; Grok documenta `GROK_HOME` y `grok inspect`, pero eso no justifica asumir el mismo contrato para Claude/Codex. Véanse [E06](evidence.md#e06), [E07](evidence.md#e07), [E08](evidence.md#e08).

Si se necesita retirar temporalmente entradas globales, usar la transacción de la PR #2 como punto de partida y verificar estos requisitos:

- Inventario explícito de entradas de instrucciones/settings y symlinks/junctions; preservar autenticación y secretos. Guardar el enlace como enlace, sin recorrer ni borrar su target.
- Lock exclusivo, preflight de recuperación, backup único, journal persistido antes de mutar y verificación de hashes/tipos. Restauración en finalización normal y comando de recuperación tras crash/reinicio.
- No sobrescribir una modificación externa silenciosamente: registrar conflicto y conservar ambas versiones. Restaurar entradas originalmente ausentes como ausentes, dentro del conjunto controlado por el laboratorio.
- Canario no sensible para demostrar qué perfil se cargó. Si sigue entrando configuración gestionada que no puede aislarse, declarar esa capa común o invalidar la comparación; no intentar saltarse controles.
- Comprobar cancelación, disco lleno, terminación abrupta y fallo a mitad de restore en ambos OS. Un `finally` por sí solo no resuelve SIGKILL o apagado.

**Tres terminales sobre el mismo home no pueden mantener tres perfiles globales distintos mediante swap simultáneo.** Para la primera versión usar una CLI secuencial, con resumen en terminal y resultados JSON; los nueve runs los lanza el coordinador. No hace falta una mini app gráfica antes de tener un instrumento fiable. Si se quieren terminales simultáneas después, cada una necesita un entorno realmente independiente y validado; también aumentan contención y rate limits. Una pestaña distinta no aísla la configuración.

El swap no aísla el código autónomo del filesystem o la red: esa es otra capa del entorno de ejecución. No ejecutar tareas sobre un home de trabajo activo mientras se retira el perfil que otras sesiones necesitan. Estos son requisitos del laboratorio, no acciones realizadas en esta auditoría.

## Backlog en cambios pequeños

| Lote | Componentes | Criterio para integrar |
|---|---|---|
| 1 · Instrumentación | ranker, helper diagnóstico, scanner, runner/graders | R01/R03/R12/R13 convertidos en regresiones; proceso fallido nunca pasa |
| 2 · Flujo | tech-plan, tdd-design, critic, build, flow, retro | Transiciones únicas; fallo final mantiene tarea abierta; ningún permiso se infiere de un archivo |
| 3 · Instalación | sync-claude, registros, workspace-hint | Rollback recuperable; ruta portable; error parcial sale no cero; validar en ambos OS |
| 4 · Hooks | post-compact, instructions-loaded, activación, security-gate | Efecto nativo probado; métricas con denominador; advertencia no se vende como prevención |
| 5 · HTML/detectores | charts, theme, render/components, scanners review | Datos cero correctos, contraste medido, límite texto/HTML y falsos positivos documentados |
| 6 · Perfil experimental | dev, verify, preguntas, roles, lecciones, routing | ABC predefinido; conservar solo cambios que cumplan calidad y justifiquen coste/tiempo |

En cada lote revisar las PR #1/#2 antes de duplicar implementación. Registrar hallazgo→commit→prueba→resultado. No entrenar decisiones sobre el conjunto retenido: si se usa para optimizar reglas, pasa a desarrollo y se necesita otro conjunto para la conclusión final. Hasta ejecutar ese protocolo, «C debería mejorar» sigue siendo una predicción, no un resultado.
