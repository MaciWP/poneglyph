---
parent: flow
name: retro
description: Phase 5 — capture lessons, propose promotions, close the living-spec loop, audit the commandments and close the feature lifecycle.
---

# Phase 5 — Retro

Measure the **process** that produced the deliverable and turn it into structural
improvements: lessons, promotions, the living-spec delta, the commandments audit. Honesty is
the whole value: report actual friction and lessons, including an honest absence of either.

Precondition: `review.md` with APPROVED or APPROVED_WITH_WARNINGS and `current_phase: 5`.
NEEDS_CHANGES or BLOCKED → STOP; a retro on broken work captures the wrong lessons.

**Skip discipline.** Skipping the retro is the Lead's call, only when there is genuinely
nothing to learn (no lesson, no promotion, no spec drift), announced before skipping and
recorded: `bun .claude/scripts/flow-state.ts retro-status "skipped — <reason ≥10 chars>"`.
`close-feature` refuses a null or pending retro, so a silent skip is impossible.

## Definition of Done

- Produce the evidence-backed retro and requested closure decisions, or record the justified no-learning skip under the existing protocol.
- Close the feature only when the review, retro status and required human decisions allow it. Resume from existing records.

## How You're Graded

- Favor reusable lessons and accurate scope closure. Zero lessons or promotions is valid; invented friction and forced entries do not earn credit.

## Step 1 — Read inputs

`spec.md`, `tasks/index.md` and `tasks/US{N}.md`, `tests.md` / `validations.md`,
`review.md` (`verdict`, `spec_drift`, findings), `state.json`, `retro.template.md` (project
templates, then global; both missing → `retro-fallback.md`), `CLAUDE.md` §The 10
Commandments, and `.claude/learned/inbox.md` when present (legacy candidates; the file no
longer grows).

## Step 2 — Retro level

| Level | When | Scope |
|---|---|---|
| **light** | 1-2 HUs, light review, no decision absorbed | Summary + 1-2 lessons + 0-1 promotion; no commandments audit or living-spec section |
| **standard** (default) | 3-N HUs, no architectural decision absorbed | Full template |
| **full** | Absorbed decisions, architectural work, or spec drift detected | Standard + a subsection per absorbed decision + commandments forensics |

Override with `--light` / `--standard` / `--full`; declare `retro_level` and its reason.

## Step 3 — Executive summary

Original problem (one sentence quoting `spec.md`), what was delivered (one sentence on the
real diff scope), how it went (smooth / friction / pivoted).

## Step 4 — Technical lessons

```markdown
### ✅ Patterns that worked
- <pattern>: <why it worked + where to reuse>

### ❌ Patterns that didn't work
- <pattern>: <why it failed + how to avoid next time>
```

An empty ❌ list is a smell; force the question "what slowed us down?".

## Step 5 — Process audit

| Phase | Effort (S/M/L/XL) | Friction observed | Improvement candidate |
|---|---|---|---|
| 1 scope · 2 plan · 2.5 test plan · 3 build · 4 review | … | … | … |

Name the heaviest phase and diagnose why: it usually reveals a missing tool or a poorly
tuned phase.

## Step 6 — Drillme, phase 5

Sweep the Phase 5 bank of `../../drillme-clarify/references/03-phase-questions.md` (single
source) and any new gap. If `drillme-clarify` does not fire, invoke
`/drillme-clarify "Phase 5 retro of <NNN-slug>"` before closing the feature.

## Step 7 — Promotion candidates

One row per reusable pattern from Steps 4-6 and per inbox entry (weigh by confidence,
discard noise honestly):

| Candidate | Scope | Type | Why (evidence from this feature) | Concrete proposal (path + sketch) |
|---|---|---|---|---|

| Scope | Use when | Path |
|---|---|---|
| **global** | Applies across projects and stacks; meta-system improvement | `~/.claude/{skills,rules,hooks,agents,commands}/` |
| **local** | This codebase's conventions; ceremony elsewhere | `.claude/{skills,rules,hooks,agents,commands}/` |
| **memory** | A single fact that deserves no file | auto-memory entry |
| **lessons** | A mistake with evidence that would repeat in another repo | Row in `~/.claude/skills/lessons-learned/SKILL.md`; stack- or company-specific → the private addon. Never a per-repo lessons layer |

Rules: never auto-promote; every candidate cites its evidence; Glob the target path for
collisions (collision → rename or merge); a native-config candidate follows `harness-config`
for its frontmatter. **Failure → eval case**: each real ❌ lesson also proposes its
golden-prompt case for `.claude/evals/cases.jsonl` (one new case per real failure,
deterministic grader, `source` cites this retro). Zero candidates → say so with reasons;
three retros in a row with zero is a smell about the retro itself.

## Step 8 — Living-spec loop

