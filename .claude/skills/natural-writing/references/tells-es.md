# Spanish tells

Same tiers as the English list: **Strong** = act on one sighting; **Weak alone** = act
only when other tells share the passage. Write the fixes in es-ES (vosotros, ordenador,
fichero), not LatAm.

**Evidence level.** No Spanish corpus study with a lemma list was found (search of
2026-09-25). What is sourced: the structural tells are language-independent
(humanizer v3 and Wikipedia say so for not-X-but-Y), and Juzek (*AI-Associated Lexical
Shifts Across 34 Languages*, arXiv 2605.25358, 2026) found "emphasize"-type verbs
overused in 24 of 34 languages, with AI-associated words rising 15.1 % in news text
after 2022. The normative points (capitalization, gerunds, quotation marks, dashes)
come from the RAE and Fundéu. The Spanish word list is editorial judgment: recalibrate
it when a Spanish lemma study appears.

## A. Staging instead of stating (strong)

### 1. «No solo X, sino también Y» / «No es X, es Y»

Includes «más que X, Y», «lejos de ser X» and the split form ("Esto no significa que X.
Significa que Y."). Keep it only when the first half corrects something the reader believes.

❌ No se trata solo de una mejora técnica, sino de un cambio de paradigma.
✅ La consulta tarda 200 ms en lugar de 3 s.

### 2. Cierres de una línea y fragmentos dramáticos

Watch for: «Y eso lo cambia todo.» · «Así de simple.» · «Ni más, ni menos.» · a row of
fragments («Sin configuración. Sin esperas.») · a closing paragraph that repeats the one
before.

❌ Los reintentos ocultan las caídas breves. Y eso marca la diferencia.
✅ Los reintentos ocultan las caídas de menos de 30 segundos.

### 3. Frases que suenan profundas

Watch for: en el fondo · la verdadera pregunta es · lo que realmente importa · en
esencia · X es el lenguaje de Y.

### 4. Entradas escenificadas

Watch for: «Vamos a sumergirnos en…» · «Adentrémonos en…» · «Veamos paso a paso…» ·
«Esto es lo que necesitas saber» · «¿La respuesta corta?» · «Seamos sinceros».

❌ Vamos a sumergirnos en el mundo de las colas. Esto es lo que necesitas saber.
✅ La cola reintenta cada trabajo tres veces y luego lo mueve a la tabla de fallidos.

### 5. Discutir con nadie

Watch for: «Esto no va de…» · «No digo que…» · «Que quede claro:» · «Podría pensarse
que… pero» · «Una opción tentadora sería…», when nobody raised that objection.

## B. Rhythm by rule

### 6. Tríadas forzadas (strong at scale, weak for one list)

«Rápido, fiable y escalable»; three parallel examples; three short facts followed by a
moral. Keep three real items.

❌ La nueva versión aporta velocidad, estabilidad y sencillez.
✅ La nueva versión arranca en la mitad de tiempo.

### 7. Rayas por todas partes

Spanish uses the dash (—) for incisos, attached to the text on the inside
(«la migración —pendiente desde marzo— se ejecuta hoy»; RAE). Two tells: English-style
spacing on both sides («la migración — pendiente — se ejecuta») and dashes as the
default joint between clauses. Claude is the heaviest dash user among current chatbots
(see tells-en §8), so treat dashes as strong in text Claude wrote. The final text uses
commas, colons or parentheses unless the user's sample uses dashes.

❌ El cambio — muy esperado — llega hoy — por fin.
✅ El cambio, muy esperado, llega hoy.

### 8. Gerundio de posterioridad o de adorno

The Spanish form of the English -ing rider: «…, permitiendo…», «…, garantizando…»,
«…, lo que permite…» tacked on to inflate a plain fact. The RAE rejects the gerund
of a later consequence; even when grammatical, the rider usually adds nothing.

❌ Se ha añadido una caché, mejorando significativamente la experiencia de usuario.
✅ Se ha añadido una caché y la página ya no repite la consulta.

### 9. Frases largas y parejas (weak alone)

Every sentence the same length, chained with «además», «asimismo», «por otro lado».
Vary the length; let a short sentence carry a fact.

### 10. Calificadores apilados (weak alone)

«Podría llegar a ser potencialmente…», «en cierta medida podría…». Keep real doubt and
scope limits.

## C. Inflation and calques

### 11. Vocabulario de IA (strong in clusters)

| Family | Words |
|---|---|
| Emphasis verbs (the cross-lingual cluster, Juzek 2026) | destacar, subrayar, resaltar, poner de relieve, cabe destacar, es importante señalar |
| Inflated adjectives | crucial, fundamental, clave (adj.), esencial, integral, holístico, robusto (figurative), sólido, innovador, transformador, sin precedentes |
| Inflated verbs | potenciar, fomentar, impulsar, optimizar, empoderar, apalancar, profundizar en, abordar |
| Stock scenery | en el panorama actual · en el mundo actual · en la era digital · en un entorno cada vez más… · el ecosistema (figurative) |

Swapping one word for a synonym does not fix it: rewrite around the fact.

❌ Cabe destacar que esta solución robusta potencia de forma integral la escalabilidad.
✅ Con este cambio el servicio aguanta el doble de peticiones.

### 12. Importancia inflada

Watch for: «juega un papel fundamental/crucial» (also a calque of *plays a role*; Spanish
says «desempeña un papel», or better, the verb) · «marca un antes y un después» · «sienta
las bases» · «un hito» · «un testimonio de» · «el futuro se presenta prometedor».

### 13. Evitar «es» y «tiene»

«Se erige como», «funciona como», «actúa como», «cuenta con», «presenta», «ofrece».

❌ El servicio se erige como la puerta de entrada y cuenta con tres réplicas.
✅ El servicio es la puerta de entrada y tiene tres réplicas.

### 14. Autoridad prestada

«Los expertos coinciden en…», «diversos estudios demuestran…», «según los especialistas…»
with no named source. Use the real source or cut the claim. Never invent one.

### 15. Calcos del inglés (weak alone; strong in clusters)

| Calque | Spanish |
|---|---|
| «Vale la pena mencionar» (*worth mentioning*) | cut it, or «conviene saber» |
| «Hace sentido» | «tiene sentido» |
| «Es realizado por el equipo» (passive) | «lo hace el equipo» |
| «Aplicar a un puesto» | «solicitar un puesto» |
| «En orden a» / «a nivel de» (non-literal) | «para» / «en» |
| Possessives everywhere: «levantó su mano» | «levantó la mano» |

## D. Formatting by rule

### 16. Mayúsculas de título en inglés (strong)

Spanish capitalizes only the first word and proper names in titles and headings
(RAE). «Guía Rápida De Instalación» is a translation or machine tell. Months and weekdays
are lowercase: «el lunes 3 de septiembre».

❌ ## Estrategia De Despliegue Y Próximos Pasos
✅ ## Estrategia de despliegue

### 17. Negrita de adorno y listas con etiqueta

Same as tells-en §18: bold scattered through a paragraph, or every bullet «**Etiqueta:**
frase». Remove the bold; turn labeled lists into prose when the labels add nothing.

### 18. Comillas inglesas (weak alone)

The RAE prefers «angulares», then “inglesas”, then ‘simples’. Straight or curly English
quotes alone prove nothing; many people type them. Follow the target format (Markdown,
code and Jira take straight quotes).

### 19. Emojis y flechas de adorno

🚀 in headings, → as a connector in prose, ✨ in list items. Keep an icon only when the
format uses it (Jira ticket templates do).

## E. Leftovers from chat (strong; remove outright)

### 20. Restos de chatbot

«¡Claro!» · «¡Excelente pregunta!» · «Espero que te sirva» · «No dudes en preguntar» ·
«¿Quieres que…?» · «Aquí tienes…» · «En resumen,» / «En definitiva,» as a closing
paragraph that repeats the text.

### 21. Avisos de límite de conocimiento

«Hasta donde llega mi información», «según los datos disponibles», «no hay información
pública al respecto, pero probablemente…». State what the source does not show, or cut
the sentence.

### 22. Hablar de la versión anterior

Docs and comments that describe what was replaced («Esta función sustituye al antiguo
bucle…»). History goes in changelogs, release notes and PR descriptions.
