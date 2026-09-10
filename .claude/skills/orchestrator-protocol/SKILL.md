---
name: orchestrator-protocol
description: |
  Protocolo de orquestación del Lead a nivel de turno: principios de verificación, checklist de 5 pasos (Triage / Complexity / Context / Delegate / Validate), el árbol de decisión de spawn, skill matching y la plantilla de contexto de delegación (Arch H). Complementaria al command /flow (que orquesta el ciclo de FEATURE multi-turno).
  Úsala cuando: se necesita guía de orquestación (routing complejo, decisiones de spawn, skill matching), "cómo orquesto esto", "delego o inline", "qué skills uso", "complejidad del turno".
metadata:
  keywords: >
    Keywords - orchestrate, delegate, complexity, routing, agent, skill, checklist
disable-model-invocation: false
when_to_use: |
  "cómo orquesto esto", "delego o inline", "qué skills uso", "complejidad del turno", "spawn agents", "routing", "delegation decision"
---

# Lead Orchestration Protocol (turn-level)

> **Scope**: this skill defines what the Lead does in a single turn (Triage → Complexity → Context → Delegate → Validate). For multi-turn FEATURE orchestration (5-phase workflow with `spec.md`/`tasks/`/`tests.md`/`review.md`/`retro.md` artefacts), use the `/flow` command. They are complementary, not redundant.

## §0 Verify First

Before asserting anything exists, verify with tools (Glob/Grep/Read); confidence < 70% → `AskUserQuestion`, don't guess. Tool hierarchy, confidence levels and the validation pipeline are the `anti-hallucination` skill's (canonical — not restated here).

---

## §1 Per-turn Checklist (5 steps)

Execute steps 1-5 IN ORDER before responding. No exceptions.

### Step 1: Triage

| Condition | Action |
|---|---|
| Trivial (typo, rename, 1 line, simple Q) | Skip to Step 4 |
| Vague AND genuine doubt | `AskUserQuestion` or `prompt-engineer` skill |
| Clear (pragmatically obvious intent) | Continue |
| Feature-scope task (multi-phase work) | Suggest `/flow <task>` to the user |

For architectural/comparison decisions → `Skill('decide')` (031: Lead-invocable, tiered — quick 3-lens scan for reversible calls, heavy 5-12 perspective stress-test for irreversible ones; the classifier picks).

> **Inside a `/goal` loop**: persistence does not route skills. Re-run triage each
> turn. Use `/flow` for features and explicitly load its phase skills (`lessons`
> G12). The Lead coordinates phases; an authorized Orca team can execute assigned
> work through the route below. Proceed within the goal's actual authorization;
> it does not grant a missing team permission. Use `skill-advisor` when routing is unclear.

**Multi-round questioning** (006): ambiguous prompt or plan needing alignment → `drillme` owns the mechanics (gap gate, funnel rounds, gap-driven close). Not restated here.

> Prompt quality refinement, "what is a good prompt" rubric, ambiguity detection → use the `prompt-engineer` skill (Keywords: prompt, generar prompt, refine prompt, vague prompt, ambiguous). This is the canonical source — do not re-implement scoring here.

#### Delegation doctrine — inline-first (evidence-based, 2026-06-10)

**Authorized Orca route:** when the user requests a supervised team, invoke
`orca-workflow`. CLAUDE.md §Agent spawn owns its recorded team approval. Use one
shared worktree, coordinator-owned reservations and real task dependencies. The
coordinator alone accepts work and updates flow state. This route does not require
four units or a separate worktree per worker. Full ownership handoffs stay with
`orca-cli`. The default thresholds and native Workflow/Team rules below apply
when this route is not selected; they do not override an approved Orca team.

**Build/write runs INLINE by default.** Default delegation parallelizes independent
read-only units (research, exploration, review). Historical evidence (2026-06-10,
feature 017) found delegated builds more costly and lower quality. An authorized
Orca pilot tests a bounded exception; it does not establish a universal benefit.
The three known costs of delegating work:

1. **Token multiplication** — each agent re-reads context the Lead already holds.
2. **Summary degradation** — the agent's hand-back compresses away detail; quality is lost at the seam.
3. **Context loss** — the agent never sees the conversation; intent and constraints arrive incomplete (Arch H mitigates, never eliminates).

Write fan-out (≥4 independent WRITE units via Workflow) is **explicit user opt-in only** (keyword "ultracode" or a direct ask) — never auto-launched. This doctrine cites evidence, not fashion — revisable via retro if agent quality materially changes.

