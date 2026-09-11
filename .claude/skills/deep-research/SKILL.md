---
name: deep-research
description: |
  Investigación multi-fuente con disciplina de tokens: primero el Lead en la sesión principal (codebase + web); solo si no cierra la pregunta, fan-out de agentes (máx. 10 total) con prompts sembrados con lo ya hallado para no rebuscar de cero.
  Úsala cuando: hay que investigar a fondo un tema, contrastar fuentes, dossier de evidencia, "investiga", "deep research", "busca evidencia", "qué dice la documentación / el ecosistema sobre X".
metadata:
  keywords: >
    Keywords - deep-research, deep research, investiga, investigación, research, dossier,
    evidencia, multi-source, contrastar fuentes, fact-check, busca evidencia, investiga a
    fondo, research rigor
disable-model-invocation: false
argument-hint: "<question or topic>"
when_to_use: |
  "investiga", "deep research", "busca evidencia", "dossier", "contrasta fuentes", "qué dice la doc sobre", "research this", "investigate thoroughly"
---

# deep-research — session-first, escalate only with seeds

Token-conscious research. **Agents are a last resort**, never the default. When they
fire, they inherit everything the main session already proved so they extend, not redo.

Rigor method (tiers, quote-anchors, refuters, counter-evidence): read on demand
`.claude/docs/research-rigor.md`. This skill owns **routing and budget**; that doc owns
**evidence quality**.

## Non-negotiables

| Rule | Why |
|------|-----|
| **Phase 1 is always main-session** | Spawning before a cheap pass wastes agents and tokens |
| **Hard cap: ≤10 agents total** per invocation (finders + refuters + any helpers) | User budget; never “throw Haikus at it” |
| **Every agent prompt carries a SEED** | What the session already found + exclusion list — no cold starts |
| **Empty seed → do not spawn** | If Phase 1 produced nothing usable, fix the session pass or ask the user — agents will thrash |
| **Agent prompts go through `prompt-engineer`** | Commandment VIII: `Skill(prompt-engineer)` Context 3 (review delegation) before every `Agent()` / fan-out — no raw drafts |
| **Read-only research** | No edits to the product codebase from this skill; report only |

## Flow

```text
Scope → Session pass (Lead) → Viability gate
                              ├─ DONE      → synthesize → stop
                              ├─ PARTIAL   → optional agents ONLY on residual gaps
                              └─ INSUFFICIENT → seeded fan-out (≤10) → synthesize
```

### 0. Scope (cheap)

Restate in one line: **question · deliverable · constraints** (time, must-use sources,
in/out of scope). If multi-part, list atomic sub-questions. If the ask is vague enough
that any research would miss, one `AskUserQuestion` round — then continue.

### 1. Session pass — main Lead only (MANDATORY)

No `Agent` / Workflow. The Lead uses tools directly:

1. **Codebase first** (T1): Grep / Read / Glob when the question touches this repo.
2. **Web when needed**: WebSearch → WebFetch primary sources (official docs, RFCs, release
   notes, reputable posts). Prefer fewer high-quality fetches over many shallow hits.
3. **Stop conditions for this pass** (any one is enough to move to the gate):
   - The deliverable can be answered with cited evidence; or
   - Remaining unknowns are explicit and named; or
   - Two more tool calls would only restate what you have (diminishing returns).

Build a **SEED pack** (keep it in working memory / scratch; do not dump a novel):

```text
SEED
- Question: …
- Found (claim · source · tier A/B/C/D/T1 · confidence):
  - …
- Open gaps (only what still blocks the answer):
  - …
- Exclusion (do NOT re-fetch / re-grep): paths, URLs, queries already spent
- Out of scope: …
```

### 2. Viability gate

| Verdict | Criteria | Next |
|---------|----------|------|
| **DONE** | Enough A/B/T1 (or solid C labeled) for the user's ask; residual unknowns don't change the answer | Synthesize (§4). **0 agents.** |
| **PARTIAL** | Core answer holds; 1–N gaps would improve confidence or cover a required sub-question | Agents **only** for those gaps. Prefer 1–3. |
| **INSUFFICIENT** | Session hit a wall: many independent axes, contradictory sources, or breadth the Lead can't cover in one pass | Seeded fan-out, still ≤10. |

