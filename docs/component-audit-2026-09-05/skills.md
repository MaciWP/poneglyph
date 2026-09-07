> Privacy review, 2026-09-07: S02 and S32 now contain generic summaries. Detailed private assessments and identifiers were archived outside this public repository. The original 32-skill count is historical; the current core has 30 skills.

# Auditoría de las 32 skills

Base y método: [README](README.md). Fuentes externas y límites: [evidence.md](evidence.md).
**D** = defecto observado o contradicción documental; **H** = hipótesis de impacto pendiente de experimento.
P1 = corregir primero; P2 = siguiente iteración; P3 = mantenimiento. La prioridad es juicio de ingeniería, no una probabilidad.
Cada entrada incluye lo que conservaría, la crítica y una prueba de aceptación propuesta. Las pruebas propuestas no se presentan como ejecutadas.

<!-- skill:anti-hallucination -->
## S01 · anti-hallucination — conservar el objetivo; sustituir la confianza numérica · P1

**Fuente primaria:** [.claude/skills/anti-hallucination/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/anti-hallucination/SKILL.md).

**Aporta:** exige verificar rutas, símbolos y APIs antes de afirmarlos. La separación entre evidencia e inferencia es útil para cualquier modelo.

**Crítica:** **D**, la fórmula suma existencia de fichero, existencia de función, experiencia previa y requisitos claros como porcentajes de confianza. No hay calibración que conecte esa suma con probabilidad de corrección. Un fichero existente y una coincidencia textual pueden producir puntuación alta con una implementación equivocada. El ejemplo `content.includes("calculateTotal")` tampoco distingue declaración, comentario o string. La propia skill reconoce después falsos positivos de Grep: el ejemplo debería respetar esa advertencia.

**H**, exigir Glob antes de leer una ruta conocida y preguntar ante varias coincidencias introduce viajes de herramientas y preguntas evitables. La referencia fija a documentación de 2024–2025 envejece. Estos problemas no invalidan comprobar los hechos; invalidan convertir un procedimiento de comprobación en una certeza porcentual.

**Cambio propuesto:** reemplazar sumas por estados observables: ruta leída, símbolo resuelto, comportamiento ejecutado, fuente/versionado, incertidumbre residual. Resolver ambigüedad con contexto semántico antes de preguntarla al usuario. Usar documentación correspondiente a la versión instalada.

**Prueba:** repositorio con una función homónima en un comentario y otra real en un módulo distinto. Medir referencia correcta, número de llamadas y falsos “verificado”; comparar regla actual y comprobación semántica.

<!-- private-skill:S02 -->
## S02: private ticket knowledge (historical summary)

The original company-specific assessment is preserved in private Work memory.
Its generic findings remain relevant: team knowledge belongs in an optional
project-local layer, connector capabilities require discovery, and questions
should close material gaps rather than satisfy a fixed round quota.
No company skill or connector is registered by this public record.

<!-- skill:build -->
## S03 · build — buen núcleo; demasiados bloqueos y cierre prematuro · P1

**Fuente primaria:** [.claude/skills/build/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/build/SKILL.md).

