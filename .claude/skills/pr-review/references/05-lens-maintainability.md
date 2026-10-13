---
parent: pr-review
name: lens-maintainability
description: Maintainability lens, thresholds, smells, SOLID, complexity, refactoring safety.
---

# Maintainability Lens

## Contents

- [When to Use](#when-to-use)
- [Review Process](#review-process)
- [Quick Thresholds](#quick-thresholds)
- [Output Format](#output-format)
- [When to Refactor (Decision Criteria)](#when-to-refactor-decision-criteria)
- [Refactoring Anti-Patterns](#refactoring-anti-patterns)
- [Refactoring Safety](#refactoring-safety)
- [Gotchas](#gotchas)
- [Refactoring Safety Classification](#refactoring-safety-classification)

Code quality analysis and refactoring guidance. Patterns are language-agnostic.

## When to Use

- General code review before merge
- Identifying code smells and anti-patterns
- Checking SOLID principle violations
- Measuring code complexity
- Finding duplicated code
- Refactoring planning / technical debt assessment
- Extracting functions or classes from large code blocks
- Reducing cyclomatic complexity via safe refactoring
- Preparing code for testing

## Review Process

1. **Scan**: Read through changed files, note structure and size
2. **Thresholds**: Compare sizes and complexity against §Quick Thresholds (`scripts/complexity-report.ts` measures complexity)
3. **SOLID**: Check for principle violations
4. **Anti-Patterns**: Identify known smells and anti-patterns
5. **Report**: Output findings in §Output Format

## Quick Thresholds

| Metric | OK | Warning | Fail |
|--------|-----|---------|------|
| Function lines | < 20 | 20-30 | > 30 |
| Class lines | < 150 | 150-200 | > 200 |
| File lines | < 300 | 300-400 | > 400 |
| Cyclomatic | < 6 | 6-10 | > 10 |
| Parameters | < 4 | 4-5 | > 5 |
| Nesting depth | < 3 | 3-4 | > 4 |

## Output Format

```markdown
## Code Quality Review: [Component]

### Code Smells
- **[Smell]**: `function()`: Location, severity, fix

### SOLID Violations
- **[Principle]**: Description: Location, fix

### Complexity Analysis
| Function | Cyclomatic | Cognitive | Lines | Status |

### Metrics Summary
| Metric | Value | Threshold | Status |

### Passed Checks
- [x] / [ ] checklist items
```

## When to Refactor (Decision Criteria)

| Trigger | Pattern |
|---------|---------|
| Function > 20 lines | Extract Function |
| Comment explains "what it does" | Extract Function |
| Complex nested conditionals | Extract Conditional |
| Functions share same data | Extract Class |
| Handler > 30 lines | Extract Service |
| SRP violation | Split responsibilities |
| > 4 parameters | Parameter Object |
| Primitives for domain concepts | Value Object |

## Refactoring Anti-Patterns

| WRONG | CORRECT |
|-------|---------|
| Big bang refactor | Small incremental changes |
| Refactor + feature in same commit | Separate commits |
| Refactor without tests | Add characterization tests first |
| Over-abstract first occurrence | Rule of 3: abstract on repetition |
| Premature optimization | Clarity first, optimize if needed |

## Refactoring Safety

Git mutations are gated on the user's this-turn authorization (CLAUDE.md §Hard rules):
propose them, never run them because a step says so.

1. Before: tests exist and pass; untested code gets characterization tests first; scope named.
2. During: one small change, run the tests, repeat. No feature work in the same change.
3. After: full suite and type checker, diff against the base branch, behavior unchanged.

## Gotchas

| Gotcha | Why | Workaround |
|--------|-----|------------|
| `?.` optional chaining counts as complexity (regex `?(?!:)` matches `?.` since `.` != `:`) | `scripts/complexity-report.ts` counts `?` not followed by `:`, so optional chaining reads as a ternary | Refactor to explicit null checks or extract to helper function |
| `\|\|` fallback chains inflate complexity score (14 fallbacks = 14 points) | `scripts/complexity-report.ts` counts each `\|\|` as a point | Use spread with defaults object: `{...defaults, ...input}` |
| Linter auto-reformats on edit | Exact string matching in subsequent edits will fail if linter changed whitespace/formatting | Always re-read file after edit for exact string matching in subsequent edits |
| Extracting a function doesn't reduce total complexity, just distributes it | Complexity is counted per-file, so moving code within the same file changes nothing | Split into separate files if per-file threshold matters |
| Renaming during refactor may break imports silently | Static imports are string-based; rename won't auto-update other files | Grep the old symbol before renaming to verify all usages |

## Refactoring Safety Classification

| Safe (auto-apply) | Risky (requires confirmation) |
|-------------------|------------------------------|
| Rename symbol | Change function signature |
| Extract variable | Extract class |
| Extract function | Replace inheritance with composition |
| Inline temp variable | Merge/split modules |
| Move method (same module) | Move method (cross-module) |
| Remove dead code | Change public API |

**Require user confirmation when**:
- Refactoring affects multiple files AND no tests cover the changed code
- Changing a public API that other modules depend on
- Replacing inheritance hierarchies

## Script

`bun ${CLAUDE_SKILL_DIR}/scripts/complexity-report.ts <file-or-directory>` lists per-file complexity, skipping dependency folders.
