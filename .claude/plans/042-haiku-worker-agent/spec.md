# 042: Haiku worker agent

## Goal

Give cheap-tier delegated work a lean Claude subagent so a Haiku spawn stops starting
at the `general-purpose` floor.

## Evidence (2026-10-10)

| Measure | Value | Source |
|---|---|---|
| `general-purpose` Haiku subagent, first-turn context | 48–50k (≈45 spawns in 3 days) | subagent transcripts + `*.meta.json` agentType |
| `Explore` Haiku subagent | 22k (some 9k), no `instructions` attachment | same |
| Headless probe, same trivial task | `general-purpose` 14,951 · `worker` 9,387 | `claude -p --agents` probe |
| Haiku auto-compaction | ~87k | memory `project-haiku-context-brake` |

Probe definition: `tools: [Read, Bash, Edit, Write]`, `model: haiku`, a two-sentence prompt.
The interactive gap should be wider (general-purpose inherits Artifact, MCP and every
interactive tool): measure it, do not assume it.

## Definition of done

1. A `worker` agent source in this repo; `sync-claude.ts` installs it into
   `~/.claude/agents/` next to the generated `prompt-router.md`, with a status line and a
   test (memory `feedback-status-covers-generated-artifacts`).
2. An interactive spawn of `worker` measured from its subagent transcript; keep the agent
   only if its floor is ≤ 50 % of `general-purpose` on the same task.
3. Doctrine: CLAUDE.md §Agents and skills names `worker` for cheap-tier bounded work
   (reads, searches, small edits); `general-purpose` stays for fresh-context review.
   Host-neutral wording; Codex/Grok keep their native equivalents
   (`docs/harness-adapters.md` §Model tiers).
4. `bun run doctor` green except pre-existing warnings; budget ratchet updated if
   CLAUDE.md bytes change (`budget.ts --tighten`).

## Risks

- Worker lacks a tool a task needs → the spawn fails loudly; mitigation: the doctrine line
  says when to fall back to `general-purpose`.
- Explore already covers read-only search at 22k → the worker's value is bounded
  edits and Bash; do not route read-only sweeps away from Explore.

## Rejected

Trimming `general-purpose` itself: built-in, not configurable.
