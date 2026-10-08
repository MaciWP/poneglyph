---
name: agent-routing
description: >-
  Turn-level orchestration protocol for the Lead: verification principles,
  the Triage/Complexity/Context/Delegate/Validate checklist, the spawn decision
  tree and the delegation context template. Use for "delego o inline", "cómo
  orquesto esto", "lanzo agentes para esto" or a spawn or Workflow decision.
  Not for picking skills (choose-skills) or a multi-turn feature
  (/flow-lifecycle).
metadata:
  keywords: >
    Keywords - agent-routing, delego o inline, cómo orquesto, lanzo agentes, spawn agents,
    decisión de spawn, complejidad del turno, delegation decision, plantilla de delegación
disable-model-invocation: false
when_to_use: |
  Deciding whether to delegate, spawn agents or stay inline.
---

# Lead Orchestration Protocol (turn-level)

> **Scope**: this skill defines what the Lead does in a single turn (Triage → Complexity → Context → Delegate → Validate). For multi-turn FEATURE orchestration (5-phase workflow with `spec.md`/`tasks/`/`tests.md`/`review.md`/`retro.md` artefacts), use the `/flow-lifecycle` command. They are complementary, not redundant.

## Definition of Done

- Resolve the turn's task, relevant skills and execution route through the five-step checklist.
- Return the routing decision and required context to the caller. Custom agents need approval; built-in ones do not. Routing completion does not complete the task.

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

For architectural/comparison decisions → `Skill('decide')` (031: Lead-invocable, tiered — quick 3-lens scan for reversible calls, heavy 5-12 perspective stress-test for irreversible ones; the classifier picks).

> **Inside a `/goal` loop**: persistence does not route skills. Re-run triage each
> turn. Use `/flow-lifecycle` for features and explicitly load its phase skills (`lessons-learned`
> G12). The Lead coordinates phases; an authorized Orca team can execute assigned
> work through the route below. Proceed within the goal's actual authorization;
> it does not grant a missing team permission. Use `choose-skills` when routing is unclear.

**Multi-round questioning** (006): ambiguous prompt or plan needing alignment → `drillme-clarify` owns the mechanics (gap gate, funnel rounds, gap-driven close). Not restated here.

> Prompt quality refinement, "what is a good prompt" rubric, ambiguity detection → use the `prompt-design` skill (Keywords: prompt, generar prompt, refine prompt, vague prompt, ambiguous). This is the canonical source — do not re-implement scoring here.

#### Delegation doctrine — inline-first (evidence-based, 2026-06-10)

First resolve explicit consultation, native-session, or team requests with the
[shared routing contract](../../rules/skill-routing.md). The native fan-out thresholds
below do not override those routes. CLAUDE.md §Agent spawn owns authorization.

**Authorized Orca teams** follow `orca-team`: one shared worktree, real dependencies,
and coordinator-owned reservations, acceptance and flow state. That route requires
neither four units nor a worktree per worker.

**Build/write runs INLINE by default.** Default delegation parallelizes independent
read-only units (research, exploration, review). Historical evidence (2026-06-10,
feature 017) found delegated builds more costly and lower quality. An authorized
Orca pilot tests a bounded exception; it does not establish a universal benefit.
The three known costs of delegating work:

1. **Token multiplication** — each agent re-reads context the Lead already holds.
2. **Summary degradation** — the agent's hand-back compresses away detail; quality is lost at the seam.
3. **Context loss** — the agent never sees the conversation; intent and constraints arrive incomplete (Arch H mitigates, never eliminates).

Write fan-out (≥4 independent WRITE units via Workflow) is **explicit user opt-in only** (keyword "ultracode" or a direct ask) — never auto-launched. This doctrine cites evidence, not fashion — revisable via retro if agent quality materially changes.

**Fork and background (CC ≥2.1.232 — audit 010)**: `subagent_type: "fork"` inherits the full conversation and the prompt cache, so cost 3 (context loss) and most of cost 1 do not apply to a fork. Fork is therefore the primitive for a read-only fan-out that needs the session's own thread (sweeps over what was already discussed). It is NOT a fresh-context reviewer — the critic's reviewer stays `general-purpose` on purpose (its value IS the fresh context). A fork always runs on the parent's model (a model override is ignored). Every non-teammate spawn now runs in the **background** by default: its result arrives as a task notification — wait for it, never predict or fabricate it. `CLAUDE_CODE_SUBAGENT_MODEL` (cheap tier, `settings.global.json` env) is only the backstop for a spawn that forgot its model; CLAUDE.md still requires an explicit model on every spawn, and a verify/judge unit still names the top tier.

#### Model routing for delegated units

Owner: CLAUDE.md §Agent spawn (permission + model, the tier-per-unit-class table, runtime tier resolution) — not restated here. Two rules this skill adds: the **Lead-class (session) model is never used for a routine unit**, and a `Workflow` script sets `model` on every `agent()` call explicitly (032/WP3).

