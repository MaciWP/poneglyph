---
parent: pr-review
---

# Ticket detection + AC-trace protocol (the net-new piece, 031)

Neither the work repos' review commands nor the 029 template trace ticket requirements —
this file is why `pr-review` exists beyond them.

## Detection

1. Sources, in order: branch name → PR title → PR description first line.
2. Pattern: `[A-Z]{2,}-\d+` (e.g. `ABC-42`, `XY-1077`). First match wins; multiple
   distinct tickets → ask which one governs the review (or trace both if the user says so).
3. Fetch:
   - Company tracker id → the ticket skill installed by the company plugin — returns the digest including
     acceptance criteria and comments (comments can AMEND ACs — read them).
   - Other prefixes → Atlassian MCP `getJiraIssue` (load via ToolSearch if deferred).
   - No connector / fetch fails → say so and ask for a paste. **Never invent ticket
     content**; a review without ACs proceeds but declares "sin trazado de requisitos".

## AC extraction

From the digest: the explicit "criterios de aceptación" field first; if the ticket has
none, derive candidate ACs from the description's imperative sentences and CONFIRM them
with the user before tracing ("el ticket no tiene ACs formales; propongo trazar estos N").
Comments that modify scope (e.g. "al final X no entra") override the description — cite
the comment author/date when they do.

## Trace table (one row per AC — the review's spine)

| AC | Verdict | Evidence |
|---|---|---|
| "El listado pagina de 50 en 50" | ✓ | `api/views.py:120-134` (PageNumberPagination, page_size=50) + test `test_pagination.py:12` |
| "El export respeta los filtros activos" | ✗ | No hit for filter params in `export.py`; export ignores `request.query_params` |
| "Los errores se notifican al usuario" | ⚠ | Toast wired in `ExportButton.tsx:45`, but only for HTTP 500 — 4xx paths silent; verify intent |

Rules:
- `✓` requires evidence (file:line, and the test that pins it when one exists).
- `✗` names what is ABSENT and where it was looked for — a claim of absence is also verified (Grep, not memory).
- `⚠` names exactly what to verify or ask.
- An AC with no evidence found defaults to `✗`, never to "probably fine".
- ACs out of the PR's declared scope (split into another ticket/PR) → mark `—` with the
  pointer, don't punish the score.

## Verdict interaction

Any `✗` on an AC the ticket marks as required → at least one **Major** finding
("requisito del ticket sin implementar"); the review verdict cannot be plain APPROVE
while required ACs are `✗` (NEEDS_CHANGES floor), unless the user explicitly re-scopes.
