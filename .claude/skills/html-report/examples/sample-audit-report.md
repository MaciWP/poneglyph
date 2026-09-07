---
audit_date: 2026-05-29
commit_sha: c2eb83893a0f35b4635f2ac2d3bbf7f5807b831d
mean_score: 7.57
median_score: 8.0
findings_count: 10
corpus_size: 17
disputed: []
meta_circular_limitations_declared: true
audit_context: state.json
spec: 002-claude-config-deep-audit
mode: full
phases_executed: 6
review_verdict: APPROVED_WITH_WARNINGS
review_ac_compliance: "8/8"
post_review_adjustment: "mean 7.64->7.57 (Rules 9->8 off-rubric discount removed); Critic=3 confirmed genuine by independent reviewer Opus"
---

# Audit profundo — Claude Code Poneglyph

> Deliverable de `/flow --full 002-claude-config-deep-audit`. Snapshot commit `c2eb838` · 2026-05-29 · 14 categorías scored · 17 fuentes externas · 7 HUs.
>
> **Lectura rápida**: secciones 1-3 (Executive + Top-10 + Quick-wins) bastan para decidir próximos `/flow`. Resto = evidencia.

---

## 1. Executive summary

- **Estado global**: sistema sólido en diseño (mean **7.57**/10, median 8.0), débil en evidencia de uso. 12 de 14 categorías en rango 7-8. Min = **Critic (3)**, Max = **8 (11 categorías empatadas)** — techo n=1 declarado en rúbrica.
- **Hallazgo crítico (BLOCKER)**: Phase 4 (Critic) **nunca se ejecutó formalmente** — `review.md` = 0 archivos en todo el repo. El quality gate central del 5-phase workflow es teórico. El sistema se construyó sobre sí mismo sin pasar por su propio proceso completo (n=1 dogfooding, `/flow` creado tarde en US8).
- **Evento disruptivo (2026-05-28)**: Anthropic lanzó **dynamic workflows** + Opus 4.8. Automatiza lo que poneglyph orquesta a mano (DAG, spawning paralelo, verificación adversarial). Poneglyph cubre 2/3 de la taxonomía canónica 2026 (skills + subagents, **no** workflows).
- **Veredicto sobre el trabajo**: NO obsoleto. Poneglyph aporta una **capa de governance** (10 Commandments, hard gates humanos, drillme, retro promotions, security-gate, output-style) que dynamic workflows NO tiene. El futuro es **componer**: poneglyph SOBRE dynamic workflows (7 items compose identificados, 5 HIGH).
- **Limitación honesta del audit**: meta-circular — auditado con el mismo modelo familia (Claude) bajo las mismas reglas. Mitigado en capas (perspectives + reviewer Opus Phase 4 + advisor) pero no eliminable. Phase 4 de este audit fue la 1ª ejecución real de `/critic` en la historia del sistema.
- **Resultado de la mitigación (verdict Phase 4)**: reviewer Opus independiente emitió **APPROVED_WITH_WARNINGS · 8/8 AC**. La mitigación funcionó (cambió el resultado, no rubber-stamp): rebajó Rules 9→8 por un descuento off-rubric, corrigió una inconsistencia stale Critic 5-vs-3, y **confirmó Critic=3 como genuino** verificando `review.md`=0 con Glob. Grounding validado contra fuentes primarias (spec-kit 106,797★, METR literal "19% longer", security-gate solo `SECRET_PATTERN`). No detectó auto-indulgencia sistémica.

---

## 2. Top-10 hallazgos accionables

