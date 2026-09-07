---
us: US2
title: minimumVersion ≥2.1.198 + relación con requiredMinimumVersion anotada
wave: W1
depends_on: []
tdd_mode: optional
estimate: S
status: closed
closed: 2026-07-08
---

# US2 — Suelo de versión

## Execution prompt (Phase 3 input)

**Task**: Subir `settings.json.minimumVersion` de `2.1.166` a `2.1.198` y anotar en system-inventory la relación con `requiredMinimumVersion`.
**Context**: 2.1.198 lleva el fix "conditional rules not loading via symlinked paths" — TODA la capa global es symlink (CG-02). `requiredMinimumVersion` es **managed setting** (org policy, changelog 2.1.163) — no aplica a config personal ni supersede `minimumVersion` (CG-12, resuelto en discovery).
**Constraints**: `sensitive: settings.json config global` — cambio de 1 línea. Anotación en la frase de schema-findings del inventario (ya refrescada en P1).
**Deliverable**: gate a 2.1.198; nota con fuente (changelog 2.1.163/2.1.198).
**Verify**: JSON parse ok; suites verdes; CC instalado (2.1.202) ≥ gate — sin lockout.
**Ask first**: nada.

## ⚡ Quick reference

| Campo | Valor |
|---|---|
| **Wave / Deps** | W1 / none |
| **Files** | settings.json (sensitive), docs/system-inventory.md |
| **TDD** | optional |

## Acceptance criteria

- **AC1**: Given settings, when se lee, then `minimumVersion: "2.1.198"` y la anotación existe con fuente (spec AC2).
