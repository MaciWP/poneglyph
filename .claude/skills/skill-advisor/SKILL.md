---
name: skill-advisor
description: |
  Propone un shortlist ratificable de las skills relevantes y pregunta cuáles activar.
  Úsala cuando dos o más skills podrían aplicar y la tarea no nombra ninguna, en fronteras de fase de /flow, o a petición.
metadata:
  keywords: >
    Keywords - skill-advisor, skill routing, shortlist, activar skill, propón skills,
    propón las skills relevantes, qué skills uso, qué skills uso para esto, qué skill aplica,
    qué skill aplica aquí, no sé qué activar, drillme de skills, which skills apply,
    suggest relevant skills, what skill should I use here, qué skills necesito
disable-model-invocation: false
---

# skill-advisor — propose→ratify skill shortlist

> The deterministic backstop to skill under-triggering (research: native auto-activation
> infra-dispara y no se puede forzar). This skill does NOT force invocation — it makes
> the Lead **consider** the right skills and lets the human ratify. The cheap always-on
> surfacing lives in the `skill-activation.ts` hook; this skill is the deeper, ratified pass.

## When to run

- A `/flow` phase boundary (Phase 1→2→2.5→3→4→5) — auto-activation is weakest where there is no open file and the request is conceptual.
- The Lead is about to do real work without having considered the available skills.
- On demand: the user asks "qué skills aplican" / "propón skills" / "drillme de skills".
- NOT on trivial conversational turns (loading skills there is ceremony).

## Workflow

1. **Get the task** — the current user request or phase context (one line is enough).
2. **Rank** — call the pure pre-filter:
   ```ts
   import { rank, loadSkillsFromDisk } from "./lib/rank";
   const skills = loadSkillsFromDisk([".claude/skills", `${process.env.HOME}/.claude/skills`]);
   const shortlist = rank(task, skills); // ≤5, deduped, [] if nothing matches
   ```
   Then reason over the shortlist + the in-context skill listing (the descriptions are already
   in your context) to add any semantically-relevant skill the lexical pre-filter missed
   (e.g. Spanish/novel phrasing). Do NOT build a keyword index — keywords have ~0 measured effect.
   The ranker breaks lexical ties with census-derived usage tiers (`USAGE_TIER` in `lib/rank.ts`,
   refreshed at each census) — real usage beats alphabet, lexical score beats both.
3. **Auto-invoke the obvious one (031)** — skip ratification and invoke `Skill(<name>)` directly,
   SAYING SO ("auto-invoco X: <motivo>"), when either executable condition holds:
   - exactly ONE candidate survives step 2 (lexical + semantic pass agree on a single skill), or
   - the task matches a mandatory row of `rules/skill-routing.md` (that table already carries
     the user's standing ratification).
   Anything else → step 4. Never auto-invoke two-or-more "obvious" skills — plural = doubt.
4. **Ratify** — present the shortlist to the human via `AskUserQuestion`:
   - One option per candidate: label = skill name; description = **concrete reason it applies +
     confidence (alta/media/baja)** — not a generic blurb.
   - multiSelect: true — the user picks which to activate.
   - Below the options (in the accompanying text), list the near-miss candidates DISCARDED with a
     one-line motive each ("descartada Y — matchea 'valida' pero es la fase 4 de /flow, no aplica").
   - If the shortlist is empty, say so plainly ("ninguna skill aplica claramente") — never invent.
5. **Model/effort recommendation (031: always one visible line)** — check the task's nature against
   the routing table in `.claude/docs/model-uplift-playbook.md §4` (Read on demand; do NOT copy the
   table here — single owner). ALWAYS emit exactly one line: if the recommendation **differs** from
   the session state → the recommendation + the user action (`/model <id>` / `/effort <level>`),
   citing §4; if it matches → "modelo/effort actuales ya encajan para esta tarea". Always
   propose→ratify: the Lead cannot and must not switch the session model/effort itself.
6. **Activate** — invoke `Skill(<name>)` for the ratified candidates.
7. **Multi-pass (optional)** — if the user wants to go deeper or the task shifts, re-run from step 1.

## SIEMPRE rules

- Propose→ratify by default; auto-invoke ONLY under the two executable conditions of step 3
  (single survivor, or mandatory skill-routing row) and always declaring it (Commandment III, symbiosis).
- Never re-implement the model's semantic matching; reason over the in-context listing + the disk shortlist.
- Empty shortlist → say it; do not invent candidates. Discarded near-misses get a one-line motive.
- Cheap: the per-turn surfacing is the hook's job; run this skill at decision points, not every turn.
- Model/effort: exactly ONE line, always (recommendation with the `/model`//`/effort` action when it
  differs; a match confirmation when it doesn't); source of criterion is
  `docs/model-uplift-playbook.md §4` (referenced, never duplicated); user executes the switch — never the Lead.

## Commandments cubiertos

| # | Cómo |
|---|---|
| III | Claude propone el volumen (shortlist), el humano decide qué activar |
| V | Mínimo: una función pura + un workflow; sin índice ni infra nueva |
| VII | Backstop explícito al undertrigger nativo (auto-mejora del sistema) |

## Verificación

- `bun test ./.claude/skills/skill-advisor/__tests__/rank.test.ts` verde.
- Smoke: `/skill-advisor "optimiza el endpoint lento"` → shortlist con review-patterns + AskUserQuestion.

## Reutiliza

- Shared YAML parser and keyword contract: [skill-metadata.ts](../../scripts/lib/skill-metadata.ts).
