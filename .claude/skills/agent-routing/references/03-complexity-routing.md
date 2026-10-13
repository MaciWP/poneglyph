---
parent: agent-routing
name: complexity-routing
description: Complexity factors, steps above Low, routing levels, mode selection, tiered/team/worktree/model routing.
---

# Complexity Routing

## Contents

- [Complexity Factors](#complexity-factors)
- [Routing by Complexity](#routing-by-complexity)
- [Mode Selection Table](#mode-selection-table)
- [Tiered Mode](#tiered-mode)
- [4-Gate Criteria (Team Mode Only, ALL must pass)](#4-gate-criteria-team-mode-only-all-must-pass)
- [Team Mode Execution](#team-mode-execution)
- [Worktree Decision](#worktree-decision)
- [Model Routing](#model-routing)
- [Effort Routing (Frontmatter: static)](#effort-routing-frontmatter-static)
- [Calculation Examples](#calculation-examples)

Calculate complexity before delegating to determine if invoking the `flow` skill (plan phase) is required and which execution mode to use.

## Complexity Factors

| Factor | Low | Medium | High |
|--------|-----|--------|------|
| **Files** | 1-2 | 3-5 | 6+ |
| **Domains** | 1 | 2-3 | 4+ |
| **Dependencies** | 0-1 | 2-3 | 4+ |
| **Security** | None | Data | Auth/Crypto |
| **Integrations** | 0-1 | 2-3 | 4+ |

Count the steps above Low: a Medium factor adds 1, a High factor adds 2. Five factors
give 0-10 steps. A task that is obviously trivial is not counted at all.

## Routing by Complexity

| Steps above Low | Level | Routing | Reason |
|-------|-------|---------|--------|
| **0-1** | low | inline, no plan | Every factor Low, or one Medium |
| **2-4** | medium | flow (plan phase) optional | Consider a plan if there is uncertainty; matches tiered mode below |
| **5-10** | high | flow (plan phase) mandatory | Requires a structured roadmap; also the team-mode gate |

## Mode Selection Table

| Level | Units / Domains | Negotiate interfaces | Mode | Cost |
|-------|---------|-------------------|------|------|
| Any | 1-3 units | none | **inline** | 1x |
| Any | ≥4 independent READ-ONLY units | No | **Workflow** | scales w/ #units |
| Any | ≥4 independent WRITE units | No | **inline sequential** (Workflow only with explicit user opt-in, "ultracode" / direct ask) | 1x |
| medium | 2-3 | Yes (shared types/APIs) | **tiered** (inline contracts) | ~2x |
| high | 3+ domains (4-gate pass) | Yes | **team** (experimental) | 3-7x |
| high | 3+ (4-gate fail) | none | **inline / Workflow (read-only)** | 1x+ |

Default is inline. First resolve explicit consultations with the
[consultation route](../../../docs/harness-adapters.md#consultations).
Write fan-out needs explicit opt-in (SKILL.md P8).

## Tiered Mode

Intermediate mode for 2-3 domains with shared interfaces and medium complexity. The `flow` skill (plan phase, Mode B) designs contracts before the units are built, all inline; no separate architect agent.

```mermaid
graph TD
    P[flow (plan phase): Mode A roadmap + Mode B contracts]
    P --> D1[Lead builds domain A inline, honoring contract]
    D1 --> D2[Lead builds domain B inline, honoring contract]
    D2 --> R[flow review phase: validates cross-domain integration]
```

| Step | Who | Action |
|------|-----|--------|
| 1 | `flow` skill (plan phase) | Generates roadmap with `executionMode: "tiered"` and an inline Mode B section (interface contracts between domains X and Y) |
| 2 | Lead (inline, sequential) | Builds each domain honoring the Mode B contracts |
| 3 | `flow` skill (review phase) | Validates cross-domain integration against contracts |

## 4-Gate Criteria (Team Mode Only: ALL must pass)

| Gate | Threshold |
|------|-----------|
| Complexity | high (5+ steps) |
| Independent domains | ≥ 3 with no shared files |
| Inter-agent communication | Necessary (interface negotiation) |
| Feature flag | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |

Opt-out: `PONEGLYPH_DISABLE_TEAM_MODE=1` forces subagents regardless.

## Team Mode Execution

### Prerequisites

| Requirement | Check |
|-------------|-------|
| Env var active | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
| Planner recommended team | `executionMode: team` in roadmap |
| High complexity | Counted above |
| 3+ independent domains | No shared files between domains |

### Teammate prompts, coordination & fallback

Team mode is experimental and rarely used (4-gate + opt-in). The teammate prompt template, domain-boundary definition, coordination protocol and recovery/fallback table are canonical in `flow/references/plan/05-team-mode.md`, not duplicated here. Routing-level summary: spawn one teammate per domain; they negotiate contracts via the shared task list; the Lead runs `Skill(flow, "review")` over the full changeset; any stuck/failed teammate folds back to inline or a `Workflow` unit.

> Current limitation: teammates are always `general-purpose` (issue anthropics/claude-code#24316); each still loads `~/.claude/` automatically (Poneglyph rules/skills/hooks apply). Activation flag: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

## Worktree Decision

| Condition | Worktree |
|-----------|----------|
| ≥4 `Workflow` units with overlapping files | Mandatory |
| 2+ parallel units touching the same paths | Mandatory |
| Task marked experimental | Mandatory |
| Single inline unit (1-3) | Not needed |

> Worktree rules do NOT apply in team mode. Each teammate runs in its own Claude Code process.

## Model Routing

| Work category | Complexity | Model |
|----------------|------------|-------|
| Inline build/review (Lead session): the default for ALL writes | any | session model (`effortLevel`) |
| Workflow unit: read-only research/review lens | any | mid tier of the host (default) |
| Workflow unit: write (explicit opt-in only) | > 50 | top tier of the host |
| Read-only exploration (`Explore`) | any | always named on the call (rows below); unnamed it inherits the Lead's model (capped at the top tier, CC 2.1.198) |
| Scout (`Explore`) | search, inventory, locate, classify, summarise, audit, web research | cheapest tier, `effort: "medium"` |
| Scout for security work (the cheapest tier may refuse, see below) | any | mid tier, `effort: "medium"` |
| `subagent_type: "fork"` | any | parent's model: a model override is ignored (CC 2.1.232) |
| Any spawn that omits `model` | any | `CLAUDE_CODE_SUBAGENT_MODEL` (cheap tier, `settings.global.json` env, CC 2.1.251 default semantics). Backstop only: CLAUDE.md still requires an explicit model, and a verify/judge unit names the top tier |

> Built-in agents need no approval (CLAUDE.md §Agents and skills). Give each scout one narrow question (prompt shape in `06-context-arch-h.md` §Scout prompt) so the prompt stays under 100K tokens, where the cheapest tier bills 5x (measured on the current one). The Lead verifies any agent fact that decides something.

> How many scouts (adapted from Anthropic's multi-agent research system): one fact or one file → the Lead inline, a scout adds a hand-off and seconds for nothing; N independent areas → one scout per area, launched in the same message. Never a scout per file of one area.
>
> Never a cheapest-tier scout for security work (a security review, auth, secrets, exploit analysis): the cheapest tier may stop with `stop_reason: "refusal"` (category `cyber`). Use the mid tier, or keep it in the Lead.

## Effort Routing (Frontmatter: static)

Effort scale: `low < medium < high < xhigh`

| Work | effort | Rationale |
|-------|--------|-----------|
| Scout (`Explore` on the cheapest tier) | `medium` (set on the call) | At `low` the cheapest tier stops early, skips searches and does not check its work. Eval 2026-10-08: `medium` 10/10 = `high` 10/10, 4.1 s vs 5.4 s. |
| Inline build/review | session `effortLevel` | The Lead inherits the session effort. |
| Workflow unit | per `agentType` frontmatter (or inherit) | Set on the custom agentType when one is defined. |

> The Agent tool takes `effort` per call (current Agent tool schema); frontmatter `effort` stays the static default for a custom agentType.

### xhigh

`xhigh` exists only on some models; the model's documentation says which. Where it is absent, it behaves as `high`. Reserve for:

| When | Condition |
|------|-----------|
| 8+ steps above Low | Maximum reasoning budget for critical tasks |
| Security audit | Auth/Crypto changes with high blast radius |
| Architecture design | Cross-domain refactors with 6+ files affected |

## Calculation Examples

### Low complexity (0-1 steps)
> "Add email validation to the registration endpoint"

- Files 1-2, Domains 1, Dependencies 1, Integrations 0: Low
- Security: Data (Medium) → 1 step
- **1 step** → inline, no plan

### High complexity (5-10 steps)
> "Implement OAuth authentication system with Google and GitHub"

- Files 6+, Domains 4+, Dependencies 4+, Security Auth, Integrations 4+: all High
- **10 steps** → plan mandatory
