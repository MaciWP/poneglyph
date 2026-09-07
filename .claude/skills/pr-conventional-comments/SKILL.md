---
name: pr-conventional-comments
description: |
  Comentarios de review de PR en formato Conventional Comments — feedback
  estructurado y accionable con label + decorator (blocking/non-blocking),
  mínimo un praise por review, issue siempre emparejado con suggestion, tono
  profesional en español informal, y publicación como una única review. Aplica a
  cualquier repo; las convenciones de un equipo concreto llegan por su plugin.
  Úsala cuando: vayas a redactar comentarios de review de una PR o feedback de
  code review, "comenta esta PR", "prepara los comentarios de la review",
  "conventional comments", "déjame los comentarios listos para pegar".
metadata:
  keywords: >
    Keywords - conventional comments, comentarios de pr, comenta la pr, review comment, pr
    comment, blocking, non-blocking, nitpick, praise, code review feedback, comentarios
    listos para pegar
disable-model-invocation: false
when_to_use: |
  "comenta esta PR", "prepara los comentarios de la review", "déjame los
  comentarios listos para copiar y pegar", "conventional comments", al redactar
  cualquier feedback de code review dirigido a un compañero
---

# PR Conventional Comments

> Generate structured, actionable PR review comments using the Conventional
> Comments format, in Spanish. Repo-agnostic; a team's own conventions (single
> review, who signs, approval rules) come from that team's plugin, not from here.

## Core principle: structured actionable feedback

**THE #1 RULE: every comment MUST have a label and a decorator (blocking/non-blocking).**

```
<label> (decorator): <subject>

<discussion>
```

| Component | Required | Description |
|---|---|---|
| `label` | Yes | Comment type (suggestion, issue, praise, …) |
| `(decorator)` | Yes | `(blocking)` or `(non-blocking)` |
| `subject` | Yes | Concise description |
| `discussion` | No | Additional context in following lines |

Multi-line example:

```
suggestion (blocking): Considera usar bulk_create en lugar del loop.
Esto reduciria las queries de N a 1 y mejoraria el rendimiento
en listas grandes.
```

## Labels

| Label | Use | Decorator | Per review |
|---|---|---|---|
| `praise:` | Something positive | N/A | Minimum 1 |
| `suggestion:` | Concrete improvement proposal | `(blocking)`/`(non-blocking)` | As needed |
| `issue:` | Specific problem — ALWAYS pair with suggestion | `(blocking)` | As needed |
| `question:` | Doubt or clarification | `(non-blocking)` | As needed |
| `thought:` | Non-blocking idea for the future | `(non-blocking)` | As needed |
| `nitpick:` | Minor style preference | `(non-blocking)` | As needed |
| `typo:` / `todo:` / `chore:` / `note:` | Trivial/administrative/info | N/A | As needed |
| `polish:` | Non-functional quality improvement | `(non-blocking)` | As needed |

Decorators: `(blocking)` = blocks approval (critical issues, bugs, security) ·
`(non-blocking)` = doesn't block (style, ideas) · `(if-minor)` = only if the fix
is 1-2 lines. Severity map: Critical → `issue (blocking)` · Major → `issue` or
`suggestion (blocking)` · Minor → `suggestion`/`nitpick (non-blocking)`.

## Templates by label

```
praise: Buen uso de {patron}. Esto mejora {beneficio}.

suggestion (blocking): Considera usar {alternativa} en lugar de {actual}.
Esto evitaria {problema} y mejoraria {aspecto}.

issue (blocking): {descripcion del problema}.
suggestion: {propuesta de solucion concreta}.

question (non-blocking): Hay alguna razon para {decision}?
Pregunto porque {contexto/alternativa}.

thought (non-blocking): Para el futuro, podriamos {idea}.

nitpick (non-blocking): Preferiria {alternativa} por consistencia con el resto del proyecto.
```

## Tone rules (Google Eng Practices · Graphite · Dr. McKayla)

Spanish, informal "yo", professional:

| Rule | Bad | Good |
|---|---|---|
| Code, not person | "No entiendes select_related" | "Este query podria beneficiarse de select_related" |
| Formulate as questions | "Esto esta mal" | "Consideraste usar `get_or_create` aqui?" |
| No condescension | "Simplemente usa X" | "Se podria usar X, que maneja {caso} automaticamente" |
| Explain the why | "Usa bulk_create" | "Usa bulk_create para reducir queries de N a 1" |
| Be brief | 5-line paragraph | Max 2-3 lines per comment |

## Team conventions

Publication rules (single review vs per-comment, line-anchored vs PR body, approval
policy, voice) belong to the team, not to the format. Read the installed company
plugin's conventions reference before drafting (e.g. `poneglyph-work:lessons-work`
→ `references/team-conventions.md`); with no plugin, ask once and follow the repo.

## Quality checklist (before delivering)

Every comment has label + decorator · ≥1 `praise:` · every `issue:` paired with
`suggestion:` · tone about code, never the person · why explained · delivered
as one review block.

Worked examples per label live with the team conventions in the company plugin
(`poneglyph-work:lessons-work` → `references/comment-examples.md`).
