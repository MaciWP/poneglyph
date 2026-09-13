---
parent: harness-config
name: t12-env
description: T12 environment-variable pack. Secrets stay in env / key files, never in git. Claude does not read .env.
---

# T12 — Environment variables

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md) · [t10-settings.md](t10-settings.md).
Absorbs cookbook `04-env-vars.md` (D27). `.env` edits still need `sensitive: <reason ≥8 chars>`.

## 1. What / when

Process/session env the host reads. Durable non-secret defaults may live in settings (T10 `env` maps). Secrets never in committed JSON/TOML.

## 2. Lookup

Claude env-vars page + settings `env`. Codex `learn.chatgpt.com/docs/config-file/environment-variables`. Grok `05-configuration.md` environment-variables table.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Surfaces | `settings.json` `env` (per scope); shell export; **does not read `.env` files** | `CODEX_HOME` and the public env list; `config.toml` for durable settings | `GROK_*` overrides; `[session] load_envrc`; process env. `GROK_CONFIG` is a config overlay, not a secret dump |
| Secrets | Env / key files. Never commit tokens | same (`env_key` names a var; do not paste the value) | same. MCP `env = { KEY = "sk-…" }` in docs is an example — interpolate |
| Precedence | Env var often wins the matching setting (e.g. `CLAUDE_CODE_EFFORT_LEVEL` vs `effortLevel`) | Env for overrides; TOML for durable | Env > `config.toml` > default (per key; `grok inspect`) |
| `.env` | Not loaded by Claude Code | Not this pack's Claude recipe | `[session] load_envrc` is opt-in `.envrc`, not a committed `.env` with tokens |
| Reload | New session / new shell | New process | New process |

`CLAUDECODE=1` is set in Bash-tool shells, not in hooks or the status line.

## 4. Min template

Template N/A. Put non-secrets in settings `env` or TOML. Put secrets in the environment or a gitignored key file.

## 5. Evidence

T1 + B: vendor env pages 2026-09-10. Cookbook 04: Claude does not read `.env`. **sin evidencia A/B** for “env is faster than settings”.

## 6. Poneglyph grain

No committed token examples. `.env` / `*.lock` / `package.json` / `settings*.json` stay sensitive-path. Gate already rejects credentials in MCP URLs.

## 7. Absences

| Cell | Status |
|---|---|
| Claude reading `.env` | **ausente** |
| Token literals in templates | **ausente** |
| Copying `CLAUDE_CODE_*` names into Grok | **ausente** — use `GROK_*` / TOML |
