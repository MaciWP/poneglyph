---
name: dev-workflow
description: |
  El bucle de desarrollo de poneglyph elaborado: premisas y pasos de cómo debe
  actuar la IA al programar — conocer/reutilizar antes de escribir, planear con
  preguntas-con-default, asunciones falsables y riesgos con mitigación, ejecutar
  con la escalera de simplicidad y suelo de seguridad, revisar con barrido de
  impacto, y aprender guardando lo no-obvio. Incluye la regla de loop-back entre
  etapas, la lente de review anti-over-engineering para diffs y la cosecha de
  deuda `ponytail:`.
  Úsala cuando: quieras aplicar o consultar el bucle dev en detalle, revisar un
  diff por over-engineering, cosechar deuda técnica, o cuando algo parezca
  demasiado complejo, "simplifica", "sobreingeniería", "mínimas líneas de código",
  "lente ponytail", "deuda técnica", "cómo deberías desarrollar esto".
metadata:
  keywords: >
    Keywords - bucle dev, como desarrollar, simplifica, sobreingenieria, over-engineering,
    demasiado complejo, minimas lineas, mínimas líneas, YAGNI, lente ponytail, deuda
    tecnica, deuda técnica, ponytail, elegante, mantenible
disable-model-invocation: false
when_to_use: |
  "simplifica esto", "es demasiado complejo", "revisa este diff por sobreingeniería",
  "cosecha la deuda", "aplica el bucle dev", "/dev-workflow", "cómo deberías desarrollar esto"
---

# dev — the development loop, elaborated

The always-loaded core (CLAUDE.md §The dev loop) is the law; this skill is its
field manual. Adapted from ponytail (MIT, DietrichGebert/ponytail) and the
contractor protocol (Oriol, 2026-08-05). `changes-verify` owns stage 4's deep protocol;
/flow-lifecycle wraps this same loop at feature scale — neither is duplicated here.

The full-loop rule (every stage visible, depth scales, omission never, compact
rendering when KNOW shows the task is bounded) is CLAUDE.md §The dev loop — the law
is not restated here. Judging a task "simple" *before* KNOW is circular: you only
know that after investigating.

## Stage 1 — KNOW (learn / investigate / reuse)

- Read the full problem statement and the surrounding code before forming an opinion.
  Laziness applies to the SOLUTION, never to comprehension.
- Reuse scan (before writing anything): Glob for similar filenames, Grep for
  functions/classes doing the same job, Grep references on touched symbols.
  Found something → reuse or extend it; write new code only when the scan comes up dry.
- External research pays when: the domain is unfamiliar, an external API is involved,
  or the pattern smells standard (someone solved it well already). Sources in order:
  official docs → reputable experts → high-quality reference projects. Verify version.
- Anything discoverable in <1 min (test framework, lint rules, layout, existing
  abstractions) is research you owe — never a question to the user.