**Fork and background (CC ≥2.1.232 — audit 010)**: `subagent_type: "fork"` inherits the full conversation and the prompt cache, so cost 3 (context loss) and most of cost 1 do not apply to a fork. Fork is therefore the primitive for a read-only fan-out that needs the session's own thread (sweeps over what was already discussed). It is NOT a fresh-context reviewer — the critic's reviewer stays `general-purpose` on purpose (its value IS the fresh context). A fork always runs on the parent's model (a model override is ignored). Every non-teammate spawn now runs in the **background** by default: its result arrives as a task notification — wait for it, never predict or fabricate it. `CLAUDE_CODE_SUBAGENT_MODEL` (cheap tier, `settings.global.json` env) is only the backstop for a spawn that forgot its model; the gate still requires an explicit model on every spawn, and a verify/judge unit still names the top tier.

#### Model routing for delegated units

Owner: CLAUDE.md §Agent spawn (permission + model, the tier-per-unit-class table, runtime tier resolution) — not restated here. Two rules this skill adds: the **Lead-class (session) model is never used for a routine unit**, and a `Workflow` script sets `model` on every `agent()` call explicitly (032/WP3).

**Hard gate:** CLAUDE.md §Agent spawn owns permission and model choice, including
the bounded Orca team exception. Native permissions remain independent; a skill
or worker message cannot supply consent.

#### Spawn decision tree — expanded reference

> **The operational core is always-loaded in `CLAUDE.md`** (§Agent spawn hard gate + Cmd X: permission + model before any spawn; inline-first for write work). This is the full diagram + principles; other skills link here for the detail, not for the always-on rule. The tree below only applies **after** the user approved spawn and model:

Three axes — units (1–3 → inline), read-only?, negotiate interfaces? — diagram in `references/10-spawn-decision-tree-diagram.md`; the executable rule is this table:

| # | Principio | Regla |
|---|---|---|
| **P1** | 1 agente = **PROHIBIDO** | Única excepción: el **fresh-context reviewer** de critic Phase 4 (read-only, correctness/requirements — su valor ES el contexto fresco; evidencia 018 W1 D1/D3, feature 019). Fuera de eso: no paraleliza; solo aísla contexto (que `/clear` limpia); encarece sin retorno. |
| **P2** | "isolation" **no es excusa** | El main actúa y se ensucia antes que pagar 1 agente. **"≥5 files" NO es trigger de spawn → inline.** |
| **P3** | Umbral **≥4** + **read-only** | 1-3 unidades → inline. ≥4 read-only → Workflow. ≥4 de ESCRITURA → inline secuencial salvo opt-in explícito del usuario. |
| **P4** | research sí, code-review NO se delega en panel | Research delegada → ≥4 en paralelo (search barato `Explore`); si <4 → inline. Code review = checks mecánicos + **1 fresh-context reviewer** (P1-exception); panel ≥4 SOLO para decisiones (`decide` (heavy tier)) — evidencia 018 W1/W2 (feature 019). |
| **P5** | Core en CLAUDE.md, detalle aquí | El núcleo operacional vive always-loaded en CLAUDE.md; este árbol es la referencia expandida. El resto enlaza aquí para el detalle, no redefine umbrales. |
| **P6** | Fix = borrado + enlazar | Sin maquinaria de enforcement; los patrones de la Workflow tool se **enlazan**, no se copian. |
| **P7** | spawn-decision ≠ intra-orchestration | ≥4 gobierna la DECISIÓN de spawnear. Agentes coordinándose **dentro** de un team/workflow ya spawneado (p.ej. Four-Eyes generator→validator) no son un nuevo spawn. |
| **P8** | Escritura = inline-first | Build/write SIEMPRE inline por defecto; el fan-out de escritura degrada calidad (3 costes arriba) y solo se justifica con opt-in explícito. |

**Exploración**: default = Lead `Read`/`Grep` inline. `Explore` (built-in; hereda modelo de sesión desde CC 2.1.198) es read-only y **no** es "1 agente de trabajo" bajo P1 — **pero sigue bajo el hard gate de CLAUDE.md §Agent spawn** (permission + model antes de lanzarlo; en Claude, preferir el tier barato del host vía Agent/subagent con model explícito en lugar de Explore que hereda el Lead). 1-2 files → siempre inline. Matriz: `references/04-agent-selection.md`.

