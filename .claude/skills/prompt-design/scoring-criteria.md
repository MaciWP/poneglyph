# Review Criteria

Five pass/fail checks for a prompt. Each fail names what is missing.

## The 5 Criteria

| Criterion | Pass | Fail |
|----------|------|------|
| **Clarity** | Action verb + specific target | Generic verb, or no target |
| **Context** | The paths, technology and versions the task depends on | Technology implied, or none given |
| **Structure** | Sections or bullets the recipient can follow | Wall of text for a multi-part task |
| **Success** | Observable outcome + how to verify it (behavior, artifact or relevant metric) | "better", "faster", or a result without a way to check it |
| **Actionable** | The recipient can start without asking | Open questions the recipient cannot answer |

## Decision

A non-numeric DoD passes Success. For variable tasks, require the recipient to resolve
missing acceptance and quality priorities before execution. Existing task criteria remain
authoritative; do not invent metrics or scope to make a check pass.

| Result | Action |
|-------|--------|
| All five pass | Proceed |
| Only Structure fails, and the prompt is short | Proceed |
| Any other fail | Fix the failing criteria (`corrections.md`), then check again |

## Examples

### Passes
> "Añadir endpoint POST /api/users que valide email único, hashee password con bcrypt, y retorne 201"

- Clarity, Structure, Success (status code), Actionable: pass.
- Context: pass; the stack is implied by the repo the prompt runs in.

### Fails
> "Mejorar el sistema de usuarios"

- Clarity: fail (no target). Context: fail. Success: fail (no criterion).
- Actionable: fail ("mejorar" in what sense?).
