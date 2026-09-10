---
name: review-patterns
description: |
  Patrones de revisión de código en dos modos: calidad (SOLID/DRY/code smells/complejidad/refactor) y rendimiento (cuellos de botella, fugas de memoria, N+1, async).
  Úsala cuando: refactor, deuda técnica, code review, violaciones SOLID, code smells, duplicación, endpoint lento, problemas de memoria, queries N+1, profiling, "refactoriza", "huele mal este código", "está lento".
metadata:
  keywords: >
    Keywords - code quality, SOLID, DRY, refactoring, complexity, performance, memory, N+1,
    bottleneck, leak, slow, latency, code smell, duplication, extract, simplify, decompose,
    clean code, maintainability, optimization, profiling
disable-model-invocation: false
argument-hint: "[file-path or module]"
when_to_use: |
  "refactoriza", "huele mal este código", "está lento", "deuda técnica", "code smell", "SOLID", "refactor", "performance bottleneck"
---

# Review Patterns

Unified code review skill with two modes: **quality** and **performance**. Patterns are language-agnostic.

## Mode Selection

| Trigger | Mode | Load |
|---------|------|------|
| refactor, SOLID, DRY, clean, smells, complexity, extract, simplify | **quality** | `${CLAUDE_SKILL_DIR}/references/01-mode-quality.md` |
| performance, slow, bottleneck, memory, leak, N+1, profiling, latency | **performance** | `${CLAUDE_SKILL_DIR}/references/02-mode-performance.md` |
| general code review (no specific trigger) | **quality** (default) | `${CLAUDE_SKILL_DIR}/references/01-mode-quality.md` |

When both triggers are present, load both mode references.

## Shared Severity Levels

| Level | Definition | Examples |
|-------|------------|----------|
| Critical | Code is broken, crashes, or system unusable | Unreachable code, infinite loops, null dereference, sync I/O in handlers, N+1 in loops |
| High | Significant issue — maintainability or degradation | God class, complexity >15, duplicate blocks, missing pagination, no connection pool |
| Medium | Noticeable code smell or impact | Long methods, magic numbers, deep nesting, missing indexes, no compression |
| Low | Minor improvement opportunity | Naming, comments, organization, debug logging in prod |

## Output Format (Summary)

Both modes produce structured output. Quality mode uses `Code Quality Review: [Component]`. Performance mode uses `Performance Review: [Component]`. Load the mode reference for full template details.

## Refactoring Safety (shared)

| Principle | Rule |
|-----------|------|
| Atomic | One change at a time |
| Reversible | Can undo immediately |
| Tested | All tests pass after each change |
| Behavioral | Same inputs, same outputs |

**Safe (auto-apply)**: Rename symbol, extract variable/function, inline temp, move method (same module), remove dead code.

**Risky (require confirmation)**: Change function signature, extract class, replace inheritance, merge/split modules, move cross-module, change public API.

## Scripts

| Script | Mode | Usage |
|--------|------|-------|
| `${CLAUDE_SKILL_DIR}/scripts/complexity-report.ts` | quality | `bun .claude/skills/review-patterns/scripts/complexity-report.ts <path>` |
| `${CLAUDE_SKILL_DIR}/scripts/find-n-plus-one.ts` | performance | `bun .claude/skills/review-patterns/scripts/find-n-plus-one.ts <path>` |

## Content Map

| Topic | File | Contents |
|-------|------|----------|
| Quality mode — full content | `${CLAUDE_SKILL_DIR}/references/01-mode-quality.md` | Quality review process, checklist, SOLID violations, complexity thresholds, refactoring patterns, gotchas, and pointers to quality sub-references. Read for any quality/refactoring task. |
| Performance mode — full content | `${CLAUDE_SKILL_DIR}/references/02-mode-performance.md` | Performance review checklist (DB/API/memory/async), red flags, common issues, metrics, gotchas, and pointers to performance sub-references. Read for any performance/bottleneck task. |
| Review checklist | `${CLAUDE_SKILL_DIR}/references/quality/review-checklist.md` | Comprehensive quality checklist: naming, functions, classes, files, error handling, types (5 items each). |
| Red flags (quality) | `${CLAUDE_SKILL_DIR}/references/quality/red-flags.md` | Detection table ordered by severity with problem description and detection method. |
| SOLID violations | `${CLAUDE_SKILL_DIR}/references/quality/solid-violations.md` | All 5 SOLID principles with violation patterns and fixes. |
| Complexity metrics | `${CLAUDE_SKILL_DIR}/references/quality/complexity-metrics.md` | Cyclomatic and cognitive complexity measurement and thresholds. |
| Anti-patterns | `${CLAUDE_SKILL_DIR}/references/quality/anti-patterns-reference.md` | Anti-patterns table with detection methods. |
| Common issues | `${CLAUDE_SKILL_DIR}/references/quality/common-issues.md` | 9 code smell patterns with before/after examples and fix patterns. |
| Extract function | `${CLAUDE_SKILL_DIR}/references/quality/extract-function.md` | Extract Calculation and Extract Conditional patterns. |
| Extract class | `${CLAUDE_SKILL_DIR}/references/quality/extract-class.md` | Data cohesion and Extract Service patterns. |
| Refactoring process | `${CLAUDE_SKILL_DIR}/references/quality/refactoring-process.md` | Safety-first flow, characterization tests, anti-patterns. |
| N+1 and sequential-op patterns | `${CLAUDE_SKILL_DIR}/references/performance/n-plus-one-patterns.md` | Detailed N+1 query problem with JOIN and batch-loading variants; synchronous blocking, unbatched operations, sequential-await-in-loop. |
| Memory leak and serialization | `${CLAUDE_SKILL_DIR}/references/performance/memory-leak-patterns.md` | Unbounded cache growth, event listener leaks, closure-captured references, large-object serialization. |
| Pre-refactoring checklist | `${CLAUDE_SKILL_DIR}/checklists/pre-refactoring.md` | Checklist to run before starting a refactor. |
| Post-refactoring checklist | `${CLAUDE_SKILL_DIR}/checklists/post-refactoring.md` | Checklist to verify after completing a refactor. |
| Review output template | `${CLAUDE_SKILL_DIR}/templates/review-template.md` | Full review output format with all sections. |

## Commandments cubiertos

| # | Cómo |
|---|---|
| V | Drives toward simple-by-default code (SOLID/DRY, decompose complexity, kill premature abstraction) |
| IV | Quality findings feed the `critic` gate — review is verification, not opinion |
| X | Performance mode targets real bottlenecks (N+1, memory leaks, blocking async) with evidence |

## Related

- `critic` — Phase 4 owner that dispatches this skill (quality + performance lenses).

---

**Version**: 1.0
**For**: Phase 4 `critic` (Step 6 dispatch) + Phase 3 `build` skill (inline quality-mode). The legacy `reviewer`/`builder` agents were cut in feature 008.
**Patterns**: Language-agnostic
