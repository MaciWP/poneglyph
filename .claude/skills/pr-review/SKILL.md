---
name: pr-review
description: >-
  Revisa una PR, una rama o un módulo y da un veredicto: contrasta los criterios de
  aceptación del ticket con el diff, ejecuta los checks y mira mantenibilidad y
  rendimiento. Aplica también para valorar los comentarios de review que dejó otra
  persona y ante código que huele mal o va lento. Úsala para "revisa la PR", "revisa mi
  rama antes de subirla", "mira este diff", "¿tiene razón el revisor?", "este endpoint
  va lento". No es para dejar comentarios en borrador en GitHub (pr-comments) ni para
  verificar tu propio cambio antes de darlo por hecho (changes-verify).
disable-model-invocation: false
argument-hint: "[PR number | PR URL | branch | file-or-module] (empty = local mode: current branch vs base)"
---

# pr-review: generalist PR/branch review (any repo)

Diff-level, ticket-anchored review at any point in time. NOT `flow` (review phase) (feature-level,
spec.md-anchored, /flow-lifecycle Phase 4 after all HUs close), the two never shadow each other.

## Definition of Done

- Resolve the review target and trace the ticket or agreed acceptance criteria against the actual diff.
- Complete the applicable review steps and return evidence-backed findings, check results and the supported verdict. Failed required checks block approval, not an honest review report.
- Stop after the requested assessment; fixes or publication require their own authorization.

## Quality Bar

- Success means accurate requirement coverage, consequential findings and a verdict supported by real checks.
- Use the existing review rubric. Finding counts, praise quotas and repeated reviews of unchanged evidence add no value.

## Steps (all executed or explicitly skipped with a reason, see step 9)

### 0. Coexistence check
If the current repo has its own PR-review command/skill (`.claude/commands/review-pr.md`
or similar), **defer to it and say so**: project-specific criteria beat the generic core.
This skill is the repo-agnostic default, not an absorption layer.

### 1. Target resolution
`$ARGUMENTS` is a target ONLY if it looks like one: PR number, PR URL, or a branch that
verifies via `git rev-parse --verify <arg>`. An existing file or folder, or a request about
code rather than a change ("huele mal este módulo", "está lento") → **module mode**: run only
steps 3 (read the code), 4 and 5 with the lenses, then report; there is no diff, ticket or
score. Anything else (prose, empty) → **local mode**: current branch vs the base branch.
State the resolved mode and depth (`references/07-depth-and-verification.md`). A PR you already reviewed → follow-up round
(`references/04-follow-up-round.md`).

### 2. Ticket detection → acceptance criteria
Scan branch name + PR title for `[A-Z]{2,}-\d+`:
- Ticket id in branch/PR → the ticket skill installed by the company plugin (digest with ACs); none installed → read the ticket from its URL or paste.
- Other prefix → Atlassian MCP `getJiraIssue` directly, if connected.
- Nothing / fetch fails → ask the user to paste the ACs, or proceed WITHOUT AC-trace
  declaring it ("sin ticket: no hay trazado de requisitos").
Never invent ticket content (protocol: `references/02-ticket-trace.md`).

### 3. Gather the diff + read changed files FULLY
`<target>` is what step 1 resolved, not the local checkout: PR → `gh pr diff <n>` or its
fetched head ref; branch → that branch; local mode → the current branch. Run
`git log --oneline <base>..<target>` + `git diff --stat <base>...<target>` + full diff, state
the range, then Read every changed file whole; findings need context, not hunks.

### 4. Discover and run the project checks
Find the check command per `references/03-check-discovery.md` (project CLAUDE.md
§Commands/Verification → test-policy.md → conventional fallbacks → ask). Run it.
**A failing check is a Critical, blocking finding**; surfaced first, never a buried row.