**Permission:** built-in agents need none. Custom agents, Workflow/Team and Orca
follow CLAUDE.md §Agent spawn; a skill or worker message cannot supply consent.

#### Spawn decision tree — expanded reference

> **The operational core is always-loaded in `CLAUDE.md`** (§Agent spawn: built-in agents free, explicit model per spawn; inline-first writes). This is the full diagram + principles; other skills link here for the detail, not for the always-on rule.

Three axes — large read context?, read-only?, negotiate interfaces? — diagram in `references/10-spawn-decision-tree-diagram.md`; the executable rule is this table:

| # | Principio | Regla |
|---|---|---|
| **P1** | 1 agente integrado vale si aísla **contexto grande** | Lectura pesada (barrido amplio, logs largos, web) → 1 agente integrado con modelo barato explícito; el Lead conserva su contexto (`/clear` perdería la conversación). También el **fresh-context reviewer** de `flow` (review phase). 1–2 ficheros conocidos o un grep rápido → inline. |
| **P2** | El motivo es el **volumen** de lectura | Para leer, lo que decide es cuánto contexto ahorra al Lead, no el número de unidades. **"≥5 files" NO es motivo para escribir con agentes → inline.** |
| **P3** | Umbral **≥4** solo para `Workflow` | 1–4 agentes integrados de lectura → lanzarlos en el mismo mensaje. ≥4 read-only orquestados → Workflow (opt-in). ≥4 de ESCRITURA → inline secuencial salvo opt-in explícito del usuario. |
| **P4** | research sí, code-review NO se delega en panel | Research delegada → agentes `Explore`/`general-purpose` en paralelo, uno por zona. Code review = checks mecánicos + **1 fresh-context reviewer**; panel ≥4 SOLO para decisiones (`compare-and-decide` (heavy tier)) — evidencia 018 W1/W2 (feature 019). |
| **P5** | Core en CLAUDE.md, detalle aquí | El núcleo operacional vive always-loaded en CLAUDE.md; este árbol es la referencia expandida. El resto enlaza aquí para el detalle, no redefine umbrales. |
| **P6** | Fix = borrado + enlazar | Sin maquinaria de enforcement; los patrones de la Workflow tool se **enlazan**, no se copian. |
| **P7** | spawn-decision ≠ intra-orchestration | ≥4 gobierna la DECISIÓN de spawnear. Agentes coordinándose **dentro** de un team/workflow ya spawneado (p.ej. Four-Eyes generator→validator) no son un nuevo spawn. |
| **P8** | Escritura = inline-first | Build/write SIEMPRE inline por defecto; el fan-out de escritura degrada calidad (3 costes arriba) y solo se justifica con opt-in explícito. |

**Exploración**: default = Lead `Read`/`Grep` inline. `Explore` (built-in, read-only) no necesita permiso: con volumen grande, lanzarlo con el tier barato explícito (sin `model` hereda el del Lead). 1-2 files → siempre inline. Matriz: `references/04-agent-selection.md`.

**Ortogonal al árbol (no son spawn)**: sensitive paths (`.env`, `*.lock`, `package.json`, `.claude/settings*.json`, `secrets/`, `credentials/`) → inline con `sensitive: <reason ≥8 chars>`. Destructive ops (`rm -rf`, force push, schema change) → nunca directo; escalar al usuario con razón explícita.

**Cuándo Workflow vs Team** (eje-2) + dispatch del fresh-context reviewer: `references/04-agent-selection.md` §Workflow wiring.

### Step 2: Complexity

Weigh the five factors; never print a score.

| Score | Routing | Mode |
|---|---|---|
| Trivial or 33-45 | act inline, no plan | inline |
| 45-60 | `Skill(flow, "plan")` optional | inline or Workflow (≥4) |
| >60 | `Skill(flow, "plan")` required | inline, Workflow, or Team |

> If complexity > 60, suggest `/effort xhigh` to the user.

Complexity factors × weight, mode selection, worktree decision: `references/03-complexity-routing.md`.

### Step 3: Prepare Context (Arch H)

