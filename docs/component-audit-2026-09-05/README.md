> Current PR #3 implementation: [scope, contracts and verification](../../.claude/docs/pr3-review.md). The report below describes the original audit. Nine inventory records and two private skill assessments are now redacted. `reproduce.ts` and `verify-coverage.py` fail explicitly with exit 2 rather than certify a changed or incomplete historical snapshot. Original private evidence is preserved outside this public repository. The remaining findings are not all fixed by this PR.

# Auditoría crítica de Poneglyph

**Actualización:** [revisión de los cambios posteriores en main 802d795](review-main-802d795.md), con ocho observaciones reproducibles y valoración de los planes 032/033 y la auditoría del ecosistema. Las cifras del informe original siguen fijadas a su base histórica.

**Fecha:** 2026-09-05. **Base:** [`ecd56cf37229afddce1e29f40b24b82c2dc8f724`](https://github.com/MaciWP/claude-code-poneglyph/tree/ecd56cf37229afddce1e29f40b24b82c2dc8f724). Esta es una revisión independiente de main; no presupone las correcciones de las PR [#1](https://github.com/MaciWP/claude-code-poneglyph/pull/1) y [#2](https://github.com/MaciWP/claude-code-poneglyph/pull/2).

**Mi opinión:** Poneglyph contiene buenas prácticas recuperables: comprobación de hechos, criterios de aceptación, diagnóstico, conocimiento específico de equipo y separación de configuración global/local. Su principal debilidad es que convierte demasiadas heurísticas en obligaciones, mientras algunos mecanismos que deberían comprobarlas tienen contratos defectuosos. Más instrucciones, agentes o tests no demuestran mejor código. Primero arreglaría la medición y las transiciones del flujo; después reduciría el perfil global y mediría qué componentes aportan calidad por coste y por tiempo.

Sí puede ayudar a desarrollar mejor. No hay datos propios suficientes para afirmar que esta configuración sea superior al agente nativo, que mejore a todos los modelos o que permita ser «el mejor desarrollador». Los estudios externos encuentran tanto mejoras como degradaciones, con condiciones diferentes. La mejora de Poneglyph debe demostrarse sobre resultados funcionales de tareas retenidas.

## Lectura y cobertura

| Documento | Contenido |
|---|---|
| [Skills](skills.md) | Las **32 skills**, individualmente: aportación, crítica, cambio y aceptación |
| [Comandos y hooks](commands-and-hooks.md) | Los **5 comandos Markdown**, el ejecutable de sincronización, los **5 hooks**, su lector y helpers ejecutables de las skills |
| [Evidencia](evidence.md) | 13 referencias/grupos de fuentes primarias, versiones, resultados positivos/negativos y límites |
| [Experimento y backlog](experiment-plan.md) | ABC con presupuesto, autonomía, métricas y secuencia de corrección |
| [Inventario](inventory.md) / [JSON](inventory.json) | Los **231 ficheros** de los tres directorios, con hash, propietario, enlace y nivel de revisión |
| [Sondas](reproduce.ts) / [resultado](reproduction-results.json) | 15 observaciones reproducibles sin modelos ni mutación global |
| [Verificador de cobertura](verify-coverage.py) | Detecta componentes omitidos, entradas duplicadas y drift respecto a la base |

Se leyeron íntegramente los 32 SKILL.md, los cinco comandos, sync-claude.ts, los cinco hooks, el lector compartido y los helpers TypeScript de producción de las skills. Las referencias, ejemplos, plantillas y tests se inventariaron y se examinaron estáticamente, con lectura focalizada de las referencias citadas. **No se afirma revisión semántica línea por línea de todos los ficheros de soporte.** El inventario permite distinguir estos niveles y no oculta archivos sin hallazgos. Tampoco es una auditoría completa de workflows ni de scripts situados fuera de los tres directorios.

Hay 211 ficheros en skills (1.365.734 bytes), ocho en commands (81.515) y doce en hooks (89.145). Es tamaño en disco, **no tokens inyectados por turno**: la carga es progresiva y dependiente del host. No se estima coste de inferencia sumando el tamaño del repositorio.

## Dónde dedicar el esfuerzo

| Orden | Problema | Evidencia y consecuencia | Cierre verificable |
|---|---|---|---|
| 1 | Instrumentos que dan señales falsas | Ranker pierde 31/32 descripciones; helper roto; ruta de scan inexistente parece limpia; eval puede puntuar un proceso fallido | R01/R03/R12 corregidas; grader rechaza fallo, vacío y timeout |
| 2 | Contratos del flujo incompatibles | tech-plan requiere tdd-design antes de aprobación, pero tdd-design rechaza draft; critic tiene veredictos solapados; build cierra antes del gate final | Tabla de estados única y pruebas de transición, incluido fallo tardío |
| 3 | Instalación y recuperación global | Backups colisionables, errores parciales anunciados como éxito, unlink no restaura; raíz macOS para entrada Windows | Restauración de bytes/tipo de entrada y fallo recuperable en ambos SO |
| 4 | Hooks cuyo efecto no corresponde al nombre | PostCompact imprime sin canal de contexto; InstructionsLoaded no acredita uso de skill; security-gate advierte después del efecto y excluye tipos relevantes | Canarios nativos por evento, telemetría adecuada y cobertura explícita |
| 5 | Reglas globales sin beneficio medido | Cuotas de preguntas, LEARN, heavy/panel, umbrales numéricos y reglas de equipo | Ablation con calidad funcional, coste y tiempo; mover especificidad a perfil local |
| 6 | Helpers que deforman datos o exposición | Donut vacío=1, contraste insuficiente, HTML raw y valor de secreto en stdout | Datos fieles, límites de confianza y redacción comprobados |

La prioridad P1 no significa vulnerabilidad crítica explotada ni emergencia productiva. Significa que corregir ese contrato tiene valor previo a optimizar prompts. **D** identifica defecto observado/contradicción; **H**, hipótesis de impacto no medida. Ninguno implica un porcentaje de pérdida de calidad inventado.

## Verificación realizada

- Suite existente: **384 pass, 0 fail, 741 expectativas, 22 ficheros**, Bun **1.4.0**, Linux.
- Sondas: **15/15 observaciones reproducidas** con fixtures y funciones locales. Exit 0 de reproduce.ts significa «síntomas reproducidos», no «producto correcto».
- No se hicieron llamadas a modelos, mediciones de suscripciones, instalaciones globales ni pruebas nativas en Windows/macOS. Esas validaciones están propuestas, no acreditadas.

Desde la raíz del repositorio, con Bun y Python 3 instalados:

```sh
bun docs/component-audit-2026-09-05/reproduce.ts
python3 docs/component-audit-2026-09-05/verify-coverage.py
```

En Windows se puede usar `py -3` en lugar de `python3`. La comprobación de cobertura usa Git y la biblioteca estándar de Python. Las sondas están escritas con APIs portables, pero su ejecución aquí solo está verificada en Linux. Tras corregir un componente es normal que su observación deje de reproducirse; se debe convertir en una regresión del comportamiento correcto, no forzar que esta auditoría siga pasando.

## Qué propone cambiar esta PR

Publica crítica trazable, prioridades, aceptación y código para reproducir/contabilizar la revisión. No modifica los perfiles operativos ni mezcla todas las correcciones en un único cambio: eso impediría atribuir el resultado a un componente. La PR #1 ya propone correcciones técnicas y la #2 implementa el laboratorio; al integrarlas, cada hallazgo debe marcarse resuelto con SHA y evidencia, o mantenerse abierto. El siguiente paso medible está definido en [el experimento](experiment-plan.md).
