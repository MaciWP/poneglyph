---
parent: pr-review
name: lens-maintainability
description: Maintainability lens — code smells, SOLID, complexity, refactoring patterns, review process.
---

# Maintainability Lens

## Contents

- [When to Use](#when-to-use)
- [Review Process](#review-process)
- [Quick Thresholds](#quick-thresholds)
- [Red Flags (Quality)](#red-flags-quality)
- [Output Format](#output-format)
- [Code Quality Review: [Component]](#code-quality-review-component)
- [When to Refactor (Decision Criteria)](#when-to-refactor-decision-criteria)
- [Refactoring Anti-Patterns](#refactoring-anti-patterns)
- [Checklists](#checklists)
- [Reference Files](#reference-files)
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

1. **Scan** — Read through changed files, note structure and size
2. **Checklist** — Run through review checklist items (see reference)
3. **Red Flags** — Check for high-severity patterns
4. **Complexity** — Measure cyclomatic/cognitive complexity of key functions
5. **SOLID** — Check for principle violations
6. **Anti-Patterns** — Identify known anti-patterns
7. **Report** — Output findings using review template

## Quick Thresholds

| Metric | OK | Warning | Fail |
|--------|-----|---------|------|
| Function lines | < 20 | 20-30 | > 30 |
| Class lines | < 150 | 150-200 | > 200 |
| File lines | < 300 | 300-400 | > 400 |
| Cyclomatic | < 6 | 6-10 | > 10 |
| Parameters | < 4 | 4-5 | > 5 |
| Nesting depth | < 3 | 3-4 | > 4 |

## Red Flags (Quality)

| Pattern | Severity | Problem | Detection |
|---------|----------|---------|-----------|
| Function > 50 lines | High | Hard to understand/test | Count lines |
| Class > 500 lines | High | God class, too many responsibilities | Count lines |
| > 5 parameters | High | Complex interface, hard to use | Count params |
| Cyclomatic complexity > 10 | High | Too many paths, untestable | Count branches |
| Nesting depth > 4 | High | Hard to follow logic | Count indentation |
| Duplicate code blocks | High | Maintenance nightmare | Compare blocks |
| Untyped escape hatches | Medium | Type safety disabled | Search for "any" equivalents |
| Magic numbers/strings | Medium | Unclear meaning | Check literals |
| Debug logging left in | Medium | Not production ready | Search for debug output |
| Commented-out code | Low | Dead code, confusing | Check comments |
| TODO without ticket | Low | Forgotten work | Search for TODO |
| Long import list > 10 | Low | File doing too much | Count imports |

## Output Format

```markdown
## Code Quality Review: [Component]

### Code Smells
- **[Smell]**: `function()` — Location, severity, fix

### SOLID Violations
- **[Principle]**: Description — Location, fix

### Complexity Analysis
| Function | Cyclomatic | Cognitive | Lines | Status |

### Metrics Summary
| Metric | Value | Threshold | Status |

### Passed Checks
- [x] / [ ] checklist items
```

For the full template with all sections, load `${CLAUDE_SKILL_DIR}/references/maintainability/review-template.md`.

## When to Refactor (Decision Criteria)

| Trigger | Pattern | Reference |
|---------|---------|-----------|
| Function > 20 lines | Extract Function | `${CLAUDE_SKILL_DIR}/references/maintainability/extract-function.md` |
| Comment explains "what it does" | Extract Function | `${CLAUDE_SKILL_DIR}/references/maintainability/extract-function.md` |
| Complex nested conditionals | Extract Conditional | `${CLAUDE_SKILL_DIR}/references/maintainability/extract-function.md` |
| Functions share same data | Extract Class | `${CLAUDE_SKILL_DIR}/references/maintainability/extract-class.md` |
| Handler > 30 lines | Extract Service | `${CLAUDE_SKILL_DIR}/references/maintainability/extract-class.md` |
| SRP violation | Apply SOLID | `${CLAUDE_SKILL_DIR}/references/maintainability/solid-violations.md` |
| > 4 parameters | Parameter Object | `${CLAUDE_SKILL_DIR}/references/maintainability/common-issues.md` |
| Primitives for domain concepts | Value Object | `${CLAUDE_SKILL_DIR}/references/maintainability/common-issues.md` |

## Refactoring Anti-Patterns

| WRONG | CORRECT |
|-------|---------|
| Big bang refactor | Small incremental changes |
| Refactor + feature in same commit | Separate commits |
| Refactor without tests | Add characterization tests first |
| Over-abstract first occurrence | Rule of 3: abstract on repetition |
| Premature optimization | Clarity first, optimize if needed |

## Checklists

| Phase | File |
|-------|------|
| Before starting | `${CLAUDE_SKILL_DIR}/references/maintainability/pre-refactoring.md` |
| After completing | `${CLAUDE_SKILL_DIR}/references/maintainability/post-refactoring.md` |

## Reference Files

| Topic | File | Contents |
|-------|------|----------|
| Checklist | `${CLAUDE_SKILL_DIR}/references/maintainability/review-checklist.md` | Naming, functions, classes, files, error handling, types |
| Red Flags | `${CLAUDE_SKILL_DIR}/references/maintainability/red-flags.md` | Detection patterns table with severity |
| Common Issues | `${CLAUDE_SKILL_DIR}/references/maintainability/common-issues.md` | 9 code smell patterns with before/after + fix patterns |
| SOLID | `${CLAUDE_SKILL_DIR}/references/maintainability/solid-violations.md` | 5 SOLID violations with fixes |
| Complexity | `${CLAUDE_SKILL_DIR}/references/maintainability/complexity-metrics.md` | Cyclomatic + cognitive complexity |
| Anti-Patterns | `${CLAUDE_SKILL_DIR}/references/maintainability/anti-patterns-reference.md` | Anti-patterns table with detection |
| Extract Function | `${CLAUDE_SKILL_DIR}/references/maintainability/extract-function.md` | Extract Calculation + Extract Conditional patterns |
| Extract Class | `${CLAUDE_SKILL_DIR}/references/maintainability/extract-class.md` | Data cohesion + Extract Service patterns |
| Refactoring Process | `${CLAUDE_SKILL_DIR}/references/maintainability/refactoring-process.md` | Safety-first flow, characterization tests, anti-patterns |

## Gotchas

| Gotcha | Why | Workaround |
|--------|-----|------------|
| `?.` optional chaining counts as complexity (regex `?(?!:)` matches `?.` since `.` != `:`) | Hook complexity counter uses regex that catches optional chaining as a ternary variant | Refactor to explicit null checks or extract to helper function |
| `\|\|` fallback chains inflate complexity score (14 fallbacks = 14 points) | Each `\|\|` is counted as a separate complexity point per-file | Use spread with defaults object: `{...defaults, ...input}` |
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
