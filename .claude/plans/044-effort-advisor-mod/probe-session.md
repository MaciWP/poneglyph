# Sesión de sondas de log-pose (fase 5c)

log-pose ya está instalado y activo (`log-pose@poneglyph`). Clasifica cada prompt tuyo con una llamada a Sonnet y fija el esfuerzo de los pasos de Opus. Registra cada evento en `~/.cache/poneglyph/log-pose/<id de sesión>.jsonl` y una línea `via=mod` por prompt en el `prompt-router.log` del proyecto.

La fase 0 se hizo con la sonda `tempo`, que activaba niveles con `tempo:<nivel>`. Esa sonda y sus directivas ya no existen.

## Arranque

En una terminal nueva, en la raíz de poneglyph, ejecuta `claude`. Comprueba en el hud que el esfuerzo de partida es `medium`. Escribe cada prompt tal cual y espera a que termine antes del siguiente, salvo donde se indique.

## S6: nivel decidido por el mod

1. `Lee .claude/plans/044-effort-advisor-mod/prompt.md y resúmelo en 3 líneas.`
2. `Diseña cómo migrar el log del router a un formato JSON sin perder las líneas antiguas ni romper a Agentic OS, que lo lee.` Mientras responde, **apunta qué nivel muestra el hud**.
3. `Ejecuta git status --short y resúmelo en una línea.`

## S1: corrección con la herramienta del mod

4. `Llama a mcp__log-pose__set con effort high y reason "prueba".` Después: `Cuenta las líneas de plugins/log-pose/hooks/core.ts con wc.`
5. `Llama a mcp__log-pose__set con effort auto.` Después: `Di en una línea qué es un hook.`

## S3 y caché: tu nivel como suelo

6. `/usage`. **Copia la línea `Prompt cache (main)`** y pégamela al final.
7. `/effort` → high → **`s`** (solo esta sesión; con Enter se guardaría en la configuración generada). Después: `Di en una línea qué es un hook.` El hud debe seguir en `high`, aunque el prompt sea fácil.
8. `/effort` → medium → `s`.

## S7: ciclo de vida

9. `Lanza un agente Explore con model haiku que liste los .ts de plugins/log-pose y dime cuántos hay.`
10. `Explica en 8 líneas qué es el prompt caching.` **Mientras responde**, escribe `¿y en una línea?` y pulsa Enter (queda en cola).
11. `Escribe 40 líneas sobre cachés de CPU.` y pulsa **Esc** a mitad de la respuesta.

## S8: lo que no debe contar como rotura

12. `/compact` y después: `Di en una línea qué hace log-pose.`
13. `/reload-plugins` y después: `Di en una línea qué es un mod.`
14. `/clear` y después: `Revisa si plugins/log-pose/README.md explica cómo volver al hook del router.`

## Al terminar

Escríbeme en la sesión principal "sondas hechas", con la línea de `/usage` del paso 6 y el nivel que viste en el hud en el paso 2. Yo leo el log y el transcript.
