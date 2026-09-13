---
name: prompt-design
description: |
  Skill para la calidad de prompts en cuatro contextos: refinar prompts vagos del USUARIO, GENERAR prompts nuevos cuando el usuario pide uno como output, revisar PROMPTS-A-AGENTES antes de delegar con Agent() (Commandment VIII), y auditar la comunicación inter-agente/skill.
  Úsala cuando: refinar un prompt vago/ambiguo, generar un prompt a petición, revisar un prompt-a-agente antes de Agent(), "genera un prompt", "mejora este prompt", "redacta el prompt de".
metadata:
  keywords: >
    Keywords - prompt, prompts, generar prompt, genera prompt, crea prompt, redacta prompt,
    escribe prompt, mejorar prompt, refine prompt, vague prompt, ambiguous, delegate agent,
    invoke agent, agent prompt, subagent prompt, meta-prompting, prompt engineering, write a
    prompt, create a prompt
when_to_use: |
  "genera un prompt para X", "redacta el prompt de Z", "mejora este prompt", "refina este prompt", "este prompt es vago", "revisa el prompt antes de delegar", "audita la comunicación entre agentes"; cuando un prompt del usuario es ambiguo (score < 70 en la rúbrica, sin criterios de éxito, múltiples interpretaciones); antes de invocar `Agent(subagent_type=…)` para reforzar el prompt de delegación contra la plantilla Arch H (Commandment VIII).
argument-hint: "[prompt text or task description]"
disable-model-invocation: false
---

# Prompt Engineer

## Overview

This skill governs prompt quality across four contexts. The common backbone is the 5-criteria scoring rubric and the corrections catalog — applied differently depending on which context you are in.

| Context | Input | Goal |
|---|---|---|
| **1. Refine user prompt** | A vague prompt the user just sent | Score, improve, present back |
| **2. Generate a prompt** | A request to produce a prompt as output | Apply the same rubric in reverse: draft a prompt that would score ≥80 |
| **3. Review delegation prompt** | A draft `Agent()` prompt the Lead is about to send | Verify it satisfies Arch H (context, goal, constraints, deliverable, injected memory) before invocation |
| **4. Audit inter-agent communication** | A prompt flowing between agents/skills | Detect missing context, ambiguous handoffs, drift from the original intent |

"Measure first, improve second" applies across all four. Score against the rubric before transforming.

## Content Map

Supporting files loaded on demand based on task context. Consult the Contents column to decide which to Read for your current task.

| Topic | File | Contents |
|---|---|---|
| Scoring criteria | `${CLAUDE_SKILL_DIR}/scoring-criteria.md` | The 5-criteria evaluation rubric (Clarity, Context, Structure, Success, Actionable) with 0/10/20 point bands per criterion and score-to-action thresholds (<70 improve, 70-79 proceed cautiously, 80+ proceed). Read when scoring an incoming prompt or deciding whether improvement is needed. |
| Improvement process | `${CLAUDE_SKILL_DIR}/improvement-process.md` | Step-by-step workflow (mermaid + numbered steps) for transforming prompts scoring <70: evaluate, identify low criteria, apply corrections, re-score, present to user. Read in Step 2 of the quick-start after scoring reveals deficiencies and you need the orchestrated flow. |
| Domain templates | `${CLAUDE_SKILL_DIR}/domain-templates.md` | Pre-built prompt templates for common task types (API, Database, Auth, Testing, Refactoring) with placeholder slots for files, tech, success criteria. Read when the scored prompt matches a known domain and you want to bootstrap an improved prompt from a proven shape rather than writing from scratch. |
| Before/after examples | `${CLAUDE_SKILL_DIR}/prompt-examples.md` | Concrete before/after prompt transformations showing how a low-scoring prompt becomes a high-scoring one, with score breakdown per version. Read when you need a worked example to calibrate expectations, or to show the user what "good" looks like. |
| Anti-patterns catalog | `${CLAUDE_SKILL_DIR}/anti-patterns.md` | Catalog of common prompt anti-patterns (vague verbs, missing context, no success criteria, multiple interpretations) with detection heuristics. Read when scoring reveals ambiguity but you can't pinpoint which criterion is failing — the catalog helps name the smell. |
| Per-criterion corrections | `${CLAUDE_SKILL_DIR}/corrections.md` | Concrete "if X is missing, add Y" correction tables per scoring criterion (Clarity, Context, Structure, Success, Actionable). Read in the improvement workflow once you've identified which criterion scored low and need the targeted fix recipe. |

## Quick Start

Pick the workflow by context.

### Context 1 — Refine a user prompt

1. Score the prompt (5 criteria × 20 points = 100 max).
2. If score ≥ 70: proceed with task.
3. If score < 70: identify lowest-scoring criteria, apply corrections from `corrections.md`, use a domain template if task type matches, re-score to ≥80, present the rewritten prompt back to the user for confirmation.

### Context 2 — Generate a prompt as output

When the user asks Claude to *produce* a prompt ("genera un prompt para X", "write me a prompt that…"):

1. Clarify the target: who will receive the prompt (the user themselves? another Claude session? a specific agent type?), what task it must accomplish, what success looks like.
2. Apply the rubric *in reverse*: draft a prompt that would score ≥ 80 against the 5 criteria (Clarity, Context, Structure, Success, Actionable).
3. Use the matching domain template from `domain-templates.md` as a starting skeleton when applicable.
4. Score the draft, iterate if < 80, deliver the prompt.

### Context 3 — Review a delegation prompt (Lead → Agent)

Before sending `Agent(subagent_type=…, prompt=…)`:

1. Verify every block of `agent-routing/references/06-context-arch-h.md` §Arch H Delegation Template. Skills enter as `Read .claude/skills/<name>/SKILL.md`, not `Skill()` calls.
2. Score the same 5 criteria against the *subagent's perspective* (Context = files the agent will need to read; Success = the exact return shape the Lead expects).
3. If a criterion scores low, fix before invoking — every back-and-forth round-trip with a subagent costs 2-5K tokens.

### Context 4 — Audit an inter-agent communication

When a prompt flows between agents (Lead → Workflow unit, or skill → skill, e.g. `flow-build` → `flow-review`) or in a generator→validator handoff, run the rubric against the handoff: is intent preserved? Are constraints carried forward? Is the deliverable specified in a way the receiving side can verify?

## When to Use

- User prompt scores below 70 on evaluation (Context 1).
- User asks Claude to write, draft, create, generate, or redact a prompt as output (Context 2).
- Lead is about to delegate via `Agent()` and the prompt should be reviewed first (Context 3).
- A multi-agent chain shows drift, ambiguity, or lost context between hops (Context 4).

## Commandments cubiertos

| # | Cómo |
|---|---|
| II | Refinement surfaces unverified premises in a vague prompt before they propagate |
| X | Catching a weak delegation prompt early avoids 2-5K-token round-trips with subagents |
| VIII | The core skill — every agent prompt carries context, goal, constraints, deliverable, verification |

## Related

- `agent-routing` — the Arch H delegation template this skill scores (Context 3).
- `flow-scope` / `drillme-clarify` — upstream clarifiers when a user brief is too vague to refine into a prompt.
