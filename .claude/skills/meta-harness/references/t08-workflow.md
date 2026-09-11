---
parent: meta-harness
name: t08-workflow
description: T8 workflow pack — Grok .rhai and Claude dynamic workflows. Codex file type ausente.
---

# T8 — Workflow

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md) · [native-creators.md](native-creators.md).
Not a `/meta-harness` entrypoint (D7).

## 1. What / when

Bounded multi-worker orchestration. One HU stays inline. Fan-out only at ≥4 independent units (orchestrator-protocol).

## 2. Lookup

Grok bundled `create-workflow` skill + `[workflows]` in `05-configuration.md`. Claude dynamic workflows docs. Codex: **no `.rhai` type**.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| File type | Dynamic workflows (host feature; `disableWorkflows` / `enableWorkflows`) | **ausente** as a file type. Plugins (T7) are not a substitute workflow engine | `.grok/workflows/*.rhai` (project) / `~/.grok/workflows/` |
| Native creator | workflow-authoring (when enabled) drafts | — | `/create-workflow` drafts only (AC26) |
| Disable | `disableWorkflows` | n/a | `[workflows] enabled = false` or `GROK_WORKFLOWS=0` |
| Reload | feature flag / session | n/a | disk; `workflow` tool |

## 4. Min template

Use Grok `create-workflow` then this skill's lookup/impact/gate. Do not invent a Codex workflow format.

## 5. Evidence

T1: Grok `[workflows] enabled = false` (05-configuration.md). D13: Codex absence already in spec catalog.

## 6. Poneglyph grain

AC26: creator success is not the gate. Do not spawn workers without this-turn permission.

## 7. Absences

| Cell | Status |
|---|---|
| Codex `.rhai` / workflow files | **ausente** — do not clone Grok/Claude here; a plugin is T7 |
| `/meta-harness` workflow | **ausente** (D7) |
