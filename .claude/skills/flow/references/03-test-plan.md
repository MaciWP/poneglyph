---
parent: flow
name: test-plan
description: Phase 2.5 — design the oracle (tests.md for code, validations.md for documents) before implementation and present it with tasks/ at gate 2→3.
---

# Phase 2.5 — Test plan

Produce the **oracle** every HU must satisfy before phase 3 implements it. Dual mode by HU
nature: executable code → `tests.md` (TDD, red→green); markdown, skills, configs →
`validations.md` (Pre/Post/Structural/Smoke/Cross). The deliverable closes gate 2→3
together with `tasks/`.

Precondition: draft or approved HUs under an approved spec. A bug with a failing test
already in the repo needs no design: that test is the oracle.

## Definition of Done

- Map every HU to an observable oracle in tests.md or validations.md, reusing existing relevant checks.
- Present the tasks and oracle for the actual gate 2→3 decision. Do not implement while approval is pending.

## How You're Graded

- Favor checks that can distinguish the required behavior from a plausible failure. Test counts and implementation-mirroring assertions do not earn credit.

## Output-mode decision

| HU `files` contains… | Mode | Artifact |
|---|---|---|
| Executable code (`.ts` `.js` `.py` `.go` `.rs` …) | TDD | `tests.md`: Pre / Action / Assert + red expectation |
| Markdown, skills, docs, configs (`.md` `.json` `.yaml` `.toml`, templates) | validation | `validations.md`: Pre / Post / Structural / Smoke / Cross |
| Mixed | per HU | both files; each HU appears in exactly one |

TDD on a markdown-only HU is ceremony without an oracle; validations on executable code
waste the natural red→green oracle. Override: `--tdd` / `--validation` / `--auto` (default).

## Step 1 — Read inputs

1. `Glob .claude/plans/*-*/tasks/index.md`; resolve several plans from session context.
2. Read `tasks/index.md` and every `tasks/US{N}.md` (frontmatter, `files`, ACs).
3. Read `rules/test-policy.md`; absent → treat as `auxiliary` and warn once.
4. Read `tests.template.md` and `validations.template.md` (project templates, then global).
5. **Discover the project's test conventions** (TDD mode): inventory shared fixtures,
   factories and helpers (`**/conftest.py`, `**/factory*.py`, `**/fixtures/**`,
   `setup-tests.*`, `testUtils*`); load the project's test-conventions skill when one exists
   (`<stack>-testing-patterns`, `*-test-standards`) — its rules override these generic ones.
   Step 4 references existing fixtures by name; a test never re-creates data a fixture
   already provides.

## Step 2 — Declare the resolved TDD mode

The output frontmatter declares `tdd_policy: <forced|adaptive|optional>`, resolved from
`rules/test-policy.md`. Inside a flow lifecycle the default is raised, not replaced: `rules/test-policy.md` §Override in plan owns that escalation; cite it, never restate it. Honor per-HU overrides in
`tasks/US{N}.md`: a forced marker keeps test-first despite an auxiliary policy;
`tdd-skip: <reason ≥10 chars>` opts out with a concrete reason. Under the escalation:
derive tests from requirements, observe a relevant failure before making it pass, reuse
existing fixtures.

## Step 3 — Classify every HU

By `files` and by ACs: TDD (code and input→output behavior), validation (only `.md`,
skills, templates, structural invariants), or mixed (split per HU). Declare one line per
HU: `US3: TDD (creates 2 .ts files)`, `US7: validation (modifies SKILL.md only)`.

## Step 4 — Generate the oracle per HU

**TDD HU** in `tests.md`, ≥1 happy path + ≥1 edge case:

```markdown
## US{N} — tests

### T{N}.1 — <happy path title>
- **Type**: unit | integration | property-based
- **Pre-condition**: <state before; existing fixtures by name>
- **Action**: `<concrete call: function / endpoint / command>`
- **Assert**: <expected value, state or effect>
- **Must fail before impl (red)**: <the specific error or failed assertion expected>
```

Parsers and pure transforms may add a property-based `T{N}.3` (`invariant` + `generator`);
evidence: +23-37 % effectiveness over plain TDD (arxiv 2506.18315). Never pad with it.

**Pinned-behavior sweep.** When the oracle changes the behavior of existing shared code,
Grep the current suite for tests that pin today's behavior and list them in the HU as tests
to update. Build must not discover the conflict (lesson 027/US1).

**Fixture reuse.** Every Pre-condition names an existing fixture or helper from Step 1.5. A
new fixture is declared explicitly (`new fixture needed: <name> — no existing fixture
provides <X>`) so build adds it at the correct shared level, never inline.

**Validation HU** in `validations.md`, five categories, honest "none" where a category does
not apply:

```markdown
## US{N} — <title>

### Pre
### Post
### Structural assertions
### Smoke
### Cross-validations
```

## Step 5 — Untestable HUs

Declare `US{N}: untestable — <concrete reason>` and propose `tdd-skip: <reason>` on the HU
(the Lead applies it). Untestable rate above 30 % is a smell: the phase 2 decomposition is
wrong; STOP and report.

## Step 6 — Drillme, phase 2.5

Sweep the Phase 2.5 bank of `../../drillme-clarify/references/03-phase-questions.md` (single
source, not restated) plus the canonical categories. If `drillme-clarify` does not fire,
invoke `/drillme-clarify "Phase 2.5 oracle design for <NNN-slug>"` before the gate.

## Step 7 — Produce the artifacts

`tests.md` frontmatter: `spec`, `tasks`, `phase: 2.5`, `test_mode: tdd`, `tdd_policy`.
`validations.md` frontmatter: `spec`, `tasks`, `phase: 2.5`, `validation_mode: validation`,
`test_policy`. Every function, module and path a test or validation names exists or is
planned in the corresponding HU's `files`.

## Step 8 — Present the joint package

Record `complete-phase 2.5`, then:

```text
Phase 2.5 closed for {NNN}-{slug}:
- TDD HUs: <list> → tests.md
- validation HUs: <list> → validations.md
- untestable (skip-justified): <list with reasons>
- tdd_policy / test_policy: <forced|adaptive|optional>
- alerts: <>30 % untestable | tests that only repeat ACs | none>

⚪ Hard gate 2->3 — pendiente tu aprobación de tasks/ + tests.md/validations.md
   antes de Phase 3 (flow build). Responde: APPROVE | REFINE | BLOCK.
```

The user's actual decision is recorded with `approve-gate 2-3 --approval <decision-ref>`.
Artifact creation never approves execution.

## SIEMPRE rules

- Classify by `files` honestly; never default markdown to TDD.
- "Untestable" is declared, never hidden behind synthetic tests.
- Reuse the project's fixtures and defer to its test-conventions skill.
- A red expectation names the specific failure ("TypeError: X is undefined", "expected N,
  got M"), never "the test will fail".

## Anti-patterns

| Anti-pattern | Detection | Correction |
|---|---|---|
| TDD on markdown | `tests.md` entries for an HU whose files are only `.md` | Move to `validations.md` |
| Red without a reason | "Must fail before impl" says only "will fail" | Name the error or the failed assertion |
| Synthetic oracle | A test with no AC behind it | Trace it or remove it |
| Skip without a reason | `tdd-skip` shorter than 10 chars or generic | Ask for the concrete reason or drop the skip |
| Coverage padding | Property-based `T{N}.3` on an HU with no invariants | 2 honest tests beat 3 decorative ones |
| Duplicate fixture | Setup re-creates data an existing fixture provides | Reference the fixture by name; new ones only at the shared level |
