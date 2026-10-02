---
spec: 039-design-system
phase: 5
retro_level: full
retro_level_reason: two absorbed decisions (X1 look to 040, AC6 offer descoped) and legitimate spec drift
verdict_phase4: APPROVED_WITH_WARNINGS
spec_drift: legitimate
promotions_proposed: 3
promotions_approved: 2
commandment_violations: {warning: 3, violation: 0}
living_spec_delta: applied
action_items: 8
created: 2026-10-02
status: approved
---

# Retro — 039 design system

## Resumen

Problem (spec.md): "There is no recorded design system, neither in Poneglyph nor as a method for other repos." The HTML outputs looked like three products with three palettes.

Delivered: one token source (`templates/tokens.css`, generated into `theme.ts` and checked by `tokens.ts --check`), every template on it with AA contrast measured in both themes, dark-first dashboard/glance/decision, v1 leftovers removed, the published Design System Artifact matching the repo by sha256, and a design-file step in `ui-design` (read `docs/DESIGN_SYSTEM.md` and friends; never create one before a yes).

How it went: friction. US1–US6 and US8 closed in one build day. Review found AC6 failing, and a fix round of four headless runs moved activation from "never" to "usually" but never produced the extraction offer. The user closed with a warning. The X1 look was judged a redesign and moved to 040.

## Lecciones técnicas

### ✅ Patterns that worked

- **One generated token source with a divergence test**: `tokens.css` → `tokens.ts --write` → `--check` plus `tokens.test.ts` pins. Every template drift since then fails a test. Reuse for any multi-surface theme.
- **sha256 read-back after publishing**: AC7 was proven by comparing the exported `project/tokens.json` with the published copy, not by trusting the publish result. Reuse for any external artifact sync.
- **Behavioral probe in throwaway git repos**: `git status` in `scratchpad/v76/{with,without}` proved "no design file created" mechanically in every run. Cheaper and stronger than reading transcripts.
- **Held-out prompt set**: a third prompt set, written before looking at results, exposed that the tuned keywords had 0/11 coverage and one false positive.

### ❌ Patterns that didn't work

- **Tuning activation keywords on the probe prompts**: article+noun and single-word keywords scored 4/4, then 5/5 on the sets used to pick them, then 0/6 on held-out prompts. Avoid: write held-out prompts first; measure there only.
- **Reading activation from `stream-json`**: I claimed the hint never fired; the hook's hint is not in the stream. Proof lives in `<cwd>/.claude/learned/skill-hints.log`. Avoid: check the hook's own log before claiming non-activation.
- **Instruction text as the fix for a dropped step**: even with `Skill(ui-design)` loaded (r2, r3) and the new step 0 visible in the transcript, the model never made the extraction offer. Two rewrites of the text (end-of-report offer, `Aviso:` line) changed nothing. Probable cause: the house style's rule against closing with offers [Probable — not isolated]. Text tweaks without a hypothesis test are a louder retry.
- **State evidence drifted from the published artifact (F4)**: US8 evidence names hash `09e0f154…`; the published file is now `f517d8ad…`, equal to today's export. The republish was never recorded. Avoid: record every republish in state notes.
- **Print capture at t=0**: headless `--print-to-pdf` caught the dashboard mid `pagefade` and rendered it washed out. Use `--virtual-time-budget=3000`.

## Proceso

| Phase | Effort | Friction observed | Improvement candidate |
|---|---|---|---|
| 1 scope | M | none notable | — |
| 2 plan | M | 295-min budget set | — |
| 2.5 test plan | S | V7.6 written as "offers and waits" while AC6 only forbids files; the mismatch surfaced in review | Oracle wording must quote the AC's verb |
| 3 build | L | US7 behavioral AC left `[OPEN — probe next session]` | Run a behavioral probe at build time when it is cheap (one `claude -p`) |
| 4 review | XL | 4 probe runs, keyword overfitting, budget trimming, two escalations | Heaviest phase |

- **Heaviest phase**: review. The cause was the behavioral AC deferred from build: the first live evidence arrived in review, so every fix loop ran there.
- **Avoidable friction**: running V7.6 once during build would have found the activation gap two phases earlier.
- **Time budget**: 295 min planned from gate 2→3 (2026-09-29). Work spread over 2026-09-29 to 2026-10-02 across sessions; no single clock reading covers it, so the overrun is not measured [Suposición — budget exceeded, based on the review alone taking several hours].

## Drillme — Phase 5 (Socratic check)

1. `[approach]` Review weighed more than needed: yes, because the behavioral AC was deferred. Covered above.
2. `[failure]` Avoidable friction: keyword overfitting and the `stream-json` misread. Both are lessons above.
3. `[context]` Reusable pattern: held-out prompts before choosing keywords; generated token source plus divergence test.
4. `[location]` The keyword lesson is cross-project (memory). The print-capture fact extends an existing memory. The eval case is local.
5. `[failure]` Silent commandment breach: `budget-snapshot.json` ratified other sessions' growth (F3). Recorded under IX.

