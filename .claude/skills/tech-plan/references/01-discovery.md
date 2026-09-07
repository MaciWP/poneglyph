---
parent: tech-plan
name: discovery
description: Discovery Protocol — static and dynamic sources, anti-duplicate verification before "create X".
---

# Discovery — references/01

Before generating any plan, consult these sources. **Assume nothing.**

## A. Static Sources (Rules of the Game)

| File | Purpose | What to look for |
|------|---------|-----------------|
| `docs/orchestrator/ORCHESTRATOR.md` | Philosophy, policies | Commit rules, evidence |
| `docs/orchestrator/CAPABILITIES.md` | Real inventory | Available agents, skills, scripts |

## B. Dynamic Sources (Code State)

| File | Purpose | What to look for |
|------|---------|-----------------|
| `package.json` | Stack and scripts | Versions, deps, test scripts |
| `tsconfig.json` | TypeScript config | `strict: true`? Paths? |
| `Glob('.claude/**/*')` | Directory structure | Real project architecture |

## C. Anti-Duplicate Verification

Before planning "create X":

```
Glob('**/X.ts')          # Does it already exist?
Glob('**/X/**')          # Does the directory exist?
Grep('class X', 'src/')  # Is there already an implementation?
```

**If it exists → modify instead of create.**

## External References

| Need | Action |
|------|--------|
| Unknown API | Consult official documentation |
| Elysia/Bun docs | Official framework documentation |
| Design pattern | WebSearch best practices, official docs |
| Reference project | WebFetch GitHub >1k stars |
