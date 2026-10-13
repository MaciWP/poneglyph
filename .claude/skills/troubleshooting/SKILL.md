---
name: troubleshooting
description: >-
  Diagnostica fallos hasta la causa raíz y aplica un protocolo de atasco que cambia de
  técnica cuando el mismo error se repite. Úsala para depurar un fallo o cuando sigue el
  mismo error tras varios intentos: "depura este error", "por qué falla", "se cae en
  producción", "estoy atascado", "mismo error otra vez", "no se soluciona". No es para un
  primer error de lint o de tipos con arreglo evidente, que basta con dev-workflow.
disable-model-invocation: false
---

# Troubleshooting

Diagnosis to the root cause, and the stuck protocol that CLAUDE.md §How to work calls
when a failure repeats.

## Definition of Done

- Define the observed failure, expected behavior and evidence that would confirm recovery; reuse an existing reproduction or task oracle.
- Return a supported root cause and verified recovery when repair is requested, or the bounded diagnosis when investigation alone is requested.
- Stop at that result or follow §Stuck below with remaining uncertainty. Do not repeat an unchanged failed hypothesis.

## Quality Bar

- Success means falsifiable hypotheses, discriminating checks and root-cause corrections.
- More retries, speculative changes and symptom suppression add no value.

## Diagnose

1. **Reproduce** with the smallest input that fails, and record the exact error text.
2. **Locate** the originating frame: the first stack frame in project code, not the
   library frame that threw.
3. **Hypothesize** one cause that the evidence supports, and name the check whose result
   would refute it. Run that check before changing code.
4. **Ask why** until the answer is something you can change (5 Whys). A cause that only
   restates the symptom is not a root cause.
5. **Fix the root**, then rerun the reproduction and the project checks.

| Gotcha | Workaround |
|---|---|
| Event A logged before B does not mean A caused B | Look for a causal chain, not temporal order |
| Logging the error object can drop nested causes | Log `message`, `cause` and the full stack separately |
| An intermittent failure "fixed" by a retry is still unexplained | Find what varies between runs before adding a retry |

## Stuck

The last step before handing back to the user. Use it when the same exact error
repeats, after 2+ diagnoses without a working fix, when a `/goal` loop keeps returning
the same "not met" reason, or when the user says "estoy atascado" / "desatasca esto".
Never on a first failure: that is the ordinary diagnosis above. Before this point, retry
only a failure you understand, and only while each attempt changes the error. Budgets per
failure type: `agent-routing` references/07-error-recovery.md.

1. **Name what already failed**: the techniques and assumptions tried so far. The loop
   persists because the same attack repeats.
2. **Attack the class, not the instance.** Generalize from the failing case to the kind
   of input or state that causes it, and fix that so the symptom cannot recur elsewhere.
3. **Switch technique.** Use one you have not used yet: 5 Whys or stack-trace
   classification (§Diagnose), `Skill(drillme-clarify)` (inversion, first principles)
   to surface a wrong assumption, the `prompt-router` agent when the missing lever is a skill
   you have not reached for, or re-read the primary source instead of reasoning from memory.
4. **Commit to the new attack**, never a louder version of the old one.
5. **Hand back.** Solved → report the root cause and the fix. Still unsolved → STOP →
   `AskUserQuestion` with what was tried, why each attempt failed, and 2-3 viable next
   options (`agent-routing` references/07-error-recovery.md §Stuck Detection).

## Commandments cubiertos

| # | Cómo |
|---|---|
| II | Root cause from evidence (5 Whys, originating stack frame), not a guessed fix |
| I | Understand the failure before changing code |

## Related

- Verify the failing symbol/path exists before diagnosing (`changes-verify` → existence checks).
- `agent-routing` references/07-error-recovery.md, retry budgets and stuck-detection thresholds.
