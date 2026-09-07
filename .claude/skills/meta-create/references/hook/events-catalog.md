---
parent: meta-create
name: events-catalog
description: Complete catalog of all Claude Code hook events grouped by cadence, with stdin shapes.
---

# Hook Events Catalog

Complete list of all Claude Code hook events (32 as of CC 2.1.258, verified against `code.claude.com/docs/en/hooks` on 2026-09-02), grouped by cadence. Each entry shows the stdin shape and common use cases.

## Per Session

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `Setup` | One-time setup of a fresh environment (before the first session) | `{ session_id, cwd }` | Bootstrap tooling, install deps |
| `SessionStart` | Session begins or resumes (matcher: `startup`, `resume`, `clear`, `compact`, `fork`); resume receives staleness + estimated re-cache cost (2.1.251) | `{ session_id, source }` | Initialize state, setup logging |
| `SessionEnd` | Session ends | `{ session_id, transcript }` | Cleanup, final report |

## Per Turn

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `UserPromptSubmit` | User submits prompt | `{ session_id, prompt }` | Memory injection, prompt transform |
| `UserPromptExpansion` | Prompt is expanded (slash command / skill body) before sending | `{ session_id, prompt }` | Audit expansions |
| `Stop` | Turn ends normally | `{ session_id, last_assistant_message, transcript, stop_hook_active }` | Trace logging, test validation, digest |
| `StopFailure` | API error (rate limit, auth) | `{ session_id, error, transcript_path }` | Error recording, alerting |

## Per Tool Call

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `PreToolUse` | Before tool executes | `{ session_id, tool_name, tool_input }` | Validation, blocking, enforcement |
| `PostToolUse` | After tool succeeds | `{ session_id, tool_name, tool_input, tool_output }` | Formatting, context tracking, metrics |
| `PostToolUseFailure` | After tool fails | `{ session_id, tool_name, tool_input, error }` | Error tracking, retry logic |
| `PostToolBatch` | After a batch of parallel tool calls completes | `{ session_id, tool_calls }` | Batch metrics |
| `PermissionRequest` | Claude requests permission | `{ session_id, tool_name, tool_input }` | Auto-approve, custom policies |
| `PermissionDenied` | User denies permission | `{ session_id, tool_name, tool_input }` | Analytics, UX feedback |

## Subagent Lifecycle

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `SubagentStart` | Subagent spawns | `{ session_id, agent_type, agent_id }` | Logging, resource tracking |
| `SubagentStop` | Subagent completes | `{ session_id, agent_type, agent_id, result, transcript }` | Scoring, expertise extraction |

## Task Management

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `TaskCreated` | Task created | `{ session_id, task }` | Task tracking, notifications |
| `TaskCompleted` | Task completed | `{ session_id, task, result }` | Progress tracking, chaining |

## Team Coordination

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `TeammateIdle` | Teammate has no work | `{ session_id, teammate_id }` | Load balancing, reassignment |

## Configuration

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `InstructionsLoaded` | Instructions/rules loaded | `{ session_id, instructions }` | Validation, override injection |
| `ConfigChange` | Settings changed | `{ session_id, config }` | React to config updates |

## Filesystem

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `CwdChanged` | Working directory changed | `{ session_id, old_cwd, new_cwd }` | Context switch, project detection |
| `DirectoryAdded` | `/add-dir` or `--add-dir` added a directory | `{ session_id, directory }` | Load that dir's conventions |
| `FileChanged` | Watched file modified | `{ session_id, file_path }` | Hot reload, re-validation |

## Worktree

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `WorktreeCreate` | Git worktree created | `{ session_id, worktree_path, branch }` | Resource tracking |
| `WorktreeRemove` | Git worktree removed | `{ session_id, worktree_path }` | Cleanup verification |

## Context Management

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `PreCompact` | Before context compaction | `{ session_id, context_size }` | Save critical state |
| `PostCompact` | After context compaction | `{ session_id, context_size, compacted_size }` | Restore state, inject summaries |

## Model Switch (CC ≥2.1.251)

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `PreModelSwitch` | Before a requested model switch applies (sequential; matcher = canonical name of `to_model`) | `{ session_id, cwd, to_model, permission_mode }` | Block (`exit 2` or `hookSpecificOutput.permissionDecision: "deny"`), confirm, or annotate a switch |
| `PostModelSwitch` | After the session's model changed, including switches Claude Code makes itself (resume restore) — async | `{ session_id, cwd, from_model, to_model, permission_mode }` | Log, re-inject model-specific reminders |

## UI Interaction

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `Elicitation` | Claude asks user a question | `{ session_id, question }` | Auto-answer, logging |
| `ElicitationResult` | User answers | `{ session_id, question, answer }` | Preference learning |

## System

| Event | When | Stdin Shape | Common Use |
|-------|------|-------------|------------|
| `Notification` | System notification | `{ session_id, notification }` | Forwarding, filtering |
