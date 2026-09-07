# Research dossier — poneglyph evolution (2026-05-29)

> Durable spec-input. Produced from 14 parallel read-only research agents (4 audit + 3 design repos + 5 design corpus + 2 activation). Feeds two prospective features: **A) skill-activation overhaul** and **B) visual-layer / html-report taste**. Verify every claim before building (Cmd II) — sources cited inline.

---

## Part A — Skill-activation overhaul

### Problem (verified)
- `prompt-enrichment.ts` (UserPromptSubmit hook, the "Arch H step 1") is referenced in 4+ live docs but **was never implemented** — phantom. Auto-activation relies solely on the Lead's manual keyword-match.
- Project still documents Arch H as the canonical mechanism; research shows it predates current Claude Code and is **over-engineering** vs native behaviour.

### Findings (2 agents, official docs + community 2026)
| # | Finding | Source |
|---|---|---|
| 1 | Native auto-activation = **LLM fuzzy-match of the user message against `description` + `when_to_use`** (combined cap ~1,536 chars; per-field `description` ≤1024). No keyword indexing, no regex, no hook. | code.claude.com/docs/en/skills |
| 2 | Activation rate scales with description quality: vague ~20% → "Use when + keywords" ~50-72% → with concrete examples ~72-90%. | scottspence.com evals (community, methodology uncited → treat as directional) |
| 3 | `activation.keywords` is **not** an official field — silently ignored (matches existing poneglyph memory). | docs + local memory |
| 4 | Skills/commands **merged**: `skill name == /command`. | docs |
| 5 | **No native skill-calls-skill API in the main session.** Chaining = (a) text workflow ("now run /x"), (b) `context: fork` spawns a subagent, (c) subagent **`skills:` frontmatter field preloads skills** (official) — this REPLACES the manual "Arch H Read SKILL.md" workaround, (d) `run-skill-generator` writing a skill file other skills load. | docs + DeepWiki(impeccable) |
| 6 | `paths:` glob → context-scoped activation. `disable-model-invocation:true` → never auto-loads (hide from Claude). `user-invocable:false` → hidden from `/` menu but description stays in context (background knowledge). | docs |
| 7 | Post-compaction, invoked skills re-attach up to a **25K-token shared budget**, newest first — large SKILL.md get evicted. Keep body <500 lines; push detail to `references/`. | docs + community |
| 8 | Optional: a minimal SessionStart/UserPromptSubmit hint hook can push activation ~100% IF native isn't enough — but only a hint list, not routing logic. UserPromptSubmit is reliable; PreToolUse/PostToolUse may silently fail (#6305). | claudefa.st |

### Description pattern that works (canonical)
`[Capability statement]. Use when [trigger 1], [trigger 2], or when the user says "[phrase]", "[phrase]".` — third person, keyword-first (first ~50 chars matter).

### Recommended scope (NOT pre-committed — scope phase decides)
1. **DROP** Arch H phantom hook + scrub its refs (CLAUDE.md Arch H ¶, `orchestrator-protocol/SKILL.md:78`, `references/06-context-arch-h.md:113`, `docs/arch-h-lead-directed-skill-reads.md`, `skill-matching.md` wrong path).
2. **UPGRADE** all 20 skill `description` fields to the canonical "Use when + triggers" pattern. Highest-leverage lever, zero infra.
3. **ADOPT** native subagent `skills:` field to replace the manual "Read SKILL.md" delegation block (verify the field is supported in this harness version first).
4. **OPTIONAL** minimal hint hook only if measured activation stays low after (2)+(3).
5. **Skill chaining**: use text-workflow / `context: fork` for "skills forcing skills" — no custom mechanism.
- Global+local: both `~/.claude/skills/` and project `./.claude/skills/` (here same via symlink; diverge elsewhere) — descriptions must carry their own activation; no central registry needed.

### AC seeds
- AC: every skill `description` follows the canonical pattern + verified to auto-activate on a representative prompt (empirical test, log activated vs missed).
- AC: zero live references to `prompt-enrichment.ts` / phantom Arch H paths remain.
- AC: `bun test ./.claude/hooks/` still green.

