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
  RO -->|"No → escritura"| OPTIN["INLINE secuencial<br/>salvo OPT-IN explícito del usuario<br/>(ultracode) → agentes en worktree"]
  RO -->|"Sí"| NAT{"Eje-3: ¿NEGOCIAN<br/>interfaces entre sí?"}
  NAT -->|"No"| AG["Un Explore por zona en un mensaje<br/>(tier barato explícito; panel de DECISIÓN ≥4)"]
  NAT -->|"Sí → ≥3 dominios"| TEAM["TEAM mode (narrow · experimental)<br/>negocian vía task list (#24316 general-purpose)"]
```

Reading order: axis 1 asks whether the work means reading a large context (no → inline); axis 2 whether it is read-only (write fan-out needs explicit opt-in); axis 3 whether units negotiate interfaces (independent areas → one `Explore` per area in one message, negotiating → Team mode).
