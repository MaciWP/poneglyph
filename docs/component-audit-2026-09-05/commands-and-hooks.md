# Comandos, hooks y código auxiliar

Esta revisión distingue intención, contrato documentado y ejecución observada. P1/P2/P3 son prioridades, no puntuaciones de calidad. Los identificadores R remiten a [resultados reproducibles](reproduction-results.json); los E a [fuentes externas](evidence.md). Los enlaces al código se fijan al commit auditado.

<!-- command:commit-message -->
## C01 · /commit-message · P2

**Fuente primaria:** [.claude/commands/commit-message.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/commands/commit-message.md).

**Conservar:** prioridad de staged, respeto del index, mensaje basado en diff y separación entre redactar y ejecutar. El comando no hace `git add` ni commit.

**Problemas:** la descripción “nunca ejecuta git” es falsa literalmente: necesita ejecutar git de solo lectura. Debe decir “no muta Git”. Recoge diff staged y unstaged aunque solo necesita uno; en un árbol grande duplica lectura. No detecta ficheros untracked como trabajo no incluido, así que un usuario puede creer que el mensaje representa todos sus cambios. La preferencia de capitalización/ticket puede contradecir la convención observada: una regla universal y un “imita al repo” no tienen precedencia clara. Clasificar todos los lockfiles/settings como sensibles mezcla ruido administrativo con secretos.

**Acción:** comprobar primero staged y leer solo el diff elegido; informar untracked relevantes como no incluidos. Respetar la plantilla/política del repo. No describir cambios no seleccionados ni afirmar checks que este comando no ejecuta. Mantener ausencia de atribución adicional por defecto.

**Prueba propuesta:** staged A, unstaged B y untracked C. El mensaje describe A y avisa del resto sin incorporarlo. Repositorio vacío: salida clara sin inventar estilo a partir de un git log fallido.

<!-- command:pr-description -->
## C02 · /pr-description · P1

**Fuente primaria:** [.claude/commands/pr-description.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/commands/pr-description.md).

**Conservar:** comparación triple-dot, ticket opcional, contenido del diff y honestidad sobre tests añadidos.

**Problemas:** elegir `dev` si existe puede describir una PR contra otra base. La existencia de una rama no prueba el target de integración. “Cómo se ha probado” se rellena con tests del diff, pero el comando prohíbe ejecutar validaciones: añadir tests y ejecutarlos son evidencias distintas. Consultar `sqlmigrate` puede requerir entorno/dependencias y ejecutar inicialización del proyecto; no debe tratarse como lectura de texto garantizada. “Nunca ejecuta git” vuelve a ser impreciso. La plantilla exacta puede desplazar una plantilla de PR específica del repo.

**Acción:** usar la base real de la PR o la indicada por el usuario; para una propuesta nueva resolver y anunciar la base. Separar tests añadidos, ejecutados y pendientes. SQL solo con entorno apropiado o dejar el comando que debe ejecutar el revisor. Mantener el fallback ante Jira no disponible.

**Prueba propuesta:** repo con main, dev y release; PR contra release; tests añadidos pero nunca ejecutados. El documento no usa dev ni afirma “probado” por mera existencia de tests.

<!-- command:role -->
## C03 · /role · P2

**Fuente primaria:** [.claude/commands/role.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/commands/role.md).

**Conservar:** catálogo explícito, no adivinar roles desconocidos y reutilización de capacidades existentes.

**Problemas:** adoptar “senior” no demuestra experiencia ni mejora. `frontend` compone html-report, cuyo propio contrato excluye UI de producto. `architect` obliga a decide heavy y tech-plan antes de scope en el orden del catálogo; `advisor` y `shopping` también arrastran heavy aun en una consulta sencilla. `testing` compone fases que requieren artefactos de /flow aunque la petición sea revisar un test aislado. Persistencia hasta cambio manual puede contaminar el siguiente objetivo de otra naturaleza.

**Acción:** rol como lente contextual; seleccionar capacidades por tarea y precondiciones. Frontend debe distinguir producto, coherencia de UI e informe. Heavy por impacto y evidencia, no por etiqueta. Mostrar el rol solo cuando afecte a una decisión o cambie respecto al pedido.