**Pasajes de contraste:** [SKILL.md:L159](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/build/SKILL.md#L159) · [SKILL.md:L202](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/build/SKILL.md#L202) · [SKILL.md:L306](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/build/SKILL.md#L306).

**Aporta:** reutilización de fixtures, unidad de trabajo acotada, red→green cuando corresponde, diagnóstico de causa y sincronización de documentación afectada.

**Crítica:** **D**, Step 8 actualiza el estado y cierra la HU antes del gate `verify` de Step 9. Haber pasado comprobaciones anteriores no garantiza el resultado del gate final; un fallo posterior puede dejar una HU marcada como completada. Los pasos de estado deben corresponder al resultado verificado completo. La tabla de antipatterns sí pide reabrir una HU cerrada sin verificar (línea 306), pero esa reparación posterior no elimina el orden contradictorio ni garantiza recuperación tras interrupción. También existe tensión entre aceptar `tdd-skip` como vinculante y reaccionar ante nuevo riesgo descubierto durante la implementación.

**H**, pedir al usuario decisiones de nombres, rutas o defaults deducibles del repositorio frena la autonomía. La lista rígida de ficheros puede convertir un ajuste necesario y pequeño en una reapertura ceremonial del plan. Repetir una suite completa por cada HU y luego en `verify` y `critic` puede dominar el tiempo sin comprobar una revisión nueva.

**Cambio propuesto:** transición final después de `verify`; evidencia asociada al SHA/diff; preguntar solo por decisiones externas no inferibles; permitir ampliar el conjunto de ficheros cuando sea necesario para los AC y se explique. Reabrir una excepción de tests cuando cambie el riesgo.

**Prueba:** la prueba unitaria pasa pero el flujo real falla. La HU debe permanecer abierta. Añadir un caso con tres HUs independientes y registrar verificaciones duplicadas sin cambios intermedios.

<!-- skill:consult -->
## S04 · consult — segunda opinión útil; contrato de host envejecido · P1

**Fuente primaria:** [.claude/skills/consult/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/consult/SKILL.md).

**Aporta:** trata la respuesta externa como hipótesis y pretende verificarla contra el repositorio. Detectar el ejecutable en PATH es mejor que depender de una ruta personal.

**Crítica:** **D**, presenta Grok como host de un solo modelo, aunque la documentación actual permite selección/configuración de modelos [E07]. Un diagnóstico local de instalación npm o de salida 137 en macOS se convierte en instrucción general. Recomendar desactivar el sandbox a partir de ese único síntoma no identifica la causa. La distinción entre subprocess externo y “agente” deja contratos de autorización contradictorios con el núcleo.

**H**, ocultar stderr en los ejemplos de shell hace difícil distinguir respuesta vacía, auth fallida y fallo del proceso. Una espera conjunta sin comprobar cada salida no acredita que todas las consultas funcionaron. No hay una contabilidad completa por consulta que justifique tiempos/costes genéricos.

**Cambio propuesto:** adaptador por CLI/versionado, argumentos estructurados, timeout, salida y error separados, estado final validado y modelo efectivo registrado. Preservar restricciones y autorización de la sesión; no volver a pedir decisiones ya dadas. Resolver un fallo de sandbox por diagnóstico, con fallback compatible.

**Prueba:** ejecutables simulados: uno responde, otro falla auth, otro se cuelga y otro devuelve una conclusión falsa convincente. Solo el primero aporta una respuesta válida; ninguna cuenta como verificación independiente del código.

<!-- skill:critic -->
## S05 · critic — imprescindible como revisión; veredicto y evidencia necesitan reparación · P1

**Fuente primaria:** [.claude/skills/critic/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/critic/SKILL.md).

**Pasajes de contraste:** [SKILL.md:L231](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/critic/SKILL.md#L231).

**Aporta:** trazado de AC, checks reales, clasificación de deriva del spec, revisión de seguridad y posibilidad de un revisor con contexto fresco. Declara el sesgo residual cuando no hay revisión separada.

**Crítica:** **D**, `APPROVED_WITH_WARNINGS` acepta hasta dos MAJOR y `NEEDS_CHANGES` se activa con al menos uno: un mismo caso satisface ambos. “El revisor gana” en corrección sustituye la reproducción por autoridad; un contexto fresco también puede equivocarse. El diff `origin/main..HEAD` no representa cambios sin commit ni necesariamente la base correcta de la PR.

La frase “checks deterministas 0% FP frente a ~80% de LLM-judge” no es una tasa universal. Determinismo significa repetibilidad, no oráculo correcto. W1 reconoce límites y convenciones sin óptimo medido; esta skill endurece algunas de ellas como leyes. No se localizó en la base un W2 con trazabilidad suficiente para revalidar esa comparación exacta. Véase [E04] y [E11].

**H**, considerar sospechoso no encontrar defectos incentiva falsos hallazgos. Un panel no debe prohibirse por principio ni activarse por prestigio: importa su precisión incremental por coste.

**Cambio propuesto:** tabla de veredictos disjunta, base resuelta, evidencia reproducible para arbitrar conflictos y lenguaje que permita “sin hallazgos”. Separar problemas previos de regresiones y fallos de infraestructura.

**Prueba:** cero, uno, dos y tres MAJOR; base diferente de main; working tree sucio; revisor que acusa un falso bug. Cada entrada produce un único veredicto coherente.

<!-- skill:decide -->
## S06 · decide — conservar opciones y reversibilidad; no vender votos como certeza · P2

**Fuente primaria:** [.claude/skills/decide/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/decide/SKILL.md).

**Aporta:** diferencia decisiones reversibles, considera no hacer nada y estructura restricciones, alternativas y consecuencias. El formato permite revisar una decisión después.

**Crítica:** **D**, la confianza alta/media basada en acuerdo 3/3 o 2/3 de personajes generados por el mismo modelo no es una probabilidad calibrada. Son perspectivas de un proceso correlacionado, no tres expertos independientes. Las referencias heavy añaden numerosas fases, validación y voto; el número de agentes no acredita mejores recomendaciones.

**H**, personajes famosos y disenso obligatorio pueden sustituir evidencia por dramatización. El coste anunciado para una ronda no representa automáticamente el contexto de cada trabajador, retries, síntesis y verificación. Un panel puede aportar valor, pero el umbral fijo de participantes no tiene un óptimo demostrado para tus tareas.

**Cambio propuesto:** distinguir brainstorming inline, revisión factual y panel real. Exponer costes completos y límites. Reducir primero a opciones, restricciones y una refutación concreta; escalar cuando cambie una decisión de suficiente impacto. Registrar qué evidencia haría cambiar de opción.

**Prueba:** decisiones con una opción que viola una restricción dura, otras casi empatadas y otra sin datos suficientes. Medir violaciones y calidad a ciegas; no premiar acuerdo ni longitud. Cruzar orden de opciones para detectar anclaje.

<!-- skill:deep-research -->
## S07 · deep-research — uno de los mejores diseños; aclarar presupuesto y precedencia · P2

**Fuente primaria:** [.claude/skills/deep-research/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/deep-research/SKILL.md).

**Pasajes de contraste:** [escalation.md:L1](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/deep-research/references/escalation.md#L1).

**Aporta:** búsqueda inicial en sesión, evidencia primaria, huecos explícitos, seeds y exclusión de búsquedas repetidas. Tiene condiciones para parar y no gastar el presupuesto completo por costumbre.

**Crítica:** **D**, propone uno a tres investigadores para lagunas concretas; `orchestrator-protocol` prohíbe un solo agente y exige al menos cuatro para investigación delegada. La referencia de escalación exige un refutador en ciertos casos donde el punto de entrada lo llama opcional. Falta una resolución explícita entre esas reglas.

**H**, diez agentes como máximo no limita tokens, wall-clock ni llamadas de herramientas. Hacer pasar cualquier prompt de delegación por otra rúbrica puede costar más que resolver una pequeña laguna directamente. “SEED vacío → no delegar” es razonable contra exploración vaga, pero una fuente inaccesible al Lead podría ser accesible a otra herramienta; hay que distinguir falta de objetivo y falta de evidencia inicial.

**Cambio propuesto:** presupuesto global por tarea y por escalación; permisos heredados del contrato activo; una única regla de selección. Mantener seed, contraevidencia y stopping rule, con excepciones basadas en capacidades verificadas.

**Prueba:** pregunta respondible con dos fuentes, pregunta con una contradicción y fuente inaccesible. Evaluar cobertura, exactitud de citas, consultas redundantes y coste. Un informe más largo no gana por sí mismo.

<!-- skill:dev -->
## S08 · dev — buena secuencia mental; la visibilidad obligatoria no es calidad · P1

**Fuente primaria:** [.claude/skills/dev/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/dev/SKILL.md).

**Aporta:** entender, reutilizar, planificar, verificar y aprender. El suelo de seguridad/accesibilidad evita confundir minimalismo con omisión de requisitos.

**Crítica:** **D**, exige las cinco fases visibles incluso en un rename. Otras piezas permiten saltar scoring/skills en tareas triviales. “Módulo nuevo” activa espera aunque el usuario haya pedido precisamente crearlo. La política Git de “este turno” puede bloquear una PR ya solicitada cuando el usuario añade un mensaje de seguimiento.

**H**, una línea de LEARN sin aprendizaje y la explicación repetida del proceso son costes de presentación, no pruebas de mejor código. Más atención puede ayudar en un cambio pequeño pero arriesgado; el tamaño no basta para inferirlo, y tampoco justifica la ceremonia universal. [E01], [E02] y [E03] aconsejan medir el resultado del sistema, no contar mandatos cumplidos.

**Cambio propuesto:** conservar las cinco comprobaciones como guía, mostrar solo decisiones/evidencia útiles y mantener el plan externo para tareas donde aporte. Autorización por objetivo y alcance, vigente durante la tarea. Aprendizaje persistente solo cuando exista una lección verificable y aplicable.

**Prueba:** typo, cambio de autorización de una línea y nueva herramienta expresamente pedida. El primero no debe pedir aprobación extra; el segundo debe verificar permisos; el tercero debe llegar a una entrega revisable sin reiterar la petición.

<!-- skill:diagnostic-patterns -->
## S09 · diagnostic-patterns — catálogo útil; helper roto y retries demasiado generales · P1

**Fuente primaria:** [.claude/skills/diagnostic-patterns/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/diagnostic-patterns/SKILL.md).

**Aporta:** reproduce, clasifica, investiga causas y recoge opciones de recuperación. La separación diagnóstico/retry/saga evita que todo error se resuelva con un parche local.

**Crítica:** **D**, `scripts/analyze-error.ts` importa `hooks/lib/error-patterns` y `error-pattern-matching`, ausentes. El comando falla antes de diagnosticar; reproducido en R03. La tabla trata códigos de error como criterio suficiente de retry. Un timeout puede ocurrir después de una escritura efectiva; reenviar sin idempotencia duplica efectos. ENOTFOUND no implica siempre transitoriedad.

**H**, “optional chaining” como primer chequeo para un TypeError puede ocultar una precondición rota. “5 Whys → causa identificada” describe una técnica, no una garantía causal. Activar logging detallado sin acotarlo puede producir mucho ruido y exponer datos que el diagnóstico no necesita.

**Cambio propuesto:** reparar o retirar la utilidad y sus referencias; separar hipótesis de causa confirmada. Retry según operación, idempotencia, presupuesto y evidencia del fallo. Registrar datos mínimos, redacción y correlación; probar la compensación cuando ella misma falla.

**Prueba:** timeout tras un cobro simulado, error permanente de DNS, saga cuya compensación falla y dependencia ausente. Esperado: no duplicar cobros, no bucle inútil y estado recuperable explícito.

<!-- skill:drillme -->
## S10 · drillme — preguntar por lagunas sí; cuotas de rondas no · P2

**Fuente primaria:** [.claude/skills/drillme/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/drillme/SKILL.md).

**Aporta:** preguntas que cambian la decisión, información incorporada al artefacto y diferencia entre dudas reducibles e incertidumbre que el usuario no puede resolver.

**Crítica:** **D**, declara “nunca un número fijo” pero exige un mínimo de dos rondas si hay lagunas. Existe una excepción de cierre en una ronda, así que no es un bloqueo absoluto; aun así crea presión para fabricar una segunda. El cierre “No open gaps” también exige salida ceremonial cuando no hay preguntas. “Guía, nunca gate” pierde sentido cuando otras skills la colocan dentro de un gate obligatorio.

**H**, una batería de 20–40 preguntas puede ser útil en descubrimiento, pero desproporcionada para una tarea autónoma con defaults razonables. Que una cuestión sea interesante no significa que deba contestarla el usuario. La distinción epistemic/aleatoric no sustituye comprobar el repositorio o experimentar.

**Cambio propuesto:** sin mínimo de rondas; primero resolver por lectura/ejecución lo descubrible; preguntar solo por información externa cuyo valor supere el coste de interrumpir. Respetar “elige tú” y condiciones ya aprobadas.

**Prueba:** prompt completo, ambigüedad resuelta en una respuesta y pregunta cuya respuesta está en package.json. Contar interrupciones evitables y AC omitidos; no premiar número de categorías barridas.

<!-- skill:explain-changes -->
## S11 · explain-changes — valiosa para aprender; distinguir explicación y demostración · P2

**Fuente primaria:** [.claude/skills/explain-changes/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/explain-changes/SKILL.md).

**Aporta:** lectura antes/después, usos, tests e intención del commit; follow-ups focalizados sin regenerar todo el informe. Es una buena vía para que la IA aumente comprensión humana.

**Crítica:** **D**, hereda los porcentajes no calibrados de `anti-hallucination`. Dos ficheros similares no prueban que algo sea la convención general, mientras `lessons` exige un censo. La tabla exige fuente oficial para comportamiento de librería, pero el flujo lo condiciona a una confianza subjetiva inferior al 70%.

**H**, FAQ fija de tres a cinco preguntas, cadena lógica obligatoria y lectura completa de ficheros enormes pueden consumir más atención que la explicación necesaria. Una documentación describe el contrato de la librería; no demuestra cómo se comporta esta integración ni con qué versión se ejecutó.

**Cambio propuesto:** nivel de profundidad elegido por objetivo del usuario; evidencia del código y de la versión; ejemplos pequeños de entrada/salida; enlaces primarios solo donde sostengan una afirmación. Expresar “convención observada en estos casos” cuando el muestreo sea parcial.

**Prueba:** diff con API deprecated, cambio trivial y migración con efecto no evidente. Evaluar afirmaciones correctas y comprensión con una pregunta posterior, además de longitud y tiempo. No modificar código durante una explicación de solo lectura.

<!-- skill:frontend-craft -->
## S12 · frontend-craft — excelente foco en consistencia; límites visuales demasiado rígidos · P2

**Fuente primaria:** [.claude/skills/frontend-craft/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/frontend-craft/SKILL.md).

**Pasajes de contraste:** [craft-floor.md:L1](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/frontend-craft/references/craft-floor.md#L1).

**Aporta:** barrido de usos, patrones hermanos y estados reales. Evitar rediseñar una interfaz compartida por gusto es una mejora concreta de producto.

**Crítica:** **D**, descalifica el browser por una experiencia del entorno y obliga a screenshots del usuario. Esa indisponibilidad debe detectarse por sesión. Un máximo fijo de inspecciones puede dejar un defecto verificable sin cerrar. El craft floor dice que el brief manda, pero prohíbe ciertos elementos aun cuando el brief los pida. También mezcla requisitos de contraste con gustos: tonos, sombras, tipografía y adornos.

**H**, reproducir siempre el patrón existente puede perpetuar un problema de accesibilidad. Leer dos o tres hermanos sirve de orientación, pero puede ocultar variantes móviles o por estado. Los cuatro incidentes históricos citados justifican investigar consistencia, no la eficacia cuantificada de esta receta.

**Cambio propuesto:** distinguir WCAG, convención de producto y preferencia estética. Inspección automatizada disponible antes de trasladar trabajo al usuario; repetir solo para resolver un defecto concreto. Mantener alcance y respetar el diseño aprobado.

**Prueba:** componente compartido con tres pantallas, teclado, viewport estrecho y estado de error. Un cambio aprobado debe ser coherente y accesible; terminar después de dos capturas no cuenta como éxito si queda roto.

<!-- skill:graphify -->
## S13 · graphify — herramienta opcional potente; excesiva autoridad y riesgos de ejecución · P1

**Fuente primaria:** [.claude/skills/graphify/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/graphify/SKILL.md).

**Aporta:** extracción estructural, fuentes de relaciones, caché incremental y advertencias de integridad. Tiene un fast path útil para consultar un corpus ya indexado.

**Crítica:** **D**, el trigger abarca prácticamente cualquier pregunta sobre código y prioriza el grafo por mera existencia, sin verificar su vigencia. Obliga a agentes para semántica y proclama 5–10× de velocidad sin un experimento asociado al entorno; choca con el gate global. La instalación propone upgrade no fijado y fallback `--break-system-packages`. Las instrucciones interpolan rutas en shell y Python; espacios, apóstrofos y comillas requieren un tratamiento real de argumentos.

Hay problemas adicionales en el runbook: B3 anuncia que ignora chunks inválidos, pero el bucle JSON los carga sin manejo de error; globs pueden recoger restos de una ejecución abortada; la sugerencia `--force` ante shrink no se propaga en el bloque mostrado. Informar del coste a partir de placeholders cero o sin contabilizar trabajo del Lead infravalora el gasto. Las advertencias son útiles, pero “graph complete” no debe equivaler a cobertura completa cuando faltan chunks.

**Cambio propuesto:** opt-in por necesidad de grafo; manifest de revisión/corpus, salida degradada explícita, directorio por ejecución, esquema validado y CLI empaquetada con versión. Consultar código vigente para afirmaciones decisivas. No instalar dependencias globales como efecto lateral de una consulta.

**Prueba:** grafo obsoleto, ruta con espacios/apóstrofo, chunk corrupto, ejecución anterior interrumpida y corpus parcialmente fallido. Comparar contra rg/LSP en preguntas con respuesta conocida, incluyendo coste de construir/amortizar el índice.

<!-- skill:html-report -->
## S14 · html-report — buen candidato a generación determinista; datos y contrato fallan · P1

**Fuente primaria:** [.claude/skills/html-report/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/html-report/SKILL.md).

**Aporta:** separar datos de plantilla reduce HTML generado por el modelo; tablas/SVG, texto visible sin JS y exportación autocontenida son buenas bases.

**Crítica:** **D**, R07 demuestra que donut vacío muestra total 1; R09 mide contraste de texto de estado por debajo de AA; R08 identifica celdas string insertadas como HTML sin escape. El riesgo de script depende de que datos no confiables alcancen ese campo y el lector abra el informe; no se ha demostrado explotación remota. El contrato debería hacer explícito ese límite y proteger los campos ordinarios.

El punto de entrada afirma que existe `plotInline()`, eliminado en `charts.ts`. Declara “sin JS” antes de documentar un modo dynamic con JS, algo solucionable delimitando contratos. El generador incluye Fonts sin opción de apagado aunque se ofrece una ruta puramente offline. No valida JSON en runtime; un tipo TypeScript no valida stdin. La propiedad `collapsible` no cambia el render.

**Cambio propuesto:** números correctos para cero/negativos, validación de entrada y strings escapados por defecto; HTML confiable solo por opt-in explícito. Un contrato por modo, switch offline y comprobar contraste con los pares realmente renderizados. Detalles en [helpers](commands-and-hooks.md#helpers-de-html-report).

**Prueba:** cero, negativos, dato mal tipado, HTML como texto, red desactivada, teclado, impresión y light/dark. Los tests de strings existentes no prueban toda la experiencia visual.

<!-- skill:lessons -->
## S15 · lessons — conocimiento local valioso; evitar convertir incidentes en leyes · P2

**Fuente primaria:** [.claude/skills/lessons/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/lessons/SKILL.md).

**Aporta:** admisión por incidente real, fuentes, poda y guardas concretas contra errores repetidos. Las convenciones no estándar son precisamente un caso donde contexto adicional puede aportar [E01].

**Crítica:** **D**, prohíbe capas de lecciones por repo, pero la regla de poda manda mover una lección particular a la capa de ese repo. Las referencias incluyen decisiones de una aplicación Django/React que no son leyes del stack. Por ejemplo, evitar filtros manuales de tenant solo es seguro si el mecanismo de aislamiento de ese proyecto existe. G1 exige censo completo; `frontend-craft` y `explain-changes` usan muestras pequeñas.

**H**, una incidencia basta para justificar guardar evidencia, no para imponer la regla en todos los proyectos. La instrucción de borrar lo que el modelo ya sabe necesita reevaluación por modelo/versiones; sin ella la poda queda subjetiva. Un censo de toda la base para una decisión estilística pequeña puede resultar caro.

**Cambio propuesto:** procedencia, aplicabilidad por repo/stack/versionado y fecha de revisión. Conservar una fuente canónica con filtros de carga; separar preferencia de equipo, contrato técnico y heurística. Registrar contraejemplo que limite cada regla.

**Prueba:** misma tarea en un proyecto con middleware de tenant y otro sin él. La lección no debe retirar controles necesarios del segundo. Medir regresiones evitadas y reglas irrelevantes aplicadas.

<!-- skill:lsp-operations -->
## S16 · lsp-operations — conservar como referencia breve; reducir promesas absolutas · P2

**Fuente primaria:** [.claude/skills/lsp-operations/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/lsp-operations/SKILL.md).

**Aporta:** navegación semántica y fallback textual. Distingue definiciones, referencias, tipos y llamadas, operaciones útiles para no inventar usos de símbolos.

**Crítica:** **D**, el esquema presentado describe un adaptador concreto, no el protocolo LSP universal. Posiciones y operaciones deben corresponder a la herramienta del host. “Encuentra todos los usos” o “grafo completo” no cubre llamadas dinámicas, reflexión, templates, configuración ni ficheros fuera del proyecto indexado. El criterio de TypeScript/JavaScript excluye lenguajes soportados mediante otros servidores.

**H**, LSP-first universal puede pagar arranque/índice para una búsqueda trivial. La advertencia de que nombres comunes devuelven demasiadas referencias parece trasladar un problema léxico a una herramienta semántica; hay que distinguir resolución fallida de referencias reales.

**Cambio propuesto:** consultar capacidades, versión y disponibilidad; semántica cuando se conoce la posición y búsqueda textual para descubrirla o cubrir referencias dinámicas. Reintentar warmup de forma acotada y declarar cobertura parcial.

**Prueba:** símbolo homónimo, reexport, uso desde template, Python con servidor disponible y LSP caído. Medir precisión/cobertura y latencia; no exigir LSP si la respuesta ya está acreditada de forma suficiente.

<!-- skill:meta-create -->
## S17 · meta-create — alto impacto: puede multiplicar errores en todo el sistema · P1

**Fuente primaria:** [.claude/skills/meta-create/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/meta-create/SKILL.md).

**Pasajes de contraste:** [gotchas.md:L1](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/meta-create/references/hook/gotchas.md#L1) · [frontmatter-spec.md:L1](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/meta-create/references/skill/frontmatter-spec.md#L1).

**Aporta:** plantillas, referencias por tipo y escenarios de evaluación antes de crear una skill. Unificar seis creadores evita duplicar conocimiento.

**Crítica:** **D**, el resumen y `references/hook/gotchas.md` dicen que exit 2 solo bloquea dos eventos; la documentación actual describe más. La referencia dice hooks en orden, pero el contrato actual ejecuta coincidencias en paralelo. “async ignora todo stdout” tampoco describe el comportamiento general actual [E06]. Si el creador usa estas reglas, fabrica hooks defectuosos aunque el fichero sea sintácticamente válido.

`references/skill/frontmatter-spec.md` enumera campos inválidos y luego los incluye en su ejemplo completo; además coloca Keywords dentro de description pese a declarar `metadata` como fuente. `references/agent/frontmatter-spec.md` atribuye registro nativo a frases específicas sin prueba del contrato. El destino “hook + settings.json” no distingue el global de Poneglyph del local hook-free.

**Cambio propuesto:** esquema y ejemplos validados juntos, compatibilidad por versión, test real por evento y scope de instalación explícito. Usar el estándar portable al exportar y extensiones nativas solo en su host. Eliminar reglas de matching que solo son convenciones propias.

**Prueba:** generar hook Stop bloqueante, logger async y skill portable. Probar invocación/salida en el host objetivo, no solo que el YAML se parsea. Repetir al actualizar el mínimo de CLI.

<!-- skill:meta-settings-cookbook -->
## S18 · meta-settings-cookbook — buena referencia; ejemplos no equivalen a aislamiento · P1

**Fuente primaria:** [.claude/skills/meta-settings-cookbook/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/meta-settings-cookbook/SKILL.md).

**Pasajes de contraste:** [05-permissions.md:L1](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/meta-settings-cookbook/references/05-permissions.md#L1).

**Aporta:** enlaces oficiales y separación de permisos, memoria, env, estilos y gitignore. Es preferible a memorizar flags.

**Crítica:** **D**, el ejemplo permissive combina herramientas generales, denegaciones de lectura y bypassPermissions. No puede interpretarse como una barrera completa para secretos o procesos; debe explicarse qué controla cada mecanismo [E08]. Las rutas y valores de las referencias son sensibles a versión y host. El cambio mínimo declarado en settings y los campos documentados para versiones posteriores no forman una única matriz de compatibilidad.

**H**, ejecutar golden prompts de estilo por cualquier cambio de permisos da una impresión de validación que no prueba el permiso. Un setting aceptado por JSON puede ser ignorado o no tener el efecto previsto. Algunas instrucciones prácticas sobre PATH/statusline son locales y deberían permanecer en el overlay de máquina.

**Cambio propuesto:** ejemplos con objetivo explícito y capabilities mínimas para ese objetivo; validación de esquema y prueba funcional del permiso. Separar settings soportados en la versión mínima de recomendaciones para la última. Mantener entradas específicas fuera del perfil común.

**Prueba:** fichero centinela sintético leído por Read y por shell dentro de un sandbox desechable. Comparar resultado con el aislamiento que se anuncia; ninguna credencial real entra en la prueba.

<!-- skill:orchestrator-protocol -->
## S19 · orchestrator-protocol — simplificar y corregir una fórmula imposible · P1

**Fuente primaria:** [.claude/skills/orchestrator-protocol/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/orchestrator-protocol/SKILL.md).

**Pasajes de contraste:** [03-complexity-routing.md:L35](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/orchestrator-protocol/references/03-complexity-routing.md#L35).

**Aporta:** dependencias, restricciones de escritura paralela, prompts con contexto y verificación de resultados delegados. El default inline puede ahorrar coordinación.

**Crítica:** **D**, `03-complexity-routing.md` usa cinco factores mínimos 1, peso 20% y escala 100/3. El mínimo es **33,333**: nunca llega a las bandas <15 ni 15–30. R15 lo reproduce. El texto también confunde máximo por factor con el máximo total. No es solo calibración pendiente; hay rutas inalcanzables.

La prohibición de un investigador único contradice `deep-research`; `graphify` obliga a agentes; `critic` tiene una excepción. Las referencias todavía muestran equipos/agents retirados o ejemplos de dos/tres scouts con notas que exigen cuatro. Las decisiones están distribuidas y el lector debe reconstruir precedencia.

**H**, umbrales de cuatro unidades, puntuaciones 30/60 y costes multiplicadores no son óptimos medidos. W1 admite expresamente ese límite. Un único subproceso puede aportar aislamiento o síntesis; cuatro no garantizan rentabilidad.

**Cambio propuesto:** sustituir scoring por riesgo/dependencias verificables o calibrarlo con datos. Un único contrato de delegación, sin cuotas; presupuesto global y permisos persistentes dentro del alcance autorizado. Selección de modelo efectiva, sin nombres obsoletos.

**Prueba:** trivial, arriesgado de un fichero, investigación de un hueco y cuatro tareas acopladas. Deben enrutarse por necesidad, no por score inflado o cardinalidad.

<!-- skill:pr-conventional-comments -->
## S20 · pr-conventional-comments — conservar formato; no fabricar elogios ni soluciones · P2

**Fuente primaria:** [.claude/skills/pr-conventional-comments/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/pr-conventional-comments/SKILL.md).

**Aporta:** comentarios localizados, razón e impacto, tono respetuoso y una review agrupada. Facilita transformar un hallazgo en una acción del autor.

**Crítica:** **D**, exige decorator en todos los comentarios, pero la tabla y plantillas lo omiten para praise y varios labels. El formato no tiene una única regla. Obligar a al menos un elogio puede producir cumplidos artificiales en un diff sin méritos destacables. Obligar a acompañar cada issue de una solución puede incentivar inventarla cuando solo se ha probado el bug.

**H**, convertir toda afirmación en pregunta diluye la claridad de un defecto demostrado. Limitar a dos/tres líneas puede ocultar precondiciones de seguridad o pasos de reproducción. Redactar “como si fuera el usuario” debe ser una ayuda al borrador, no publicación o atribución automática.

**Cambio propuesto:** elogios cuando sean específicos y merecidos; decorator consistente; admitir “problema demostrado, solución por investigar”. Separar evidencia, consecuencia y sugerencia. Publicación únicamente cuando la tarea la autoriza, preservando el autor/configuración real.

**Prueba:** review limpia, review solo con un blocker complejo y sugerencia no bloqueante. No debe inventar un praise, esconder el blocker ni presentar una hipótesis de solución como certeza.

<!-- skill:pr-review -->
## S21 · pr-review — fuerte trazabilidad; severidad y base necesitan precisión · P1

**Fuente primaria:** [.claude/skills/pr-review/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/pr-review/SKILL.md).

**Pasajes de contraste:** [03-check-discovery.md:L1](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/pr-review/references/03-check-discovery.md#L1).

**Aporta:** resolución de target, deferencia al review propio del repo, AC contra diff y sección separada para problemas anteriores. La referencia de descubrimiento reconoce suites compartidas y checks no ejecutables.

**Crítica:** **D**, Step 4 transforma cualquier check fallido en Critical. Step 7 excluye problemas anteriores del score. Un fallo basal o de infraestructura satisface ambas reglas y carece de tratamiento coherente. El score 100−Σ y APPROVE con hasta dos Major no explican si esos Major son errores de corrección pendientes. El comando de diff se presenta sin un algoritmo completo de base/diff para cada modo.

**H**, leer todos los ficheros enteros, incluso generados enormes, puede desplazar contexto relevante. Un score ponderado mezcla estilo y seguridad; dos reviews con el mismo número pueden tener riesgos distintos. Restatar nueve pasos no prueba haberlos realizado.

**Cambio propuesto:** base de la PR o merge-base explícito, separación regresión/baseline/infra, criterios de bloqueo por efecto. Guardar evidencia de checks y AC, con lectura adicional dirigida a la parte que puede cambiar el hallazgo. Eliminar score global si no aporta a la decisión.

**Prueba:** test preexistente rojo, auth bypass nuevo, falta de herramienta y PR contra release. Informar cada caso correctamente sin culpar a la PR por el baseline ni aprobar un bug por debajo de una cuota de Major.

<!-- skill:prompt-engineer -->
## S22 · prompt-engineer — usar como herramienta; no como peaje para toda tarea · P2

**Fuente primaria:** [.claude/skills/prompt-engineer/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/prompt-engineer/SKILL.md).

**Aporta:** objetivo, contexto, restricciones y entregable claro. Los ejemplos de dominio y el handoff explícito pueden ahorrar idas y vueltas.

**Crítica:** **D**, el mismo modelo puntúa cinco criterios y se obliga a llegar a 80 antes de actuar. Esa nota mide su propia percepción del prompt, no éxito observado. El umbral 70/80 no está calibrado para los modelos objetivo. Presentar una reescritura para confirmar puede bloquear una petición cuyo significado se puede resolver leyendo el repo.

**H**, meter más contexto para subir la rúbrica puede empeorar señal/coste. “Cada ida y vuelta cuesta 2–5K” carece de denominador completo y depende de caché, host, herramientas y tamaño de historia. Inglés simplificado puede ayudar al lector; no garantiza mayor capacidad en todos los modelos ni tareas.

**Cambio propuesto:** aplicar la checklist sin score numérico por defecto; pedir claridad solo cuando falta información externa. Reservar refinamiento visible para quien pide un prompt. Evaluar el prompt por calidad/coste en un conjunto de tareas retenidas y registrar modelo/versionado.

**Prueba:** tarea clara en lenguaje informal, tarea realmente ambigua y prompt con instrucciones contradictorias. Medir cumplimiento final y preguntas evitables, no la puntuación que el propio generador se asigna.

<!-- skill:retro -->
## S23 · retro — conservar aprendizaje probado; quitar incentivos a inventarlo · P1

**Fuente primaria:** [.claude/skills/retro/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/retro/SKILL.md).

**Aporta:** incidente→lección, propuestas de promoción revisables, deriva de spec y evaluación de fallos. Puede convertir trabajo perdido en una mejora reutilizable.

**Crítica:** **D**, el inicio califica como teatro una retro sin fricción o lección propuesta, mientras otros apartados admiten honestamente ninguna. Los criterios de cierre con promociones pendientes no son uniformes. La referencia rechaza retro cuando el veredicto es BLOCKED: precisamente un fallo puede merecer un postmortem antes de seguir.

**H**, sospechar de varios ciclos sin promociones premia añadir reglas globales, aunque el sistema funcione bien. Promover cada incidente sin test de generalización puede reforzar una excepción local. Modificar la skill instalada a través de un symlink depende de que instalación y fuente estén alineadas; en modo copia cambia otro fichero.

**Cambio propuesto:** retro proporcional, también para fracaso o abandono; cero aprendizaje como resultado válido. Registro append con ID/estado, alcance y evidencia; promover en fuente canónica y distribuir por adaptador. No vaciar una bandeja entera cuando podrían existir entradas nuevas ajenas a la retro.

**Prueba:** feature limpia, feature bloqueada y dos lecciones concurrentes. La primera no inventa; la segunda aprende sin declarar éxito; la tercera conserva ambas entradas y solo promueve lo aprobado.

<!-- skill:review-patterns -->
## S24 · review-patterns — catálogo útil; detectores heurísticos no son gates · P1

**Fuente primaria:** [.claude/skills/review-patterns/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/review-patterns/SKILL.md).

**Aporta:** separa calidad y rendimiento; defiende cambios reversibles y comportamiento estable. Las referencias pueden servir para orientar una investigación.

**Crítica:** **D**, el detector de complejidad cuenta tokens léxicos en el fichero, incluso comentarios, y usa umbrales distintos del catálogo. R11 obtiene FAIL y complejidad 42 en un fichero solo de comentarios. No es complejidad ciclomática por función ni cubre igual todos los lenguajes anunciados. R14 clasifica `Map.get()` en un bucle como query; no hay I/O.

La sugerencia automática de `Promise.all` ignora dependencias, límites de concurrencia y escrituras ordenadas. Un N+1 o I/O síncrono no es Critical en cualquier contexto; depende de volumen, ruta crítica y presupuesto. Los scripts devuelven exit 0 aunque reporten fail: utilizable como informe, peligroso si se interpreta como gate.

**Cambio propuesto:** llamar a las salidas “candidatos”; requerir perfil/consulta real antes de atribuir degradación. Adoptar analizadores del stack para métricas reales y concurrencia acotada cuando se justifique. Reutilizar un walker portable que gestione symlinks y errores.

**Prueba:** Map local, consulta real, bucle dependiente, código Python y comentarios con keywords. Medir precisión y recall por clase, y mejora funcional de la propuesta; no número bruto de avisos.

<!-- skill:scope -->
## S25 · scope — fuerte en producto; preguntas y documentación sobredimensionadas · P2

**Fuente primaria:** [.claude/skills/scope/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/scope/SKILL.md).

**Aporta:** problema, resultado observable, AC, alcance y reutilización de specs aprobados. Esta información reduce cambios equivocados antes de gastar en implementación.

**Crítica:** **D**, conviven rangos y mínimos de preguntas con reglas posteriores más pequeñas; se conservan modos que `/flow` declara retirados. La oposición rígida QUÉ/CÓMO puede borrar una restricción técnica que sí es requisito: Windows/macOS, stack contractual o integración ya elegida. Esa eliminación reaparece luego como falta de justificación en tech-plan.

**H**, usar una aprobación en menos de dos minutos como señal de teatro confunde rapidez con mala revisión. Tres perspectivas por complejidad tampoco garantizan que falte información. Confirmar el slug y producir un documento grande por una mejora pequeña añade trabajo que no prueba calidad.

**Cambio propuesto:** problema+AC+restricciones duras como contrato mínimo, preguntas sin cuota y separación entre requisito técnico y preferencia implementativa. Un solo esquema de modos/omisiones compartido. Reutilizar autorización y contexto, pedir decisiones sobre contenido, no sobre mecánica interna.

**Prueba:** brief completo con Windows/macOS y stack fijado, brief ambiguo y cambio pequeño con gran riesgo. El spec debe conservar restricciones y generar solo preguntas que afecten al resultado.

<!-- skill:security-audit -->
## S26 · security-audit — necesaria; cobertura anunciada mayor que la efectiva · P1

**Fuente primaria:** [.claude/skills/security-audit/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/security-audit/SKILL.md).

**Aporta:** controles en boundaries, authz, sesiones y rotación de secretos antes de limpiar historial. La referencia de profundidad añade rigor a una simple lista de patrones.

**Crítica:** **D**, enumera el Top 10 antiguo sin fijar edición; OWASP publicó Top 10:2025 con categorías diferentes [E09]. No basta cambiar números: supply chain y condiciones excepcionales necesitan escenarios. El ejemplo MongoDB `{field: value}` no es seguro por forma si `value` admite objetos con operadores sin validación. “CORS abierto = High” requiere contexto de credenciales y datos.

El escáner imprime parte del valor detectado, ampliando su exposición en logs/contexto (R13, con dato sintético). Ruta inexistente aparece como cero hallazgos exitosos (R12). Extensiones y tokens soportados no coinciden completamente con la tabla; `.env.local` puede escapar del filtro. No confundir este script con el hook, que tiene exclusiones aún mayores.

**Cambio propuesto:** alcance/edición explícitos, threat model y evidencia de explotación/impacto antes de asignar gravedad. Redactar valores; estados scanned/skipped/error; detección por contenido y tests positivos/negativos. Conservar rotación y autorización para reescribir historia, evitando presentar `filter-branch` como primera receta.

**Prueba:** secreto sintético en `.env.local`, input Mongo objeto, token desconocido, directorio ilegible y falso ejemplo documentado. Nunca concluir “seguro” por cero coincidencias.

<!-- skill:skill-advisor -->
## S27 · skill-advisor — problema de datos demostrado; cuestionar ratificación rutinaria · P1

**Fuente primaria:** [.claude/skills/skill-advisor/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/skill-advisor/SKILL.md).

**Aporta:** propone una lista limitada y permite completar el filtro léxico semánticamente. El empate determinista facilita reproducir cambios.

**Crítica:** **D**, `loadSkillsFromDisk` solo captura la primera línea de description: **31 de 32** quedan como `|` o `>` (R01). Solo captura la primera línea de Keywords; pierde continuaciones que el hook sí maneja. El código promete descripciones y entrega marcadores YAML. Ambos loaders leen todo el fichero y después hacen slice; el límite no acota lectura física.

**H**, desempatar por uso histórico favorece lo popular y puede perpetuar infraactivación de skills nuevas. Pedir ratificación cuando hay dos opciones claramente pertinentes traslada una selección rutinaria al usuario. Una línea de modelo/effort siempre, incluso cuando no cambia, añade ruido. “Activación nativa ~0%” necesita versión, sesiones elegibles y denominador verificable.

**Cambio propuesto:** parser compartido con YAML multiline, CRLF y precedencia local/global comprobada; IDs del frontmatter; escenarios semánticos retenidos. Activación automática para capacidades ya autorizadas, preguntas solo si cambia coste/alcance de forma material.

**Prueba:** 32 descripciones reales, keywords envueltas, skill local homónima y consulta con negación. Medir precisión/recall y utilidad del trabajo final; activar más no es el objetivo.

<!-- skill:tdd-design -->
## S28 · tdd-design — conservar oráculos; desbloquear el protocolo de aprobación · P1

**Fuente primaria:** [.claude/skills/tdd-design/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/tdd-design/SKILL.md).

**Pasajes de contraste:** [SKILL.md:L38](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/tdd-design/SKILL.md#L38) · [SKILL.md:L199](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/tech-plan/SKILL.md#L199).

**Aporta:** invariantes, contraejemplos mínimos, fixtures y separación de validación conductual. Son mejoras plausibles y respaldadas en contextos concretos [E05].

**Crítica:** **D**, rechaza tasks no aprobadas, pero tech-plan exige invocarla antes de devolver tasks al gate humano. El flujo 2→2.5→aprobación conjunta no satisface esa precondición. Además, clasificar Markdown/config como solo validación de comportamiento puede omitir tests ejecutables sobre hooks, permisos o un CLI descrito en Markdown. La decisión debe basarse en efecto, no extensión.

La cifra 23–37% sí aparece como ganancia relativa en la versión 1 del paper citado: **no es inventada**. La versión 2, de mayo de 2026, cambia framing y resultados. El problema es usar la URL móvil y generalizar un sistema experimental PGS a cualquier adopción de PBT. No se ha probado ese uplift en Poneglyph.

**Cambio propuesto:** diseñar el oráculo sobre borrador suficientemente definido, aprobar tasks+oráculo juntos y ejecutar después; pruebas por riesgo y comportamiento. Versionar citas y distinguir % relativo, puntos porcentuales y métrica.

**Prueba:** completar el pipeline sin aprobación circular; introducir config que rompe carga de hooks y confirmar que el oráculo ejecuta el contrato; verificar que PBT detecta un contraejemplo no reflejado en tests de ejemplo.

<!-- skill:tech-plan -->
## S29 · tech-plan — DAG útil; eficiencia obligatoria y contrato circular · P1

**Fuente primaria:** [.claude/skills/tech-plan/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/tech-plan/SKILL.md).

**Pasajes de contraste:** [SKILL.md:L199](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/tech-plan/SKILL.md#L199) · [SKILL.md:L38](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/tdd-design/SKILL.md#L38).

**Aporta:** dependencias explícitas, contexto del repositorio, versiones verificadas y criterios por HU. Una buena descomposición permite verificar e integrar sin perder el objetivo.

**Crítica:** **D**, Step 13 exige tdd-design antes de presentar para aprobación mientras tdd-design pide aprobación previa (S28). La exigencia de al menos 50% de eficiencia paralela tiene definiciones que varían entre cuerpo y referencia; un denominador de “operaciones que podrían ir en paralelo” puede ser cero. Detener un plan secuencial correcto por esa cifra no mejora el producto.

**H**, umbrales fijos por número de ficheros/dependencias y cuotas de ejemplos favorecen fragmentación artificial. Asumir política `auxiliary` cuando no existe test-policy puede rebajar la validación de código sensible. Exigir una herramienta documental específica cuando otra fuente primaria está disponible crea una dependencia innecesaria.

**Cambio propuesto:** un DAG correcto, sin rendimiento mínimo ficticio; duración/coste medidos después. Política de tests del repo y riesgo del cambio, sin inferir “auxiliary” de la ausencia de fichero. Unir contrato de aprobación con S28 y actualizar ejemplos de referencias a la misma doctrina.

**Prueba:** migración estrictamente secuencial, plan pequeño con auth y repo sin test-policy. Deben obtener plan válido y comprobaciones suficientes sin inventar paralelismo ni saltar gates funcionales.

<!-- skill:unstuck -->
## S30 · unstuck — conservar cambio de técnica; no confundir esfuerzo con diagnóstico · P2

**Fuente primaria:** [.claude/skills/unstuck/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/unstuck/SKILL.md).

**Aporta:** identifica lo intentado, evita repetición y pide cambiar de técnica. Es más útil que repetir la misma orden con mayor énfasis.

**Crítica:** **D**, promete “subir a xhigh”, pero el perfil global ya usa xhigh; en ese caso no hay uplift de esfuerzo. En otro host el frontmatter puede no tener esa semántica. El catálogo de diagnóstico al que remite contiene un helper roto (S09).

**H**, dos errores iguales pueden ser espera legítima de un sistema externo; dos distintos pueden compartir una causa. Contar repeticiones sin distinguir progreso y error impide una buena stopping rule. Pasar de una búsqueda a skill-advisor→ratificación puede agravar la interrupción precisamente cuando se necesita un intento concreto.

**Cambio propuesto:** presupuesto restante, estado reproducible y evidencia nueva como criterios; registrar técnica cambiada. Proponer experimento de diagnóstico con resultado discriminante. Escalar al usuario solo cuando información/capacidad externa impida seguir, no cuando se agote una etiqueta de esfuerzo.

**Prueba:** fallo determinista, dependencia temporal y bug con hipótesis errónea. Comprobar que cambia la hipótesis o el experimento, no solo la verbosidad; timeout total acotado.

<!-- skill:verify -->
## S31 · verify — conservar como pieza central; prueba real y proporcional · P1

**Fuente primaria:** [.claude/skills/verify/SKILL.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/verify/SKILL.md).

**Aporta:** exige observación del comportamiento cuando hay runtime, checks del proyecto, barrido de impacto y riesgo residual. Es de las piezas con conexión más directa con el resultado final.

**Crítica:** **D**, “ningún check fallido, sin excepciones” no distingue baseline roto, infraestructura ausente o regresión nueva. Se cruza con la prohibición global de suites completas no solicitadas en repos compartidos; la referencia de pr-review sí introduce esa excepción. Falta una única regla que todos consuman.

**H**, reejecutar los mismos checks con el mismo estado después de build y critic puede gastar tiempo sin aportar evidencia nueva. “Conducir el flujo real” debe significar una prueba controlada; no ejecutar una operación sobre datos reales solo para demostrarla. Tests diseñados por el autor necesitan validar su oráculo, no únicamente que estén verdes.

**Cambio propuesto:** checks según impacto y contrato del repo, resultado ligado al estado exacto, separar no-ejecutado/fallo de infraestructura/fallo de producto. Reusar resultados cuando inputs y entorno no cambien. Runtime con fixtures y efectos autorizados, conservación de evidencia.

**Prueba:** suite verde con comportamiento roto, baseline rojo, datos compartidos y cambio solo documental. El sistema debe descubrir el primero y describir honestamente los demás sin inventar un éxito ni lanzar trabajo dañino.

<!-- private-skill:S32 -->
## S32: private workspace knowledge (historical summary)

The original company-specific assessment is preserved in private Work memory.
Transporting Markdown does not make an external CLI portable. Verify actual
host capabilities and project paths. Keep workspace facts in the private addon;
do not inject them into every session or infer a benchmark from estimates.