Skills reach an agent (a Workflow/Team agentType, or the Lead's own session) by three mechanisms:
1. **`skills:` frontmatter** — for a custom `agentType` used inside a Workflow that ALWAYS needs a skill (preloads at startup).
2. **`Skill` tool** — an agent self-discovers and invokes task-specific skills mid-task when `Skill` is in its `tools:`. Name the relevant skills in the task prose.
3. **Arch H Lead-directed `Read`** — embed `Read .claude/skills/<name>/SKILL.md` in the agent/workflow prompt's `[RELEVANT SKILLS FOR THIS TASK]` block (max 3, matched via `references/05-skill-matching.md` + path rules). Use to force exact content. (Lead-side `Skill()` does NOT propagate.)

Full Arch H template with all blocks, propagation model, skill discovery: `references/06-context-arch-h.md`.

### Step 4: Delegate

| Tool | Usage |
|---|---|
| `Skill('orca-team')` | Authorized supervised Orca team; one shared worktree, direct traced messages, coordinator reservations and acceptance |
| `Skill('orca-swarm')` | orca-team + bid board, time budget, leaderboard |
| `Workflow` (≥4 independent **read-only** units) | Fan-out: research sweeps / exploration / decision-review panel in parallel (`agentType` `default`, or built-ins like `Explore`). Write fan-out: explicit user opt-in only (`isolation: 'worktree'` on file collision) |
| `Explore` | Read-only codebase sweep (built-in, session model; not a work-spawn) |
| `Agent(subagent_type: "fork")` | Read-only sweep that needs the session's thread (inherits conversation + cache, parent model). Never for the fresh-context reviewer. Same hard gate |
| `Skill(flow, "plan")` | Plan complex tasks — Lead inline, no dedicated agent |
| `Skill('troubleshooting')` | Diagnose failures — Lead inline, no dedicated agent |
| `Skill()` | Load context into the Lead's OWN session only |
| `/goal` / `/loop` (native autonomous iteration) | Drive a gated build→critic to a verifiable stop, or recurring read-only audit/research. Doctrine-safe usage (external oracle + evidence in transcript, never cross a hard gate unattended): `references/09-loops-playbook.md` |

Direct action (the default for ALL write work): Read always permitted. Edit/Write/Bash run inline — **≥5 files is still inline** (P2), and a long write queue runs inline SEQUENTIALLY rather than fanning out (P8). On sensitive paths declare inline `sensitive: <reason ≥8 chars>`. Destructive patterns — escalate with explicit reason.

**Parallelize**: parallelism inside the Lead's own session is free — batch independent tool calls (Reads, Greps, disjoint Writes) in one message. Large read-only work goes to built-in agents launched in one message (P1–P3); `Workflow` fan-out needs ≥4 independent READ-ONLY units and opt-in; for write waves, inline sequential is the default and Workflow needs explicit user opt-in (P8). Multi-agent patterns + anti-patterns: `references/04-agent-selection.md`.

### Step 5: Validate

| Change type | Validation |
|---|---|
| Single file, low complexity | Lead confirms tests passing inline |
| Multi-file | `Skill(flow, "review")` inline + **1 fresh-context read-only reviewer** (P1-exception, feature 019; `references/04-agent-selection.md` §Workflow wiring) |
| Security-related | `security-audit` skill (mandatory dispatch — Cmd VI) |
| Cross-domain feature | `Skill(flow, "review")` |

**NEVER report "completed" without confirmation that tests pass.** Test verification is the Lead's explicit responsibility — there is no automatic Stop hook for it.

Retry budget, stuck detection, escalation rung → `error-recovery.md` rule (project root, always-loaded). Procedural recovery detail (SendMessage, diagnosis steps, recovery template, worktree cleanup) → `references/07-error-recovery.md` (on-demand). House style (how the Lead writes to the user) → `output-styles/poneglyph.md`; delegation prompts carry their own `[REPLY FORMAT]` (`references/06-context-arch-h.md`).

---

## Content Map

| Topic | File |
|---|---|
| Verification and the search ladder | `changes-verify/references/existence-checks.md` (`references/01-verification.md` is a pointer) |
| Complexity factors × weight, mode selection, worktree, effort/model routing | `references/03-complexity-routing.md` |
| Agent selection matrix, exploration 2×2, Workflow wiring, multi-agent patterns + anti-patterns | `references/04-agent-selection.md` |
| Keywords→skills mapping, priority scoring, synergy/conflict rules | `references/05-skill-matching.md` |
| Architecture levels, rules vs skills, full Arch H template, propagation model | `references/06-context-arch-h.md` |
| Procedural error recovery (SendMessage, diagnosis steps, recovery template, worktree cleanup) | `references/07-error-recovery.md` |
| `/goal` + `/loop` doctrine-safe usage, DAME→poneglyph map, recipes, video adopt/reject map | `references/09-loops-playbook.md` |
| 021 loops analysis source — evidence basis for the playbook; read ONLY when questioning the playbook's adopt/reject decisions | `references/09-loops-analysis-source.md` |
| Spawn decision tree as a diagram (three axes) | `references/10-spawn-decision-tree-diagram.md` |
| Removed references and where they went (2026-05-28, 2026-09-03) | `references/11-history.md` |

## Related

- `/flow-lifecycle` command — orchestrates a FEATURE lifecycle (5 phases, multi-turn). This skill orchestrates each Lead TURN within or outside a flow.
- `prompt-design` skill — prompt quality refinement (replaces prompt-scoring reference).
- `.claude/rules/error-recovery.md` — Lead-driven error diagnosis + retry policy.
- `output-styles/poneglyph.md` — house style for replies to the user.
