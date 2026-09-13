---
parent: harness-config
name: t11-permissions
description: T11 permissions pack — Claude allow/deny/ask, Codex sandbox/approvals, Grok modes and rules. Disable is not delete. Widening authority on delete is H8.
---

# T11 — Permissions

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md) · [t10-settings.md](t10-settings.md) · [t05-hook.md](t05-hook.md).
Absorbs cookbook `05-permissions.md` (D27).

## 1. What / when

Who may run which tool. Hooks (T5) enforce after the fact. Settings (T10) hold the keys. Do not weaken existing deny rules to “make a template nicer”.

## 2. Lookup

Claude permissions docs. Codex sandbox + approval policy (`config-reference`). Grok `22-permissions-and-safety.md`.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Keys | `permissions.allow` / `ask` / `deny` + `defaultMode`. Pattern `Tool` or `Tool(specifier)` | `sandbox_mode` + approval policy in `config.toml`. CLI `--yolo` / sandbox flags | Native `[ui] permission_mode` (user-only): `default`/`ask`, `auto`, `always-approve`. Project: `[permission]` rules. Claude-compat aliases in `.claude/settings.json` (`acceptEdits`, `dontAsk`, `plan`, `bypassPermissions`) — not the TOML enum |
| Eval order | deny → ask → allow → defaultMode | Sandbox then approvals; deny/hooks still apply under yolo | Modes set baseline; allow/ask/deny still apply. Always-approve does **not** skip deny or hooks |
| Scope | User/managed vs project: `defaultMode: "bypassPermissions"` **ignored** in project/local since 2.1.257 | User vs project TOML | Project `.grok/config.toml` may set `[permission]`; `permission_mode` is user/UI |
| Disable | Remove the rule from the **settings that are loaded**; leftover overlay still binds | Don't set / tighter sandbox | `/always-approve` off; or deny rules |
| Reload | Session / settings pick-up | Restart | Session; Shift+Tab / `/settings` for mode |

H8: deleting or narrowing a deny **widens authority**. Say so in impact before mutate. AC25: source vs overlay vs session — delete of a repo file does not prove the host stopped.

## 4. Min template

Template N/A as a skill file. Restrictive Claude sketch (cookbook 05, still valid as Claude-only):

```json
{
  "permissions": {
    "allow": ["Bash(bun test *)", "Bash(git status)"],
    "ask": ["Bash(git push *)", "Bash(git commit *)"],
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"]
  }
}
```

Do not paste this into Codex/Grok TOML.

## 5. Evidence

T1 + B: Grok 22, Claude permissions, Codex sandbox pages 2026-09-10. **sin evidencia A/B** for an “ideal allowlist size”.

## 6. Poneglyph grain

This repo keeps deny on `.env` / `secrets/`. Git commit/push stay asked. Impact before widening.

## 7. Absences

| Cell | Status |
|---|---|
| Claude `permissions` JSON in Codex/Grok | **ausente** — native keys only |
| Weakening deny to match a template | **ausente** |