| # | Hallazgo | Tipo | Sev | Acción | Effort | /flow sugerido |
|---|---|---|---|---|---|---|
| 1 | Phase 4 Critic nunca ejecutada (`review.md`=0); quality gate teórico | low-score | **BLOCKER** | EJECUTAR critic+reviewer Opus sobre este audit como 1ª ejecución real | M | (en curso) Phase 4 de este `/flow` |
| 2 | Gap a Dynamic Workflows; sin guidance DW vs `/flow` manual | gap | **MAJOR** | ADD skill `workflows-integration` (heurística DW/ultracode vs /flow) | M | `/flow --standard "ADD workflows-integration skill"` |
| 3 | Compose layer no documentado (poneglyph governance SOBRE DW) | compose | **MAJOR** | DOCUMENT capa compose en CLAUDE.md (C1-C7) | M | `/flow --standard "DOCUMENT poneglyph-over-DW governance layer"` |
| 4 | Living-spec retro promotions infrautilizada — sin enforcement | innovation | **MAJOR** | ADD promotions.md tracking + state.json pending field | S | `/flow --minimal "ADD promotions.md tracking en retro"` |
| 5 | Acceleration Whiplash no articulado como valor-prop (faros.ai) | opp | **MAJOR** | DOCUMENT evidencia en CLAUDE.md §Golden Rule | S | `/flow --minimal "DOCUMENT Acceleration Whiplash en Golden Rule"` |
| 6 | Perception/reality gap METR no citado (justifica Commandment IV) | opp | **MAJOR** | DOCUMENT METR RCT+Survey como fundamento de Commandment IV | S | `/flow --minimal "DOCUMENT METR en Commandment IV"` |
| 7 | Background agents / parallel sessions no usados (G2) | gap | MINOR | EVALUATE background agents para Phase 3 wave-parallelism | M | `/flow --standard "EVALUATE background agents en build"` |
| 8 | Constitution level no formalizado (spec-kit 107k★ pattern) | opp | MINOR | REFACTOR Commandments como constitution-level invariante | S | `/flow --minimal "REFACTOR Commandments como constitution"` |
| 9 | security-review no auto-activa en build (Apiiro: 10x vulns) | opp/gap | MINOR | INTEGRATE security-review auto-trigger en build/critic | M | `/flow --standard "INTEGRATE security-review auto-trigger"` |
| 10 | n=1 dogfooding — workflow nunca probado end-to-end real | low-score | **MAJOR** | DOGFOOD `/flow` sobre 2-3 features reales, capturar friction | L | `/flow --standard "<próxima feature>"` ×2-3 |

**Severity**: 1 BLOCKER · 6 MAJOR · 3 MINOR · 0 NIT.
**Tipos**: low-score(2) · gap(2) · opp(4) · compose(1) · innovation(1).

---

## 3. Quick-wins (Effort S — ≤1h cada uno)

| # | Acción | /flow |
|---|---|---|
| QW1 | ADD promotions.md tracking en retro skill | `/flow --minimal "ADD promotions.md tracking"` |
| QW2 | DOCUMENT Acceleration Whiplash (faros.ai) en Golden Rule | `/flow --minimal "DOCUMENT Acceleration Whiplash"` |
| QW3 | DOCUMENT METR evidence en Commandment IV | `/flow --minimal "DOCUMENT METR evidence"` |
| QW4 | REFACTOR Commandments como constitution-level | `/flow --minimal "REFACTOR Commandments como constitution"` |

> **Fusión sugerida**: QW2+QW3+QW4 tocan todos CLAUDE.md → 1 solo `/flow --standard "DOCUMENT evidencia empírica (faros.ai+METR) + constitution-level en CLAUDE.md"` evita 3 ediciones del mismo archivo.

---

## 4. Scoring por categoría

Mean **7.57** · Median **8.0** · Min **3** · Max **8** · N/A **0**. Anchors literales en §6. Evidencia completa en `build/scoring.md`. Scores post-ajuste reviewer Opus (Rules 9→8 off-rubric; Critic 5-vs-3 consistencia).

| # | Categoría | Score | Justificación (resumen) |
|---|---|---|---|
| 1 | Scope (Phase 1) | 8 | Skill completo + 2 specs estructuradas; n=1 ciclo cerrado limita a interp-8 |
| 2 | Tech-plan (Phase 2) | 8 | Auto-triage + 2 DAGs reales; solo 1 lifecycle cerrado |
| 3 | TDD-design (Phase 2.5) | 8 | Dual-mode TDD/validation + 2 validations.md; gap doc untestable-rate en 001 |
| 4 | Build (Phase 3) | 7 | Skill funcional pero status-closure gap real en 001 (11 frontmatters); fix sin 2º ciclo |
| 5 | **Critic (Phase 4)** | **3** | **`review.md`=0 archivos; skill bien diseñado pero NUNCA ejecutado** |
| 6 | Retro (Phase 5) | 8 | retro.md 001 completo (promotions+deltas+commandments); producido manualmente, n=1 |
| 7 | Skills system | 8 | 19 skills, frontmatter >95%, zero overlap post-cleanup; falta tabla skill→Commandment |
| 8 | Agent strategy | 8 | 3 agents KEEP-cond + model assign; Arch H en prompts no persistido/auditable |
| 9 | Hooks reliability | 8 | 4 eventos cubiertos, issue #6305 documentado; test suite no re-ejecutado en audit (read-only) |
| 10 | Rules & output-styles | **8** | 4 rules + output-style + ES/EN convention; mismo techo n=1 que el cluster (9 original tenía descuento off-rubric, corregido por reviewer) |
| 11 | Templates & state persistence | 8 | 8 templates + schema documentado; `state.json` resumability teórica (0 runs reales hasta 002) |
| 12 | Anti-hallucination + security | 8 | Jerarquía LSP>Grep>Glob + security-gate; gate best-effort, sin log de bloqueos reales |
| 13 | Observability | 8 | "reactive ad-hoc" by design (Commandment IX); activación ad-hoc esporádica, no evidenciada |
| 14 | Meta-system maintenance | 8 | 4 cleanup rounds documentados + Commandments audit; sin tabla formal skill→Commandment |