**Ortogonal al árbol (no son spawn)**: sensitive paths (`.env`, `*.lock`, `package.json`, `.claude/settings*.json`, `secrets/`, `credentials/`) → inline con `sensitive: <reason ≥8 chars>`. Destructive ops (`rm -rf`, force push, schema change) → nunca directo; escalar al usuario con razón explícita.

**Cuándo Workflow vs Team** (eje-2) + dispatch del fresh-context reviewer: `references/04-agent-selection.md` §Workflow wiring.

### Step 2: Complexity

Show inline: `Complexity: ~XX`.

| Score | Routing | Mode |
|---|---|---|
| <30 | act inline (skip scoring/skills) | inline |
| 30-60 | `Skill('tech-plan')` optional | inline or Workflow (≥4) |
| >60 | `Skill('tech-plan')` MANDATORY | inline, Workflow, or Team |

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
| `Skill('orca-workflow')` | Authorized supervised Orca team; one shared worktree, direct traced messages, coordinator reservations and acceptance |
| `Workflow` (≥4 independent **read-only** units) | Fan-out: research sweeps / exploration / decision-review panel in parallel (`agentType` `default`, or built-ins like `Explore`). Write fan-out: explicit user opt-in only (`isolation: 'worktree'` on file collision) |
| `Explore` | Explore codebase (massive read-only — built-in, inherits session model; not a work-spawn) |
| `Agent(subagent_type: "fork")` | Read-only sweep that needs the session's thread (inherits conversation + cache, parent model). Never for the fresh-context reviewer. Same hard gate |
| `Skill('tech-plan')` | Plan complex tasks — Lead inline, no dedicated agent |
| `Skill('diagnostic-patterns')` | Diagnose failures — Lead inline, no dedicated agent |
| `Skill()` | Load context into the Lead's OWN session only |
| `/goal` / `/loop` (native autonomous iteration) | Drive a gated build→critic to a verifiable stop, or recurring read-only audit/research. Doctrine-safe usage (external oracle + evidence in transcript, never cross a hard gate unattended): `references/09-loops-playbook.md` |

Direct action (the default for ALL write work): Read always permitted. Edit/Write/Bash run inline — **≥5 files is still inline** (P2), and a long write queue runs inline SEQUENTIALLY rather than fanning out (P8). On sensitive paths declare inline `sensitive: <reason ≥8 chars>`. Destructive patterns — escalate with explicit reason. No automated gate enforces this; the Lead is responsible.

**Parallelize**: parallelism inside the Lead's own session is free — batch independent tool calls (Reads, Greps, disjoint Writes) in one message. Agent fan-out via `Workflow` requires ≥4 independent READ-ONLY units (P3); for write waves, inline sequential is the default and Workflow needs explicit user opt-in (P8). Multi-agent patterns + anti-patterns: `references/04-agent-selection.md`.

### Step 5: Validate

| Change type | Validation |
|---|---|
| Single file, low complexity | Lead confirms tests passing inline |
| Multi-file | `Skill('critic')` inline + **1 fresh-context read-only reviewer** (P1-exception, feature 019; `references/04-agent-selection.md` §Workflow wiring) |
| Security-related | `security-audit` skill (mandatory dispatch — Cmd VI) |
| Cross-domain feature | `Skill('critic')` (Phase 4 of the 5-phase workflow) |

**NEVER report "completed" without confirmation that tests pass.** Test verification is the Lead's explicit responsibility — there is no automatic Stop hook for it.

Retry budget, stuck detection, escalation rung → `error-recovery.md` rule (project root, always-loaded). Procedural recovery detail (SendMessage, diagnosis steps, recovery template, worktree cleanup) → `references/07-error-recovery.md` (on-demand). Output style baseline + escape triggers → `output-styles/poneglyph.md`.

---

## Content Map

| Topic | File |
|---|---|
| Verification, confidence levels, validation pipeline | the `anti-hallucination` skill (canonical; `references/01-verification.md` is a pointer) |
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

- `/flow` command — orchestrates a FEATURE lifecycle (5 phases, multi-turn). This skill orchestrates each Lead TURN within or outside a flow.
- `prompt-engineer` skill — prompt quality refinement (replaces prompt-scoring reference).
- `.claude/rules/error-recovery.md` — Lead-driven error diagnosis + retry policy.
- `output-styles/poneglyph.md` — terse-first response style.