| `review.md.spec_drift` | Action |
|---|---|
| `none` | "Spec drift: none — delivered matches spec.md" |
| `legitimate` | Propose a `spec.md` diff in §Living-spec deltas. **Never auto-edit.** After approval the patch lands with "v2 — delta from retro {NNN}-{slug} (reason)" |
| `scope_creep` | ❌ lesson "feature extended beyond spec.md without ratification"; revert the extra scope or reopen scope to ratify |
| `skipped_ac` | ❌ lesson "AC X not delivered — <reason>"; schedule a follow-up or downscope the spec explicitly |

A delta is legitimate only when all three hold: a real edge case discovered in build or
review (not a change of mind), no contradiction with the spec's intent, and a documented
why with the finding that motivated it. Otherwise route it to `scope_creep`.

## Step 9 — Commandments audit (mandatory at full, optional at standard)

| # | Commandment | ✅/⚠️/❌ | Evidence or violation |
|---|---|---|---|
| I … X | | | file:line, commit or moment in the process |

Any ⚠️ or ❌ gets a forensics subsection: when it happened, the alternative path, the action
item that prevents recurrence.

## Step 10 — Action items

| Action | Owner (user / Lead / next session / new HU) | Trigger | Due |
|---|---|---|---|

Typical items: apply approved promotions, ratify a living-spec delta, address a violation,
split a component that grew too large.

## Step 11 — Write `retro.md`

From `retro.template.md`. Frontmatter: `spec`, `phase: 5`, `retro_level`,
`verdict_phase4`, `spec_drift`, `promotions_proposed`, `promotions_approved: 0`,
`commandment_violations`, `living_spec_delta`, `action_items`, `created`, `status: open`.
Body: summary, lessons, process, drillme, promotions, living-spec, commandments, action items.

## Step 12 — Close the feature lifecycle

**a. Verify recorded closure.** Read `state.json` and the per-HU verification history.
Pending HUs, missing evidence or an unapproved review keep the feature open. Stale HU
frontmatter on a verified HU → `sync-artifacts`, then investigate the interrupted projection.
Missing state is recovered from recorded decisions, never from artifact existence.

**b. Apply what the user ratified.** Approved promotions → the Lead writes the target files
inline. Approved living-spec diff → patch `spec.md` with the v2 note.

**c. Record and close.** After actual ratification: `flow-state.ts retro-status approved`,
then `flow-state.ts close-feature`. Only after success project closure into spec and tasks
frontmatter. Update `promotions_approved`; clear the inbox and record the discard count.

**d. Archive the working set (authorized move, only after `close-feature` succeeded).** Ask
first. With authorization: create `.claude/plans/_archive/{NNN}-{slug}/`, move everything
except `spec.md` and `retro.md` (a file a tracked script or skill still reads stays, named
in the README row), then `git rm --cached -r` the moved paths and add the plan's row to
`plans/README.md` §Closed features. Without authorization: action item "archive working
set". Under a company plans policy nothing is tracked; report where the durable outcome went.

| `retro_status` | Meaning | Owner |
|---|---|---|
| `pending` | `retro.md` produced, awaiting human ratification; `feature_closed` stays `false` and the plan still appears in `flow-state.ts status` | The user ratifies; the Lead never self-approves |
| `approved` | Ratified; promotions and deltas applied; `close-feature` succeeded | The Lead, after the user's explicit decision |

A retro left `pending` is the documented back-half abandonment mode (audit 2026-06-30): it
is "awaiting you", not "done".

## Step 13 — Report and request ratification

```text
🟢 Retro produced for {NNN}-{slug}.
- retro.md: .claude/plans/{NNN}-{slug}/retro.md · retro_level: <light|standard|full> (<reason>)
- Lessons: <✅ N> / <❌ N> · heaviest phase: <phase> (<reason>)
- Promotion candidates: <N> (global: … · local: … · memory: … · lessons: …)
- Spec drift action: <none | propose-diff | log-creep | log-skipped>
- Commandments: <X/10 ✅, Y ⚠️, Z ❌> · action items: <N>
- drillme-clarify: <categories covered, gaps>

Pending your approval: ⚪ promotions · ⚪ living-spec diff · ⚪ violation actions
Feature lifecycle closure: <pending | done>
```

## SIEMPRE rules

- Never a retro with zero ❌ lessons unless zero friction genuinely occurred.
- Never auto-edit `spec.md`; never auto-apply a promotion.
- Concrete evidence per lesson, promotion and violation; no abstract claims.
- Glob the target path before proposing a promotion.

## Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| Synthetic promotion | No evidence from this feature | Remove; declare zero honestly |
| Auto-edited spec | `spec.md` changed in the retro session without approval | Revert; propose as a living-spec diff |
| Green audit without evidence | Ten ✅ with one-word evidence | Re-audit with file:line or commit refs |
| Wrong promotion scope | Project-specific pattern promoted to global | Reclassify to local |
| Closed with promotions pending | Feature closed while `promotions_approved < promotions_proposed` | Reopen or carry them as explicit action items |
| Delta routed wrong | `scope_creep` labeled `legitimate` | Re-check the three criteria; demote |
| Near-duplicate promotion | Candidate duplicates an existing skill | ❌ lesson "missed existing X"; redirect to "improve X" |
