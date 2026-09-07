# Pre-Refactoring Checklist

Safety checks before starting any refactoring.

## Required Before Starting

- [ ] Tests exist and pass
- [ ] Current state committed to version control
- [ ] Feature branch created for refactoring work
- [ ] Code smell identified and documented
- [ ] Characterization tests written for untested code
- [ ] Scope defined (which files/functions to change)

## Key Principles

| Principle | Rule |
|-----------|------|
| Atomic | One change at a time |
| Reversible | Can undo immediately |
| Tested | All tests pass after |
| Behavioral | Same inputs, same outputs |

## Risk Assessment

| Risk Level | Condition | Action |
|------------|-----------|--------|
| Low | Pure functions, good test coverage | Proceed |
| Medium | Side effects, partial coverage | Add tests first |
| High | No tests, shared state, concurrency | Write characterization tests, then proceed |