**Prueba propuesta:** `/role frontend` seguido de arreglo de badge, `/role shopping` para una comparación trivial y `/role testing` sin plans/. Ninguno debe fabricar un pipeline, informe o panel ajeno al objetivo.

<!-- command:flow -->
## C04 · /flow · P1

**Fuente primaria:** [.claude/commands/flow.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/commands/flow.md).

**Conservar:** lifecycle reanudable, AC, dependencias, estados visibles y separación del veredicto propuesto por un workflow de la ratificación final.

**Problemas:** hereda el bloqueo tech-plan↔tdd-design (S28/S29), veredictos solapados de critic y cierre ambiguo de retro. Dice sin modos pero conserva flags legacy que se ignoran y workflows con `level`; la migración debe evitar que un flag parezca reducir trabajo cuando no lo hace. `max(plans)+1` no es reserva atómica en dos terminales. Reconstruir estado a partir de ficheros no permite reconstruir una aprobación humana perdida: existencia de artefacto no equivale a aprobación.

Los hard gates humanos hacen que el perfil completo no sea autónomo por defecto. Para un benchmark sin intervención deben preaprobarse el objetivo y los artefactos iniciales en todos los brazos o declararse la intervención como resultado. De otro modo se compara una política interactiva contra una autónoma. Los multiplicadores de coste/velocidad de workflows son estimaciones, no medidas del run actual.

**Acción:** esquema único de transiciones y precondiciones, evento de aprobación explícito, reserva de slug con exclusión mutua y recuperación que preserve “aprobación desconocida”. Capability mapping por host. No resolver incompatibilidades inventando APIs o aprobaciones.

**Prueba propuesta:** dos terminales creando feature, estado corrupto, respuesta de workflow incompleta y reviewer que falla. Cada feature queda identificada; ninguna aprobación se infiere y ninguna HU se cierra por una promesa de verde.

<!-- command:sync-claude -->
## C05 · /sync-claude (documentación) · P1

**Fuente primaria:** [.claude/commands/sync-claude.md](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/commands/sync-claude.md).

**Conservar:** preview, check, backup, distinción user/project y overlay de máquina. Explica que copiar no sincroniza cambios.

**Problemas:** presenta `--unlink` como “undo”, pero el programa retira enlaces, no restaura contenido anterior, no limpia settings generado ni copias. Para tu prueba ABC eso no produce un perfil limpio ni una recuperación completa. La lista de carpetas sincronizadas omite scripts y presenta rules/docs como enlaces de carpeta, aunque el código usa entradas individuales con exclusiones. La tabla Windows simplifica un algoritmo que intenta symlink si está disponible y junction después. El troubleshooting recomienda chmod/chown amplios sin probar que sean la causa.

**Acción:** definir diferencia entre unlink, uninstall y restore. Documentar método efectivo por entrada (junction de directorio y copia de fichero), propiedad de cada instalación y diff de settings. Usar el mecanismo transaccional del laboratorio para el experimento global, no `--unlink` como sustituto. La documentación debe salir del mismo manifiesto que el instalador.

**Prueba propuesta:** instalación por symlink, por junction/copia y con settings previos; cada ayuda explica lo que realmente queda tras unlink. Una restauración debe recuperar bytes y tipo de entrada.

<!-- executable-command:sync-claude.ts -->
## C06 · sync-claude.ts — revisión función por función de las rutas relevantes · P1

**Fuente primaria:** [.claude/commands/sync-claude.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/commands/sync-claude.ts).

No se ejecutó sincronización sobre el home real. Los siguientes defectos se obtienen por lectura del código; los tests existentes sí se ejecutaron.

