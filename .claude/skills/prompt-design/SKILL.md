---
name: prompt-design
description: >-
  Redacta y mejora prompts: afina una petición vaga, escribe uno nuevo, revisa el
  encargo antes de delegarlo en un agente u otro modelo y audita los mensajes entre
  agentes. Aplica también cuando hay que preparar instrucciones para una IA aunque no se
  diga "prompt". Úsala para "genera un prompt para…", "mejora este prompt", "redacta las
  instrucciones del agente", "este prompt es vago", "cómo se lo pido mejor". No es para
  pedir la opinión de otro modelo (consult-model).
argument-hint: "[prompt text or task description]"
disable-model-invocation: false
---

# Prompt Engineer

## Definition of Done

- Select the prompt context and derive success criteria from the recipient's task, constraints and expected return.
- Deliver or validate the prompt using the existing rubric and context-specific threshold. For variable tasks, include instructions to resolve missing DoD and quality priorities before execution.
- Preserve the user's intent and required confirmation. Stop when the prompt passes the checks; do not polish past that.

## Quality Bar

- Success means executable instructions, observable success criteria and accurate transfer of scope and constraints.
- Use the five pass/fail criteria; each fail names what is missing.

## Overview

This skill governs prompt quality across four contexts. The common backbone is the 5-criteria scoring rubric and the corrections catalog, applied differently depending on which context you are in.

| Context | Input | Goal |
|---|---|---|
| **1. Refine user prompt** | A vague prompt the user just sent | Check, improve, present back |
| **2. Generate a prompt** | A request to produce a prompt as output | Apply the same rubric in reverse: draft a prompt that passes all five criteria |
| **3. Review delegation prompt** | A draft `Agent()` prompt the Lead is about to send | Verify it satisfies Arch H (context, goal, constraints, deliverable, injected memory) before invocation |
| **4. Audit inter-agent communication** | A prompt flowing between agents/skills | Detect missing context, ambiguous handoffs, drift from the original intent |

"Measure first, improve second" applies across all four. Check the criteria before transforming.

## Content Map

Supporting files loaded on demand based on task context. Consult the Contents column to decide which to Read for your current task.

| Topic | File | Contents |
|---|---|---|
| Scoring criteria | `${CLAUDE_SKILL_DIR}/scoring-criteria.md` | The 5 pass/fail criteria (Clarity, Context, Structure, Success, Actionable) and when to proceed or fix. Read when checking an incoming prompt or deciding whether improvement is needed. |
| Improvement process | `${CLAUDE_SKILL_DIR}/improvement-process.md` | Step-by-step workflow (mermaid + numbered steps) for transforming a prompt that fails a criterion: check, identify the fails, apply corrections, re-check, present to user. Read in Step 2 of the quick-start after a check fails and you need the orchestrated flow. |
| Domain templates | `${CLAUDE_SKILL_DIR}/domain-templates.md` | Pre-built prompt templates for common task types (API, Database, Auth, Testing, Refactoring) with placeholder slots for files, tech, success criteria. Read when the checked prompt matches a known domain and you want to bootstrap an improved prompt from a proven shape rather than writing from scratch. |
| Before/after examples | `${CLAUDE_SKILL_DIR}/prompt-examples.md` | Concrete before/after prompt transformations showing how a failing prompt becomes a passing one. Read when you need a worked example to calibrate expectations, or to show the user what "good" looks like. |
| Anti-patterns catalog | `${CLAUDE_SKILL_DIR}/anti-patterns.md` | Catalog of common prompt anti-patterns (vague verbs, missing context, no success criteria, multiple interpretations) with detection heuristics. Read when a check reveals ambiguity but you can't pinpoint which criterion is failing, the catalog helps name the smell. |
| Per-criterion corrections | `${CLAUDE_SKILL_DIR}/corrections.md` | Concrete "if X is missing, add Y" correction tables per criterion (Clarity, Context, Structure, Success, Actionable). Read in the improvement workflow once you've identified which criterion failed and need the targeted fix recipe. |

## Quick Start

Pick the workflow by context.

### Context 1: Refine a user prompt

1. Check the 5 criteria (`scoring-criteria.md`).
2. All pass: proceed with the task.
3. A fail: apply corrections from `corrections.md` for the failing criteria, use a domain template if the task type matches, re-check, and present the rewritten prompt to the user for confirmation.

### Context 2: Generate a prompt as output

When the user asks Claude to *produce* a prompt ("genera un prompt para X", "write me a prompt that…"):

1. Clarify the target: who will receive the prompt (the user themselves? another Claude session? a specific agent type?), what task it must accomplish, what success looks like.
2. Apply the criteria *in reverse*: draft a prompt that passes all 5 (Clarity, Context, Structure, Success, Actionable).
3. Use the matching domain template from `domain-templates.md` as a starting skeleton when applicable.
4. Check the draft, fix any fail, deliver the prompt.

### Context 3: Review a delegation prompt (Lead → Agent)

Before sending `Agent(subagent_type=…, prompt=…)`:

1. Verify every block of `agent-routing/references/06-context-arch-h.md` §Arch H Delegation Template. Skills enter as `Read .claude/skills/<name>/SKILL.md`, not `Skill()` calls.
2. Check the same 5 criteria against the *subagent's perspective* (Context = files the agent will need to read; Success = the exact return shape the Lead expects).
3. If a criterion fails, fix it before invoking, every round-trip with a subagent costs a full extra exchange.
4. Write it in plain English for any model (subagent, Codex, Grok, a local model): one instruction per sentence, one term per concept, no metaphors. State the reply format you need back. The house style for the user applies to neither the prompt nor its reply.

### Context 4: Audit an inter-agent communication

When a prompt flows between agents (Lead → agent, or skill → skill, e.g. `flow` build phase → `flow` review phase) or in a generator→validator handoff, run the rubric against the handoff: is intent preserved? Are constraints carried forward? Is the deliverable specified in a way the receiving side can verify?

## When to Use

- A user prompt fails a criterion (Context 1).
- User asks Claude to write, draft, create, generate, or redact a prompt as output (Context 2).
- Lead is about to delegate via `Agent()` and the prompt should be reviewed first (Context 3).
- A multi-agent chain shows drift, ambiguity, or lost context between hops (Context 4).

## Commandments cubiertos

| # | Cómo |
|---|---|
| II | Refinement surfaces unverified premises in a vague prompt before they propagate |
| X | Catching a weak delegation prompt early avoids 2-5K-token round-trips with subagents |
| VIII | The core skill: every agent prompt carries context, goal, constraints, deliverable, verification |

## Related

- `agent-routing`: the Arch H delegation template this skill checks (Context 3).
- `flow` skill (scope phase) / `drillme-clarify`, upstream clarifiers when a user brief is too vague to refine into a prompt.
