# Research Rigor Method (promoted from feature 018, ratified 2026-06-10)

Reusable method for any evidence/research feature. **Runner:** skill `deep-research` (session-first; agents only on residual gaps, ≤10, prompts seeded with the session SEED pack). Proved across 5 dossiers + a 2-round adversarial audit in 018-evidence-roadmap.

## Evidence tiers

| Tier | Definition |
|---|---|
| **A** | Peer-reviewed / RCT / benchmark with public methodology |
| **B** | Vendor-measured internal data, labeled `[vendor]` |
| **C** | Practitioner report with concrete numbers |
| **D** | Opinion / anecdote without numbers |
| **T1** | Primary-source local file read (configs, installed code) |

## Rules

1. **Decision rule**: a design change requires ≥1 A/B (or T1) source with no known A/B contradiction. C/D never ground decisions — inspiration/color only, labeled.
2. **Quote-anchored numbers** (P1, the 018 lesson): every numeric claim sourced from an external document carries a verbatim quote anchor — or an explicit `[Probable]` / `UNVERIFIED` marker. *Precision inflation* (exact numerals attached to sources that support only the qualitative claim) was the ONLY failure class the 018 audit found; this rule is its antidote. Applies to finder prompts, refuter prompts, and the critic checklist for research artefacts.
3. **Adversarial refuter pass**: every decision-changing claim goes through a second agent instructed to REFUTE it against the primary source. Not optional — the 018 refuters caught material errors in every single round (wrong issue numbers, stale counts, misattributed metrics, one fully refuted clause).
4. **Counter-evidence mandate**: each workstream actively searches for negative results. Research without counter-evidence is marketing.
5. **Claim format**: assertion + tier + URL + date (+ model-era flag where benchmarks are involved). `UNVERIFIED` explicit when confirmation failed.
6. **Critic independence**: the Phase 4 sampler audits claims NOT covered by build-time refuters — overlap destroys independence and hides corpus-level failure classes.
7. **Contradiction check** (P4, wired via orchestrator-protocol — roadmap 020.2): when ≥2 parallel agents cite the same source or fact, diff their claims before writing artefacts.
8. **Seeds discipline**: prior verified findings are ground truth with explicit "extend, don't repeat" exclusion lists in finder prompts.

## Delegation template per research agent (Commandment VIII)

Objective · numbered tasks · constraints (tiers, quote-anchors, UNVERIFIED, counter-evidence, exclusion list, tool-call cap) · deliverable format. Agent's final message = raw data for the orchestrator, never prose for the human.

## Provenance

Feature 018-evidence-roadmap (5 workstreams, 21 agents, verdict APPROVED_WITH_WARNINGS). Detail archived under `.claude/plans/_archive/018-evidence-roadmap/{spec,review,retro}.md` (historical — read only for provenance).

## Terminal output — evidence note (2026-09-03, plan 032/WP5)

Bounded pass (inline, no agents) behind the visual rules in `output-styles/poneglyph.md` §2. Tier per rule 1 above; quotes anchor every claim.

| Source | Tier | What it says (quote-anchored) | Adopted in §2? |
|---|---|---|---|
| Command Line Interface Guidelines, clig.dev §Output | C | "Humans come first, machines second." · "Display output on success, but keep it brief." · "If you change state, tell the user." · "Use color with intention … Don't overuse it." · "Use symbols and emoji where it makes things clearer" | Yes: name every state change; icons/symbols only when they distinguish (already: one status icon per item) |
| Google developer documentation style guide, Tables | C | Use a table when "each item is three or more pieces of related data"; introduce a table with "a complete sentence that describes the purpose of the table"; single-column data → a list, never a table | Yes: ≥3 fields per item → table (matches §5 "≥3 peer records"); one-column → list; one-sentence lead-in before a table |
| Nielsen Norman Group, "How Users Read on the Web" | B (measured usability study) | Scannable layout +47 % usability, concise +58 %, combined +124 %; "half the word count (or less)"; highlighted keywords, meaningful subheadings, one idea per paragraph, inverted pyramid | Already the law (Al grano, Cost, one idea per sentence, bold anchors) — no new rule |
| GitHub Primer CLI guidelines | — | Fetch returned the design-system homepage, no CLI output rules | Not used |

Counter-evidence looked for: none of the sources argues for more prose or decorative separators; NN/g warns that promotional/filler language slows reading — consistent with the §1 kill-list. Decision rule satisfied (one B source, no A/B contradiction).