| Superficie | Qué está bien | Fallo o límite | Cambio verificable |
|---|---|---|---|
| `getProjectRoot` | Intenta descubrir raíz | El primer package.json subiendo desde cwd puede pertenecer al proyecto consumidor; el comando global no queda anclado a su repo fuente | Raíz desde `import.meta.dir` o flag explícito; validar marcadores de Poneglyph |
| `getSystemInfo` / capability checks | Prueba real de enlaces Windows | En Unix asume symlink y solo comprueba escritura del home; incluso check/status dejan escrituras temporales | Probar en destino desechable y declarar efectos; capacidades por entrada |
| `normalizePath` | Normaliza separadores | Convierte a minúsculas también en filesystems sensibles a caso; dos destinos distintos pueden clasificarse iguales | Comparación de identidad real o normalización dependiente del filesystem |
| `detectLinks` / `computeLinkStatus` | Resuelve targets relativos; exclusiones por entrada | No todos los bucles usan la misma lógica para symlink roto; no hay manifiesto de propiedad para copias/entradas retiradas | Un clasificador común y manifiesto versionado |
| `expandFolderLinks` | Evita propagar test-policy y docs de máquina | No elimina entradas antiguas retiradas del source ni verifica todo el historial de instalaciones | Plan de reconciliación limitado a entradas propias |
| `deepMerge` | Conserva claves anidadas; arrays reemplazan | El overlay puede sustituir hooks/deny completos; no se valida que el JSON raíz sea un objeto ni el contrato semántico | Esquema y preview del diff efectivo; sustituciones explícitas |
| `generateSettings` | Separa base de overlay | Unlink antes de write no es atómico; backup con solo fecha se sobrescribe el mismo día; no hay rollback del conjunto | Temp+rename apropiado por OS, backup único y journal recuperable |
| `createSymlinks` | Trata junction de ficheros con copia; protege migración de rules/docs | Reemplaza contenido sin backup si no se solicita; errores de creación se imprimen y continúan. Backup por basename puede colisionar entre carpetas | Plan antes de mutar, backup con ruta relativa, error agregado y rollback |
| normalización rules/docs | Evita escribir por el antiguo enlace de carpeta | No conserva en un manifiesto el enlace completo sustituido y su propiedad | Guardar identidad previa antes de mutación y restaurarla en fallo |
| `generateSpTwin` | LF/CRLF y SSOT definidos | Escribe en el repo fuente como parte de instalar y no asegura directorio padre; una falta puede dejar instalación parcial | Prevalidar destinos, write atómico y tratar fallo como fallo de operación |
| `classifyGrokTwin` | Distingue copia correcta y stale | Comparación de copia byte a byte puede señalar diferencias solo de newline; hereda case folding para symlinks | Política de comparación consistente y prueba LF/CRLF |
| `printStatus` | Distingue ficheros de enlaces | Settings real se anuncia como generado correcto sin compararlo contra merge esperado; no prueba salud de copia | Hash/diff del contenido efectivo y estado stale verificable |
| `extractBunFilePath` / `collectHookEntries` | Comprueba existencia en caso simple | Regex no soporta bien rutas entre comillas/espacios; ignora comandos no reconocidos y puede acabar con cero hooks “correctos” | Inventario de todos los handlers; unsupported es estado explícito |
| `validateHooks` | Exit no cero si detecta ruta faltante | Existencia no demuestra ejecución, contrato de stdout, registro ni evento; cero reconocidos devuelve 0 | Validación estática + canario de evento en host nativo |
| `unlinkAll` | No sigue enlaces para borrar contenido fuente | Borra cualquier symlink en destinos detectados, incluso uno conflictivo de otro origen; no restaura settings/copias | Verificar ownership, restore desde manifiesto, conflicto no destructivo |
| `main` / parsing de argumentos | Guard non-interactive evita espera sin TTY | `method` se castea sin validar enum; flags incompatibles se resuelven por orden. Se imprime “Sync completed” pese a errores; catch final no fuerza exit no cero | Validar opciones antes de tocar disco y resultado estructurado de éxito parcial/fallo |

**Casos de aceptación prioritarios:** fallo tras el tercer cambio, dos backups el mismo día, fuente movida, destino ajeno, copia editada por usuario, nombres con espacios/Unicode, ruta case-sensitive, PowerShell/Git Bash y proceso matado durante el swap. Estos son requisitos para el instalador, no resultados afirmados de esta auditoría.

**Relación con PRs anteriores:** esta PR nace de main y no presupone las correcciones de la PR #1 ni la implementación del laboratorio de la PR #2. Los hallazgos deben resolverse o marcarse satisfechos al integrar esas ramas, con su SHA y test correspondiente.

<!-- hook:instructions-loaded -->
## H01 · instructions-loaded.ts — observabilidad parcial, no prueba de activación · P1

**Fuente primaria:** [.claude/hooks/instructions-loaded.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/hooks/instructions-loaded.ts).

