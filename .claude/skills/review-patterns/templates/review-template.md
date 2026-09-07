# Code Quality Review Template

Use this format for code quality review output.

## Template

```markdown
## Code Quality Review: [Component]

### Code Smells
- **[Smell Name]**: `functionName()` (N lines)
  - Location: `file:startLine-endLine`
  - Complexity: Cyclomatic N, Cognitive N
  - Fix: [Brief description of fix]

- **[Smell Name]**: [Description]
  - Locations: `file1:line`, `file2:line`, `file3:line`
  - Fix: [Brief description of fix]

### SOLID Violations
- **[Principle] Violation**: [Description]
  - Location: `file`
  - Fix: [Brief description of fix]

### Complexity Analysis
| Function | Cyclomatic | Cognitive | Lines | Status |
|----------|------------|-----------|-------|--------|
| `functionA` | 15 | 12 | 45 | Refactor |
| `functionB` | 8 | 6 | 25 | Warning |
| `functionC` | 3 | 2 | 10 | OK |

### Metrics Summary
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Max function lines | N | 30 | Pass/Fail |
| Max class lines | N | 200 | Pass/Fail |
| Max cyclomatic | N | 10 | Pass/Fail |
| Duplication | N% | 5% | Pass/Fail |

### Passed Checks
- [x] Check that passed
- [x] Another passing check
- [ ] Check that failed (explain why)
```

## Status Thresholds

| Metric | OK | Warning | Fail |
|--------|-----|---------|------|
| Function lines | < 20 | 20-30 | > 30 |
| Class lines | < 150 | 150-200 | > 200 |
| File lines | < 300 | 300-400 | > 400 |
| Cyclomatic | < 6 | 6-10 | > 10 |
| Cognitive | < 8 | 8-15 | > 15 |
| Parameters | < 4 | 4-5 | > 5 |
| Nesting depth | < 3 | 3-4 | > 4 |
| Duplication | < 3% | 3-5% | > 5% |