Gap gate: no remaining question changes the closure. Zero open gaps.

## Promociones candidatas

| Candidate | Scope | Type | Why (evidence) | Concrete proposal |
|---|---|---|---|---|
| Keyword activation needs held-out prompts | memory | memory | 0/11 held-out vs 5/5 tuned; hint fired but not honored in r4; invoked skill still skipped the offer in r2–r3 | New memory `feedback-keyword-activation-held-out.md` linked to `feedback-skill-wiring-over-autotrigger` |
| Headless print waits for entrance animations | memory | memory update | `dash.png` washed out at t=0, clean with `--virtual-time-budget=3000` | Add one line to `feedback-visual-probe-harness.md` |
| ui-design trigger case | local | eval case | V7.6 prompt never triggered the skill before the keyword, honored 2 of 3 times after. Caveat: it tests the trigger, not the missing offer, and at 2/3 it would be flaky | Append to `.claude/evals/cases.jsonl`: `{"id":"skill-uidesign-32","prompt":"Añade un botón «Guardar» junto a «Cancelar» en index.html, con el color de la marca y el mismo estilo que el resto de la app.","type":"skill-trigger","grader":"skillTriggerParse","expected":"ui-design","source":".claude/plans/039-design-system/retro.md"}` |

Collision check: `cases.jsonl` has 31 rows and no `ui-design` case; the memory index has no keyword-activation entry.

## Living-spec deltas

- **Section**: AC6.
- **Proposed diff**: "…then it does not create files until the user says yes; on no, it continues with the current sibling-component method. The extraction offer is a follow-up (retro 039)."
- **Reason**: four runs show the offer is not reliably produced by skill text; the user decided on 2026-10-02 to close with a warning.

- **Section**: Out of scope / X1.
- **Proposed diff**: "The X1 look acceptance moves to feature 040 (three glance directions). Contrast and AA stay in 039."
- **Reason**: user decision in review; the look needs a redesign, not a polish.

Both deltas meet the three criteria: found in review, consistent with the spec's intent, documented with the finding. Neither is applied until you approve it.

## Commandments check

| # | Status | Evidence |
|---|---|---|
| I | ✅ | Reuse scan found `tokens.css` and `theme.ts` before building; render.ts inlines the shared file |
| II | ⚠️ | Claimed "the hint never fired" from `stream-json`; corrected with `skill-hints.log` |
| III | ✅ | AC6 reported as partial, not passed; the offer failure stays a MINOR |
| IV | ⚠️ | Keywords were tuned on the probe prompts (test fitting); caught by the held-out set before closure |
| V | ✅ | One token source; templates import, never copy |
| VI | ✅ | No destructive operations; `canary.log` left for your consent |
| VII | ✅ | Activation proven through the hook log; divergence check fails loudly |
| VIII | ✅ | Fresh reviewer prompt scoped read-only with explicit ACs |
| IX | ⚠️ | `budget-snapshot.json` also carries other sessions' growth (F3) |
| X | ✅ | Inline build; one fresh reviewer; probe on the mid tier as approved |

### Forensics

- **II**: happened at r1 analysis. Alternative: read the hook's log first. Action: the keyword memory records where hint evidence lives.
- **IV**: happened in the second and third keyword rounds. Alternative: write the held-out set before the first round. Action: same memory.
- **IX**: happened when `--update` ratified the US7 body growth. Alternative: ratify per skill. Action: ship the snapshot with the work it measures at commit time.

## Action items

| Action | Owner | Trigger | Due |
|---|---|---|---|
| Approve or reject the two spec deltas | user | this retro | now |
| Approve or reject the 3 promotions | user | this retro | now |
| Investigate the dropped extraction offer (style rule hypothesis, held-out prompts) | next session | after 040 starts or on demand | — |
| Harden `tokens.ts` blind spots (F1) | 040 | template rewrite | 040 |
| Check the grey print blocks behind `render.ts` KPI cards (pre-existing) | 040 | print pass | 040 |
| Commit `budget-snapshot.json` with the work it measures (F3) | user | commit time | — |
| Delete `templates/.claude/learned/canary.log` | user | consent | — |
| Archive the 039 working set | user | after close-feature | — |

## Feature closure gate

- [x] Every HU has verified closure in state.json (8/8)
- [x] The approving review checks every requirement (AC6 partial, recorded)
- [x] Retro decisions ratified
- [x] `retro-status approved` and `close-feature`
- [x] Working set archived to `_archive/039-design-system/` (`impeccable-baseline.md` included, input for 040)

## Ratification (2026-10-02)

The user ratified everything (AskUserQuestion, "Ratificar todo"): both spec deltas applied to `spec.md` with the v2 note; both memories written (`feedback-keyword-activation-held-out`, one line in `feedback-visual-probe-harness`); the eval case discarded as flaky; working set archived; `canary.log` deleted.