- If the task includes publication, run the remote preflight in
  [verify's publication protocol](../changes-verify/references/publication.md) before PLAN.

## Stage 2 — PLAN (analyze / price / de-risk)

Produce, then STOP on high blast radius (new module, schema, auth, money,
migrations, deletion). For everything else, plan and proceed.

- **Goal**: the ask restated in your own words + the acceptance criteria you'll
  hold yourself to. Wrong restatement = cheapest possible failure point.
- **Blocking questions (0-3)**: only where a wrong answer means throwing work away.
  Each carries your recommended default so "yes to all" is a valid reply.
  Nothing blocking → say so, list zero.
- **Assumptions**: numbered, specific, falsifiable. Cover only the dimensions the
  task touches: data · failure · boundaries · state · environment · scope · testing.
- **Risks**: name the dangers/doubts/problems this task could hit (breakage
  elsewhere, unknown data shapes, integration surprises, env differences) and one
  mitigation each. Proportional — one line per REAL risk, none invented to fill space.
- **Price it (internal)**: weigh which pieces carry the most effort/risk and order
  the work accordingly; surface the weighing only when it changes a decision.
- Non-trivial task → run `choose-skills` (propose→ratify the skill shortlist).
- A blocking gap the questions can't close → `drillme-clarify` (deep sweep).

## Stage 3 — BUILD (minimum code / simple / maintainable / elegant)

The ladder — stop at the FIRST rung that holds:

1. Does this need to exist at all? (YAGNI — challenge the requirement)
2. Already in this codebase? → reuse it (stage 1's scan already knows)
3. Stdlib does it? → use it
4. Platform-native feature? → native input over picker lib, CSS over JS, DB constraint over app code
5. Already-installed dependency? → use it; adding a NEW dependency needs explicit justification
6. Can it be one line? → one line
7. Only then: the minimum code that works — in the project's own style

**Non-negotiable floor** (laziness never crosses this): trust-boundary validation,
error handling, security, accessibility, anything explicitly requested. Bug fix =
root cause (the guard goes in the shared function, not per-caller patches).

**Debt convention**: a deliberate cut carries
`ponytail: <ceiling>, <upgrade trigger>` (e.g. `# ponytail: breaks >10k rows, batch it when datasets grow`).
No trigger = not a cut, just a bug you documented.

## Stage 4 — REVIEW (analyze / comply)

Before "done": run the project's checks, sweep the impact of every touched symbol,
drive the real flow end-to-end when there is runtime surface, and declare residual
risk. Full protocol: `Skill(changes-verify)`. Compliance is bidirectional: meet every agreed
AC, and add NOTHING beyond them.

**Diff review lens** (on request — "revisa este diff por sobreingeniería"): tags and
scope in `references/02-on-request-lenses.md`.

## Stage 5 — LEARN (persist knowledge)

- Persist the non-obvious: surprises, emergent patterns, deferred cuts and their
  triggers — via memory (global) or the project's learning capture.
- Nothing non-obvious → say so explicitly (`LEARN: nothing non-obvious`). Still a
  completed stage — silence is not a skip.
- **Debt harvest** (on request — "cosecha la deuda"): `references/02-on-request-lenses.md`.

## Loop-back — when a stage fails

A failed stage sends you BACK to the stage whose output broke — never forward on
a broken premise:

| Failure | Go back to |
|---|---|
| REVIEW finds failing checks or unexpected impact | BUILD — fix the root cause |
| An assumption proves false mid-BUILD | PLAN — re-plan with the new fact, and TELL the user (never quietly improvise) |
| BUILD discovers existing code late (duplication) | KNOW — rerun the reuse scan properly |
| The goal itself was misunderstood | KNOW — restart the loop |

Same failure twice, or a gap PLAN's questions cannot close → run `drillme-clarify`
(exhaustive sweep) before retrying; still stuck → escalate per `error-recovery.md`.
Never a louder retry of the same attack.

## Worked example

A small task with one loop-back, in full and in compact rendering:
`references/01-worked-example.md`.

## SIEMPRE rules

- **Full loop always, stages always visible.** No mental-only path. No "looks
  simple → skip PLAN/REVIEW". You only learn complexity *by doing KNOW*.
- **Depth scales; stages do not.** A rename still has restated goal, assumptions
  (or "none"), risks (or "none real"), REVIEW, and LEARN (or "nothing non-obvious").
  Short and professional beats long and padded — never skip, never invent filler.
- Stage order is fixed; skipping KNOW to "save time" is the root cause of rework.
- The floor is absolute — no rung of the ladder ever overrides it.
- Loop-back over push-forward: a broken premise invalidates everything built on it.
- Maximum quality is the default for every task — the user's care budget is not
  inferred from how small the diff looks.
- Git/PR and agent-spawn hard gates: CLAUDE.md §Operating rules owns them — not
  restated here. "Done" is never permission to commit; a spawn needs this-turn
  permission + model.

## Anti-patterns

| Anti-pattern | Correction |
|---|---|
| "Looks simple / typo / <20 lines → mental + just do it" | Full loop, short stages, still visible |
| Judging importance or care level before KNOW | Investigate first; never invent the user's time budget |
| Ladder applied before understanding the problem | "Read fully, then be lazy" — comprehension first |
| Simplifying away validation/errors to score fewer lines | Floor violation — restore it |
| `ponytail:` comment without an upgrade trigger | Add the trigger or treat as a bug |
| Asking the user something Grep answers | Stage 1 owes that research |
| Improvising when an assumption breaks mid-task | Loop-back to PLAN and tell — always |
| Risks section padded with invented dangers | Proportionality of *depth* — real risks only, or none |
| Silent LEARN because "nothing to say" | Explicit `LEARN: nothing non-obvious` |
| End-of-task shipping (commit / push / PR / "¿hago commit?") or AI authorship in a commit | CLAUDE.md §Git / PR — about to slip → drillme-clarify/AskUserQuestion, leave the tree dirty |

## Commandments cubiertos

| # | Cómo |
|---|---|
| III+I | PLAN pregunta-con-default y KNOW entiende antes de actuar |
| II | Reuse-scan y research verifican antes de afirmar/escribir |
| V | La escalera ES "simple by default" operativo |
| IV | REVIEW bloquea el "done" sin verificación; loop-back impide avanzar sobre premisa rota |
| VII | LEARN cierra el bucle de conocimiento |

## Content map

| Topic | File |
|---|---|
| Worked example — full and compact rendering of the five stages | `references/01-worked-example.md` |
| Diff review lens (over-engineering tags) · ponytail debt harvest | `references/02-on-request-lenses.md` |
