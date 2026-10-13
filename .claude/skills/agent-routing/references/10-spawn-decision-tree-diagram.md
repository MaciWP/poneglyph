---
parent: agent-routing
name: spawn-decision-tree-diagram
description: Mermaid rendering of the spawn decision tree (three axes), the P1–P8 principle table in SKILL.md is the executable rule; this is the picture.
---

# Spawn decision tree: diagram

Resolve explicit consultation requests through the
[consultation route](../../../docs/harness-adapters.md#consultations) first. The diagram below
describes default native delegation. It does not override those explicit routes.
Permission and model choice remain owned by CLAUDE.md §Agents and skills.

The table of principles P1–P8 stays inline in `SKILL.md`; this diagram only renders it. Built-in agents need no approval (CLAUDE.md §Agents and skills).

```mermaid
graph TD
  START["Trabajo para el Lead"] --> BIG{"Eje-1: ¿lectura de contexto grande<br/>(barrido amplio, logs largos, web)?"}
  BIG -->|"No (1-2 ficheros, grep rápido)"| INLINE["INLINE en main"]
  BIG -->|"Sí"| RO{"Eje-2: ¿read-only<br/>(research/exploración/review)?"}
  RO -->|"No → escritura"| OPTIN["INLINE secuencial<br/>salvo OPT-IN explícito del usuario<br/>(ultracode) → Workflow + worktree"]
  RO -->|"Sí"| NAT{"Eje-3: ¿NEGOCIAN<br/>interfaces entre sí?"}
  NAT -->|"No, 1-4 zonas"| AG["1-4 agentes integrados en un mensaje<br/>(Explore / general-purpose, modelo explícito)"]
  NAT -->|"No, ≥4 orquestadas (opt-in)"| WF["WORKFLOW (fan-out read-only)<br/>research multi-search · panel de DECISIÓN ≥4"]
  NAT -->|"Sí → ≥3 dominios"| TEAM["TEAM mode (narrow · experimental)<br/>negocian vía task list (#24316 general-purpose)"]
```

Reading order: axis 1 asks whether the work means reading a large context (no → inline); axis 2 whether it is read-only (write fan-out needs explicit opt-in); axis 3 whether units negotiate interfaces (1–4 independent areas → built-in agents in one message, ≥4 orchestrated → Workflow, negotiating → Team mode).