**Conservar:** evento estructurado, identificador de sesión y no bloqueo de la tarea. No registra contenidos de instrucciones, solo metadatos.

**Problemas:** `InstructionsLoaded` documenta carga de CLAUDE.md y reglas [E06]. El comentario de `skill-activation.ts` usa este log como lado de “cargas” para medir honor-rate de skills: no prueba un `Skill()` ni que se haya aplicado su contenido. Tampoco demuestra efecto sobre el resultado. El formato de texto con espacios y sin escape hace ambiguas rutas con espacios/nuevas líneas. La política “no rotation” acumula logs en cada proyecto. Capturar error y seguir sin señal hace indistinguibles cero eventos y logger roto.

**Acción:** JSONL tipado con session/prompt/event/file, límite de tamaño y estado de logger. Activación de skills desde eventos de herramienta/transcript apropiados, con denominador de oportunidades y deduplicación. Seguimiento de calidad/coste por separado: carga ≠ uso ≠ beneficio.

**Prueba propuesta:** cargar regla, invocar skill, leer SKILL.md como dato y fallar una escritura de log. Deben distinguirse las cuatro situaciones. En headless comprobar flush/cierre sin atribuir eventos tardíos a otra prueba.

<!-- hook:post-compact -->
## H02 · post-compact.ts — reinyector sin canal de reinyección · P1

**Fuente primaria:** [.claude/hooks/post-compact.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/hooks/post-compact.ts).

**Conservar:** intención de recuperar restricciones relevantes tras compactación y ausencia de llamadas caras.

**Problema contractual:** solo hace `console.log(buildOutput())` y exit 0. `PostCompact` no está entre eventos que incorporan stdout de texto al contexto [E06]. Un test que encuentre “Lead Orchestrator” en stdout prueba la cadena generada, no que el modelo la vea. No se ha ejecutado una compactación nativa aquí; el fallo está contrastado contra el contrato publicado actual.

Además duplica gran parte de CLAUDE.md y conserva políticas de “este turno” y modelos que pueden divergir del núcleo. Aunque cambiemos el evento, reinjectar reglas idénticas que el host ya recarga puede tener coste sin información nueva.

**Acción:** retirar si es redundante o usar `SessionStart` con matcher `compact` para contexto realmente necesario y comprobarlo en host. Una única fuente de reglas y recordatorio mínimo del estado pendiente; no copiar la política completa.

**Prueba propuesta:** canario inocuo exclusivo del hook, compactación y transcript que confirme su recepción. Comparar con núcleo recargado sin hook. Registrar bytes añadidos y si cambia un comportamiento verificable, no solo la salida del proceso.

<!-- hook:security-gate -->
## H03 · security-gate.ts — advertencia útil; nombre y cobertura pueden dar falsa seguridad · P1

**Fuente primaria:** [.claude/hooks/security-gate.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/hooks/security-gate.ts).

**Conservar:** guard `stop_hook_active`, tail acotado y hallazgos por ubicación sin imprimir directamente el valor del secreto. Su comentario aclara que no bloquea; esa honestidad debe verse también en el inventario y la UX.

**Cobertura de secretos:** solo ciertas extensiones; excluye Python/TSX/`.env.local`, toda `.claude/`, Markdown y documentos identificados como OpenAPI (R04). Un secreto puede aparecer en cualquiera de ellos. Excluir un documento entero para evitar un ejemplo falso cambia recall por silencio, y la medición de “cero coste” sobre un repo no prueba que el riesgo futuro sea cero. Los ficheros se leen del working tree, aunque el secreto pudiera seguir staged y haberse limpiado solo en disco. Un commit previo al Stop puede dejar el árbol limpio y escapar del scan. `git diff --name-only` sin `-z` y `trim()` no preserva todos los nombres de fichero.

**Disciplina Git:** regex de intención reconoce “No hagas commit ni push” como permiso aparente y calla (R05). También acepta un permiso para commit como si autorizara cualquier mutación detectada. Solo recoge Bash, no herramientas nativas GitHub, PowerShell u otros hosts. Tira spans entre comillas, de modo que pierde ciertos comandos reales; primer destino externo puede ocultar otro local en el mismo comando. El tail puede no contener la petición original y producir un falso aviso de falta de permiso. Actuar en Stop siempre es posterior al efecto: no es prevención.