**AC5 honestidad check**: trigger natural (BLOCKER #1 contra el propio sistema). Hallazgo negativo legítimo = el componente más importante (Critic = quality gate) es el de menor evidencia. NO self-congratulation.

---

## 5. Cross-analysis (interno vs corpus externo)

Detalle completo en `build/cross-analysis.md`. Counts: 10 gaps · 7 oportunidades · 7 innovations · 7 compose.

### Gaps (top, aplicabilidad HIGH)

- **G1 Dynamic Workflows** — poneglyph orquesta manual; DW coordina 100s de agentes en background. Taxonomía canónica 2026 incompleta.
- **G2 Background agents / parallel sessions** — poneglyph spawns secuencial misma sesión.

### Oportunidades (HIGH)

- **O1 Acceleration Whiplash** (faros.ai: +210% throughput / +3x incidents) — poneglyph lo previene sin articularlo.
- **O2 Perception/reality gap** (METR: -19% real vs +3x percibido) — argumento más fuerte para Commandment IV.

### Innovations genuinas (verificadas ausentes en corpus)

| Innovation | Verdict |
|---|---|
| I1 security-gate Stop hook (barrera end-of-turn) | **Genuine** — ningún personal-system del corpus lo tiene |
| I2 post-compact context re-injection | **Genuine** — Claude Code-specific, no en corpus |
| I3 error-recovery retry budget + SendMessage | **Genuine** — sin equivalente documentado |
| I5 living-spec retro promotions loop | **Genuine** — spec-kit tiene ciclo sin retro de self-improvement |
| I4 10 Commandments framework | **Parcial** — estructura auditável genuina; principios = síntesis de buenas prácticas (BMAD/cline comparten filosofía) |
| I6 drillme socratic catalog | Genuine (downgrade MEDIUM applicability) |
| I7 Arch H Lead-Directed Skill Reads | **Implementation workaround** — resuelve "subagents no invocan Skill()"; conceptualmente ≈ `skills:` field |

### Compose — poneglyph SOBRE dynamic workflows (el futuro)

| # | Compose | Valor |
|---|---|---|
| C1 | 10 Commandments como filtro de QUÉ workflows escribir | HIGH — sin esto DW es acelerador sin dirección |
| C2 | Hard gates humanos como checkpoints sobre DW runs | HIGH — DW verifica técnico, poneglyph añade gate humano |
| C3 | Drillme catalog como adversarial prompt dentro de DW | HIGH — verificación estratégica + técnica |
| C5 | Retro promotions como feedback loop post-DW | HIGH — DW es single-run, retro cierra aprendizaje |
| C6 | security-gate como validación final sobre DW output | HIGH — DW = calidad técnica, gate = seguridad |
| C4 | output-style poneglyph sobre output de DW | LOW — forma, no fondo |
| C7 | post-compact en sesiones DW largas (caso Bun 11 días) | MEDIUM — preserva contexto de gobernanza |

---

## 6. Rúbrica usada (anchors literales)

Re-ejecutable (AC7): un 2º audit con esta misma rúbrica produce scores comparables. Detalle completo en `build/rubric.md`.

| Anchor | Significado operativo (genérico) |
|---|---|
| **0** | Componente no existe / no se invoca / falla 100% |
| **5** | Existe, happy path funciona, ≥2 edge cases sin manejar O 1 anti-pattern |
| **10** | Existe, edge cases manejados, sin overlap, frontmatter completo, **≥2-3 runs/plans evidenciados** |

> **Techo n=1 declarado upfront**: las categorías cuyo anchor-10 exige "evidenciado en ≥2 plans/" están capadas a interp-8 porque solo 001 cerró su lifecycle. No es penalización arbitraria — es el criterio literal de la rúbrica.

---

## 7. Inventario (snapshot `c2eb838`)

Detalle completo en `build/inventory.md`. Counts verificados via Glob, coinciden con CLAUDE.md.

| Categoría | Count | Categoría | Count |
|---|---|---|---|
| Skills | 19 | Output-styles | 1 |
| Commands | 4 | Templates (.md) | 7 (+1 .json) |
| Agents | 3 | Meta-files (CLAUDE.md, settings.json) | 2 |
| Hooks (main) | 4 (+5 lib/tests) | Scripts untracked | 1 |
| Rules | 4 | | |

**Discrepancias vs CLAUDE.md**: ninguna en counts principales. Adiciones documentadas: `scripts/token-trend.ts` (untracked, Observability), `state.template.json` (8º template). Cobertura 14 categorías: completa, ninguna huérfana.

**Meta-componentes documentados**: frontmatter conventions (`activation.keywords` NO oficial), state.json schema, drillme integration (4 categorías auto-invocadas), hard gates protocol (1→2, 2→3 humanos; sin gate auto 3→4).

---

## 8. Corpus / Bibliografía (17 fuentes verificadas WebFetch 2026-05-29)

Detalle completo en `build/corpus.md`. Distribución repos: 25% enterprise · 37.5% personal · 37.5% library (NO apples-to-oranges dominante).

### Anthropic official (5)

1. [Dynamic Workflows blog](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code) — May 28, 2026. Bun port Zig→Rust 750k LOC/11 días.
2. [Workflows docs](https://code.claude.com/docs/en/workflows) — taxonomía skills/subagents/workflows; `ultracode` setting.
3. [Skills docs](https://code.claude.com/docs/en/skills) — command-skill merge confirmado; `agentskills.io` estándar abierto.
4. [Sub-agents docs](https://code.claude.com/docs/en/sub-agents) — `description` = autodiscovery; background vs teams.
5. [Engineering — Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — progressive disclosure.

### Repos GitHub comparables (8)

6. [github/spec-kit](https://github.com/github/spec-kit) — **107k★** — SDD constitution→spec→plan→tasks. Comparable más directo de `/flow`.
7. [wshobson/agents](https://github.com/wshobson/agents) — 36.1k★ — marketplace (anti-lesson: bloat).
8. [NomenAK/SuperClaude](https://github.com/NomenAK/SuperClaude) — 23k★ — más comparable en filosofía (personal meta-prog).
9. [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) — 27.6k★ — templates out-of-box.
10. [bmadcode/BMAD-METHOD](https://github.com/bmadcode/BMAD-METHOD) — 48.2k★ — "AI colaborador experto" ≈ Commandment I.
11. [cline/cline](https://github.com/cline/cline) — 62.5k★ — human-in-the-loop approval.
12. [Aider-AI/aider](https://github.com/Aider-AI/aider) — 45.5k★ — git auto-commit.
13. [continuedev/continue](https://github.com/continuedev/continue) — 33.4k★ — AI checks as markdown en CI.

### Estudios empíricos (4)

14. [METR RCT 2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) — devs expertos **-19% velocity** con AI.
15. [METR Survey 2026](https://metr.org/blog/2026-05-11-ai-usage-survey/) — **+3x percibido** (gap percepción/realidad).
16. [Apiiro 2025](https://apiiro.com/blog/4x-velocity-10x-vulnerabilities-ai-coding-assistants-are-shipping-more-risks/) — **10x vulns**, +322% privilege escalation.
17. [faros.ai](https://www.faros.ai/blog/claude-code-token-limits) — token limits + Acceleration Whiplash.

**Apéndice (no en cap)**: Issue #32910 (`skills:` field = startup injection, no access), Issue #59968 (skill-to-skill context collapse — relevante para multi-agent), CHANGELOG v2.1.154, VoltAgent (context-mismatch severo).

**URLs muertas resueltas (3)**: dynamic-workflows (anthropic.com→claude.com), SuperClaude (`_Framework`→`/SuperClaude`), METR (URL corregida).

---

## 8.5 Síntesis — qué habilita este report

Tres decisiones quedan listas para ejecutar, ordenadas por dependencia:

1. **Cerrar el gap empírico antes que el gap funcional.** El BLOCKER (#1, Critic nunca ejecutado) y el MAJOR cross-cutting (#10, n=1 dogfooding) son el mismo problema visto desde dos ángulos: el sistema no se ha usado de verdad. Antes de añadir capacidades (workflows-integration, background agents) conviene cerrar 2-3 features reales con `/flow` end-to-end. Este audit (002) es el dogfood #1 y ya destapó el gap — la mejor señal de que dogfooding-first habría sido más barato.

2. **Posicionar poneglyph como governance layer, no como orquestador competidor.** Dynamic workflows gana en mecánica (escala, paralelismo, resumabilidad). Poneglyph gana en criterio (Commandments, gates humanos, drillme, retro, security-gate). Los 7 items compose (§5) son la hoja de ruta de esa convivencia. El finding #3 (documentar la capa compose en CLAUDE.md) es el que fija esta identidad antes de que la ambigüedad "¿reemplazo o complemento?" erosione la motivación de mantener el sistema.

3. **Capitalizar la evidencia empírica que ya existe.** Los quick-wins QW2-QW4 (faros.ai Acceleration Whiplash, METR perception gap, constitution-level) convierten estudios externos en justificación explícita del "por qué" de poneglyph. Coste S, fusionables en 1 solo `/flow`. Es el retorno más alto por token: blindan el sistema contra su propia tentación de vibe-coding.

El resto (security-review auto-trigger, background agents) son mejoras incrementales que dependen de haber cerrado primero el gap empírico (#1).

## 9. Apéndice — Limitaciones del audit

Honestidad radical (Commandment I + AC8). Cada limitación = learning para audit-2.

| Limitación | Detalle | Mitigación aplicada | Learning para audit-2 |
|---|---|---|---|
| **Sesgo meta-circular** | Auditado con mismo modelo familia (Claude) bajo mismas reglas. No ve fallos de marco. | 3 perspectives Phase 1 + reviewer Opus Phase 4 + advisor. NO eliminable. | Considerar revisor humano externo o modelo no-Claude para audit-2 |
| **n=1 dogfooding** | Solo 001 cerró lifecycle; este audit (002) es el 2º. Scores capados a interp-8. | Techo declarado upfront en rúbrica. | Re-auditar tras 3-4 features cerradas con `/flow` real |
| **14 categorías (BLOCKER perspectives)** | Riesgo score paralysis. Usuario ratificó pese a feedback. | Progressive disclosure: scoring detrás del top-10 priorizado. | Evaluar si 7 hard-merged habría sido más accionable |
| **12-20 fuentes (BLOCKER perspectives)** | Riesgo apples-to-oranges para uso personal. Usuario ratificó. | `compare-context` label por fuente; 25% enterprise (<50%). | Funcionó mejor de lo previsto — spec-kit/BMAD aportaron señal real |
| **Audit-first vs dogfood-first** | Hallazgos parcialmente teóricos. Usuario ratificó audit-first. | El hallazgo #1+#10 confirmó empíricamente la intuición del usuario (drillme D2). | Dogfood-first habría detectado el gap Critic antes |
| **Read-only** | `bun test` no re-ejecutado (constraint anti-drift). Score Hooks asume 81/81 de retro 001. | Declarado en scoring categoría 9. | Audit-2 podría permitir 1 ejecución de test suite controlada |
| **Disputa/rebuttal** | Frontmatter `disputed: []` editable por Oriol sin re-ejecutar audit. | Protocolo activo. | — |

### Reflexión meta

El audit confirma su propio hallazgo central: **el sistema es fuerte en diseño, débil en evidencia de uso**. Este mismo audit (002) es el primer `/flow --full` que llega a Phase 4 con `/critic` formal. Si el audit se hubiera hecho dogfood-first (como sugirieron Outsider+Product perspectives), el gap Critic se habría detectado por uso, no por scoring. La decisión audit-first del usuario produjo un report más exhaustivo a costa de evidencia empírica — trade-off consciente, documentado, sin ocultar.

**El trabajo de poneglyph NO es obsoleto post dynamic workflows.** Es una capa de governance que el ecosistema todavía no tiene. El siguiente paso natural: componer (no reemplazar).
