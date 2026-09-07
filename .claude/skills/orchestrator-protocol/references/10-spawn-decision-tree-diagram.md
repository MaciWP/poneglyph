---
parent: orchestrator-protocol
name: spawn-decision-tree-diagram
description: Mermaid rendering of the spawn decision tree (three axes) — the P1–P8 principle table in SKILL.md is the executable rule; this is the picture.
---

# Spawn decision tree — diagram

Relocated verbatim from `SKILL.md` §Step 1 on 2026-09-03 (plan 032/WP4 — the table of principles P1–P8 stays inline; the diagram duplicated it). Applies only **after** the user approved spawn and model (CLAUDE.md §Agent spawn).

```mermaid
graph TD
  START["Trabajo para el Lead"] --> CNT{"Eje-1: ¿# unidades de trabajo<br/>independientes y paralelizables?"}
  CNT -->|"1 (incl. 1 tarea grande no paralelizable)"| INLINE
  CNT -->|"2-3"| INLINE["INLINE en main<br/>NUNCA 1 agente · 'isolation' no es excusa (/clear limpia)"]
  CNT -->|"≥4"| RO{"Eje-2: ¿unidades read-only<br/>(research/exploración/review)?"}
  RO -->|"Sí"| NAT{"Eje-3: ¿NEGOCIAN<br/>interfaces entre sí?"}
  RO -->|"No → escritura"| OPTIN["INLINE secuencial<br/>salvo OPT-IN explícito del usuario<br/>(ultracode) → Workflow + worktree"]
  NAT -->|"No → independientes"| WF["WORKFLOW (fan-out read-only)<br/>research multi-search · panel de DECISIÓN ≥4"]
  NAT -->|"Sí → ≥3 dominios"| TEAM["TEAM mode (narrow · experimental)<br/>negocian vía task list (#24316 general-purpose)"]
```

Reading order: axis 1 counts independent, parallelizable units (1–3 → inline, always); axis 2 asks whether the ≥4 units are read-only (write fan-out needs explicit opt-in); axis 3 asks whether they negotiate interfaces (Workflow when independent, Team mode when they do).
