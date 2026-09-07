---
parent: explain-changes
name: interaction-patterns
description: Follow-up patterns after the first report — focused Q&A, re-scope, apply pattern, cancel, reformulation with analogies
---

# Interaction Patterns

## Contents

- [Closing Line (every report)](#closing-line-every-report)
- [Pattern Catalog](#pattern-catalog)
- [Focused Deep-Dive](#focused-deep-dive)
- [Reformulation with Analogy](#reformulation-with-analogy)
- [Re-Scope](#re-scope)
- [Cancel / Stop](#cancel-stop)
- [Apply Pattern to Other Case](#apply-pattern-to-other-case)
- [Out-of-Scope Requests](#out-of-scope-requests)

After the first report, the conversation enters Q&A mode. Behavior changes:

- The full template is NOT regenerated unless the user explicitly asks for it.
- Each follow-up runs only the verification needed for the focused question.
- Closing line of every response keeps the user in control.

## Closing Line (every report)

End every report with one of these (pick the most relevant 2-3):

- "Profundizo en el cambio N?"
- "Sigo con el siguiente fichero / commit?"
- "Aplico el patron a [otro caso plausible]?"
- "Verifico contra otra fuente?"

Never close with a generic "si quieres te explico mas" — be specific.

## Pattern Catalog

| User signal | Pattern | Action |
|---|---|---|
| "profundiza en N" / "expande punto N" | Focused deep-dive | Re-run investigation only on point N; output JUST the expanded point, no other sections |
| "y por que X?" | Focused Q&A | Answer the single question, with verification + cite if applicable |
| "no entiendo X" | Reformulation | Use analogy + concrete example — see Reformulation section |
| "sigue con [otro fichero/commit]" | Re-scope | Treat as new input, run full workflow on the new target |
| "aplica el patron a [otro caso]" | Apply | Read the new target, identify if same pattern fits, walk through. If it does NOT fit, say so explicitly |
| "ya entiendo" / "vale" / "gracias" | Stop | Stop. No closing summary. One-line acknowledgment max |
| "haz el cambio" / "implementalo" | Out of scope | This skill is read-only. Recommend the `build` skill (Phase 3) |
| "y este otro fichero?" + path | Re-scope | Same as "sigue con" |

## Focused Deep-Dive

When the user asks "profundiza en cambio N":

```markdown
### Profundizacion: cambio N

**Pregunta planteada**: <restate>.

[Re-run investigation: read more lines around the target, follow LSP references, fetch deeper doc section if needed]

**Respuesta detallada**:
<2-4 paragraphs with verifications and citations>

**Implicacion adicional**:
<one consequence not stated in the original report>

**Que sigue**: profundizo aun mas en X / paso al siguiente cambio / verifico Y?
```

Key: the deep-dive does NOT include "Resumen ejecutivo", "Cadena logica", etc. Only the focused expansion.

## Reformulation with Analogy

When the user says "no entiendo X":

1. Identify the abstraction level that failed (too technical, too dense, too implicit).
2. Pick an analogy from a domain the user clearly already grasps (deduce from context).
3. Give one analogy + one concrete example from the codebase.
4. Re-state the original claim in simpler words.

Example:

```markdown
"UniqueConstraint con condition" en simple:

**Analogia**: como una alfombrilla con la regla "solo una taza encima — pero las tazas vacias no cuentan". Si la taza esta soft-deleted (vacia), no impide poner otra encima.

**Ejemplo concreto en el repo**: ver test_can_create_after_soft_delete en apps/library/tests/models_tests.py:42 — crea, borra, vuelve a crear. Pasa.

**Reformulado**: la unicidad se aplica solo a las filas vivas (deleted IS NULL), no a las muertas.
```

## Re-Scope

When the question moves outside the current target:

```markdown
La pregunta sale del scope actual ([target original]) — pertenece a [otro target].

Cambio el target a [nuevo target]?
- Si: re-ejecuto el workflow completo sobre el nuevo target.
- No: respondo puntual sobre el actual y dejamos lo demas para otra sesion.
```

Wait for explicit confirmation before re-scoping.

## Cancel / Stop

When the user says they understand:

- One-line acknowledgment: "Vale, queda claro." or "Listo." Nothing else.
- Do NOT add a summary "of what we covered".
- Do NOT proactively suggest the next step.

## Apply Pattern to Other Case

When the user says "aplica esto a [otro fichero]":

1. Read the new target.
2. Decide: same pattern fits? partial fit? no fit?
3. Output:
   - **Fit total**: walk through, marking only the differences from the original.
   - **Fit parcial**: list which parts apply, which do not, why.
   - **No fit**: state explicitly. Offer to run a fresh full workflow instead.

Never force-fit a pattern.

## Out-of-Scope Requests

If the user asks to MODIFY code, DECIDE between alternatives, AUDIT quality, etc., redirect explicitly:

| User wants | Redirect to |
|---|---|
| "cambia esto" | `build` skill (Phase 3) |
| "esta bien hecho?" | `review-patterns` skill |
| "deberiamos usar A o B?" | `decide` skill |
| "encuentra el bug" | `Skill('diagnostic-patterns')` (Lead-invoked) |
| "haz tests" | `build` skill (Phase 3) |

State the redirect briefly, then stop. Do not also try to do the redirected task.
