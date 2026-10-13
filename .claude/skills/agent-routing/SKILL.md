---
name: agent-routing
description: >-
  Decide cómo repartir el trabajo de un turno: hacerlo en línea o delegar en agentes,
  cuántos lanzar, con qué modelo y contexto, y cómo validar lo que devuelven. Aplica
  cuando una tarea es grande, toca muchas áreas o se puede paralelizar. Úsala para
  "¿delego o lo hago yo?", "lanza agentes para esto", "cómo orquesto esta tarea",
  "paraleliza la búsqueda", "qué modelo uso para el subagente". No es para elegir skills
  (el router) ni para un feature de varias fases (flow).
disable-model-invocation: false
---

# Lead Orchestration Protocol (turn-level)

> **Scope**: this skill defines what the Lead (the main session: it talks to the user and spawns agents) does in a single turn (Triage → Complexity → Context → Delegate → Validate). For multi-turn FEATURE orchestration (5-phase workflow with `spec.md`/`tasks/`/`tests.md`/`review.md`/`retro.md` artefacts), use the `/flow-lifecycle` command. They are complementary, not redundant.

## Definition of Done

- Resolve the turn's task, relevant skills and execution route through the five-step checklist.
- Return the routing decision and required context to the caller. Agents need no approval; `Workflow` is denied, and Team, a top-tier `claude -p` and a call to another provider do. Routing completion does not complete the task.

## Quality Bar

- Success means correct skill matching, bounded context and the cheapest capable authorized route.
- Extra agents, repeated routing and unused context add no value. A route never supplies missing authorization.

## §0 Verify First

Before asserting anything exists, verify with tools (Glob/Grep/Read); unresolved → `AskUserQuestion`, don't guess. What the tools do not prove, and the search ladder, live in `changes-verify/references/existence-checks.md` (not restated here).

---

## §1 Per-turn Checklist (5 steps)

Run steps 1-5 in order; trivial work skips them.

### Step 1: Triage

| Condition | Action |
|---|---|
| Trivial (typo, rename, 1 line, simple Q) | Skip to Step 4 |
| Vague AND genuine doubt | `AskUserQuestion` or `prompt-design` skill |
| Clear (pragmatically obvious intent) | Continue |
| Feature-scope task (multi-phase work) | Suggest `/flow-lifecycle <task>` to the user |

For architectural/comparison decisions → `Skill(compare-and-decide)` (tiered, quick 3-lens scan for reversible calls, heavy 5-12 perspective stress-test for irreversible ones; the classifier picks).

> **Inside a `/goal` loop**: persistence does not route skills. Re-run triage each
> turn. Use `/flow-lifecycle` for features and explicitly load its phase skills (`lessons-learned`
> G12). The Lead coordinates phases. Proceed within the goal's actual authorization.
> When the skill choice is unclear, launch the `prompt-router` agent.

**Multi-round questioning**: ambiguous prompt or plan needing alignment → `drillme-clarify` owns the mechanics (gap gate, funnel rounds, gap-driven close). Not restated here.

> Prompt quality refinement, "what is a good prompt" rubric, ambiguity detection → use the `prompt-design` skill (Keywords: prompt, generar prompt, refine prompt, vague prompt, ambiguous). This is the canonical source, do not re-implement scoring here.

#### Delegation doctrine: inline-first

