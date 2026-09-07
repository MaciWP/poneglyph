# Plan 032 — Skill diet ledger

One row per skill body and one block for the description pass. Bytes measured with `wc -c` (bodies) and `Buffer.byteLength` (activation surface, via `scripts/lib/budget.ts`) on 2026-09-03, 30 skills after WP2. Classes: keep · relocate (path) · dedupe (owner). Nothing was deleted: every relocated block sits in the reference named, faithful to the original — verbatim except one pointer updated while moving (drillme's principle paragraph: `§Honesty mechanics` → `§Truth`, a style section that no longer existed; review E11). Independent check (validation.md E10): whitespace-normalized 10-word windows of every HEAD body found no lost block across the nine skills. Activation check = live probes (`probe-activation.ts`, 11 prompts, `claude -p --output-format stream-json`, Fable, plan mode, 2 turns) before → after, plus `bun .claude/evals/run.ts`.

## Bodies

| Skill | Before (B) | After (B) | Δ | Relocated (section → path) | Deduped (section → owner) |
|---|---|---|---|---|---|
| dev | 11132 | 9781 | −12 % | Worked example → `references/01-worked-example.md` (+ compact rendering variant) · Diff review lens + Debt harvest → `references/02-on-request-lenses.md` | "Full loop is non-negotiable" paragraph → CLAUDE.md §The dev loop · git/spawn gate bullets and rows → CLAUDE.md (WP3) |
| drillme | 15630 | 12427 | −20 % | Underlying principle → `references/05-principle-and-evidence.md` · Worked example (22 questions) → `references/06-worked-example.md` | — (Step 3 rounds floor rewritten per D7; anti-pattern renamed Premature close) |
| orchestrator-protocol | 17020 | 15591 | −8 % | Spawn-tree mermaid → `references/10-spawn-decision-tree-diagram.md` · Removed-references table → `references/11-history.md` | §0 tool table → `anti-hallucination` · Multi-round paragraph → `drillme` · Tier table → CLAUDE.md §Agent spawn (WP3) |
| scope | 16365 | 14635 | −11 % | Principle rationale + post-impl verification → `references/01-history.md` · Auxiliary table → `docs/auxiliary-skills-matrix.md` §Fallbacks | — |
| tech-plan | 22631 | 18616 | −18 % | Principle rationale + Legacy migration + post-impl verification → `references/07-history.md` · Auxiliary table → matrix §Fallbacks | — |
| tdd-design | 18318 | 16487 | −10 % | Principle rationale + post-impl verification → `references/01-history.md` · Auxiliary table → matrix §Fallbacks | — |
| build | 22779 | 19857 | −13 % | Principle rationale + Execution-model history + post-impl verification → `references/01-history.md` · Auxiliary table → matrix §Fallbacks | — |
| critic | 23374 | 23259 | −0.5 % | Principle rationale → `references/03-history.md` | — (auxiliaries already in its references) |
| retro | 20992 | 20875 | −0.6 % | Principle rationale → `references/03-history.md` | — (auxiliaries already in its references) |
| **Total (9)** | **168241** | **151528** | **−10 %** | | |

**Ceilings (plan: 8 KB dev/drillme/orchestrator, 12 KB phase skills) were NOT reached** — deliberately. After relocating every block that is rationale, history or example, what remains in each phase skill is procedure: workflow steps, gates, artefact contracts, SIEMPRE rules, anti-patterns, edge cases, output format. D11 (no loss of quality, information or activation) outranks D9's numbers. Getting critic/retro/build under 12 KB would mean moving workflow steps behind a Read per step — a behavioural change to `/flow`, not a relocation — so it is declared `ponytail: phase skills 15–23 KB; upgrade trigger = a measured /flow run showing the step detail is not consulted, or a per-step progressive-disclosure design ratified by Oriol`.

## Descriptions (`description` + `when_to_use`, 30 skills)

| Measure | Before (B) | After (B) |
|---|---|---|
| description | 16112 chars | unchanged (no trigger phrase removed) |
| when_to_use | 4206 chars (quoted-phrase blocks) | 2705 chars |
| loaded surface (bytes, budget.ts) | 21206 | 19681 |

Method: `desc-dedupe.ts` removed from `when_to_use` only the 81 quoted phrases already present verbatim in `description` (26 skills); every phrase still appears exactly once in the loaded surface. The 16 KB ceiling was not reached: the remaining text IS the activation surface, and D11 forbids trimming it. Two descriptions (dev 818, frontend-craft 848 chars) are long but every sentence names a trigger.

## Always-loaded budget (bytes, `bun .claude/scripts/budget.ts`)

| Layer | Pre-032 (2026-09-02) | After WP2/WP3 (snapshot 2026-09-03) | After WP4 dedupe |
|---|---|---|---|
| CLAUDE.md | 12836 | 12927 | 12927 |
| output-styles/poneglyph.md | 11979 | 11930 | 11930 |
| rules always-on | 3556 | 3464 | 3464 |
| skills: description + when_to_use | 22520 (32 skills) | 21206 (30) | 19681 |
| **Total** | **50891** | **49527** | **48002** |

WP5 (style §2 rules, CLAUDE.md compact rendering) adds a few hundred bytes; the snapshot is re-taken (`--update`) once at the end of the pass so the ratchet starts from the final size.

## Activation (D11)

| Check | Before | After |
|---|---|---|
| Live probes (11 prompts, `before.json` / `after.json`) | 8/11 hit — misses: skill-drillme-01, skill-techplan-02, probe-tech-plan (no `Skill()` call; the model explored the repo instead) | 8/11 hit — misses: skill-drillme-01, probe-tech-plan, probe-tdd-design; skill-techplan-02 now hits |
| Rerun of the three unstable cases ×2 (`after-rerun.json`) | — | tdd-design 2/2 (the single miss was noise) · drillme 1/2 · tech-plan 0/2 |
| Verdict (D11) | — | **No skill that fired before stopped firing after.** The two unstable prompts (drillme "valida este plan…", tech-plan "descompón esto en tareas…") were already unstable in the baseline: with `--max-turns 2` the model spends its turns looking for a plan/spec file before calling `Skill()`. Same model, same prompts, same hook. |
| `bun .claude/evals/run.ts` | 20/20 (2026-09-02) | Full suite after WP5 with the `when_to_use` dedupe in place: 17/20 (style clusters 16/16; skill-trigger 1/4, then 0/4 ×2 while the claude.ai quota was exhausted, then 1/4 with quota back). **After restoring `when_to_use` from HEAD: 3/4** (drillme misses, as in the baseline). Conclusion: `when_to_use` is weighted by the host — never dedupe it against `description`. The dedupe is reverted; the −1 525 B is given back |
| `claude plugin validate .claude` | passed | passed after every edit |

## Final budget — corrected after the independent review (F1/E7, 2026-09-03)

The first version of this table reported −3.7 %. It was an accounting artefact: `measure()` counted only `.claude/skills`, and the two skills WP2 moved to the private plugin still load their `description` + `when_to_use` on this machine (plus the new `lessons-work`). `lib/budget.ts` now reads `~/.claude/plugins/installed_plugins.json` and adds the installed plugins' surface as its own row; both sides below use that code path (HEAD figure from validation.md E7, `git archive HEAD` + `measure()`).

| Layer | HEAD `ecd56cf` (pre-032) | End of 032 | Δ |
|---|---|---|---|
| CLAUDE.md | 12927 | 13200 | +273 (plugin routing line, compact rendering) |
| output-styles/poneglyph.md | 11979 | 12688 | +709 (measurable visual rules, separator ban, Artifact rule; −1 co-author bullet) |
| rules always-on | 3556 | 3464 | −92 (worktrees row removed) |
| skills in the repo: description + when_to_use | 22792 (32 skills) | 21200 (30 skills) | −1592 (the 2 moved skills) |
| installed plugin `poneglyph-work`: description + when_to_use | 0 | 2360 | +2360 (the 2 moved skills + new `lessons-work`) |
| **Experienced total (this machine)** | **51254** | **52912** | **+1658 (+3.2 %)** |

**H1 was not met and the pass made the per-turn surface slightly heavier.** What 032 bought instead: public/private separation (D5), single ownership of the gates (D8), guard rails (WP1/WP6), −10 % per-invocation weight on the nine diet skills, and the visual/compact rules Oriol asked for (D6/D2). The 81-phrase `when_to_use` dedupe (−1 525 B) was **reverted** on 2026-09-03 after the evals' skill-trigger cases dropped to 1/4 under runner conditions with it in place — see §Activation. Reducing the surface further without touching trigger text means cutting whole skills by usage census or shortening doctrine prose (CLAUDE.md, style): both are Oriol's decisions (V1).
