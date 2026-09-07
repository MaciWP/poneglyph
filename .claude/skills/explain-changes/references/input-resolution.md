---
parent: explain-changes
name: input-resolution
description: Argument resolution algorithm — maps the user-provided argument to a concrete target (file/commit/branch/working-tree) with edge-case handling
---

# Input Resolution

## Contents

- [Resolution Order](#resolution-order)
- [Exact Git Commands](#exact-git-commands)
- [Edge Cases](#edge-cases)
- [Resumen ejecutivo](#resumen-ejecutivo)
- [Confidence Calibration](#confidence-calibration)

Maps the argument received to a concrete target. The skill never proceeds with an ambiguous input — it always asks if it cannot decide.

## Resolution Order

The algorithm tries each rule in order and stops at the first match.

| Order | Pattern | Action | Description string |
|---|---|---|---|
| 1 | empty / `--pending` / `pendientes` | `git diff` (unstaged) ∪ `git diff --cached` (staged) | "cambios pendientes de commitear en la rama actual" |
| 2 | matches `^[a-f0-9]{7,40}$` or `HEAD`/`HEAD~N`/`HEAD^N` | `git show <arg>` | f"commit `{arg}`" |
| 3 | exists as local branch (`git branch --list`) | `git diff $(git merge-base origin/dev <arg>)..<arg>` | f"todos los cambios de la rama `{arg}` vs dev" |
| 4 | matches `PR #<N>` or `pr/<N>` | `gh pr view <N>` then diff | f"PR #{N}" |
| 5 | exists as path (Glob exact) | Read file + `git log --follow -- <arg>` for blame summary | f"contenido + historia de `{arg}`" |
| 6 | path with wildcard via Glob, single match | as rule 5 with resolved path | as rule 5 |
| 7 | none of the above | STOP, AskUserQuestion | — |

## Exact Git Commands

| Case | Command |
|---|---|
| Working tree (rule 1) | `git diff` and `git diff --cached`, run both, concat; if both empty → see edge case "clean tree" |
| Commit (rule 2) | `git show --stat <hash>` for overview, then `git show <hash>` for full diff |
| Branch (rule 3) | `BASE=$(git merge-base origin/dev <branch> 2>/dev/null \|\| git merge-base main <branch>)`; `git diff $BASE..<branch>` |
| File (rule 5) | `git log --follow -p -- <path> \| head -200` for recent history; `git blame <path>` if user asks "quien cambio que" |

When `origin/dev` does not exist, fall back to `main` then `master` in that order.

## Edge Cases

### Clean working tree with `--pending`

If both `git diff` and `git diff --cached` are empty, do NOT proceed silently. Output:

```
No hay cambios pendientes en la rama actual. Quieres que mire el ultimo commit (HEAD) o una rama concreta?
```

Then stop and wait for the user's reply.

### Ambiguous hash prefix

If the hash is a prefix that matches multiple commits (rare with 7+ chars but possible):

```bash
git rev-parse --disambiguate=<prefix>
```

If multiple results, list them with subject lines and ask which one.

### Branch only on remote

If `git branch --list <name>` returns empty but `git branch --list -r origin/<name>` matches:

```
La rama `<name>` solo existe en remoto. Quieres que haga `git fetch origin <name>` primero?
```

Do NOT auto-fetch — branches can be large; ask first.

### Path matches multiple files via Glob

If `Glob("**/*<arg>*")` returns >1 match:

1. List the matches.
2. Ask which one.
3. Never assume the first match.

### Mixed staged + unstaged

When both exist, present them as two sub-targets in the report:

```markdown
## Resumen ejecutivo
- Cambios staged (3 ficheros, 12 lineas): ...
- Cambios unstaged (2 ficheros, 5 lineas): ...
```

Each gets its own "Cambios punto por punto" section. The cadena logica may span both.

### Argument is `HEAD` on a freshly cloned repo (no commits)

`git show HEAD` will fail. Detect via `git rev-parse HEAD 2>/dev/null` and ask the user for an alternative target.

### Argument is a tag

Treat tags as commits (rule 2). `git show <tag>` works the same.

## Confidence Calibration

| Resolution path | Confidence |
|---|---|
| Exact match on rule 1-4 with no ambiguity | High — proceed |
| Single Glob match on rule 5-6 | High — proceed |
| Multiple Glob matches | Low — ask |
| Argument starts with `-` but is not `--pending` | Low — ask (user may have typed a flag wrong) |
| Hash with 4-6 chars (under safe minimum) | Medium — ask user to extend hash |
