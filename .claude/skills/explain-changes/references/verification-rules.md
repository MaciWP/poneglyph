---
parent: explain-changes
name: verification-rules
description: Reputable sources by stack, canonical citation format, anti-patterns, and the "100% certeza" override rule
---

# Verification Rules

## Contents

- [Reputable Sources (Closed List)](#reputable-sources-closed-list)
- [NOT Reputable (Never Cite)](#not-reputable-never-cite)
- [Canonical Citation Format](#canonical-citation-format)
- [Verification Procedure](#verification-procedure)
- [Override: "100% certeza" Mode](#override-100-certeza-mode)
- [Anti-Patterns](#anti-patterns)
- [Confidence Calibration Table (inherits anti-hallucination)](#confidence-calibration-table-inherits-anti-hallucination)

Citing matters. A wrong URL or a non-canonical source destroys the educational value of the report.

## Reputable Sources (Closed List)

| Stack | Canonical domain | Notes |
|---|---|---|
| Django | `docs.djangoproject.com` | Always pin to a version: `/en/5.0/`, `/en/5.1/`, `/en/stable/` is acceptable when the topic is version-stable |
| DRF | `www.django-rest-framework.org` | No version in path — site is single-version |
| Python | `docs.python.org/3/` | Pin minor: `/3.13/` for project-current Python |
| Postgres | `www.postgresql.org/docs/` | Pin major: `/16/`, `/17/` |
| TypeScript | `www.typescriptlang.org/docs/` | Single version |
| React | `react.dev` | New site (not legacy reactjs.org) |
| Anthropic / Claude | `docs.claude.com`, `code.claude.com` | Use `code.claude.com/docs/en/skills.md` for skill-format docs |
| OWASP | `owasp.org`, `cheatsheetseries.owasp.org` | For security claims |
| Node.js | `nodejs.org/docs/` | Pin LTS major |
| MDN (web APIs) | `developer.mozilla.org/en-US/docs/` | Acceptable for browser/web standards only |
| RFC / IETF | `datatracker.ietf.org/doc/html/rfc<NNNN>` | For protocol claims |

## NOT Reputable (Never Cite)

| Source | Why |
|---|---|
| StackOverflow / SuperUser / etc | User-generated, not authoritative |
| Medium / Dev.to / personal blogs | Opinion, not spec |
| GitHub READMEs of unrelated projects | Project-specific, not authoritative for stack-wide claims |
| ChatGPT / LLM transcripts | Recursive hallucination risk |
| Old archived docs without redirect | May contain deprecated info |
| Wikipedia for technical APIs | Sometimes outdated; ok for general concepts only |

Exception: a project's OWN README/CHANGELOG is authoritative for that project (use sparingly).

## Canonical Citation Format

Always inline-block, always with literal quote, always with full URL:

```markdown
> [Title of the doc page](https://full.url/with/anchor): "literal quote, copy-paste from the page".
```

Examples:

```markdown
> [Django Model Meta options](https://docs.djangoproject.com/en/5.0/ref/models/options/#django.db.models.Options.constraints): "A list of constraints that you want to define on the model."

> [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/16/sql-createindex.html): "The optional WHERE clause specifies the partial index expression..."
```

Rules:

- Quote must be VERBATIM — do not paraphrase.
- URL must include the anchor (`#fragment`) when the citation refers to a sub-section.
- Title in `[...]` matches the page title or the section heading — not invented.

## Verification Procedure

When the change involves a non-obvious framework behavior:

1. Identify the exact concept/method (e.g., "UniqueConstraint with condition").
2. WebFetch the canonical doc URL.
3. Extract a literal quote that supports the claim.
4. Cite using the canonical format above.
5. If no exact supporting quote exists, broaden the search OR downgrade the claim ("the doc does not state this explicitly; verified by test X instead").

## Override: "100% certeza" Mode

If the user says any of:

- "verifica con docs oficiales"
- "100% seguro"
- "no quiero suposiciones"
- "cita oficial obligatoria"

Force WebFetch on EVERY non-trivial claim, regardless of confidence. Do not skip even if confidence > 70%.

## Anti-Patterns

| WRONG | CORRECT |
|---|---|
| "Probablemente Django..." | WebFetch + literal quote |
| "Segun he leido..." | Cite the source |
| "El doc dice X" without URL | Include full URL |
| Paraphrased "quote" | Verbatim quote |
| URL invented from memory | WebFetch first, paste resolved URL |
| Citing a version different from the project's | Pin to project version (Django 5.0 in this codebase) |
| One source for a claim across stacks | One source per stack |

## Confidence Calibration Table (inherits anti-hallucination)

| Domain | Ask < | Verify | Auto > |
|---|---|---|---|
| Frontend (UI/CSS) | 65% | 65-85% | 85% |
| Backend (logic) | 70% | 70-90% | 90% |
| Database (schema/migrations) | 75% | 75-95% | 95% |
| Security (auth/crypto) | 75% | 75-95% | 95% |

Below "Ask" → AskUserQuestion. Between → WebFetch + verify. Above "Auto" → can proceed without WebFetch UNLESS override mode is active.