**Acción:** separar detector de secretos y advertencia de disciplina; nombres truthful. Escaneo staged/pre-commit o CI con redacción y detección mantenida; allowlists específicas de ejemplos. Autorización semántica del host, nunca derivada de substring. Tratar el analizador shell como heurística informativa, con límites claros. No ofrecer undo destructivo automático como solución general.

**Prueba propuesta:** staged distinto de disco, secreto en config, nombre Unicode/espacios, negación, autorización parcial y turno largo. Medir falsos positivos y falsos negativos, sin prometer cobertura total.

<!-- hook:skill-activation -->
## H04 · skill-activation.ts — hint acotado; ni matching semántico ni métrica de valor · P1

**Fuente primaria:** [.claude/hooks/skill-activation.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/hooks/skill-activation.ts).

**Conservar:** pre-gates lazy, silencio sin coincidencia, top 2, colapso de palabras contenidas y manejo de payload no humano. Son decisiones concretas para contener ruido.

**Problemas:** `includes()` no entiende negación, citas ni intención. “No ejecutes code review” genera hint de review en el fixture R02. La exclusión de slash commands omite variantes que quizá necesiten matching; debe definirse por contrato, no generalizar. Usa nombre de directorio en lugar del campo name. Graphify no tiene Keywords y no participa en este índice, aunque sí en activación nativa: son superficies distintas.

`readFileSync(...).slice(0,2500)` lee todo el fichero: HEAD_BYTES limita parsing, no I/O. No deriva Markdown de plugins ni todas las precedencias del host. El log omite session/prompt ID y el hint de routing; correlacionar tiempos con instrucciones-loaded no permite medir honor-rate fiable (H01). Sugerir modelo barato por “barre” puede infravalorar una auditoría de seguridad exhaustiva.

**Acción:** parser común con S27, matching probado contra negativos y salida tratada solo como sugerencia. Contabilizar coste del hook y adopción con IDs adecuados. Evaluar si una regla nativa breve produce mejor resultado que un hook por cada prompt.

**Prueba propuesta:** corpus retenido con typos, negación, texto citado, ambigüedad, español/inglés y directivas de seguridad. Medir precisión/recall y luego resultado final; más hints no es mejor.

<!-- hook:workspace-hint -->
## H05 · workspace-hint.ts — contexto útil, raíz incorrecta en Windows · P1

**Fuente primaria:** [.claude/hooks/workspace-hint.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/hooks/workspace-hint.ts).

**Conservar:** disparo condicionado al workspace y comandos de descubrimiento en vez de lista mutable de entornos.

**Problema demostrado:** reconoce separadores Windows pero devuelve una raíz macOS fija. R06 lo reproduce sin imprimir datos personales. Reconocer la entrada multiplataforma no hace portable el contenido inyectado. El matcher depende también de nombre/capitalización y posición de carpetas; un clone válido en otra ubicación no dispara. Usa cwd del proceso, sin leer payload del evento para contrastar el contexto.

**Acción:** resolver root desde marcador/configuración de equipo o descubrimiento ascendente; nombres propios y rutas fuera del núcleo global. Si no se puede resolver, dar orientación relativa y no inventar la raíz. Señalar capacidad de devenv verificada, no presunta.

**Prueba propuesta:** Windows/macOS, nombres con espacios, cambio de ubicación y workspace externo. Solo inyectar información correcta y mínima.

<!-- helper:hook-stdin -->
## H06 · lib/hook-stdin.ts · P2

**Fuente primaria:** [.claude/hooks/lib/hook-stdin.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/hooks/lib/hook-stdin.ts).

**Conservar:** API de stdin portable y centralizada. Evita duplicar adaptaciones de Bun/Windows.

**Límites:** no hay máximo de bytes ni deadline propio; acumula todo hasta EOF. Error equivale a cadena vacía, perdiendo diagnóstico. No valida esquema, responsabilidad que queda distribuida entre consumidores. El comentario versionado de `PostToolUseInput` puede divergir de herramientas cuya respuesta es estructurada, no string.

**Acción:** lector limitado con resultado discriminado y validadores por evento. Para hooks informativos, fallo sin bloquear con diagnóstico local; para controles, contrato explícito. Verificar EOF ausente, error de stream, Unicode y JSON grande en ambos OS. No añadir timeout interno arbitrario que mate payloads válidos sin medir tamaño/latencia.