---

## Part B — Visual-layer / html-report taste

### Current state (verified)
- **Skill `html-report` already exists** (plan 003, PAUSED at Phase 3). Design+Build complete: 5 files in `.claude/skills/html-report/`. It already: renders markdown→self-contained HTML, has C1-C8 component inventory + sacred `tokens.css`, editorial/anti-generic doctrine (no purple, warm paper, deep teal, serif, tabular numerals), invokes builtin `frontend-design`, dark/light + print + a11y.
- **Pending for 003**: verify render (002 report.md → HTML), Phase 4 critic, Phase 5 retro, closure. Then Ola B (governance) + Ola C (native integration). Resume: `/flow --resume 003-html-report-skill`.
- User's clarified purpose: **"capa visual de reportes que markdown no da"** — exactly html-report's charter. So B is **finish + elevate**, not build-from-scratch.

### Reference projects studied (all real, all Claude Code skills, MIT/Apache — vetted)
| Repo | ★ | Author credibility | Core transferable |
|---|---|---|---|
| pbakaus/impeccable | 31k | Paul Bakaus (jQuery UI, ex-Google) | Absolute-Bans vs Guidelines split; 23 named command verbs (`polish`/`distill`/`quieter`); deterministic CLI (24 rules) + LLM critique layering; brand-vs-product register; vocabulary injection |
| leonxlnx/taste-skill | 27k | community | 3 numeric dials (DESIGN_VARIANCE/MOTION_INTENSITY/VISUAL_DENSITY 1-10); "Production-Test Tells" forensic catalog; Pre-Flight Check as hard gate; aesthetic variants as separate files |
| emilkowalski/skill | 1.8k | Emil Kowalski (Sonner/Vaul/animations.dev) | 4-question animation gate; timing budgets; named anti-patterns ("never scale from 0", "never ease-in for UI") |
| Anthropic frontend-design (builtin, plugin) | — | Anthropic official | The canonical anti-slop substrate html-report already builds on. Generative-only — NO critique/audit mode (the gap a taste layer fills) |
| vercel-labs/agent-skills | 27k | Vercel Labs | 100+ accessibility/UX/perf rules (quality-gate angle) |
| addyosmani/web-quality-skills | 2.1k | Addy Osmani (Chrome team) | Core Web Vitals / WCAG technical quality |

### "AI slop" root cause + tells (consensus catalog)
Root cause: LLMs emit the statistical median of training data; Tailwind's `bg-indigo-500` demo default cascaded into the purple-gradient signature (prg.sh, dev.to/alanwest). Tells: Inter/Roboto/Arial · purple→blue gradients · pure black/untinted greys · beige/brass "premium" · cards-in-cards · equal 3-col icon-above-heading grids · centered everything · em-dashes · bounce/elastic easing · gray text on colored bg · rounded-square icon tiles above headings.

