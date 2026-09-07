---
parent: tech-plan
name: quality-gates
description: Poka-Yoke tool usage + TDD-enforcement anti-patterns + final quality gate checklist.
---

# Poka-Yoke + TDD + Final Quality Gate — references/08

## Poka-Yoke Tools

**Principle**: Design tool usage so it is hard to make mistakes (Anthropic pattern).

### Common Errors and Prevention

| Tool | Common Error | Prevention |
|------|-------------|------------|
| **Edit** | `old_string` not unique, multiple matches | Include more context lines (2-3 before/after) |
| **Edit** | `old_string` not found | Verify with exact `Grep` first |
| **Write** | Directory path does not exist | `Glob('parent/dir/')` before Write |
| **Bash** | Timeout on long commands | Specify explicit `timeout: 120000` |
| **Bash** | Command fails silently | Verify exit code, not just output |
| **Task** | Agent does not return what expected | Specific and structured prompt, not vague |
| **Glob** | Does not find files that exist | Verify base path is correct |
| **Grep** | Regex too specific | Start broad, refine |

### Pre-use Checklist

| Tool | Verify BEFORE |
|------|--------------|
| Edit | Prior `Read` + unique `old_string` (verify with Grep) + sufficient context |
| Write | Directory exists (`Glob`) + do not overwrite critical file without Read |
| Bash | Adequate timeout + verify exit code + correct working directory |
| Task | Specific prompt + correct model + `background` if long |

---

## Anti-Patterns + TDD Enforcement

| Do not | Do | Reason |
|--------|----|--------|
| Sequential writes without dep | Group in 1 message | Parallelism |
| No Discovery before planning | Discovery FIRST | Real basis |
| Code without test | Function → test | TDD |
| Step without verification | Ground truth per step | Traceability |
| Assume file exists | `Glob` before Edit | Anti-hallucination |
| API without checking docs | Check docs first | Anti-deprecated |
| Plan >5 files without checkpoint | Iterate 3-5 files | Contained errors |
| Continue with errors | STOP, fix, continue | Cascade |
| Test "later" | Test in same node | TDD strict |

---

## Final Quality Gate

Before considering the plan executed:

| Script | Purpose | Exit Code |
|--------|---------|-----------|
| `./scripts/check.sh` | typecheck + lint + test | 0 = OK |

**If fails → NOT complete.** Resolve before commit.

### Final Checklist

- [ ] Ground Truth verifications completed
- [ ] Deep Research completed, no deprecated APIs
- [ ] `./scripts/check.sh` exit code 0
- [ ] If cross-validation, validator agent approved
