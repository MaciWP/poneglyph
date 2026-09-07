# Skill authoring rubric (vendored official guidance)

Source: [Anthropic — Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), vendored 2026-06-10 (017/US10). This is the MANDATORY checklist for every new or modified skill in poneglyph. Each row cites the official rule; deviations require a written justification in the PR/commit.

## Contents

- [Rubric — frontmatter](#rubric--frontmatter)
- [Rubric — description](#rubric--description)
- [Rubric — body and structure](#rubric--body-and-structure)
- [Rubric — references (progressive disclosure)](#rubric--references-progressive-disclosure)
- [Rubric — scripts (if the skill bundles code)](#rubric--scripts-if-the-skill-bundles-code)
- [Eval-first rule (MANDATORY before writing)](#eval-first-rule-mandatory-before-writing)
- [Anti-patterns](#anti-patterns)

## Rubric — frontmatter

| # | Rule | Official limit |
|---|---|---|
| F1 | `name`: lowercase letters, numbers, hyphens only | ≤64 chars; no XML tags; no reserved words ("anthropic", "claude") |
| F2 | `name` style: gerund form preferred (`processing-pdfs`); noun phrases acceptable | avoid vague names (`helper`, `utils`, `tools`) |
| F3 | `description`: non-empty | ≤1024 chars; no XML tags |

## Rubric — description

| # | Rule | Why |
|---|---|---|
| D1 | **Third person always** ("Processes X…", never "I can…" / "You can…") | Injected into the system prompt; inconsistent POV causes discovery problems |
| D2 | States **what** the skill does AND **when** to use it | Claude selects from 100+ skills on description alone |
| D3 | Includes **specific trigger keywords/contexts** (file types, user phrasings, domains) | Semantic matching is the activation mechanism — no index exists |
| D4 | Specific, not vague ("Helps with documents" = rejected) | Vague descriptions undertrigger |

> Claude Code listing cap: `description` + `when_to_use` combined truncate at 1.536 chars; the listing budget is ~1% of a fixed ~200K baseline and least-invoked skills drop first. Put load-bearing keywords EARLY in the description. (See `plans/_research-skill-activation-2026-06-09.md` for verified mechanics.)

## Rubric — body and structure

| # | Rule | Official limit |
|---|---|---|
| B1 | SKILL.md body under **500 lines** (poneglyph internal target: ≤350) | split into references when approaching it |
| B2 | Concise — assume Claude is already smart; every paragraph must justify its token cost | "The context window is a public good" |
| B3 | Degrees of freedom match task fragility: high (heuristics) / medium (templates) / low (exact scripts, "do not modify") | fragile+critical = low freedom |
| B4 | Consistent terminology (one term per concept, throughout) | mixing "field/box/element" degrades instruction-following |
| B5 | No time-sensitive info in main content; legacy material goes in an "old patterns" collapsible | content rots otherwise |
| B6 | Complex tasks get a checklist workflow Claude can copy and tick | prevents skipped validation steps |
| B7 | Quality-critical tasks get a feedback loop (validate → fix → repeat; only proceed when green) | catches errors early |
| B8 | Forward slashes in ALL paths (never backslashes) | Windows-style paths break Unix |
| B9 | Provide a default approach with an escape hatch — not a menu of N alternatives | too many options confuse |

## Rubric — references (progressive disclosure)

| # | Rule | Official limit |
|---|---|---|
| R1 | References link **one level deep from SKILL.md** — no chained ref→ref→ref | nested refs get partially read (`head -100`) |
| R2 | References **>100 lines carry a table of contents** at the top | partial reads still see the full scope |
| R3 | SKILL.md ends with / contains a pointer map: Topic → File → Contents-and-when-to-read | the Contents column is the load trigger (poneglyph Content Map pattern) |
| R4 | Domain-specific organization (Pattern 2): split by domain so irrelevant context never loads | `reference/finance.md`, not `docs/file2.md` |
| R5 | Descriptive file names (`form_validation_rules.md`, not `doc2.md`) | Claude navigates the directory like a filesystem |

## Rubric — scripts (if the skill bundles code)

| # | Rule |
|---|---|
| S1 | Scripts solve, don't punt — explicit error handling, no bare `open(path).read()` |
| S2 | No voodoo constants — every parameter value justified in a comment |
| S3 | Execution intent explicit: "Run X" (execute) vs "See X for the algorithm" (read) |
| S4 | Dependencies listed explicitly; never assume a package is installed |
| S5 | MCP tools referenced fully qualified (`ServerName:tool_name`) |
| S6 | Plan-validate-execute for batch/destructive/high-stakes operations (verifiable intermediate outputs) |
| S7 | Artifact that persists runtime/transcript data → its output path enters `.gitignore` in the SAME change (017 lesson: learning-inbox shipped committable) |

## Eval-first rule (MANDATORY before writing)

Official: "Create evaluations BEFORE writing extensive documentation."

1. **Identify gaps**: run Claude on representative tasks WITHOUT the skill; document the specific failures.
2. **Create ≥3 evaluation scenarios** that test those gaps (query + files + expected_behavior).
3. **Establish baseline** without the skill.
4. **Write minimal instructions** — just enough to pass the evaluations.
5. **Iterate**: run evals, compare to baseline, refine.

In poneglyph, the bundled `skill-creator` plugin already runs evals — use it for steps 2-5 instead of building a bespoke harness. A new skill PR without its 3 scenarios (or an explicit justification for skipping) does not merge (Commandment IV).

> Iteration model: develop with "Claude A" (author), test with "Claude B" (fresh instance using the skill), observe B's real behavior, refine with A. Watch for: unexpected exploration paths, missed reference links, over-read files (move that content into SKILL.md), never-read files (cut or re-signal them).

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Verbose explanations of things Claude knows (what a PDF is) | delete — concise version wins |
| Vague description ("Helps with documents") | rewrite per D2-D4 |
| First/second-person description | rewrite per D1 |
| Reference chains >1 level | flatten to direct links from SKILL.md |
| >100-line reference without ToC | add `## Contents` |
| Time-sensitive instructions in main body | move to "old patterns" |
| Menu of N equivalent options | pick a default + escape hatch |
| Skill written before any evaluation exists | apply the eval-first rule above |
| Config field rolled out to N units without a 1-unit live smoke first | smoke ONE unit through the real invocation path, then roll out (017 lesson: disable-model-invocation would have broken /flow on 6 skills) |
