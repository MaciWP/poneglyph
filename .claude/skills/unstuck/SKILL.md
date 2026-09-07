---
name: unstuck
description: |
  El último cartucho antes de escalar al usuario: cuando el mismo error se repite o llevas 2+ diagnósticos fallidos, fuerza UN intento profundo (effort xhigh) con una técnica que AÚN NO se haya probado — cambia el ataque, no lo repite más fuerte. No re-implementa diagnóstico: orquesta diagnostic-patterns + drillme, y si tampoco resuelve, entonces sí para y pregunta al usuario con lo intentado y las opciones.
  Úsala cuando: atascado, mismo error dos veces, 2+ diagnósticos sin fix, un goal-loop que no converge, "no se soluciona", "estoy atascado", "desatasca esto", "llevamos rato con esto".
metadata:
  keywords: >
    Keywords - unstuck, desatascar, atascado, stuck, escalate, no se soluciona, loop, bucle,
    same error, no progress, deep reasoning, xhigh, último cartucho, last resort, unblock
disable-model-invocation: false
effort: xhigh
when_to_use: |
  "estoy atascado", "no se soluciona", "desatasca esto", "llevamos rato con esto", "stuck", "same error again", "no progress"
---

# Unstuck — stuck-buster (xhigh) — renamed from `escalate`, 031

The rung between "stuck detected" and "give up / ask the user" (the old name suggested
escalating TO the user, which is exactly what this skill exists to delay). Its only
reason to exist: **raise effort to xhigh and change the attack** when repetition at the
base effort isn't working. It is deliberately THIN — it does not own diagnostic content;
it borrows it.

## When this fires

Invoke when `error-recovery` stuck-detection trips, or any equivalent loop:

| Signal | Source |
|---|---|
| Same exact error twice | `error-recovery.md` §Stuck Detection |
| 2+ diagnoses without a working fix | `error-recovery.md` |
| A `/goal` loop returning the same "not met" reason repeatedly | the loops playbook |
| User says "stuck / no se soluciona / desatasca" | direct |

Do NOT fire on a first failure — that's ordinary `diagnostic-patterns` territory at base effort.

## Protocol (the only owned content)

1. **Name what already failed.** State the technique(s) and assumptions already tried. The loop persists because the same attack repeats.
2. **Attack the CLASS, not the instance.** Generalize from the concrete failing case to the category of input/state causing it — fix the class so the symptom can't recur elsewhere (CLAUDE.md §The dev loop: a fix targets the root cause, never the symptom).
3. **Switch technique, don't repeat.** Load and apply a method you have NOT used yet:
   - `Skill('diagnostic-patterns')` — 5 Whys, stack-trace classification, retry/recovery
   - `Skill('drillme')` — inversion / first-principles to surface a wrong assumption
   - `Skill('skill-advisor')` — when the untried lever might be a skill you haven't reached for: propose→ratify a shortlist and apply the one not yet used (the change-of-attack IS often a change-of-tool)
   - Re-read the primary source (file/spec/docs) rather than reasoning from memory
4. **One deep xhigh pass.** This skill already runs at xhigh; spend it on the new attack, not a louder version of the old one.
5. **Hand back.** If solved → report the root cause + fix. If still unsolved after the xhigh pass → STOP → `AskUserQuestion` with: what was tried, why each failed, and the 2-3 viable next options (`error-recovery.md` §Stuck Detection).

## Anti-pattern (kills this skill if violated — Commandment IX)

If it starts copying the `diagnostic-patterns` catalog, it is redundant and must die. Its
body is trigger + change-of-technique + handback, nothing more. The diagnosis lives in
`diagnostic-patterns`; the judgment in `critic`; this is only the escalation rung.

## Related
- `.claude/rules/error-recovery.md` — stuck-detection thresholds that trigger this
- `diagnostic-patterns` / `drillme` — the techniques this orchestrates
- `skills/orchestrator-protocol/references/09-loops-playbook.md` — escalation inside a goal-loop