### Design-taste corpus to encode (from reputable primary authorities)
**Spacing**: 4px base, all multiples; no two scale steps closer than 25%; start with too much whitespace; more space between groups than within. (Tailwind, Refactoring UI)
**Typography**: line length 45-75ch (`max-width:65ch`); no font weight <400; headings 500-600 not 700; one modular ratio (1.25/1.333); line-height 1.5 body / 1.1-1.25 headings; tabular-nums for data; don't center long-form. (Rauno, Refactoring UI, Vercel Geist)
**Color**: full palette upfront (8-10 shades/hue); tint greys (never neutral #808080); design in grayscale first; prefer OKLCH (HSL fallback); rotate hue for dark shades; WCAG AA 4.5:1 text / 3:1 large+UI (hard). (Refactoring UI, Josh Comeau, shadcn/ui)
**Hierarchy**: color+weight+size together, not size alone; emphasize by de-emphasizing; button hierarchy solid→outline→link; fewer borders (use space/shadow/bg). (Refactoring UI)
**Depth**: single light source, shadow offset ratio 2:1 v:h; elevation = offsets grow + opacity drops; hue-matched shadows not black; layer multiple shadows. (Josh Comeau)
**Motion**: purpose gate + frequency gate (100+/day → no animation); ≤200-300ms component / longer only for full-screen (MD3); easing by direction (ease-out enter, ease-in exit, ease-in-out on-screen, ease hover); custom cubic-bezier > built-ins; origin-aware transforms; scale from 0.9+ not 0; GPU-only (transform/opacity); `prefers-reduced-motion` mandatory; theme-switch must NOT transition. (Emil, Rauno, Comeau, web.dev, MD3, NNGroup)

### Highest-leverage authoring patterns (cross-repo consensus)
1. **Negative vocabulary / Absolute-Bans** is the #1 lever — concrete, testable, overrides training priors better than positive guidance.
2. **Calibrate before code** (dials / register / "read the room") — declare aesthetic intent before generating.
3. **Deterministic + LLM layering** — mechanical checks (contrast, font, padding) cheap/deterministic; judgment (hierarchy, resonance) via LLM critique.
4. **Mandatory pre-flight checklist as GATE** ("if any item fails, not done").
5. **Named command verbs** — shared vocabulary (`polish`/`quieter`) for fast feedback.
6. **Critique/audit mode** — the gap frontend-design + html-report both lack.

### Recommended scope (scope phase decides skill-vs-enhance)
- **B1 (quick win)**: resume + close plan 003 (verify render → critic → retro). It's ~80% done.
- **B2 (taste elevation)**: layer the corpus above onto html-report. Open question for scope: a **separate `design-taste` reference** html-report (+ future surfaces) consume, vs **enhance html-report in place**. User earlier leaned "skill propia destilando 3 refs"; purpose-clarification leans "it IS the visual-report layer (html-report)". Resolve in scope — guard Cmd X (no duplication of frontend-design / html-report).
- Add: Absolute-Bans section, a critique mode, a pre-flight checklist gate, the motion/color/type hard-rules as `references/` (keep SKILL.md <500 lines, finding A7).

### AC seeds
- AC: html-report verified rendering 002 report.md offline (the paused 003 smoke test) — closes 003.
- AC: taste corpus encoded as `references/` with an Absolute-Bans list + WCAG/contrast hard rules + motion budget; SKILL.md stays <500 lines.
- AC: a critique/audit mode that flags AI-slop tells in a given HTML/CSS output.

---

## Security note (user asked: "revisa no tener ningún virus")
Third-party Claude skills are a **documented attack surface** (MedusaLocker fork-poisoning — Cato Networks; AMOS stealer via 39 "ClawHub" skills — Trend Micro; prompt-injection inside SKILL.md/references; `settings.json`/`ANTHROPIC_BASE_URL` injection). **Vetting checklist (study, never blind-install)**: clone don't run installers → read SKILL.md + every `references/` for injected instructions/base64/unicode → inspect `scripts/` for network calls → reject bundled `.claude/settings.json`/`hooks`/`.mcp.json` → verify owner not a recent fork → prefer manual copy of SKILL.md over `npx`/`curl|bash` → pin to commit SHA. We are STUDYING these repos, not installing — risk is low, but any code adopted must be hand-read first.

## Key sources
Activation: code.claude.com/docs/en/skills · platform.claude.com/docs/.../agent-skills/best-practices. Design substance: github.com/raunofreiberg/interfaces · refactoringui.com · joshwcomeau.com (shadows, color-formats, css-transitions) · vercel.com/geist · ui.shadcn.com. Motion: emilkowal.ski · animations.dev · m3.material.io · nngroup.com/articles/animation-duration · web.dev/animations-guide. Repos: github.com/{pbakaus/impeccable, leonxlnx/taste-skill, emilkowalski/skill, vercel-labs/agent-skills, addyosmani/web-quality-skills, anthropics/claude-code}. Slop+security: prg.sh · catonetworks.com (MedusaLocker) · truefoundry.com.
