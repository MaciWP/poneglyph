# Evidencia contrastada y límites de inferencia

Consulta: **5 de septiembre de 2026**. Para papers se indica versión, porque una URL sin versión puede cambiar resultados. Documentación de proveedor acredita contrato publicado, no que nuestra instalación lo cumpla. Un preprint o una cifra del autor no es una réplica independiente. Los resultados externos no miden Poneglyph.

<a id="e01"></a>
## E01 · Contexto que no mejora el resultado

[Evaluating AGENTS.md, v2, 23-06-2026](https://arxiv.org/abs/2602.11988v2) evalúa tareas SWE-bench y repos con contexto escrito por desarrolladores. Reporta que los context files no mejoran generalmente el éxito y elevan el coste de inferencia más del 20% de media; reconoce utilidad de prácticas no estándar. **Límite:** configuraciones, tareas y agentes concretos; no demuestra que todo AGENTS.md perjudique ni que eliminar Poneglyph vaya a mejorar tus resultados. **Aplicación propuesta:** ablation de reglas generales frente a información específica del repo. El efecto en Poneglyph es una hipótesis.

<a id="e02"></a>
## E02 · Contexto que reduce tiempo, con calidad aún no establecida

[On the Impact of AGENTS.md, v2, 30-03-2026](https://arxiv.org/html/2601.20404v2) estudia 124 PR de 10 repos. Mediana de wall-clock: −28,64%; tokens de salida: −16,58%. El artículo excluye una evaluación exhaustiva de corrección y hace un sanity check sobre 50 tareas. **Límite:** no equivale a “misma calidad funcional demostrada”; tampoco significa reducción del mismo porcentaje en tokens totales o factura. No contradice automáticamente E01: cambian tareas, instrumentos y endpoints. **Aplicación:** medir calidad funcional junto a coste/tiempo, no usar tokens de salida como sustituto del éxito.

<a id="e03"></a>
## E03 · Mejora del harness con resultados funcionales

[Agentic Harness Engineering, v4, 18-05-2026](https://arxiv.org/abs/2604.25850v4): diez iteraciones elevan pass@1 de 69,7% a 77,0% en Terminal-Bench 2 (**+7,3 puntos**, no +7,3% relativo); reporta transferencia a SWE-bench Verified con 12% menos tokens que el seed. Las ablaciones sitúan el aporte en herramientas, middleware y memoria, antes que system prompt. [Código y prompts de los autores](https://github.com/china-qijizhifeng/agentic-harness-engineering). **Límite:** resultados publicados por autores, no replicados aquí; no es un fichero mágico de configuración ni una comparación de tus suscripciones. **Aplicación:** cambios reversibles, predicción falsable por componente y evaluación del resultado siguiente.

<a id="e04"></a>
## E04 · Cómo evaluar agentes

[Anthropic, Demystifying evals for AI agents, 09-01-2026](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) distingue tarea, trial, trayectoria, grader y estado final. Propone combinar verificaciones de código, jueces con rúbricas y revisión humana; repetir trials y calibrar instrumentos. **Límite:** guía de ingeniería, no uplift garantizado ni prueba de cero falsos positivos de los tests. **Aplicación:** un proceso que sale mal no se convierte en éxito por escribir una frase correcta; los AC se verifican sobre el artefacto final. Los checks deterministas también necesitan un oráculo correcto. Mantener casos positivos/negativos del grader y separar errores de infraestructura.

<a id="e05"></a>
## E05 · PBT: cifra real, versión y alcance mal preservados

[PGS v1, 23-06-2025](https://arxiv.org/abs/2506.18315v1) sí reporta ganancias **relativas** de pass@1 de 23,1%–37,3% sobre métodos TDD. Por tanto, no acusamos a Poneglyph de inventar ese número. [PGS v2, 01-05-2026](https://arxiv.org/abs/2506.18315v2), con título y framing revisados, anuncia mejora de hasta 13,4% en pass@1 y reparación de más del 64% de fallos iniciales. **Límite:** son resultados de un sistema y benchmarks específicos; no “PBT mejora cualquier proyecto un 23–37%”. No deben combinarse cifras de versiones como si midieran exactamente lo mismo. **Aplicación:** invariantes y contraejemplos mínimos como técnica candidata; fijar versión y experimento al citar magnitudes.

<a id="e06"></a>
## E06 · Contrato actual de hooks y skills de Claude Code

[Hooks oficiales](https://code.claude.com/docs/en/hooks): `PostCompact` no incorpora stdout de texto como contexto; `InstructionsLoaded` observa CLAUDE.md/reglas. Hooks coincidentes se ejecutan en paralelo. Exit 2 puede bloquear más eventos que PreToolUse/PermissionRequest. Async no controla decisiones, pero ciertos resultados estructurados se entregan posteriormente. Handlers idénticos entre settings se deduplican, con excepciones de scope.

[Skills oficiales](https://code.claude.com/docs/en/skills): frontmatter y carga dependen del host; actualmente `when_to_use`, `paths` y `effort` están documentados para Claude Code. No los marcamos inválidos basándonos en documentación antigua. La portabilidad a otras superficies admite un conjunto diferente. **Aplicación:** corregir referencias antiguas y validar evento/versionado instalado; un unit test de stdout no sustituye el test nativo. **Límite:** no se ejecutaron CLIs nativas aquí.

<a id="e07"></a>
## E07 · Grok Build no es un clon del contrato Claude

[Settings, actualizado 12-08-2026](https://docs.x.ai/build/settings) documenta GROK_HOME, configuración de modelos y `grok inspect`; la configuración de proyecto solo cubre ciertas áreas. [Headless & scripting](https://docs.x.ai/build/cli/headless-scripting) documenta ejecución automatizada y selección de modelo. **Aplicación:** no asumir single-model ni trasladar todos los settings de usuario a `.grok/config.toml`. Capturar modelo efectivo y configuración cargada antes de la prueba. **Límite:** documentación no prueba disponibilidad de cada modelo en la suscripción del usuario ni igualdad de permisos/herramientas entre planes.

<a id="e08"></a>
## E08 · Permisos e aislamiento son capas diferentes

[Permisos Claude](https://code.claude.com/docs/en/permissions) y [sandboxing](https://code.claude.com/docs/en/sandboxing) distinguen aprobación de herramientas de restricciones de filesystem/red a nivel OS. La configuración y soporte varían por plataforma. **Aplicación:** symlinks fuera o reglas locales no acreditan aislamiento de procesos. Probar acceso con ficheros sintéticos y declarar qué capa se está midiendo. **Límite:** aquí no se ha demostrado evasión de permisos en una instalación nativa ni se ha utilizado ningún secreto real.

<a id="e09"></a>
## E09 · Seguridad: referencia versionada

[OWASP Top 10:2025](https://owasp.org/Top10/2025/) ya incluye categorías actualizadas, como fallos de supply chain y manejo de condiciones excepcionales. La lista de Poneglyph corresponde al esquema anterior sin indicar edición. **Aplicación:** mantener mapeo de edición y escenarios por amenaza; no renumerar la tabla y declarar completada la seguridad. **Límite:** Top 10 es una lista de concienciación; ni su checklist ni regex acreditan ausencia de vulnerabilidades.

<a id="e10"></a>
## E10 · Contraste medible frente a preferencias estéticas

[W3C, WCAG 2.2, contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): umbral AA de 4,5:1 para texto normal; 3:1 para texto grande, con sus excepciones. R09 aplica luminancia sRGB al token de estado y fondo real del generador: 3,019:1, insuficiente para el verdict de texto pequeño. **Límite:** es una medición de esos colores, no auditoría visual completa de todos los modos. Prohibir purple, cards o cierto serif es gusto de diseño, no criterio WCAG.

<a id="e11"></a>
## E11 · Multiagente: fallos de verificación no dan una regla universal de participantes

[MAST, Why Do Multi-Agent LLM Systems Fail?, v2](https://arxiv.org/html/2503.13657v2) estudia fallos de especificación, alineación y verificación. Sus intervenciones muestran resultados dependientes de modelo y configuración; no justifican una ley “un agente prohibido, cuatro óptimo”. [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) ofrece patrones simples y también usos válidos de paralelismo y evaluación iterativa, con tradeoffs.

**Aplicación:** el paper no demuestra una tasa universal del 80% de falsos positivos de jueces. La cifra 23,5% citada internamente no se revalida aquí como denominador general; clasificar tipos de fallo no es medir el efecto causal de quitar un panel. El propio W1 del repo reconoce que el umbral ≥4 es convención sin óptimo medido. Mantener esa cautela en las skills consumidoras.

<a id="e12"></a>
## E12 · Datos más recientes de uso profesional, sin confundir percepción y causalidad

[METR, encuesta 11-05-2026](https://metr.org/blog/2026-05-11-ai-usage-survey/): 349 trabajadores técnicos, incluidos 87 ingenieros de software; mediana autodeclarada de 1,4–2× en valor y 3× en velocidad. METR explica motivos para dudar de magnitudes altas. **Límite:** encuesta y muestra seleccionada, no ensayo causal sobre tu configuración. No reutilizamos resultados de herramientas de 2025 como predicción exacta de modelos de septiembre de 2026. **Aplicación:** medir valor entregado y retrabajo, además de la sensación de rapidez.

<a id="e13"></a>
## E13 · Referencia de implementación sencilla

[mini-swe-agent, repositorio de sus autores](https://github.com/SWE-agent/mini-swe-agent) expone un agente pequeño, ejecución por shell, adaptadores y trayectorias inspeccionables. Publica resultados de benchmark; **no usamos su headline como comparación controlada con Poneglyph**, porque modelo, presupuesto, entorno y tareas deben igualarse. **Aplicación:** baseline pequeño y trazabilidad reproducible, no cantidad de skills como indicador de madurez. “Pequeño” no elimina la necesidad de entorno, límites y evaluación.

## Qué copiar de proyectos de éxito y qué no

| Referencia | Idea transferible | Cómo podríamos estropearla |
|---|---|---|
| AHE [E03] | Edit→predicción→resultado, componente reversible | Optimizar sobre las mismas tareas y vender sobreajuste como mejora general |
| mini-swe-agent [E13] | Baseline simple, trayectoria visible y adaptadores | Confundir pocas líneas con aislamiento seguro o soporte Windows probado |
| Guía de evals [E04] | Oráculo sobre resultado y repeticiones | Puntuar prosa de “hecho” en lugar de ejecutar AC |
| PGS [E05] | Invariantes y contraejemplo mínimo | Hacer que el mismo modelo invente tests que validen su propio error |
| Estudios AGENTS.md [E01] / [E02] | Comparar con/sin contexto y medir por endpoint | Elegir solo el estudio favorable o confundir salida corta con mejor solución |

## Auditoría de cifras internas

| Cifra/regla | Estado en esta revisión | Tratamiento correcto |
|---|---|---|
| 384 tests / 741 expectativas | Observado localmente, Bun 1.4.0 Linux | Cobertura del software auxiliar existente, no prueba de calidad del modelo |
| 15/15 observaciones de reproduce.ts | Observado con fixtures y funciones locales | Confirma síntomas concretos; no suma quince pérdidas porcentuales de calidad |
| 31/32 descripciones mal parseadas | Observado con skills reales | Reparar entrada del ranker antes de calibrar selección |
| ~2%, 2/54, 1/9 de adopción histórica | Citas del repo; logs originales no reanalizados | No mezclar periodos/versiones ni tratar denominadores estimados como oportunidades verificadas |
| 65/70/75 de confianza; 70/80 de prompt | Heurísticas sin calibración localizada | No expresarlas como probabilidad de éxito |
| ≥50% paralelismo; ≥4 agentes | Convenciones con contradicciones locales | Probar ablation por tarea; no leyes empíricas |
| 0% FP determinista; ~80% FP juez | Generalización no acreditada | Graders con positivos/negativos, gold labels y precisión/recall |
| 5–10× graphify; 2–5K por handoff | Estimaciones sin benchmark comparable aportado | Registrar gasto total y amortización, no repetirlas como garantía |

No asignamos una nota global a Poneglyph. Una media entre estilo, seguridad y utilidad ocultaría problemas incompatibles entre sí. La conclusión verificable es que hay contratos defectuosos y buenos mecanismos recuperables; la magnitud del beneficio de cambiarlos se determina con el experimento.

[E01]: #e01
[E02]: #e02
[E03]: #e03
[E04]: #e04
[E05]: #e05
[E06]: #e06
[E07]: #e07
[E08]: #e08
[E09]: #e09
[E10]: #e10
[E11]: #e11
[E12]: #e12
[E13]: #e13
