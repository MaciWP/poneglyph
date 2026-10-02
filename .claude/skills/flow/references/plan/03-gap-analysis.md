---
parent: flow
name: gap-analysis
description: Gap Analysis + Ground Truth — files to touch/create/delete with verifications, environment feedback per change.
---

# Gap Analysis + Ground Truth — references/03

## Gap Analysis

Before each Execution Roadmap, complete this table:

### Gap Analysis Table

| Action | File | Deps | Verify Exists | Risk |
|--------|------|------|---------------|------|
| Edit | `path/existing.ts` | - | `Glob('path/existing.ts')` ✅ | Low |
| Create | `path/new.ts` | types.ts | `Glob('path/')` dir exists | Medium |
| Delete | `path/old.ts` | - | Verify no imports | High - breaking |

### Impact Analysis

| Question | How to verify |
|----------|--------------|
| What files do I touch? | List exact paths |
| What files do I create? | Verify destination dir exists |
| Do I break a public API? | `Grep('export.*FunctionName')` |
| Does it require migration? | Verify schema/type changes |

---

## Ground Truth from Environment

**Principle**: According to [Anthropic](https://www.anthropic.com/research/building-effective-agents), get feedback from the real environment at each step.

### Verification

| After... | Run | Expect |
|----------|-----|--------|
| Edit of TypeScript code | `bun typecheck path/file.ts` | Exit 0 |
| New test file | `bun test path/file.test.ts` | Tests pass |
| Change in API endpoint | Real request or integration test | Expected response |
| Configuration change | Verify app starts | No errors |
| Dependency installation | `bun install` + import test | No errors |

### Verification Workflow

```mermaid
graph TD
    A[Make change] --> B[Run verification]
    B --> C{Passed?}
    C -->|Yes| D[Mark complete]
    C -->|No| E[Analyze error]
    E --> F[Fix]
    F --> B
```

### Done means verified

- A step is complete only after the environment confirms it
- Code works once it has run, not when it reads correctly
- Move to the next step only when no errors are pending
