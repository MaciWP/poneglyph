---
name: pr-review
description: |
  Revisión generalista de una PR o rama en CUALQUIER repo: resuelve el target (PR#/URL/rama o modo local), detecta el ticket (id de Jira u otro) y TRAZA sus criterios de aceptación contra el diff (✓/✗/⚠ con evidencia file:line), corre los checks reales del proyecto (check fallando = Critical bloqueante), aplica criterios core + extensión por proyecto con scoring ponderado, y reporta en Conventional Comments con veredicto. Si el repo tiene su propio comando review-pr, defiere a él.
  Úsala cuando: "revisa la pr", "revisa esta pr", "review this pr", "revisa mi rama", "code review de la pr", "revisa el diff contra el ticket", antes de aprobar/mergear una PR.
metadata:
  keywords: >
    Keywords - pr-review, revisa la pr, revisa esta pr, review this pr, revisa mi rama, code
    review de la pr, review de la rama, revisa el diff, pull request review, revisa la pull
    request
disable-model-invocation: false
argument-hint: "[PR number | PR URL | branch] (empty = local mode: current branch vs base)"
when_to_use: |
  "revisa la pr", "revisa esta pr", "review this pr", "revisa mi rama contra el ticket", "code review de la pr", "revisa la pull request", before approving/merging a PR
---

# pr-review — generalist PR/branch review (any repo)

Diff-level, ticket-anchored review at any point in time. NOT `critic` (feature-level,
spec.md-anchored, /flow Phase 4 after all HUs close) — the two never shadow each other.

## Steps (all executed or explicitly skipped with a reason — see step 9)

### 0. Coexistence check
If the current repo has its own PR-review command/skill (`.claude/commands/review-pr.md`
or similar), **defer to it and say so** — project-specific criteria beat the generic core.
This skill is the repo-agnostic default, not an absorption layer.

### 1. Target resolution (do not skip — misparse class, 029)
`$ARGUMENTS` is a target ONLY if it looks like one: PR number, PR URL, or a branch that
verifies via `git rev-parse --verify <arg>`. Anything else (prose, empty) → **local mode**:
current branch vs the base branch. State which mode was resolved.

### 2. Ticket detection → acceptance criteria
Scan branch name + PR title for `[A-Z]{2,}-\d+`:
- Ticket id in branch/PR → the ticket skill installed by the company plugin (digest with ACs); none installed → read the ticket from its URL or paste.
- Other prefix → Atlassian MCP `getJiraIssue` directly, if connected.
- Nothing / fetch fails → ask the user to paste the ACs, or proceed WITHOUT AC-trace
  declaring it ("sin ticket: no hay trazado de requisitos").
Never invent ticket content (protocol: `references/02-ticket-trace.md`).

### 3. Gather the diff + read changed files FULLY
`git log --oneline <base>..HEAD` + `git diff --stat` + full diff, then Read every changed
file whole — findings need surrounding context, not hunks.

### 4. Discover and RUN the project checks (requisito 9.1)
Find the check command per `references/03-check-discovery.md` (project CLAUDE.md
§Commands/Verification → test-policy.md → conventional fallbacks → ask). Run it.
**A failing check is a Critical, blocking finding** — surfaced first, never a buried row.

### 5. Criteria pass (core + project extension)
Apply `references/01-criteria-core.md` (Correctness / Tests / Security / Style /
Scope-discipline) plus any project-specific criteria found in the repo's rules. Scoring
default: Critical×10 / Major×5 / Minor×1; `Score = 100 − Σ`;
verdict: APPROVE (0 critical, ≤2 major) / NEEDS_CHANGES (0 critical, >2 major) /
BLOCK (≥1 critical). Before scoring, run the **lessons pass**: `Skill(lessons)` — cross-repo
guards (G6 forbids APPROVE while a merge gate is red) plus the `references/<stack>` file
matching the diff (Django, React, …). A lesson violated in the diff is a finding like any
other, quoted with its rule.

### 6. AC-trace (requisito 9.2 — the net-new piece)
For EACH acceptance criterion from step 2: `✓` implemented (evidence: `file:line`) /
`✗` missing (state what's absent) / `⚠` partial-or-doubtful (state what to verify).
An AC without evidence is `✗`, never assumed. Table protocol: `references/02-ticket-trace.md`.

### 7. Scope discipline
Findings OUTSIDE the diff (pre-existing issues merely touched/revealed) go to a separate
final section **"Fuera del diff (opcional)"** — never mixed with the PR's findings, never
counted in the score.

### 8. Report
- Comments in Conventional Comments format via `Skill(pr-conventional-comments)`
  (label (decorator): subject; ≥1 praise; issue paired with suggestion; single review).
- Score + per-criterion table + verdict + AC-trace table inline.
- HTML report ONLY on explicit request, via `Skill(html-report)` — never hand-rolled CSS.

### 9. Minimum-steps self-check (requisito 9.3)
Close by restating steps 0-8 as **executed / skipped-with-reason** (e.g. "paso 2 saltado:
no hay ticket en la rama y el usuario no aportó ACs"). A silent skip is a review defect.

## SIEMPRE rules

- Failing project checks = Critical blocking finding, reported first (Cmd IV).
- Every finding cites `file:line`; every AC verdict cites evidence or names the absence (Cmd II).
- Read changed files fully before judging (Cmd I).
- Outside-the-diff observations stay in their own unscored section (Cmd V — scope).
- Defer to the project's own review command when it exists (reuse over reinvention).

## Verificación (eval-first scenarios — meta-create rubric)

1. Repo de trabajo, rama `feature/<TICKET>-...`, ticket con ACs parcialmente implementados →
   digest jira + AC-trace con al menos un `✗` evidenciado + checks ejecutados.
2. Repo genérico sin Jira, sin argumento → modo local declarado, sin AC-trace (declarado),
   criterios core + score.
3. Repo con `.claude/commands/review-pr.md` propio → paso 0 defiere y lo dice (no ejecuta el core).

## Commandments cubiertos

| # | Cómo |
|---|---|
| I | Ticket digest + ficheros completos antes de juzgar |
| II | AC-trace con evidencia file:line; checks EJECUTADOS, no asumidos |
| III | Self-check de pasos: los saltos se declaran, nunca se ocultan |
| IV | Check del proyecto fallando = Critical bloqueante |
| V | Scope discipline: lo de fuera del diff no puntúa; deferencia al comando del proyecto |

## Related

- `critic` — feature-level review (spec.md, /flow fase 4); pr-review es diff-level y ticket-anchored.
- `pr-conventional-comments` — formato de comentarios (reusada, no duplicada).
- La skill de tickets del plugin de empresa — digest del ticket con ACs (reusada cuando aplica).
- `verify` — gate pre-done del propio trabajo; pr-review revisa trabajo AJENO/de rama.
