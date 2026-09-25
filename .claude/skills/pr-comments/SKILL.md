---
name: pr-comments
description: |
  Comentarios de review de PR en formato Conventional Comments — feedback
  estructurado y accionable con label + decorator (blocking/non-blocking),
  praise fundamentado, issue siempre emparejado con suggestion y tono
  profesional en español informal, con repaso de natural-writing. Los muestra en
  el chat y los deja como una review pendiente en GitHub, sin publicar, para
  editarlos antes de enviarlos. Aplica a cualquier repo; las convenciones de un
  equipo concreto llegan por su plugin.
  Úsala cuando: vayas a redactar comentarios de review de una PR o feedback de
  code review, "comenta esta PR", "prepara los comentarios de la review",
  "conventional comments", "déjame los comentarios listos para pegar",
  "déjalos sin publicar", "review pendiente".
metadata:
  keywords: >
    Keywords - conventional comments, comentarios de pr, comenta la pr, review comment, pr
    comment, blocking, non-blocking, nitpick, praise, code review feedback, comentarios
    listos para pegar, review pendiente, sin publicar, pending review
disable-model-invocation: false
when_to_use: |
  "comenta esta PR", "prepara los comentarios de la review", "déjame los
  comentarios listos para copiar y pegar", "conventional comments", "déjalos sin
  publicar", al redactar cualquier feedback de code review dirigido a un compañero
---

# PR Conventional Comments

> Generate structured, actionable PR review comments using the Conventional
> Comments format, in Spanish. Repo-agnostic; a team's own conventions (single
> review, who signs, approval rules) come from that team's plugin, not from here.

## Definition of Done

- Resolve the supplied review findings and requested delivery target.
- Return source-backed, actionable comments in Conventional Comments format, with each issue paired with a suggestion, after the `natural-writing` pass.
- Show them in chat and, when the target is a GitHub PR, write them as one pending review (§Delivery). Submit the review only when explicitly authorized.
- Evidence: the pending review id with state `PENDING`, or the reason it was not written.
- Stop after the requested delivery. Zero comments or zero praise is valid when nothing grounded merits them.

## How You're Graded

- You are graded on accuracy, actionability and respectful, specific feedback.
- Comment counts and mandatory praise earn no credit. Never invent a finding or compliment to satisfy a quota.

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
| `praise:` | A grounded positive observation | N/A | Only when warranted; zero is valid |
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
plugin's conventions reference before drafting (e.g. `<team-plugin>:<review-conventions>`
→ `references/team-conventions.md`); with no plugin, ask once and follow the repo.

## Delivery: show + pending review

Run these steps when the user asks for comments on a GitHub PR. When another skill
loads this one only for the format (e.g. `pr-review` step 8), return the comments as
text and skip steps 4-5.

1. **Draft** each comment in the format above, anchored to `path:line` or marked as general.
2. **Natural pass.** Run `Skill(natural-writing)` in embedded mode on the comments' prose.
   Labels, decorators, code, identifiers and paths stay untouched.
3. **Show** every comment in chat, grouped by file: its `path:line`, then the body in a
   fenced `text` block ready to copy. Mark the ones that go to the review body.
4. **Write the pending review.** A review created without `event` stays `PENDING`: only
   its author sees it and nobody is notified.

   ```bash
   gh pr view <n> --json number,headRefOid,url
   gh api "repos/{owner}/{repo}/pulls/<n>/reviews" --jq '.[] | select(.state=="PENDING") | .id'
   gh pr diff <n>
   gh api -X POST "repos/{owner}/{repo}/pulls/<n>/reviews" --input <scratchpad>/review.json
   ```

   - A pending review of yours already exists → stop and report its id; never delete or overwrite it.
   - Anchor a comment only to a line on the new side of the diff (`"side": "RIGHT"`). A
     comment about code outside the diff goes in `body`, prefixed with its `path:line`.
   - Payload: `commit_id` = `headRefOid`, `body`, `comments[]` with `path`, `line`, `side`, `body`. Never set `event`.
5. **Verify and hand over.** The response `state` must be `PENDING`. Report the review id,
   how many comments were anchored and how many went to the body, and the PR URL. The
   user edits them under *Files changed* and sends them with *Finish your review*.

No `gh` auth, no PR (local branch) or a failed POST → steps 1-3 only; quote the error and
say why the draft was not written. Submitting (`event` = `APPROVE` / `COMMENT` /
`REQUEST_CHANGES`, or `POST .../reviews/{id}/events`) needs an explicit request this turn.

## Eval scenarios

1. "Comenta la PR #352" with review findings → comments shown in chat and one `PENDING`
   review; findings on code outside the diff sit in its body with their `path:line`.
2. Same ask, but the user already has a pending review on that PR → comments shown, no POST,
   the existing review id reported.
3. `pr-review` loads this skill for its report → comments as text only, nothing written to GitHub.
4. Local branch with no PR → comments shown; the reply says no draft was written and why.

## Quality checklist (before delivering)

Every comment has label + decorator · `praise:` only when grounded · every `issue:` paired with
`suggestion:` · tone about code, never the person · why explained · natural-writing pass
done · shown in chat and written as one pending review (or the reason it was not).

Worked examples per label live with the team conventions in the company plugin
(`<team-plugin>:<review-conventions>` → `references/comment-examples.md`).
