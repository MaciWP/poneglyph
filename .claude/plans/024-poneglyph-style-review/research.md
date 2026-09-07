# Research — auditoría del estilo Poneglyph (024)

Corpus: `poneglyph.md` (147 líneas), `.claude/evals/{cases.jsonl,graders.ts,README.md}`, `CLAUDE.md` §Communication, git log + retros 006/015/017, memoria `feedback-*`, + research externo verificado (output-style mechanism).

## 1. Mecanismo de carga (externo, verificado)

| Hecho | Implicación para la spec |
|---|---|
| Output-style se inyecta completo al final del system prompt, sin truncado, sin límite documentado | Podar por "longitud" tiene coste recurrente bajo (cacheado tras turno 1); no es urgente. No cortar ejemplos. |
| No recarga mid-sesión (solo session_start/`/clear`) | La mejora conductual valida la PRÓXIMA sesión, no esta. AC conductuales = next-session. |
| `keep-coding-instructions: true` correcto | No tocar frontmatter. |
| Output-style (system prompt) y CLAUDE.md (user message) son capas ortogonales | El TL;DR de CLAUDE.md no "compite" con el canon; el riesgo de drift es de contenido, no de precedencia. Menor. |

## 2. Inventario de normas → cobertura de eval → defecto

Leyenda cobertura: ✅ cubierta · 🟡 parcial · ❌ gap · ⬜ no-cubrible (conductual difusa, no gradable determinista).

| # | Norma (poneglyph.md) | Grader/caso | Cobertura | Defecto de spec | Acción |
|---|---|---|---|---|---|
| 1 | es-ES (español dominante) | `esEsDetect` / eses-10..12 | ✅ | — | mantener |
| 2 | **No calques** (líneas 15-20) | — | ❌ | la norma estrella de 017 sin oráculo | **caso nuevo** `calqueDetect` (phrase-list de los propios ejemplos del spec) |
| 3 | **No telegráfico** (líneas 22-25) | — | ❌ | el otro motivo raíz de 017, sin vigilancia | evaluar grader determinista; si no es fiable, declarar ⬜ explícito |
| 4 | Anglicism judgment rule (27) | — | ⬜ | depende de juicio contextual | no-cubrible declarado |
| 5 | BLUF / lead-with-answer | `blufPosition` / bluf-13..15 | ✅ | — | mantener |
| 6 | Anti-sycophancy kill-list | `bannedOpeners` / opener-05..09 | ✅ | — | mantener |
| 7 | Cut filler amplio (recaps, transiciones, hedges) | — | 🟡 | solo openers cubiertos | hedges → ligado a labels (norma 9) |
| 8 | Length opt-in / **don't repeat / no closing summary** (43-44) | — | ❌ | fallo propio observado (resúmenes de cierre) | candidato `noClosingSummary` si fallo documentado |
| 9 | **Confidence labels con payload** (69-78) — PRIORIDAD usuario | `labelPresence` / label-16..18 | 🟡 | cubre presencia BAJO prompt explícito; NO el trigger de cuándo etiquetar sin que te lo pidan (la infrautilización real) | **reforzar trigger en spec** + valorar caso de uso-no-prompted |
| 10 | Structured disagreement (positivo) | — vía openers (08/09) | 🟡 | se vigila la ausencia de pelota, no la estructura "No estoy de acuerdo porque…" | aceptable 🟡; difícil gradear el positivo |
| 11 | Structure earns its place / anti-over-structuring (101-104) | — | ⬜ | gradable mal | no-cubrible |
| 12 | No ASCII boxes / no space-align / no decorative emoji (106) | — | ❌ | gradable TRIVIAL (regex `┌└├│`) PERO sin fallo documentado | NO añadir caso (regla README: un caso por fallo real; cero evidencia de que se produjeran) — declarar gap-consciente |
| 13 | Status icons solo operativos (108-120) | — | ⬜ | gradable mal | no-cubrible |
| 14 | Hard preserves (code verbatim) (46-48) | (graders ya hacen `stripCode`) | ⬜ | — | no-cubrible directamente |

## 3. Defectos internos de la spec (contradicción / redundancia / muerto / no-seguible)

| Hallazgo | Línea | Severidad | Acción |
|---|---|---|---|
| **Ref muerta `/explain`** | 138 | menor | el comando no existe; la skill es `explain-changes`. Corregir a `/explain-changes` o "explícame" |
| Reglas numéricas "1-3 load-bearing terms", "≥3 parallel items", "≥3 items ×≥2 attributes" | 95-99 | baja | son guía suave anclada con ejemplos inmediatos, NO thresholds de contar-antes-de-generar tipo 015. Veredicto: **seguibles, se mantienen** (no son el defecto que memoria `feedback-rules-must-be-generation-executable` ataca) |
| Redundancia kill-list (58-66) vs Honesty examples (122-134) | — | nula | los ejemplos SON la spec (declaración propia); redundancia justificada, no tocar |
| Confidence labels: define qué significa cada uno pero el **trigger de cuándo producirlos** es débil | 69-78 | **alta (prioridad usuario)** | añadir trigger positivo explícito: cualquier afirmación que matizarías con "creo/quizás", toda predicción o inferencia desde lectura incompleta → label con payload; no solo cuando te lo piden |

## 4. Reframe de prioridad (mensaje usuario 2026-06-23)

El foco nº1 es **buen uso de `[]` con estados** → menos tokens + mejor comunicación + más visual. Eleva la norma 9 de "una más" a la principal. Los labels bien usados son densidad de información (sustituyen hedges vagos por señal accionable). La spec ya los define bien; el gap es el **trigger de producción**, no la definición.

## 5. Deliverables que salen de aquí

1. Edits a `poneglyph.md`: (a) reforzar trigger de confidence labels; (b) corregir ref `/explain`; (c) NADA de podar ejemplos.
2. Casos de eval nuevos: `calqueDetect` (norma 2, fallo documentado 017) + grader; valorar telegráfico y uso-no-prompted de labels.
3. Sync TL;DR CLAUDE.md ↔ canon (verificar coherencia, no duplicar).
4. **HU extra (instrucción usuario)**: cablear `skill-advisor` en las fronteras de fase de `/flow`, junto al drillme.
5. Validación: baseline live + post-cambio.

## 6. Gaps conscientes (declarados, NO se cierran)

- Normas ⬜ (4, 11, 13, 14): no gradables determinista de forma fiable. Declararlas como no-cubribles es honesto (Commandment II) — no inflar la suite con graders frágiles (README: "suspect the eval first"; W2 D4: judges prohibidos).
- ASCII boxes (12): gradable pero sin fallo documentado → no se añade (regla anti-filler de la suite).