Default bias: **DONE or PARTIAL**. Choose INSUFFICIENT only when parallel workstreams
clearly beat more main-session calls.

### 3. Escalation — seeded agents (OPTIONAL)

Read `references/escalation.md` when this phase runs. Summary:

1. **Cluster gaps** into workstreams (one agent per cluster, not per micro-question).
2. **Budget**: `finders + refuters ≤ 10`. Typical shapes:
   - 1–2 gaps → 1–2 finders; add 1 refuter only if a claim will drive a decision
   - 3–5 gaps → ≤5 finders; reserve ≤2 slots for refuters if decision-grade
   - Many gaps → merge into ≤8 finder clusters; keep ≥1 slot free for a refuter if needed
3. **Draft** each agent prompt from the SEED + gap-only objective + exclusion + deliverable
   schema (template in the ref). Raw findings for the Lead, not user prose.
4. **`Skill(prompt-engineer)` before every spawn (mandatory)** — Context 3: review the
   delegation prompt(s) (Arch H / rubric ≥80). Fix weak prompts; only then call `Agent()`
   or the fan-out panel — always with an explicit `model` (mid tier for finders, top tier
   for a refuter; the `CLAUDE_CODE_SUBAGENT_MODEL` default is a cheap tier). Results
   arrive as task notifications (background by default since CC 2.1.232). Batch-review is fine (one prompt-engineer pass over all drafts);
   skipping the skill is not. Refuter prompts go through the same gate.
5. **Refuter** (optional, from research-rigor rule 3): only for decision-changing claims;
   counts toward the 10. Instruct REFUTE against primary sources; fail closed.
6. **After agents return**: Lead merges; does **not** re-run the whole search. Spot-verify
   high-stakes claims (Commandment II), contradiction-check parallel citations.

Never spawn a second wave “because we have budget left.” One escalation panel per
invocation unless the user explicitly asks to go deeper.

### 4. Synthesize (always Lead)

Single report for the user:

1. **BLUF** — answer in 1–3 sentences.
2. **Findings** — claim · evidence (quote-anchor or file:line / URL) · tier · confidence.
3. **Counter-evidence / dissent** — what argued the other way (or “none found after …”).
4. **Gaps** — what remains unknown and whether it matters.
5. **Method note (one line)** — `session-only` | `session + N agents (of ≤10)` so cost is visible.

Numeric claims: quote-anchor or `[Probable]` / `UNVERIFIED` (research-rigor P1).

## When NOT to use this skill

| Situation | Use instead |
|-----------|-------------|
| Trivial fact, one known file/URL | Answer inline — no skill ceremony |
| Pre-code API/deprecation check inside a plan | `tech-plan` → `references/02-research.md` |
| External model second opinion | `consult` |
| Choose between options already researched | `decide` |
| User wants a full feature pipeline | `/flow` |

## Anti-patterns (kill the skill if these become normal)

- Agents before a real session pass.
- 10 agents on a question two WebFetches would close.
- Agent prompts without SEED / exclusion list (cold parallel thrash).
- Spawning without `Skill(prompt-engineer)` Context 3 on the delegation prompts.
- Re-researching exclusion-list sources “to be sure” without a concrete dispute.
- Treating agent output as truth without verifying decision-grade claims.
- Turning this into a harness config audit (domain audit ≠ open research).

## Commandments

| # | How |
|---|-----|
| I | Scope + codebase-first before web or agents |
| II | Tiers, quote-anchors, verify decision-grade claims |
| III | Counter-evidence + optional refuter — not confirmation theater |
| V / X | Session-first; ≤10 agents; seeds cut duplicate tool use |
| VIII | Every agent prompt: SEED + `prompt-engineer` Context 3 before `Agent()` |

## Related

- `.claude/docs/research-rigor.md` — evidence quality SSOT
- `prompt-engineer` — **mandatory** before any research agent spawn (Context 3)
- `tech-plan/references/02-research.md` — deep research *for planning code* (anti-obsolescence)
- `/role research` · `/role shopping` — compose this skill + tools / `decide`
- `consult` — other-model hypothesis, not a substitute for primary sources
- `references/escalation.md` — budget table + agent prompt template

**Version**: 1.1.0 (prompt-engineer gate on escalation)