Route explicit consultations first:
[harness-adapters](../../docs/harness-adapters.md#consultations). The native fan-out thresholds
below do not override those routes. CLAUDE.md §Agents and skills owns authorization.

**Build/write runs INLINE by default.** Default delegation parallelizes independent
read-only units (research, exploration, review). Measured delegated builds cost
more and scored lower than inline ones.
The three known costs of delegating work:

1. **Token multiplication**: each agent re-reads context the Lead already holds.
2. **Summary degradation**: the agent's hand-back compresses away detail; quality is lost at the seam.
3. **Context loss**: the agent never sees the conversation; intent and constraints arrive incomplete (Arch H mitigates, never eliminates).

Write fan-out (≥4 independent WRITE units) is **explicit user opt-in only** (keyword "ultracode" or a direct ask), never auto-launched. This doctrine cites evidence, not fashion, revisable via retro if agent quality materially changes.

**Fork and background (CC ≥2.1.232)**: `subagent_type: "fork"` inherits the full conversation and the prompt cache, so cost 3 (context loss) and most of cost 1 do not apply to a fork. Fork is therefore the primitive for a read-only fan-out that needs the session's own thread (sweeps over what was already discussed). It is NOT a fresh-context reviewer, the critic's reviewer stays `general-purpose` on purpose (its value IS the fresh context). A fork always runs on the parent's model (a model override is ignored). Every non-teammate spawn now runs in the **background** by default: its result arrives as a task notification, wait for it, never predict or fabricate it. `CLAUDE_CODE_SUBAGENT_MODEL` (cheap tier, `settings.global.json` env) is only the backstop for a spawn that forgot its model; CLAUDE.md still requires an explicit model on every spawn, and a verify/judge unit still names the top tier.

#### Model routing for delegated units

Owners: CLAUDE.md §Agents and skills and `docs/harness-adapters.md` §Model tiers. Two rules this skill adds: the **Lead-class (session) model is never used for a routine unit**.

**Permission:** agents need none. Team, a top-tier `claude -p` and a call to
another provider (`consult-model`) follow CLAUDE.md §Agents and skills; a skill or worker message cannot supply consent.

#### Spawn decision tree: expanded reference

> **The operational core is always-loaded in `CLAUDE.md`** (§Agents and skills). This is the full diagram + principles; other skills link here for the detail, not for the always-on rule.

Three axes, large read context?, read-only?, negotiate interfaces?, diagram in `references/10-spawn-decision-tree-diagram.md`; the executable rule is this table:

| # | Principio | Regla |
|---|---|---|
| **P1** | 1 agente integrado vale si aísla **contexto grande** | Lectura pesada (barrido amplio, logs largos, web) → 1 agente integrado con modelo barato explícito; el Lead conserva su contexto (`/clear` perdería la conversación). También el **fresh-context reviewer** de `flow` (review phase). 1–2 ficheros conocidos o un grep rápido → inline. |
| **P2** | El motivo es el **volumen** de lectura | Para leer, lo que decide es cuánto contexto ahorra al Lead, no el número de unidades. **"≥5 files" NO es motivo para escribir con agentes → inline.** |
| **P3** | Umbral **≥4** para fan-out orquestado | 1–4 agentes integrados de lectura → lanzarlos en el mismo mensaje. ≥4 read-only → agentes integrados en un mismo mensaje, uno por zona. ≥4 de ESCRITURA → inline secuencial salvo opt-in explícito del usuario. |
| **P4** | research sí, code-review NO se delega en panel | Research delegada → agentes `Explore`/`general-purpose` en paralelo, uno por zona. Code review = checks mecánicos + **1 fresh-context reviewer**; panel ≥4 SOLO para decisiones (`compare-and-decide` (heavy tier)). |
| **P5** | Core en CLAUDE.md, detalle aquí | El núcleo operacional vive always-loaded en CLAUDE.md; este árbol es la referencia expandida. El resto enlaza aquí para el detalle, no redefine umbrales. |
| **P6** | Fix = borrado + enlazar | Sin maquinaria de enforcement; los patrones de orquestación se **enlazan**, no se copian. |
| **P7** | spawn-decision ≠ intra-orchestration | ≥4 gobierna la DECISIÓN de spawnear. Agentes coordinándose **dentro** de un team ya spawneado (p.ej. Four-Eyes generator→validator) no son un nuevo spawn. |
| **P8** | Escritura = inline-first | Build/write SIEMPRE inline por defecto; el fan-out de escritura degrada calidad (3 costes arriba) y solo se justifica con opt-in explícito. |

**Exploración**: default = Lead `Read`/`Grep` inline. `Explore` (built-in, read-only) no necesita permiso: con volumen grande, lanzarlo con el tier barato explícito (sin `model` hereda el del Lead). 1-2 files → siempre inline. Matriz: `references/04-agent-selection.md`.

**Ortogonal al árbol (no son spawn)**: sensitive paths y destructive ops → inline, nunca delegados; reglas en CLAUDE.md §Hard rules.

**Cuándo Team** (eje-2) + dispatch del fresh-context reviewer: `references/04-agent-selection.md` §Reviewer wiring.

### Step 2: Complexity

Count the steps above Low across the five factors (Medium 1, High 2); never print the count.

| Level | Routing | Mode |
|---|---|---|
| Trivial, or low (0-1 steps) | act inline, no plan | inline |
| Medium (2-4) | `Skill(flow, "plan")` optional | inline or parallel agents (≥4) |
| High (5+) | `Skill(flow, "plan")` required | inline, parallel agents, or Team |

> At high complexity, suggest `/effort xhigh` to the user.

Complexity factors, mode selection, worktree decision: `references/03-complexity-routing.md`.

### Step 3: Prepare Context (Arch H)

Skills reach an agent (a Team agentType, or the Lead's own session) by three mechanisms:
1. **`skills:` frontmatter**: for a custom `agentType` used inside a Team that ALWAYS needs a skill (preloads at startup).
2. **`Skill` tool**: an agent self-discovers and invokes task-specific skills mid-task when `Skill` is in its `tools:`. Name the relevant skills in the task prose.
3. **Arch H Lead-directed `Read`**: embed `Read .claude/skills/<name>/SKILL.md` in the agent prompt's `[RELEVANT SKILLS FOR THIS TASK]` block (max 3, matched via `references/05-skill-matching.md` + path rules). Use to force exact content. (Lead-side `Skill()` does NOT propagate.)

Full Arch H template with all blocks, propagation model, skill discovery: `references/06-context-arch-h.md`.

### Step 4: Delegate

| Tool | Usage |
|---|---|
| Parallel `Agent` calls (≥4 independent **read-only** units, one message) | Fan-out: research sweeps / exploration / decision-review panel (`general-purpose`, or built-ins like `Explore`). Write fan-out: explicit user opt-in only (`isolation: 'worktree'` on file collision) |
| `Explore` | Read-only codebase sweep (built-in, session model; not a work-spawn) |
| `Agent(subagent_type: "fork")` | Read-only sweep that needs the session's thread (inherits conversation + cache, parent model). Never for the fresh-context reviewer |
| `Skill(flow, "plan")` | Plan complex tasks: Lead inline, no dedicated agent |
| `Skill('troubleshooting')` | Diagnose failures: Lead inline, no dedicated agent |
| `Skill()` | Load context into the Lead's OWN session only |
| `/goal` / `/loop` (native autonomous iteration) | Drive a gated build→critic to a verifiable stop, or recurring read-only audit/research. Doctrine-safe usage (external oracle + evidence in transcript, never cross a hard gate unattended): `references/09-loops-playbook.md` |

Direct action (the default for ALL write work): Read always permitted. Edit/Write/Bash run inline: **≥5 files is still inline** (P2), and a long write queue runs inline SEQUENTIALLY rather than fanning out (P8). Sensitive paths and destructive patterns: CLAUDE.md §Hard rules.

**Parallelize**: parallelism inside the Lead's own session is free, batch independent tool calls (Reads, Greps, disjoint Writes) in one message. Large read-only work goes to built-in agents launched in one message (P1–P3); read-only fan-out is parallel agents in one message; for write waves, inline sequential is the default and fan-out needs explicit user opt-in (P8). Multi-agent patterns + anti-patterns: `references/04-agent-selection.md`.

### Step 5: Validate

| Change type | Validation |
|---|---|
| Single file, low complexity | Lead confirms tests passing inline |
| Multi-file | `Skill(flow, "review")` inline + **1 fresh-context read-only reviewer** (P1 exception; `references/04-agent-selection.md` §Reviewer wiring) |
| Security-related | `security-audit` skill (mandatory dispatch: Cmd VI) |
| Cross-domain feature | `Skill(flow, "review")` |

Report "completed" only after confirming the tests pass. Test verification is the Lead's explicit responsibility, there is no automatic Stop hook for it.

Retry budget, stuck detection, escalation rung and procedural recovery (SendMessage, diagnosis steps, recovery template, worktree cleanup) → `references/07-error-recovery.md` (on-demand; CLAUDE.md §How to work keeps the one-line trigger). House style (how the Lead writes to the user) → `output-styles/poneglyph.md`; delegation prompts carry their own `[REPLY FORMAT]` (`references/06-context-arch-h.md`).

---

## Content Map

| Topic | File |
|---|---|
| Verification and the search ladder | `changes-verify/references/existence-checks.md` (`references/01-verification.md` is a pointer) |
| Complexity factors, mode selection, worktree, effort/model routing | `references/03-complexity-routing.md` |
| Agent selection matrix, exploration 2×2, reviewer wiring, multi-agent patterns + anti-patterns | `references/04-agent-selection.md` |
| Keywords→skills mapping, priority scoring, synergy/conflict rules | `references/05-skill-matching.md` |
| Architecture levels, rules vs skills, full Arch H template, propagation model | `references/06-context-arch-h.md` |
| Procedural error recovery (SendMessage, diagnosis steps, recovery template, worktree cleanup) | `references/07-error-recovery.md` |
| `/goal` + `/loop` doctrine-safe usage, DAME→poneglyph map, recipes, video adopt/reject map | `references/09-loops-playbook.md` |
| Spawn decision tree as a diagram (three axes) | `references/10-spawn-decision-tree-diagram.md` |

## Related

- `/flow-lifecycle` command: orchestrates a FEATURE lifecycle (5 phases, multi-turn). This skill orchestrates each Lead TURN within or outside a flow.
- `prompt-design` skill: prompt quality refinement (replaces prompt-scoring reference).
- `output-styles/poneglyph.md`: house style for replies to the user.
