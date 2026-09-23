---
parent: flow
name: scope
description: Phase 1 — define the product-level scope in spec.md and close the human gate 1→2.
---

# Phase 1 — Scope

Define the **product-level** scope before any technical decision. The deliverable is a
`spec.md` that states root problem, expected outcomes, measurable success criteria, explicit
out-of-scope, constraints and stakeholders. Choosing a library, framework or pattern is
phase 2 work.

Precondition: a request that is not a trivial mechanical change or a bug with a failing
repro. A brief that already contains problem, outcomes, ACs and out-of-scope shortens the
questionnaire; it does not skip the drillme sweep or the gate.

## Definition of Done

- Produce spec.md with the agreed problem, outcomes, observable ACs, boundaries and unresolved decisions.
- Present the actual gate 1→2 decision. While approval is pending, report that state and do not advance.

## How You're Graded

- Favor clear product outcomes and explicit boundaries. Technical design or extra requirements do not improve this phase.

## Initial detection

0. **Plans-dir git policy (once per project).** `git check-ignore -q .claude/plans` exits
   0 → company policy set. Else `git check-ignore -q .claude/plans/_archive` exits 0 →
   personal policy set. Else `AskUserQuestion` (company / personal) and write it: company →
   append `.claude/plans/` to `$(git rev-parse --git-path info/exclude)` (never a hardcoded
   `.git/info/exclude`; in a linked worktree `.git` is a file); personal →
   `.claude/plans/.gitignore` with `_archive/`. Rule: `plans/README.md` §Other projects.
1. `Glob .claude/plans/*-*/spec.md`. A recent `implementing` spec → ask "continue `<slug>`
   or new feature?".
2. Nothing active → compute the next free `NNN` and derive a `slug` (kebab-case, ≤30 chars).
   Propose the slug before creating the directory.
3. Create the plan from `plans/templates/state.template.json` as the command describes.

## Step 1 — Intensive questionnaire

3-8 questions through `AskUserQuestion`, adapted to the request:

| Canonical question | When |
|---|---|
| "¿Cuál es el problema concreto que quieres resolver, no la solución?" | Always; it opens the rest |
| "¿Quién sufre hoy y cómo se manifiesta?" | Stakeholders unclear |
| "¿Qué resultado mínimo te haría feliz?" | Defines the MVP for phase 2 |
| "¿Hay constraints técnicos/temporales que respetar?" | Time, stack, compatibility, freeze |
| "¿Alternativas que ya descartaste y por qué?" | Avoids reinvention; surfaces context |
| "¿Cómo medirás el éxito en 2 semanas?" | Forces measurable outcomes |

Rules: a vague answer ("depende", "más o menos") gets a follow-up until concrete. A
contradiction reopens the affected section. Questions the brief already answers are
skipped, and the report says so: "Cuestionario reducido por brief detallado: skipped N/8".
More than 8 questions means the request is probably two features: propose a split.

## Step 2 — Drillme, phase 1

Sweep the Phase 1 bank of `../../drillme-clarify/references/03-phase-questions.md` (the
single source; not restated here) plus the canonical categories. An empty or evasive
answer iterates; a gap the user cannot close is marked `[OPEN]` in `spec.md` with its
reason. Phase 1 does not close with the drillme sweep open.

## Step 3 — Produce `spec.md`

1. Read `spec.template.md` (project templates first, then `~/.claude/plans/templates/`).
2. Write `.claude/plans/{NNN}-{slug}/spec.md`:
   - `# Problema` — one sentence, root cause.
   - `# Resultado esperado` — 2-4 measurable outcomes from the questionnaire.
   - `# Success criteria (medibles, Given/When/Then)` — ≥3 ACs, each verifiable
     mechanically or by reading.
   - `# Out of scope (explícito)` — the doors the drillme sweep closed.
   - `# Constraints` — only real ones, each with its source.
   - `# Stakeholders` — only if more than one.
   - `# Open questions` — unresolved gaps, may be empty.
3. Frontmatter: `phase: 1`, `status: draft`, `created: <ISO-date>`, `id: {NNN}-{slug}`.
   `approved` stays empty until the human gate closes.

Every AC traces to a user answer or a drillme answer. Stakeholders and constraints come
from the user, never from inference. If the user names a file or system, verify it exists
before writing it into the spec.

## Step 4 — Report and request approval

Record `complete-phase 1` (flow contract), then report:

```text
Phase 1 closed for {NNN}-{slug}:
- spec.md: .claude/plans/{NNN}-{slug}/spec.md (status: draft)
- problema: <one line>
- resultado esperado: <one line>
- success criteria: <N>
- out of scope: <one line>
- open questions: <N | none>

⚪ Hard gate 1->2 — pendiente tu aprobación antes de Phase 2 (flow plan).
   Responde: APPROVE para continuar | REFINE para iterar | BLOCK para detener.
```

The user's actual decision is recorded with `approve-gate 1-2 --approval <decision-ref>`.
The skill never proceeds to phase 2 on its own.

## SIEMPRE rules

- Minimum 3 questions until the scope is unambiguous; honest "demasiado vago" beats an
  invented intent.
- Surface gaps and obvious improvements before closing the questionnaire; never absorb them.
- **No technology in spec.md**: choosing a library, framework or pattern is phase 2 work; one the user imposes (platform, banned dependency, pinned version) is a real constraint, recorded under Constraints with its source.
- An existing `approved` spec with the same slug is never overwritten; prefer a new `NNN`.
- Two distinct features in one request → two specs, or the user prioritizes; never one
  merged spec.

## Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Spec theater | `spec.md` approved in minutes without real questions | Run the minimum questionnaire; say "too vague" instead of inventing |
| Tech sneaking | Spec names Redis, Postgres, React… as a choice | Rewrite as an outcome ("persistent shared storage"); the choice goes to phase 2 |
| Synthetic AC | An AC with no questionnaire or drillme answer behind it | Remove it or ask the question that produces it |
| Empty out-of-scope | "Todo está en alcance" on a non-trivial request | Close doors explicitly, or declare "scope deliberadamente maximalista por <motivo>" |
| Drillme bypass | Phase closed with the bank unswept | Sweep before writing the final `spec.md` |
