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

## Quality Bar

- Success means accuracy, actionability and respectful, specific feedback.
- Comment counts and mandatory praise add no value. Never invent a finding or compliment to satisfy a quota.

## Core principle: structured actionable feedback

**THE #1 RULE: every comment MUST have a label and a decorator (blocking/non-blocking).**

```
<label> (decorator): <subject>

<discussion>
```

`label`, `(decorator)` and `subject` are required; `discussion` is optional.

Multi-line example:

```
suggestion (blocking): ¿Qué te parece si usamos `bulk_create` en vez del bucle?
Así pasamos de N queries a 1.
```

## Labels

| Label | Use | Decorator |
|---|---|---|
| `praise:` | A grounded positive observation; zero is valid | N/A |
| `suggestion:` | Concrete improvement proposal | `(blocking)`/`(non-blocking)` |
| `issue:` | Specific problem — ALWAYS pair with suggestion | `(blocking)` |
| `question:` | Doubt or clarification | `(non-blocking)` |
| `thought:` | Idea for the future | `(non-blocking)` |
| `nitpick:` | Minor style preference | `(non-blocking)` |
| `typo:` / `todo:` / `chore:` / `note:` | Trivial/administrative/info | N/A |
| `polish:` | Non-functional quality improvement | `(non-blocking)` |

Decorators: `(blocking)` = blocks approval (critical issues, bugs, security) ·
`(non-blocking)` = doesn't block (style, ideas) · `(if-minor)` = only if the fix
is 1-2 lines. Severity map: Critical (grave bug, security) → `issue (blocking)` ·
Major → `suggestion (blocking)` · Minor → `suggestion`/`nitpick (non-blocking)`.
Between teammates `suggestion (blocking)` and `question` are the default label.

## Templates by label

```
praise: Buen {patrón} aquí; así {beneficio}.

suggestion (blocking): ¿Qué te parece si usamos {alternativa}? Así {efecto}.

issue (blocking): ¿Puede ser que {efecto visible}?
suggestion: ¿Lo cambiamos por {propuesta}?

question (non-blocking): ¿Hay algún motivo para {decisión}? Me da que {contexto}.

thought (non-blocking): Para más adelante, ¿y si {idea}?

nitpick (non-blocking): ¿Lo dejamos como {alternativa}, igual que en el resto?
```

## Tone rules (Google Eng Practices · Graphite · Dr. McKayla · team review 2026-10-01)

Spanish, informal "yo", professional:

| Rule | Bad | Good |
|---|---|---|
| Always a question, even when certain | "Esto está mal" | "¿Puede ser que aquí se pierda el 400?" |
| Effect first: what the ticket expects vs what happens | "El `try` envuelve todo el método…" | "En el ticket pone X, pero ¿aquí no pasa Y?" |
| 1-2 sentences, plain words | 5-line paragraph | Mechanism only if the fix needs it |
| No evidence in the body | `file:line`, SHAs, test names, dumps | That stays in the chat |
| Code, not person; nothing the author knows | "No entiendes select_related" | "¿Le ponemos `select_related`?" |

Budget: only comments that change the merge. In a follow-up round the bar rises: new
blockers only, no nitpicks.

## Team conventions

Publication rules and voice (single review, line anchors, approval policy, accepted
samples) belong to the team. Read the company plugin's `references/team-conventions.md`
before drafting; with no plugin, ask once and follow the repo.

## Delivery: show + pending review

Run these steps when the user asks for comments on a GitHub PR. When another skill
loads this one only for the format (e.g. `pr-review` step 8), return the comments as
text and skip steps 4-7.

1. **Draft** each comment in the format above, anchored to `path:line` or marked as general.
2. **Natural pass.** Run `Skill(natural-writing)` in embedded mode on the comments' prose,
   with the team's accepted samples as the voice sample.
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
6. **Edit a pending review** (only when asked to reword it). REST `PATCH .../pulls/comments/{id}`
   returns 404 while pending, and `line: null` there is normal. Body: `gh api -X PUT
   .../reviews/{id} -f body=…` (to empty it, GraphQL `updatePullRequestReview`).
   Comments: take each `node_id` from `GET .../reviews/{id}/comments`, then `gh api graphql` with `updatePullRequestReviewComment(input:{pullRequestReviewCommentId, body})`.
7. **Reply to an existing thread without publishing** (only when asked). Create a pending
   review with GraphQL `addPullRequestReview(input:{pullRequestId, commitOID})` (no `event`),
   take the thread id (`PRRT_…`) from `pullRequest.reviewThreads`, then
   `addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId, pullRequestReviewId, body})`.
   `pullRequestReviewId` is what ties the reply to the pending review: never omit it, and check
   that the returned `comment.state` is `PENDING` (PR #356, 2026-10-01).

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
5. A certain, grave finding → still opens with a question, ≤2 sentences, no path or SHA in the body.

## Quality checklist (before delivering)

Every comment has label + decorator · `praise:` only when grounded · every `issue:` paired with
`suggestion:` · opens with a question, ≤2 sentences, no evidence dump · natural-writing pass
done · shown in chat and written as one pending review (or the reason it was not).

Worked examples per label live with the team conventions in the company plugin
(`<team-plugin>:<review-conventions>` → `references/comment-examples.md`).
