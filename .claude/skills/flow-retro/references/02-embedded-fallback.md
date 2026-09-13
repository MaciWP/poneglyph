# Retro — embedded fallback template (if `retro.template.md` missing)

Extracted verbatim from `SKILL.md` (017/US9 — mechanical move, no content redesign). Used by Step 2 when `.claude/plans/templates/retro.template.md` does not exist.

```markdown
# Retro — {feature-name}

## Frontmatter
spec / phase / retro_level / verdict_phase4 / spec_drift / promotions_proposed / commandment_violations / living_spec_delta / action_items / created / status

## 1. Executive summary
1-2 paragraphs.

## 2. Technical lessons
### ✅ Patterns that worked
- ...
### ❌ Patterns that didn't work
- ...

## 3. Process audit
| Phase | Effort | Friction | Improvement |
|---|---|---|---|

## 4. Drillme — 5 retro questions
(See §Drillme block in skill.)

## 5. Promotion candidates
| Candidate | Scope | Type | Why | Concrete proposal |
|---|---|---|---|---|

## 6. Living-spec deltas
spec_drift: <none|legitimate|scope_creep|skipped_ac>
Proposed diff (if legitimate):
```diff
--- spec.md
+++ spec.md
@@ ... @@
- ...
+ ...
```
Rationale: ...

## 7. Commandments audit
| # | Commandment | Status | Evidence |
|---|---|---|---|

## 8. Action items
| Action | Owner | Trigger | Due |
|---|---|---|---|
```