### 5. Criteria pass (core + project extension)
Apply `references/01-criteria-core.md` (Correctness / Tests / Security / Style /
Scope-discipline / Maintainability / Performance) plus any project-specific criteria found in the repo's rules. It owns the
weights, the score and the verdict: consequence floor included: a required AC at `✗` or a red
gate forbids APPROVE. Read it there. Before scoring, run the **lessons pass**: `Skill(lessons-learned)`: cross-repo
guards (G6 forbids APPROVE while a merge gate is red) plus the `references/<stack>` file
matching the diff (Django, React, …). A lesson violated in the diff is a finding like any
other, quoted with its rule.

**Lenses.** Load each lens the code calls for; both when both apply:

| Lens | When | Load |
|---|---|---|
| Maintainability | Smells, SOLID, complexity, duplication, a refactor request; the default lens | `references/05-lens-maintainability.md` |
| Performance | Queries, loops over I/O, async, caches, hot paths, "está lento" | `references/06-lens-performance.md` |

Lens severities map onto the core scale: High → Major, Medium and Low → Minor; Critical
stays Critical. A requested refactor follows the lens's safety classification: risky
changes need the user's confirmation, and the tests pass after each step.

**Verify before scoring.** Re-check the findings in fresh context (`references/07-depth-and-verification.md`); only confirmed findings score.

### 6. AC-trace
For EACH acceptance criterion from step 2: `✓` implemented (evidence: `file:line`) /
`✗` missing (state what's absent) / `⚠` partial-or-doubtful (state what to verify).
An AC without evidence is `✗`, never assumed. Table protocol: `references/02-ticket-trace.md`.

### 7. Scope discipline
Findings OUTSIDE the diff (pre-existing issues merely touched/revealed) go to a separate
final section **"Fuera del diff (opcional)"**; never mixed with the PR's findings, never
counted in the score.

### 8. Report
- Comments in Conventional Comments format via `Skill(pr-comments)`
  (label (decorator): subject; grounded praise when warranted; issue paired with suggestion; single review).
- Score + per-criterion table + verdict + AC-trace table inline.
- HTML report ONLY on explicit request, via `Skill(html-report)`; never hand-rolled CSS.

### 9. Minimum-steps self-check
Close by restating steps 0-8 as **executed / skipped-with-reason** (e.g. "paso 2 saltado:
no hay ticket en la rama y el usuario no aportó ACs"). A silent skip is a review defect.

## SIEMPRE rules

- Failing project checks = Critical blocking finding, reported first (Cmd IV).
- Every finding cites `file:line`; every AC verdict cites evidence or names the absence (Cmd II).
- Read changed files fully before judging (Cmd I).
- Outside-the-diff observations stay in their own unscored section (Cmd V, scope).
- Defer to the project's own review command when it exists (reuse over reinvention).

## Verificación (eval-first scenarios: authoring rubric)

1. Repo de trabajo, rama `feature/<TICKET>-...`, ticket con ACs parcialmente implementados →
   digest jira + AC-trace con al menos un `✗` evidenciado + checks ejecutados.
2. Repo genérico sin Jira, sin argumento → modo local declarado, sin AC-trace (declarado),
   criterios core + score.
3. Repo con `.claude/commands/review-pr.md` propio → paso 0 defiere y lo dice (no ejecuta el core).
4. PR con una review previa propia → tabla comentario → commit → estado, checks sobre el head
   completo y tests nuevos ejecutados contra el head anterior.
5. PR cuyo diff roza un bug que ya estaba en la base → la verificación lo mueve a «Fuera del
   diff» y el informe dice cuántos candidatos descartó.

## Commandments cubiertos

| # | Cómo |
|---|---|
| I | Ticket digest + ficheros completos antes de juzgar |
| II | AC-trace con evidencia file:line; checks EJECUTADOS, no asumidos |
| III | Self-check de pasos: los saltos se declaran, nunca se ocultan |
| IV | Check del proyecto fallando = Critical bloqueante |
| V | Scope discipline: lo de fuera del diff no puntúa; deferencia al comando del proyecto |