## Registro global y compatibilidad

Los cinco handlers de settings están en este informe. Todos se lanzan mediante `bun $HOME/...` sin comillas: un home con espacios rompe el argumento en shell compatible con esa expansión. Confirmar que el shell real de Windows soporta el comando; PowerShell y Git Bash no son intercambiables. La presencia del fichero no comprueba eso.

La separación entre settings local hook-free y perfil global es un buen diseño de scope. El contrato actual documenta deduplicación de handlers idénticos entre settings; por tanto **no afirmamos que toda duplicación textual implique doble ejecución en todas las versiones** [E06]. Hay que probar combinación user/project/plugin y versión concreta.

El mínimo declarado de CLI y las referencias actualizadas a versiones posteriores requieren una matriz de compatibilidad. `effortLevel: xhigh` global y lectura de hasta 50.000 tokens son presupuesto permitido, no consumo necesariamente realizado; no equivalen a pérdida de rendimiento demostrada. Los costes se miden en transcript y resultado. `sandbox.enabled: false` y permisos amplios merecen un perfil de laboratorio aislado: limpiar instrucciones globales no aísla procesos ni credenciales.

## Helpers de diagnóstico, seguridad y review

| Helper | Evidencia | Recomendación y aceptación |
|---|---|---|
| [diagnostic-patterns/scripts/analyze-error.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/diagnostic-patterns/scripts/analyze-error.ts) | Importa módulos ausentes; exit 1 en R03 | Reparar contrato o retirar toda referencia. Smoke del comando real en CI |
| [security-audit/scripts/scan-secrets.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/security-audit/scripts/scan-secrets.ts) | R12: ruta inexistente=0 hallazgos/exit0; R13: valor sintético en salida | Contadores scanned/skipped/errors, redacción, exit/payload sin ambigüedad; no inferir seguridad por cero |
| mismo walker de secretos | `statSync` sigue symlinks sin visited; `split('/')` no trata separadores Windows nativos | No escapar del root autorizado ni entrar en ciclos; probar symlink/junction y repos grandes |
| [review-patterns/scripts/complexity-report.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/review-patterns/scripts/complexity-report.ts) | R11: solo comentarios produce FAIL/42; score por fichero y regex | Heurística marcada o analizador por lenguaje/función. No gate de calidad a partir de ese número |
| [review-patterns/scripts/find-n-plus-one.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/review-patterns/scripts/find-n-plus-one.ts) | R14: Map local es query; ventana de cinco líneas pierde consultas lejanas | Candidatos que requieren verificar I/O; tests negativos, positivos, async dependiente y concurrencia limitada |
| walkers de review | Repetición del walker y mismos límites de paths/ciclos | Extraer solo la mecánica compartida justificada por tres consumidores; no framework nuevo |
| [skill-advisor/lib/rank.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/skill-advisor/lib/rank.ts) | R01: 31 descriptions son marcadores YAML; Keywords multiline perdidos | Parser único; precedence local/global; datos correctos antes de optimizar score |

## Helpers de html-report

