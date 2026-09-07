# Critic — embedded fallback template (if `review.template.md` missing)

Extracted verbatim from `SKILL.md` (017/US9 — mechanical move, no content redesign). Used by Step 2 when `.claude/plans/templates/review.template.md` does not exist.

```markdown
# Review — {feature-name}

## Frontmatter
spec / phase / review_level / verdict / spec_drift / findings_count / created

## 1. Correctness
- [ ] spec.md problem solved E2E
- [ ] Each AC mapped to a closed HU
- [ ] Tests pass on assembled branch
- [ ] Happy path manual walkthrough OK
- [ ] Known edge cases covered

## 2. Quality
- [ ] Coverage respects test-policy.md
- [ ] Style matches project
- [ ] No introduced duplication
- [ ] No over-engineering per AC

## 3. Security
- [ ] No hardcoded secrets
- [ ] Inputs validated at boundaries
- [ ] No OWASP Top 10 vectors introduced
- [ ] security-audit invoked if critical area

## 4. Performance
- [ ] No O(n²) where O(n) reachable
- [ ] No I/O in loops (N+1)
- [ ] Parallelism opportunities flagged
- [ ] Memory profile reasonable

## 5. Maintainability
- [ ] Comments only where "why" is non-obvious
- [ ] No TODOs without issue link
- [ ] New abstractions justified
- [ ] Naming consistent

## Findings
| ID | Severity | File:line | Section | Recommendation |
|---|---|---|---|---|

## Verdict
<APPROVED | APPROVED_WITH_WARNINGS | NEEDS_CHANGES | BLOCKED>

## Spec-drift
<none | legitimate | scope_creep | skipped_ac> + description
```
