---
parent: explain-changes
name: investigation-checklist
description: Step-by-step investigation protocol — reads, greps, tests, commit message, project pattern comparison, WebFetch triggers
---

# Investigation Checklist

Run before composing the report. Skipping steps is the #1 source of vague or hallucinated explanations.

## Mandatory Steps

| # | Step | Tool | Why |
|---|---|---|---|
| 1 | Read the target completely | Read | Skimming misses subtle changes (renames, decorator removal, default arg flips) |
| 2 | Identify each LOGICAL change (not each line) | mental | Group hunks that serve the same intent into one numbered point |
| 3 | For each change, locate references | Grep | Confirms blast radius and consumers |
| 4 | Read the associated test file(s) | Read | Tests reveal intent better than the implementation |
| 5 | Get the commit message if applicable | `git log -1 <hash>` or `git log -- <file>` | The WHY often lives only in the message |
| 6 | Compare with the project pattern | Grep similar code | Confirms whether the change is canonical or novel |
| 7 | Confidence check on non-obvious behavior | mental | Triggers WebFetch if confidence < 70% |

## Batching Rules (Performance)

When investigating, BATCH parallel-safe operations in one message:

| Parallel (same message) | Sequential |
|---|---|
| 3+ Reads on independent files | Read after Glob (depends on result) |
| Grep the same symbol in source and tests | Edit after Read on the same file |
| WebFetch + local Grep | Second WebFetch that depends on first's result |
| `git show <hash>` + Read of related test file | — |

**Anti-pattern**: serial Reads of test, source, and config when all three are independent — always batch.

## When to WebFetch

Force WebFetch when:

- Confidence in framework/library behavior < 70%.
- Change touches a public API surface (DRF serializers, Django ORM operators, React hooks, etc.).
- User explicitly asks for "verificacion contra docs" / "100% seguro".
- Change uses a feature you've never seen in the codebase before.

Do NOT WebFetch when:

- Change is pure refactor with no semantic shift.
- Behavior is fully described by a project test (test is the source of truth for project-specific intent).
- The library is the project's own internal module.

## Stack-Specific Investigation Hints

| Stack | Where intent often lives | What to grep |
|---|---|---|
| Django (this project) | `apps/<app>/services/`, model `Meta`, `apps/<app>/tests/` | Service class, signal receivers, custom QuerySet methods |
| DRF | Serializer `Meta`, `ViewSet` actions, `permission_classes` | `get_serializer_class`, `perform_*`, `@action` |
| Postgres | Migrations, `Meta.constraints`, `Meta.indexes` | `RunPython`, `RunSQL`, `UniqueConstraint`, `Q(...)` filters |
| React | Hook composition, prop drilling vs context | `useEffect` deps, `useMemo`, `useCallback` cleanup |
| TypeScript | Type narrowing, generics, conditional types | `type X = ...`, `as`, `satisfies` |

## Confidence Reset on Domain Change

When a single change spans multiple stacks (e.g., a Django migration that adds a TypeScript-codegen step), reset confidence per domain. Do NOT reuse a high confidence from one domain into another.

## Read-the-Test Pattern

Tests are the highest-leverage read because they encode intent in <30 lines. Pattern:

1. From the changed source file, derive the test file path (project convention — e.g. a Django monorepo: `apps/<app>/tests/<area>_tests.py`).
2. Read it with Glob if the path is uncertain.
3. The test's name tells you the WHAT, the AAA body tells you the WHY.
4. If no test exists for the change, FLAG it in "Caveats" of the report.

## Commit-Message Triage

| Commit message says | Implication |
|---|---|
| "fix" / "bugfix" + ticket | Look for the bug in the previous version of the file |
| "refactor" / "rename" | Behavior preserved — focus the explanation on structure |
| "feat" / "add" | New behavior — focus on the contract of the new symbol |
| "WIP" / "wip" / no message | Treat as low-trust intent — rely more on tests + code |
| "Merge branch" | Skip the merge commit; explain the branch instead |

## Sanity Checks Before Composing

- [ ] All claims about file/symbol existence backed by Read or Grep.
- [ ] All claims about library behavior backed by test, project pattern, or WebFetch.
- [ ] Logical chain identified — every numbered point links to its predecessor.
- [ ] At least one citation per non-obvious change.
- [ ] No invented URLs.