| Fichero | Crítica concreta | Corrección propuesta / aceptación |
|---|---|---|
| [contract.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/html-report/scripts/contract.ts) | Interfaces no validan JSON de stdin; `sections` obligatorio contradice comentario “solo meta obligatorio”; HTML confiable no delimitado en todas las strings | Schema runtime, errores útiles, unión discriminada texto/HTML autorizado, IDs únicos y enums |
| [render.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/html-report/scripts/render.ts) | Interpola HTML en prose/callout/sidenote/now; enum de JSON puede ir a atributos; ignora `collapsible`; Fonts siempre; print no fuerza expansión de detalles cerrados | Texto por defecto, validación, opt-in HTML y fonts; prueba real de impresión/teclado/fallback. La posibilidad de HTML intencional debe conservar contrato explícito |
| [components.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/html-report/scripts/components.ts) | Celdas se insertan raw, R08; atributo severity sin validación de JSON | Escape por defecto o tipo rich-cell, sanitización de markup explícito; contenido externo como texto inerte |
| [charts.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/html-report/scripts/charts.ts) | `sum || 1` falsifica cero, R07; no valida NaN/negativos; bar no acota máximos; línea usa dominio desde cero | Separar denominador del total mostrado; políticas para series inválidas y dominio; cero=0 sin segmento ficticio |
| [theme.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/html-report/scripts/theme.ts) | Comentario “todo texto ≥4.5” no se cumple para `--ok` sobre `--bg`: R09=3,019:1; usado en verdict pequeño | Paleta semántica para texto y superficies medida con WCAG [E10], no solo inks neutros |
| [comments.ts](https://github.com/MaciWP/claude-code-poneglyph/blob/ecd56cf37229afddce1e29f40b24b82c2dc8f724/.claude/skills/html-report/scripts/comments.ts) | Markdown acotado y escaping son buenos; transformaciones sobre URL ya escapada pueden cambiar `&` a doble entity; fallback copy marca éxito sin comprobar boolean de execCommand | Tests de URL con query, Markdown literal y fallo real de clipboard; no ampliar parser sin necesidad |
| cuatro `*.test.ts` | Verifican muchos fragmentos/escapes, pero no cubren cero de donut, AA del verdict ni límite trusted/untrusted del render completo | Añadir regresiones del comportamiento fallido y una inspección renderizada dirigida; evitar pruebas que solo repliquen el markup |
| cuatro plantillas HTML, `tokens.css`, `components.html` | Varios contratos visuales con bloques duplicados; refs dicen SSOT pero ciertos modos poseen sus propios tokens | Documentar propietarios por modo; equivalencia solo donde se promete; tests de datos y accesibilidad antes de añadir más variantes |
| `*-data.json`, ejemplo de auditoría y referencias visuales | Fixtures y demostraciones, no medición del comportamiento de los modelos actuales | Etiquetar fixtures; no usar su score/verdict como evidencia del estado del repo. Mantener HARD separado de TASTE |

## Tests y dependencias fuera de los tres directorios

**Ejecutado:** `bun test ./.claude/`: 384 pass, 0 fail, 741 expectativas, 22 ficheros, en Linux con Bun 1.4.0. Las 15 sondas nuevas reproducen observaciones fuera de esa cobertura. Pasar la suite acredita los casos que contiene; no contradice los defectos aquí mostrados.

Los tests de hooks suelen comprobar funciones puras o stdout. Faltan pruebas nativas de evento/canal, casos cross-OS reales del perfil instalado y oráculos funcionales para las habilidades del agente. No se ejecutó Claude ni Grok aquí; no hay resultados de suscripciones, costes reales ni verificación nativa Windows/macOS en esta PR.

La cadena también depende de `flow-state.ts`, `gate.ts`, workflows JS y `.claude/evals/`. Se inspeccionó el runner/graders y las interfaces invocadas; **no se presenta esta PR como auditoría línea por línea de todos los workflows, scripts externos o repos de producto**. Están identificados como dependencias en el inventario/contexto y requieren su propio contrato de integración.

Hallazgo transversal del runner de evals: `runLive` recoge stdout pero no condiciona éxito a exit code/final result, no drena stderr y no aplica deadline. Los graders de prosa reciben stream JSON y pueden puntuar metadatos o texto irrelevante. `bannedOpeners` busca en todo el texto, y graders como BLUF pueden aceptar vacío. “Sospecha primero del eval” es razonable para diagnosticar; no autoriza ajustar un grader hasta que la configuración pase. Antes de juzgar un cambio de skill, hay que probar que el instrumento distingue fallo del proceso, fallo de producto y salida válida [E04].

**Aceptación del instrumento:** proceso que imprime texto convincente y sale 1, autenticación fallida, final result error, timeout, salida vacía y respuesta correcta. Solo la última puede contarse como una tarea completada. El laboratorio ABC de la PR #2 sirve para evaluar variantes cuando se integre y se valide ese contrato.

[E01]: evidence.md#e01
[E02]: evidence.md#e02
[E03]: evidence.md#e03
[E04]: evidence.md#e04
[E05]: evidence.md#e05
[E06]: evidence.md#e06
[E07]: evidence.md#e07
[E08]: evidence.md#e08
[E09]: evidence.md#e09
[E10]: evidence.md#e10
[E11]: evidence.md#e11
[E12]: evidence.md#e12
[E13]: evidence.md#e13
