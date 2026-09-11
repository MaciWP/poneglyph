---
us: US9
title: T6 MCP pack
wave: W3
depends_on: [US3]
tdd_mode: skip
estimate: S
status: closed
approved: 2026-09-10
closed: 2026-09-10
---

# US9 — T6 MCP

## Execution prompt (Phase 3 input)

**Task**: Write the T6 MCP **configuration** pack (not an MCP server from scratch — out of scope).
**Context**: Claude `.mcp.json`; Codex `codex mcp` / config.toml; Grok `config.toml` / `/mcps`. Old `meta-create/references/mcp/*`. Grok `07-mcp-servers.md`.
**Constraints**: No implementing a server. Secrets: pack must say env/key files, not commit tokens.
**Deliverable**: `references/t06-mcp.md`.
**Verify**: three columns; install step named not reimplemented.
**Ask first**: nothing.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Status** | 🟡 draft |
| **Wave** | W3 |
| **Depends on** | US3 |
| **Blocks** | none |
| **Files touched** | `t06-mcp.md` |
| **TDD-mode** | skip: documentation pack |
| **Estimate** | S |
| **Cómo arrancar** | Copy t01; MCP paths per host |
| **Decisión absorbida** | D12 D23 |

## User story

- **As a**: Lead wiring an MCP server
- **I want**: the native config entry for each host
- **So that**: I do not paste Claude `.mcp.json` into Codex

## Acceptance criteria

- **AC1**: Given T6 pack, when opened, then 7-point contract + three hosts.
- **AC2**: Given a secret, when documenting, then it is not inlined in the committed file.

tdd-skip: documentation pack, no testable behavior
